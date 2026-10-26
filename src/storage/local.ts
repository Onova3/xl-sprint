/* Accès à localStorage (peut être indisponible : navigation privée, fichier local bloqué…). */

import { emptyProgress, KEY_V1, KEY_V2, MAX_SESSIONS, mergeProgress, migrate } from './progress';
import type { Progress } from '../types';

export function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Charge la progression v2 ; à défaut, migre celle de la v1.1 (la clé v1 reste intacte). */
export function loadProgress(): Progress {
  const v2 = migrate(readJson(KEY_V2));
  const v1 = migrate(readJson(KEY_V1));
  if (v2 && v1) return mergeProgress(v1, v2);
  return v2 ?? v1 ?? emptyProgress();
}
export function saveProgress(p: Progress): void {
  p.sessions = p.sessions.slice(-MAX_SESSIONS);
  writeJson(KEY_V2, p);
}
