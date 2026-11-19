// Plano alimentar do Moviq (produto extra: order bump no checkout e oferta depois da compra).
// Funções puras, testadas em lib/nutricao.test.mjs. A página é app/alimentacao e os dados vêm de /api/nutricao.
//
// Como calcula (estimativa geral, não substitui nutricionista):
//   gasto basal: Mifflin-St Jeor · atividade pelos dias de treino · ajuste pelo objetivo do quiz
//   proteína por kg (peso de referência, que limita o IMC em 27 para quem está bem acima do peso)
//   gordura: o maior entre 0,8 g/kg e 25% das calorias · carboidrato: o restante

const IDADE = { '18–24': 21, '25–34': 30, '35–44': 40, '45–54': 50, '55+': 60 };
const ATIVIDADE = (dias) => {
  const d = Math.round(Number(dias) || 3);
  if (d <= 2) return 1.375;
  if (d === 3) return 1.45;
  if (d === 4) return 1.5;
  if (d === 5) return 1.55;
  return 1.6;
};
const OBJETIVO = {
  massa: { fator: 1.1, proteina: 2.0, nome: 'ganhar massa muscular' },
  gordura: { fator: 0.8, proteina: 2.0, nome: 'perder gordura' },
  definir: { fator: 0.9, proteina: 2.0, nome: 'definir o corpo' },
  forca: { fator: 1.05, proteina: 1.8, nome: 'ganhar força' },
  saude: { fator: 1.0, proteina: 1.6, nome: 'ter mais saúde e disposição' },
};
const MINIMO = { f: 1300, m: 1600 };

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const arred = (v, passo) => Math.round(v / passo) * passo;

// Metas diárias a partir das respostas do quiz (sexo, idade, altura, peso, dias, objetivo)
export function calcularMetas(r = {}) {
  const peso = num(r.peso);
  const altura = num(r.altura);
  if (!peso || !altura) return null;
  const idade = IDADE[r.idade] || num(r.idade) || 30;
  const sexo = r.sexo === 'f' || r.sexo === 'm' ? r.sexo : null;
  const obj = OBJETIVO[r.objetivo] || OBJETIVO.saude;

  const basal = 10 * peso + 6.25 * altura - 5 * idade + (sexo === 'm' ? 5 : sexo === 'f' ? -161 : -78);
  const gasto = basal * ATIVIDADE(r.dias);
  const minimo = Math.max(MINIMO[sexo || 'f'], basal);
  const kcal = arred(Math.max(gasto * obj.fator, minimo), 50);

  const h = altura / 100;
  const imc = peso / (h * h);
  const pesoRef = imc > 27 ? 27 * h * h : peso;
  const proteina = Math.round(obj.proteina * pesoRef);
  const gordura = Math.round(Math.max(0.8 * pesoRef, (0.25 * kcal) / 9));
  const carboidrato = Math.max(0, Math.round((kcal - proteina * 4 - gordura * 9) / 4));
  const agua = Math.round((peso * 35) / 100) / 10; // litros, 35 ml por kg

  return {
    kcal,
    proteina,
    carboidrato,
    gordura,
    agua,
    objetivo: obj.nome,
    gastoEstimado: arred(gasto, 50),
    imc: Math.round(imc * 10) / 10,
  };
}

// Alimentos: kcal por grama (g/ml) ou por unidade (unid). Valores médios de tabelas brasileiras (TACO).
export const ALIMENTOS = {
  arroz: { nome: 'Arroz cozido', kcal: 1.28, un: 'g' },
  feijao: { nome: 'Feijão cozido', kcal: 0.76, un: 'g' },
  frango: { nome: 'Peito de frango grelhado', kcal: 1.59, un: 'g' },
  patinho: { nome: 'Carne moída (patinho)', kcal: 2.19, un: 'g' },
  peixe: { nome: 'Tilápia grelhada', kcal: 1.28, un: 'g' },
  ovo: { nome: 'Ovo', kcal: 72, un: 'unid' },
  pao: { nome: 'Pão francês', kcal: 150, un: 'unid' },
  integral: { nome: 'Pão integral', kcal: 60, un: 'unid' },
  tapioca: { nome: 'Goma de tapioca', kcal: 2.4, un: 'g' },
  aveia: { nome: 'Aveia em flocos', kcal: 3.94, un: 'g' },
  banana: { nome: 'Banana', kcal: 70, un: 'unid' },
  fruta: { nome: 'Fruta (maçã, pera ou laranja)', kcal: 80, un: 'unid' },
  leite: { nome: 'Leite desnatado', kcal: 0.35, un: 'ml' },
  iogurte: { nome: 'Iogurte natural', kcal: 0.51, un: 'g' },
  queijo: { nome: 'Queijo minas frescal', kcal: 2.64, un: 'g' },
  amendoim: { nome: 'Pasta de amendoim', kcal: 5.88, un: 'g' },
  batataDoce: { nome: 'Batata-doce cozida', kcal: 0.77, un: 'g' },
  mandioca: { nome: 'Mandioca cozida', kcal: 1.25, un: 'g' },
  macarrao: { nome: 'Macarrão cozido', kcal: 1.58, un: 'g' },
  azeite: { nome: 'Azeite', kcal: 8.84, un: 'g' },
  salada: { nome: 'Salada e legumes', kcal: 0, un: 'livre' },
};

