/* ============================================================
   Avisos passageiros

   A confirmação curta do que acabou de acontecer. Fala o resultado,
   não o processo: "Escala salva", não "Operação concluída".
   ============================================================ */
import { esc } from '../nucleo/util.js';

function pilha() {
  let el = document.getElementById('avisos');
  if (!el) {
    el = document.createElement('div');
    el.id = 'avisos';
    el.className = 'avisos';
    /* polite, não assertive: o leitor de tela termina o que estava
       dizendo antes de anunciar isto. Interromper é pior. */
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

export function aviso(texto, tipo = 'neutro', segundos = 4) {
  const el = document.createElement('div');
  el.className = 'aviso' + (tipo === 'ruim' ? ' aviso-ruim' : tipo === 'bom' ? ' aviso-bom' : '');
  el.innerHTML = esc(texto);
  pilha().appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .2s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 220);
  }, segundos * 1000);
}

export const avisoBom = (t) => aviso(t, 'bom');
export const avisoRuim = (t) => aviso(t, 'ruim', 6);
