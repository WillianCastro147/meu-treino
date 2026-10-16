# Moviq

App web estilo Hevy para registrar treinos, **em inglês (idioma principal), português, espanhol e francês**, com 5 abas (Início, Plano, ▶ Iniciar, Progresso e Exercícios), 1.062 exercícios com GIFs animados (nomes nos 4 idiomas), login e dados na nuvem via Supabase.

## Idiomas (EN / PT / ES / FR)

- **Inglês é o idioma principal.** O app detecta o idioma do navegador: português, espanhol ou francês abrem no respectivo idioma; qualquer outro abre em inglês.
- O usuário pode trocar a qualquer momento no seletor **EN · PT · ES · FR** da tela de login ou da aba Perfil (a escolha fica salva no aparelho).
- Para mandar um link já no idioma certo (ex.: em cada oferta), adicione `?lang=`:
  - English: `https://SEU-APP.vercel.app/login?lang=en`
  - Português: `https://SEU-APP.vercel.app/login?lang=pt`
  - Español: `https://SEU-APP.vercel.app/login?lang=es`
  - Français: `https://SEU-APP.vercel.app/login?lang=fr`
- Textos da interface: `lib/i18n.js`. Nomes dos exercícios: `data/exercises.json` (campo `name` com `en`, `pt`, `es` e `fr`).

## Recursos do treino

- **Treino salvo automaticamente:** se a página recarregar ou o celular fechar o navegador, o treino continua de onde parou (aviso "Treino em andamento · Continuar" no Início e no Treino).
- **Desempenho anterior** em cada série (ex.: `60×10`). Toque para copiar; se marcar a série sem digitar o peso, usa o da última vez.
- Adicionar exercício, remover série e remover exercício durante o treino.
- Toque no GIF para ver o exercício em tamanho grande.
- Cronômetro e descanso pelo horário real (não atrasam com a tela bloqueada), tela sempre acesa durante o treino e bipe compatível com iPhone.
- Instalável como app (ícone próprio e tela cheia) pelo "Adicionar à tela inicial".
- "Esqueci minha senha" na tela de login.

## Esqueci minha senha (configuração única no Supabase)

Em **Authentication → URL Configuration → Redirect URLs**, adicione:
`https://SEU-APP.vercel.app/redefinir-senha`
(Mesmo sem isso o fluxo funciona, mas com isso o link abre direto na tela certa.)

## Supabase sempre ativo

O arquivo `vercel.json` agenda uma chamada diária para `/api/keepalive`, que faz uma consulta leve no banco. Isso evita que o Supabase gratuito pause por falta de uso. Nada a configurar: a Vercel ativa sozinha após o deploy (veja em Settings → Cron Jobs).

## App não abre / login não funciona?

No plano gratuito, o Supabase **pausa o projeto após alguns dias sem uso**. Aí o login e os dados param de funcionar. Para resolver: entre em supabase.com/dashboard, abra o projeto e clique em **Restore project**. Espere uns 2 minutos e teste de novo.

## Atualizar o banco (Fase 1: peso corporal)

Quem já tem o banco criado precisa rodar **uma vez** o arquivo `supabase/migrations/002_fase1.sql` no **SQL Editor** do Supabase (cole tudo e clique em **Run**). Ele cria a tabela `body_weights` e a coluna `goal_weight_kg` no perfil. Sem isso o app funciona normalmente, só o cartão de peso corporal mostra o aviso para rodar a migração.

## Estrutura

Navegação inspirada no openGym (código escrito do zero para o Moviq):

- **Início** — resumo da semana (treinos, tempo, semanas seguidas, volume) e histórico de treinos. A engrenagem abre as **Configurações** (perfil, IMC, idioma, sair).
- **Plano** — criar/editar rotinas (séries, repetições e tempo de descanso).
- **▶ Iniciar** (botão central) — começa um **treino livre** ou uma rotina; com treino em andamento vira **Continuar**. Durante o treino, a série que bate seu recorde ganha o selo **PR**, e ao finalizar aparece o resumo com os recordes batidos.
- **Progresso** — totais, mapa de atividade dos últimos 6 meses, volume e treinos por semana, recordes pessoais (1RM estimado) e peso corporal com gráfico e meta.
- **Exercícios** — biblioteca com busca e filtro "Que já fiz"; cada exercício mostra melhor 1RM estimado, maior carga, gráfico de evolução e histórico de séries.

### Fase 2: progressão e séries

