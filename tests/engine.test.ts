// Port Vitest de reference/engine.test.js : toutes les solutions de chaque exercice
// doivent donner le même résultat que la première.
import { describe, expect, it } from 'vitest';
import { runFormula, sameResult, sheetFromRows, type Scalar } from '../src/engine';
import dyn from '../data/exercises/formula-eval.dynamic-arrays.json';
import rx from '../data/exercises/formula-eval.regex.json';
import patterns from '../data/exercises/regex-patterns.json';

type EvalEx = { id: string; sheet: Scalar[][]; solutions: string[] };
const evalItems = [...dyn.items, ...rx.items] as unknown as EvalEx[];

describe('exercices calculés', () => {
  for (const ex of evalItems) {
    const sh = sheetFromRows(ex.sheet);
    it.each(ex.solutions)(`${ex.id} : %s`, (s) => {
      const ref = runFormula(ex.solutions[0], sh);
      expect(ref.ok, ref.ok ? '' : ref.msg).toBe(true);
      const r = runFormula(s, sh);
      expect(r.ok, r.ok ? '' : r.msg).toBe(true);
      if (ref.ok && r.ok) expect(sameResult(ref.value, r.value)).toBe(true);
    });
  }
});

describe('motifs regex', () => {
  type P = { id: string; solution: string; yes: string[]; no: string[] };
  it.each((patterns.items as unknown as P[]).map((p) => [p.id, p] as const))('%s', (_id, p) => {
    const re = new RegExp(p.solution);
    expect(p.yes.every((x) => re.test(x))).toBe(true);
    expect(p.no.some((x) => re.test(x))).toBe(false);
  });
});

describe('cas de calcul', () => {
  it.each([
    ['=1+2*3^2', 19],
    ['=-2^2', 4],
    ['=LET(f,LAMBDA(x,x*2),f(21))', 42],
    ['=ROUND(-2.5,0)', -3],
    ['=MOD(-3,2)', 1],
  ])('%s = %d', (f, v) => {
    const r = runFormula(f, {});
    expect(r.ok && r.value).toBe(v);
  });
  it('refuse r et c comme noms', () => {
    expect(runFormula('=MAKEARRAY(2,2,LAMBDA(r,c,r*c))', {}).ok).toBe(false);
  });
});
