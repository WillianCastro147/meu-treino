// Quiz de entrada do Moviq (anúncio > quiz > checkout > app).
// Perguntas, imagens e a tradução das respostas para o Coach com IA (lib/coach.js).
// Funções puras, testadas em lib/quiz.test.mjs.
// A TELA DO QUIZ é a página estática public/quiz-site (subdomínio quiz.moviqgym.app, ver next.config.mjs)
// (pasta quiz-hostinger/, arquivo quiz-dados.js, com as mesmas perguntas). Este arquivo é usado
// pela tela /preparando para ler as respostas. Ao mudar uma pergunta, mude nos dois lugares.
import { EQUIPMENT_PRESETS, MINUTES } from './coach.js';

// ---------------------------------------------------------------------------
// Imagens
// Lista das vagas de imagem do quiz (os arquivos ficam em public/quiz-site/img/<vaga>.webp).
// "ref" é o id da imagem da BetterMe usada só como referência de estilo na criação; não vai ao ar.
// ---------------------------------------------------------------------------

const REF_BASE = 'https://ips.betterme.world/57355568-8766-44a5-a327-6266bc0080f7/image/upload/c_fill%2Cw_480/f_webp/q_auto:good/fl_lossy/c_fit/';
export const refUrl = (id) => (id ? REF_BASE + id : null);

// vaga: { ref: id da imagem da BetterMe (só referência), size, desc }
export const QUIZ_IMAGES = {
  'sexo-m': { ref: 'efa47faa-80bd-4632-90e8-96d548b40e42', size: '600×1200 (1:2)', desc: 'PRIMEIRA TELA. Homem de corpo inteiro, roupa de treino, fundo liso.' },
  'sexo-f': { ref: 'bf95b228-d83b-4dd7-9227-d972bda286f3', size: '600×1200 (1:2)', desc: 'PRIMEIRA TELA. Mulher de corpo inteiro, roupa de treino, fundo liso.' },

  'corpo-m-magro': { ref: 'frkfmgyqi4ookhtvezeb', size: '400×600 (2:3)', desc: 'Homem magro, sem camisa ou regata. Mesmo fundo e pose nas 4 opções.' },
  'corpo-m-medio': { ref: 'bkvsiohfm56rp2bw8pvr', size: '400×600 (2:3)', desc: 'Homem de corpo médio.' },
  'corpo-m-musculoso': { ref: 'urna8ckcbdhtoituboul', size: '400×600 (2:3)', desc: 'Homem musculoso.' },
  'corpo-m-acima': { ref: 'zeqazwlflx8eswu43rf6', size: '400×600 (2:3)', desc: 'Homem acima do peso.' },
  'corpo-f-magro': { ref: '2587db3a-aa56-4e7c-99e3-451b654ab3b1', size: '400×600 (2:3)', desc: 'Mulher magra, top e legging. Mesmo fundo e pose nas 4 opções.' },
  'corpo-f-medio': { ref: '50bfaa78-ddb6-49be-93ab-fc1d800cc13c', size: '400×600 (2:3)', desc: 'Mulher de corpo médio.' },
  'corpo-f-cheio': { ref: 'a44a10a1-c47a-405d-9ba8-4a4439eb2f8e', size: '400×600 (2:3)', desc: 'Mulher um pouco acima do peso.' },
  'corpo-f-acima': { ref: '46b8212f-d7e5-4ee8-8c92-6a317160c447', size: '400×600 (2:3)', desc: 'Mulher acima do peso.' },

  'meta-m-leve': { ref: 'df99c473-c29c-47ad-8137-dfa0c6d95073', size: '400×600 (2:3)', desc: 'Homem mais leve e em forma.' },
  'meta-m-atletico': { ref: '9b9b96ed-3aa7-42af-8ecd-ca336b6a451b', size: '400×600 (2:3)', desc: 'Homem atlético.' },
  'meta-m-definido': { ref: 'e5fb4605-db71-49ae-850c-50182e3a90c2', size: '400×600 (2:3)', desc: 'Homem bem definido (trincado).' },
  'meta-m-forte': { ref: '5fa7b0a4-e603-4c63-b0c9-7d1e842636c3', size: '400×600 (2:3)', desc: 'Homem forte e volumoso.' },
  'meta-f-leve': { ref: 'b7ef86bd-29f6-4356-a9d7-41e7ba9b8247', size: '400×600 (2:3)', desc: 'Mulher mais leve e em forma.' },
  'meta-f-tonificado': { ref: '705f23c8-b203-4a04-b0ab-7e62c1363730', size: '400×600 (2:3)', desc: 'Mulher tonificada.' },
  'meta-f-curvas': { ref: 'bbd4f8f1-90b0-4349-8d01-43c402ea5804', size: '400×600 (2:3)', desc: 'Mulher com curvas, glúteos e pernas trabalhados.' },
  'meta-f-forte': { ref: '0c4c9f47-d12d-46e3-8d22-04f7c75f9367', size: '400×600 (2:3)', desc: 'Mulher forte e musculosa.' },

  'info-objetivo': { ref: 'bc9e158a-f925-400d-985b-e1534ed70643', size: '800×600 (4:3)', desc: 'Ilustração de progresso (ex.: gráfico subindo ou pessoa treinando). Tela depois do objetivo.' },
  'info-nivel': { ref: '9d5a330c-72e2-4ee6-9179-0bab5876a032', size: '800×600 (4:3)', desc: 'Visual de "nível" (barra de nível, medalha). Tela que mostra o nível estimado.' },
  'limite-lombar': { ref: 'i3xg9xiaqehdowfrbtea', size: '160×160 (ícone)', desc: 'Ícone de costas/lombar.' },
  'limite-joelho': { ref: 'ldeewxdhmebzvvdrcyvo', size: '160×160 (ícone)', desc: 'Ícone de joelho.' },
  'limite-ombro': { ref: null, size: '160×160 (ícone)', desc: 'Ícone de ombro (sem referência).' },
  'limite-punho': { ref: null, size: '160×160 (ícone)', desc: 'Ícone de punho (sem referência).' },
  'limite-nenhuma': { ref: 'bicaufeofigxekjtmv9g', size: '160×160 (ícone)', desc: 'Ícone de "tudo certo" / joinha.' },
  'info-limite': { ref: '5d8dec74-394d-41fe-bdd3-654cf14e9821', size: '400×400 (1:1)', desc: 'Ícone ou ilustração de cuidado/segurança. Tela que acolhe a limitação.' },
  'info-app': { ref: null, size: '750×1334 (tela de celular)', desc: 'Tela ilustrativa do treino do dia, com exercício, séries e carga.', src: '/quiz/info-app.svg' },
};

