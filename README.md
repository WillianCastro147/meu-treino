# Moviq

App web estilo Hevy para registrar treinos, **em francês**, com 3 abas (Accueil, Entraînement e Profil), 1.062 exercícios com GIFs animados (nomes traduzidos para o francês), login e dados na nuvem via Supabase.

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
│   └── perfil/           # Aba Perfil
├── components/           # BottomNav, AuthGuard, ExercisePicker
├── data/exercises.json   # Catálogo com os 1.062 exercícios
├── lib/supabase.js       # Conexão com o Supabase
├── public/gifs/          # GIFs comprimidos (WebP)
└── supabase/schema.sql   # Script do banco de dados
```
