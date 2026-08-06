/* ============================================================
   Verifica o banco de verdade.

   Sobe um PostgreSQL local, recria o mínimo do Supabase (papéis e
   funções de autenticação), aplica o schema do projeto e roda o
   teste de isolamento. É o que prova que uma igreja não alcança os
   dados de outra — e que um membro não altera o que é da liderança.

   Roda com: npm run test:banco
   Precisa de: postgresql-16 instalado (psql e initdb).
   Sem PostgreSQL disponível, avisa e não reprova.
   ============================================================ */
import { execFileSync, execSync } from 'node:child_process';
import { createServer } from 'node:net';
import { writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DADOS = '/tmp/pg-ekklesia-teste';
// Porta livre escolhida na hora: um cluster esquecido de outra execução
// não impede esta de rodar.
const PORTA = await new Promise(r => {
  const s = createServer();
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); });
});
const SOCKET = '/tmp';
let falhas = 0;

function ok(desc, cond, detalhe) {
  if (cond) console.log(`  ✓ ${desc}`);
  else { falhas++; console.log(`  ✗ ${desc}${detalhe ? ' — ' + detalhe : ''}`); }
}

function acharBin() {
  for (const d of ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/local/pgsql/bin']) {
    if (existsSync(join(d, 'initdb'))) return d;
  }
  return null;
}

const BIN = acharBin();
if (!BIN) {
  console.log('\nBanco de dados');
  console.log('  ⚠ PostgreSQL não encontrado — teste do banco pulado.');
  console.log('    Instale com: apt-get install postgresql-16');
  process.exit(0);
}

function psql(args, banco = 'postgres') {
  return execFileSync(join(BIN, 'psql'),
    ['-h', SOCKET, '-p', String(PORTA), '-U', 'postgres', '-d', banco, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

console.log('\nBanco de dados');

// ---------- sobe um cluster limpo ----------
try {
  try { execSync(`${BIN}/pg_ctl -D ${DADOS} stop -m immediate`, { stdio: 'ignore' }); } catch {}
  rmSync(DADOS, { recursive: true, force: true });
  mkdirSync(DADOS, { recursive: true });
  const comoPostgres = process.getuid && process.getuid() === 0 ? 'su postgres -c ' : '';
  if (comoPostgres) execSync(`chown -R postgres:postgres ${DADOS}`, { stdio: 'ignore' });
  const cmd = `${BIN}/initdb -D ${DADOS} -A trust --locale=C --encoding=UTF8`;
  execSync(comoPostgres ? `su postgres -c "${cmd}"` : cmd, { stdio: 'ignore' });
  const up = `${BIN}/pg_ctl -D ${DADOS} -o "-p ${PORTA} -k ${SOCKET}" -l /tmp/pg-ekklesia.log start -w`;
  execSync(comoPostgres ? `su postgres -c '${up}'` : up, { stdio: 'ignore' });
  ok('PostgreSQL de teste no ar', true);
} catch (e) {
  console.log('  ⚠ não consegui subir o PostgreSQL — teste do banco pulado.');
  console.log('    ' + String(e.message).split('\n')[0]);
  process.exit(0);
}

try {
  // ---------- recria o mínimo do Supabase ----------
  writeFileSync('/tmp/ambiente.sql', `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub','')::uuid;
$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated;
`);
  psql(['-q', '-c', 'drop database if exists ekklesia', '-c', 'create database ekklesia']);
  psql(['-q', '-f', '/tmp/ambiente.sql'], 'ekklesia');

  // ---------- aplica o schema do projeto ----------
  let erroSchema = null;
  try {
    psql(['-v', 'ON_ERROR_STOP=1', '-q', '-f', join(RAIZ, 'supabase/schema.sql')], 'ekklesia');
  } catch (e) { erroSchema = (e.stderr || e.message).split('\n').find(l => /ERROR/i.test(l)); }
  ok('o schema aplica sem erro', !erroSchema, erroSchema);
  if (erroSchema) throw new Error('schema não aplicou');

  // Rodar duas vezes precisa ser inofensivo: o guia manda colar de novo.
  let erroRepetido = null;
  try {
    psql(['-v', 'ON_ERROR_STOP=1', '-q', '-f', join(RAIZ, 'supabase/schema.sql')], 'ekklesia');
  } catch (e) { erroRepetido = (e.stderr || e.message).split('\n').find(l => /ERROR/i.test(l)); }
  ok('aplicar o schema duas vezes não quebra nada', !erroRepetido, erroRepetido);

  // ---------- proteção ligada em tudo ----------
  const semRls = psql(['-qtA', '-c',
    "select tablename from pg_tables where schemaname='public' and not rowsecurity"], 'ekklesia').trim();
  ok('todas as tabelas estão protegidas', !semRls, 'sem proteção: ' + semRls.replace(/\n/g, ', '));

  const qtdPoliticas = Number(psql(['-qtA', '-c',
    "select count(*) from pg_policies where schemaname='public'"], 'ekklesia').trim());
  ok(`há políticas de acesso definidas (${qtdPoliticas})`, qtdPoliticas >= 20, `só ${qtdPoliticas}`);

  // ---------- o teste de isolamento ----------
  // O Supabase expõe as tabelas por HTTP; quem segura o acesso é a
  // política, não a permissão. Já as funções ficam só com as que o
  // aplicativo realmente chama — dar todas aqui esconderia justamente
  // o que este teste precisa provar que está fechado.
  psql(['-q', '-c',
    'grant select,insert,update,delete on all tables in schema public to authenticated, anon;' +
    'grant execute on function public.minha_igreja(), public.meu_papel(), ' +
    'public.meu_membro_id(), public.sou_lideranca(), public.sou_admin(), ' +
    'public.unaccent_simples(text) to authenticated, anon;'], 'ekklesia');

  const saida = psql(['-qtA', '-f', join(RAIZ, 'supabase/teste-de-isolamento.sql')], 'ekklesia');
  const casos = saida.split('\n').filter(l => l.includes('|') && /PASSOU|FALHOU/.test(l));
  ok('o teste de isolamento roda', casos.length >= 10, `só ${casos.length} caso(s)`);
  for (const linha of casos) {
    const [caso, veredito] = linha.split('|');
    ok(caso.trim(), veredito.trim().startsWith('PASSOU'), veredito.trim());
  }
} catch (e) {
  falhas++;
  console.log('  ✗ o teste do banco parou: ' + String(e.message).split('\n')[0]);
} finally {
  try {
    const comoPostgres = process.getuid && process.getuid() === 0 ? 'su postgres -c ' : '';
    const down = `${BIN}/pg_ctl -D ${DADOS} stop -m immediate`;
    execSync(comoPostgres ? `su postgres -c '${down}'` : down, { stdio: 'ignore' });
  } catch {}
}

console.log(falhas ? `\n${falhas} verificação(ões) do banco falharam.\n` : '\nBanco íntegro.\n');
process.exit(falhas ? 1 : 0);
