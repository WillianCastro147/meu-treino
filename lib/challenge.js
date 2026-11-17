// Desafio 21 dias de calistenia: um treino por dia, sem equipamento, liberado um dia depois do outro.
//
// Cada dia é uma rotina normal (tabela routines), então o treino usa a mesma tela, histórico e recordes.
// O desafio fica no plano do perfil (profiles.plan.challenge, jsonb; sem migração nova):
//   { kind: 'calistenia21', startedAt: ISO, summary, days: [{ id: routineId, notes }] x 21 }
// Um dia está feito quando existe um treino daquela rotina depois do início do desafio.
// As rotinas do desafio não aparecem na aba Rotinas nem na lista do botão Iniciar.
//
// Funções puras (sem rede), testadas em lib/challenge.test.mjs. A chamada à OpenAI fica em
// app/api/coach/route.js (kind: 'challenge').

export const CHALLENGE_KIND = 'calistenia21';
export const CHALLENGE_DAYS = 21;
export const CHALLENGE_LEVELS = ['beginner', 'intermediate', 'advanced'];
export const CHALLENGE_MINUTES = [20, 30, 45];

// ---------------------------------------------------------------------------
// Desafio pronto (usado quando a IA não está disponível ou falha)
// ---------------------------------------------------------------------------

const N = (en, pt, es, fr) => ({ en, pt, es, fr });

// Exercício: [id por nível (iniciante, intermediário, avançado), repetições base]
const DAY_TYPES = {
  upper: {
    name: N('Upper body & core', 'Superior e core', 'Tren superior y core', 'Haut du corps et gainage'),
    notes: N('Push-ups and dips for chest, shoulders and triceps, finishing with core.', 'Flexões e mergulhos para peito, ombros e tríceps, fechando com abdômen.', 'Flexiones y fondos para pecho, hombros y tríceps, terminando con abdomen.', 'Pompes et dips pour pectoraux, épaules et triceps, puis gainage.'),
    rest: 45,
    list: [
      [['og0493', 'og0662', 'og0283'], 10],
      [['og5110', 'og5110', 'og5110'], 10],
      [['og3699', 'og2921', 'og2921'], 10],
      [['og3436', 'og3436', 'og3436'], 12],
      [['og0276', 'og0872', 'og5649'], 12],
    ],
  },
  legs: {
    name: N('Legs & glutes', 'Pernas e glúteos', 'Piernas y glúteos', 'Jambes et fessiers'),
    notes: N('Squats, lunges and bridges: keep your knees in line with your toes.', 'Agachamentos, avanços e pontes: mantenha os joelhos alinhados com os pés.', 'Sentadillas, zancadas y puentes: mantén las rodillas alineadas con los pies.', 'Squats, fentes et ponts : garde les genoux alignés avec les pieds.'),
    rest: 45,
    list: [
      [['og1197', 'og0781', 'og3743'], 12],
      [['og0612', 'og0612', 'og0514'], 10],
      [['og2072', 'og2072', 'og2072'], 15],
      [['og2972', 'og2972', 'og2569'], 10],
      [['og3018', 'og3018', 'og3018'], 20],
    ],
  },
  cardio: {
    name: N('Full-body cardio', 'Corpo inteiro e cardio', 'Cuerpo completo y cardio', 'Corps entier et cardio'),
    notes: N('Short rests and steady pace: this is the day to raise your heart rate.', 'Descansos curtos e ritmo constante: é o dia de acelerar o coração.', 'Descansos cortos y ritmo constante: es el día de acelerar el corazón.', 'Repos courts et rythme régulier : c’est le jour pour faire monter le cardio.'),
    rest: 30,
    list: [
      [['og3094', 'og3094', 'og3094'], 30],
      [['og1471', 'og1160', 'og1160'], 8],
      [['og0630', 'og0630', 'og0630'], 20],
      [['og1197', 'og0514', 'og0514'], 12],
      [['og3930', 'og3930', 'og3930'], 20],
      [['og3556', 'og3556', 'og3556'], 30],
    ],
  },
  recovery: {
    name: N('Core & mobility', 'Core e mobilidade', 'Core y movilidad', 'Gainage et mobilité'),
    notes: N('Lighter day: move slowly and focus on control and breathing.', 'Dia mais leve: faça devagar, com controle e respiração.', 'Día más suave: hazlo despacio, con control y respiración.', 'Journée plus légère : bouge lentement, avec contrôle et respiration.'),
    rest: 30,
    list: [
      [['og1241', 'og1241', 'og1241'], 10],
      [['og0276', 'og0276', 'og0276'], 10],
      [['og6211', 'og6211', 'og6211'], 16],
      [['og0145', 'og0145', 'og0145'], 15],
      [['og4580', 'og4580', 'og4580'], 10],
      [['og1511', 'og1511', 'og1511'], 8],
    ],
  },
};

