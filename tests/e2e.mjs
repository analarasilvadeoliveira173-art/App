/* ============================================================
   Testes de ponta a ponta no navegador.
   Roda com: npm run test:e2e

   O Supabase é sempre bloqueado: os testes exercitam o caminho
   de queda para os dados do aparelho, que é justamente o que
   precisa continuar funcionando quando a internet falha.
   ============================================================ */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const WWW = join(RAIZ, 'www');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json'
};

let falhas = 0;
const erros = [];

function ok(descricao, condicao, detalhe) {
  if (condicao) console.log(`  ✓ ${descricao}`);
  else { falhas++; console.log(`  ✗ ${descricao}${detalhe ? ' — ' + detalhe : ''}`); }
}

// ---------- servidor estático mínimo ----------
const servidor = createServer(async (req, res) => {
  const caminho = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const arquivo = join(WWW, caminho === '/' ? 'index.html' : caminho);
  if (!arquivo.startsWith(WWW)) { res.writeHead(403).end(); return; }
  try {
    const conteudo = await readFile(arquivo);
    const ext = arquivo.slice(arquivo.lastIndexOf('.'));
    res.writeHead(200, { 'Content-Type': TIPOS[ext] || 'application/octet-stream' }).end(conteudo);
  } catch { res.writeHead(404).end('não encontrado'); }
});
// Porta 0: o sistema escolhe uma livre, então uma execução anterior travada
// não impede a próxima de rodar.
await new Promise(r => servidor.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${servidor.address().port}/index.html`;

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
const pagina = await contexto.newPage();
pagina.on('pageerror', e => erros.push('erro de página: ' + e.message));
pagina.on('console', m => {
  const t = m.text();
  if (m.type() === 'error' && !/Failed to fetch|ERR_|net::/.test(t)) erros.push('console: ' + t);
});
await pagina.route('**/rest/v1/**', r => r.abort());

async function abrirEEntrar(p = pagina) {
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1400);
  const offline = p.getByRole('button', { name: /Usar dados deste aparelho/i });
  if (await offline.count()) { await offline.click(); await p.waitForTimeout(900); }
  if (await p.locator('#app').isVisible()) return;          // sessão restaurada
  await p.locator('#lg-user').fill('admin');
  await p.locator('#lg-pin').fill('1234');
  await p.getByRole('button', { name: /^Entrar$/ }).click();
  await p.waitForTimeout(800);
}

try {
  console.log('\nAbertura com o servidor fora do ar');
  await pagina.goto(BASE, { waitUntil: 'networkidle' });
  await pagina.waitForTimeout(1500);
  ok('mostra a tela de abertura em vez de página em branco', await pagina.locator('#boot').isVisible());
  const msg = await pagina.locator('#bootMsg').textContent();
  ok('explica a falha em português', /servidor/i.test(msg), `mensagem: "${msg}"`);
  ok('oferece "Tentar de novo"', await pagina.getByRole('button', { name: /Tentar de novo/i }).count() > 0);
  ok('oferece continuar com os dados do aparelho',
    await pagina.getByRole('button', { name: /Usar dados deste aparelho/i }).count() > 0);

  console.log('\nQueda para os dados do aparelho');
  await pagina.getByRole('button', { name: /Usar dados deste aparelho/i }).click();
  await pagina.waitForTimeout(1200);
  ok('a tela de abertura sai do caminho', (await pagina.locator('#boot').count()) === 0);
  ok('cai direto na tela de login, sem página de vendas', await pagina.locator('#login').isVisible());
  ok('a página de vendas não existe mais', (await pagina.locator('#salesPage').count()) === 0);

  console.log('\nLogin da liderança');
  await pagina.locator('#lg-user').fill('admin');
  await pagina.locator('#lg-pin').fill('1234');
  await pagina.getByRole('button', { name: /^Entrar$/ }).click();
  await pagina.waitForTimeout(800);
  ok('entra no aplicativo', await pagina.locator('#app').isVisible());
  const tituloPainel = (await pagina.locator('.page-head h2').first().textContent()).trim();
  ok('abre no painel com saudação pelo horário', /^(Bom dia|Boa tarde|Boa noite), /.test(tituloPainel),
    `título: "${tituloPainel}"`);
  ok('mostra o próximo culto em destaque', await pagina.locator('.proximo').isVisible());
  await pagina.waitForTimeout(900);   // a barra cresce com transição
  // Mede a largura real: um <i> sem display:block aceita o atributo e não desenha nada.
  const barra = await pagina.evaluate(() => {
    const el = document.querySelector('.proximo-preenchido');
    if (!el) return null;
    return { pct: Number(el.dataset.pct), largura: el.offsetWidth, trilho: el.parentElement.offsetWidth };
  });
  ok('a barra da equipe é desenhada com a largura certa',
    barra && barra.pct > 0 && barra.largura > 0 &&
    Math.abs(barra.largura / barra.trilho * 100 - barra.pct) < 3,
    barra ? `${barra.pct}% esperado, desenhou ${Math.round(barra.largura / barra.trilho * 100)}%` : 'barra não encontrada');

  console.log('\nSessão persistente');
  await pagina.reload({ waitUntil: 'networkidle' });
  await pagina.waitForTimeout(1600);
  const off2 = pagina.getByRole('button', { name: /Usar dados deste aparelho/i });
  if (await off2.count()) { await off2.click(); await pagina.waitForTimeout(1000); }
  ok('continua logado sem pedir a senha de novo', await pagina.locator('#app').isVisible());

  console.log('\nTema');
  await pagina.locator('.sidebar [data-tema-btn]').click();
  await pagina.waitForTimeout(400);
  ok('alterna para o escuro', await pagina.locator('html').getAttribute('data-theme') === 'dark');
  await pagina.locator('.sidebar [data-tema-btn]').click();
  await pagina.waitForTimeout(400);
  ok('volta para o claro', await pagina.locator('html').getAttribute('data-theme') === 'light');

  console.log('\nNavegação');
  for (const [tela, titulo] of [
    ['escalas', 'Escalas'], ['louvores', 'Louvores'], ['ensaios', 'Ensaios'],
    ['membros', 'Membros'], ['relatorios', 'Relatórios'], ['perfil', 'Meu perfil'],
    ['usuarios', 'Usuários'], ['configuracoes', 'Configurações']
  ]) {
    await pagina.evaluate(t => window.ir(t), tela);
    await pagina.waitForTimeout(300);
    const h = (await pagina.locator('.page-head h2').first().textContent()).trim();
    ok(`${tela} abre "${titulo}"`, h === titulo, `abriu "${h}"`);
  }

  console.log('\nMontagem de escala');
  const cultosAntes = await pagina.evaluate(() => D.cultos.length);
  await pagina.evaluate(() => window.novaEscala());
  await pagina.waitForTimeout(600);
  await pagina.locator('#w-data').fill('2026-12-25');
  await pagina.locator('#w-tipo').fill('Culto de Natal');
  for (let i = 0; i < 5; i++) {
    const avancar = pagina.getByRole('button', { name: /Avançar|Próximo|Continuar/i }).first();
    if (await avancar.count() && await avancar.isVisible()) { await avancar.click(); await pagina.waitForTimeout(450); }
  }
  const salvar = pagina.getByRole('button', { name: /Salvar escala|Concluir|Salvar/i }).first();
  if (await salvar.count() && await salvar.isVisible()) { await salvar.click(); await pagina.waitForTimeout(900); }
  const cultosDepois = await pagina.evaluate(() => D.cultos.length);
  ok('o wizard cria o culto', cultosDepois === cultosAntes + 1, `${cultosAntes} → ${cultosDepois}`);

  console.log('\nSenhas');
  const pinAntes = await pagina.evaluate(() => (D.usuarios.find(u => u.usuario === 'joao') || {}).pin);
  await pagina.evaluate(() => window.ir('usuarios'));
  await pagina.waitForTimeout(400);
  await pagina.evaluate(() => window.modalUsuario(D.usuarios.find(x => x.usuario === 'joao').id));
  await pagina.waitForTimeout(400);
  ok('o campo de PIN não expõe a senha atual', (await pagina.locator('#u-pin').inputValue()) === '');
  await pagina.locator('#u-nome').fill('João Pereira Editado');
  await pagina.locator('#okBtn').click();
  await pagina.waitForTimeout(800);
  const usuarioDepois = await pagina.evaluate(() => D.usuarios.find(u => u.usuario === 'joao'));
  ok('salva a edição', usuarioDepois.nome === 'João Pereira Editado');
  ok('PIN em branco mantém a senha', usuarioDepois.pin === pinAntes, `${pinAntes} → ${usuarioDepois.pin}`);

  await pagina.evaluate(() => window.modalUsuario(D.usuarios.find(x => x.usuario === 'joao').id));
  await pagina.waitForTimeout(400);
  await pagina.locator('#u-pin').fill('12');
  await pagina.locator('#okBtn').click();
  await pagina.waitForTimeout(500);
  ok('recusa PIN com menos de 4 caracteres', (await pagina.locator('#ov').count()) > 0);
  await pagina.evaluate(() => window.closeModal());

  console.log('\nCadastros e segurança de texto');
  await pagina.evaluate(() => window.ir('louvores'));
  await pagina.waitForTimeout(400);
  await pagina.evaluate(() => window.modalLouvor());
  await pagina.waitForTimeout(400);
  await pagina.locator('#f-nome').fill("Ana D'Ávila <script>");
  await pagina.locator('#okBtn').click();
  await pagina.waitForTimeout(800);
  const tabela = await pagina.locator('table.tbl').first().textContent();
  ok('nome com apóstrofo e tag é exibido sem quebrar o HTML', tabela.includes("D'Ávila"));
  ok('nada foi injetado como elemento', (await pagina.locator('table.tbl script').count()) === 0);

  await pagina.evaluate(() => window.ir('painel'));
  await pagina.waitForTimeout(400);
  await pagina.evaluate(() => window.modalAviso());
  await pagina.waitForTimeout(400);
  await pagina.locator('#av-tit').fill('Ensaio extra');
  await pagina.locator('#av-txt').fill('Sábado às 15h.');
  await pagina.locator('#avOk').click();
  await pagina.waitForTimeout(800);
  ok('publica aviso no mural', (await pagina.evaluate(() => D.avisos.length)) === 1);

  console.log('\nExclusões não quebram o histórico');
  const cenario = await pagina.evaluate(async () => {
    const l = await DB.insert('louvores', { nome: 'Louvor de Teste', categoria: 'Adoração' });
    const c = D.cultos[0];
    await DB.insert('culto_louvores', { culto_id: c.id, louvor_id: l.id, ordem: 99 });
    await carregar();
    return { louvorId: l.id, cultoId: c.id };
  });
  await pagina.evaluate(id => window.excluirLouvor(id), cenario.louvorId);
  await pagina.waitForTimeout(300);
  await pagina.locator('#cfBtn').click();
  await pagina.waitForTimeout(800);
  const historico = await pagina.evaluate(id =>
    D.culto_louvores.filter(c => c.nome_livre === 'Louvor de Teste').length, cenario.louvorId);
  ok('excluir louvor preserva o nome nas escalas antigas', historico === 1,
    `esperava 1 registro com nome_livre, achei ${historico}`);

  const membroTeste = await pagina.evaluate(async () => {
    const m = await DB.insert('membros', { nome: 'Para Excluir', status: 'ativo' });
    await DB.insert('indisponibilidades', { membro_id: m.id, data_inicio: '2026-12-01', data_fim: '2026-12-02' });
    await carregar();
    return m.id;
  });
  await pagina.evaluate(() => window.ir('membros'));
  await pagina.waitForTimeout(300);
  await pagina.evaluate(id => window.excluirMembro(id), membroTeste);
  await pagina.waitForTimeout(300);
  await pagina.locator('#cfBtn').click();
  await pagina.waitForTimeout(800);
  const orfas = await pagina.evaluate(id => D.indisponibilidades.filter(i => i.membro_id === id).length, membroTeste);
  ok('excluir membro não deixa indisponibilidades órfãs', orfas === 0, `sobraram ${orfas}`);

  console.log('\nContagem do repertório');
  const contagem = await pagina.evaluate(async () => {
    const l = await DB.insert('louvores', { nome: 'Repetido', vezes_cantado: 0 });
    const c = await DB.insert('cultos', { tipo: 'Teste', data: '2026-01-05', status: 'definida' });
    await DB.insert('culto_louvores', { culto_id: c.id, louvor_id: l.id, ordem: 1 });
    await DB.insert('culto_louvores', { culto_id: c.id, louvor_id: l.id, ordem: 2 });
    await carregar();
    return { louvorId: l.id, cultoId: c.id };
  });
  await pagina.evaluate(id => window.marcarRealizado(id), contagem.cultoId);
  await pagina.waitForTimeout(300);
  await pagina.locator('#cfBtn').click();
  await pagina.waitForTimeout(900);
  const vezes = await pagina.evaluate(id => (D.louvores.find(l => l.id === id) || {}).vezes_cantado, contagem.louvorId);
  ok('louvor cantado duas vezes no culto conta 2', vezes === 2, `contou ${vezes}`);

  console.log('\nPersistência');
  const antes = await pagina.evaluate(() => ({ l: D.louvores.length, a: D.avisos.length, c: D.cultos.length }));
  await pagina.reload({ waitUntil: 'networkidle' });
  await pagina.waitForTimeout(1600);
  const off3 = pagina.getByRole('button', { name: /Usar dados deste aparelho/i });
  if (await off3.count()) { await off3.click(); await pagina.waitForTimeout(1000); }
  const depois = await pagina.evaluate(() => ({ l: D.louvores.length, a: D.avisos.length, c: D.cultos.length }));
  ok('os dados sobrevivem ao recarregamento', JSON.stringify(antes) === JSON.stringify(depois),
    `${JSON.stringify(antes)} → ${JSON.stringify(depois)}`);

  console.log('\nCelular e painel do membro');
  const celular = await contexto.newPage();
  celular.on('pageerror', e => erros.push('erro de página (celular): ' + e.message));
  await celular.route('**/rest/v1/**', r => r.abort());
  await celular.setViewportSize({ width: 390, height: 844 });
  await abrirEEntrar(celular);
  ok('funciona na tela do celular', await celular.locator('#app').isVisible());
  ok('mostra a navegação inferior', await celular.locator('.bottomnav').isVisible());

  await celular.evaluate(() => window.sair());
  await celular.waitForTimeout(300);
  await celular.locator('#cfBtn').click();          // confirma a saída
  await celular.waitForTimeout(700);
  ok('sair leva ao login, não à página de vendas', await celular.locator('#login').isVisible());

  const dadosMembro = await celular.evaluate(() => {
    const m = D.membros.find(x => x.status === 'ativo' && x.pin);
    return { nome: m.nome, pin: m.pin };
  });
  await celular.locator('#lg-user').fill(dadosMembro.nome);
  await celular.locator('#lg-pin').fill(String(dadosMembro.pin));
  await celular.getByRole('button', { name: /^Entrar$/ }).click();
  await celular.waitForTimeout(800);
  ok('o membro entra digitando o próprio nome', await celular.locator('#app').isVisible());
  ok('entra com papel de membro', (await celular.evaluate(() => user && user.papel)) === 'membro');

  console.log('\nPainel do membro');
  const destaque = await celular.locator('.proximo').first();
  if (await destaque.count()) {
    const texto = await destaque.textContent();
    ok('mostra a própria escala em destaque', /SUA PRÓXIMA ESCALA|Sua próxima escala|não está escalado/i.test(texto));
  }

  console.log('\nCelular: nada de arrastar a tela para o lado');
  for (const tela of ['escalas', 'louvores', 'membros', 'painel']) {
    await celular.evaluate(t => window.ir(t), tela);
    await celular.waitForTimeout(450);
    const larguras = await celular.evaluate(() => ({
      conteudo: document.documentElement.scrollWidth,
      janela: document.documentElement.clientWidth
    }));
    ok(`${tela} cabe na largura do celular`, larguras.conteudo <= larguras.janela + 1,
      `conteúdo ${larguras.conteudo}px em janela de ${larguras.janela}px`);
  }

  console.log('\nErros de JavaScript');
  ok('nenhum erro no console', erros.length === 0, erros.join(' | '));
} catch (e) {
  falhas++;
  console.log(`\n✗ o teste parou com uma exceção: ${e.message}`);
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas ? `\n${falhas} verificação(ões) falharam.\n` : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
