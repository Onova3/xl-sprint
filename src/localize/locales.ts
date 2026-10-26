/* Syntaxe par défaut selon la langue d'Excel (data/locales/excel-locales.json).
   Les séparateurs des constantes de tableau en français ne sont pas sourcés : ils sont
   réglables dans le profil et signalés « à vérifier » dans l'interface. */

import type { FnLang, Syntax } from '../types';

export const DEFAULT_SYNTAX: Record<FnLang, Syntax> = {
  en: { fnLang: 'en', listSep: ',', decimalSep: '.', arrayColSep: ',', arrayRowSep: ';' },
  // arrayColSep : choix du propriétaire du projet (à vérifier dans un vrai Excel).
  // arrayRowSep : valeur provisoire, obligatoirement différente de arrayColSep (à vérifier).
  fr: { fnLang: 'fr', listSep: ';', decimalSep: ',', arrayColSep: ';', arrayRowSep: '.' },
};

/** Réglages de syntaxe non confirmés par une source, pour l'affichage du badge « à vérifier ». */
export function unverifiedSyntax(p: Syntax): (keyof Syntax)[] {
  const out: (keyof Syntax)[] = [];
  const isEnUs = p.listSep === ',' && p.decimalSep === '.';
  if (!(isEnUs && p.arrayColSep === ',' && p.arrayRowSep === ';')) out.push('arrayColSep', 'arrayRowSep');
  return out;
}