// Semana: superior, pernas, cardio, superior, pernas, cardio, recuperação (x3)
const WEEK = ['upper', 'legs', 'cardio', 'upper', 'legs', 'cardio', 'recovery'];
const SETS = { beginner: [2, 3, 3], intermediate: [3, 3, 4], advanced: [3, 4, 4] };
const REPS_FACTOR = { beginner: 0.8, intermediate: 1, advanced: 1.25 };
const WEEK_FACTOR = [1, 1.2, 1.4];

export const READY_EXERCISE_IDS = [...new Set(Object.values(DAY_TYPES).flatMap((d) => d.list.flatMap(([ids]) => ids)))];

const dayLabel = { en: 'Day', pt: 'Dia', es: 'Día', fr: 'Jour' };
const SUMMARY = N(
  '21 days of bodyweight training, no equipment: one workout a day that gets harder each week.',
  '21 dias de treino com o peso do corpo, sem equipamento: um treino por dia, mais puxado a cada semana.',
  '21 días de entrenamiento con el peso corporal, sin equipo: un entrenamiento al día, más intenso cada semana.',
  '21 jours d’entraînement au poids du corps, sans matériel : une séance par jour, plus intense chaque semaine.'
);

// { summary, days: [{ name, notes, exercises }] } no formato das rotinas. findCatalog(id) -> exercício do catálogo.
export function buildReadyChallenge(level, lang, findCatalog) {
  const lv = CHALLENGE_LEVELS.includes(level) ? level : 'beginner';
  const li = CHALLENGE_LEVELS.indexOf(lv);
  const l = dayLabel[lang] ? lang : 'en';
  const days = Array.from({ length: CHALLENGE_DAYS }, (_, i) => {
    const week = Math.floor(i / 7);
    const type = DAY_TYPES[WEEK[i % 7]];
    const isRecovery = WEEK[i % 7] === 'recovery';
    const sets = isRecovery ? 2 : SETS[lv][week];
    const exercises = type.list.map(([ids, reps]) => {
      const id = ids[li];
      const cat = findCatalog?.(id);
      return {
        id,
        name: cat?.name?.en || id,
        gif: cat?.gif || `/media/still/${id.slice(2)}.webp`,
        sets,
        reps: Math.max(4, Math.round(reps * REPS_FACTOR[lv] * (isRecovery ? 1 : WEEK_FACTOR[week]))),
        rest: type.rest,
      };
    });
    return { name: `${dayLabel[l]} ${i + 1} · ${type.name[l]}`, notes: type.notes[l], exercises };
  });
  return { summary: SUMMARY[l], days };
}

// ---------------------------------------------------------------------------
// Coach com IA
// ---------------------------------------------------------------------------

const CATEGORIES = new Set(['calisthenics', 'plyometrics', 'cardio', 'mobility']);
// Peso do corpo, mas precisa de barra, banco, caixa etc.: fica de fora (desafio é para fazer em casa)
const NEEDS_GEAR = /\b(bar|bars|bench|box|ring|rings|step|parallel|dip station|pull[- ]?ups?|chin[- ]?ups?|towel|trx|swiss|ball|sliders?|partner|assisted|machine|rope|wall bar|sled)\b/i;
const PER_TARGET = 14;

