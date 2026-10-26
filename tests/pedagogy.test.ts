import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SYNTAX } from '../src/localize';
import { highlightIndex, openCallAt, signatureOf } from '../src/pedagogy/signature';
import { minKeystrokes } from '../src/pedagogy/keystrokes';
import { mergeStats, pickForSymbols, recordKey, slowest, type SymStats } from '../src/pedagogy/symbols';
import { ghostChars, scoreRun } from '../src/drills/sprintScore';

const fr = DEFAULT_SYNTAX.fr,
  en = DEFAULT_SYNTAX.en;

describe('info-bulle : argument en cours', () => {
  it('anglais, imbriqué', () => {
    expect(openCallAt('=SUMIFS(C2:C9,B2:B9,', en)).toEqual({ fn: 'SUMIFS', arg: 2 });
    expect(openCallAt('=IF(SUM(A1,', en)).toEqual({ fn: 'SUM', arg: 1 });
    expect(openCallAt('=IF(SUM(A1,A2),', en)).toEqual({ fn: 'IF', arg: 1 });
  });
  it('français, chaînes et constantes ignorées', () => {
    expect(openCallAt('=SOMME.SI.ENS(C2:C9;B2:B9;"a;b";', fr)).toEqual({ fn: 'SUMIFS', arg: 3 });
    expect(openCallAt('=SOMME({1;2.3;4};', fr)).toEqual({ fn: 'SUM', arg: 1 });
    expect(openCallAt('=SI((A1+', fr)).toEqual({ fn: 'IF', arg: 0 });
    expect(openCallAt('=A1+2', fr)).toBeNull();
  });
  it('groupes répétés', () => {
    const s = signatureOf('SUMIFS')!;
    expect(s[highlightIndex(s, 2)]).toBe('criteria1');
    expect(highlightIndex(s, 7)).toBe(3);
    const let_ = signatureOf('LET')!;
    expect(let_[highlightIndex(let_, 6)]).toBe('calculation');
  });
  it('toutes les fonctions du contenu ont une signature', () => {
    const missing = new Set<string>();
    const dir = join(__dirname, '../data/exercises');
    for (const f of readdirSync(dir))
      for (const it of JSON.parse(readFileSync(join(dir, f), 'utf8')).items)
        for (const s of [...(it.solutions ?? []), ...(it.accepted ?? []), it.formula ?? ''])
          for (const m of String(s).matchAll(/([A-Z][A-Z0-9.]*)\(/g))
            if (!signatureOf(m[1])) missing.add(m[1]);
    expect([...missing]).toEqual([]);
  });
});

describe('coach Tab', () => {
  it('anglais : =SUM(C2:C100)', () => {
    // « =SU » + Tab donne SUBSTITUTE( ; « =SUM » + Tab donne SUM( → 1 + 3 + 1 + 8 = 13 au lieu de 13 caractères
    const p = minKeystrokes('=SUM(C2:C100)', en);
    expect(p.chars).toBe(13);
    expect(p.min).toBeLessThanOrEqual(13);
  });
  it('français : SOMME.SI.ENS demande « SOMME.SI. » avant Tab (SOMME.SI vient avant)', () => {
    const p = minKeystrokes('=SOMME.SI.ENS(C2:C9;B2:B9;"Est")', fr);
    expect(p.chars).toBe(32);
    expect(p.min).toBe(29);
    expect(p.tips).toEqual([{ word: 'SOMME.SI.ENS', prefix: 'SOMME.SI.', saved: 3 }]);
  });
  it('français : RECHERCHEX ne gagne rien (RECHERCHE, RECHERCHEH, RECHERCHEV passent avant)', () => {
    expect(minKeystrokes('=RECHERCHEX(H2;A2:A9;B2:B9)', fr).tips).toEqual([]);
  });
  it('anglais : XLOOKUP en « X » + Tab', () => {
    const p = minKeystrokes('=XLOOKUP(H2,A2:A9,B2:B9)', en);
    expect(p.tips).toEqual([{ word: 'XLOOKUP', prefix: 'X', saved: 6 }]);
    expect(p.min).toBe(p.chars - 6);
  });
  it('noms LET', () => {
    const p = minKeystrokes('=LET(total_sales,A1,total_sales*2)', en);
    expect(p.tips.some((t) => t.word === 'total_sales')).toBe(true);
  });
});

describe('symboles', () => {
  it('cumul et classement', () => {
    const s: SymStats = {};
    for (let i = 0; i < 5; i++) recordKey(s, '(', 'M', 400, true);
    for (let i = 0; i < 5; i++) recordKey(s, 'a', 'b', 100, true);
    recordKey(s, ';', '1', 0, false);
    for (let i = 0; i < 3; i++) recordKey(s, ';', '1', 200, true);
    const rows = slowest(s, 'c');
    expect(rows[0].sym).toBe(';');
    expect(rows.map((r) => r.sym)).toContain('(');
    expect(slowest(s, 'c', ['(', ';']).map((r) => r.sym)).not.toContain('A');
    expect(mergeStats(s, s)['c:(']).toEqual({ n: 10, ms: 4000, err: 0 });
  });
  it('choix des formules pour un Sprint ciblé', () => {
    const out = pickForSymbols(['=A1', '=SUM((A1))', '=B2+1'], (x) => x, ['('], 2);
    expect(out).toEqual(['=SUM((A1))']);
  });
});

describe('score Sprint', () => {
  it('net, brut, précision', () => {
    const ev = [...Array.from({ length: 30 }, (_, i) => ({ t: i * 100, ok: true })), { t: 3100, ok: false }];
    const s = scoreRun(ev, 6000, 2);
    expect(s.net).toBe(300);
    expect(s.raw).toBe(310);
    expect(s.formulasPerMin).toBe(20);
    expect(Math.round(s.acc)).toBe(97);
    expect(s.perSecond).toHaveLength(6);
  });
  it('régularité parfaite', () => {
    const ev = Array.from({ length: 4 }, (_, i) => ({ t: i * 1000 + 10, ok: true }));
    expect(scoreRun(ev, 4000, 0).consistency).toBe(100);
  });
  it('fantôme', () => {
    expect(ghostChars([5, 5, 5], 1500)).toBe(7.5);
    expect(ghostChars([5, 5], 9000)).toBe(10);
  });
});
