/* ============================================================
   Peças que várias telas repetem
   ============================================================ */
import { esc, iniciais } from '../nucleo/util.js';
import { IC } from './icones.js';

export function vazio(icone, titulo, texto, acao = '') {
  return `<div class="cartao vazio">${icone ?? IC.vazio}
    <h3>${esc(titulo)}</h3>
    <p>${esc(texto)}</p>
    ${acao ? `<div style="margin-top:var(--e4)">${acao}</div>` : ''}
  </div>`;
}

/**
 * Opções de um <select>.
 * @param {Array<{v:string,t:string}|string>} itens
 */
export function opcoes(itens, escolhido = '', vazioTexto = '') {
  const normal = itens.map((i) => (typeof i === 'string' ? { v: i, t: i } : i));
  return (vazioTexto ? `<option value="">${esc(vazioTexto)}</option>` : '')
    + normal.map((i) => `<option value="${esc(i.v)}"${String(i.v) === String(escolhido) ? ' selected' : ''}>${esc(i.t)}</option>`).join('');
}

export function selo(mapa, chave) {
  const [classe, texto] = mapa[chave] ?? ['selo-neutro', chave ?? '—'];
  return `<span class="selo ${classe}">${esc(texto)}</span>`;
}

export const SELO_PRESENCA = {
  confirmado: ['selo-bom', 'Confirmado'],
  recusado: ['selo-ruim', 'Não vai'],
  pendente: ['selo-neutro', 'Aguardando'],
};

export const SELO_CULTO = {
  rascunho: ['selo-neutro', 'Rascunho'],
  definida: ['selo-info', 'Definida'],
  realizada: ['selo-bom', 'Realizada'],
  cancelada: ['selo-ruim', 'Cancelada'],
};

export const SELO_PAPEL = {
  admin: ['selo-destaque', 'Administrador'],
  lider: ['selo-info', 'Líder'],
  membro: ['selo-neutro', 'Membro'],
};

export function avatar(nome, cor, tamanho = '') {
  return `<span class="avatar ${tamanho}" style="background:${esc(cor || 'var(--primaria)')}">${esc(iniciais(nome))}</span>`;
}

/** Uma tabela que rola dentro da própria caixa, nunca arrastando a página. */
export function tabela(colunas, linhas) {
  return `<div class="cartao"><div class="rolagem-tabela"><table class="tabela">
    <thead><tr>${colunas.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${linhas}</tbody>
  </table></div></div>`;
}

export const botaoIcone = (icone, rotulo, atributos = '') =>
  `<button class="btn-icone" title="${esc(rotulo)}" aria-label="${esc(rotulo)}" ${atributos}>${icone}</button>`;
