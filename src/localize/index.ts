/* Conversion canonique (en-US) <-> syntaxe du joueur, sur des jetons.
   Ne touche jamais aux chaînes entre guillemets, aux noms de feuille ni aux références structurées. */

import { FUNCS } from '../engine';
import type { Syntax } from '../types';
import { canonicalName, localName } from './functionNames';
import { lex, type LexSyntax, type LTok } from './tokens';

export * from './functionNames';
export * from './locales';

const CANONICAL: LexSyntax = { decimalSep: '.', listSep: ',', arrayColSep: ',', arrayRowSep: ';' };
const BOOLS = ['TRUE', 'FALSE'];
const isCell = (s: string) => /^\$?[A-Z]{1,3}\$?\d+$/.test(s);

function lexSyntax(p: Syntax): LexSyntax {
  return {
    decimalSep: p.decimalSep,
    listSep: p.listSep,
    arrayColSep: p.arrayColSep,
    arrayRowSep: p.arrayRowSep,
  };
}

/** Un identifiant suivi de « ( » est un appel de fonction. */
function isCall(toks: LTok[], i: number): boolean {
  return toks[i + 1]?.kind === 'other' && toks[i + 1].text === '(';
}

/** Noms déclarés par le joueur : identifiant seul en début d'argument de LET ou LAMBDA, suivi d'un séparateur. */
function userNames(toks: LTok[], toCanon: (s: string) => string | null): Set<string> {
  const names = new Set<string>();
  const stack: string[] = [];
  const sig = toks.map((_t, i) => i).filter((i) => !/^\s+$/.test(toks[i].text));
  sig.forEach((i, k) => {
    const tk = toks[i];
    if (tk.kind === 'other' && tk.text === '(') {
      const prev = sig[k - 1] !== undefined ? toks[sig[k - 1]] : null;
      stack.push(prev && prev.kind === 'id' ? (toCanon(prev.text.toUpperCase()) ?? '') : '');
    } else if (tk.kind === 'other' && tk.text === ')') stack.pop();
    else if (tk.kind === 'id') {
      const fn = stack[stack.length - 1];
      if (fn !== 'LET' && fn !== 'LAMBDA') return;
      const before = toks[sig[k - 1]],
        after = toks[sig[k + 1]];
      const startsArg = before && (before.kind === 'sep' || before.text === '(');
      if (startsArg && after && after.kind === 'sep') names.add(tk.text.toUpperCase());
    }
  });
  return names;
}

function convert(
  src: string,
  from: LexSyntax,
  to: LexSyntax,
  rename: (upper: string) => string | null,
  toCanon: (upper: string) => string | null,
): string {
  const toks = lex(src, from);
  const mine = userNames(toks, toCanon);
  return toks
    .map((t, i) => {
      switch (t.kind) {
        case 'num':
          return from.decimalSep === to.decimalSep ? t.text : t.text.replace(from.decimalSep, to.decimalSep);
        case 'sep':
          if (!t.inArray) return to.listSep;
          return t.text === from.arrayColSep ? to.arrayColSep : to.arrayRowSep;
        case 'id': {
          const up = t.text.toUpperCase();
          const call = isCall(toks, i);
          // les noms du joueur (LET, LAMBDA) ne sont jamais traduits
          if (mine.has(up)) return t.text;
          const canon = toCanon(up);
          const bareFunction = !call && canon !== null && FUNCS.includes(canon) && !isCell(up);
          if (!call && !bareFunction && !(canon && BOOLS.includes(canon))) return t.text;
          return rename(up) ?? t.text;
        }
        default:
          return t.text;
      }
    })
    .join('');
}

/** Formule canonique -> formule dans la langue et les séparateurs du joueur. */
export function toLocal(canonical: string, p: Syntax): string {
  return convert(
    canonical,
    CANONICAL,
    lexSyntax(p),
    (up) => (canonicalName(up, 'en') ? localName(up, p.fnLang) : null),
    (up) => canonicalName(up, 'en'),
  );
}

/** Formule saisie par le joueur -> formule canonique, pour le moteur et les comparaisons. */
export function toCanonical(input: string, p: Syntax): string {
  return convert(
    input,
    lexSyntax(p),
    CANONICAL,
    (up) => canonicalName(up, p.fnLang),
    (up) => canonicalName(up, p.fnLang),
  );
}

/** Problèmes d'un jeu de séparateurs (vide = valide). */
export function syntaxProblems(p: Syntax): string[] {
  const out: string[] = [];
  if (p.listSep === p.decimalSep) out.push('listSep=decimalSep');
  if (p.arrayColSep === p.arrayRowSep) out.push('arrayColSep=arrayRowSep');
  if (p.arrayColSep === p.decimalSep || p.arrayRowSep === p.decimalSep) out.push('arraySep=decimalSep');
  for (const s of [p.arrayColSep, p.arrayRowSep])
    if (s.length !== 1 || /[\p{L}\p{N}"{}()]/u.test(s)) out.push('arraySepInvalid');
  return out;
}
