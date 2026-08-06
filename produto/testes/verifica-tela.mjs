/* ============================================================
   Testes de navegador

   Roda contra o build de verdade (www/), não contra o código-fonte:
   é o que o celular vai receber. Sem servidor configurado, o
   aplicativo cai no modo demonstração — que é justamente o que a
   igreja interessada vê antes de comprar.

   Roda com: npm run test:tela
   ============================================================ */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const WWW = join(RAIZ, 'www');
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};

let falhas = 0;
const errosDePagina = [];

function ok(descricao, condicao, detalhe) {
  if (condicao) console.log(`  ✓ ${descricao}`);
  else { falhas++; console.log(`  ✗ ${descricao}${detalhe ? ' — ' + detalhe : ''}`); }
}

if (!existsSync(join(WWW, 'index.html'))) {
  console.log('\n  ✗ o build não existe. Rode "npm run build" antes.\n');
  process.exit(1);
}

const servidor = createServer(async (req, res) => {
  const caminho = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const arquivo = join(WWW, caminho === '/' ? 'index.html' : caminho);
  if (!arquivo.startsWith(WWW)) { res.writeHead(403).end(); return; }
  try {
    const conteudo = await readFile(arquivo);
    const ext = arquivo.slice(arquivo.lastIndexOf('.'));
    res.writeHead(200, { 'Content-Type': TIPOS[ext] ?? 'application/octet-stream' }).end(conteudo);
  } catch { res.writeHead(404).end('não encontrado'); }
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${servidor.address().port}/index.html`;

const navegador = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
const pagina = await contexto.newPage();
pagina.on('pageerror', (e) => errosDePagina.push('erro de página: ' + e.message));
pagina.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to fetch|ERR_|net::/.test(m.text())) {
    errosDePagina.push('console: ' + m.text());
  }
});

async function entrar(nome = 'admin', senha = 'ekklesia') {
  await pagina.locator('#ent-nome').fill(nome);
  await pagina.locator('#ent-senha').fill(senha);
  await pagina.getByRole('button', { name: /^Entrar$/ }).click();
  await pagina.waitForTimeout(700);
}

try {
  console.log('\nAbertura');
  await pagina.goto(BASE, { waitUntil: 'networkidle' });
  await pagina.waitForTimeout(900);
  ok('a tela de abertura sai do caminho', (await pagina.locator('#abertura').count()) === 0);
  ok('abre direto na entrada', await pagina.locator('.cartao-entrada').isVisible());
  ok('sem servidor, não pede código de igreja', await pagina.locator('#campo-igreja').isHidden());
  ok('oferece o caminho de quem esqueceu a senha',
    await pagina.getByRole('button', { name: /Esqueci minha senha/i }).isVisible());

  console.log('\nEntrada');
  await pagina.locator('#ent-nome').fill('admin');
  await pagina.locator('#ent-senha').fill('errada');
  await pagina.getByRole('button', { name: /^Entrar$/ }).click();
  await pagina.waitForTimeout(500);
  const recusa = await pagina.locator('.aviso').first().textContent();
  ok('senha errada não entra', await pagina.locator('.cartao-entrada').isVisible());
  // A mesma frase para nome errado e senha errada: separar as duas
  // deixaria descobrir quem é da equipe tentando nomes.
  ok('a recusa não diz se o nome existe', /Nome ou senha/i.test(recusa ?? ''), recusa ?? '');

  await entrar();
  ok('entra com a senha certa', await pagina.locator('.moldura').isVisible());

  console.log('\nPainel');
  const titulo = (await pagina.locator('.cabeca-pagina h2').first().textContent()).trim();
  ok('saúda pelo horário', /^(Bom dia|Boa tarde|Boa noite), /.test(titulo), `título: "${titulo}"`);
  ok('mostra o próximo culto', (await pagina.locator('[data-preenche]').count()) === 1);

  await pagina.waitForTimeout(900);
  const barra = await pagina.evaluate(() => {
    const el = document.querySelector('[data-preenche]');
    if (!el) return null;
    return { pct: Number(el.dataset.preenche), largura: el.offsetWidth, trilho: el.parentElement.offsetWidth };
  });
  // Um <i> em linha aceita a largura e não desenha nada: por isso o
  // teste mede o desenho, e não o atributo.
  ok('a barra da equipe é desenhada com a largura certa',
    barra && barra.pct > 0 && barra.largura > 0
    && Math.abs(barra.largura / barra.trilho * 100 - barra.pct) < 3,
    barra ? `${barra.pct}% pedido, desenhou ${Math.round(barra.largura / barra.trilho * 100)}%` : 'barra não encontrada');

  console.log('\nSessão');
  await pagina.reload({ waitUntil: 'networkidle' });
  await pagina.waitForTimeout(900);
  ok('continua entrado depois de recarregar', await pagina.locator('.moldura').isVisible());

  console.log('\nTema');
  await pagina.locator('.lateral [data-trocar-tema]').click();
  await pagina.waitForTimeout(300);
  const escuro = await pagina.locator('html').getAttribute('data-tema');
  ok('alterna o tema', escuro === 'escuro' || escuro === 'claro', `ficou "${escuro}"`);
  await pagina.locator('.lateral [data-trocar-tema]').click();
  await pagina.waitForTimeout(300);

  console.log('\nNavegação');
  for (const [chave, titulo] of [
    ['escalas', 'Escalas'], ['louvores', 'Louvores'], ['membros', 'Membros'],
    ['relatorios', 'Relatórios'], ['usuarios', 'Usuários'], ['painel', null],
  ]) {
    await pagina.locator(`.lateral [data-tela="${chave}"]`).click();
    await pagina.waitForTimeout(250);
    const marcada = await pagina.locator(`.lateral [data-tela="${chave}"]`).getAttribute('aria-current');
    ok(`${chave} abre e fica marcada no menu`, marcada === 'page');
    if (titulo) {
      const h = (await pagina.locator('.cabeca-pagina h2').first().textContent()).trim();
      ok(`${chave} mostra "${titulo}"`, h === titulo, `mostrou "${h}"`);
    }
  }

  console.log('\nPapéis');
  await pagina.evaluate(() => localStorage.clear());
  await pagina.goto(BASE, { waitUntil: 'networkidle' });
  await pagina.waitForTimeout(900);
  await entrar('Maria Santos');
  ok('um membro entra digitando o próprio nome', await pagina.locator('.moldura').isVisible());
  ok('membro não vê a tela de usuários', (await pagina.locator('.lateral [data-tela="usuarios"]').count()) === 0);
  ok('membro não vê relatórios', (await pagina.locator('.lateral [data-tela="relatorios"]').count()) === 0);
  ok('membro vê a própria parte no culto', await pagina.locator('[data-responder]').first().isVisible());

  const antes = (await pagina.locator('.cartao .numeros').first().textContent()).trim();
  await pagina.locator('[data-responder="confirmado"]').click();
  await pagina.waitForTimeout(500);
  const depois = (await pagina.locator('.cartao .numeros').first().textContent()).trim();
  ok('confirmar presença muda a contagem da equipe', antes !== depois, `${antes} → ${depois}`);
  ok('e a resposta fica registrada na tela',
    /respondeu/i.test(await pagina.locator('.conteudo').textContent()));

  await pagina.reload({ waitUntil: 'networkidle' });
  await pagina.waitForTimeout(900);
  const guardado = (await pagina.locator('.cartao .numeros').first().textContent()).trim();
  ok('a resposta sobrevive a recarregar', guardado === depois, `${depois} → ${guardado}`);

  console.log('\nCelular: nada de arrastar a tela para o lado');
  const celular = await navegador.newContext({ viewport: { width: 380, height: 780 } });
  const tel = await celular.newPage();
  await tel.goto(BASE, { waitUntil: 'networkidle' });
  await tel.waitForTimeout(900);
  await tel.locator('#ent-nome').fill('admin');
  await tel.locator('#ent-senha').fill('ekklesia');
  await tel.getByRole('button', { name: /^Entrar$/ }).click();
  await tel.waitForTimeout(700);
  ok('mostra a navegação de baixo', await tel.locator('.barra-baixo').isVisible());
  const sobra = await tel.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('a página não rola para o lado', sobra <= 1, `sobram ${sobra}px`);

  console.log('\nErros de JavaScript');
  ok('nenhum erro no console', errosDePagina.length === 0, errosDePagina.join(' | '));
} catch (e) {
  falhas++;
  console.log('\n  ✗ o teste parou com uma exceção: ' + e.message);
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas ? `\n${falhas} verificação(ões) falharam.\n` : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
