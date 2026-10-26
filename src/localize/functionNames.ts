/* Noms de fonctions par langue d'Excel. Seule source : data/locales/functions.en-fr.json
   ('verified' = sourcé, 'toVerify' = à confirmer, affiché comme tel dans l'interface). */

import { FUNCS } from '../engine';
import enFr from '../../data/locales/functions.en-fr.json';
import type { FnLang } from '../types';

export type NameStatus = 'canonical' | 'verified' | 'toVerify' | 'missing';

const verified: Record<string, string> = enFr.verified;
const toVerify: Record<string, string> = enFr.toVerify;

const EN_TO_FR = new Map<string, string>([...Object.entries(toVerify), ...Object.entries(verified)]);
const FR_TO_EN = new Map<string, string>([...EN_TO_FR].map(([en, fr]) => [fr, en]));

/** Nom local d'une fonction canonique (inchangé si aucune traduction n'existe). */
export function localName(canonical: string, lang: FnLang): string {
  const up = canonical.toUpperCase();
  if (lang === 'en') return up;
  return EN_TO_FR.get(up) ?? up;
}

/** Nom canonique d'un nom saisi ; accepte aussi le nom anglais dans un profil traduit. */
export function canonicalName(local: string, lang: FnLang): string | null {
  const up = local.toUpperCase();
  if (lang === 'fr' && FR_TO_EN.has(up)) return FR_TO_EN.get(up) as string;
  if (EN_TO_FR.has(up) || FUNCS.includes(up)) return up;
  return null;
}

export function nameStatus(canonical: string, lang: FnLang): NameStatus {
  const up = canonical.toUpperCase();
  if (lang === 'en') return 'canonical';
  if (up in verified) return 'verified';
  if (up in toVerify) return 'toVerify';
  return 'missing';
}

/** Liste des fonctions dans la langue du joueur, triée comme dans cette langue. */
export function localFunctionList(lang: FnLang): string[] {
  const names = [...new Set(FUNCS.map((f) => localName(f, lang)))];
  return names.sort((a, b) => a.localeCompare(b, lang === 'fr' ? 'fr' : 'en'));
}
