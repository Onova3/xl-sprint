/* Progression du joueur : versionnée, avec migration depuis la v1.1.
   Fonctions pures ici ; l'accès à localStorage est dans storage/local.ts. */

import type { Progress, SessionRecord } from '../types';

export const KEY_V1 = 'xlsprint.progress.v1';
export const KEY_V2 = 'xlsprint.progress.v2';
export const MAX_SESSIONS = 400;

export const emptyProgress = (): Progress => ({ version: 2, sessions: [], weak: {} });

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

function cleanSessions(list: unknown): SessionRecord[] {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (s): s is SessionRecord =>
      isObj(s) &&
      typeof s.s === 'string' &&
      typeof s.t === 'number' &&
      typeof s.metric === 'number' &&
      typeof s.acc === 'number',
  );
}
function cleanWeak(w: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (isObj(w)) for (const [k, v] of Object.entries(w)) if (typeof v === 'number' && v > 0) out[k] = v;
  return out;
}

/** Accepte une progression v1.1 ({ v: 1, sessions, weak }) ou v2, renvoie une v2 (ou null si illisible). */
export function migrate(raw: unknown): Progress | null {
  if (!isObj(raw)) return null;
  if (raw.version === 2 || raw.v === 1) {
    return { version: 2, sessions: cleanSessions(raw.sessions), weak: cleanWeak(raw.weak) };
  }
  return null;
}

/** Fusion sans doublon (même étape et même horodatage), comme la v1.1. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const seen = new Set<string>(),
    sessions: SessionRecord[] = [];
  for (const s of [...a.sessions, ...b.sessions]) {
    const key = s.s + '|' + s.t;
    if (!seen.has(key)) {
      seen.add(key);
      sessions.push(s);
    }
  }
  sessions.sort((x, y) => x.t - y.t);
  const weak = { ...a.weak };
  for (const [k, v] of Object.entries(b.weak)) weak[k] = Math.max(weak[k] || 0, v);
  return { version: 2, sessions: sessions.slice(-MAX_SESSIONS), weak };
}

export function bumpWeak(p: Progress, id: string, delta: number): void {
  p.weak[id] = Math.max(0, (p.weak[id] || 0) + delta);
  if (p.weak[id] === 0) delete p.weak[id];
}

/** Tirage pondéré : un exercice raté pèse jusqu'à 11 fois plus (formule de la v1.1). */
export function weightedSample<T extends { id: string }>(
  pool: T[],
  n: number,
  weak: Record<string, number>,
  rnd: () => number = Math.random,
): T[] {
  if (!pool.length) return [];
  const items = pool.map((it) => ({ it, w: 1 + 2 * Math.min(weak[it.id] || 0, 5) }));
  const out: T[] = [];
  while (out.length < n && items.length) {
    const total = items.reduce((a, b) => a + b.w, 0);
    let r = rnd() * total,
      i = 0;
    while (r > items[i].w) {
      r -= items[i].w;
      i++;
    }
    out.push(items[i].it);
    items.splice(i, 1);
  }
  while (out.length < n) out.push(pool[Math.floor(rnd() * pool.length)]);
  return out;
}

/* ----------------------------------------------------- export / import -- */

export const EXPORT_KIND = 'xl-sprint-progress';

export interface ExportFile {
  kind: typeof EXPORT_KIND;
  version: 2;
  exportedAt: string;
  progress: Progress;
  settings?: Record<string, unknown>;
  profile?: Record<string, unknown>;
}

export function makeExport(
  progress: Progress,
  settings: Record<string, unknown>,
  profile: Record<string, unknown> | null,
  date = new Date(),
): ExportFile {
  return {
    kind: EXPORT_KIND,
    version: 2,
    exportedAt: date.toISOString(),
    progress,
    settings,
    ...(profile ? { profile } : {}),
  };
}

/** Lit un fichier exporté (ou une progression v1.1 brute copiée depuis localStorage). */
export function parseImport(text: string): ExportFile | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (isObj(raw) && raw.kind === EXPORT_KIND) {
    const progress = migrate(raw.progress);
    if (!progress) return null;
    return {
      kind: EXPORT_KIND,
      version: 2,
      exportedAt: String(raw.exportedAt ?? ''),
      progress,
      settings: isObj(raw.settings) ? raw.settings : undefined,
      profile: isObj(raw.profile) ? raw.profile : undefined,
    };
  }
  const progress = migrate(raw);
  return progress ? { kind: EXPORT_KIND, version: 2, exportedAt: '', progress } : null;
}
