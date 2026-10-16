#!/usr/bin/env node
// Gera o catálogo de exercícios do Moviq a partir do catálogo do openGym (AGPL-3.0, ver LICENSE)
// e copia as animações/fotos (Gym visual, uso licenciado pelo dono do Moviq).
//
//   node scripts/build-catalog.mjs <pasta catalogue do openGym>
//
// Saída:
//   public/catalog/exercises.json       lista compacta (nomes em en/pt/es/fr, parte do corpo, equipamento, músculos)
//   public/catalog/details-<lang>.json  descrição e passos de cada exercício, por idioma
//   public/media/clip/<id>.mp4          animação
//   public/media/still/<id>.webp        foto (miniatura)
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src || !fs.existsSync(path.join(src, 'exercises'))) {
  console.error('Uso: node scripts/build-catalog.mjs <caminho>/openGym/catalogue');
  process.exit(1);
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const out = (...p) => path.join(root, 'public', ...p);

const LANGS = { pt: 'pt-BR', es: 'es', fr: 'fr' };
const i18n = Object.fromEntries(
  Object.entries(LANGS).map(([k, file]) => [k, JSON.parse(fs.readFileSync(path.join(src, 'i18n', file + '.json'), 'utf8'))])
);

// Músculo principal -> grupo do Moviq (filtros e estatísticas) e regiões do desenho do corpo
const TARGET = {
  abs: ['abs', ['abs', 'obliques']],
  pectorals: ['chest', ['chest']],
  biceps: ['biceps', ['biceps']],
  glutes: ['glutes', ['gluteal']],
  delts: ['shoulders', ['deltoids']],
  triceps: ['triceps', ['triceps']],
  'upper back': ['back', ['upper-back', 'trapezius']],
  lats: ['back', ['upper-back']],
  calves: ['calves', ['calves']],
  quads: ['legs', ['quadriceps']],
  forearms: ['forearms', ['forearm']],
  'cardiovascular system': ['cardio', []],
  hamstrings: ['legs', ['hamstring']],
  spine: ['erectors', ['lower-back']],
  traps: ['traps', ['trapezius']],
  adductors: ['legs', ['adductors']],
  'serratus anterior': ['abs', ['serratus']],
  abductors: ['glutes', ['gluteal']],
  'levator scapulae': ['traps', ['trapezius']],
};

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const list = [];
const details = { en: {}, pt: {}, es: {}, fr: {} };
let copied = 0;

for (const f of fs.readdirSync(path.join(src, 'exercises')).sort()) {
  const e = JSON.parse(fs.readFileSync(path.join(src, 'exercises', f), 'utf8'));
  if (e.variantOf) continue; // mesmo exercício em figura feminina
  const id = 'og' + e.id;
  const [muscle, regions] = TARGET[e.target] || [null, []];
  list.push({
    id,
    n: [cap(e.name), ...['pt', 'es', 'fr'].map((l) => cap(i18n[l][e.id]?.name) || cap(e.name))],
    bp: e.bodyPart,
    eq: e.equipment,
    t: e.target,
    m: muscle,
    r: regions,
    c: e.category || null,
  });
  details.en[id] = [e.description || '', e.instructions || []];
  for (const l of ['pt', 'es', 'fr']) {
    const tr = i18n[l][e.id] || {};
    details[l][id] = [tr.description || e.description || '', tr.instructions?.length ? tr.instructions : e.instructions || []];
  }
  for (const [kind, ext] of [['clip', 'mp4'], ['still', 'webp']]) {
    const from = path.join(src, 'media', kind, `${e.id}.${ext}`);
    const to = out('media', kind, `${e.id}.${ext}`);
    if (fs.existsSync(from) && !fs.existsSync(to)) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      copied++;
    }
  }
}

fs.mkdirSync(out('catalog'), { recursive: true });
fs.writeFileSync(out('catalog', 'exercises.json'), JSON.stringify(list));
for (const [l, d] of Object.entries(details)) fs.writeFileSync(out('catalog', `details-${l}.json`), JSON.stringify(d));
console.log(`${list.length} exercícios · ${copied} arquivos de mídia copiados`);
