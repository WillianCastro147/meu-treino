// =====================================================================
// CONFIGURAÇÃO DO QUIZ MOVIQ
// =====================================================================
window.MOVIQ_CONFIG = {
  // Supabase → Project Settings → API (ou "API Keys"):
  //   "Project URL"
  SUPABASE_URL: 'https://ozjqfkukzqopwqhqjytd.supabase.co',
  //   chave pública: "anon public" (começa com eyJ...) ou "publishable" (começa com sb_publishable_...)
  //   NUNCA coloque aqui a chave "service_role" / "secret".
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96anFma3VrenFvcHdxaHFqeXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MzI5NDQsImV4cCI6MjEwMDUwODk0NH0.4h__tLjeOFjOkHqNBidrUNFc38UGlnU4zkrPtvIIIic',

  // ------------------------------------------------------------------
  // PAGAMENTO (Stripe Checkout): o botão "Garantir meu plano" envia o plano e o e-mail para o app,
  // que cria a página de pagamento da Stripe e leva a pessoa até ela.
  // O quiz roda no mesmo projeto do app (quiz.moviqgym.app), então o caminho é relativo.
  // ------------------------------------------------------------------
  STRIPE_CHECKOUT_URL: '/api/stripe/checkout',

  // PLANOS (tela final, depois do e-mail)
  // meses: 12, 3 ou 1 (cada um ligado a um preço na Stripe: STRIPE_PRICE_12M, STRIPE_PRICE_3M, STRIPE_PRICE_1M na Vercel)
  // total: preço cobrado no período (R$), SÓ PARA MOSTRAR na tela: precisa ser igual ao preço cadastrado na Stripe
  // destaque: true no plano "MAIS ESCOLHIDO" (vem selecionado)
  // O "por mês" e o "Economize X%" são calculados sozinhos (comparando com o plano de 1 mês).
  // Preços iguais aos cadastrados na Stripe (modo real) em 16/11/2026:
  //   12m price_1UcY54QfnCdLHlDYGt4UuMek (R$ 119,99/ano) · 3m price_1UcYX5QfnCdLHlDY3WslStoE (R$ 89,99 a cada 3 meses)
  //   1m price_1UcYXdQfnCdLHlDYrGJf9rDq (R$ 34,99/mês)
  PLANOS: [
    { meses: 12, total: 119.99, destaque: true },
    { meses: 3, total: 89.99 },
    { meses: 1, total: 34.99 },
  ],

  // Garantia mostrada acima dos planos (0 = esconde)
  GARANTIA_DIAS: 7,

  // Textos legais abaixo do botão (deixe '' para esconder o link)
  AVISO_ASSINATURA: 'Assinatura recorrente, renovada automaticamente. Cancele quando quiser.',
  TERMOS_URL: '',
  PRIVACIDADE_URL: '',
};
