/* Info-bulle des arguments : fonction ouverte et argument en cours à la position du curseur. */

import sig from '../../data/signatures/en.json';
import { canonicalName } from '../localize';
import { lex } from '../localize/tokens';
import type { Syntax } from '../types';

const SIGS: Record<string, string[]> = sig.functions;
/** Les signatures sont rédigées d'après Microsoft mais pas encore comparées page par page. */
export const SIGNATURES_VERIFIED = sig.status !== 'toVerify';

export interface OpenCall {
  /** Nom canonique (anglais). */
  fn: string;
  /** Index (0) de l'argument en cours. */
  arg: number;
}

/** Appel de fonction le plus intérieur encore ouvert à la fin de `before` (syntaxe du joueur). */
export function openCallAt(before: string, syn: Syntax): OpenCall | null {
  const toks = lex(before, {
    decimalSep: syn.decimalSep,
    listSep: syn.listSep,
    arrayColSep: syn.arrayColSep,
    arrayRowSep: syn.arrayRowSep,
  });
  const stack: { fn: string | null; arg: number }[] = [];
  toks.forEach((t, i) => {
    if (t.kind === 'other' && t.text === '(') {
      const prev = toks[i - 1];
      const fn = prev && prev.kind === 'id' ? canonicalName(prev.text, syn.fnLang) : null;
      stack.push({ fn, arg: 0 });
    } else if (t.kind === 'other' && t.text === ')') stack.pop();
    else if (t.kind === 'sep' && !t.inArray && stack.length) stack[stack.length - 1].arg++;
  });
  // des parenthèses de regroupement « ( » sans fonction : on remonte à la fonction qui les contient
  for (let k = stack.length - 1; k >= 0; k--) {
    const s = stack[k];
    if (s.fn) return { fn: s.fn, arg: s.arg };
  }
  return null;
}

export const signatureOf = (fn: string): string[] | null => SIGS[fn] ?? null;

/** Index de l'argument à mettre en avant dans la signature (les groupes répétés « … » bouclent). */
export function highlightIndex(args: string[], arg: number): number {
  const rep = args.indexOf('…');
  if (rep < 0) return Math.min(arg, args.length - 1);
  if (arg < rep) return arg;
  // après « … » : arguments finaux (LET, LAMBDA, MAP) ; sinon on reste sur le groupe répété
  const tail = args.length - rep - 1;
  return tail > 0 ? args.length - 1 : rep - 1;
}