// Refeições: parte das calorias do dia e opções (quantidades de referência, ajustadas para cada pessoa)
export const REFEICOES = [
  {
    id: 'cafe',
    nome: 'Café da manhã',
    parte: 0.25,
    opcoes: [
      [['pao', 1], ['ovo', 2], ['queijo', 30], ['fruta', 1]],
      [['tapioca', 60], ['ovo', 2], ['banana', 1]],
      [['iogurte', 170], ['aveia', 40], ['banana', 1], ['amendoim', 15]],
    ],
  },
  {
    id: 'lanche1',
    nome: 'Lanche da manhã',
    parte: 0.1,
    opcoes: [
      [['fruta', 1], ['amendoim', 10]],
      [['iogurte', 170], ['fruta', 1]],
    ],
  },
  {
    id: 'almoco',
    nome: 'Almoço',
    parte: 0.3,
    opcoes: [
      [['arroz', 150], ['feijao', 100], ['frango', 130], ['salada', 0], ['azeite', 5]],
      [['arroz', 150], ['feijao', 100], ['patinho', 110], ['salada', 0]],
      [['batataDoce', 200], ['peixe', 150], ['salada', 0], ['azeite', 8]],
    ],
  },
  {
    id: 'lanche2',
    nome: 'Lanche da tarde',
    parte: 0.15,
    opcoes: [
      [['integral', 2], ['ovo', 2]],
      [['leite', 250], ['aveia', 30], ['banana', 1]],
      [['tapioca', 40], ['queijo', 40]],
    ],
  },
  {
    id: 'jantar',
    nome: 'Jantar',
    parte: 0.2,
    opcoes: [
      [['arroz', 100], ['feijao', 80], ['frango', 120], ['salada', 0]],
      [['macarrao', 130], ['patinho', 100], ['salada', 0]],
      [['mandioca', 150], ['ovo', 3], ['salada', 0]],
    ],
  },
];

const kcalItem = ([id, qtd]) => (ALIMENTOS[id]?.kcal || 0) * qtd;

function ajustarQtd(id, qtd) {
  const a = ALIMENTOS[id];
  if (a.un === 'livre') return 0;
  if (id === 'ovo') return Math.max(1, Math.round(qtd));
  if (a.un === 'unid') return Math.max(0.5, Math.round(qtd * 2) / 2);
  if (id === 'azeite' || id === 'amendoim') return Math.max(5, arred(qtd, 5));
  return Math.max(10, arred(qtd, 10));
}

export function textoQtd(id, qtd) {
  const a = ALIMENTOS[id];
  if (a.un === 'livre') return 'à vontade';
  if (a.un === 'unid') {
    const [um, varios] = id === 'integral' ? ['fatia', 'fatias'] : ['unidade', 'unidades'];
    return `${String(qtd).replace('.', ',')} ${qtd <= 1 ? um : varios}`;
  }
  if (id === 'azeite') {
    const c = Math.max(1, Math.round(qtd / 8));
    return `${qtd} g (${c} ${c === 1 ? 'colher' : 'colheres'} de sopa)`;
  }
  return `${qtd} ${a.un}`;
}

// Cardápio do dia: cada refeição com as opções e as quantidades ajustadas às calorias da pessoa
export function montarCardapio(metas) {
  if (!metas) return [];
  return REFEICOES.map((r) => {
    const alvo = metas.kcal * r.parte;
    const opcoes = r.opcoes.map((itens) => {
      const base = itens.reduce((s, it) => s + kcalItem(it), 0);
      const fator = Math.min(2.5, Math.max(0.5, alvo / base));
      const ajustados = itens.map(([id, q]) => [id, ajustarQtd(id, q * fator)]);
      return {
        kcal: arred(ajustados.reduce((s, it) => s + kcalItem(it), 0), 10),
        itens: ajustados.map(([id, q]) => ({ id, nome: ALIMENTOS[id].nome, qtd: textoQtd(id, q) })),
      };
    });
    return { id: r.id, nome: r.nome, kcal: arred(alvo, 10), opcoes };
  });
}

export const DICAS = [
  'Escolha uma opção em cada refeição. Pode repetir a mesma todos os dias ou ir alternando.',
  'Pese os alimentos nas primeiras semanas. Depois você aprende a medir no olho.',
  'Salada e legumes à vontade no almoço e no jantar: quase não têm calorias e dão saciedade.',
  'Pode trocar frango, patinho, peixe e ovos entre si. Arroz, batata-doce, mandioca e macarrão também.',
  'Beba água ao longo do dia. A meta aparece no topo.',
  'Pese-se uma vez por semana, no mesmo horário. Se em 3 semanas o peso não andar na direção do objetivo, ajuste as porções em cerca de 10%.',
];

export const AVISO_SAUDE =
  'Este plano é uma estimativa geral feita a partir das suas respostas e não substitui a orientação de um nutricionista. Se você tem diabetes, doença renal, está grávida, amamentando ou tem qualquer condição de saúde, consulte um profissional antes de mudar a alimentação.';
