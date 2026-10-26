/* Types partagés de XL Sprint. */

import type { Scalar } from './engine';

/** Texte affiché, par langue d'interface, avec repli sur l'anglais. */
export type I18nText = { en: string; [lang: string]: string | undefined };

export type UiLang = 'fr' | 'en';
export type FnLang = 'en' | 'fr';
export type ExcelVersion = '2016' | '2019' | '2021' | '2024' | '365';
export const EXCEL_VERSIONS: ExcelVersion[] = ['2016', '2019', '2021', '2024', '365'];
export type KeyboardId = 'qwerty-us' | 'azerty-fr';

/** Profil du joueur : choisi au premier lancement, modifiable ensuite. */
export interface Profile {
  version: 1;
  uiLang: UiLang;
  /** Langue des noms de fonctions Excel, indépendante des séparateurs. */
  fnLang: FnLang;
  listSep: ',' | ';';
  decimalSep: '.' | ',';
  /** Séparateurs des constantes de tableau {1,2;3,4} dans la syntaxe du joueur. */
  arrayColSep: string;
  arrayRowSep: string;
  keyboard: KeyboardId;
  keyboardDetected: boolean;
  os: 'windows';
  excel: ExcelVersion;
}

/** Syntaxe Excel seule (ce dont localize a besoin). */
export type Syntax = Pick<Profile, 'fnLang' | 'listSep' | 'decimalSep' | 'arrayColSep' | 'arrayRowSep'>;

interface BaseEx {
  id: string;
  minExcel?: ExcelVersion;
  functions?: string[];
}
export interface ShortcutEx {
  id: string;
  group: string;
  action: I18nText;
  context: string;
  keys: string;
  kind: 'chord' | 'sequence';
  browserReserved: boolean;
  localized: string | null;
}
export interface TypingEx extends BaseEx {
  type: 'typing';
  level: 'base' | 'mid' | 'hard';
  formula: string;
}
export interface FormulaTextEx extends BaseEx {
  type: 'formula-text';
  prompt: I18nText;
  accepted: string[];
  acceptRegex: string | null;
}
export interface FormulaEvalEx extends BaseEx {
  type: 'formula-eval';
  level: string;
  title: I18nText;
  prompt: I18nText;
  hint?: I18nText;
  sheet: Scalar[][];
  output: string;
  solutions: string[];
}
export interface RegexPatternEx {
  id: string;
  type: 'regex-pattern';
  level: string;
  task: I18nText;
  yes: string[];
  no: string[];
  solution: string;
}
export interface VbaEx {
  id: string;
  type: 'vba';
  code: string;
}
export type Exercise = TypingEx | FormulaTextEx | FormulaEvalEx | RegexPatternEx | VbaEx;

export type StageId = 'keys' | 'ribbon' | 'typing' | 'write' | 'dyn' | 'regex' | 'vba' | 'case';
export const STAGES: StageId[] = ['keys', 'ribbon', 'typing', 'write', 'dyn', 'regex', 'vba', 'case'];

export interface Attempt {
  exId: string;
  ok: boolean;
  ms: number;
  keystrokes: number;
  at: number;
}
export interface Session {
  stage: StageId;
  startedAt: number;
  attempts: Attempt[];
  pausedMs: number;
}
export interface StageProgress {
  best: number | null;
  history: { at: number; score: number }[];
  goal: number | null;
  misses: Record<string, number>;
}
export interface Progress {
  version: 2;
  stages: Record<StageId, StageProgress>;
  updatedAt: number;
}
