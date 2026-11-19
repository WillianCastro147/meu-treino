// Hotmart: leitura dos avisos (webhook versão 2.0.0) e qual produto libera o quê.
// Sem dependências (dá para testar com node --test). Só servidor: usado por app/api/hotmart/webhook.
//
// Variáveis na Vercel:
//   HOTMART_HOTTOK                     código de verificação (Hotmart > Ferramentas > Webhook > hottok)
//   HOTMART_PRODUTO_VITALICIO          ID do produto do acesso vitalício (o app)
//   HOTMART_PRODUTO_PLANO_ALIMENTAR    ID do produto do plano alimentar (order bump), opcional
//   HOTMART_PRODUTO_GERADOR_IA         ID do produto do gerador de treino com IA (order bump), opcional
//   HOTMART_PRODUTO_ASSINATURA         ID do produto de assinatura (planos 12m/3m/1m), opcional
// Cada variável aceita mais de um ID separado por vírgula (ex.: produto antigo e novo).

import { timingSafeEqual } from 'node:crypto';

// Plano gravado na tabela assinaturas para cada produto (os mesmos nomes da Stripe)
export const PLANOS_HOTMART = {
  HOTMART_PRODUTO_VITALICIO: 'vitalicio',
  HOTMART_PRODUTO_PLANO_ALIMENTAR: 'plano_alimentar',
  HOTMART_PRODUTO_GERADOR_IA: 'gerador_ia',
  HOTMART_PRODUTO_ASSINATURA: 'assinatura',
};

// IDs dos produtos já cadastrados na Hotmart (não são secretos). Valem quando a variável da Vercel não existe;
// com a variável, vale o que estiver nela.
export const PRODUTOS_PADRAO = {
  HOTMART_PRODUTO_VITALICIO: '9022148', // Moviq: App de Treino Personalizado (R$ 37,00)
  HOTMART_PRODUTO_PLANO_ALIMENTAR: '9022748', // Moviq: Plano Alimentar (R$ 19,90, order bump)
  HOTMART_PRODUTO_GERADOR_IA: '9022760', // Moviq: Gerador de Treino com IA (R$ 27,90, order bump)
};

// ID do produto na Hotmart -> plano do app
export function produtosHotmart(env = process.env, padrao = PRODUTOS_PADRAO) {
  const map = {};
  for (const [variavel, plano] of Object.entries(PLANOS_HOTMART)) {
    String(env[variavel] || padrao[variavel] || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((id) => (map[id] = plano));
  }
  return map;
}

// Compara o hottok recebido com o da Vercel sem vazar o tamanho/conteúdo pelo tempo de resposta
export function hottokValido(recebido, esperado = process.env.HOTMART_HOTTOK) {
  if (!esperado || !recebido) return false;
  const a = Buffer.from(String(recebido));
  const b = Buffer.from(String(esperado));
  return a.length === b.length && timingSafeEqual(a, b);
}

// Datas da Hotmart vêm em milissegundos
const iso = (ms) => (Number(ms) > 0 ? new Date(Number(ms)).toISOString() : null);
const limpo = (v) => String(v || '').trim();

// O que cada evento faz com o acesso
//   liberar: compra aprovada (inclui renovação de assinatura)
//   cortar:  dinheiro devolvido ou não recebido (status gravado na linha da compra)
//   cancelar_assinatura: assinatura cancelada, vale até a próxima cobrança
export const ACAO_DO_EVENTO = {
  PURCHASE_APPROVED: { acao: 'liberar' },
  PURCHASE_COMPLETE: { acao: 'liberar' }, // fim do prazo de garantia: só confirma
  PURCHASE_REFUNDED: { acao: 'cortar', status: 'refunded' },
  PURCHASE_CHARGEBACK: { acao: 'cortar', status: 'chargeback' },
  PURCHASE_CANCELED: { acao: 'cortar', status: 'canceled' },
  SUBSCRIPTION_CANCELLATION: { acao: 'cancelar_assinatura' },
};

// Normaliza o aviso da Hotmart. Devolve null se não for um aviso que o app usa.
export function lerAviso(body, produtos = produtosHotmart()) {
  const evento = limpo(body?.event);
  const regra = ACAO_DO_EVENTO[evento];
  if (!regra) return null;
  const d = body?.data || {};
  const produtoId = limpo(d.product?.id);
  const plano = produtos[produtoId] || null;

  if (regra.acao === 'cancelar_assinatura') {
    return {
      evento,
      ...regra,
      produtoId,
      plano,
      email: limpo(d.subscriber?.email).toLowerCase(),
      nome: limpo(d.subscriber?.name),
      assinante: limpo(d.subscriber?.code) || null,
      fimDoPeriodo: iso(d.date_next_charge),
    };
  }

  const compra = d.purchase || {};
  return {
    evento,
    ...regra,
    produtoId,
    plano,
    transacao: limpo(compra.transaction) || null,
    email: limpo(d.buyer?.email).toLowerCase(),
    nome: limpo(d.buyer?.name),
    assinante: limpo(d.subscription?.subscriber?.code) || null,
    // renovação de assinatura chega como uma nova compra aprovada com recurrence_number > 1
    renovacao: Number(compra.recurrence_number) > 1,
    orderBump: !!compra.order_bump?.is_order_bump,
    fimDoPeriodo: iso(compra.date_next_charge),
    origem: {
      src: limpo(compra.origin?.src),
      sck: limpo(compra.origin?.sck),
      xcod: limpo(compra.origin?.xcod),
    },
  };
}
