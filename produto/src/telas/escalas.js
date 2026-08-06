/* ============================================================
   Escalas

   O coração do aplicativo. A lista responde "o que vem por aí"; o
   assistente monta um culto em três passos — quando, quem, o que se
   canta — e para em cada um só o tempo de uma decisão.
   ============================================================ */
import { esc, dataCurta, dataPorExtenso, quandoE, hoje } from '../nucleo/util.js';
import { IC } from '../ui/icones.js';
import { janela, fecharJanela, valor, valorCru, protegerBotao, confirmar } from '../ui/janela.js';
import { avisoBom, avisoRuim } from '../ui/aviso.js';
import { vazio, opcoes, avatar, botaoIcone, selo, SELO_PRESENCA, SELO_CULTO } from '../ui/pecas.js';
import { ehLideranca } from '../sessao/sessao.js';
import {
  D, escrever, recarregar, membro, nomeMembro, louvor,
  escalaDo, presencaDe, membrosAtivos, culto as acharCulto,
} from '../dados/indice.js';

export function telaEscalas(raiz, ir, contexto = {}) {
  if (contexto.novo && ehLideranca()) { setTimeout(() => assistente(raiz), 0); }

  const proximos = D.cultos.filter((c) => c.data >= hoje()).sort((a, b) => (a.data < b.data ? -1 : 1));
  const passados = D.cultos.filter((c) => c.data < hoje()).sort((a, b) => (a.data < b.data ? 1 : -1));

  raiz.innerHTML = `
    <div class="cabeca-pagina">
      <div><h2>Escalas</h2><p>Os cultos do período e quem está em cada um.</p></div>
      ${ehLideranca() ? `<div class="acoes-cabeca">
        <button class="btn btn-principal" data-nova>+ Nova escala</button>
      </div>` : ''}
    </div>

    ${proximos.length || passados.length ? `
      ${proximos.length ? `<div class="titulo-secao" style="margin-top:0">O que vem por aí</div>
        <div style="display:grid;gap:var(--e3)">${proximos.map(cartao).join('')}</div>` : ''}
      ${passados.length ? `<div class="titulo-secao">Já aconteceram</div>
        <div style="display:grid;gap:var(--e3)">${passados.map(cartao).join('')}</div>` : ''}`
      : vazio(IC.escalas, 'Nenhum culto no período',
          'Monte a primeira escala: escolha a data, quem toca e o repertório. Leva um minuto.',
          ehLideranca() ? '<button class="btn btn-principal" data-nova>+ Montar a primeira escala</button>' : '')}`;

  raiz.querySelectorAll('[data-nova]').forEach((b) => b.addEventListener('click', () => assistente(raiz)));
  raiz.querySelectorAll('[data-abrir]').forEach((b) =>
    b.addEventListener('click', () => detalhe(b.dataset.abrir, raiz)));
}

