// Músculos para o mapa do corpo (geometria em public/body/muscle-paths.json, MuscleMap MIT).
// Cada grupo muscular do catálogo do Moviq acende uma ou mais regiões do desenho.
import { doneSets } from './stats.js';

export const MUSCLE_REGIONS = {
  chest: ['chest'],
  back: ['upper-back'],
  shoulders: ['deltoids'],
  traps: ['trapezius'],
  triceps: ['triceps'],
  biceps: ['biceps'],
  forearms: ['forearm'],
  erectors: ['lower-back'],
  glutes: ['gluteal'],
  legs: ['quadriceps', 'hamstring', 'adductors'],
  calves: ['calves', 'tibialis'],
  abs: ['abs', 'obliques'],
};

// Partes do desenho que nunca recebem cor (só silhueta)
export const INERT_REGIONS = ['head', 'hair', 'neck', 'hands', 'feet', 'knees', 'ankles'];

// Muitos exercícios do catálogo (calistenia, funcional...) vêm sem músculo.
// Deduz pelo nome em inglês; null quando não dá para saber.
const GUESS = [
  [/\b(crunch|sit-?up|plank|ab |abs\b|abdominal|leg raise|hollow|v-?up|russian twist|mountain climber|dead bug|l-?sit)/, 'abs'],
  [/\b(squat|lunge|step-?up|pistol|leg press|wall sit|jump)/, 'legs'],
  [/\b(calf|calves)/, 'calves'],
  [/\b(glute|hip thrust|bridge|donkey kick)/, 'glutes'],
  [/\b(push-?up|chest|dip|fly)/, 'chest'],
  [/\b(pull-?up|chin-?up|row|pulldown|lat\b|back lever|front lever)/, 'back'],
  [/\b(shoulder|pike|handstand|lateral raise|overhead press|military)/, 'shoulders'],
  [/\b(curl)/, 'biceps'],
  [/\b(tricep|skull ?crusher|extension)/, 'triceps'],
  [/\b(shrug)/, 'traps'],
  [/\b(deadlift|good morning|hyperextension|superman)/, 'erectors'],
  [/\b(wrist|grip|forearm)/, 'forearms'],
];

export function muscleOf(catalogExercise) {
  if (!catalogExercise) return null;
  if (catalogExercise.muscle && MUSCLE_REGIONS[catalogExercise.muscle]) return catalogExercise.muscle;
  const name = ` ${(catalogExercise.name?.en || '').toLowerCase()} `;
  for (const [re, m] of GUESS) if (re.test(name)) return m;
  return null;
}

// Séries de trabalho por grupo muscular desde `since` (ms). findCatalog: exercício salvo -> catálogo
export function setsByMuscle(workouts, since, findCatalog) {
  const out = {};
  (workouts || []).forEach((w) => {
    if (since && new Date(w.started_at).getTime() < since) return;
    (w.exercises || []).forEach((ex) => {
      const m = muscleOf(findCatalog(ex));
      const n = doneSets(ex).length;
      if (m && n) out[m] = (out[m] || 0) + n;
    });
  });
  return out;
}

// Nível 0–4 de cada região do desenho, relativo ao músculo mais treinado
export function regionLevels(byMuscle) {
  const max = Math.max(0, ...Object.values(byMuscle));
  const levels = {};
  if (!max) return levels;
  Object.entries(byMuscle).forEach(([m, n]) => {
    const lvl = Math.max(1, Math.ceil((n / max) * 4));
    (MUSCLE_REGIONS[m] || []).forEach((r) => (levels[r] = Math.max(levels[r] || 0, lvl)));
  });
  return levels;
}