// ---------------------------------------------------------------------------
// Perguntas
// tipos: single, multi, number, info, loader, summary, name, email
// Campos podem ser função das respostas (a) para personalizar por sexo/objetivo.
// ---------------------------------------------------------------------------

export const SECTIONS = ['Objetivo', 'Seu treino', 'Rotina', 'Medidas', 'Seu plano'];

const GOAL_LABEL = {
  massa: 'ganhar massa muscular',
  gordura: 'perder gordura',
  definir: 'definir o corpo',
  forca: 'ficar mais forte',
  saude: 'ter mais saúde e disposição',
};

const isF = (a) => a.sexo === 'f';

export const STEPS = [
  // ---------- Objetivo ----------
  {
    id: 'sexo',
    section: 0,
    type: 'single',
    layout: 'grid',
    title: 'Monte seu treino de academia em 2 minutos',
    sub: 'Para começar, escolha seu gênero.',
    options: [
      { value: 'm', label: 'Homem', img: 'sexo-m' },
      { value: 'f', label: 'Mulher', img: 'sexo-f' },
    ],
  },
  {
    id: 'objetivo',
    section: 0,
    type: 'single',
    title: 'Qual é o seu objetivo agora?',
    options: [
      { value: 'massa', label: 'Ganhar massa muscular' },
      { value: 'gordura', label: 'Perder gordura' },
      { value: 'definir', label: 'Definir o corpo' },
      { value: 'forca', label: 'Ficar mais forte' },
      { value: 'saude', label: 'Ter mais saúde e disposição' },
    ],
  },
  {
    id: 'idade',
    section: 0,
    type: 'single',
    title: 'Qual é a sua idade?',
    options: ['18–24', '25–34', '35–44', '45–54', '55+'].map((v) => ({ value: v, label: v })),
  },
  {
    id: 'info-objetivo',
    section: 0,
    type: 'info',
    img: 'info-objetivo',
    title: (a) => `Boa! Seu foco vai ser ${GOAL_LABEL[a.objetivo] || 'evoluir na academia'}.`,
    text: (a) =>
      ({
        massa: 'Vamos priorizar exercícios compostos, volume certo por músculo e aumento de carga semana a semana.',
        gordura: 'Vamos combinar musculação para manter a massa magra com treinos mais densos para gastar mais energia.',
        definir: 'Vamos trabalhar para ganhar músculo e reduzir gordura ao mesmo tempo, sem treinos intermináveis.',
        forca: 'Vamos focar nos levantamentos principais, com poucas repetições e progressão de carga controlada.',
        saude: 'Vamos montar um treino equilibrado, que cabe na rotina e melhora força, fôlego e postura.',
      })[a.objetivo] || '',
  },
  {
    id: 'corpo',
    section: 0,
    type: 'single',
    layout: 'grid',
    title: 'Como está seu corpo hoje?',
    sub: 'Seja sincero(a), ninguém além de você vê isso.',
    options: (a) =>
      isF(a)
        ? [
            { value: 'magro', label: 'Magra', img: 'corpo-f-magro' },
            { value: 'medio', label: 'Média', img: 'corpo-f-medio' },
            { value: 'cheio', label: 'Um pouco acima do peso', img: 'corpo-f-cheio' },
            { value: 'acima', label: 'Acima do peso', img: 'corpo-f-acima' },
          ]
        : [
            { value: 'magro', label: 'Magro', img: 'corpo-m-magro' },
            { value: 'medio', label: 'Médio', img: 'corpo-m-medio' },
            { value: 'musculoso', label: 'Musculoso', img: 'corpo-m-musculoso' },
            { value: 'acima', label: 'Acima do peso', img: 'corpo-m-acima' },
          ],
  },
  {
    id: 'meta',
    section: 0,
    type: 'single',
    layout: 'grid',
    title: 'E qual corpo você quer construir?',
    options: (a) =>
      isF(a)
        ? [
            { value: 'leve', label: 'Mais leve', img: 'meta-f-leve' },
            { value: 'tonificado', label: 'Tonificada', img: 'meta-f-tonificado' },
            { value: 'curvas', label: 'Com curvas', img: 'meta-f-curvas' },
            { value: 'forte', label: 'Forte', img: 'meta-f-forte' },
          ]
        : [
            { value: 'leve', label: 'Mais leve', img: 'meta-m-leve' },
            { value: 'atletico', label: 'Atlético', img: 'meta-m-atletico' },
            { value: 'definido', label: 'Definido', img: 'meta-m-definido' },
            { value: 'forte', label: 'Forte', img: 'meta-m-forte' },
          ],
  },

  // ---------- Seu treino ----------
  {
    id: 'local',
    section: 1,
    type: 'single',
    title: 'Onde você vai treinar?',
    options: [
      { value: 'academia', label: 'Academia completa', hint: 'Máquinas, barras, cabos e halteres' },
      { value: 'condominio', label: 'Academia do prédio ou condomínio', hint: 'Halteres e algumas máquinas' },
      { value: 'casa', label: 'Em casa com halteres ou elásticos' },
      { value: 'sem', label: 'Sem equipamento', hint: 'Só o peso do corpo' },
    ],
  },
  {
    id: 'experiencia',
    section: 1,
    type: 'single',
    title: 'Há quanto tempo você faz musculação?',
    options: [
      { value: 'nunca', label: 'Nunca fiz' },
      { value: '0-6m', label: 'Menos de 6 meses' },
      { value: '6m-2a', label: 'De 6 meses a 2 anos' },
      { value: '2a+', label: 'Mais de 2 anos' },
    ],
  },
  {
    id: 'recente',
    section: 1,
    type: 'single',
    title: 'E nos últimos 3 meses, quanto você treinou?',
    options: [
      { value: '5+', label: 'Quase todo dia' },
      { value: '3-4', label: '3 a 4 vezes por semana' },
      { value: '1-2', label: '1 a 2 vezes por semana' },
      { value: 'parado', label: 'Estou parado(a)' },
    ],
  },
  {
    id: 'info-nivel',
    section: 1,
    type: 'info',
    img: 'info-nivel',
    title: (a) => `Seu ponto de partida: ${LEVEL_LABEL[estimateLevel(a)]}`,
    text: (a) =>
      ({
        beginner: 'Perfeito para começar do jeito certo: aprender os movimentos, criar o hábito e ver os primeiros ganhos rápido.',
        intermediate: 'Você já tem base. Agora o que faz diferença é progressão de carga organizada e volume bem distribuído.',
        advanced: 'Com bastante experiência, cada detalhe conta: periodização, escolha de exercícios e controle do volume.',
      })[estimateLevel(a)],
  },
  {
    id: 'dias',
    section: 1,
    type: 'single',
    title: 'Quantos dias por semana você consegue treinar?',
    sub: 'Escolha o que cabe de verdade na sua rotina.',
    options: [2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} dias` })),
  },
  {
    id: 'minutos',
    section: 1,
    type: 'single',
    title: 'Quanto tempo você tem por treino?',
    options: MINUTES.map((m) => ({ value: m, label: m >= 90 ? '90 min ou mais' : `${m} min` })),
  },
  {
    id: 'foco',
    section: 1,
    type: 'multi',
    bodyMap: true,
    title: 'Quer dar prioridade a algum músculo?',
    sub: 'Escolha quantos quiser.',
    options: [
      { value: 'peito', label: 'Peito' },
      { value: 'costas', label: 'Costas' },
      { value: 'ombros', label: 'Ombros' },
      { value: 'bracos', label: 'Braços' },
      { value: 'abdomen', label: 'Abdômen' },
      { value: 'pernas', label: 'Pernas' },
      { value: 'gluteos', label: 'Glúteos' },
      { value: 'equilibrado', label: 'Corpo todo por igual', none: true },
    ],
  },
  {
    id: 'divisao',
    section: 1,
    type: 'single',
    title: 'Como você prefere dividir os treinos?',
    options: [
      { value: 'auto', label: 'Não sei, escolha por mim' },
      { value: 'fullbody', label: 'Corpo inteiro em todo treino' },
      { value: 'upper-lower', label: 'Superior / Inferior' },
      { value: 'abc', label: 'ABC (ex.: peito, costas, pernas)' },
      { value: 'ppl', label: 'Empurrar / Puxar / Pernas' },
    ],
  },
  {
    id: 'limites',
    section: 1,
    type: 'multi',
    layout: 'icons',
    title: 'Sente dor ou tem limitação em alguma região?',
    sub: 'O plano evita exercícios que forcem essas áreas.',
    options: [
      { value: 'ombro', label: 'Ombro', img: 'limite-ombro' },
      { value: 'lombar', label: 'Lombar', img: 'limite-lombar' },
      { value: 'joelho', label: 'Joelho', img: 'limite-joelho' },
      { value: 'punho', label: 'Punho', img: 'limite-punho' },
      { value: 'nenhuma', label: 'Nenhuma', img: 'limite-nenhuma', none: true },
    ],
  },
  {
    id: 'info-limite',
    section: 1,
    type: 'info',
    img: 'info-limite',
    when: (a) => hasLimits(a),
    title: 'Anotado. Seu treino vai respeitar isso.',
    text: (a) => `Vamos trocar movimentos que sobrecarregam ${listJoin(labelsOf('limites', a.limites, a))} por variações mais seguras. Se a dor for forte ou persistente, procure um profissional de saúde.`,
  },
  {
    id: 'barreiras',
    section: 1,
    type: 'multi',
    title: 'O que mais já te fez parar de treinar?',
    sub: 'Escolha quantas quiser.',
    options: [
      { value: 'nao-sei', label: 'Não saber o que fazer na academia' },
      { value: 'tempo', label: 'Falta de tempo' },
      { value: 'resultado', label: 'O resultado demorou a aparecer' },
      { value: 'sozinho', label: 'Desanimei treinando sozinho(a)' },
      { value: 'vergonha', label: 'Vergonha ou insegurança na academia' },
      { value: 'nunca-parei', label: 'Nunca parei', none: true },
    ],
  },
  {
    id: 'info-app',
    section: 1,
    type: 'info',
    img: 'info-app',
    title: (a) => (BARRIER_TITLE[(a.barreiras || [])[0]] || 'Você abre o app e já sabe o que fazer.'),
    text: 'O Moviq mostra o exercício do dia com vídeo, as séries, a carga sugerida e o descanso. Quando você bate as repetições, ele sobe a carga sozinho.',
  },

  // ---------- Rotina ----------
  {
    id: 'horario',
    section: 2,
    type: 'single',
    title: 'Em que horário você costuma treinar?',
    options: [
      { value: 'manha', label: 'De manhã' },
      { value: 'almoco', label: 'No almoço' },
      { value: 'tarde', label: 'À tarde' },
      { value: 'noite', label: 'À noite' },
      { value: 'varia', label: 'Varia' },
    ],
  },
  {
    id: 'sono',
    section: 2,
    type: 'single',
    title: 'Quantas horas você dorme por noite?',
    options: [
      { value: '<5', label: 'Menos de 5 h' },
      { value: '5-6', label: '5 a 6 h' },
      { value: '7-8', label: '7 a 8 h' },
      { value: '8+', label: 'Mais de 8 h' },
    ],
  },

  // ---------- Medidas ----------
  { id: 'altura', section: 3, type: 'number', title: 'Qual é a sua altura?', unit: 'cm', min: 120, max: 230, placeholder: '175' },
  { id: 'peso', section: 3, type: 'number', title: 'E o seu peso atual?', unit: 'kg', min: 35, max: 300, placeholder: '80', decimal: true },
  {
    id: 'pesoMeta',
    section: 3,
    type: 'number',
    title: 'Tem um peso que você quer alcançar?',
    sub: 'Opcional. Vamos acompanhar isso no app.',
    unit: 'kg',
    min: 35,
    max: 300,
    placeholder: '75',
    decimal: true,
    optional: true,
  },

  // ---------- Seu plano ----------
  { id: 'montando', section: 4, type: 'loader', title: 'Montando seu plano…' },
  { id: 'resumo', section: 4, type: 'summary', title: 'Seu plano Moviq' },
  { id: 'nome', section: 4, type: 'name', title: 'Como você quer ser chamado(a)?' },
  { id: 'email', section: 4, type: 'email', title: (a) => `${firstName(a.nome) ? firstName(a.nome) + ', p' : 'P'}ara onde enviamos seu plano?` },
];

const BARRIER_TITLE = {
  'nao-sei': 'Chega de chegar na academia sem saber o que fazer.',
  tempo: 'Treinos que cabem no tempo que você tem.',
  resultado: 'Você vê a evolução em números, treino a treino.',
  sozinho: 'Um plano que te acompanha em cada série.',
  vergonha: 'Entre na academia sabendo exatamente o que fazer.',
};

export const LEVEL_LABEL = { beginner: 'iniciante', intermediate: 'intermediário', advanced: 'avançado' };

// ---------------------------------------------------------------------------
// Navegação
// ---------------------------------------------------------------------------

export const resolve = (v, a) => (typeof v === 'function' ? v(a || {}) : v);

// Passos que aparecem para estas respostas (os condicionais saem)
export const visibleSteps = (a) => STEPS.filter((s) => !s.when || s.when(a || {}));

export function labelsOf(stepId, values, a) {
  const step = STEPS.find((s) => s.id === stepId);
  const opts = resolve(step?.options, a) || [];
  return (values || []).map((v) => opts.find((o) => o.value === v)?.label?.toLowerCase()).filter(Boolean);
}

export const listJoin = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} e ${arr[arr.length - 1]}`);
const num = (v) => Number(String(v ?? '').replace(',', '.')) || 0;
export const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';
const hasLimits = (a) => (a.limites || []).some((x) => x !== 'nenhuma');

// A resposta deste passo está completa?
export function isAnswered(step, a) {
  const v = (a || {})[step.id];
  switch (step.type) {
    case 'single':
      return v !== undefined && v !== null && v !== '';
    case 'multi':
      return Array.isArray(v) && v.length > 0;
    case 'number':
      if (step.optional && (v === undefined || v === null || v === '')) return true;
      {
        const n = Number(String(v).replace(',', '.'));
        return Number.isFinite(n) && n >= step.min && n <= step.max;
      }
    case 'name':
      return String(a?.nome || '').trim().length >= 2;
    case 'email':
      return isValidEmail(a?.email);
    default:
      return true;
  }
}

// Marca/desmarca numa múltipla escolha; a opção "none" (Nenhuma) é exclusiva
export function toggleMulti(current, value, options) {
  const list = Array.isArray(current) ? current : [];
  const noneValues = (options || []).filter((o) => o.none).map((o) => o.value);
  if (list.includes(value)) return list.filter((x) => x !== value);
  if (noneValues.includes(value)) return [value];
  return [...list.filter((x) => !noneValues.includes(x)), value];
}

export const isValidEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(e || '').trim()) && String(e).trim().length <= 254;

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

