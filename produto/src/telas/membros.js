/* ============================================================
   Membros

   Quem é da equipe e o que cada um toca. As funções marcadas aqui são
   o que o assistente de escala usa para sugerir gente — por isso a
   tela insiste nelas em vez de deixar como detalhe opcional.
   ============================================================ */
import { esc, dataCurta } from '../nucleo/util.js';
import { IC } from '../ui/icones.js';
import { janela, fecharJanela, valor, valorCru, protegerBotao, confirmar } from '../ui/janela.js';
import { avisoBom, avisoRuim } from '../ui/aviso.js';
import { vazio, opcoes, tabela, avatar, botaoIcone, selo } from '../ui/pecas.js';
import { ehLideranca, ehAdmin } from '../sessao/sessao.js';
import { D, escrever, recarregar, membro, nomeMembro } from '../dados/indice.js';

const CORES = ['#0e6b5c', '#c9a227', '#1d4ed8', '#b3261e', '#6b21a8', '#0f7a3d', '#9a6300', '#0891b2'];

export function telaMembros(raiz) {
  const ordenados = [...D.membros].sort((a, b) => {
    if ((a.status === 'ativo') !== (b.status === 'ativo')) return a.status === 'ativo' ? -1 : 1;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });

  raiz.innerHTML = `
    <div class="cabeca-pagina">
      <div><h2>Membros</h2><p>Quem faz parte do ministério e o que cada um toca.</p></div>
      ${ehLideranca() ? `<div class="acoes-cabeca">
        <button class="btn" data-funcoes>Funções</button>
        <button class="btn btn-principal" data-novo>+ Novo membro</button>
      </div>` : ''}
    </div>

    ${ordenados.length ? tabela(
      ['Nome', 'Função principal', 'Também toca', 'Status', ''],
      ordenados.map((m) => `
        <tr>
          <td><div style="display:flex;align-items:center;gap:var(--e3)">
            ${avatar(m.nome, m.cor_avatar)}
            <div><b>${esc(m.nome)}</b>
              ${m.telefone ? `<div style="font-size:var(--t-2);color:var(--texto-fraco)">${esc(m.telefone)}</div>` : ''}
            </div></div></td>
          <td>${esc(m.funcao_principal || '—')}</td>
          <td style="color:var(--texto-fraco);font-size:var(--t-1)">${esc(outrasFuncoes(m.id).join(', ') || '—')}</td>
          <td>${selo({ ativo: ['selo-bom', 'Ativo'], inativo: ['selo-neutro', 'Inativo'] }, m.status)}</td>
          <td><div class="celula-acoes">
            ${botaoIcone(IC.relatorios, 'Histórico', `data-historico="${esc(m.id)}"`)}
            ${ehLideranca() ? botaoIcone(IC.editar, 'Editar', `data-editar="${esc(m.id)}"`) : ''}
            ${ehLideranca() ? botaoIcone(IC.excluir, 'Excluir', `class="btn-icone perigo" data-excluir="${esc(m.id)}"`) : ''}
          </div></td>
        </tr>`).join('')
    ) : vazio(IC.membros, 'Ninguém cadastrado ainda',
      'Comece pelas pessoas do ministério. Depois marque o que cada uma toca — é disso que a montagem de escala se alimenta.',
      ehLideranca() ? '<button class="btn btn-principal" data-novo>+ Cadastrar a primeira pessoa</button>' : '')}`;

  raiz.querySelectorAll('[data-novo]').forEach((b) => b.addEventListener('click', () => janelaMembro()));
  raiz.querySelector('[data-funcoes]')?.addEventListener('click', janelaFuncoes);
  raiz.querySelectorAll('[data-editar]').forEach((b) =>
    b.addEventListener('click', () => janelaMembro(b.dataset.editar)));
  raiz.querySelectorAll('[data-excluir]').forEach((b) =>
    b.addEventListener('click', () => excluirMembro(b.dataset.excluir, raiz)));
  raiz.querySelectorAll('[data-historico]').forEach((b) =>
    b.addEventListener('click', () => janelaHistorico(b.dataset.historico)));

  telaMembros.redesenhar = () => telaMembros(raiz);
}

const funcoesDe = (membroId) =>
  D.membros_funcoes.filter((mf) => mf.membro_id === membroId)
    .map((mf) => D.funcoes.find((f) => f.id === mf.funcao_id)?.nome)
    .filter(Boolean);

const outrasFuncoes = (membroId) => {
  const m = membro(membroId);
  return funcoesDe(membroId).filter((n) => n !== m?.funcao_principal);
};

