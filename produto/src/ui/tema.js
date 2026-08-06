/* ============================================================
   Tema claro e escuro

   A escolha vale só para este aparelho — é preferência de quem segura
   o celular, não configuração da igreja. Por isso não vai para o banco.
   ============================================================ */
const CHAVE = 'ekklesia.tema';

export function temaGuardado() {
  try { return localStorage.getItem(CHAVE) || 'auto'; } catch { return 'auto'; }
}

export function aplicarTema(escolha = temaGuardado()) {
  const raiz = document.documentElement;
  if (escolha === 'auto') raiz.removeAttribute('data-tema');
  else raiz.setAttribute('data-tema', escolha);
  try { localStorage.setItem(CHAVE, escolha); } catch { /* modo anônimo */ }

  /* A barra de status do Android pinta com esta cor. Sem atualizar,
     ela fica clara sobre um app escuro. */
  const escuro = escolha === 'escuro'
    || (escolha === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  let meta = document.querySelector('meta[name=theme-color]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = escuro ? '#0f1614' : '#f7f9f8';
}

export function alternarTema() {
  const agora = document.documentElement.getAttribute('data-tema')
    ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
  aplicarTema(agora === 'escuro' ? 'claro' : 'escuro');
}

/* Cores da igreja: reescrevem só os dois tokens da marca. Todo o resto
   do sistema visual continua de pé. */
export function aplicarCores({ primaria, destaque } = {}) {
  const raiz = document.documentElement.style;
  if (primaria) {
    raiz.setProperty('--primaria', primaria);
    raiz.setProperty('--primaria-forte', escurecer(primaria, .22));
    raiz.setProperty('--primaria-fundo', misturar(primaria, .12));
  }
  if (destaque) raiz.setProperty('--destaque', destaque);
}

function comoRgb(hex) {
  const h = String(hex).replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}
const emHex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const escurecer = (hex, q) => emHex(comoRgb(hex).map((v) => v * (1 - q)));
const misturar = (hex, q) => emHex(comoRgb(hex).map((v) => v * q + 255 * (1 - q)));
