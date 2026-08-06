/* ============================================================
   As tabelas do ministério e como cada uma se recorta no tempo

   "janela" diz por qual coluna de data a tabela é filtrada ao carregar.
   Tabela sem janela é pequena por natureza (funções, membros, acessos) e
   vem inteira. As grandes — cultos, escalas, presenças — crescem para
   sempre, e é justamente o que fazia o aplicativo baixar dois anos de
   histórico para mostrar o próximo domingo.

   "porCulto" marca as que não têm data própria: elas acompanham os
   cultos que já foram carregados.
   ============================================================ */

export const TABELAS = {
  funcoes:              { janela: null },
  membros:              { janela: null },
  membros_funcoes:      { janela: null },
  louvores:             { janela: null },
  usuarios:             { janela: null },
  avisos:               { janela: 'criado_em' },

  cultos:               { janela: 'data' },
  culto_louvores:       { janela: null, porCulto: 'culto_id' },
  escalas:              { janela: null, porCulto: 'culto_id' },
  presencas:            { janela: null, porCulto: 'culto_id' },

  ensaios:              { janela: 'data' },
  ensaio_louvores:      { janela: null, porEnsaio: 'ensaio_id' },

  indisponibilidades:   { janela: 'ate' },
  sugestoes_louvores:   { janela: 'criado_em' },
};

export const NOMES = Object.keys(TABELAS);

/* Tabelas que uma pessoa comum pode escrever: só o que é dela. O banco
   é quem manda nisso — esta lista existe para o aplicativo não oferecer
   um botão que o servidor vai recusar. */
export const PESSOAIS = ['presencas', 'indisponibilidades', 'sugestoes_louvores'];