export function estimateLevel(a) {
  const base = { nunca: 0, '0-6m': 0, '6m-2a': 1, '2a+': 2 }[a?.experiencia] ?? 0;
  const level = a?.recente === 'parado' ? Math.max(0, base - 1) : base;
  return ['beginner', 'intermediate', 'advanced'][level];
}

const SPLIT_LABEL = {
  fullbody: 'Corpo inteiro',
  'upper-lower': 'Superior / Inferior',
  abc: 'ABC',
  ppl: 'Empurrar / Puxar / Pernas',
};

export function suggestedSplit(a) {
  if (a?.divisao && a.divisao !== 'auto') return a.divisao;
  const d = Number(a?.dias) || 3;
  if (d <= 3) return 'fullbody';
  if (d === 4) return 'upper-lower';
  return 'ppl';
}

// Dados da tela "Seu plano Moviq"
export function planSummary(a) {
  const level = estimateLevel(a);
  const foco = labelsOf('foco', (a.foco || []).filter((x) => x !== 'equilibrado'), a);
  const h = num(a.altura) / 100;
  const imc = h && num(a.peso) ? num(a.peso) / (h * h) : null;
  return {
    objetivo: GOAL_LABEL[a.objetivo] || '',
    nivel: LEVEL_LABEL[level],
    divisao: SPLIT_LABEL[suggestedSplit(a)],
    rotina: `${a.dias || 3} treinos por semana · ${a.minutos || 60} min`,
    foco: foco.length ? listJoin(foco) : 'corpo todo equilibrado',
    cuidados: hasLimits(a) ? listJoin(labelsOf('limites', a.limites, a)) : null,
    imc: imc ? Math.round(imc * 10) / 10 : null,
  };
}

