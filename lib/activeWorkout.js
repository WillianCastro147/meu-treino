// Treino em andamento salvo no aparelho: sobrevive a recarregar a página,
// trocar de app ou bloquear a tela.
const KEY = 'moviq_active_workout';

export function loadActive() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveActive(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {}
}

export function clearActive() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (e) {}
}

// Endereço para voltar ao treino: com rotina (?id=) ou treino livre (?livre=1)
export function activeUrl(active) {
  return active?.routineId ? `/treino/executar?id=${active.routineId}` : '/treino/executar?livre=1';
}
