/* ============================================================
   A sessão

   Entrar uma vez e continuar entrado. O crachá vale uma hora e é
   renovado sozinho um minuto antes de vencer, para não falhar no meio
   de uma ação — no domingo de manhã, com a escala aberta.

   O crachá carrega igreja, papel e vínculo. É dele que o aplicativo lê
   quem é a pessoa, e não da tabela: um integrante não lê mais a lista
   de acessos, e ninguém vira líder editando o próprio cadastro.
   ============================================================ */
import { SUPABASE_URL, SUPABASE_KEY, MODO_NUVEM } from '../nucleo/config.js';

const CHAVE = 'ekklesia.sessao';

export const sessao = {
  cracha: '', renovacao: '', expira: 0,
  igreja_id: '', codigo: '',
};

export let pessoa = null;   // { nome, usuario, papel, membro_id }

export function definirPessoa(p) { pessoa = p; }

export function guardarCracha(resposta) {
  sessao.cracha = resposta.access_token || '';
  sessao.renovacao = resposta.refresh_token || '';
  sessao.expira = Date.now() + ((resposta.expires_in || 3600) - 60) * 1000;
  const meta = resposta.user?.user_metadata ?? {};
  sessao.igreja_id = meta.igreja_id || sessao.igreja_id;
  salvar();
  return {
    nome: meta.nome || '', usuario: meta.usuario || '',
    papel: meta.papel || 'membro', membro_id: meta.membro_id || null,
  };
}

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({
      ...sessao,
      pessoa,
      /* O código da igreja fica no aparelho porque é digitado uma vez
         só. Não é segredo: a equipe inteira o conhece. */
    }));
  } catch { /* modo anônimo */ }
}

export function guardarPessoa(p) {
  pessoa = p;
  salvar();
}

export function limparSessao() {
  sessao.cracha = ''; sessao.renovacao = ''; sessao.expira = 0; sessao.igreja_id = '';
  pessoa = null;
  try {
    /* O código da igreja sobrevive à saída: quem sai e volta não deve
       precisar perguntar o código de novo à liderança. */
    const codigo = sessao.codigo;
    localStorage.setItem(CHAVE, JSON.stringify({ codigo }));
  } catch { /* modo anônimo */ }
}

export function recuperarSessao() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return false;
    const guardado = JSON.parse(bruto);
    sessao.codigo = guardado.codigo || '';
    pessoa = guardado.pessoa || null;
    if (!pessoa) return false;

    /* Sem servidor, quem entrou continua entrado: não há crachá para
       conferir, e o dado é deste aparelho mesmo. */
    if (!MODO_NUVEM) return true;

    /* Com servidor, sessão sem crachá não vale nada — quem for
       reaproveitar a tela sem o crachá não passa da primeira consulta. */
    if (!guardado.cracha) { pessoa = null; return false; }
    sessao.cracha = guardado.cracha;
    sessao.renovacao = guardado.renovacao || '';
    sessao.expira = guardado.expira || 0;
    sessao.igreja_id = guardado.igreja_id || '';
    return true;
  } catch { return false; }
}

export async function renovarCracha() {
  if (!sessao.renovacao) return false;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: sessao.renovacao }),
  });
  if (!r.ok) { limparSessao(); return false; }
  guardarCracha(await r.json());
  return true;
}

export const ehLideranca = () => ['admin', 'lider'].includes(pessoa?.papel);
export const ehAdmin = () => pessoa?.papel === 'admin';