function cartao(c) {
  const equipe = escalaDo(c.id);
  const confirmados = equipe.filter((e) => presencaDe(e.membro_id, c.id)?.status === 'confirmado').length;
  const faltando = equipe.filter((e) => presencaDe(e.membro_id, c.id)?.status === 'recusado').length;

  return `
    <button class="cartao cartao-recheio" data-abrir="${esc(c.id)}"
            style="display:block;width:100%;text-align:left;cursor:pointer;border-color:var(--linha);font:inherit;color:inherit">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--e3);flex-wrap:wrap">
        <div>
          <div style="display:flex;align-items:center;gap:var(--e2);flex-wrap:wrap">
            <b style="font-size:var(--t1)">${esc(c.tipo || 'Culto')}</b>
            ${selo(SELO_CULTO, c.status ?? 'rascunho')}
            ${faltando ? `<span class="selo selo-ruim">${faltando} não vai</span>` : ''}
          </div>
          <p style="margin:var(--e1) 0 0;color:var(--texto-fraco);font-size:var(--t-1)">
            ${esc(dataPorExtenso(c.data))}${c.horario ? ' · ' + esc(c.horario) : ''} · ${esc(quandoE(c.data))}
          </p>
        </div>
        <div style="text-align:right">
          <div class="numeros" style="font-weight:700">${confirmados}/${equipe.length}</div>
          <div style="font-size:var(--t-2);color:var(--texto-fraco)">confirmados</div>
        </div>
      </div>
      ${equipe.length ? `<div style="display:flex;gap:4px;margin-top:var(--e3);flex-wrap:wrap">
        ${equipe.slice(0, 8).map((e) => {
          const m = membro(e.membro_id);
          return `<span class="avatar" style="width:26px;height:26px;font-size:10px;background:${esc(m?.cor_avatar || 'var(--primaria)')}"
                   title="${esc(nomeMembro(e.membro_id))} — ${esc(e.funcao || '')}">${esc((nomeMembro(e.membro_id)[0] || '?').toUpperCase())}</span>`;
        }).join('')}
        ${equipe.length > 8 ? `<span class="selo selo-neutro">+${equipe.length - 8}</span>` : ''}
      </div>` : `<p style="margin:var(--e3) 0 0;color:var(--texto-fraco);font-size:var(--t-1)">Ninguém escalado ainda.</p>`}
    </button>`;
}

/* ---------------- Detalhe ---------------- */
function detalhe(id, raiz) {
  const c = acharCulto(id);
  if (!c) return;
  const equipe = escalaDo(id);
  const repertorio = D.culto_louvores.filter((cl) => cl.culto_id === id).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  janela(c.tipo || 'Culto', `
    <div class="par"><span>Data</span><b>${esc(dataCurta(c.data))} · ${esc(quandoE(c.data))}</b></div>
    ${c.horario ? `<div class="par"><span>Horário</span><b>${esc(c.horario)}</b></div>` : ''}
    <div class="par"><span>Situação</span><b>${selo(SELO_CULTO, c.status ?? 'rascunho')}</b></div>
    ${c.observacoes ? `<div class="par"><span>Observações</span><b>${esc(c.observacoes)}</b></div>` : ''}

    <div class="titulo-secao">Equipe</div>
    ${equipe.length ? equipe.map((e) => {
      const m = membro(e.membro_id);
      const status = presencaDe(e.membro_id, id)?.status ?? 'pendente';
      return `<div class="par">
        <span style="display:flex;align-items:center;gap:var(--e2);color:var(--texto)">
          ${avatar(nomeMembro(e.membro_id), m?.cor_avatar)}
          <span>${esc(nomeMembro(e.membro_id))}<br>
            <small style="color:var(--texto-fraco)">${esc(e.funcao || '—')}</small></span>
        </span>
        <b>${selo(SELO_PRESENCA, status)}</b>
      </div>`;
    }).join('') : '<p style="color:var(--texto-fraco)">Ninguém escalado.</p>'}

    <div class="titulo-secao">Repertório</div>
    ${repertorio.length ? `<ol style="margin:0;padding-left:1.3em">
      ${repertorio.map((cl) => {
        const l = louvor(cl.louvor_id);
        return `<li>${esc(l?.nome ?? 'Louvor removido')}${cl.tom ? ` · <span style="color:var(--texto-fraco)">${esc(cl.tom)}</span>` : ''}</li>`;
      }).join('')}
    </ol>` : '<p style="color:var(--texto-fraco)">Nenhum louvor escolhido.</p>'}`,
    `${ehLideranca() ? `<button class="btn btn-perigo" data-excluir>Excluir</button>
      <button class="btn" data-editar>Editar</button>` : ''}
     <button class="btn btn-principal" data-ok>Fechar</button>`);

  document.querySelector('[data-ok]').addEventListener('click', fecharJanela);
  document.querySelector('[data-editar]')?.addEventListener('click', () => { fecharJanela(); assistente(raiz, id); });
  document.querySelector('[data-excluir]')?.addEventListener('click', () => {
    confirmar(`Excluir o culto de ${dataCurta(c.data)}? A equipe e o repertório vão junto.`, async () => {
      try {
        await escrever.removerOnde('escalas', 'culto_id', id);
        await escrever.removerOnde('presencas', 'culto_id', id);
        await escrever.removerOnde('culto_louvores', 'culto_id', id);
        await escrever.remover('cultos', id);
        await recarregar('cultos', 'escalas', 'presencas', 'culto_louvores');
        avisoBom('Culto excluído.');
        telaEscalas(raiz, null);
      } catch { avisoRuim('Não consegui excluir.'); }
    }, 'Excluir', 'btn-perigo');
  });
}

