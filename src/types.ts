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
  group: 'navigation' | 'format';
  action: I18nText;
  context: string;
  keys: string;
  kind: 'chord' | 'ribbon-sequence';
  browserReserved: boolean;
  /** Ce qui peut changer selon la langue d’Excel ou le clavier (null = rien de connu). */
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
  level: 1 | 2 | 3;
  title: I18nText;
  prompt: I18nText;
  hint?: Partial<I18nText>;
  sheet: Scalar[][];
  output: string;
  solutions: string[];
}
export interface RegexPatternEx {
  id: string;
  type: 'regex-pattern';
  level: 1 | 2 | 3;
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

/** Identifiants des 8 étapes, repris de la v1.1 (ils servent de clés dans la progression). */
export type StepId = 'nav' | 'fmt' | 'typing' | 'formula' | 'dyn' | 'regex' | 'vba' | 'case';

/** Une séance terminée (format de la v1.1, plus la configuration du joueur). */
export interface SessionRecord {
  s: StepId;
  t: number;
  n: number;
  ms: number;
  metric: number;
  acc: number;
  mode?: string;
  /** Configuration au moment de la séance : « fnLang|listSep|clavier ». Absent pour les séances v1.1. */
  cfg?: string;
}

export interface Progress {
  version: 3;
  sessions: SessionRecord[];
  /** Points faibles : nombre d’erreurs récentes par exercice (les ratés reviennent plus souvent). */
  weak: Record<string, number>;
  /** Tests du mode Sprint (phase 2). */
  sprints: SprintRecord[];
  /** Analyse des symboles cumulée : « c:X » par caractère, « b:XY » par paire. */
  symbols: Record<string, { n: number; ms: number; err: number }>;
}

/** Un test du mode Sprint. */
export interface SprintRecord {
  t: number;
  mode: 'time' | 'count';
  /** Secondes (mode temps) ou nombre de formules (mode nombre). */
  size: number;
  level: string;
  /** Variantes actives : 'noBack', 'stopFirst', 'hidden', 'symbols'. */
  variants: string[];
  /** Configuration « fnLang|listSep|clavier » : un record par configuration. */
  cfg: string;
  net: number;
  raw: number;
  fpm: number;
  acc: number;
  consistency: number;
  ms: number;
  /** Caractères justes par seconde (pour la courbe et le fantôme). */
  perSecond: number[];
}
