-- ============================================================
-- MOVIQ - Fase 1: peso corporal e meta de peso
-- Como usar: no painel do Supabase, abra "SQL Editor",
-- cole este arquivo inteiro e clique em "Run".
-- Pode rodar mais de uma vez sem problema.
-- ============================================================

-- 1) Meta de peso no perfil
alter table public.profiles add column if not exists goal_weight_kg numeric;

-- 2) Registros de peso corporal (um por dia)
create table if not exists public.body_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric not null check (weight_kg > 0 and weight_kg < 700),
  created_at timestamptz default now(),
  unique (user_id, measured_on)
);

create index if not exists body_weights_user_date on public.body_weights (user_id, measured_on desc);

-- 3) Segurança: cada usuário só vê e altera os próprios registros
alter table public.body_weights enable row level security;

drop policy if exists "body_weights_all" on public.body_weights;
create policy "body_weights_all" on public.body_weights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) Faltava: apagar o próprio perfil (a conta já apaga em cascata)
drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles for delete using (auth.uid() = id);