// Recorta o catálogo para o que faz sentido mandar ao modelo
export function buildChallengeCandidates(catalog) {
  const allowed = (catalog || []).filter((e) => e.eq === 'body weight' && CATEGORIES.has(e.cat) && !NEEDS_GEAR.test(e.name.en));
  const byTarget = new Map();
  allowed.forEach((e) => {
    if (!byTarget.has(e.target)) byTarget.set(e.target, []);
    byTarget.get(e.target).push(e);
  });
  const picked = new Map();
  (catalog || []).filter((e) => READY_EXERCISE_IDS.includes(e.id)).forEach((e) => picked.set(e.id, e));
  for (const list of byTarget.values()) {
    [...list]
      .sort((a, b) => a.name.en.length - b.name.en.length || a.id.localeCompare(b.id))
      .slice(0, PER_TARGET)
      .forEach((e) => picked.set(e.id, e));
  }
  return [...picked.values()];
}

const LANG_NAME = { en: 'English', pt: 'Brazilian Portuguese', es: 'Spanish', fr: 'French' };

// input: { level, minutes, notes, weightKg, heightCm }
export function buildChallengeMessages(input, candidates, lang = 'pt') {
  const list = candidates.map((e) => `${e.id}|${e.name.en}|${e.target}|${e.cat}`).join('\n');
  const system = [
    'You are an experienced calisthenics coach.',
    `Design a ${CHALLENGE_DAYS}-day bodyweight calisthenics challenge: exactly ${CHALLENGE_DAYS} workouts, one per day, in order (day 1 to day ${CHALLENGE_DAYS}).`,
    'Use ONLY exercises from the provided catalog, referenced by their exact id (e.g. og0662).',
    'Rules:',
    '- No equipment at all: no pull-up bar, bench, box, rings or weights. Floor, wall and a sturdy chair are fine.',
    '- Progression: days 1-7 build the base, days 8-14 add volume or harder variations, days 15-21 are the hardest; day 21 is a final test workout.',
    '- Days 7 and 14 are lighter recovery days focused on core and mobility.',
    '- Rotate the focus (upper body push, legs and glutes, full-body conditioning, core) so the same muscles are not trained hard on consecutive days.',
    '- 4 to 7 exercises per day. sets 1-5, reps 4-50 (for moves done in steps or jumps, reps = count), rest in seconds 15-120.',
    '- Fit each workout in the available minutes.',
    '- Match the experience level: easier variations (incline or knee push-ups) for beginners, harder ones (diamond, pike, jump variations) for advanced.',
    '- Respect injuries and limitations in the notes: avoid exercises that stress the affected area.',
    `- Write names, notes and summary in ${LANG_NAME[lang] || 'English'}. Day name format: "<Day word> <n> · <focus>", e.g. "Dia 1 · Superior e core".`,
    '- Be brief: each day "notes" is ONE short sentence (max 20 words); "summary" is at most 2 short sentences.',
    '- Do not give medical advice.',
  ].join('\n');
  const user = [
    `Experience level: ${input.level}`,
    `Minutes per workout: ${input.minutes}`,
    input.weightKg ? `Body weight: ${input.weightKg} kg` : null,
    input.heightCm ? `Height: ${input.heightCm} cm` : null,
    input.notes ? `Notes from the user (injuries, focus, preferences): ${String(input.notes).slice(0, 500)}` : null,
    '',
    'Catalog (id|name|main muscle|category):',
    list,
  ]
    .filter((x) => x !== null)
    .join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export const CHALLENGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'days'],
  properties: {
    summary: { type: 'string', description: 'At most two short sentences explaining the challenge.' },
    days: {
      type: 'array',
      description: `Exactly ${CHALLENGE_DAYS} workouts, day 1 first.`,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'notes', 'exercises'],
        properties: {
          name: { type: 'string' },
          notes: { type: 'string', description: 'One short sentence.' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'sets', 'reps', 'rest'],
              properties: {
                id: { type: 'string', description: 'Exercise id from the catalog, e.g. og0662' },
                sets: { type: 'integer' },
                reps: { type: 'integer' },
                rest: { type: 'integer', description: 'Rest in seconds' },
              },
            },
          },
        },
      },
    },
  },
};

