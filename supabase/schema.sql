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
