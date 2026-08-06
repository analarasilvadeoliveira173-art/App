/* ============================================================
   Entrar

   Na nuvem, quem confere nome e senha é o servidor: o aplicativo manda
   código, nome e senha e recebe uma resposta só. Nome errado e senha
   errada respondem a mesma coisa — perguntar antes "esse nome existe?"
   deixava qualquer um com o código da igreja descobrir a equipe
   inteira, um nome por vez.

   No aparelho, sem servidor, a conferência é local.
   ============================================================ */
import { MODO_NUVEM, SUPABASE_URL, SUPABASE_KEY } from '../nucleo/config.js';
import { chamarAcesso, crachaValido } from '../dados/nuvem.js';
import { sessao, guardarCracha, guardarPessoa } from './sessao.js';
import { noAparelho } from '../dados/indice.js';
import { entrarNoAparelho } from '../dados/local.js';

export const SENHA_MINIMA = 6;

export async function entrarNaIgreja(codigo, nome, senha) {
  if (MODO_NUVEM && !noAparelho) {
    const resposta = await chamarAcesso({ acao: 'entrar', codigo, nome, senha });
    sessao.codigo = String(codigo).trim().toUpperCase();
    const pessoa = guardarCracha(resposta);
    guardarPessoa({ ...pessoa, nome: pessoa.nome || nome });
    return pessoa;
  }

  const pessoa = await entrarNoAparelho(nome, senha);
  guardarPessoa(pessoa);
  return pessoa;
}

export async function trocarSenhaComCodigo(codigoIgreja, nome, codigo, novaSenha) {
  return chamarAcesso({
    acao: 'usar_recuperacao',
    codigo_igreja: codigoIgreja, nome, codigo, nova_senha: novaSenha,
  });
}

/* A troca feita pela própria pessoa, já dentro do aplicativo. Na nuvem
   quem guarda a senha é o Supabase, embaralhada, e a troca vale em
   todos os aparelhos de uma vez. */
export async function trocarMinhaSenha(novaSenha) {
  const cracha = await crachaValido();
  if (!cracha) throw new Error('Sua sessão expirou. Entre de novo.');

  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + cracha, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: novaSenha }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.msg || d.error_description || 'Não consegui trocar a senha agora.');
  }
}
