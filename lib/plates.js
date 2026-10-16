// Calculadora de anilhas: quais anilhas pôr em CADA lado da barra para chegar a uma carga.
// Trabalha em centésimos de kg para evitar erro de ponto flutuante e escolhe, entre as
// combinações possíveis, a que chega mais perto da carga (sem passar) com menos anilhas.

export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
export const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5];
export const BAR_OPTIONS = [20, 15, 10, 7, 0];
export const DEFAULT_BAR = 20;

const toCents = (v) => Math.round(Number(v) * 100);

// Retorna { perSide: [20, 10, 2.5], total, remainder } ou null se a carga for menor que a barra
export function platesFor(target, bar = DEFAULT_BAR, available = DEFAULT_PLATES) {
  const t = toCents(target);
  const b = toCents(bar);
  if (!Number.isFinite(t) || t < b) return null;

  const side = Math.floor((t - b) / 2);
  const plates = [...new Set(available.map(toCents).filter((p) => p > 0))].sort((a, b2) => b2 - a);
  if (!plates.length || side === 0) return { perSide: [], total: b / 100, remainder: (t - b) / 100 };

  // Mochila ilimitada: menor número de anilhas para cada soma até `side`
  const INF = Infinity;
  const count = new Array(side + 1).fill(INF);
  const pick = new Array(side + 1).fill(0);
  count[0] = 0;
  for (let s = 1; s <= side; s++) {
    for (const p of plates) {
      if (p <= s && count[s - p] + 1 < count[s]) {
        count[s] = count[s - p] + 1;
        pick[s] = p;
      }
    }
  }
  let best = side;
  while (best > 0 && count[best] === INF) best--;

  const perSide = [];
  for (let s = best; s > 0; s -= pick[s]) perSide.push(pick[s] / 100);
  perSide.sort((a, b2) => b2 - a);
  const total = (b + best * 2) / 100;
  return { perSide, total, remainder: Math.round((t - b - best * 2)) / 100 };
}

// Agrupa [20, 20, 5] em [{ plate: 20, n: 2 }, { plate: 5, n: 1 }]
export function groupPlates(perSide) {
  const out = [];
  perSide.forEach((p) => {
    const last = out[out.length - 1];
    if (last && last.plate === p) last.n += 1;
    else out.push({ plate: p, n: 1 });
  });
  return out;
}
