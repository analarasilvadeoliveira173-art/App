/* ============================================================
   Painel

   A primeira tela responde a pergunta que traz a pessoa aqui: quando é
   o próximo culto, e eu estou nele? Números do ministério vêm depois —
   eles interessam à liderança, não a quem abriu o app no sábado à noite.
   ============================================================ */
import { esc, saudacao, dataPorExtenso, quandoE, iniciais } from '../nucleo/util.js';
import { IC } from '../ui/icones.js';
import { avisoBom, avisoRuim } from '../ui/aviso.js';
import { pessoa, ehLideranca } from '../sessao/sessao.js';
import {
  D, proximoCulto, escalaDo, presencaDe, nomeMembro, membro,
  membrosAtivos, escrever, recarregar,
} from '../dados/indice.js';

export function telaPainel(raiz, ir) {
  const proximo = proximoCulto();
  const primeiroNome = String(pessoa?.nome ?? '').split(' ')[0];

  raiz.innerHTML = `
    <div class="cabeca-pagina">
      <div>
        <h2>${esc(saudacao())}, ${esc(primeiroNome)}</h2>
        <p>${proximo ? 'Veja como está o próximo encontro do ministério.' : 'Nenhum culto marcado por enquanto.'}</p>
      </div>
      ${ehLideranca() ? `<div class="acoes-cabeca">
        <button class="btn btn-principal" data-nova-escala>+ Nova escala</button>
      </div>` : ''}
    </div>

    ${proximo ? cartaoProximo(proximo) : vazio()}
    ${minhaParte(proximo)}
    ${ehLideranca() ? numeros() : ''}
    ${mural()}`;

  raiz.querySelector('[data-nova-escala]')?.addEventListener('click', () => ir('escalas', { novo: true }));

  raiz.querySelectorAll('[data-responder]').forEach((botao) => {
    botao.addEventListener('click', async () => {
      const { responder, culto } = botao.dataset;
      await responderPresenca(culto, responder);
      telaPainel(raiz, ir);
    });
  });

  /* A barra cresce depois de desenhada, senão a transição não acontece:
     o navegador não anima de "acabei de nascer" para o valor final. */
  requestAnimationFrame(() => {
    raiz.querySelectorAll('[data-preenche]').forEach((el) => {
      el.style.width = el.dataset.preenche + '%';
    });
  });
}

function cartaoProximo(culto) {
  const equipe = escalaDo(culto.id);
  const confirmados = equipe.filter((e) => presencaDe(e.membro_id, culto.id)?.status === 'confirmado').length;
  const pct = equipe.length ? Math.round(confirmados / equipe.length * 100) : 0;
  const repertorio = D.culto_louvores
    .filter((cl) => cl.culto_id === culto.id)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  return `
    <div class="cartao cartao-recheio" style="margin-bottom:var(--e5)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--e4);flex-wrap:wrap">
        <div>
          <span class="selo selo-destaque">${esc(quandoE(culto.data))}</span>
          <h3 style="font-size:var(--t2);margin:var(--e2) 0 2px">${esc(culto.tipo || 'Culto')}</h3>
          <p style="color:var(--texto-fraco);margin:0">
            ${esc(dataPorExtenso(culto.data))}${culto.horario ? ' · ' + esc(culto.horario) : ''}
          </p>
        </div>
        <div style="text-align:right">
          <div class="numeros" style="font-size:var(--t3);font-weight:700;line-height:1">${confirmados}/${equipe.length}</div>
          <div style="font-size:var(--t-2);color:var(--texto-fraco)">confirmados</div>
        </div>
      </div>

      <!-- display:block no preenchimento: um <i> em linha aceita a
           largura e não desenha nada, e a barra fica invisível. -->
      <div style="margin:var(--e4) 0 var(--e3);height:8px;border-radius:var(--r-redondo);background:var(--superficie-2);overflow:hidden">
        <i data-preenche="${pct}" style="display:block;height:100%;width:0;border-radius:var(--r-redondo);
           background:linear-gradient(90deg,var(--primaria),var(--primaria-forte));transition:width .7s cubic-bezier(.2,.8,.3,1)"></i>
      </div>

      ${equipe.length ? `<div style="display:flex;flex-wrap:wrap;gap:var(--e2)">
        ${equipe.map((e) => {
          const status = presencaDe(e.membro_id, culto.id)?.status ?? 'pendente';
          const cor = { confirmado: 'selo-bom', recusado: 'selo-ruim', pendente: 'selo-neutro' }[status];
          const m = membro(e.membro_id);
          return `<span class="selo ${cor}" title="${esc(e.funcao ?? '')}">
            <span class="avatar" style="width:20px;height:20px;font-size:9px;background:${esc(m?.cor_avatar || 'var(--primaria)')}">${esc(iniciais(nomeMembro(e.membro_id)))}</span>
            ${esc(String(nomeMembro(e.membro_id)).split(' ')[0])}</span>`;
        }).join('')}
      </div>` : `<p style="color:var(--texto-fraco);margin:0">Ninguém escalado ainda.</p>`}

      ${repertorio.length ? `
        <div class="titulo-secao">Repertório</div>
        <ol style="margin:0;padding-left:1.2em;color:var(--texto-fraco)">
          ${repertorio.map((cl) => {
            const l = D.louvores.find((x) => x.id === cl.louvor_id);
            return `<li><span style="color:var(--texto)">${esc(l?.nome ?? 'Louvor removido')}</span>${cl.tom ? ` · ${esc(cl.tom)}` : ''}</li>`;
          }).join('')}
        </ol>` : ''}
    </div>`;
}

