// Reembolso e contestação na Stripe: o que uma compra de pagamento único liberou e o que tirar.
// Só regras (sem Stripe nem banco), para o webhook (app/api/stripe/webhook) e os testes.

// O Premium (pop-up do quiz, R$ 57) libera o app e os dois extras de uma vez
export const PLANOS_DO_PREMIUM = ['vitalicio', 'plano_alimentar', 'gerador_ia'];

// Planos que a compra liberou.
//   plano:  metadata.plano da Checkout Session ('vitalicio', 'premium', 'plano_alimentar', 'gerador_ia')
//   itens:  [{ price, amount_total }] da sessão (listLineItems)
//   extras: [{ plano, price }] dos extras ativos (lib/stripe.js extrasAtivos)
// Extra comprado sozinho libera só ele; o Premium libera os três; o vitalício libera o app e os extras
// marcados como order bump.
export function planosDaCompra({ plano, itens = [], extras = [] }) {
  if (plano === 'premium') return [...PLANOS_DO_PREMIUM];
  const avulso = extras.find((e) => e.plano === plano);
  if (avulso) return [avulso.plano];
  const precos = new Set(itens.map((i) => i.price));
  return ['vitalicio', ...extras.filter((e) => precos.has(e.price)).map((e) => e.plano)];
}

// Planos a tirar num reembolso.
//   total:       valor cobrado (centavos)
//   reembolsado: valor já devolvido (centavos, acumulado)
// Reembolso total tira tudo o que a compra liberou. Parcial só tira o que dá para saber com certeza:
// um order bump cujo valor bate com o devolvido, ou todos os bumps juntos. Fora disso, devolve [] (conferir à mão).
export function planosDoReembolso({ plano, itens = [], extras = [], total, reembolsado }) {
  const todos = planosDaCompra({ plano, itens, extras });
  if (!(reembolsado > 0)) return [];
  if (reembolsado >= total) return todos;
  const bumps = itens
    .map((i) => ({ plano: extras.find((e) => e.price === i.price)?.plano, valor: i.amount_total }))
    .filter((b) => b.plano && todos.includes(b.plano) && b.plano !== plano);
  const um = bumps.find((b) => b.valor === reembolsado);
  if (um) return [um.plano];
  if (bumps.length > 1 && bumps.reduce((s, b) => s + b.valor, 0) === reembolsado) return bumps.map((b) => b.plano);
  return [];
}
