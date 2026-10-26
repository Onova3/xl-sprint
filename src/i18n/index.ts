/* Textes de l'interface en fr et en. Toute chaîne visible passe par t(). */

import fr from './fr.json';
import en from './en.json';
import type { I18nText, UiLang } from '../types';

export type MessageKey = keyof typeof fr;
const DICTS: Record<UiLang, Record<string, string>> = { fr, en };

let lang: UiLang = 'fr';
export const setUiLang = (l: UiLang): void => {
  lang = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
};
export const uiLang = (): UiLang => lang;

/** Message traduit ; {nom} est remplacé par params.nom. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  const s = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Texte de contenu { en, fr, … } dans la langue de l'interface, avec repli sur l'anglais puis sur la 1re langue. */
export function pick(text: Partial<I18nText> | undefined | null): string {
  if (!text) return '';
  return text[lang] ?? text.en ?? Object.values(text).find((v) => typeof v === 'string') ?? '';
}

/* Messages d'erreur du moteur (écrits en français dans le moteur, comme la v1.1). */
const ENGINE_EN: [RegExp, string][] = [
  [/^Guillemet non fermé\.$/, 'Unclosed quotation mark.'],
  [/^Formule vide\.$/, 'Empty formula.'],
  [/^Formule incomplète\.$/, 'Incomplete formula.'],
  [/^« (.+) » attendu avant « (.+) »\.$/, '“$1” expected before “$2”.'],
  [/^« (.+) » attendu en fin de formule\.$/, '“$1” expected at the end of the formula.'],
  [/^Élément inattendu : « (.+) »\.$/, 'Unexpected item: “$1”.'],
  [/^Élément en trop : « (.+) »\.$/, 'Extra item: “$1”.'],
  [/^Caractère inattendu : « (.+) »\.$/, 'Unexpected character: “$1”.'],
  [/^Constante de tableau non fermée\.$/, 'Unclosed array constant.'],
  [/^Constante de tableau invalide\.$/, 'Invalid array constant.'],
  [
    /^Les lignes de la constante de tableau n'ont pas la même longueur\.$/,
    'The rows of the array constant have different lengths.',
  ],
  [
    /^Les références structurées.*$/,
    'Structured references (Table[Column]) are not supported here: use the sheet ranges.',
  ],
  [/^LET attend des paires.*$/, 'LET expects name, value pairs followed by a final calculation.'],
  [/^LAMBDA attend au moins un calcul\.$/, 'LAMBDA expects at least one calculation.'],
  [
    /^Nom de (variable|paramètre) invalide : « (.+) ».*$/,
    'Invalid name: “$2”. Avoid c, r and names that look like a cell (A1, ab12).',
  ],
  [/^Calcul trop profond\.$/, 'Calculation too deep.'],
  [/^Calcul trop long\.$/, 'Calculation too long.'],
  [/^Formule non reconnue : (.*)$/, 'Formula not recognised: $1'],
];
export function engineMessage(msg: string): string {
  if (lang === 'fr') return msg;
  for (const [re, out] of ENGINE_EN) if (re.test(msg)) return msg.replace(re, out);
  return msg;
}
