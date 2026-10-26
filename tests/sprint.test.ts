import { describe, expect, it } from 'vitest';
import { SprintRun, sprintOrder, type SprintOptions } from '../src/drills/sprint';
import { DEFAULT_SYNTAX } from '../src/localize';

const opts = (o: Partial<SprintOptions> = {}): SprintOptions => ({
  mode: 'count',
  size: 2,
  variants: [],
  tab: true,
  syn: DEFAULT_SYNTAX.en,
  formulas: ['=SUM(A1)', '=MAX(B2)'],
  ...o,
});
const typeAll = (r: SprintRun, s: string, t0: number, step = 100) => {
  let t = t0;
  for (const ch of s) r.key({ kind: 'char', ch }, (t += step));
  return t;
};

describe('SprintRun', () => {
  it('démarre à la première touche et enchaîne les formules', () => {
    const r = new SprintRun(opts());
    expect(r.key({ kind: 'tab' }, 0)).toBe(false);
    expect(r.started).toBe(false);
    const t = typeAll(r, '=SUM(A1)', 1000);
    expect(r.index).toBe(1);
    typeAll(r, '=MAX(B2)', t);
    expect(r.finished).toBe(true);
    expect(r.formulasDone).toBe(2);
    expect(r.score().acc).toBe(100);
  });
  it('Tab complète et compte une seule touche', () => {
    const r = new SprintRun(opts({ size: 1 }));
    typeAll(r, '=SUM', 0);
    r.key({ kind: 'tab' }, 500);
    expect(r.typed).toBe('=SUM(');
    typeAll(r, 'A1)', 600);
    expect(r.finished).toBe(true);
    const c = r.coach();
    expect(c.keys).toBe(8); // = S U M Tab A 1 )
    expect(c.min).toBeLessThanOrEqual(c.keys);
  });
  it('mode temps : s’arrête à la fin du temps', () => {
    const r = new SprintRun(opts({ mode: 'time', size: 15 }));
    r.key({ kind: 'char', ch: '=' }, 1000);
    expect(r.tick(10000)).toBe(false);
    expect(r.tick(16001)).toBe(true);
    expect(r.elapsed(99999)).toBe(15000);
  });
  it('variantes : sans retour arrière, arrêt à la première erreur', () => {
    const a = new SprintRun(opts({ variants: ['noBack'] }));
    typeAll(a, '=X', 0);
    a.key({ kind: 'back' }, 500);
    expect(a.typed).toBe('=X');
    const b = new SprintRun(opts({ variants: ['stopFirst'] }));
    typeAll(b, '=S', 0);
    expect(b.finished).toBe(false);
    b.key({ kind: 'char', ch: 'x' }, 900);
    expect(b.finished).toBe(true);
    expect(b.stoppedOnError).toBe(true);
  });
  it('symboles mesurés', () => {
    const r = new SprintRun(opts({ size: 1 }));
    typeAll(r, '=SUM(A1)', 0, 200);
    expect(r.symbols['c:(']).toEqual({ n: 1, ms: 200, err: 0 });
  });
  it('ordre de passage', () => {
    expect(sprintOrder([1, 2, 3], 7)).toHaveLength(7);
    expect(new Set(sprintOrder([1, 2, 3], 3))).toEqual(new Set([1, 2, 3]));
  });
});
