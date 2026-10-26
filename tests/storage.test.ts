import { describe, expect, it } from 'vitest';
import {
  bumpWeak,
  emptyProgress,
  makeExport,
  mergeProgress,
  migrate,
  parseImport,
  weightedSample,
} from '../src/storage/progress';

// Forme exacte écrite par la v1.1 sous la clé xlsprint.progress.v1
const V1 = {
  v: 1,
  sessions: [
    { s: 'nav', t: 1000, n: 20, ms: 30000, metric: 1.5, acc: 95 },
    { s: 'typing', t: 2000, n: 10, ms: 60000, metric: 180, acc: 97, mode: 'base' },
  ],
  weak: { n3: 2, 't-base-4': 1 },
};

describe('migration v1.1 → v2', () => {
  it('reprend séances et points faibles', () => {
    const p = migrate(V1);
    expect(p).toEqual({ version: 3, sessions: V1.sessions, weak: V1.weak, sprints: [], symbols: {} });
  });
  it('ignore les entrées abîmées', () => {
    const p = migrate({
      v: 1,
      sessions: [{ s: 'nav' }, null, V1.sessions[0]],
      weak: { a: -1, b: 'x', c: 3 },
    });
    expect(p?.sessions).toHaveLength(1);
    expect(p?.weak).toEqual({ c: 3 });
  });
  it('refuse ce qui n’est pas une progression', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate({ foo: 1 })).toBeNull();
  });
});

describe('migration v2 → v3', () => {
  it('ajoute sprints et symboles vides', () => {
    const p = migrate({ version: 2, sessions: V1.sessions, weak: {} });
    expect(p?.version).toBe(3);
    expect(p?.sprints).toEqual([]);
  });
  it('garde les sprints valides', () => {
    const sp = {
      t: 5,
      mode: 'time',
      size: 30,
      level: 'base',
      variants: [],
      cfg: 'en|,|qwerty-us',
      net: 200,
      raw: 210,
      fpm: 6,
      acc: 95,
      consistency: 80,
      ms: 30000,
      perSecond: [3, 4],
    };
    const p = migrate({
      version: 3,
      sessions: [],
      weak: {},
      sprints: [sp, { t: 1 }],
      symbols: { 'c:(': { n: 2, ms: 500, err: 1 }, bad: 3 },
    });
    expect(p?.sprints).toEqual([sp]);
    expect(p?.symbols).toEqual({ 'c:(': { n: 2, ms: 500, err: 1 } });
    expect(mergeProgress(p!, p!).sprints).toHaveLength(1);
  });
});

describe('fusion et points faibles', () => {
  it('fusionne sans doublon', () => {
    const a = migrate(V1)!;
    const m = mergeProgress(a, a);
    expect(m.sessions).toHaveLength(2);
  });
  it('bumpWeak supprime à zéro', () => {
    const p = emptyProgress();
    bumpWeak(p, 'x', 1);
    bumpWeak(p, 'x', -1);
    expect(p.weak).toEqual({});
  });
  it('tirage pondéré sans répétition tant que possible', () => {
    const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const out = weightedSample(pool, 3, { a: 5 });
    expect(new Set(out.map((x) => x.id)).size).toBe(3);
  });
});

describe('export / import', () => {
  it('aller-retour', () => {
    const p = migrate(V1)!;
    const file = makeExport(p, { nav: 20 }, { uiLang: 'fr' }, new Date(0));
    const back = parseImport(JSON.stringify(file));
    expect(back?.progress).toEqual(p);
    expect(back?.settings).toEqual({ nav: 20 });
    expect(back?.profile).toEqual({ uiLang: 'fr' });
  });
  it('accepte une progression v1.1 brute', () => {
    expect(parseImport(JSON.stringify(V1))?.progress.sessions).toHaveLength(2);
  });
  it('refuse un fichier invalide', () => {
    expect(parseImport('pas du json')).toBeNull();
    expect(parseImport('{"kind":"xl-sprint-progress","progress":3}')).toBeNull();
  });
});

import { makeCase, parseAnswer } from '../src/drills/cases';
describe('mini-cas', () => {
  it('lit les réponses', () => {
    expect(parseAnswer('1,234.5')).toBe(1234.5);
    expect(parseAnswer('1234,5')).toBe(1234.5);
    expect(parseAnswer('$ 1 234')).toBe(1234);
    expect(parseAnswer('12\u00a0€')).toBe(12);
    expect(parseAnswer('abc')).toBeNull();
  });
  it('cas reproductible par graine', () => {
    expect(makeCase(42)).toEqual(makeCase(42));
    expect(makeCase(42).rows).toHaveLength(60);
  });
});