/* ---------------- O assistente ----------------
   Três passos. Cada um cabe numa tela de celular e pede uma decisão só;
   um formulário único com tudo junto assusta e faz desistir no meio. */
function assistente(raiz, editando = null) {
  const c = editando ? acharCulto(editando) : null;
  const estado = {
    passo: 1,
    data: c?.data ?? proximoDomingo(),
    tipo: c?.tipo ?? 'Culto de Celebração',
    horario: c?.horario ?? '19:00',
    observacoes: c?.observacoes ?? '',
    status: c?.status ?? 'definida',
    equipe: editando ? escalaDo(editando).map((e) => ({ membro_id: e.membro_id, funcao: e.funcao })) : [],
    louvores: editando
      ? D.culto_louvores.filter((cl) => cl.culto_id === editando)
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
        .map((cl) => ({ louvor_id: cl.louvor_id, tom: cl.tom }))
      : [],
  };

  desenhar();

  function desenhar() {
    const passos = ['Quando', 'Quem toca', 'O que se canta'];
    janela(editando ? 'Editar escala' : 'Nova escala', `
      <div style="display:flex;gap:var(--e2);margin-bottom:var(--e5)">
        ${passos.map((nome, i) => `
          <div style="flex:1">
            <div style="height:4px;border-radius:var(--r-redondo);background:${i < estado.passo ? 'var(--primaria)' : 'var(--superficie-2)'}"></div>
            <div style="margin-top:6px;font-size:var(--t-2);font-weight:700;color:${i < estado.passo ? 'var(--primaria)' : 'var(--texto-fraco)'}">${esc(nome)}</div>
          </div>`).join('')}
      </div>
      <div id="passo-corpo">${[corpo1, corpo2, corpo3][estado.passo - 1]()}</div>`,
      `${estado.passo > 1 ? '<button class="btn" data-voltar>Voltar</button>' : '<button class="btn" data-cancelar>Cancelar</button>'}
       ${estado.passo < 3
        ? '<button class="btn btn-principal" data-avancar>Avançar</button>'
        : '<button class="btn btn-principal" data-salvar>Salvar escala</button>'}`);

    document.querySelector('[data-cancelar]')?.addEventListener('click', fecharJanela);
    document.querySelector('[data-voltar]')?.addEventListener('click', () => { guardar(); estado.passo--; desenhar(); });
    document.querySelector('[data-avancar]')?.addEventListener('click', () => {
      if (!guardar()) return;
      estado.passo++;
      desenhar();
    });
    document.querySelector('[data-salvar]') && protegerBotao(document.querySelector('[data-salvar]'), salvar);
    ligarPasso();
  }

  /* Passa o que está na tela para o estado antes de trocar de passo —
     senão voltar apaga o que a pessoa acabou de digitar. */
  function guardar() {
    if (estado.passo === 1) {
      estado.data = valorCru('as-data');
      estado.tipo = valor('as-tipo');
      estado.horario = valorCru('as-horario');
      estado.observacoes = valor('as-obs');
      estado.status = valorCru('as-status');
      if (!estado.data) { avisoRuim('Escolha a data do culto.'); return false; }
      if (!estado.tipo) { avisoRuim('Dê um nome ao culto.'); return false; }
    }
    return true;
  }

  function corpo1() {
    return `
      <div class="linha-2">
        <div class="campo"><label for="as-data">Data *</label>
          <input id="as-data" class="entrada" type="date" value="${esc(estado.data)}"></div>
        <div class="campo"><label for="as-horario">Horário</label>
          <input id="as-horario" class="entrada" type="time" value="${esc(estado.horario)}"></div>
      </div>
      <div class="campo"><label for="as-tipo">Nome do culto *</label>
        <input id="as-tipo" class="entrada" value="${esc(estado.tipo)}" list="tipos-culto" autocapitalize="words">
        <datalist id="tipos-culto">
          ${['Culto de Celebração', 'Culto da Família', 'Culto de Oração', 'Santa Ceia', 'Culto Jovem', 'Vigília']
            .map((t) => `<option value="${esc(t)}">`).join('')}
        </datalist></div>
      <div class="campo"><label for="as-status">Situação</label>
        <select id="as-status" class="selecao">${opcoes([
          { v: 'rascunho', t: 'Rascunho — ainda montando' },
          { v: 'definida', t: 'Definida — a equipe já pode ver' },
          { v: 'realizada', t: 'Realizada' },
          { v: 'cancelada', t: 'Cancelada' },
        ], estado.status)}</select></div>
      <div class="campo"><label for="as-obs">Observações</label>
        <textarea id="as-obs" class="entrada" placeholder="Tema, avisos, o que a equipe precisa saber">${esc(estado.observacoes)}</textarea></div>`;
  }

  function corpo2() {
    const funcoes = [...D.funcoes].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    return `
      <p style="margin-top:0;color:var(--texto-fraco)">Escolha quem cobre cada posição. A lista mostra primeiro quem toca aquilo.</p>
      ${funcoes.map((f) => {
        const escolhido = estado.equipe.find((e) => e.funcao === f.nome);
        const sabem = membrosAtivos().filter((m) => podeTocar(m.id, f.id));
        const outros = membrosAtivos().filter((m) => !podeTocar(m.id, f.id));
        return `<div class="campo">
          <label for="as-f-${esc(f.id)}">${esc(f.nome)}</label>
          <select id="as-f-${esc(f.id)}" class="selecao" data-funcao="${esc(f.nome)}">
            <option value="">— ninguém —</option>
            ${sabem.length ? `<optgroup label="Toca ${esc(f.nome)}">
              ${opcoes(sabem.map((m) => ({ v: m.id, t: m.nome })), escolhido?.membro_id ?? '')}</optgroup>` : ''}
            ${outros.length ? `<optgroup label="Outros">
              ${opcoes(outros.map((m) => ({ v: m.id, t: m.nome })), escolhido?.membro_id ?? '')}</optgroup>` : ''}
          </select>
          ${indisponiveisNaData(f.id)}
        </div>`;
      }).join('')}`;
  }

  function corpo3() {
    const disponiveis = D.louvores.filter((l) => l.status !== 'inativo')
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return `
      <p style="margin-top:0;color:var(--texto-fraco)">Na ordem em que serão cantados. Toque para tirar.</p>
      <div id="as-lista" style="margin-bottom:var(--e4)">
        ${estado.louvores.length ? estado.louvores.map((item, i) => {
          const l = louvor(item.louvor_id);
          return `<div class="par">
            <span style="color:var(--texto)"><b class="numeros">${i + 1}.</b> ${esc(l?.nome ?? '—')}
              ${item.tom ? `<span class="selo selo-neutro">${esc(item.tom)}</span>` : ''}</span>
            <b>${botaoIcone(IC.excluir, 'Tirar do repertório', `class="btn-icone perigo" data-tirar="${i}"`)}</b>
          </div>`;
        }).join('') : '<p style="color:var(--texto-fraco)">Nenhum louvor escolhido ainda.</p>'}
      </div>
      <div class="campo"><label for="as-add">Adicionar louvor</label>
        <div style="display:flex;gap:var(--e2)">
          <select id="as-add" class="selecao">${opcoes(
            disponiveis.map((l) => ({ v: l.id, t: l.nome + (l.artista ? ` — ${l.artista}` : '') })), '', 'Escolha um louvor')}</select>
          <button class="btn" data-add type="button">Incluir</button>
        </div>
        ${disponiveis.length ? '' : '<div class="dica">O repertório está vazio. Cadastre louvores na tela de Louvores.</div>'}
      </div>`;
  }

  function ligarPasso() {
    if (estado.passo === 2) {
      document.querySelectorAll('[data-funcao]').forEach((sel) => {
        sel.addEventListener('change', () => {
          const funcao = sel.dataset.funcao;
          estado.equipe = estado.equipe.filter((e) => e.funcao !== funcao);
          if (sel.value) estado.equipe.push({ membro_id: sel.value, funcao });
        });
      });
    }
    if (estado.passo === 3) {
      document.querySelector('[data-add]')?.addEventListener('click', () => {
        const escolhido = valorCru('as-add');
        if (!escolhido) return;
        estado.louvores.push({ louvor_id: escolhido, tom: louvor(escolhido)?.tom ?? null });
        desenhar();
      });
      document.querySelectorAll('[data-tirar]').forEach((b) => {
        b.addEventListener('click', () => {
          estado.louvores.splice(Number(b.dataset.tirar), 1);
          desenhar();
        });
      });
    }
  }

  async function salvar() {
    try {
      const dados = {
        data: estado.data, tipo: estado.tipo, horario: estado.horario,
        observacoes: estado.observacoes || null, status: estado.status,
      };
      let alvo = editando;
      if (editando) await escrever.atualizar('cultos', editando, dados);
      else alvo = (await escrever.inserir('cultos', dados)).id;

      await escrever.removerOnde('escalas', 'culto_id', alvo);
      await escrever.removerOnde('culto_louvores', 'culto_id', alvo);
      for (const e of estado.equipe) {
        await escrever.inserir('escalas', { culto_id: alvo, membro_id: e.membro_id, funcao: e.funcao });
      }
      for (const [i, item] of estado.louvores.entries()) {
        await escrever.inserir('culto_louvores', { culto_id: alvo, louvor_id: item.louvor_id, ordem: i + 1, tom: item.tom });
      }

      /* Quem entrou na escala precisa de uma linha de presença para
         poder responder. Quem saiu, some — pergunta de culto que não é
         mais dele. */
      const jaTem = D.presencas.filter((p) => p.culto_id === alvo);
      const escalados = new Set(estado.equipe.map((e) => e.membro_id));
      for (const p of jaTem) if (!escalados.has(p.membro_id)) await escrever.remover('presencas', p.id);
      for (const membroId of escalados) {
        if (!jaTem.some((p) => p.membro_id === membroId)) {
          await escrever.inserir('presencas', { culto_id: alvo, membro_id: membroId, status: 'pendente' });
        }
      }

      await recarregar('cultos', 'escalas', 'culto_louvores', 'presencas');
      fecharJanela();
      avisoBom(editando ? 'Escala salva.' : 'Escala criada.');
      telaEscalas(raiz, null);
    } catch (erro) {
      avisoRuim(erro.message === 'SESSAO_EXPIRADA' ? 'Sua sessão expirou. Entre de novo.' : 'Não consegui salvar a escala.');
    }
  }

  function indisponiveisNaData(funcaoId) {
    const fora = membrosAtivos()
      .filter((m) => podeTocar(m.id, funcaoId))
      .filter((m) => D.indisponibilidades.some((i) =>
        i.membro_id === m.id && (i.de ?? '') <= estado.data && (i.ate ?? '') >= estado.data));
    if (!fora.length) return '';
    return `<div class="dica">Avisaram que não podem nesse dia: ${esc(fora.map((m) => m.nome.split(' ')[0]).join(', '))}.</div>`;
  }
}

const podeTocar = (membroId, funcaoId) =>
  D.membros_funcoes.some((mf) => mf.membro_id === membroId && mf.funcao_id === funcaoId);

function proximoDomingo() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
