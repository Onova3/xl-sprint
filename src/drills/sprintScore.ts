/* Scores du mode Sprint (façon Monkeytype), sans DOM. */

export interface KeyEvent {
  /** ms depuis le début du test. */
  t: number;
  ok: boolean;
}
export interface SprintScore {
  /** Caractères justes par minute. */
  net: number;
  /** Toutes frappes de caractères par minute. */
  raw: number;
  formulasPerMin: number;
  /** % de frappes justes. */
  acc: number;
  /** 100 − coefficient de variation de la vitesse par seconde (0 à 100). */
  consistency: number;
  /** Par seconde : caractères justes et erreurs. */
  perSecond: { ok: number; err: number }[];
}

export function scoreRun(events: KeyEvent[], durationMs: number, formulasDone: number): SprintScore {
  const minutes = Math.max(durationMs, 1) / 60000;
  const ok = events.filter((e) => e.ok).length;
  const secs = Math.max(1, Math.ceil(durationMs / 1000));
  const perSecond = Array.from({ length: secs }, () => ({ ok: 0, err: 0 }));
  for (const e of events) {
    const s = perSecond[Math.min(secs - 1, Math.floor(e.t / 1000))];
    if (e.ok) s.ok++;
    else s.err++;
  }
  const speeds = perSecond.map((s) => s.ok * 60);
  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const sd = Math.sqrt(speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / speeds.length);
  const consistency = mean > 0 ? Math.max(0, Math.min(100, 100 * (1 - sd / mean))) : 0;
  return {
    net: ok / minutes,
    raw: events.length / minutes,
    formulasPerMin: formulasDone / minutes,
    acc: events.length ? (100 * ok) / events.length : 0,
    consistency,
    perSecond,
  };
}

/** Position attendue du fantôme (caractères tapés) au temps t, d'après la série par seconde du record. */
export function ghostChars(recordPerSecond: number[], tMs: number): number {
  const s = tMs / 1000;
  let total = 0;
  for (let i = 0; i < recordPerSecond.length; i++) {
    if (s >= i + 1) total += recordPerSecond[i];
    else {
      total += recordPerSecond[i] * Math.max(0, s - i);
      break;
    }
  }
  return total;
}
