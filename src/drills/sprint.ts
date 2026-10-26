/* Mode Sprint : logique du test, sans DOM (testable). La vue est dans ui/sprintView.ts. */

import { completableWord, completions } from '../pedagogy/completion';
import { minKeystrokes, type TabTip } from '../pedagogy/keystrokes';
import { recordKey, type SymStats } from '../pedagogy/symbols';
import type { Syntax } from '../types';
import { scoreRun, type KeyEvent, type SprintScore } from './sprintScore';

export type SprintMode = 'time' | 'count';
export type Variant = 'noBack' | 'stopFirst' | 'hidden';
export const TIME_SIZES = [15, 30, 60, 120];
export const COUNT_SIZES = [5, 10, 25];

export interface SprintOptions {
  mode: SprintMode;
  size: number;
  variants: Variant[];
  tab: boolean;
  syn: Syntax;
  /** Formules déjà dans la syntaxe du joueur, dans l'ordre de passage (elles bouclent en mode temps). */
  formulas: string[];
}

export type SprintInput = { kind: 'char'; ch: string } | { kind: 'tab' } | { kind: 'back' };

export interface FormulaLog {
  target: string;
  /** Touches réellement pressées (caractères, Tab, retour arrière). */
  keys: number;
  done: boolean;
}

export interface CoachReport {
  keys: number;
  min: number;
  tips: TabTip[];
}

export class SprintRun {
  typed = '';
  index = 0;
  started = false;
  finished = false;
  t0 = 0;
  endAt = 0;
  events: KeyEvent[] = [];
  symbols: SymStats = {};
  logs: FormulaLog[] = [];
  /** Erreur qui a mis fin au test (variante « arrêt à la première erreur »). */
  stoppedOnError = false;
  private lastKeyT = 0;

  constructor(public opts: SprintOptions) {
    this.logs.push({ target: this.target, keys: 0, done: false });
  }
  get target(): string {
    const f = this.opts.formulas;
    return f[this.index % f.length];
  }
  get formulasDone(): number {
    return this.logs.filter((l) => l.done).length;
  }
  /** Caractères justes tapés (pour le fantôme et la vitesse en direct). */
  get correctChars(): number {
    return this.events.filter((e) => e.ok).length;
  }
  has(v: Variant): boolean {
    return this.opts.variants.includes(v);
  }

  /** Complétion proposée pour le mot en cours (même règle que l'étape 3). */
  candidate(): { prefix: string; insert: string; fn: boolean } | null {
    if (!this.opts.tab) return null;
    const w = completableWord(this.typed);
    if (!w) return null;
    const o = completions(w.word, w.before, this.opts.syn)[0];
    return o ? { prefix: w.word, insert: o.insert, fn: o.fn } : null;
  }

  private put(ch: string, now: number, measure: boolean): boolean {
    const pos = this.typed.length;
    const target = this.target;
    if (pos >= target.length + 3) return true;
    const expected = target[pos];
    const ok = expected !== undefined && expected.toLowerCase() === ch.toLowerCase();
    const t = now - this.t0;
    this.events.push({ t, ok });
    if (measure && expected !== undefined) {
      recordKey(this.symbols, expected, pos > 0 ? target[pos - 1] : null, now - this.lastKeyT, ok);
    }
    this.typed += ch;
    return ok;
  }

  /** Applique une touche ; renvoie true si le test vient de se terminer. */
  key(input: SprintInput, now: number): boolean {
    if (this.finished) return true;
    if (!this.started) {
      if (input.kind !== 'char') return false; // le test démarre à la première touche de caractère
      this.started = true;
      this.t0 = now;
      this.lastKeyT = now;
      if (this.opts.mode === 'time') this.endAt = now + this.opts.size * 1000;
    }
    if (this.tick(now)) return true;
    const log = this.logs[this.logs.length - 1];
    if (input.kind === 'back') {
      if (this.has('noBack')) return false;
      log.keys++;
      this.typed = this.typed.slice(0, -1);
      this.lastKeyT = now;
      return false;
    }
    log.keys++;
    let ok = true;
    if (input.kind === 'tab') {
      const c = this.candidate();
      if (!c) return false;
      for (const ch of c.insert.slice(c.prefix.length)) ok = this.put(ch, now, false) && ok;
    } else ok = this.put(input.ch, now, true);
    this.lastKeyT = now;
    if (!ok && this.has('stopFirst')) {
      this.stoppedOnError = true;
      return this.finish(now);
    }
    if (this.typed.toLowerCase() === this.target.toLowerCase()) {
      log.done = true;
      this.index++;
      this.typed = '';
      if (this.opts.mode === 'count' && this.formulasDone >= this.opts.size) return this.finish(now);
      this.logs.push({ target: this.target, keys: 0, done: false });
    }
    return false;
  }

  /** À appeler régulièrement : termine le test en mode temps. */
  tick(now: number): boolean {
    if (this.finished) return true;
    if (this.started && this.opts.mode === 'time' && now >= this.endAt) return this.finish(this.endAt);
    return false;
  }
  private finish(now: number): boolean {
    this.finished = true;
    this.endAt = now;
    return true;
  }
  elapsed(now: number): number {
    if (!this.started) return 0;
    return (this.finished ? this.endAt : now) - this.t0;
  }
  score(): SprintScore {
    return scoreRun(this.events, this.endAt - this.t0, this.formulasDone);
  }
  /** Coach Tab sur les formules terminées : frappes réelles et minimum possible. */
  coach(): CoachReport {
    let keys = 0,
      min = 0;
    const tips = new Map<string, TabTip>();
    for (const l of this.logs) {
      if (!l.done) continue;
      const plan = minKeystrokes(l.target, this.opts.syn);
      keys += l.keys;
      min += plan.min;
      for (const tip of plan.tips) if (!tips.has(tip.word)) tips.set(tip.word, tip);
    }
    return { keys, min, tips: [...tips.values()].sort((a, b) => b.saved - a.saved) };
  }
}

/** Ordre de passage : mélange, puis répétition pour couvrir un test en mode temps. */
export function sprintOrder<T>(pool: T[], n: number, rnd: () => number = Math.random): T[] {
  if (!pool.length) return [];
  const out: T[] = [];
  while (out.length < n) {
    const copy = [...pool];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    out.push(...copy);
  }
  return out.slice(0, n);
}
