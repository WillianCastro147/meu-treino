-- ============================================================
-- MOVIQ - Fase 3: plano semanal / rotação
-- Como usar: no painel do Supabase, abra "SQL Editor",
-- cole este arquivo inteiro e clique em "Run".
-- Pode rodar mais de uma vez sem problema.
-- ============================================================

-- 1) Plano do usuário: { mode: 'week' | 'rotation', week: { "1": routineId, ... }, rotation: [routineId, ...] }
alter table public.profiles add column if not exists plan jsonb;

-- 2) Rotina de origem de cada treino (para saber qual é a próxima da rotação)
alter table public.workouts add column if not exists routine_id uuid references public.routines (id) on delete set null;
create index if not exists workouts_routine on public.workouts (routine_id);
