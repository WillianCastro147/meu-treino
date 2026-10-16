// Coach com IA: monta o pedido para o modelo e confere a resposta.
// Funções puras (sem rede), testadas em lib/fase2.test.mjs. A chamada à OpenAI fica em
// app/api/coach/route.js, no servidor, para a chave nunca chegar ao aparelho do usuário.

export const GOALS = ['hypertrophy', 'strength', 'fatloss', 'fitness'];
export const LEVELS = ['beginner', 'intermediate', 'advanced'];
export const MINUTES = [30, 45, 60, 90];
export const DAILY_LIMIT = 5; // planos gerados por usuário a cada 24 h

// Equipamento do catálogo que cada atalho libera
export const EQUIPMENT_PRESETS = {
  gym: ['body weight', 'dumbbell', 'barbell', 'cable', 'leverage machine', 'smith machine', 'ez barbell', 'kettlebell', 'band', 'sled machine', 'weighted', 'olympic barbell', 'trap bar', 'medicine ball', 'stability ball'],
  home: ['body weight', 'dumbbell', 'band', 'kettlebell', 'resistance band'],
  bodyweight: ['body weight'],
};

// Exercícios que entram na lista: força/calistenia (+ cardio e pliometria para condicionamento)
const BASE_CATEGORIES = ['strength', 'calisthenics', 'isometric'];
const PER_TARGET = 16;

// Exercícios básicos que, se o equipamento permitir, sempre estão na lista
const STAPLES = ['og0025', 'og0047', 'og0043', 'og0085', 'og0027', 'og2330', 'og1323', 'og0426', 'og0334', 'og0241', 'og0031', 'og0313', 'og0739', 'og0585', 'og0586', 'og0605', 'og0251'];

// Recorta o catálogo para o que faz sentido mandar ao modelo (~350 exercícios)
export function buildCandidates(catalog, { equipment = EQUIPMENT_PRESETS.gym, goal = 'hypertrophy', level = 'intermediate' } = {}) {
  const eq = new Set(equipment);
  const cats = new Set(BASE_CATEGORIES);
  if (goal === 'fatloss' || goal === 'fitness') ['cardio', 'plyometrics'].forEach((c) => cats.add(c));
  if (level === 'advanced' && eq.has('barbell')) cats.add('olympic');

  const allowed = (catalog || []).filter((e) => eq.has(e.eq) && cats.has(e.cat));
  const byTarget = new Map();
  allowed.forEach((e) => {
    if (!byTarget.has(e.target)) byTarget.set(e.target, []);
    byTarget.get(e.target).push(e);
  });

  const picked = new Map();
  allowed.filter((e) => STAPLES.includes(e.id)).forEach((e) => picked.set(e.id, e));
  for (const list of byTarget.values()) {
    // Nomes curtos costumam ser as variações mais comuns ("barbell bench press")
    [...list]
      .sort((a, b) => (a.name.en.length - b.name.en.length) || a.id.localeCompare(b.id))
      .slice(0, PER_TARGET)
      .forEach((e) => picked.set(e.id, e));
  }
  return [...picked.values()];
}

const LANG_NAME = { en: 'English', pt: 'Brazilian Portuguese', es: 'Spanish', fr: 'French' };

