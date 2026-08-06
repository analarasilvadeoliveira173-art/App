/* ============================================================
   Utilidades — as funções pequenas que todas as telas usam
   ============================================================ */

/* Texto de fora do aplicativo nunca entra no HTML sem passar por aqui.
   Um louvor chamado 'Ana D'Ávila <b>' precisa aparecer como está escrito,
   não virar marcação. */
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function id(prefixo = 'id') {
  return prefixo + '-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

/* Sem acento, sem maiúscula, sem espaço sobrando: é como nomes são
   comparados, para "João" e "joao" serem a mesma pessoa. */
export function chaveNome(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toLowerCase().replace(/\s+/g, ' ');
}

export function iniciais(nome) {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/* ---------------- Datas ----------------
   Datas chegam como '2026-08-06'. Construir com new Date(texto) usa
   fuso UTC e o dia 1 vira dia 31 do mês anterior no Brasil — por isso
   as partes são separadas na mão. */
export function comoData(texto) {
  if (!texto) return null;
  const [a, m, d] = String(texto).slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return null;
  return new Date(a, m - 1, d);
}

export function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function mesesAtras(n, de = hoje()) {
  const d = comoData(de) ?? new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function dataCurta(texto) {
  const d = comoData(texto);
  if (!d) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function dataPorExtenso(texto) {
  const d = comoData(texto);
  if (!d) return '—';
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/* "hoje", "amanhã", "em 3 dias" — a distância importa mais que a data
   quando a pergunta é "quando é o próximo culto?". */
export function quandoE(texto) {
  const d = comoData(texto);
  if (!d) return '';
  const agora = comoData(hoje());
  const dias = Math.round((d - agora) / 86400000);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias === -1) return 'ontem';
  if (dias > 1) return `em ${dias} dias`;
  return `há ${Math.abs(dias)} dias`;
}

export function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/* Espera o dedo parar de digitar antes de buscar. Sem isso, cada letra
   dispara uma consulta. */
export function aguardar(fn, ms = 260) {
  let marca;
  return (...args) => {
    clearTimeout(marca);
    marca = setTimeout(() => fn(...args), ms);
  };
}
