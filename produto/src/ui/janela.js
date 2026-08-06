/* ============================================================
   Janelas

   Uma de cada vez, e a anterior fecha sozinha. Trocar de tela também
   fecha: uma janela sobrevivente sobre outra tela é confusão pura, e
   já aconteceu.
   ============================================================ */
import { esc } from '../nucleo/util.js';

let aoFechar = null;

export function fecharJanela() {
  const el = document.getElementById('cortina');
  if (!el) return;
  el.remove();
  document.removeEventListener('keydown', naTecla);
  if (aoFechar) { const f = aoFechar; aoFechar = null; f(); }
}

function naTecla(e) {
  if (e.key === 'Escape') { fecharJanela(); return; }
  if (e.key !== 'Tab') return;
  /* Prende o Tab dentro da janela: sem isso o foco escapa para a tela
     de trás, que a pessoa nem está vendo. */
  const janela = document.querySelector('#cortina .janela');
  if (!janela) return;
  const focaveis = [...janela.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((el) => el.offsetParent !== null);
  if (!focaveis.length) return;
  const primeiro = focaveis[0];
  const ultimo = focaveis[focaveis.length - 1];
  if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
}

/**
 * @param {string} titulo
 * @param {string} corpo    HTML já escapado por quem monta
 * @param {string} pe       botões
 * @param {object} opcoes   { aoFechar }
 */
export function janela(titulo, corpo, pe = '', opcoes = {}) {
  fecharJanela();
  aoFechar = opcoes.aoFechar ?? null;

  const cortina = document.createElement('div');
  cortina.className = 'cortina';
  cortina.id = 'cortina';
  cortina.innerHTML = `
    <div class="janela" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <div class="janela-cabeca">
        <h3>${esc(titulo)}</h3>
        <button class="fechar-janela" data-fechar aria-label="Fechar">&times;</button>
      </div>
      <div class="janela-corpo">${corpo}</div>
      ${pe ? `<div class="janela-pe">${pe}</div>` : ''}
    </div>`;

  cortina.addEventListener('click', (e) => { if (e.target === cortina) fecharJanela(); });
  cortina.querySelector('[data-fechar]').addEventListener('click', fecharJanela);
  document.body.appendChild(cortina);
  document.addEventListener('keydown', naTecla);

  const primeiro = cortina.querySelector('.janela-corpo input:not([type=hidden]), .janela-corpo select, .janela-corpo textarea')
    ?? cortina.querySelector('.janela-pe .btn-principal');
  setTimeout(() => primeiro?.focus(), 60);
  return cortina;
}

/* Salvar grava e só então fecha. Nesse intervalo dava tempo de clicar de
   novo e criar o registro duas vezes — em conexão lenta, fácil. */
export function protegerBotao(botao, acao) {
  botao.addEventListener('click', async () => {
    if (botao.disabled) return;
    const texto = botao.textContent;
    botao.disabled = true;
    botao.textContent = 'Salvando…';
    try { await acao(); }
    finally {
      if (document.body.contains(botao)) { botao.disabled = false; botao.textContent = texto; }
    }
  });
}

export function confirmar(pergunta, aoConfirmar, rotulo = 'Confirmar', classe = 'btn-principal') {
  janela('Confirmar', `<p style="margin:0">${esc(pergunta)}</p>`, `
    <button class="btn" data-cancelar>Cancelar</button>
    <button class="btn ${classe}" data-confirmar>${esc(rotulo)}</button>`);
  const cortina = document.getElementById('cortina');
  cortina.querySelector('[data-cancelar]').addEventListener('click', fecharJanela);
  protegerBotao(cortina.querySelector('[data-confirmar]'), async () => {
    await aoConfirmar();
    fecharJanela();
  });
}

/* Leitura dos campos da janela, já sem espaço sobrando nas pontas. */
export const valor = (id) => (document.getElementById(id)?.value ?? '').trim();
export const valorCru = (id) => document.getElementById(id)?.value ?? '';
export const marcado = (id) => Boolean(document.getElementById(id)?.checked);
