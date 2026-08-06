# Preparar o Supabase para várias igrejas

Este guia é para transformar o aplicativo de "uma igreja" em "várias igrejas",
com os dados de cada uma separados de verdade.

**Antes de começar:** abra o aplicativo e faça
**Configurações → Baixar backup completo**. Guarde o arquivo. Se algo der
errado, ele traz tudo de volta.

Reserve uns 30 minutos. Você vai copiar e colar textos prontos — não precisa
entender programação.

---

## Por que isso é necessário

Hoje a regra do banco diz "libere tudo para quem tiver a chave do aplicativo".
Como a chave fica dentro do app, qualquer pessoa que instale consegue ler os
dados de qualquer igreja.

Com uma igreja só, tudo bem: todos são da mesma casa. Vendendo para várias, um
cliente conseguiria ver os telefones e as escalas de outro. Depois desta
configuração, quem separa as igrejas passa a ser o banco — e nem mexendo no
aplicativo alguém alcança dados que não são seus.

---

## Passo 1 — Criar as tabelas e as regras

1. Entre em [supabase.com](https://supabase.com) e abra seu projeto
2. No menu da esquerda, clique em **SQL Editor**
3. Clique em **New query**
4. Abra o arquivo [`supabase/schema.sql`](../supabase/schema.sql), copie **tudo** e cole ali
5. Clique em **Run** (ou Ctrl+Enter)

Deve aparecer *Success. No rows returned*. Se aparecer erro em vermelho, copie
a mensagem e me mande.

---

## Passo 2 — Levar seus dados atuais para a estrutura nova

1. Ainda no **SQL Editor**, abra uma nova query
2. Abra o arquivo [`supabase/migracao-para-multi-igreja.sql`](../supabase/migracao-para-multi-igreja.sql)
3. **Antes de rodar**, mude as três primeiras linhas para os dados da sua igreja:

```sql
v_nome     text := 'Igreja Betel';       -- o nome da sua igreja
v_codigo   text := 'BETEL-2026';         -- o código que sua equipe vai digitar
v_contato  text := '73999990000';        -- seu WhatsApp (pode deixar vazio)
```

O **código** é o que você vai passar para os 7 integrantes. Escolha algo curto
e fácil de ditar no grupo do WhatsApp.

4. Cole o arquivo inteiro e clique em **Run**

Ele mostra uma tabela conferindo quantos registros foram para a sua igreja, e
uma lista com as senhas atuais de cada pessoa. **Anote essas senhas** — é a
última vez que dá para lê-las.

---

## Passo 3 — Guardar a chave secreta

Essa chave dá poder total sobre o banco. Ela fica só no servidor e **nunca**
entra no aplicativo.

1. No menu, **Edge Functions** → aba **Secrets**
2. Clique em **Add new secret**
3. Nome: `CHAVE_MESTRA`
4. Valor: invente uma senha longa, tipo `ekklesia-2026-x7k9m2p4q8` — é ela que
   vai autorizar você a criar igrejas novas quando alguém comprar
5. **Save**

Guarde essa chave num lugar seguro. Sem ela você não consegue cadastrar
clientes; com ela, quem a tiver consegue.

---

## Passo 4 — Publicar a função de acessos

É ela que cria os logins com segurança. Precisa ser publicada uma vez.

**Pelo computador** (jeito recomendado). No terminal, dentro da pasta do
projeto:

```bash
npm install -g supabase
supabase login
supabase link --project-ref SEU-CODIGO-DO-PROJETO
supabase functions deploy acesso --no-verify-jwt
```

O `SEU-CODIGO-DO-PROJETO` aparece na barra de endereço quando você está no
painel: `supabase.com/dashboard/project/`**`jrpneeqwaejvzvxwcjup`**.

**Pelo navegador**, se preferir não instalar nada: em **Edge Functions** →
**Create a new function**, dê o nome `acesso`, apague o conteúdo de exemplo e
cole o arquivo [`supabase/functions/acesso/index.ts`](../supabase/functions/acesso/index.ts).
Em seguida, nas configurações da função, desmarque **Verify JWT**.

---

## Passo 5 — Criar os acessos das pessoas

As senhas antigas não vêm junto de propósito: elas estavam guardadas em texto
puro, e agora passam a ficar embaralhadas — o que significa que ninguém, nem
você, consegue mais lê-las no banco.

Entre no aplicativo com o código da igreja, o usuário `admin` e a senha que
você definiu, e recadastre os acessos em **Usuários**. Passe a senha de cada
pessoa junto com o código da igreja.

Depois que todos entrarem pelo menos uma vez, volte ao SQL Editor e rode:

```sql
alter table public.usuarios drop column if exists pin;
alter table public.membros  drop column if exists pin;
```

Isso apaga as senhas antigas em texto puro.

---

## Quando uma igreja nova comprar

Você não precisa mexer no banco. Uma chamada só cria a igreja, o acesso do
administrador e o código de entrada.

Pelo terminal:

```bash
curl -X POST 'https://SEU-PROJETO.supabase.co/functions/v1/acesso' \
  -H 'Content-Type: application/json' \
  -d '{
    "acao": "criar_igreja",
    "chave_mestra": "a-chave-que-voce-guardou",
    "nome": "Igreja Monte Sião",
    "codigo": "MONTESIAO-2026",
    "admin_nome": "Pastor João",
    "admin_senha": "senha-inicial-dele",
    "contato": "73988887777",
    "situacao": "ativa"
  }'
```

Depois é só mandar para o cliente:

> Código da igreja: **MONTESIAO-2026**
> Usuário: **admin**
> Senha: *(a que você definiu)*

Peça para ele trocar a senha assim que entrar, em **Perfil**.

Na próxima etapa eu construo uma tela para isso, para você não precisar mexer
com comandos.

---

## Suspender quem parou de pagar

No **Table Editor** → tabela **`igrejas`**, mude a coluna `situacao` da linha
daquela igreja:

| Valor | O que acontece |
|---|---|
| `ativa` | Funciona normalmente |
| `teste` | Funciona normalmente (use para período de avaliação) |
| `suspensa` | Ninguém daquela igreja consegue entrar |

Os dados continuam guardados. Voltando para `ativa`, tudo volta como estava.

---

## Conferir se ficou seguro

No SQL Editor, rode:

```sql
select tablename, rowsecurity as protegida
  from pg_tables where schemaname = 'public' order by tablename;
```

Todas as linhas precisam mostrar `protegida = true`. Se alguma estiver
`false`, os dados daquela tabela estão abertos — rode o `schema.sql` de novo.

---

## Se algo der errado

O aplicativo continua funcionando **no modo local** enquanto isso: basta apagar
o conteúdo de `SUPABASE_URL` e `SUPABASE_KEY` no `www/index.html` que ele volta
a guardar tudo no próprio aparelho, com os dados do backup que você baixou.

Nada do que está descrito aqui apaga dados. O passo mais delicado é o Passo 5,
e mesmo ele só remove as senhas antigas **depois** que você confirmar que todos
conseguem entrar.
