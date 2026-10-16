// Preferências guardadas no aparelho (localStorage)
import { DEFAULT_BAR, DEFAULT_PLATES } from './plates.js';

const EFFORT_KEY = 'moviq_effort_scale';
const PLATES_KEY = 'moviq_plates';

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {}
}

// 'off' | 'rpe' | 'rir'
export function loadEffortScale() {
  const v = read(EFFORT_KEY, 'off');
  return ['off', 'rpe', 'rir'].includes(v) ? v : 'off';
}
export const saveEffortScale = (v) => write(EFFORT_KEY, v);

// { bar: 20, plates: [25, 20, ...] }
export function loadPlates() {
  const v = read(PLATES_KEY, null);
  return {
    bar: Number.isFinite(Number(v?.bar)) ? Number(v.bar) : DEFAULT_BAR,
    plates: Array.isArray(v?.plates) && v.plates.length ? v.plates.map(Number) : DEFAULT_PLATES,
  };
}
export const savePlates = (v) => write(PLATES_KEY, v);
