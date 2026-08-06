/* ============================================================
   Configuração do servidor

   Estes dois valores dizem a qual Supabase o aplicativo fala. Ficam
   em variáveis de ambiente do build (VITE_...), não escritos no meio
   do código: é o que permite compilar a mesma versão apontando para
   o banco de produção, para o de teste ou para nenhum.

   Deixar os dois em branco liga o modo aparelho: tudo é guardado no
   próprio celular, sem servidor. É assim que o aplicativo de
   demonstração roda, e é para onde ele cai se a nuvem não responder.

   A chave "anon" aparecer aqui é normal e não é o que protege nada —
   quem protege é a política do banco. Ver produto/supabase/schema.sql.
   ============================================================ */

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? '';

export const MODO_NUVEM = Boolean(SUPABASE_URL && SUPABASE_KEY);

/* A função de acessos: entrar, criar login, trocar senha, recuperar.
   Tudo que exige poder que o aplicativo não pode carregar. */
export const ACESSO_URL = `${SUPABASE_URL}/functions/v1/acesso`;

/* Quantos meses para trás o aplicativo carrega ao abrir. O resto vem
   sob demanda, quando alguém pede um período mais antigo em Relatórios.
   Era isso que faltava: baixar o histórico inteiro a cada ação trava o
   celular assim que a igreja acumula uns dois anos de cultos. */
export const MESES_PADRAO = 4;

export const VERSAO = '2.0.0';