- **Tipos de série:** toque no número da série para marcar **W** (aquecimento), **D** (drop set) ou **F** (até a falha), ou remover aquela série. Aquecimento não conta para volume, recordes nem 1RM.
- **Esforço (RPE/RIR):** opcional, ligado em Configurações → Treino. Fica guardado como RPE em cada série.
- **Progressão automática** por exercício na rotina: **Linear** (sobe X kg quando todas as séries batem as repetições) ou **Dupla** (sobe repetições até o topo da faixa, depois a carga). No treino, a carga e as repetições sugeridas já vêm preenchidas, com uma linha explicando o porquê.
- **Calculadora de anilhas:** toque em **KG ⦿** no cabeçalho das séries. Barra e anilhas disponíveis ficam salvas no aparelho.
- **Supersets:** no editor de rotina, "Superset com o próximo" junta exercícios. No treino, ao concluir uma série o app vai para o próximo exercício do grupo e só descansa no fim da rodada.

Tudo fica no JSON das rotinas e treinos que já existe: **não precisa de migração** no Supabase. Lógica em `lib/sets.js`, `lib/progression.js`, `lib/plates.js` e `lib/superset.js`, com testes em `lib/fase2.test.mjs`.

### Fase 3: catálogo do openGym, plano e dados

- **5.632 exercícios** do catálogo do openGym, com animação, nomes em EN/PT/ES/FR e passo a passo. Busca por nome (no idioma ou em inglês), parte do corpo e equipamento. Os 1.062 exercícios antigos ficam escondidos da biblioteca, mas rotinas e treinos antigos continuam mostrando nome e GIF.
  - Para regenerar: `node scripts/build-catalog.mjs <pasta>/openGym/catalogue`.
- **Plano:** semana fixa (uma rotina por dia) ou **rotação** (A, B, C... o próximo é o seguinte ao último feito). O Início mostra a rotina de hoje.
- **Planos prontos:** Push/Pull/Legs, Superior/Inferior, Corpo inteiro e 5×5, já com progressão linear.
- **Editar treino salvo** (botão Editar no histórico) e **registrar treino passado** (Plano → Registrar treino passado).
- **Dados** (Configurações): exportar tudo em JSON e importar o histórico do **Hevy** ou do **Strong** (CSV). Treinos repetidos são ignorados.
- Precisa rodar **uma vez** `supabase/migrations/003_plano.sql` no SQL Editor (coluna `plan` no perfil e `routine_id` nos treinos). Sem ela o app funciona, só o plano mostra o aviso.

O 1RM estimado usa a fórmula de Epley (até 12 repetições). A lógica fica em `lib/`, com testes em `lib/*.test.mjs` (`npm test`).

### Coach com IA (OpenAI)

Plano → **Criar plano com o Coach (IA)**. O usuário responde objetivo, experiência, dias por semana, tempo por treino, onde treina e observações (lesões, foco). O GPT monta uma rotina por dia **usando só exercícios do catálogo**. O servidor confere cada id, limita séries/reps/descanso e só então mostra a proposta. "Salvar plano" cria as rotinas (com progressão) e já monta a semana.

Configuração (uma vez):
1. Crie uma chave em platform.openai.com → API keys.
2. Na Vercel: Project → Settings → Environment Variables → `OPENAI_API_KEY` = a chave (Production e Preview). Opcional: `OPENAI_MODEL` (padrão `gpt-6-luna`, o mais barato; `gpt-6.1-sol` caprecha mais e custa ~20x mais) e `OPENAI_REASONING` (`low` por padrão, mais rápido; `medium` pensa mais e demora mais).
3. Rode `supabase/migrations/004_coach.sql` no SQL Editor (limite de 5 planos por usuário a cada 24 h).
4. Faça um novo deploy (Deployments → Redeploy) para a Vercel ler a variável.

A chave fica **só no servidor** (`app/api/coach/route.js`), nunca vai para o aparelho. Custo aproximado: menos de US$ 0,002 por plano com `gpt-6-luna` (cerca de US$ 0,015 com `gpt-6.1-sol`). Lógica em `lib/coach.js`, com testes.

## Licença

O Moviq é software livre sob a **GNU AGPL v3.0** (`LICENSE`), porque usa o catálogo do openGym. Quem usa o app pela internet tem direito ao código-fonte: o link "Código-fonte" nas Configurações aponta para este repositório, que precisa estar **público** para cumprir a licença. As animações dos exercícios (Gym visual) **não** são AGPL; ver `THIRD_PARTY_NOTICES.md`.

