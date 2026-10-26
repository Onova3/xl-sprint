/* Profil du joueur : langue de l'interface, langue des fonctions, séparateurs, clavier, version d'Excel. */

import { DEFAULT_SYNTAX, syntaxProblems } from './localize';
import { readJson, writeJson } from './storage/local';
import { EXCEL_VERSIONS, type ExcelVersion, type FnLang, type Profile, type Syntax } from './types';

export const PROFILE_KEY = 'xlsprint.profile.v1';

export function defaultProfile(fnLang: FnLang = 'en', uiLang: 'fr' | 'en' = 'fr'): Profile {
  return {
    version: 1,
    uiLang,
    ...DEFAULT_SYNTAX[fnLang],
    keyboard: fnLang === 'fr' ? 'azerty-fr' : 'qwerty-us',
    keyboardDetected: false,
    os: 'windows',
    excel: '365',
  };
}

const oneOf = <T>(v: unknown, list: readonly T[]): v is T => list.includes(v as T);

/** Valide un profil lu (stockage ou import) ; null s'il est incomplet ou incohérent. */
export function readProfile(raw: unknown): Profile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as Record<string, unknown>;
  if (
    p.version !== 1 ||
    !oneOf(p.uiLang, ['fr', 'en'] as const) ||
    !oneOf(p.fnLang, ['fr', 'en'] as const) ||
    !oneOf(p.listSep, [',', ';'] as const) ||
    !oneOf(p.decimalSep, ['.', ','] as const) ||
    typeof p.arrayColSep !== 'string' ||
    typeof p.arrayRowSep !== 'string' ||
    !oneOf(p.keyboard, ['qwerty-us', 'azerty-fr'] as const) ||
    !oneOf(p.excel, EXCEL_VERSIONS)
  )
    return null;
  const prof: Profile = {
    version: 1,
    uiLang: p.uiLang,
    fnLang: p.fnLang,
    listSep: p.listSep,
    decimalSep: p.decimalSep,
    arrayColSep: p.arrayColSep,
    arrayRowSep: p.arrayRowSep,
    keyboard: p.keyboard,
    keyboardDetected: p.keyboardDetected === true,
    os: 'windows',
    excel: p.excel,
  };
  return syntaxProblems(prof).length ? null : prof;
}

export const loadProfile = (): Profile | null => readProfile(readJson(PROFILE_KEY));
export const saveProfile = (p: Profile): boolean => writeJson(PROFILE_KEY, p);

export const syntaxOf = (p: Profile): Syntax => ({
  fnLang: p.fnLang,
  listSep: p.listSep,
  decimalSep: p.decimalSep,
  arrayColSep: p.arrayColSep,
  arrayRowSep: p.arrayRowSep,
});

/** L'exercice est-il disponible dans la version d'Excel du joueur ? */
export function availableIn(minExcel: ExcelVersion | undefined, excel: ExcelVersion): boolean {
  if (!minExcel) return true;
  return EXCEL_VERSIONS.indexOf(minExcel) <= EXCEL_VERSIONS.indexOf(excel);
}

/** Clé de configuration enregistrée avec chaque séance. */
export const configKey = (p: Profile): string => `${p.fnLang}|${p.listSep}|${p.keyboard}`;
