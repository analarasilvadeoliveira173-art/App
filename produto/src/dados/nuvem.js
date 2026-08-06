/* ============================================================
   Falando com o Supabase

   Repare no que NÃO está aqui: nenhum filtro por igreja. Quem separa
   uma igreja da outra é o banco, pelo crachá do login. Filtrar aqui
   seria só uma sugestão educada — e qualquer um que chamasse a API por
   fora do aplicativo ignoraria a sugestão.

   O que está aqui é o recorte de tempo: pedir só o período em uso, em
   vez do histórico inteiro.
   ============================================================ */
import { SUPABASE_URL, SUPABASE_KEY, ACESSO_URL } from '../nucleo/config.js';
import { sessao, renovarCracha } from '../sessao/sessao.js';

async function cabecalhos() {
  const cracha = await crachaValido();
  if (!cracha) throw new Error('SESSAO_EXPIRADA');
  return {
    apikey: SUPABASE_KEY,
    Authorization: 'Bearer ' + cracha,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

export async function crachaValido() {
  if (!sessao.cracha) return '';
  if (Date.now() >= sessao.expira) { if (!await renovarCracha()) return ''; }
  return sessao.cracha;
}

function endereco(tabela, consulta) {
  return `${SUPABASE_URL}/rest/v1/${tabela}${consulta ? '?' + consulta : ''}`;
}

async function conferir(r, o) {
  if (r.ok) return;
  const corpo = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) throw new Error('SESSAO_EXPIRADA');
  throw new Error(`${o}: ${corpo.message || r.status}`);
}

export const nuvem = {
  /**
   * @param {string} tabela
   * @param {object} filtros  { de, ate, coluna, em: {col: [valores]} }
   */
  async listar(tabela, filtros = {}) {
    const partes = ['select=*'];
    if (filtros.coluna && filtros.de) partes.push(`${filtros.coluna}=gte.${encodeURIComponent(filtros.de)}`);
    if (filtros.coluna && filtros.ate) partes.push(`${filtros.coluna}=lte.${encodeURIComponent(filtros.ate)}`);
    for (const [col, valores] of Object.entries(filtros.em ?? {})) {
      /* Sem nenhum valor, "in.()" traria a tabela inteira — o oposto do
         que a chamada quer dizer. Melhor nem perguntar. */
      if (!valores.length) return [];
      partes.push(`${col}=in.(${valores.map((v) => `"${String(v).replace(/"/g, '')}"`).join(',')})`);
    }
    if (filtros.ordem) partes.push(`order=${filtros.ordem.col}.${filtros.ordem.crescente === false ? 'desc' : 'asc'}`);

    const r = await fetch(endereco(tabela, partes.join('&')), { headers: await cabecalhos() });
    await conferir(r, 'listar ' + tabela);
    return r.json();
  },

  async inserir(tabela, linha) {
    const r = await fetch(endereco(tabela), {
      method: 'POST', headers: await cabecalhos(), body: JSON.stringify(linha),
    });
    await conferir(r, 'inserir em ' + tabela);
    const lista = await r.json();
    return lista[0] ?? linha;
  },

  async atualizar(tabela, id, mudancas) {
    const r = await fetch(endereco(tabela, `id=eq.${encodeURIComponent(id)}`), {
      method: 'PATCH', headers: await cabecalhos(), body: JSON.stringify(mudancas),
    });
    await conferir(r, 'salvar em ' + tabela);
    const lista = await r.json();
    return lista[0] ?? null;
  },

  async remover(tabela, id) {
    const r = await fetch(endereco(tabela, `id=eq.${encodeURIComponent(id)}`), {
      method: 'DELETE', headers: await cabecalhos(),
    });
    await conferir(r, 'excluir de ' + tabela);
  },

  async removerOnde(tabela, coluna, valor) {
    const r = await fetch(endereco(tabela, `${coluna}=eq.${encodeURIComponent(valor)}`), {
      method: 'DELETE', headers: await cabecalhos(),
    });
    await conferir(r, 'excluir de ' + tabela);
  },
};

/* ------------------------------------------------------------
   A função de acessos

   Entrar, criar login, trocar senha, recuperar. Tudo que exige a chave
   secreta, que fica no servidor e nunca chega ao celular.
   ------------------------------------------------------------ */
export async function chamarAcesso(corpo, comCracha = false) {
  let autorizacao = SUPABASE_KEY;
  if (comCracha) {
    autorizacao = await crachaValido();
    if (!autorizacao) throw new Error('Sua sessão expirou. Entre de novo.');
  }

  let r;
  try {
    r = await fetch(ACESSO_URL, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + autorizacao, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new Error('Sem conexão agora. Tente de novo em instantes.');
  }

  /* 404 aqui quer dizer que a função não foi publicada neste projeto.
     Sem essa distinção a pessoa fica tentando a senha achando que
     errou, quando o que falta é um passo da instalação. */
  if (r.status === 404 || r.status === 503) {
    throw new Error('A parte do servidor ainda não foi publicada nesta igreja. '
      + 'Quem instalou precisa publicar a função de acessos.');
  }
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dados.erro || 'Não consegui completar essa ação agora.');
  return dados;
}
