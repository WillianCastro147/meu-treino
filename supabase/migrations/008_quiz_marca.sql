-- ============================================================
-- MOVIQ - Quiz feito com um e-mail, compra com outro
-- Como usar: no painel do Supabase, abra "SQL Editor",
-- cole este arquivo inteiro e clique em "Run".
-- Pode rodar mais de uma vez sem problema.
--
-- O problema: o app acha o quiz pelo e-mail da conta. Quem troca o e-mail no checkout
-- (ex.: digitou "0629...@gmail.com" no quiz e "629...@gmail.com" na Hotmart) entrava sem plano.
--
-- A solução: o quiz grava uma marca aleatória nas respostas (answers.marca) e num cookie
-- do navegador que vale para quiz.moviqgym.app e www.moviqgym.app. Se /preparando não acha
-- quiz pelo e-mail, chama adopt_quiz_lead(marca): o quiz daquela marca passa para o
-- e-mail da conta e o fluxo normal (get_my_quiz_lead / claim_quiz_lead) segue igual.
--
-- Travas (para um navegador compartilhado não pegar o quiz de outra pessoa):
--   - a conta não tem nenhum quiz com o próprio e-mail e nunca usou um quiz;
--   - o quiz não foi usado, é dos últimos 30 dias e foi feito antes de a conta ser criada;
--   - o e-mail do quiz não é de nenhuma conta do app.
-- ============================================================

create index if not exists quiz_leads_marca_idx on public.quiz_leads ((answers ->> 'marca'));

create or replace function public.adopt_quiz_lead(p_marca text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  e text := lower(auth.jwt() ->> 'email');
  criada timestamptz;
  alvo uuid;
begin
  if auth.uid() is null or e is null or p_marca is null or length(p_marca) < 16 or length(p_marca) > 64 then
    return false;
  end if;
  if exists (select 1 from public.quiz_leads where email = e or claimed_by = auth.uid()) then
    return false;
  end if;

  select u.created_at into criada from auth.users u where u.id = auth.uid();

  select q.id into alvo
  from public.quiz_leads q
  where q.answers ->> 'marca' = p_marca
    and q.claimed_at is null
    and q.created_at > now() - interval '30 days'
    and q.created_at <= coalesce(criada, now())
    and not exists (select 1 from auth.users u where lower(u.email) = q.email)
  order by q.created_at desc
  limit 1;

  if alvo is null then
    return false;
  end if;

  update public.quiz_leads
  set email = e, updated_at = now()
  where id = alvo and claimed_at is null;
  return found;
end;
$$;

revoke all on function public.adopt_quiz_lead(text) from public;
grant execute on function public.adopt_quiz_lead(text) to authenticated;
