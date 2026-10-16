// Coach com IA: gera um plano semanal com a API da OpenAI.
// Roda só no servidor (Vercel): a chave OPENAI_API_KEY nunca vai para o aparelho do usuário.
// Variáveis na Vercel: OPENAI_API_KEY (obrigatória), OPENAI_MODEL (opcional, padrão gpt-6-luna; gpt-6.1-sol é mais caprichado e ~20x mais caro),
// OPENAI_REASONING (opcional: low | medium | high; padrão low, que responde bem mais rápido).
import { createClient } from '@supabase/supabase-js';
import catalogRaw from '@/public/catalog/exercises.json';
import { buildCandidates, buildMessages, DAILY_LIMIT, EQUIPMENT_PRESETS, GOALS, LEVELS, MINUTES, outputText, PLAN_SCHEMA, validatePlan } from '@/lib/coach';
import { isMissingTable } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALL_EQUIPMENT = new Set(Object.values(EQUIPMENT_PRESETS).flat());
const LANGS = ['en', 'pt', 'es', 'fr'];

// Catálogo no formato usado por lib/coach.js
const catalog = catalogRaw.map((e) => ({
  id: e.id,
  name: { en: e.n[0], pt: e.n[1], es: e.n[2], fr: e.n[3] },
  target: e.t,
  eq: e.eq,
  cat: e.c,
  gif: `/media/still/${e.id.slice(2)}.webp`,
}));
const byId = new Map(catalog.map((e) => [e.id, e]));

const json = (body, status = 200) => Response.json(body, { status });

export async function POST(req) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return json({ error: 'not_configured' }, 503);

  // Usuário logado (token do Supabase enviado pelo app)
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth } = await supabase.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: 'unauthorized' }, 401);

  // Pedido do usuário, sempre conferido no servidor
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return json({ error: 'bad_request' }, 400);
  }
  const input = {
    goal: GOALS.includes(body.goal) ? body.goal : 'hypertrophy',
    level: LEVELS.includes(body.level) ? body.level : 'beginner',
    days: Math.min(6, Math.max(2, Math.round(Number(body.days) || 3))),
    minutes: MINUTES.includes(Number(body.minutes)) ? Number(body.minutes) : 60,
    notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : '',
  };
  const equipment = Array.isArray(body.equipment) ? body.equipment.filter((x) => ALL_EQUIPMENT.has(x)).slice(0, 40) : [];
  const lang = LANGS.includes(body.lang) ? body.lang : 'pt';

  // Limite diário por usuário (se a migração 004 ainda não rodou, segue sem limite)
  const since = new Date(Date.now() - 864e5).toISOString();
  const usage = await supabase.from('coach_usage').select('id', { count: 'exact', head: true }).gte('created_at', since);
  const limitOn = !isMissingTable(usage.error);
  if (limitOn && (usage.count || 0) >= DAILY_LIMIT) return json({ error: 'limit', limit: DAILY_LIMIT }, 429);

  const { data: profile } = await supabase.from('profiles').select('weight_kg, height_cm').eq('id', user.id).single();
  input.weightKg = profile?.weight_kg || null;
  input.heightCm = profile?.height_cm || null;

  const candidates = buildCandidates(catalog, { equipment: equipment.length ? equipment : EQUIPMENT_PRESETS.gym, goal: input.goal, level: input.level });
  const [system, userMsg] = buildMessages(input, candidates, lang);

  let res;
  try {
    res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-6-luna',
        reasoning: { effort: process.env.OPENAI_REASONING || 'low' },
        instructions: system.content,
        input: userMsg.content,
        text: { format: { type: 'json_schema', name: 'workout_plan', schema: PLAN_SCHEMA, strict: true } },
      }),
      signal: AbortSignal.timeout(55000),
    });
  } catch (e) {
    return json({ error: 'timeout' }, 504);
  }
  if (!res.ok) {
    // Não repassa o corpo do erro (pode conter detalhes da conta); só o código
    console.error('OpenAI error', res.status, (await res.text()).slice(0, 300));
    return json({ error: 'upstream', status: res.status }, 502);
  }

  let raw = null;
  try {
    raw = JSON.parse(outputText(await res.json()) || 'null');
  } catch (e) {
    raw = null;
  }
  const plan = validatePlan(raw, (id) => byId.get(id));
  if (!plan) return json({ error: 'invalid_plan' }, 502);

  if (limitOn) await supabase.from('coach_usage').insert({ user_id: user.id });
  return json({ plan, remaining: limitOn ? Math.max(0, DAILY_LIMIT - (usage.count || 0) - 1) : null });
}
