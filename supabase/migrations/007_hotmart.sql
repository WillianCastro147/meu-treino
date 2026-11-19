-- ============================================================
-- MOVIQ - Vendas pela Hotmart (além da Stripe)
-- Como usar: no painel do Supabase, abra "SQL Editor",
-- cole este arquivo inteiro e clique em "Run".
-- Pode rodar mais de uma vez sem problema. Precisa da migração 006.
--
-- Fluxo:
--   1. O quiz leva a pessoa para o checkout da Hotmart (GATEWAY: 'hotmart' em public/quiz-site/config.js).
--   2. A Hotmart avisa o app em /api/hotmart/webhook, que grava/atualiza a linha na mesma tabela
--      assinaturas (gateway = 'hotmart'). O acesso continua sendo liberado pelo e-mail, via tem_acesso().
-- ============================================================

alter table public.assinaturas add column if not exists gateway text not null default 'stripe';
-- Código da última compra aprovada na Hotmart (ex.: HP1234567890): reembolso e chargeback acham a linha por ele
alter table public.assinaturas add column if not exists hotmart_transacao text;
-- Código do assinante na Hotmart (só em produto de assinatura)
alter table public.assinaturas add column if not exists hotmart_assinante text;

create unique index if not exists assinaturas_hotmart_transacao_key on public.assinaturas (hotmart_transacao);

-- Mesma regra da 006, mais uma: assinatura da Hotmart cancelada continua valendo até o fim do período pago
-- (na Stripe isso já vem pronto: a assinatura fica 'active' até o fim do período).
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
