import { describe, expect, it } from 'vitest';
import { completableWord, completions, declaredNames } from '../src/pedagogy/completion';
import { DEFAULT_SYNTAX } from '../src/localize';

describe('complétion Tab', () => {
  it('noms LET et LAMBDA d’abord', () => {
    const c = completions('S', '=LET(sales;A2:A9;LAMBDA(step;', DEFAULT_SYNTAX.fr);
    expect(c.slice(0, 2).map((x) => x.label)).toEqual(['sales', 'step']);
    expect(c[2].fn).toBe(true);
  });
  it('fonctions dans la langue du joueur', () => {
    expect(completions('SOM', '=', DEFAULT_SYNTAX.fr)[0].insert).toBe('SOMME(');
    expect(completions('SU', '=', DEFAULT_SYNTAX.en)[0].insert).toBe('SUBSTITUTE(');
  });
  it('déclarations détectées', () => {
    expect(declaredNames('=LET(a,1,b,2,LAMBDA(x,y,')).toEqual(['a', 'b', 'x', 'y']);
  });
  it('pas de complétion dans une chaîne', () => {
    expect(completableWord('=IF(A1="SU')).toBeNull();
    expect(completableWord('=1+SU')?.word).toBe('SU');
  });
});