/* O que a pessoa precisa responder. Só aparece para quem está escalado —
   para a liderança que não toca no domingo, seria ruído. */
function minhaParte(culto) {
  if (!culto || !pessoa?.membro_id) return '';
  const minha = escalaDo(culto.id).filter((e) => e.membro_id === pessoa.membro_id);
  if (!minha.length) return '';

  const status = presencaDe(pessoa.membro_id, culto.id)?.status ?? 'pendente';
  const respondido = status !== 'pendente';

  return `
    <div class="cartao cartao-recheio" style="margin-bottom:var(--e5);border-color:var(--primaria)">
      <div class="titulo-secao" style="margin-top:0">Você neste culto</div>
      <p style="font-size:var(--t1);font-weight:600;margin-bottom:var(--e3)">
        ${minha.map((e) => esc(e.funcao ?? 'Escalado')).join(' · ')}
      </p>
      ${respondido
        ? `<p style="margin:0;color:var(--texto-fraco)">
             Você respondeu: <span class="selo ${status === 'confirmado' ? 'selo-bom' : 'selo-ruim'}">${status === 'confirmado' ? 'Vou estar' : 'Não vou poder'}</span>
             <button class="btn-texto" data-responder="${status === 'confirmado' ? 'recusado' : 'confirmado'}" data-culto="${esc(culto.id)}">mudar</button>
           </p>`
        : `<div style="display:flex;gap:var(--e2);flex-wrap:wrap">
             <button class="btn btn-principal" data-responder="confirmado" data-culto="${esc(culto.id)}">Vou estar</button>
             <button class="btn btn-perigo" data-responder="recusado" data-culto="${esc(culto.id)}">Não vou poder</button>
           </div>`}
    </div>`;
}

function numeros() {
  const itens = [
    ['Integrantes ativos', membrosAtivos().length],
    ['Louvores no repertório', D.louvores.filter((l) => l.status !== 'inativo').length],
    ['Cultos no período', D.cultos.length],
    ['Ensaios marcados', D.ensaios.length],
  ];
  return `
    <div class="titulo-secao">O ministério em números</div>
    <div class="cartao cartao-recheio" style="margin-bottom:var(--e5)">
      ${itens.map(([rotulo, valor]) => `
        <div class="par"><span>${esc(rotulo)}</span><b class="numeros">${valor}</b></div>`).join('')}
    </div>`;
}

function mural() {
  const avisos = [...D.avisos].sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1)).slice(0, 3);
  if (!avisos.length) return '';
  return `
    <div class="titulo-secao">Mural</div>
    <div class="cartao cartao-recheio">
      ${avisos.map((a) => `
        <div style="padding:var(--e2) 0;border-bottom:1px solid var(--linha)">
          <b>${esc(a.titulo)}</b>
          <p style="margin:2px 0 0;color:var(--texto-fraco);font-size:var(--t-1)">${esc(a.texto)}</p>
        </div>`).join('')}
    </div>`;
}

function vazio() {
  return `
    <div class="cartao vazio" style="margin-bottom:var(--e5)">
      ${IC.escalas}
      <h3>Nenhum culto marcado</h3>
      <p>Quando a liderança montar a próxima escala, ela aparece aqui com a equipe e o repertório.</p>
    </div>`;
}

async function responderPresenca(cultoId, status) {
  const existente = presencaDe(pessoa.membro_id, cultoId);
  try {
    if (existente) await escrever.atualizar('presencas', existente.id, { status });
    else await escrever.inserir('presencas', { culto_id: cultoId, membro_id: pessoa.membro_id, status });
    /* Só a tabela que mudou. Recarregar tudo aqui era o que fazia um
       toque em "Vou estar" baixar o ministério inteiro de novo. */
    await recarregar('presencas');
    avisoBom(status === 'confirmado' ? 'Presença confirmada.' : 'Avisamos que você não poderá.');
  } catch (erro) {
    avisoRuim(erro.message === 'SESSAO_EXPIRADA'
      ? 'Sua sessão expirou. Entre de novo.'
      : 'Não consegui salvar sua resposta.');
  }
}
