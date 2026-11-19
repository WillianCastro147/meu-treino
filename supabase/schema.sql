-- ============================================================
-- MEU TREINO - Schema do banco de dados Supabase
-- Como usar: no painel do Supabase, abra "SQL Editor",
-- cole este arquivo inteiro e clique em "Run".
-- ============================================================

-- 1) Tabela de perfis (dados do usuário)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  weight_kg numeric,
  height_cm numeric,
  updated_at timestamptz default now()
);

-- 2) Tabela de rotinas de treino
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  exercises jsonb not null default '[]',
  created_at timestamptz default now()
);

-- 3) Tabela de treinos realizados (histórico)
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  started_at timestamptz not null default now(),
  duration_min integer not null default 0,
  exercises jsonb not null default '[]',
  created_at timestamptz default now()
);

create index if not exists workouts_user_date on public.workouts (user_id, started_at desc);
create index if not exists routines_user on public.routines (user_id, created_at desc);

-- 4) Segurança (RLS): cada usuário só vê e altera os próprios dados
alter table public.profiles enable row level security;
alter table public.routines enable row level security;
alter table public.workouts enable row level security;

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

drop policy if exists "routines_all" on public.routines;
create policy "routines_all" on public.routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workouts_all" on public.workouts;
create policy "workouts_all" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5) Cria o perfil automaticamente quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Fase 1 (igual a migrations/002_fase1.sql)
-- ============================================================

-- 6) Meta de peso no perfil
alter table public.profiles add column if not exists goal_weight_kg numeric;

-- 7) Registros de peso corporal (um por dia)
create table if not exists public.body_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric not null check (weight_kg > 0 and weight_kg < 700),
  created_at timestamptz default now(),
  unique (user_id, measured_on)
);

create index if not exists body_weights_user_date on public.body_weights (user_id, measured_on desc);

-- 8) Segurança: cada usuário só vê e altera os próprios registros
alter table public.body_weights enable row level security;

drop policy if exists "body_weights_all" on public.body_weights;
create policy "body_weights_all" on public.body_weights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 9) Faltava: apagar o próprio perfil (a conta já apaga em cascata)
drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles for delete using (auth.uid() = id);

-- ============================================================
-- Fase 3 (igual a migrations/003_plano.sql)
-- ============================================================

alter table public.profiles add column if not exists plan jsonb;
alter table public.workouts add column if not exists routine_id uuid references public.routines (id) on delete set null;
create index if not exists workouts_routine on public.workouts (routine_id);

-- ============================================================
-- Coach com IA (igual a migrations/004_coach.sql)
-- ============================================================

create table if not exists public.coach_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists coach_usage_user_date on public.coach_usage (user_id, created_at desc);
alter table public.coach_usage enable row level security;
drop policy if exists "coach_usage_select" on public.coach_usage;
create policy "coach_usage_select" on public.coach_usage for select using (auth.uid() = user_id);
drop policy if exists "coach_usage_insert" on public.coach_usage;
create policy "coach_usage_insert" on public.coach_usage for insert with check (auth.uid() = user_id);

-- ============================================================
-- Quiz de entrada (igual a migrations/005_quiz.sql)
-- ============================================================
create table if not exists public.quiz_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,              -- sempre em minúsculas
  name text,
  answers jsonb not null default '{}',
  marketing_opt_in boolean not null default false,
  utm jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz
);

-- Sem políticas: ninguém lê nem grava a tabela direto pelo app.
-- Todo acesso passa pelas três funções abaixo.
alter table public.quiz_leads enable row level security;

-- 1) Grava (ou atualiza) as respostas do quiz. Chamada sem login.
create or replace function public.save_quiz_lead(
  p_email text,
  p_name text,
  p_answers jsonb,
  p_marketing boolean default false,
  p_utm jsonb default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  e text := lower(trim(p_email));
begin
  if e is null or length(e) > 254 or e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers) > 8000 then
    raise exception 'invalid_answers';
  end if;

  insert into public.quiz_leads (email, name, answers, marketing_opt_in, utm)
  values (
    e,
    left(trim(coalesce(p_name, '')), 80),
    p_answers,
    coalesce(p_marketing, false),
    case when p_utm is not null and jsonb_typeof(p_utm) = 'object' and pg_column_size(p_utm) <= 2000 then p_utm end
  )
  on conflict (email) do update
    set name = excluded.name,
        answers = excluded.answers,
        marketing_opt_in = excluded.marketing_opt_in,
        utm = coalesce(excluded.utm, public.quiz_leads.utm),
        updated_at = now()
    where public.quiz_leads.claimed_at is null;  -- depois de usado no app, não muda mais
end;
$$;

-- 2) Quiz ainda não usado do e-mail da conta logada
create or replace function public.get_my_quiz_lead()
returns table (id uuid, name text, answers jsonb)
language sql
stable
security definer set search_path = public
as $$
  select q.id, q.name, q.answers
  from public.quiz_leads q
  where q.email = lower(auth.jwt() ->> 'email')
    and q.claimed_at is null
  limit 1;
$$;

-- 3) Marca o quiz como usado por esta conta
create or replace function public.claim_quiz_lead(p_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.quiz_leads
  set claimed_by = auth.uid(), claimed_at = now()
  where id = p_id
    and email = lower(auth.jwt() ->> 'email')
    and claimed_at is null;
$$;

revoke all on function public.save_quiz_lead(text, text, jsonb, boolean, jsonb) from public;
revoke all on function public.get_my_quiz_lead() from public;
revoke all on function public.claim_quiz_lead(uuid) from public;
grant execute on function public.save_quiz_lead(text, text, jsonb, boolean, jsonb) to anon, authenticated;
grant execute on function public.get_my_quiz_lead() to authenticated;
grant execute on function public.claim_quiz_lead(uuid) to authenticated;


-- ============================================================
-- Assinaturas Stripe (igual a migrations/006_assinaturas.sql)
-- ============================================================
create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  email text not null,                          -- sempre em minúsculas
  status text not null,                         -- da Stripe (active, trialing, past_due, canceled, unpaid...) ou 'cortesia'
  plano text,                                   -- ex.: "3 month" (intervalo do preço na Stripe)
  stripe_price_id text,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assinaturas_email_idx on public.assinaturas (email);

-- Vendas pela Hotmart (igual a migrations/007_hotmart.sql)
alter table public.assinaturas add column if not exists gateway text not null default 'stripe';
alter table public.assinaturas add column if not exists hotmart_transacao text;
alter table public.assinaturas add column if not exists hotmart_assinante text;
create unique index if not exists assinaturas_hotmart_transacao_key on public.assinaturas (hotmart_transacao);

-- Sem políticas: ninguém lê nem grava direto pelo app. O app só usa tem_acesso().
alter table public.assinaturas enable row level security;

-- A conta logada tem acesso?
--   active / trialing: sim
--   past_due: sim (a Stripe ainda está tentando cobrar)
--   cortesia: sim (liberado à mão: você, testes, contas antigas)
--   canceled / unpaid / incomplete...: não
--   (exceto assinatura da Hotmart cancelada: vale até o fim do período pago)
create or replace function public.tem_acesso()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.assinaturas a
    where a.email = lower(auth.jwt() ->> 'email')
      and (
        a.status in ('active', 'trialing', 'past_due', 'cortesia')
        or (a.gateway = 'hotmart' and a.status = 'canceled' and a.current_period_end > now())
      )
  );
$$;

revoke all on function public.tem_acesso() from public;
grant execute on function public.tem_acesso() to authenticated;
