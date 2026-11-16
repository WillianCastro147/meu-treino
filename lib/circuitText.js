'use client';

// Textos de circuito (o que cada modo diz, o contador de rodadas, o resultado e a comparação).
// Separado de lib/circuit.js para o motor continuar sem idioma.
import { useI18n } from '@/lib/i18n';
import { fmtClock } from '@/lib/circuit';

export function useCircuitText() {
  const { t, tf } = useI18n();

  /** O modo numa linha: "AMRAP · 12:00 no relógio". */
  const line = (cfg) => {
    if (!cfg) return '';
    const name = t('ctype_' + cfg.mode);
    if (cfg.mode === 'circuit') return `${name} · ${tf('line_circuit', { n: cfg.rounds })}`;
    if (cfg.mode === 'amrap') return `${name} · ${tf('line_amrap', { time: fmtClock(cfg.cap) })}`;
    if (cfg.mode === 'emom') return `${name} · ${tf('line_emom', { every: fmtClock(cfg.every), n: cfg.count })}`;
    return `${name} · ${tf('line_intervals', { work: fmtClock(cfg.work), rest: fmtClock(cfg.rest), n: cfg.rounds })}`;
  };

  /** Contador da etapa: "Rodada 2 de 5", "Intervalo 4 de 10", AMRAP só "Rodada 3". */
  const roundLabel = (cfg, step, stations) => {
    if (!step || step.k === 'prep') return t('getReady');
    if (cfg.mode === 'emom') return tf('intervalOf', { n: Math.min(step.r * stations + step.m + 1, cfg.count), total: cfg.count });
    if (cfg.mode === 'amrap') return tf('roundN', { n: step.r + 1 });
    return tf('roundOf', { n: Math.min(step.r + 1, cfg.rounds), total: cfg.rounds });
  };

  /** Resultado numa linha: "6 rodadas + 4 reps" (AMRAP) ou "3 rodadas · 4:12". */
  const result = (res) => {
    if (!res) return '';
    if (res.mode === 'amrap') return tf('amrapScore', { rounds: res.rounds, reps: res.extra });
    if (res.mode === 'emom' || res.mode === 'intervals') return `${t('ctype_' + res.mode)} · ${fmtClock(res.sec)}`;
    return tf('roundsTime', { rounds: res.rounds, time: fmtClock(res.sec) });
  };

  /** Hoje contra a última vez (lib/circuit.js compareResult). */
  const compare = (cmp) => {
    if (!cmp) return '';
    if (cmp.kind === 'same') return t('cmpSame');
    if (cmp.kind === 'rounds') return tf(cmp.delta > 0 ? 'cmpMoreRounds' : 'cmpFewerRounds', { n: Math.abs(cmp.delta) });
    if (cmp.kind === 'reps') return tf(cmp.delta > 0 ? 'cmpMoreReps' : 'cmpFewerReps', { n: Math.abs(cmp.delta) });
    return tf(cmp.delta < 0 ? 'cmpFaster' : 'cmpSlower', { round: cmp.round, n: Math.abs(cmp.delta) });
  };

  return { line, roundLabel, result, compare };
}
