-- ============================================================
-- MOVIQ - Assinaturas (Stripe)
-- Como usar: no painel do Supabase, abra "SQL Editor",
-- cole este arquivo inteiro e clique em "Run".
-- Pode rodar mais de uma vez sem problema.
--
-- Fluxo:
--   1. A pessoa assina pelo Payment Link da Stripe (a partir do quiz).
--   2. A Stripe avisa o app em /api/stripe/webhook, que grava/atualiza a linha aqui
--      (só o servidor grava, com a chave service_role).
--   3. O app pergunta tem_acesso() para liberar ou não o uso (o bloqueio só vale com
--      NEXT_PUBLIC_EXIGIR_ASSINATURA=1 na Vercel).
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

-- Sem políticas: ninguém lê nem grava direto pelo app. O app só usa tem_acesso().
alter table public.assinaturas enable row level security;

-- A conta logada tem acesso?
--   active / trialing: sim
--   past_due: sim (a Stripe ainda está tentando cobrar)
--   cortesia: sim (liberado à mão: você, testes, contas antigas)
--   canceled / unpaid / incomplete...: não
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
      and a.status in ('active', 'trialing', 'past_due', 'cortesia')
  );
$$;

revoke all on function public.tem_acesso() from public;
grant execute on function public.tem_acesso() to authenticated;

-- ------------------------------------------------------------
-- LIBERAR CONTAS À MÃO (opcional; rode separado quando precisar)
--
-- Uma conta:
--   insert into public.assinaturas (email, status) values ('alguem@email.com', 'cortesia');
--
-- Todas as contas que já existem hoje (antes de ligar o bloqueio):
--   insert into public.assinaturas (email, status)
--   select lower(u.email), 'cortesia' from auth.users u
--   where u.email is not null
--     and not exists (select 1 from public.assinaturas a where a.email = lower(u.email));
--
-- Tirar a cortesia:
--   delete from public.assinaturas where email = 'alguem@email.com' and status = 'cortesia';
-- ------------------------------------------------------------
