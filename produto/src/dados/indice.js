/* ============================================================
   O depósito

   Uma cópia em memória do período em uso, para as telas desenharem sem
   ir ao servidor a cada rolagem. Duas coisas importam aqui:

   1. Carrega um PERÍODO, não o banco inteiro. O aplicativo antigo
      baixava todo o histórico a cada ação — funcionava com três meses
      de dados e travava com dois anos.

   2. Depois de salvar, recarrega SÓ a tabela que mudou. Confirmar
      presença puxava tudo de novo, incluindo o repertório e o cadastro
      de todo mundo, para mudar uma palavra na tela.
   ============================================================ */
import { MODO_NUVEM, MESES_PADRAO } from '../nucleo/config.js';
import { TABELAS, NOMES } from './tabelas.js';
import { nuvem } from './nuvem.js';
import { local } from './local.js';
import { hoje, mesesAtras } from '../nucleo/util.js';

/** Os dados do período em uso, por tabela. */
export const D = Object.fromEntries(NOMES.map((n) => [n, []]));

/** Qual pedaço do tempo está carregado. */
export const periodo = { de: '', ate: '' };

export let fonte = MODO_NUVEM ? nuvem : local;
export let noAparelho = !MODO_NUVEM;

/* Quando a nuvem não responde, o aplicativo continua de pé com o que
   está no celular — em vez de virar uma tela de erro no domingo. */
export function cairParaOAparelho() {
  fonte = local;
  noAparelho = true;
}

export function usarNuvem() {
  fonte = nuvem;
  noAparelho = false;
}

function janelaPadrao() {
  const fim = new Date();
  fim.setMonth(fim.getMonth() + 6);   // o que já está marcado para frente
  return {
    de: mesesAtras(MESES_PADRAO),
    ate: `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, '0')}-${String(fim.getDate()).padStart(2, '0')}`,
  };
}

/**
 * Carrega o período pedido. Sem argumentos, os últimos meses e o que
 * está marcado para frente — que é o que a tela do domingo precisa.
 */
export async function carregar({ de, ate } = {}) {
  const janela = janelaPadrao();
  periodo.de = de ?? janela.de;
  periodo.ate = ate ?? janela.ate;

  /* Primeiro as tabelas com data própria e as pequenas, em paralelo:
     são independentes entre si e esperar uma de cada vez é o que faz a
     abertura demorar em conexão de celular. */
  const comDataOuPequenas = NOMES.filter((n) => !TABELAS[n].porCulto && !TABELAS[n].porEnsaio);
  await Promise.all(comDataOuPequenas.map(async (nome) => {
    const { janela: coluna } = TABELAS[nome];
    D[nome] = await fonte.listar(nome, coluna
      ? { coluna, de: periodo.de, ate: periodo.ate }
      : {});
  }));

  /* Depois as que pendem dos cultos e ensaios já carregados: só as
     linhas daqueles, e não do histórico inteiro. */
  const cultos = D.cultos.map((c) => c.id);
  const ensaios = D.ensaios.map((e) => e.id);
  await Promise.all([
    ...NOMES.filter((n) => TABELAS[n].porCulto).map(async (nome) => {
      D[nome] = await fonte.listar(nome, { em: { [TABELAS[nome].porCulto]: cultos } });
    }),
    ...NOMES.filter((n) => TABELAS[n].porEnsaio).map(async (nome) => {
      D[nome] = await fonte.listar(nome, { em: { [TABELAS[nome].porEnsaio]: ensaios } });
    }),
  ]);
}

/** Recarrega uma tabela só — o normal depois de salvar algo. */
export async function recarregar(...nomes) {
  await Promise.all(nomes.map(async (nome) => {
    const t = TABELAS[nome];
    if (!t) return;
    if (t.porCulto) {
      D[nome] = await fonte.listar(nome, { em: { [t.porCulto]: D.cultos.map((c) => c.id) } });
    } else if (t.porEnsaio) {
      D[nome] = await fonte.listar(nome, { em: { [t.porEnsaio]: D.ensaios.map((e) => e.id) } });
    } else {
      D[nome] = await fonte.listar(nome, t.janela ? { coluna: t.janela, de: periodo.de, ate: periodo.ate } : {});
    }
  }));
}

/* ---------- Escrita ----------
   Cada uma devolve a linha salva e deixa a tela decidir o que
   recarregar. Salvar não recarrega nada sozinho de propósito: era
   justamente o "await carregar()" solto depois de cada clique que
   fazia o aplicativo baixar tudo trinta e cinco vezes. */
export const escrever = {
  inserir: (tabela, linha) => fonte.inserir(tabela, linha),
  atualizar: (tabela, id, mudancas) => fonte.atualizar(tabela, id, mudancas),
  remover: (tabela, id) => fonte.remover(tabela, id),
  removerOnde: (tabela, coluna, valor) => fonte.removerOnde(tabela, coluna, valor),
};

/* ---------- Atalhos que toda tela usa ---------- */
export const membro = (id) => D.membros.find((m) => m.id === id) ?? null;
export const nomeMembro = (id) => membro(id)?.nome ?? 'Removido';
export const louvor = (id) => D.louvores.find((l) => l.id === id) ?? null;
export const culto = (id) => D.cultos.find((c) => c.id === id) ?? null;

export const membrosAtivos = () => D.membros.filter((m) => m.status === 'ativo');

export function proximoCulto() {
  const agora = hoje();
  return D.cultos
    .filter((c) => c.data >= agora && c.status !== 'cancelada')
    .sort((a, b) => (a.data < b.data ? -1 : 1))[0] ?? null;
}

export const escalaDo = (cultoId) => D.escalas.filter((e) => e.culto_id === cultoId);
export const presencaDe = (membroId, cultoId) =>
  D.presencas.find((p) => p.membro_id === membroId && p.culto_id === cultoId) ?? null;
