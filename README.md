# Ekklesia Music

Aplicativo de gestão para ministérios de louvor: escalas por culto, repertório,
ensaios, confirmação de presença, sugestões de louvor e mural de avisos.

Funciona em três formatos com o **mesmo código**:

| Formato | Como usar |
|---|---|
| Site / navegador | Abrir `www/index.html` em qualquer servidor web |
| Aplicativo instalável (PWA) | Abrir pelo navegador do celular e escolher "Adicionar à tela de início" |
| Aplicativo Android (APK) | Gerado com Capacitor — veja [Gerar o APK](#gerar-o-apk-android) |

---

## Como rodar no computador

Basta um servidor de arquivos estáticos — não há etapa de build.

```bash
npm start
# abre em http://localhost:5173
```

Ou, sem Node.js:

```bash
python3 -m http.server 5173 --directory www
```

**Primeiro acesso:** usuário `admin`, senha `1234`. O aviso dessa senha padrão
desaparece da tela de login assim que você a troca em **Usuários**.

---

## Os dois modos de funcionamento

### Modo local (padrão quando não há Supabase configurado)

Os dados ficam no armazenamento do próprio aparelho. É suficiente para uma
igreja que usa o app em um celular ou computador só, mas **cada aparelho tem
sua própria cópia** — o que um cadastra o outro não vê. Faça backups por
**Configurações → Baixar backup completo**.

### Modo nuvem (Supabase)

Todos os aparelhos enxergam a mesma escala, em tempo quase real.

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, cole e execute o arquivo [`supabase/schema.sql`](supabase/schema.sql).
3. Em **Settings → API**, copie a *Project URL* e a chave *anon*.
4. Preencha as constantes no início do bloco `<script>` de `www/index.html`:

```js
const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_KEY = 'sua-chave-anon';
```

Com as duas preenchidas o app entra em modo nuvem sozinho. Para levar os dados
que já estavam no aparelho, use **Configurações → Enviar dados deste aparelho
para a nuvem** (registros com o mesmo id são atualizados, nada é apagado).

Se o servidor não responder, o app não trava: a tela de abertura oferece
**Tentar de novo** ou **Usar dados deste aparelho**, e o rodapé de
Configurações mostra em que modo você está.

---

## Segurança — leia antes de colocar no ar

- **A chave `anon` fica visível dentro do aplicativo.** Isso é normal no
  Supabase, mas significa que quem protege os dados é o *Row Level Security*.
  O `schema.sql` já ativa o RLS em todas as tabelas com uma política mínima,
  de igreja única, que **libera leitura e escrita para qualquer portador da
  chave**. Para atender mais de uma igreja, troque pelas políticas de
  isolamento por `igreja_id` comentadas no fim do mesmo arquivo — elas
  dependem do Supabase Auth.
- **Os PINs são guardados em texto puro.** O modelo de acesso aqui é de
  conveniência (destravar o próprio painel), não de segredo bancário. Não
  reaproveite nesses campos uma senha usada em outro serviço.
- Nunca versione a `service_role` do Supabase. Só a chave `anon` entra no
  aplicativo.

---

## Testes

```bash
npm install
npx playwright install chromium   # só na primeira vez
npm test
```

São duas suítes, e as duas rodam no GitHub Actions a cada push e pull request
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

- `npm run test:static` — arquivos obrigatórios, JSON válido, sintaxe do
  JavaScript do app e do service worker, e coerência entre `capacitor.config.json`,
  o manifest e o HTML.
- `npm run test:e2e` — abre o app no Chromium **com o Supabase bloqueado** e
  percorre os caminhos que precisam funcionar quando a internet falha: tela de
  erro e recuperação, login de líder e de membro, sessão persistente, troca de
  tema, todas as telas, montagem de escala, regras de senha, cadastros,
  persistência após recarregar e layout de celular.

Ambas terminam com código de saída diferente de zero quando algo quebra, então
uma regressão reprova o CI em vez de passar despercebida.

---

## Gerar o APK (Android)

Requisitos: Node.js 18+, JDK 17 e Android Studio (ou o SDK do Android).

```bash
npm install
npx cap add android      # só na primeira vez
npm run build:android    # gera o APK de depuração
```

O arquivo sai em `android/app/build/outputs/apk/debug/app-debug.apk`.

Para a versão de publicação (`npm run build:android:release`) é preciso
assinar o APK com sua própria chave — veja a
[documentação do Capacitor](https://capacitorjs.com/docs/android/deploying-to-google-play).

Depois de qualquer alteração em `www/`, rode `npm run cap:sync` para copiar os
arquivos para o projeto nativo.

---

## Estrutura

```
www/
  index.html            aplicativo inteiro (HTML + CSS + JS em um arquivo)
  manifest.webmanifest  identidade do app instalável
  sw.js                 service worker: abre offline, nunca cacheia dados
  icone.svg             ícone do app
supabase/
  schema.sql            tabelas, índices e políticas de segurança
tests/
  verifica-estatico.mjs verificações que não precisam de navegador
  e2e.mjs               testes de ponta a ponta no Chromium
capacitor.config.json   configuração do app nativo
```

O `index.html` é autocontido de propósito: qualquer hospedagem serve, não há
build, e o arquivo pode ser enviado por e-mail ou pendrive se necessário.

---

## Perfis de acesso

| Perfil | O que pode fazer |
|---|---|
| **Administrador** | Tudo, incluindo usuários e configurações da igreja |
| **Líder** | Escalas, repertório, ensaios, membros e relatórios |
| **Membro** | Vê as próprias escalas, confirma presença, informa indisponibilidade e — quando é voz principal — sugere louvores |

Membros entram tocando no próprio nome na tela inicial, com PIN opcional.
Líderes e administradores entram por usuário e senha.

---

## Personalização

Em **Configurações → Identidade da igreja** dá para trocar nome do aplicativo,
nome da igreja, nome do ministério, sigla e as duas cores da marca. Também há a
opção de **Aparência** (automática, clara ou escura); no modo automático o app
acompanha o tema do celular.

Essas preferências ficam no aparelho, então cada pessoa escolhe o próprio tema.
