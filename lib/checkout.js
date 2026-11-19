// Cria a Checkout Session da Stripe. Usado pelo botão do quiz (/api/stripe/checkout) e pelo link de
// recuperação de quem deixou o Pix expirar ou abandonou o pagamento (/api/stripe/recuperar).
// Só servidor.
import {
  stripe,
  PLAN_PRICES,
  APP_URL,
  QUIZ_URL,
  PLANO_VITALICIO,
  VITALICIO_PRICE,
  VITALICIO_CENTAVOS,
  extrasAtivos,
  extraDoPlano,
  MARCA_POR_PLANO,
} from '@/lib/stripe';

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

// Parâmetros do anúncio que o quiz repassa: vão para os metadados da sessão e da assinatura na Stripe
// (é de lá que a Utmify lê a origem da venda).
export const TRACKING_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck', 'fbclid'];
export const trackingFrom = (obj = {}) =>
  Object.fromEntries(
    TRACKING_KEYS.filter((k) => typeof obj[k] === 'string' && obj[k].trim()).map((k) => [k, obj[k].trim().slice(0, 450)])
  );

export const planoValido = (plano) => plano === PLANO_VITALICIO || !!extraDoPlano(plano) || !!PLAN_PRICES[plano];

// plano: 12m|3m|1m|vitalicio|plano_alimentar|gerador_ia · email e nome do quiz · tracking: UTMs do anúncio
// extra: metadados a mais (ex.: { recuperacao: 'email', recuperado_de: 'cs_...' })
// Extra sozinho (plano alimentar, gerador de treino com IA) = oferta depois da compra / dentro do app;
// no vitalício os extras entram como itens opcionais (order bumps que a pessoa marca no pagamento).
// cancelUrl: para onde volta quem desiste (padrão: o quiz)
export async function criarSessaoCheckout({ plano, email, nome, tracking = {}, extra = {}, cancelUrl = QUIZ_URL }) {
  const avulso = extraDoPlano(plano); // extra comprado sozinho
  const vitalicio = plano === PLANO_VITALICIO || !!avulso; // os dois são pagamento único
  const price = vitalicio ? null : PLAN_PRICES[plano];
  const metadata = { plano, origem: 'quiz', ...trackingFrom(tracking), ...extra };
  const mail = String(email || '').trim().toLowerCase();
  // Nome do quiz: só na sessão (não na assinatura), para o link de acesso usar ele e não o nome do cartão
  const name = String(nome || '').trim().replace(/\s+/g, ' ').slice(0, 80);

  // Assinatura recorrente (planos de 12, 3 e 1 mês): só cartão/carteiras
  const assinatura = {
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    payment_method_collection: 'always', // só vale em mode "subscription"
    subscription_data: { metadata }, // também na assinatura (renovações carregam a origem)
  };
  // Acesso vitalício: pagamento único. Em mode "payment" a Stripe mostra o Pix (ativo no painel) além do cartão.
  const pagamentoUnico = {
    mode: 'payment',
    line_items: [
      avulso
        ? { price: avulso.price, quantity: 1 }
        : VITALICIO_PRICE
          ? { price: VITALICIO_PRICE, quantity: 1 } // preço avulso cadastrado na Stripe
          : {
              quantity: 1,
              price_data: {
                currency: 'brl',
                unit_amount: VITALICIO_CENTAVOS,
                product_data: { name: 'Moviq · Acesso vitalício', description: 'Pagamento único. Sem mensalidade.' },
              },
            },
    ],
    // Order bumps: os extras como itens opcionais no pagamento do acesso vitalício
    ...(!avulso && extrasAtivos().length ? { optional_items: extrasAtivos().map((e) => ({ price: e.price, quantity: 1 })) } : {}),
    customer_creation: 'always',
    payment_intent_data: { metadata }, // a origem também no pagamento (Utmify)
  };

  const params = {
    // Configurado no Checkout Studio
    ui_mode: 'hosted_page',
    billing_address_collection: 'auto',
    // Sem telefone: campo obrigatório na hora de pagar é atrito (vendas pararam quando foi ligado). Recuperação segue por e-mail
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    allow_promotion_codes: false,
    submit_type: 'auto',
    integration_identifier: 'hosted_mobile_app_0001',
    origin_context: 'mobile_app',

    ...(vitalicio ? pagamentoUnico : assinatura),
    success_url: `${APP_URL}/bem-vindo?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,

    // E-mail do quiz já preenchido: é por ele que o app libera o acesso e acha o plano do quiz
    ...(EMAIL_RE.test(mail) && mail.length <= 254 ? { customer_email: mail } : {}),
    metadata: name ? { ...metadata, nome: name } : metadata,
  };
  // Nome e ícone desta oferta (lib/stripe.js); sem marca própria, vale a da conta Stripe
  const marca = MARCA_POR_PLANO[plano];

  // Extras que nunca podem impedir o pagamento de abrir: se a Stripe recusar a marca (ícone fora do ar)
  // ou o order bump, tenta de novo sem eles.
  let tentativa = marca ? { ...params, branding_settings: marca } : params;
  for (let i = 0; i < 3; i++) {
    try {
      return await stripe.checkout.sessions.create(tentativa);
    } catch (e) {
      const onde = `${e.param || ''} ${e.message || ''}`;
      const extra = ['branding_settings', 'optional_items'].find((k) => tentativa[k] && onde.includes(k));
      if (!extra) throw e;
      console.error(`Stripe checkout: ${extra} recusado, seguindo sem ele:`, e.message);
      const { [extra]: _fora, ...resto } = tentativa;
      tentativa = resto;
    }
  }
  return stripe.checkout.sessions.create(tentativa);
}
