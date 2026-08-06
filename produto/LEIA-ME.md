# Ekklesia Music — o produto

Este é o aplicativo que vai ser vendido a outras igrejas. O que está na
raiz do repositório (`www/index.html`) continua sendo o app da igreja da
Ana e não se mistura com este.

## O que mudou em relação ao antigo

| Antes | Agora |
|---|---|
| Um arquivo HTML de 3.200 linhas | Módulos separados por assunto |
| Cada ação baixava o banco inteiro | Carrega um período; depois de salvar, recarrega só a tabela que mudou |
| Estilo espalhado pelo arquivo | Um vocabulário visual só, em `src/estilo/tokens.css` |
| Testes contra o código-fonte | Testes contra o build de verdade, que é o que vai para o celular |

## Rodar aqui

```bash
cd produto
npm install
npm run dev       # abre em http://localhost:5173
```

Sem `VITE_SUPABASE_URL` configurada, o aplicativo roda no **modo
demonstração**: uma igreja de exemplo guardada no próprio navegador, sem
servidor nenhum. É o que a igreja interessada experimenta antes de comprar.

Para entrar na demonstração:

| Quem | Digite | Senha |
|---|---|---|
| Administrador | `admin` | `ekklesia` |
| Líder | `João Pereira` | `ekklesia` |
| Membro | `Maria Santos` | `ekklesia` |

## Apontar para um Supabase

```bash
cp .env.exemplo .env.local   # e preencha os dois valores
npm run build
```

O passo a passo de montar o banco está em `supabase/`.

## Testes

```bash
npm run build && npm test
```

- `test:estatico` — confere o código sem abrir navegador
- `test:banco` — sobe um PostgreSQL e prova que uma igreja não alcança a outra
- `test:tela` — abre o aplicativo compilado no navegador e usa de verdade
