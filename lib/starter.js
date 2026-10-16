// Planos prontos. Seleção de exercícios, séries e repetições adaptada do openGym
// (frontend/src/lib/starter.js, AGPL-3.0). Ids do catálogo do Moviq = 'og' + id do openGym.
//
// Rotina: [chave, nomes nos 4 idiomas, [[id, séries, reps], ...]]
// schedule: [[dia, chave]] com 1 = segunda ... 7 = domingo

const N = (en, pt, es, fr) => ({ en, pt, es, fr });

const PPL = [
  ['push', N('Push', 'Empurrar (Push)', 'Empuje (Push)', 'Poussée (Push)'), [['0025', 4, 8], ['0047', 3, 10], ['0426', 3, 10], ['0334', 3, 12], ['0241', 3, 12], ['0251', 3, 10]]],
  ['pull', N('Pull', 'Puxar (Pull)', 'Tirón (Pull)', 'Tirage (Pull)'), [['2330', 4, 10], ['0027', 4, 8], ['1323', 3, 10], ['0031', 3, 10], ['0313', 3, 12]]],
  ['legs', N('Legs', 'Pernas', 'Piernas', 'Jambes'), [['0043', 4, 8], ['0085', 3, 10], ['0739', 3, 12], ['0585', 3, 12], ['0586', 3, 12], ['0605', 4, 15]]],
];

const UPPER_LOWER = [
  ['upper-a', N('Upper A', 'Superior A', 'Tren superior A', 'Haut du corps A'), [['0025', 3, 8], ['2330', 3, 10], ['0047', 2, 10], ['1323', 2, 10], ['0334', 2, 12], ['0241', 2, 12], ['0031', 2, 12]]],
  ['lower-a', N('Lower A', 'Inferior A', 'Tren inferior A', 'Bas du corps A'), [['0043', 3, 8], ['0085', 3, 8], ['0739', 2, 10], ['0586', 2, 12], ['0605', 3, 15]]],
  ['upper-b', N('Upper B', 'Superior B', 'Tren superior B', 'Haut du corps B'), [['0047', 3, 8], ['0027', 3, 8], ['0426', 2, 10], ['2330', 2, 10], ['0334', 2, 12], ['0241', 2, 12], ['0313', 2, 12]]],
  ['lower-b', N('Lower B', 'Inferior B', 'Tren inferior B', 'Bas du corps B'), [['0739', 3, 10], ['0085', 2, 10], ['0585', 2, 12], ['0586', 3, 12], ['0605', 3, 15]]],
];

const FULL_BODY = [
  ['fb-a', N('Full Body A', 'Corpo inteiro A', 'Cuerpo completo A', 'Corps entier A'), [['0043', 3, 8], ['0025', 3, 8], ['2330', 3, 10], ['0586', 3, 12], ['0334', 2, 12], ['0031', 2, 12]]],
  ['fb-b', N('Full Body B', 'Corpo inteiro B', 'Cuerpo completo B', 'Corps entier B'), [['0085', 3, 8], ['0047', 3, 10], ['1323', 3, 10], ['0585', 3, 12], ['0334', 2, 12], ['0241', 2, 12]]],
  ['fb-c', N('Full Body C', 'Corpo inteiro C', 'Cuerpo completo C', 'Corps entier C'), [['0739', 3, 10], ['0025', 2, 10], ['0027', 3, 10], ['0426', 2, 10], ['0586', 3, 12], ['0605', 3, 15]]],
];

const FIVE_BY_FIVE = [
  ['5x5-a', N('5×5 A', '5×5 A', '5×5 A', '5×5 A'), [['0043', 5, 5], ['0025', 5, 5], ['0027', 5, 5]]],
  ['5x5-b', N('5×5 B', '5×5 B', '5×5 B', '5×5 B'), [['0085', 5, 5], ['0426', 5, 5], ['2330', 5, 5]]],
  ['5x5-c', N('5×5 C', '5×5 C', '5×5 C', '5×5 C'), [['0739', 5, 5], ['0047', 5, 5], ['1323', 5, 5]]],
];

export const STARTER_PLANS = {
  ppl: { routines: PPL, schedule: [[1, 'push'], [3, 'pull'], [5, 'legs']], rest: 90 },
  'upper-lower': { routines: UPPER_LOWER, schedule: [[1, 'upper-a'], [2, 'lower-a'], [4, 'upper-b'], [5, 'lower-b']], rest: 90 },
  'full-body': { routines: FULL_BODY, schedule: [[1, 'fb-a'], [3, 'fb-b'], [5, 'fb-c']], rest: 90 },
  '5x5': { routines: FIVE_BY_FIVE, schedule: [[1, '5x5-a'], [3, '5x5-b'], [5, '5x5-c']], rest: 150 },
};

// Rotinas prontas para gravar no Supabase + o dia de cada uma.
// findCatalog(id) devolve o exercício do catálogo (nome e foto); lang é o idioma do nome da rotina.
// Retorna { routines: [{ key, name, exercises }], schedule: [[dia, chave]] } ou null.
export function buildStarterPlan(planId, lang, findCatalog) {
  const plan = STARTER_PLANS[planId];
  if (!plan) return null;
  const routines = plan.routines.map(([key, names, list]) => ({
    key,
    name: names[lang] || names.en,
    exercises: list.map(([num, sets, reps]) => {
      const id = 'og' + num;
      const cat = findCatalog(id);
      return {
        id,
        name: cat?.name?.en || id,
        gif: cat?.gif || `/media/still/${num}.webp`,
        sets,
        reps,
        rest: plan.rest,
        // 5×5 e os demais já começam com progressão linear (+2,5 kg)
        progression: { type: 'linear', increment: 2.5 },
      };
    }),
  }));
  return { routines, schedule: plan.schedule };
}
