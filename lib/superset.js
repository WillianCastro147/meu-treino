// Supersets: na rotina, `linkNext: true` num exercício o junta ao exercício seguinte.
// Uma corrente de links forma um grupo (ex.: A1 → A2 → A3). Durante o treino, faz-se uma
// série de cada exercício do grupo em sequência, e o descanso vem só no fim da rodada.

// Índices agrupados: [[0, 1], [2], [3, 4, 5]]
export function supersetGroups(items) {
  const groups = [];
  let cur = [];
  (items || []).forEach((it, i) => {
    cur.push(i);
    if (!it?.linkNext || i === items.length - 1) {
      groups.push(cur);
      cur = [];
    }
  });
  return groups;
}

// Rótulo de cada exercício: 'A1', 'A2'... para quem está em superset, null para os demais
export function supersetLabels(items) {
  const labels = new Array((items || []).length).fill(null);
  let letter = 0;
  supersetGroups(items).forEach((g) => {
    if (g.length < 2) return;
    const L = String.fromCharCode(65 + (letter++ % 26));
    g.forEach((idx, k) => (labels[idx] = `${L}${k + 1}`));
  });
  return labels;
}

// Remove links inválidos (último item não pode apontar para o próximo)
export function cleanLinks(items) {
  return (items || []).map((it, i) => (it.linkNext && i === items.length - 1 ? { ...it, linkNext: false } : it));
}

// Depois de concluir a série `si` do exercício `ei`: quanto descansar e qual a próxima série.
//   exs: [{ rest, linkNext, sets: [{ done }] }]
// Retorna { rest: segundos, next: { ei, si } | null }
export function afterSetDone(exs, ei, si) {
  const group = supersetGroups(exs).find((g) => g.includes(ei)) || [ei];
  const restOf = (i) => Math.max(0, Number(exs[i]?.rest) || 0);
  if (group.length < 2) return { rest: restOf(ei), next: null };

  const pending = (i, s) => exs[i]?.sets?.[s] && !exs[i].sets[s].done;
  const pos = group.indexOf(ei);

  // Ainda há exercício do grupo para fazer nesta rodada: vai direto, sem descanso
  for (const i of group.slice(pos + 1)) if (pending(i, si)) return { rest: 0, next: { ei: i, si } };

  // Fim da rodada: descanso do último exercício do grupo e volta ao primeiro na próxima série
  const rest = restOf(group[group.length - 1]);
  for (let s = si + 1; s < 50; s++) {
    const i = group.find((g) => pending(g, s));
    if (i !== undefined) return { rest, next: { ei: i, si: s } };
    if (!group.some((g) => exs[g]?.sets?.[s])) break;
  }
  return { rest, next: null };
}
