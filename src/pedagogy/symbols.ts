/* Analyse des symboles : temps et erreurs par caractère et par paire de caractères. */

export interface SymStat {
  /** Frappes justes mesurées. */
  n: number;
  /** Somme des délais (ms) des frappes justes. */
  ms: number;
  /** Erreurs sur ce caractère attendu. */
  err: number;
}
export type SymStats = Record<string, SymStat>;

/** Symboles typiques des formules, suivis en priorité. */
export const FORMULA_SYMBOLS = [
  '(',
  ')',
  '"',
  ',',
  ';',
  '$',
  ':',
  '&',
  '{',
  '}',
  '.',
  '=',
  '<',
  '>',
  '*',
  '-',
  '+',
  '/',
];
/** Au-delà, un délai est une pause, pas une frappe : il n'est pas compté. */
const MAX_GAP_MS = 2000;
const MAX_KEYS = 600;

const key = (kind: 'c' | 'b', s: string) => kind + ':' + s.toUpperCase();

/** Enregistre la frappe d'un caractère attendu `ch` (précédé de `prev`). */
export function recordKey(stats: SymStats, ch: string, prev: string | null, ms: number, ok: boolean): void {
  const add = (k: string) => {
    const s = (stats[k] ??= { n: 0, ms: 0, err: 0 });
    if (!ok) s.err++;
    else if (ms > 0 && ms <= MAX_GAP_MS) {
      s.n++;
      s.ms += ms;
    }
  };
  add(key('c', ch));
  if (prev !== null) add(key('b', prev + ch));
}

/** Fusionne une séance dans le cumul, en gardant au plus MAX_KEYS entrées (les plus fréquentes). */
export function mergeStats(total: SymStats, run: SymStats): SymStats {
  const out: SymStats = { ...total };
  for (const [k, s] of Object.entries(run)) {
    const t = out[k] ?? { n: 0, ms: 0, err: 0 };
    out[k] = { n: t.n + s.n, ms: t.ms + s.ms, err: t.err + s.err };
  }
  const entries = Object.entries(out);
  if (entries.length <= MAX_KEYS) return out;
  entries.sort((a, b) => b[1].n + b[1].err - (a[1].n + a[1].err));
  return Object.fromEntries(entries.slice(0, MAX_KEYS));
}

export interface SymRow {
  sym: string;
  avgMs: number;
  errRate: number;
  n: number;
}
/** Caractères (ou paires) triés du plus lent au plus rapide, erreurs comprises (une erreur vaut 1 s). */
export function slowest(stats: SymStats, kind: 'c' | 'b', only?: string[], minN = 3): SymRow[] {
  const allowed = only ? new Set(only.map((s) => s.toUpperCase())) : null;
  const rows: SymRow[] = [];
  for (const [k, s] of Object.entries(stats)) {
    if (!k.startsWith(kind + ':')) continue;
    const sym = k.slice(2);
    if (allowed && !allowed.has(sym)) continue;
    if (s.n + s.err < minN || s.n === 0) continue;
    rows.push({ sym, avgMs: s.ms / s.n, errRate: s.err / (s.n + s.err), n: s.n });
  }
  const score = (r: SymRow) => r.avgMs + 1000 * r.errRate;
  return rows.sort((a, b) => score(b) - score(a));
}

/** Formules qui contiennent le plus ces symboles (pour un Sprint ciblé), sans en inventer. */
export function pickForSymbols<T>(items: T[], text: (it: T) => string, syms: string[], n: number): T[] {
  const set = new Set(syms.map((s) => s.toUpperCase()));
  const scored = items.map((it) => {
    const s = text(it);
    let hits = 0;
    for (const ch of s) if (set.has(ch.toUpperCase())) hits++;
    return { it, d: hits / Math.max(1, s.length) };
  });
  return scored
    .filter((x) => x.d > 0)
    .sort((a, b) => b.d - a.d)
    .slice(0, n)
    .map((x) => x.it);
}
