/* Étape 8 : génération des mini-cas (jeu de données aléatoire + question), repris de la v1.1. */

import type { MessageKey } from '../i18n';

export function rng(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const REGIONS = ['North', 'South', 'East', 'West'];
const PRODUCTS: [string, number][] = [
  ['Laptop', 899],
  ['Monitor', 219],
  ['Keyboard', 49],
  ['Mouse', 25],
  ['Headset', 79],
  ['Dock', 149],
];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June'];

export interface CaseRow {
  id: string;
  m: number;
  date: string;
  region: string;
  product: string;
  units: number;
  price: number;
}
export interface MiniCase {
  seed: number;
  rows: CaseRow[];
  tsv: string;
  /** Question : clé i18n et paramètres (les valeurs du jeu de données restent en anglais). */
  q: MessageKey;
  params: Record<string, string | number>;
  ans: number | string;
  text?: boolean;
  /** Piste de solution, en syntaxe canonique. */
  how: string;
  /** Complément de la piste (texte de l'interface). */
  howNote?: MessageKey;
}

export function makeCase(seed: number): MiniCase {
  const r = rng(seed),
    pick = <T>(a: T[]): T => a[Math.floor(r() * a.length)];
  const rows: CaseRow[] = [];
  for (let i = 0; i < 60; i++) {
    const m = Math.floor(r() * 6),
      d = 1 + Math.floor(r() * 28);
    const [p, price] = pick(PRODUCTS);
    rows.push({
      id: 'ORD-' + (1001 + i),
      m,
      date: '2026-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'),
      region: pick(REGIONS),
      product: p,
      units: 1 + Math.floor(r() * 20),
      price,
    });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const rev = (x: CaseRow) => x.units * x.price;
  const sum = (arr: CaseRow[], f: (x: CaseRow) => number) => arr.reduce((a, x) => a + f(x), 0);
  const R = pick(REGIONS),
    P = pick(PRODUCTS)[0],
    M = Math.floor(r() * 6),
    N = 5 + Math.floor(r() * 10);
  type T = Omit<MiniCase, 'seed' | 'rows' | 'tsv'>;
  const templates: (() => T)[] = [
    () => ({
      q: 'case.q.revenueRegion',
      params: { R },
      ans: sum(
        rows.filter((x) => x.region === R),
        rev,
      ),
      how: `=SUMPRODUCT((C2:C61="${R}")*E2:E61*F2:F61)`,
    }),
    () => ({
      q: 'case.q.ordersUnits',
      params: { P, N },
      ans: rows.filter((x) => x.product === P && x.units >= N).length,
      how: `=COUNTIFS(D2:D61,"${P}",E2:E61,">=${N}")`,
    }),
    () => ({
      q: 'case.q.unitsMonth',
      params: { M: MONTHS[M] },
      ans: sum(
        rows.filter((x) => x.m === M),
        (x) => x.units,
      ),
      how: `=SUMIFS(E2:E61,B2:B61,">="&DATE(2026,${M + 1},1),B2:B61,"<="&EOMONTH(DATE(2026,${M + 1},1),0))`,
    }),
    () => {
      const tot = REGIONS.map(
        (g) =>
          [
            g,
            sum(
              rows.filter((x) => x.region === g),
              rev,
            ),
          ] as const,
      ).sort((a, b) => b[1] - a[1]);
      return {
        q: 'case.q.topRegion',
        params: {},
        ans: tot[0][0],
        text: true,
        how: '=TAKE(SORTBY(UNIQUE(C2:C61),SUMIFS(…),-1),1)',
        howNote: 'case.how.orGroupby',
      };
    },
    () => {
      const sel = rows.filter((x) => x.region === R);
      return {
        q: 'case.q.avgUnits',
        params: { R },
        ans: sel.length ? Math.round((sum(sel, (x) => x.units) / sel.length) * 100) / 100 : 0,
        how: `=ROUND(AVERAGEIFS(E2:E61,C2:C61,"${R}"),2)`,
      };
    },
    () => {
      let prod = P,
        sel = rows.filter((x) => x.product === prod);
      if (!sel.length) {
        prod = rows[0].product;
        sel = rows.filter((x) => x.product === prod);
      }
      return {
        q: 'case.q.maxOrder',
        params: { P: prod },
        ans: Math.max(...sel.map(rev)),
        how: `=MAX(FILTER(E2:E61*F2:F61,D2:D61="${prod}"))`,
      };
    },
    () => ({
      q: 'case.q.revenueProductMonth',
      params: { P, M: MONTHS[M] },
      ans: sum(
        rows.filter((x) => x.product === P && x.m === M),
        rev,
      ),
      how: `=SUMPRODUCT((D2:D61="${P}")*(MONTH(B2:B61)=${M + 1})*E2:E61*F2:F61)`,
    }),
  ];
  const t = templates[Math.floor(r() * templates.length)]();
  const tsv = ['Order ID\tDate\tRegion\tProduct\tUnits\tUnit Price']
    .concat(rows.map((x) => [x.id, x.date, x.region, x.product, x.units, x.price].join('\t')))
    .join('\n');
  return { seed, rows, tsv, ...t };
}

/** Lit une réponse numérique saisie : « 1,234.5 », « 1234,5 », « $ 1 234 ». */
export function parseAnswer(s: string): number | null {
  let t = String(s)
    .trim()
    .replace(/[\s$\u20ac\u00a0\u202f]/g, '');
  // v1.1 lisait « 1234,5 » comme 12345 : une virgule suivie de 1 ou 2 chiffres est une décimale
  if (/^-?\d+,\d{1,2}$/.test(t)) t = t.replace(',', '.');
  else if (/^-?[\d,]*\.?\d+$/.test(t)) t = t.replace(/,/g, '');
  const v = Number(t);
  return Number.isFinite(v) && t !== '' ? v : null;
}
