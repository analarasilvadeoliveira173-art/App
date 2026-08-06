/* ============================================================
   EKKLESIA MUSIC — função de acessos
   ------------------------------------------------------------
   Criar e alterar logins exige um poder que o aplicativo não pode
   ter: com ele, qualquer pessoa criaria acesso em qualquer igreja.
   Por isso essa parte roda aqui no servidor, onde a chave secreta
   fica guardada e nunca chega ao celular de ninguém.

   O que esta função faz:
     criar_igreja   — só você, com a chave mestra (venda nova)
     criar_acesso   — o líder cria o login de um integrante
     trocar_senha   — o líder redefine a senha de alguém
     remover_acesso — o líder tira o acesso de alguém

   Publicar:  supabase functions deploy acesso --no-verify-jwt
   O passo a passo está em docs/configurar-supabase.md
   ============================================================ */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Definida por você em Edge Functions → Secrets. Sem ela, ninguém cria igreja.
const CHAVE_MESTRA = Deno.env.get('CHAVE_MESTRA') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
function erro(mensagem: string, status = 400) {
  return responder({ erro: mensagem }, status);
}

/* Mesmas regras do banco, para o endereço técnico bater. */
function semAcento(t: string) {
  return (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function montarEmail(codigo: string, usuario: string) {
  const u = semAcento(usuario).replace(/[^a-zA-Z0-9]+/g, '.').toLowerCase();
  const c = codigo.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
  return `${u}@${c}.ekklesia.app`;
}
function novoId(prefixo: string) {
  return prefixo + crypto.randomUUID().replace(/-/g, '').slice(0, 18);
}

/* Quem está chamando? Confere o crachá e devolve igreja e papel. */
async function quemChama(req: Request) {
  const cabecalho = req.headers.get('Authorization') ?? '';
  const token = cabecalho.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  const meta = (data.user.user_metadata ?? {}) as Record<string, string>;
  if (!meta.igreja_id) return null;
  return { id: data.user.id, igreja_id: meta.igreja_id, papel: meta.papel ?? 'membro' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return erro('Use POST.', 405);

  let corpo: Record<string, string>;
  try { corpo = await req.json(); } catch { return erro('Corpo inválido.'); }
  const acao = corpo.acao;

  /* ---------- Venda nova: só você, com a chave mestra ---------- */
  if (acao === 'criar_igreja') {
    if (!CHAVE_MESTRA || corpo.chave_mestra !== CHAVE_MESTRA) {
      return erro('Chave mestra inválida.', 401);
    }
    const { nome, codigo, contato, admin_nome, admin_senha, plano, situacao } = corpo;
    if (!nome || !codigo || !admin_senha) {
      return erro('Informe nome da igreja, código e a senha do administrador.');
    }
    if (admin_senha.length < 6) return erro('A senha do administrador precisa de 6 caracteres ou mais.');

    const codigoLimpo = codigo.trim().toUpperCase();
    const { data: existe } = await admin.from('igrejas').select('id').eq('codigo', codigoLimpo).maybeSingle();
    if (existe) return erro('Já existe uma igreja com esse código.');

    const igrejaId = novoId('ig-');
    const { error: e1 } = await admin.from('igrejas').insert({
      id: igrejaId, nome, codigo: codigoLimpo, contato: contato ?? null,
      plano: plano ?? 'essencial', situacao: situacao ?? 'teste',
    });
    if (e1) return erro('Não consegui criar a igreja: ' + e1.message, 500);

    const usuario = 'admin';
    const email = montarEmail(codigoLimpo, usuario);
    const { data: criado, error: e2 } = await admin.auth.admin.createUser({
      email, password: admin_senha, email_confirm: true,
      user_metadata: { igreja_id: igrejaId, papel: 'admin', nome: admin_nome ?? 'Administrador' },
    });
    if (e2) {
      await admin.from('igrejas').delete().eq('id', igrejaId);
      return erro('Não consegui criar o acesso do administrador: ' + e2.message, 500);
    }

    await admin.from('usuarios').insert({
      id: novoId('u-'), igreja_id: igrejaId, nome: admin_nome ?? 'Administrador',
      usuario, papel: 'admin', ativo: true, auth_id: criado.user!.id,
    });

    return responder({ ok: true, igreja_id: igrejaId, codigo: codigoLimpo, entrar_com: usuario });
  }

  /* ---------- Daqui para baixo, só líder ou administrador ---------- */
  const chamador = await quemChama(req);
  if (!chamador) return erro('Faça login novamente.', 401);
  if (!['admin', 'lider'].includes(chamador.papel)) {
    return erro('Só a liderança pode mexer nos acessos.', 403);
  }

  const { data: igreja } = await admin.from('igrejas')
    .select('id,codigo,situacao').eq('id', chamador.igreja_id).maybeSingle();
  if (!igreja) return erro('Igreja não encontrada.', 404);
  if (igreja.situacao === 'suspensa') return erro('Esta igreja está suspensa.', 403);

  if (acao === 'criar_acesso') {
    const { nome, usuario, senha, papel, membro_id } = corpo;
    if (!nome || !usuario || !senha) return erro('Informe nome, usuário e senha.');
    if (senha.length < 4) return erro('A senha precisa de 4 caracteres ou mais.');
    if (papel === 'admin' && chamador.papel !== 'admin') {
      return erro('Só um administrador cria outro administrador.', 403);
    }

    const { data: jaTem } = await admin.from('usuarios')
      .select('id').eq('igreja_id', igreja.id).ilike('usuario', usuario).maybeSingle();
    if (jaTem) return erro('Já existe um acesso com esse usuário nesta igreja.');

    const email = montarEmail(igreja.codigo, usuario);
    const { data: criado, error: e1 } = await admin.auth.admin.createUser({
      email, password: senha, email_confirm: true,
      user_metadata: { igreja_id: igreja.id, papel: papel ?? 'membro', nome },
    });
    if (e1) return erro('Não consegui criar o acesso: ' + e1.message, 500);

    const { error: e2 } = await admin.from('usuarios').insert({
      id: novoId('u-'), igreja_id: igreja.id, nome, usuario,
      papel: papel ?? 'membro', ativo: true, membro_id: membro_id ?? null,
      auth_id: criado.user!.id,
    });
    if (e2) {
      await admin.auth.admin.deleteUser(criado.user!.id);
      return erro('Não consegui salvar o acesso: ' + e2.message, 500);
    }
    return responder({ ok: true });
  }

  if (acao === 'trocar_senha') {
    const { usuario_id, senha } = corpo;
    if (!usuario_id || !senha) return erro('Informe quem é e a nova senha.');
    if (senha.length < 4) return erro('A senha precisa de 4 caracteres ou mais.');

    const { data: alvo } = await admin.from('usuarios')
      .select('auth_id,papel').eq('id', usuario_id).eq('igreja_id', igreja.id).maybeSingle();
    if (!alvo?.auth_id) return erro('Acesso não encontrado nesta igreja.', 404);
    if (alvo.papel === 'admin' && chamador.papel !== 'admin') {
      return erro('Só um administrador troca a senha de outro administrador.', 403);
    }

    const { error } = await admin.auth.admin.updateUserById(alvo.auth_id, { password: senha });
    if (error) return erro('Não consegui trocar a senha: ' + error.message, 500);
    return responder({ ok: true });
  }

  if (acao === 'remover_acesso') {
    const { usuario_id } = corpo;
    if (!usuario_id) return erro('Informe qual acesso remover.');

    const { data: alvo } = await admin.from('usuarios')
      .select('auth_id,papel,usuario').eq('id', usuario_id).eq('igreja_id', igreja.id).maybeSingle();
    if (!alvo) return erro('Acesso não encontrado nesta igreja.', 404);
    if (alvo.usuario === 'admin') return erro('O acesso principal não pode ser removido.');
    if (alvo.papel === 'admin' && chamador.papel !== 'admin') {
      return erro('Só um administrador remove outro administrador.', 403);
    }

    if (alvo.auth_id) await admin.auth.admin.deleteUser(alvo.auth_id);
    await admin.from('usuarios').delete().eq('id', usuario_id).eq('igreja_id', igreja.id);
    return responder({ ok: true });
  }

  return erro('Ação desconhecida: ' + acao);
});
