/* Coach Tab : nombre minimal de frappes pour taper une formule avec la complétion du joueur. */

import type { Syntax } from '../types';
import { completableWord, completions } from './completion';

export interface TabTip {
  /** Mot complété (nom de fonction ou nom LET / LAMBDA). */
  word: string;
  /** Lettres à taper avant Tab. */
  prefix: string;
  /** Frappes économisées par rapport à la saisie complète du mot. */
  saved: number;
}
export interface KeystrokePlan {
  min: number;
  /** Nombre de caractères (frappe sans Tab). */
  chars: number;
  tips: TabTip[];
}

/** Programmation dynamique : une touche par caractère, ou un préfixe + Tab qui pose le mot complet. */
export function minKeystrokes(target: string, syn: Syntax): KeystrokePlan {
  const n = target.length;
  const cost = new Array<number>(n + 1).fill(Infinity);
  const from: ({ i: number; tip: TabTip | null } | null)[] = new Array(n + 1).fill(null);
  cost[0] = 0;
  for (let i = 0; i < n; i++) {
    if (cost[i] === Infinity) continue;
    if (cost[i] + 1 < cost[i + 1]) {
      cost[i + 1] = cost[i] + 1;
      from[i + 1] = { i, tip: null };
    }
    const w = completableWord(target.slice(0, i));
    if (!w) continue;
    const o = completions(w.word, w.before, syn)[0];
    if (!o) continue;
    const start = i - w.word.length;
    const end = start + o.insert.length;
    if (end <= i || target.slice(start, end).toUpperCase() !== o.insert.toUpperCase()) continue;
    if (cost[i] + 1 < cost[end]) {
      cost[end] = cost[i] + 1;
      const full = o.insert.length;
      from[end] = { i, tip: { word: o.label, prefix: w.word, saved: full - w.word.length - 1 } };
    }
  }
  const tips: TabTip[] = [];
  for (let k = n; k > 0 && from[k]; k = (from[k] as { i: number }).i) {
    const f = from[k] as { i: number; tip: TabTip | null };
    if (f.tip && f.tip.saved > 0) tips.unshift(f.tip);
  }
  return { min: cost[n], chars: n, tips };
}