Tecnologias: Next.js 14 + Supabase (autenticação e banco de dados) + Vercel (hospedagem).

---

## Passo 1 — Configurar o Supabase (banco de dados e login)

1. Acesse [supabase.com](https://supabase.com) e entre na sua conta.
2. Clique em **New Project**, dê um nome (ex: `meu-treino`), crie uma senha para o banco e escolha a região **South America (São Paulo)**.
3. Com o projeto criado, abra o **SQL Editor** (ícone de terminal no menu lateral).
4. Copie TODO o conteúdo do arquivo `supabase/schema.sql` deste projeto, cole no editor e clique em **Run**. Isso cria as tabelas (perfis, rotinas, treinos), a segurança (cada usuário só vê os próprios dados) e o gatilho que cria o perfil automaticamente no cadastro.
5. Vá em **Project Settings → API** (ou **Settings → Data API**) e copie:
   - **Project URL** (algo como `https://xxxx.supabase.co`)
   - **anon public key** (uma chave longa)
6. Opcional (recomendado para testar): em **Authentication → Sign In / Providers → Email**, desative **Confirm email** para não precisar confirmar e-mail a cada cadastro de teste.

## Passo 2 — Rodar no seu computador (opcional, para testar)

Pré-requisito: [Node.js](https://nodejs.org) instalado.

```bash
cd meu-treino
copy .env.local.example .env.local
```

Abra o arquivo `.env.local` e preencha com a URL e a chave anon copiadas no Passo 1. Depois:

```bash
npm install
npm run dev
```

Abra http://localhost:3000 — crie uma conta e teste.

## Passo 3 — Subir para o GitHub

1. Crie um repositório novo em [github.com/new](https://github.com/new) (ex: `meu-treino`). Pode ser privado.
2. No terminal, dentro da pasta `meu-treino`:

```bash
git init
git add .
git commit -m "Primeira versao do app Meu Treino"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/meu-treino.git
git push -u origin main
```

> Os GIFs comprimidos (~pasta `public/gifs`, ~170 MB) sobem junto. O primeiro push pode demorar alguns minutos.

## Passo 4 — Publicar na Vercel

1. Acesse [vercel.com](https://vercel.com) e entre com sua conta do GitHub.
2. Clique em **Add New → Project** e importe o repositório `meu-treino`.
3. Antes de clicar em Deploy, abra **Environment Variables** e adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` = a URL do seu projeto Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = a chave anon
4. Clique em **Deploy**. Em 1–2 minutos seu app estará no ar em `https://meu-treino-xxxx.vercel.app`.

## Passo 5 — Ajuste final no Supabase

No painel do Supabase, vá em **Authentication → URL Configuration** e coloque a URL da Vercel em **Site URL** (ex: `https://meu-treino-xxxx.vercel.app`). Isso garante que os links de confirmação de e-mail apontem para o app publicado.

---

## Dicas

- **Instalar como app no celular:** abra o site no Chrome/Safari do celular → menu → "Adicionar à tela de início".
- **Atualizar o app:** basta fazer `git add . && git commit -m "mudanca" && git push` — a Vercel publica automaticamente.
- Os GIFs originais (2,8 GB) não estão no repositório — aqui vai a versão comprimida em WebP (~15x menor, mesma animação).

## Estrutura de pastas

```
meu-treino/
├── app/                  # Páginas (Next.js App Router)
│   ├── login/            # Login e cadastro
│   ├── inicio/           # Aba Início (histórico)
│   ├── treino/           # Aba Treino (rotinas)
│   │   ├── nova/         # Criar/editar rotina
│   │   └── executar/     # Executar treino
│   ├── perfil/           # Aba Perfil
│   ├── redefinir-senha/  # Nova senha (link do e-mail)
│   └── api/keepalive/    # Mantém o Supabase ativo (cron diário)
├── components/           # BottomNav, AuthGuard, ExercisePicker, Dialog, ExerciseDetail...
├── data/exercises.json   # Catálogo com os 1.062 exercícios
├── lib/supabase.js       # Conexão com o Supabase
├── lib/i18n.js           # Traduções EN / PT / ES / FR
├── lib/activeWorkout.js  # Treino em andamento salvo no aparelho
├── public/gifs/          # GIFs comprimidos (WebP)
├── public/icon-*.png     # Ícones do app
├── vercel.json           # Agenda o keepalive diário
└── supabase/schema.sql   # Script do banco de dados
```
