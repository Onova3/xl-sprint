/* Complétion Tab, comme dans Excel 365 : d'abord les noms déclarés (LET / LAMBDA),
   puis les fonctions dans la langue du joueur, chaque groupe dans l'ordre alphabétique. */

import { localFunctionList, toCanonical } from '../localize';
import type { FnLang, Syntax } from '../types';

/** Noms déclarés plus tôt dans une formule canonique : variables de LET et paramètres de LAMBDA. */
export function declaredNames(text: string): string[] {
  const names: string[] = [],
    seen = new Set<string>(),
    stack: { fn: string; idx: number; arg: string[] }[] = [];
  const tokRe = /"(?:[^"]|"")*"?|\[[A-Za-z_\\][A-Za-z0-9_.]*\]|[A-Za-z_\\][A-Za-z0-9_.]*|\d+(?:\.\d+)?|\S/g;
  let prev: string | null = null,
    m: RegExpExecArray | null;
  while ((m = tokRe.exec(text))) {
    const t = m[0];
    if (t === '(') {
      stack.push({ fn: prev && /^[A-Za-z_]/.test(prev) ? prev.toUpperCase() : '', idx: 0, arg: [] });
      prev = t;
      continue;
    }
    const top = stack[stack.length - 1];
    if (t === ',' && top) {
      if (top.arg.length === 1) {
        let id = top.arg[0];
        if (top.fn === 'LAMBDA' && /^\[.*\]$/.test(id)) id = id.slice(1, -1);
        const ok =
          /^[A-Za-z_\\][A-Za-z0-9_.]*$/.test(id) &&
          !/^\$?[A-Za-z]{1,3}\$?\d+$/.test(id) &&
          !/^(TRUE|FALSE)$/i.test(id);
        if (ok && ((top.fn === 'LET' && top.idx % 2 === 0) || top.fn === 'LAMBDA')) {
          const k = id.toUpperCase();
          if (!seen.has(k)) {
            seen.add(k);
            names.push(id);
          }
        }
      }
      top.idx++;
      top.arg = [];
      prev = t;
      continue;
    }
    if (t === ')') {
      stack.pop();
      prev = t;
      continue;
    }
    if (top) top.arg.push(t);
    prev = t;
  }
  return names;
}

export interface Completion {
  label: string;
  insert: string;
  fn: boolean;
}

const listCache = new Map<FnLang, string[]>();
function functions(lang: FnLang): string[] {
  if (!listCache.has(lang)) listCache.set(lang, localFunctionList(lang));
  return listCache.get(lang) as string[];
}

/** `before` est le texte saisi avant le mot en cours, dans la syntaxe du joueur. */
export function completions(prefix: string, before: string, syn: Syntax): Completion[] {
  const up = prefix.toUpperCase(),
    out: Completion[] = [];
  const names = declaredNames(toCanonical(before, syn))
    .filter((n) => n.toUpperCase().startsWith(up))
    .sort((x, y) => (x.toUpperCase() < y.toUpperCase() ? -1 : 1));
  for (const n of names) out.push({ label: n, insert: n, fn: false });
  for (const f of functions(syn.fnLang))
    if (f.startsWith(up)) out.push({ label: f, insert: f + '(', fn: true });
  return out;
}

/** Mot en cours de frappe à la fin de `left`, s'il peut être complété. */
export function completableWord(left: string): { word: string; before: string } | null {
  const m = /([A-Za-z_][A-Za-z0-9._]*)$/.exec(left);
  if (!m) return null;
  const before = left.slice(0, left.length - m[1].length);
  if (before && !/[=(,+\-*/&^<>:{;.\s]$/.test(before)) return null;
  if ((before.match(/"/g) || []).length % 2) return null;
  return { word: m[1], before };
}