/* ---------------- Cadastro ---------------- */
function janelaMembro(id) {
  const m = id ? membro(id) ?? {} : {};
  const marcadas = new Set(D.membros_funcoes.filter((mf) => mf.membro_id === id).map((mf) => mf.funcao_id));
  const funcoes = [...D.funcoes].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const cor = m.cor_avatar || CORES[0];

  janela(id ? 'Editar membro' : 'Novo membro', `
    <div class="campo"><label for="mb-nome">Nome *</label>
      <input id="mb-nome" class="entrada" value="${esc(m.nome || '')}" autocapitalize="words"></div>

    <div class="linha-2">
      <div class="campo"><label for="mb-tel">Telefone (WhatsApp)</label>
        <input id="mb-tel" class="entrada" value="${esc(m.telefone || '')}" placeholder="73 99999-0000" inputmode="tel"></div>
      <div class="campo"><label for="mb-princ">Função principal</label>
        <select id="mb-princ" class="selecao">${opcoes(funcoes.map((f) => f.nome), m.funcao_principal || '', 'Selecione')}</select></div>
    </div>

    <div class="campo"><label>Também pode tocar</label>
      <div id="mb-funcoes" style="display:flex;flex-wrap:wrap;gap:var(--e2)">
        ${funcoes.map((f) => `
          <label class="selo ${marcadas.has(f.id) ? 'selo-info' : 'selo-neutro'}" style="cursor:pointer;padding:6px 12px">
            <input type="checkbox" value="${esc(f.id)}" ${marcadas.has(f.id) ? 'checked' : ''}
                   style="margin-right:5px" data-marca>${esc(f.nome)}</label>`).join('')}
      </div>
      <div class="dica">É daqui que a montagem de escala tira quem pode cobrir cada posição.</div></div>

    <div class="linha-2">
      <div class="campo"><label for="mb-entrada">Entrou em</label>
        <input id="mb-entrada" class="entrada" type="date" value="${esc(m.data_entrada || '')}"></div>
      <div class="campo"><label for="mb-status">Status</label>
        <select id="mb-status" class="selecao">${opcoes([{ v: 'ativo', t: 'Ativo' }, { v: 'inativo', t: 'Inativo' }], m.status || 'ativo')}</select></div>
    </div>

    <div class="campo"><label>Cor</label>
      <div style="display:flex;gap:var(--e2);flex-wrap:wrap">
        ${CORES.map((c) => `
          <label style="cursor:pointer">
            <input type="radio" name="mb-cor" value="${c}" ${cor === c ? 'checked' : ''} class="so-leitor" data-cor>
            <span style="display:block;width:30px;height:30px;border-radius:var(--r-redondo);background:${c};
                  outline:${cor === c ? '3px solid var(--texto)' : 'none'};outline-offset:2px"></span>
          </label>`).join('')}
      </div></div>

    ${ehAdmin() && id ? `<div class="dica" style="margin-top:var(--e4)">
      O login desta pessoa é criado à parte, na tela de <b>Usuários</b>.</div>` : ''}`,
    `<button class="btn" data-cancelar>Cancelar</button>
     <button class="btn btn-principal" data-salvar>${id ? 'Salvar' : 'Adicionar'}</button>`);

  /* O selo acompanha a caixinha: sem isso a marcação só aparece no
     quadradinho, que no celular quase não se vê. */
  document.querySelectorAll('[data-marca]').forEach((caixa) => {
    caixa.addEventListener('change', () => {
      caixa.closest('label').className = 'selo ' + (caixa.checked ? 'selo-info' : 'selo-neutro');
    });
  });
  document.querySelectorAll('[data-cor]').forEach((radio) => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('[data-cor]').forEach((r) => {
        r.nextElementSibling.style.outline = r.checked ? '3px solid var(--texto)' : 'none';
      });
    });
  });

  document.querySelector('[data-cancelar]').addEventListener('click', fecharJanela);
  protegerBotao(document.querySelector('[data-salvar]'), async () => {
    const nome = valor('mb-nome');
    if (!nome) { avisoRuim('Informe o nome.'); return; }

    const dados = {
      nome,
      telefone: valor('mb-tel') || null,
      funcao_principal: valorCru('mb-princ') || null,
      data_entrada: valorCru('mb-entrada') || null,
      status: valorCru('mb-status'),
      cor_avatar: document.querySelector('[data-cor]:checked')?.value ?? CORES[0],
    };
    const escolhidas = [...document.querySelectorAll('[data-marca]:checked')].map((c) => c.value);

    try {
      let alvo = id;
      if (id) await escrever.atualizar('membros', id, dados);
      else alvo = (await escrever.inserir('membros', dados)).id;

      await escrever.removerOnde('membros_funcoes', 'membro_id', alvo);
      for (const funcao_id of escolhidas) {
        await escrever.inserir('membros_funcoes', { membro_id: alvo, funcao_id });
      }
      await recarregar('membros', 'membros_funcoes');
      fecharJanela();
      avisoBom(id ? 'Membro salvo.' : 'Membro adicionado.');
      telaMembros.redesenhar?.();
    } catch (erro) {
      avisoRuim(erro.message === 'SESSAO_EXPIRADA' ? 'Sua sessão expirou. Entre de novo.' : 'Não consegui salvar.');
    }
  });
}

