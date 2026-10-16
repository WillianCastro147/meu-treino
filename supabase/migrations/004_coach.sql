-- ============================================================
-- MOVIQ - Coach com IA: registro de uso para o limite diário
-- Como usar: no painel do Supabase, abra "SQL Editor",
-- cole este arquivo inteiro e clique em "Run".
-- Pode rodar mais de uma vez sem problema.
-- ============================================================

create table if not exists public.coach_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists coach_usage_user_date on public.coach_usage (user_id, created_at desc);

-- Cada usuário só vê e registra o próprio uso (não pode apagar para burlar o limite)
alter table public.coach_usage enable row level security;

drop policy if exists "coach_usage_select" on public.coach_usage;
create policy "coach_usage_select" on public.coach_usage for select using (auth.uid() = user_id);

drop policy if exists "coach_usage_insert" on public.coach_usage;
create policy "coach_usage_insert" on public.coach_usage for insert with check (auth.uid() = user_id);
