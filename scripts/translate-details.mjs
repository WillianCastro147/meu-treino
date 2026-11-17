#!/usr/bin/env node
// Traduz com a OpenAI a descrição e o passo a passo dos exercícios que o catálogo do openGym deixou em inglês,
// e grava em public/catalog/details-<lang>.json. Pode parar e rodar de novo: continua de onde parou.
//
//   node scripts/translate-details.mjs --dry          só conta o que falta (não chama a OpenAI)
//   node scripts/translate-details.mjs                traduz pt, es e fr
//   node scripts/translate-details.mjs pt             só um idioma
//   node scripts/translate-details.mjs pt --limit 2   só 2 lotes (para testar)
//
// Chave: OPENAI_API_KEY no ambiente ou no arquivo .env.local (o mesmo do Coach). Opcional: OPENAI_MODEL
// (padrão gpt-6-luna). As traduções ficam em scripts/translations/<lang>.json (inglês -> tradução).
import fs from 'node:fs';
import path from 'node:path';
import { LANGS, pendingStrings, applyTranslations, countUntranslated, styleExamples, buildInstructions, BATCH_SCHEMA, checkBatch } from './details-i18n.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const catalog = (f) => path.join(root, 'public', 'catalog', f);
const cacheFile = (l) => path.join(root, 'scripts', 'translations', `${l}.json`);
const readJson = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback);

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const limitAt = args.indexOf('--limit');
const limit = limitAt >= 0 ? Number(args[limitAt + 1]) || 1 : Infinity;
const langs = args.filter((a) => LANGS.includes(a));
const BATCH = 50; // textos por chamada
const PARALLEL = 6; // chamadas ao mesmo tempo
const MODEL = process.env.OPENAI_MODEL || 'gpt-6-luna';

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  const env = path.join(root, '.env.local');
  if (!fs.existsSync(env)) return '';
  const m = fs.readFileSync(env, 'utf8').match(/^\s*OPENAI_API_KEY\s*=\s*["']?([^"'\r\n]+)/m);
  return m ? m[1].trim() : '';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const usage = { input: 0, output: 0 };

async function translateBatch(key, instructions, sources) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    let res;
    try {
      res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          reasoning: { effort: 'low' },
          instructions,
          input: JSON.stringify({ items: sources }),
          text: { format: { type: 'json_schema', name: 'translations', schema: BATCH_SCHEMA, strict: true } },
        }),
        signal: AbortSignal.timeout(120000),
      });
    } catch (e) {
      await sleep(2000 * attempt);
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new Error(`Chave da OpenAI recusada (HTTP ${res.status}). Confira a OPENAI_API_KEY.`);
    if (res.status === 404) throw new Error(`Modelo "${MODEL}" não encontrado (HTTP 404). Ajuste OPENAI_MODEL.`);
    if (!res.ok) {
      await sleep((res.status === 429 ? 15000 : 3000) * attempt);
      continue;
    }
    const body = await res.json();
    usage.input += body.usage?.input_tokens || 0;
    usage.output += body.usage?.output_tokens || 0;
    let out = null;
    try {
      const text = typeof body.output_text === 'string' ? body.output_text : body.output?.find((o) => o.type === 'message')?.content?.find((c) => c.type === 'output_text')?.text;
      out = JSON.parse(text || 'null')?.translations;
    } catch (e) {}
    if (checkBatch(sources, out)) return out.map((t) => t.trim());
  }
  return null; // lote com problema: fica para a próxima vez que o script rodar
}

async function run() {
  const en = readJson(catalog('details-en.json'));
  const key = apiKey();
  if (!dry && !key) {
    console.error('Falta a OPENAI_API_KEY (no ambiente ou no .env.local). Nada foi traduzido.');
    process.exit(1);
  }

  for (const lang of langs.length ? langs : LANGS) {
    const loc = readJson(catalog(`details-${lang}.json`));
    const cache = readJson(cacheFile(lang), {});
    const todo = pendingStrings(en, loc, cache);
    const chars = todo.reduce((n, s) => n + s.length, 0);
    console.log(`\n[${lang}] ${countUntranslated(en, loc)} textos em inglês no app; ${todo.length} textos diferentes para traduzir (${chars.toLocaleString('pt-BR')} caracteres)`);
    if (dry) continue;

    const instructions = buildInstructions(lang, styleExamples(en, loc));
    const batches = [];
    for (let i = 0; i < todo.length && batches.length < limit; i += BATCH) batches.push(todo.slice(i, i + BATCH));

    let done = 0;
    let failed = 0;
    let next = 0;
    const save = () => {
      fs.mkdirSync(path.dirname(cacheFile(lang)), { recursive: true });
      fs.writeFileSync(cacheFile(lang), JSON.stringify(cache, null, 0));
    };
    async function worker() {
      while (next < batches.length) {
        const batch = batches[next++];
        const out = await translateBatch(key, instructions, batch);
        if (out) batch.forEach((s, i) => (cache[s] = out[i]));
        else failed++;
        done++;
        save();
        process.stdout.write(`\r[${lang}] lotes ${done}/${batches.length}${failed ? ` (${failed} com erro)` : ''}   `);
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, batches.length) }, worker));

    const { details, replaced } = applyTranslations(en, loc, cache);
    fs.writeFileSync(catalog(`details-${lang}.json`), JSON.stringify(details));
    console.log(`\n[${lang}] ${replaced} textos trocados; ainda em inglês: ${countUntranslated(en, details)}`);
    if (failed) console.log(`[${lang}] ${failed} lotes deram erro: rode o script de novo para tentar só eles.`);
  }
  if (!dry) console.log(`\nTokens usados: ${usage.input.toLocaleString('pt-BR')} de entrada, ${usage.output.toLocaleString('pt-BR')} de saída (modelo ${MODEL}).`);
}

run().catch((e) => {
  console.error('\n' + e.message);
  process.exit(1);
});