// Mensagens para o modelo. input: { goal, level, days, minutes, notes, weightKg, heightCm }
export function buildMessages(input, candidates, lang = 'pt') {
  const list = candidates.map((e) => `${e.id}|${e.name.en}|${e.target}|${e.eq}`).join('\n');
  const system = [
    'You are an experienced strength and conditioning coach who designs gym programs.',
    'Build a weekly training plan for the user using ONLY exercises from the provided catalog, referenced by their exact id (e.g. og0025).',
    'Rules:',
    '- Exactly one routine per training day; number of routines = days per week requested.',
    '- "day" is the weekday: 1=Monday ... 7=Sunday. Spread the days with rest in between when possible.',
    '- Fit each session in the available minutes (about 3-4 minutes per working set including rest).',
    '- Prefer compound lifts first, then accessories. Balance push/pull and upper/lower over the week.',
    '- sets 1-6, reps 1-30, rest in seconds 30-300. Use "linear" progression for heavy compound lifts, "double" for accessories, "none" for bodyweight/cardio.',
    '- Respect injuries and limitations in the notes: avoid exercises that stress the affected area.',
    `- Write routine names, notes and summary in ${LANG_NAME[lang] || 'English'}. Keep names short (e.g. "Push A", "Lower body").`,
    '- Be brief: routine "notes" is ONE short sentence (max 20 words); "summary" is at most 2 short sentences.',
    '- Do not give medical advice.',
  ].join('\n');
  const user = [
    `Goal: ${input.goal}`,
    `Experience level: ${input.level}`,
    `Training days per week: ${input.days}`,
    `Minutes per session: ${input.minutes}`,
    input.weightKg ? `Body weight: ${input.weightKg} kg` : null,
    input.heightCm ? `Height: ${input.heightCm} cm` : null,
    input.notes ? `Notes from the user (injuries, focus, preferences): ${String(input.notes).slice(0, 500)}` : null,
    '',
    'Catalog (id|name|main muscle|equipment):',
    list,
  ]
    .filter((x) => x !== null)
    .join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// Formato exigido do modelo (Structured Outputs, strict)
export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'routines'],
  properties: {
    summary: { type: 'string', description: 'At most two short sentences explaining the plan.' },
    routines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'day', 'notes', 'exercises'],
        properties: {
          name: { type: 'string' },
          day: { type: 'integer', description: '1=Monday ... 7=Sunday' },
          notes: { type: 'string', description: 'One short sentence.' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'sets', 'reps', 'rest', 'progression'],
              properties: {
                id: { type: 'string', description: 'Exercise id from the catalog, e.g. og0025' },
                sets: { type: 'integer' },
                reps: { type: 'integer' },
                rest: { type: 'integer', description: 'Rest in seconds' },
                progression: { type: 'string', enum: ['none', 'linear', 'double'] },
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

// Confere a resposta: só ids conhecidos, números em faixas sensatas, dias 1–7 sem repetir.
// findCatalog(id) -> exercício do catálogo. Retorna { summary, routines } ou null se não sobrar nada.
export function validatePlan(raw, findCatalog, { maxRoutines = 7 } = {}) {
  if (!raw || !Array.isArray(raw.routines)) return null;
  const usedDays = new Set();
  const routines = [];
  for (const r of raw.routines.slice(0, maxRoutines)) {
    const seen = new Set();
    const exercises = (r.exercises || [])
      .filter((x) => {
        const ok = x && typeof x.id === 'string' && findCatalog(x.id) && !seen.has(x.id);
        if (ok) seen.add(x.id);
        return ok;
      })
      .slice(0, 12)
      .map((x) => {
        const cat = findCatalog(x.id);
        const reps = clamp(x.reps, 1, 30, 10);
        const progression =
          x.progression === 'linear'
            ? { type: 'linear', increment: 2.5 }
            : x.progression === 'double'
              ? { type: 'double', increment: 2.5, repMin: reps, repMax: Math.min(30, reps + 4) }
              : null;
        return {
          id: cat.id,
          name: cat.name.en,
          gif: cat.gif,
          sets: clamp(x.sets, 1, 6, 3),
          reps,
          rest: clamp(x.rest, 30, 300, 90),
          ...(progression ? { progression } : {}),
        };
      });
    if (!exercises.length) continue;
    let day = clamp(r.day, 1, 7, 1);
    while (usedDays.has(day) && usedDays.size < 7) day = (day % 7) + 1;
    usedDays.add(day);
    routines.push({ name: String(r.name || 'Treino').slice(0, 60), day, notes: String(r.notes || '').slice(0, 300), exercises });
  }
  if (!routines.length) return null;
  routines.sort((a, b) => a.day - b.day);
  return { summary: String(raw.summary || '').slice(0, 800), routines };
}

// Texto da resposta da Responses API (o primeiro output_text de uma mensagem)
export function outputText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  for (const item of response?.output || []) {
    if (item.type !== 'message') continue;
    for (const c of item.content || []) if (c.type === 'output_text' && typeof c.text === 'string') return c.text;
  }
  return null;
}