function excluirMembro(id, raiz) {
  const m = membro(id);
  if (!m) return;
  const escalado = D.escalas.filter((e) => e.membro_id === id).length;
  const aviso = escalado
    ? ` Ele aparece em ${escalado} escala${escalado > 1 ? 's' : ''} — o nome fica no histórico, mas a participação é desvinculada.`
    : '';

  confirmar(`Excluir ${m.nome}?${aviso}`, async () => {
    try {
      await escrever.removerOnde('membros_funcoes', 'membro_id', id);
      await escrever.removerOnde('indisponibilidades', 'membro_id', id);
      await escrever.remover('membros', id);
      await recarregar('membros', 'membros_funcoes', 'indisponibilidades');
      avisoBom('Membro excluído.');
      telaMembros(raiz);
    } catch { avisoRuim('Não consegui excluir.'); }
  }, 'Excluir', 'btn-perigo');
}

/* ---------------- Histórico ---------------- */
function janelaHistorico(id) {
  const linhas = D.escalas
    .filter((e) => e.membro_id === id)
    .map((e) => ({ e, c: D.cultos.find((c) => c.id === e.culto_id) }))
    .filter((x) => x.c)
    .sort((a, b) => (a.c.data < b.c.data ? 1 : -1));

  janela(`Histórico — ${nomeMembro(id)}`,
    linhas.length ? linhas.map(({ e, c }) => {
      const p = D.presencas.find((x) => x.membro_id === id && x.culto_id === c.id);
      const cor = { confirmado: 'selo-bom', recusado: 'selo-ruim' }[p?.status] ?? 'selo-neutro';
      const texto = { confirmado: 'Esteve', recusado: 'Não foi' }[p?.status] ?? 'Sem resposta';
      return `<div class="par">
        <span><b style="color:var(--texto)">${esc(dataCurta(c.data))}</b><br>
          ${esc(c.tipo || 'Culto')} · ${esc(e.funcao || '—')}</span>
        <b><span class="selo ${cor}">${texto}</span></b>
      </div>`;
    }).join('')
    : `<p style="color:var(--texto-fraco);margin:0">Sem participações no período carregado.</p>`,
    `<button class="btn btn-principal" data-ok>Fechar</button>`);
  document.querySelector('[data-ok]').addEventListener('click', fecharJanela);
}

/* ---------------- Funções do ministério ---------------- */
function janelaFuncoes() {
  const lista = [...D.funcoes].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  janela('Funções do ministério', `
    <p style="margin-top:0;color:var(--texto-fraco)">São as posições que a escala precisa cobrir: vocal, teclado, som…</p>
    <div id="lista-funcoes">
      ${lista.map((f) => `
        <div class="par" data-funcao="${esc(f.id)}">
          <span style="color:var(--texto)">${esc(f.nome)}</span>
          <b>${lista.length > 1 ? `<button class="btn-icone perigo" data-apagar="${esc(f.id)}" aria-label="Remover ${esc(f.nome)}">${IC.excluir}</button>` : ''}</b>
        </div>`).join('')}
    </div>
    <div class="campo" style="margin-top:var(--e4)">
      <label for="fn-nova">Adicionar função</label>
      <div style="display:flex;gap:var(--e2)">
        <input id="fn-nova" class="entrada" placeholder="Ex.: Guitarra">
        <button class="btn" data-add>Adicionar</button>
      </div>
    </div>`,
    `<button class="btn btn-principal" data-ok>Pronto</button>`);

  const recarregarJanela = async () => { await recarregar('funcoes', 'membros_funcoes'); fecharJanela(); janelaFuncoes(); };

  document.querySelector('[data-ok]').addEventListener('click', () => { fecharJanela(); telaMembros.redesenhar?.(); });
  document.querySelector('[data-add]').addEventListener('click', async () => {
    const nome = valor('fn-nova');
    if (!nome) { avisoRuim('Escreva o nome da função.'); return; }
    if (D.funcoes.some((f) => f.nome.toLowerCase() === nome.toLowerCase())) { avisoRuim('Essa função já existe.'); return; }
    try {
      await escrever.inserir('funcoes', { nome, ordem: D.funcoes.length + 1 });
      await recarregarJanela();
    } catch { avisoRuim('Não consegui adicionar.'); }
  });
  document.querySelectorAll('[data-apagar]').forEach((b) => {
    b.addEventListener('click', async () => {
      const usada = D.membros_funcoes.filter((mf) => mf.funcao_id === b.dataset.apagar).length;
      if (usada && !window.confirm(`${usada} pessoa(s) têm essa função marcada. Remover mesmo assim?`)) return;
      try {
        await escrever.removerOnde('membros_funcoes', 'funcao_id', b.dataset.apagar);
        await escrever.remover('funcoes', b.dataset.apagar);
        await recarregarJanela();
      } catch { avisoRuim('Não consegui remover.'); }
    });
  });
}
