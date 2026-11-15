-- ============================================================
-- MOVIQ - Quiz de entrada (anúncio > quiz > checkout > app)
-- Como usar: no painel do Supabase, abra "SQL Editor",
-- cole este arquivo inteiro e clique em "Run".
-- Pode rodar mais de uma vez sem problema.
--
-- Fluxo:
--   1. O quiz (/quiz, sem login) grava as respostas + nome + e-mail com save_quiz_lead().
--   2. A pessoa paga no checkout com o mesmo e-mail.
--   3. Ao entrar no app pela primeira vez, /preparando lê o quiz com get_my_quiz_lead()
--      (só o do e-mail da própria conta), monta o perfil e o plano, e marca com claim_quiz_lead().
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
