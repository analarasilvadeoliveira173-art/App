/* ============================================================
   Gera a versão de teste do aplicativo.

   É o mesmo app, com três diferenças que existem para tornar
   impossível confundir um com o outro — e impossível o de teste
   encostar nos dados de verdade:

     1. sem nuvem: guarda tudo no próprio aparelho
     2. outro identificador: instala ao lado do app de verdade
     3. outro nome, outra cor e outro ícone

   Roda com: npm run build:teste
   ============================================================ */
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(RAIZ, 'www-teste');

await rm(SAIDA, { recursive: true, force: true });
await mkdir(SAIDA, { recursive: true });
await cp(join(RAIZ, 'www'), SAIDA, { recursive: true });

let html = await readFile(join(SAIDA, 'index.html'), 'utf8');

// 1. Desliga a nuvem. Sem endereço de servidor, o app nem tenta falar com
//    ele: tudo fica no aparelho. É esta linha que garante que a versão de
//    teste não alcança os dados de nenhuma igreja de verdade.
html = html
  .replace(/const SUPABASE_URL = '[^']*'/, "const SUPABASE_URL = ''")
  .replace(/const SUPABASE_KEY = '[^']*'/, "const SUPABASE_KEY = ''");

// 2. Nome e cor próprios, para não confundir os dois na gaveta de aplicativos.
html = html
  .replace(/nome_app:'[^']*'/, "nome_app:'Ekklesia Teste'")
  .replace(/nome_igreja:'[^']*'/, "nome_igreja:'Igreja de Teste'")
  .replace(/cor_primaria:'[^']*'/, "cor_primaria:'#5B3E8E'")
  .replace(/sigla:'[^']*'/, "sigla:'T'");

// 3. Uma tarja permanente, para nunca haver dúvida de onde se está.
html = html.replace('</style>', `
/* Versão de teste: a tarja não sai da tela de propósito. */
.tarja-teste{position:fixed;left:0;right:0;bottom:0;z-index:200;pointer-events:none;
  background:#5B3E8E;color:#fff;text-align:center;font-size:11px;font-weight:700;
  letter-spacing:.09em;text-transform:uppercase;padding:3px 8px calc(3px + env(safe-area-inset-bottom))}
body{padding-bottom:22px}
</style>`);
html = html.replace('</body>',
  '<div class="tarja-teste">Versão de teste — dados fictícios</div>\n</body>');

await writeFile(join(SAIDA, 'index.html'), html);

// Manifesto próprio, para quem instalar pelo navegador também distinguir.
const manifesto = JSON.parse(await readFile(join(SAIDA, 'manifest.webmanifest'), 'utf8'));
manifesto.name = 'Ekklesia Teste';
manifesto.short_name = 'Ekklesia Teste';
manifesto.description = 'Versão de teste do Ekklesia Music. Os dados ficam só neste aparelho.';
manifesto.theme_color = '#5B3E8E';
manifesto.background_color = '#5B3E8E';
await writeFile(join(SAIDA, 'manifest.webmanifest'), JSON.stringify(manifesto, null, 2));

// Ícone roxo, para diferenciar na tela inicial do celular.
let icone = await readFile(join(SAIDA, 'icone.svg'), 'utf8');
icone = icone.replace('#166F5C', '#7A57B5').replace('#0B3027', '#3E2764');
await writeFile(join(SAIDA, 'icone.svg'), icone);

// Configuração do app nativo: outro identificador permite os dois instalados
// ao mesmo tempo, sem um substituir o outro.
await writeFile(join(RAIZ, 'capacitor.config.teste.json'), JSON.stringify({
  appId: 'com.ekklesia.music.teste',
  appName: 'Ekklesia Teste',
  webDir: 'www-teste',
  android: { allowMixedContent: false },
  server: { androidScheme: 'https' }
}, null, 2) + '\n');

const semNuvem = !/const SUPABASE_URL = '.+'/.test(html);
console.log(semNuvem
  ? '✓ versão de teste gerada em www-teste/ — sem nuvem, dados só no aparelho'
  : '✗ ATENÇÃO: a versão de teste ficou com endereço de servidor. Não use.');
process.exit(semNuvem ? 0 : 1);
