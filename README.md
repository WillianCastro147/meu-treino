# Moviq

App web estilo Hevy para registrar treinos, **em inglês (idioma principal), português, espanhol e francês**, com 3 abas (Início, Treino e Perfil), 1.062 exercícios com GIFs animados (nomes nos 4 idiomas), login e dados na nuvem via Supabase.

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

## Estrutura

- **Accueil (Início)** — histórico de treinos com miniaturas dos exercícios, duração, séries e volume
- **Entraînement (Treino)** — criar/editar rotinas (séries, repetições e tempo de descanso) e executar treinos com cronômetro + descanso automático entre séries (com bipe e vibração)
- **Profil (Perfil)** — nome, peso, altura, IMC, estatísticas e logout

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
