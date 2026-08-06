/* ============================================================
   Louvores

   O repertório da igreja. A coluna que importa não é o cadastro — é
   quantas vezes cada louvor foi cantado e quando foi a última: é o que
   evita repetir o mesmo louvor três domingos seguidos sem perceber.
   ============================================================ */
import { esc, dataCurta, aguardar, chaveNome } from '../nucleo/util.js';
import { IC } from '../ui/icones.js';
import { janela, fecharJanela, valor, valorCru, protegerBotao, confirmar } from '../ui/janela.js';
import { avisoBom, avisoRuim } from '../ui/aviso.js';
import { vazio, opcoes, tabela, botaoIcone, selo } from '../ui/pecas.js';
import { ehLideranca } from '../sessao/sessao.js';
import { D, escrever, recarregar, louvor } from '../dados/indice.js';

const TONS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let busca = '';

export function telaLouvores(raiz) {
  const chave = chaveNome(busca);
  const lista = D.louvores
    .filter((l) => !chave || chaveNome(l.nome).includes(chave) || chaveNome(l.artista).includes(chave))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  raiz.innerHTML = `
    <div class="cabeca-pagina">
      <div><h2>Louvores</h2><p>O repertório do ministério e quando cada um foi cantado.</p></div>
      ${ehLideranca() ? `<div class="acoes-cabeca">
        <button class="btn btn-principal" data-novo>+ Novo louvor</button>
      </div>` : ''}
    </div>

    <div class="campo">
      <label for="lv-busca" class="so-leitor">Buscar louvor</label>
      <input id="lv-busca" class="entrada" placeholder="Buscar por nome ou artista" value="${esc(busca)}"
             type="search" autocomplete="off">
    </div>

    ${lista.length ? tabela(
      ['Louvor', 'Tom', 'Vezes', 'Última vez', 'Status', ''],
      lista.map((l) => {
        const uso = vezesCantado(l.id);
        return `<tr>
          <td><b>${esc(l.nome)}</b>
            ${l.artista ? `<div style="font-size:var(--t-2);color:var(--texto-fraco)">${esc(l.artista)}</div>` : ''}</td>
          <td>${l.tom ? `<span class="selo selo-neutro">${esc(l.tom)}</span>` : '—'}</td>
          <td class="numeros">${uso.vezes}</td>
          <td style="color:var(--texto-fraco)">${uso.ultima ? esc(dataCurta(uso.ultima)) : 'nunca'}</td>
          <td>${selo({ ativo: ['selo-bom', 'No repertório'], inativo: ['selo-neutro', 'Guardado'] }, l.status ?? 'ativo')}</td>
          <td><div class="celula-acoes">
            ${ehLideranca() ? botaoIcone(IC.editar, 'Editar', `data-editar="${esc(l.id)}"`) : ''}
            ${ehLideranca() ? botaoIcone(IC.excluir, 'Excluir', `class="btn-icone perigo" data-excluir="${esc(l.id)}"`) : ''}
          </div></td>
        </tr>`;
      }).join('')
    ) : vazio(IC.louvores,
      busca ? 'Nenhum louvor com esse nome' : 'Repertório vazio',
      busca ? 'Tente outro trecho do nome ou do artista.'
        : 'Cadastre os louvores que a equipe já toca. Depois eles aparecem para escolher ao montar o culto.',
      ehLideranca() && !busca ? '<button class="btn btn-principal" data-novo>+ Cadastrar o primeiro</button>' : '')}`;

  const campo = raiz.querySelector('#lv-busca');
  campo.addEventListener('input', aguardar((e) => {
    busca = e.target.value;
    telaLouvores(raiz);
    const novo = raiz.querySelector('#lv-busca');
    novo.focus();
    novo.setSelectionRange(novo.value.length, novo.value.length);
  }));

  raiz.querySelectorAll('[data-novo]').forEach((b) => b.addEventListener('click', () => janelaLouvor(null, raiz)));
  raiz.querySelectorAll('[data-editar]').forEach((b) =>
    b.addEventListener('click', () => janelaLouvor(b.dataset.editar, raiz)));
  raiz.querySelectorAll('[data-excluir]').forEach((b) =>
    b.addEventListener('click', () => excluirLouvor(b.dataset.excluir, raiz)));
}

/* Um louvor cantado duas vezes no mesmo culto conta duas — é o que a
   liderança quer saber ao perguntar "cantamos muito esse?". */
