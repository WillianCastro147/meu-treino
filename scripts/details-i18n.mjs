// Tradução da descrição e do passo a passo dos exercícios (public/catalog/details-<lang>.json).
//
// O catálogo do openGym só traz tradução de parte dos textos; o que falta fica em inglês.
// As traduções feitas por nós ficam em scripts/translations/<lang>.json (texto em inglês -> tradução),
// usadas pelo scripts/translate-details.mjs e pelo scripts/build-catalog.mjs (para não se perderem
// quando o catálogo for gerado de novo).
// Funções puras, testadas em scripts/details-i18n.test.mjs.

export const LANGS = ['pt', 'es', 'fr'];

// Um texto ainda está sem tradução quando é igual ao texto em inglês do mesmo exercício
const untranslated = (enText, locText) => !!enText && (locText === undefined || locText === enText);

// Textos em inglês (sem repetir) que ainda faltam traduzir e não estão no cache
export function pendingStrings(en, loc, cache = {}) {
  const out = new Set();
  for (const id of Object.keys(en)) {
    const [enDesc, enSteps = []] = en[id];
    const [locDesc, locSteps = []] = loc[id] || [];
    if (untranslated(enDesc, locDesc) && !cache[enDesc]) out.add(enDesc);
    if (locSteps.length && locSteps.length !== enSteps.length) continue; // passos já traduzidos pelo openGym
    enSteps.forEach((s, i) => {
      if (untranslated(s, locSteps[i]) && !cache[s]) out.add(s);
    });
  }
  return [...out];
}

// Troca no details-<lang> os textos que ainda estão em inglês pela tradução do cache
export function applyTranslations(en, loc, cache = {}) {
  const out = {};
  let replaced = 0;
  for (const id of Object.keys(en)) {
    const [enDesc, enSteps = []] = en[id];
    const [locDesc, locSteps] = loc[id] || [enDesc, enSteps];
    let desc = locDesc;
    if (untranslated(enDesc, locDesc) && cache[enDesc]) {
      desc = cache[enDesc];
      replaced++;
    }
    // Passos: se a tradução do openGym tem outra quantidade de passos, ela já é uma tradução e fica como está
    let steps = locSteps;
    if (!locSteps || !locSteps.length || locSteps.length === enSteps.length) {
      steps = enSteps.map((s, i) => {
        const cur = locSteps?.[i];
        if (!untranslated(s, cur)) return cur;
        if (cache[s]) replaced++;
        return cache[s] || s;
      });
    }
    out[id] = [desc, steps];
  }
  return { details: out, replaced };
}

// Quantos textos do details-<lang> ainda estão em inglês
export function countUntranslated(en, loc) {
  let n = 0;
  for (const id of Object.keys(en)) {
    const [enDesc, enSteps = []] = en[id];
    const [locDesc, locSteps = []] = loc[id] || [];
    if (untranslated(enDesc, locDesc)) n++;
    if (!locSteps.length || locSteps.length === enSteps.length) enSteps.forEach((s, i) => untranslated(s, locSteps[i]) && n++);
  }
  return n;
}

// Exemplos de tradução que já existem no catálogo, para a IA seguir o mesmo tom
export function styleExamples(en, loc, max = 6) {
  const ex = [];
  for (const id of Object.keys(en)) {
    const [, enSteps = []] = en[id];
    const [, locSteps = []] = loc[id] || [];
    if (locSteps.length !== enSteps.length) continue;
    for (let i = 0; i < enSteps.length && ex.length < max; i++) {
      if (enSteps[i] && locSteps[i] && locSteps[i] !== enSteps[i] && enSteps[i].length > 40) {
        ex.push([enSteps[i], locSteps[i]]);
        break;
      }
    }
    if (ex.length >= max) break;
  }
  return ex;
}

const LANG_NAME = { pt: 'Brazilian Portuguese (pt-BR)', es: 'Spanish', fr: 'French' };
const LANG_VOICE = {
  pt: 'Use the imperative addressed to "você" (e.g. "Deite-se", "Segure", "Mantenha").',
  es: 'Use the informal imperative "tú" (e.g. "Túmbate", "Sujeta", "Mantén").',
  fr: 'Use the informal imperative "tu" (e.g. "Allonge-toi", "Tiens", "Garde").',
};

export function buildInstructions(lang, examples = []) {
  return [
    `You translate gym exercise descriptions and step-by-step instructions from English to ${LANG_NAME[lang]}.`,
    LANG_VOICE[lang],
    'Use the usual gym terminology of that language. Keep numbers, units, sides (left/right) and equipment exactly as in the source.',
    'Translate every item. Keep the meaning, the order and one output item per input item. Do not add notes.',
    examples.length ? 'Follow the tone of these existing translations:\n' + examples.map(([a, b]) => `- "${a}" -> "${b}"`).join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const BATCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['translations'],
  properties: { translations: { type: 'array', items: { type: 'string' } } },
};

// Confere a resposta da IA: mesma quantidade de itens, nenhum vazio
export function checkBatch(sources, translations) {
  if (!Array.isArray(translations) || translations.length !== sources.length) return false;
  return translations.every((t) => typeof t === 'string' && t.trim().length > 0);
}
