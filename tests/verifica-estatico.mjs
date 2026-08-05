/* ============================================================
   Verificações que não precisam de navegador.
   Roda com: npm run test:static
   ============================================================ */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
let falhas = 0;

function ok(descricao, condicao, detalhe) {
  if (condicao) {
    console.log(`  ✓ ${descricao}`);
  } else {
    falhas++;
    console.log(`  ✗ ${descricao}${detalhe ? ' — ' + detalhe : ''}`);
  }
}

console.log('\nArquivos obrigatórios');
const obrigatorios = [
  'www/index.html', 'www/manifest.webmanifest', 'www/sw.js', 'www/icone.svg',
  'package.json', 'capacitor.config.json', 'supabase/schema.sql', 'README.md'
];
for (const arquivo of obrigatorios) {
  ok(arquivo, existsSync(join(RAIZ, arquivo)), 'não encontrado');
}

console.log('\nJSON válido');
for (const arquivo of ['package.json', 'capacitor.config.json', 'www/manifest.webmanifest']) {
  let erro = null;
  try { JSON.parse(readFileSync(join(RAIZ, arquivo), 'utf8')); }
  catch (e) { erro = e.message; }
  ok(arquivo, !erro, erro);
}

const html = readFileSync(join(RAIZ, 'www/index.html'), 'utf8');

console.log('\nJavaScript do aplicativo');
const bloco = html.match(/\/\/APPJS_START([\s\S]*)\/\/APPJS_END/);
ok('marcadores APPJS_START / APPJS_END presentes', !!bloco);
if (bloco) {
  let erro = null;
  try { new Function(bloco[1]); }
  catch (e) { erro = e.message; }
  ok('sem erro de sintaxe', !erro, erro);
}

console.log('\nService worker');
const sw = readFileSync(join(RAIZ, 'www/sw.js'), 'utf8');
let erroSw = null;
try { new Function(sw); } catch (e) { erroSw = e.message; }
ok('sem erro de sintaxe', !erroSw, erroSw);
ok('não guarda dados do Supabase em cache', sw.includes('/rest/v1/'),
  'falta a exceção para /rest/v1/, o cache serviria escalas desatualizadas');

console.log('\nCoerência do projeto');
const cap = JSON.parse(readFileSync(join(RAIZ, 'capacitor.config.json'), 'utf8'));
ok('webDir aponta para www', cap.webDir === 'www', `está "${cap.webDir}"`);
ok('appId definido', !!cap.appId);

const manifesto = JSON.parse(readFileSync(join(RAIZ, 'www/manifest.webmanifest'), 'utf8'));
ok('manifest tem name e start_url', !!manifesto.name && !!manifesto.start_url);
for (const icone of manifesto.icons || []) {
  ok(`ícone ${icone.src} existe`, existsSync(join(RAIZ, 'www', icone.src)));
}

console.log('\nHTML');
ok('idioma declarado como pt-BR', /<html[^>]+lang="pt-BR"/.test(html));
ok('viewport definido', /<meta[^>]+name="viewport"/.test(html));
ok('manifest referenciado', /rel="manifest"/.test(html));
ok('tema aplicado antes da primeira pintura',
  html.indexOf('data-theme') < html.indexOf('<body'),
  'o script de tema precisa vir antes do body para a tela não piscar');

console.log(falhas ? `\n${falhas} verificação(ões) falharam.\n` : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