function vezesCantado(louvorId) {
  const usos = D.culto_louvores.filter((cl) => cl.louvor_id === louvorId);
  const datas = usos
    .map((cl) => D.cultos.find((c) => c.id === cl.culto_id)?.data)
    .filter(Boolean)
    .sort();
  return { vezes: usos.length, ultima: datas[datas.length - 1] ?? null };
}

function janelaLouvor(id, raiz) {
  const l = id ? louvor(id) ?? {} : {};
  janela(id ? 'Editar louvor' : 'Novo louvor', `
    <div class="campo"><label for="lv-nome">Nome *</label>
      <input id="lv-nome" class="entrada" value="${esc(l.nome || '')}" autocapitalize="words"></div>
    <div class="campo"><label for="lv-artista">Artista</label>
      <input id="lv-artista" class="entrada" value="${esc(l.artista || '')}" autocapitalize="words"></div>
    <div class="linha-2">
      <div class="campo"><label for="lv-tom">Tom</label>
        <select id="lv-tom" class="selecao">${opcoes(TONS, l.tom || '', 'Sem tom definido')}</select></div>
      <div class="campo"><label for="lv-ritmo">Ritmo</label>
        <select id="lv-ritmo" class="selecao">${opcoes(['Balada', 'Lenta', 'Agitada', 'Congregacional'], l.ritmo || '', 'Sem ritmo')}</select></div>
    </div>
    <div class="campo"><label for="lv-link">Link (YouTube, cifra…)</label>
      <input id="lv-link" class="entrada" value="${esc(l.link || '')}" inputmode="url" placeholder="https://"></div>
    <div class="campo"><label for="lv-status">Status</label>
      <select id="lv-status" class="selecao">${opcoes(
        [{ v: 'ativo', t: 'No repertório' }, { v: 'inativo', t: 'Guardado (não aparece ao montar culto)' }],
        l.status || 'ativo')}</select></div>`,
    `<button class="btn" data-cancelar>Cancelar</button>
     <button class="btn btn-principal" data-salvar>${id ? 'Salvar' : 'Adicionar'}</button>`);

  document.querySelector('[data-cancelar]').addEventListener('click', fecharJanela);
  protegerBotao(document.querySelector('[data-salvar]'), async () => {
    const nome = valor('lv-nome');
    if (!nome) { avisoRuim('Informe o nome do louvor.'); return; }
    const dados = {
      nome,
      artista: valor('lv-artista') || null,
      tom: valorCru('lv-tom') || null,
      ritmo: valorCru('lv-ritmo') || null,
      link: valor('lv-link') || null,
      status: valorCru('lv-status'),
    };
    try {
      if (id) await escrever.atualizar('louvores', id, dados);
      else await escrever.inserir('louvores', dados);
      await recarregar('louvores');
      fecharJanela();
      avisoBom(id ? 'Louvor salvo.' : 'Louvor adicionado.');
      telaLouvores(raiz);
    } catch (erro) {
      avisoRuim(erro.message === 'SESSAO_EXPIRADA' ? 'Sua sessão expirou. Entre de novo.' : 'Não consegui salvar.');
    }
  });
}

function excluirLouvor(id, raiz) {
  const l = louvor(id);
  if (!l) return;
  const usos = D.culto_louvores.filter((cl) => cl.louvor_id === id).length;
  /* Excluir some do histórico junto. Guardar preserva o que já foi
     cantado e tira o louvor da lista de escolha — quase sempre é o que
     a pessoa realmente quer. */
  const aviso = usos
    ? ` Ele já foi cantado ${usos} vez${usos > 1 ? 'es' : ''}, e sairá desses cultos. Se a ideia é só parar de usar, prefira marcar como "Guardado".`
    : '';

  confirmar(`Excluir "${l.nome}"?${aviso}`, async () => {
    try {
      await escrever.removerOnde('culto_louvores', 'louvor_id', id);
      await escrever.removerOnde('ensaio_louvores', 'louvor_id', id);
      await escrever.remover('louvores', id);
      await recarregar('louvores', 'culto_louvores', 'ensaio_louvores');
      avisoBom('Louvor excluído.');
      telaLouvores(raiz);
    } catch { avisoRuim('Não consegui excluir.'); }
  }, 'Excluir', 'btn-perigo');
}