// Equipamentos liberados para o Coach conforme o local
export function equipmentFor(local) {
  if (local === 'condominio') return [...EQUIPMENT_PRESETS.home, 'cable', 'leverage machine', 'smith machine'];
  if (local === 'casa') return EQUIPMENT_PRESETS.home;
  if (local === 'sem') return EQUIPMENT_PRESETS.bodyweight;
  return EQUIPMENT_PRESETS.gym;
}

const COACH_GOAL = { massa: 'hypertrophy', gordura: 'fatloss', definir: 'hypertrophy', forca: 'strength', saude: 'fitness' };

// Pedido para /api/coach a partir das respostas do quiz
export function toCoachInput(a) {
  a = a || {};
  const days = Math.min(6, Math.max(2, Math.round(Number(a.dias) || 3)));
  const minutes = MINUTES.includes(Number(a.minutos)) ? Number(a.minutos) : 60;
  const sexo = { m: 'masculino', f: 'feminino' }[a.sexo];
  const foco = labelsOf('foco', (a.foco || []).filter((x) => x !== 'equilibrado'), a);
  const limites = hasLimits(a) ? labelsOf('limites', a.limites, a) : [];
  const split = suggestedSplit(a);
  const notes = [
    sexo ? `Sexo: ${sexo}.` : null,
    a.idade ? `Idade: ${a.idade} anos.` : null,
    a.objetivo === 'definir' ? 'Objetivo: recomposição corporal (perder gordura mantendo/ganhando músculo).' : null,
    a.meta ? `Corpo desejado: ${labelsOf('meta', [a.meta], a)[0] || a.meta}.` : null,
    foco.length ? `Prioridade muscular: ${foco.join(', ')}.` : null,
    `Divisão preferida: ${SPLIT_LABEL[split]}.`,
    limites.length ? `Limitações/dor: ${limites.join(', ')}; evitar exercícios que sobrecarreguem essas regiões.` : null,
    a.local === 'condominio' ? 'Treina em academia de condomínio (halteres e poucas máquinas).' : null,
    a.recente === 'parado' ? 'Está voltando de uma pausa: começar com volume moderado.' : null,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 500);
  return {
    goal: COACH_GOAL[a.objetivo] || 'hypertrophy',
    level: estimateLevel(a),
    days,
    minutes,
    equipment: equipmentFor(a.local),
    notes,
    lang: 'pt',
  };
}