const clamp = (v, lo, hi, def) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};

// Confere a resposta da IA: 21 dias, só exercícios do catálogo com peso do corpo, números em faixas sensatas.
// Retorna { summary, days } ou null (aí o app usa o desafio pronto).
export function validateChallenge(raw, findCatalog) {
  if (!raw || !Array.isArray(raw.days) || raw.days.length < CHALLENGE_DAYS) return null;
  const days = [];
  for (const d of raw.days.slice(0, CHALLENGE_DAYS)) {
    const seen = new Set();
    const exercises = (Array.isArray(d?.exercises) ? d.exercises : [])
      .filter((x) => {
        const cat = x && typeof x.id === 'string' ? findCatalog(x.id) : null;
        const ok = cat && (cat.eq === undefined || cat.eq === 'body weight') && !seen.has(x.id);
        if (ok) seen.add(x.id);
        return ok;
      })
      .slice(0, 8)
      .map((x) => {
        const cat = findCatalog(x.id);
        return { id: cat.id, name: cat.name.en, gif: cat.gif, sets: clamp(x.sets, 1, 5, 3), reps: clamp(x.reps, 1, 50, 10), rest: clamp(x.rest, 15, 180, 45) };
      });
    if (!exercises.length) return null;
    days.push({ name: String(d.name || '').slice(0, 60) || `Dia ${days.length + 1}`, notes: String(d.notes || '').slice(0, 300), exercises });
  }
  return { summary: String(raw.summary || '').slice(0, 800), days };
}

// ---------------------------------------------------------------------------
// Progresso
// ---------------------------------------------------------------------------

// O desafio salvo no plano, se for válido
export function normalizeChallenge(c) {
  if (!c || typeof c !== 'object' || c.kind !== CHALLENGE_KIND || !Array.isArray(c.days) || c.days.length !== CHALLENGE_DAYS) return null;
  if (!c.days.every((d) => d && typeof d.id === 'string' && d.id)) return null;
  return { kind: CHALLENGE_KIND, startedAt: c.startedAt || null, summary: String(c.summary || ''), days: c.days.map((d) => ({ id: d.id, notes: String(d.notes || '') })) };
}

// Ids das rotinas do desafio (para esconder da aba Rotinas e do botão Iniciar)
export function challengeRoutineIds(plan) {
  const c = normalizeChallenge(plan?.challenge);
  return new Set(c ? c.days.map((d) => d.id) : []);
}

// workouts: [{ routine_id, started_at }]. Retorna o status de cada dia, liberados um depois do outro:
// { days: ['done' | 'next' | 'locked'] x 21, done: n, next: índice do próximo dia (ou -1 se terminou), finished }
export function challengeProgress(challenge, workouts = []) {
  const c = normalizeChallenge(challenge);
  if (!c) return null;
  const since = c.startedAt ? new Date(c.startedAt).getTime() - 60000 : 0;
  const doneIds = new Set(
    (workouts || []).filter((w) => w && w.routine_id && (!since || new Date(w.started_at).getTime() >= since)).map((w) => w.routine_id)
  );
  const next = c.days.findIndex((d) => !doneIds.has(d.id));
  const days = c.days.map((d, i) => (doneIds.has(d.id) ? 'done' : i === next ? 'next' : 'locked'));
  const done = days.filter((s) => s === 'done').length;
  return { days, done, next, finished: next === -1 };
}

// Plano do perfil com o desafio novo (mantém semana/rotação)
export function withChallenge(plan, routineIds, built, now = new Date()) {
  const p = plan && typeof plan === 'object' ? plan : {};
  return {
    ...p,
    challenge: {
      kind: CHALLENGE_KIND,
      startedAt: new Date(now).toISOString(),
      summary: String(built.summary || ''),
      days: routineIds.map((id, i) => ({ id, notes: String(built.days[i]?.notes || '') })),
    },
  };
}
