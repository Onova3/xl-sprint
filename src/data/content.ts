/* Contenu chargé depuis data/ (inclus dans le build : le fichier unique fonctionne hors ligne). */

import shortcuts from '../../data/shortcuts/excel-windows-en.json';
import typing from '../../data/exercises/typing.json';
import formulaText from '../../data/exercises/formula-text.json';
import dyn from '../../data/exercises/formula-eval.dynamic-arrays.json';
import regexEval from '../../data/exercises/formula-eval.regex.json';
import patterns from '../../data/exercises/regex-patterns.json';
import vba from '../../data/exercises/vba.json';
import { availableIn } from '../profile';
import type {
  ExcelVersion,
  FormulaEvalEx,
  FormulaTextEx,
  RegexPatternEx,
  ShortcutEx,
  StepId,
  TypingEx,
  VbaEx,
} from '../types';

export const SHORTCUTS = shortcuts.items as ShortcutEx[];
export const NAV = SHORTCUTS.filter((s) => s.group === 'navigation');
export const FMT = SHORTCUTS.filter((s) => s.group === 'format');
export const TYPING = typing.items as TypingEx[];
export const FORMULAS = formulaText.items as FormulaTextEx[];
export const DYN = dyn.items as unknown as FormulaEvalEx[];
export const REGX = regexEval.items as unknown as FormulaEvalEx[];
export const PATTERNS = patterns.items as RegexPatternEx[];
export const VBA = vba.items as VbaEx[];

export const forVersion = <T extends { minExcel?: ExcelVersion }>(list: T[], excel: ExcelVersion): T[] =>
  list.filter((x) => availableIn(x.minExcel, excel));

export type StepKind = 'keys' | 'typing' | 'formula' | 'eval' | 'regex' | 'vba' | 'case';

export interface Step {
  id: StepId;
  n: number;
  kind: StepKind;
  isNew?: boolean;
  sizes: number[];
  size: number;
  goal: { metric: number; acc: number };
  /** « low » : plus bas = meilleur (secondes) ; « high » : plus haut = meilleur (car./min). */
  better: 'low' | 'high';
}

/** Les 8 étapes de la v1.1 (titres et textes dans i18n : step.<id>.title / .intro). */
export const STEPS: Step[] = [
  { id: 'nav', n: 1, kind: 'keys', sizes: [10, 20, 40], size: 20, goal: { metric: 1.5, acc: 90 }, better: 'low' },
  { id: 'fmt', n: 2, kind: 'keys', sizes: [10, 20, 40], size: 20, goal: { metric: 2.0, acc: 90 }, better: 'low' },
  {
    id: 'typing',
    n: 3,
    kind: 'typing',
    isNew: true,
    sizes: [5, 10, 20],
    size: 10,
    goal: { metric: 180, acc: 95 },
    better: 'high',
  },
  { id: 'formula', n: 4, kind: 'formula', sizes: [5, 10, 20], size: 10, goal: { metric: 12, acc: 90 }, better: 'low' },
  { id: 'dyn', n: 5, kind: 'eval', isNew: true, sizes: [3, 5, 10], size: 5, goal: { metric: 90, acc: 70 }, better: 'low' },
  { id: 'regex', n: 6, kind: 'regex', isNew: true, sizes: [5, 10, 15], size: 5, goal: { metric: 40, acc: 80 }, better: 'low' },
  { id: 'vba', n: 7, kind: 'vba', sizes: [1, 3, 5], size: 3, goal: { metric: 200, acc: 95 }, better: 'high' },
  { id: 'case', n: 8, kind: 'case', sizes: [1, 3, 5], size: 3, goal: { metric: 120, acc: 80 }, better: 'low' },
];
export const stepById = (id: StepId): Step => STEPS.find((s) => s.id === id) as Step;