// Plano pronto (lib/starter.js) usado se o Coach com IA não estiver disponível
export function starterFor(a) {
  if (a?.objetivo === 'forca') return '5x5';
  const d = Number(a?.dias) || 3;
  if (d <= 3) return 'full-body';
  if (d === 4) return 'upper-lower';
  return 'ppl';
}

// Só as respostas conhecidas, nos formatos esperados (o que vai para o Supabase)
export function cleanAnswers(a) {
  const out = {};
  for (const step of STEPS) {
    const v = a?.[step.id];
    if (v === undefined || v === null || v === '') continue;
    if (step.type === 'single') {
      if ((resolve(step.options, a) || []).some((o) => o.value === v)) out[step.id] = v;
    } else if (step.type === 'multi') {
      const opts = resolve(step.options, a) || [];
      const vals = (Array.isArray(v) ? v : []).filter((x) => opts.some((o) => o.value === x));
      if (vals.length) out[step.id] = vals;
    } else if (step.type === 'number') {
      const n = Number(String(v).replace(',', '.'));
      if (Number.isFinite(n) && n >= step.min && n <= step.max) out[step.id] = Math.round(n * 10) / 10;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rastreio e checkout
// ---------------------------------------------------------------------------

// Parâmetros do anúncio que seguem do quiz para o checkout (UTMs, fbclid e os de Hotmart/Kiwify)
export const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'src', 'sck'];

export function pickTracking(search) {
  const p = new URLSearchParams(search || '');
  const out = {};
  for (const k of TRACKING_PARAMS) {
    const v = p.get(k);
    if (v) out[k] = v.slice(0, 200);
  }
  return out;
}

// Link do checkout com nome e e-mail preenchidos (Hotmart e Kiwify aceitam ?email=&name=).
// baseUrl: link de checkout externo (o quiz atual usa a Stripe via /api/stripe/checkout). Retorna null se não houver checkout configurado.
export function checkoutUrl(baseUrl, { email, name, tracking } = {}) {
  if (!baseUrl) return null;
  let url;
  try {
    url = new URL(baseUrl);
  } catch (e) {
    return null;
  }
  if (email) url.searchParams.set('email', String(email).trim().toLowerCase());
  if (name) url.searchParams.set('name', String(name).trim());
  for (const [k, v] of Object.entries(tracking || {})) if (!url.searchParams.has(k)) url.searchParams.set(k, v);
  return url.toString();
}
