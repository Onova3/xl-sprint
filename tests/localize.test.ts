import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_SYNTAX,
  localFunctionList,
  nameStatus,
  syntaxProblems,
  toCanonical,
  toLocal,
} from '../src/localize';
import type { Syntax } from '../src/types';

const fr = DEFAULT_SYNTAX.fr;
const en = DEFAULT_SYNTAX.en;
const enSemicolon: Syntax = { ...en, listSep: ';', decimalSep: ',', arrayColSep: ';', arrayRowSep: '.' };

describe('toLocal (fr-FR)', () => {
  it.each([
    ['=SUM(C2:C100)', '=SOMME(C2:C100)'],
    ['=ROUND(C2*1.2,2)', '=ARRONDI(C2*1,2;2)'],
    ['=VLOOKUP(H2,A2:D100,4,FALSE)', '=RECHERCHEV(H2;A2:D100;4;FAUX)'],
    ['=TEXTJOIN(", ",TRUE,B2)', '=JOINDRE.TEXTE(", ";VRAI;B2)'],
    ['=LARGE(C2:C100,{1;2;3})', '=GRANDE.VALEUR(C2:C100;{1.2.3})'],
    ['={1,2;3,4}', '={1;2.3;4}'],
    ['=SUM({1.5,2})', '=SOMME({1,5;2})'],
    ['=IF(A1="SUM(1,2)",1,0)', '=SI(A1="SUM(1,2)";1;0)'],
    ['=LET(x,C2*1.2,ROUND(x,2))', '=LET(x;C2*1,2;ARRONDI(x;2))'],
    ['=LET(f,LAMBDA(x,x*2),f(21))', '=LET(f;LAMBDA(x;x*2);f(21))'],
    ["='My sheet'!A1+LOG10(2)", "='My sheet'!A1+LOG10(2)"],
    ['=SUM(Sales[Amount],Table1[[#Headers],[Qty]])', '=SOMME(Sales[Amount];Table1[[#Headers],[Qty]])'],
  ])('%s', (canon, local) => {
    expect(toLocal(canon, fr)).toBe(local);
    expect(toCanonical(local, fr)).toBe(canon);
  });
});

describe('toCanonical', () => {
  it('accepte les noms anglais dans un profil français', () => {
    expect(toCanonical('=SUM(A1;A2)', fr)).toBe('=SUM(A1,A2)');
  });
  it('met les noms en majuscules', () => {
    expect(toCanonical('=somme(a1;2,5)', fr)).toBe('=SUM(a1,2.5)');
  });
  it('anglais + ;', () => {
    expect(toCanonical('=ROUND(A1*1,5;2)', enSemicolon)).toBe('=ROUND(A1*1.5,2)');
    expect(toLocal('=ROUND(A1*1.5,2)', enSemicolon)).toBe('=ROUND(A1*1,5;2)');
  });
  it('profil anglais : identité', () => {
    expect(toLocal('=SUM({1,2;3,4})', en)).toBe('=SUM({1,2;3,4})');
  });
});

describe('profil et listes', () => {
  it('refuse des séparateurs incompatibles', () => {
    expect(syntaxProblems(fr)).toEqual([]);
    expect(syntaxProblems({ ...fr, arrayRowSep: ';' })).not.toEqual([]);
    expect(syntaxProblems({ ...fr, listSep: ',' })).not.toEqual([]);
  });
  it('liste des fonctions en français, triée', () => {
    const l = localFunctionList('fr');
    expect(l).toContain('SOMME');
    expect(l).toContain('RECHERCHEX');
    expect([...l].sort((a, b) => a.localeCompare(b, 'fr'))).toEqual(l);
  });
  it('statut des traductions', () => {
    expect(nameStatus('XLOOKUP', 'fr')).toBe('verified');
    expect(nameStatus('SUM', 'fr')).toBe('toVerify');
    expect(nameStatus('RANK', 'fr')).toBe('missing');
  });
});

/* Aller-retour sur tout le contenu : chaque formule canonique de data/exercises doit revenir intacte. */
function allFormulas(): [string, string][] {
  const dir = join(__dirname, '../data/exercises');
  const out: [string, string][] = [];
  for (const f of readdirSync(dir)) {
    const items = JSON.parse(readFileSync(join(dir, f), 'utf8')).items as Record<string, unknown>[];
    for (const it of items)
      for (const k of ['solutions', 'accepted', 'formula'])
        for (const s of ([] as unknown[]).concat(it[k] ?? []))
          if (typeof s === 'string') out.push([`${f}#${it.id} ${k}`, s]);
  }
  return out;
}

describe('aller-retour localize sur tout le contenu', () => {
  const formulas = allFormulas();
  it('trouve du contenu', () => expect(formulas.length).toBeGreaterThan(150));
  for (const [name, syn] of [
    ['fr-FR', fr],
    ['en + ;', enSemicolon],
    ['en-US', en],
  ] as const) {
    it.each(formulas)(`${name} %s`, (_id, s) => {
      const local = toLocal(s, syn);
      expect(toCanonical(local, syn)).toBe(s);
    });
  }
});
