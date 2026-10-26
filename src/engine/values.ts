/* Valeurs du moteur : erreurs Excel, tableaux, fonctions LAMBDA et conversions.
   Port de reference/engine.js (v1.1), même comportement. */

import type { Node } from './parser';

export class XErr {
  constructor(public code: string) {}
  toString(): string {
    return this.code;
  }
}
export const ERR = (c: string): XErr => new XErr(c);

/** Marqueur d'argument omis : f(1,,3) ou paramètre LAMBDA non fourni. */
export const OMIT = { omit: true } as const;
export type Omit = typeof OMIT;

export type Scalar = number | string | boolean | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type V = Scalar | XErr | Arr | Fn | Omit | undefined | any;
/* `any` volontaire : le moteur JS d'origine manipule des valeurs hétérogènes partout
   (cellules, tableaux, fonctions) ; un typage plus fin n'apporterait que des casts. */

export class Arr {
  d: V[];
  constructor(
    public rows: number,
    public cols: number,
    d?: V[],
  ) {
    this.d = d || new Array(rows * cols).fill(null);
  }
  get(r: number, c: number): V {
    return this.d[r * this.cols + c];
  }
  set(r: number, c: number, v: V): void {
    this.d[r * this.cols + c] = v;
  }
  static from(rows2d: V[][]): Arr {
    const R = rows2d.length,
      C = Math.max(...rows2d.map((r) => r.length));
    const a = new Arr(R, C);
    rows2d.forEach((row, r) => {
      for (let c = 0; c < C; c++) a.set(r, c, c < row.length ? row[c] : ERR('#N/A'));
    });
    return a;
  }
}

export interface Ctx {
  sheet: Sheet;
  budget: number;
  depth: number;
  cell(c: string, r: number): V;
  ref(t: RefTok): V;
  ev(node: Node, env: Env, ctx: Ctx): V;
}

export class Env {
  vars = new Map<string, V>();
  constructor(public parent: Env | null) {}
  lookup(n: string): V {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    for (let e: Env | null = this; e; e = e.parent) if (e.vars.has(n)) return e.vars.get(n);
    return undefined;
  }
}

export class Fn {
  constructor(
    public params: string[],
    public body: Node,
    public env: Env,
    public ctx: Ctx,
  ) {}
}

export type Sheet = Record<string, Scalar>;
export interface RefTok {
  t: 'ref';
  v: string;
  c1: string;
  r1: number;
  c2: string | null;
  r2: number | null;
}

export class FormulaError extends Error {}
/** Interrompt un calcul en renvoyant une erreur Excel comme résultat. */
export class Bail {
  constructor(public e: XErr) {}
}

export const isArr = (v: V): v is Arr => v instanceof Arr;
export const toArr = (v: V): Arr => (isArr(v) ? v : new Arr(1, 1, [v]));

export function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toPrecision(15)));
}
export function toNum(v: V): number | XErr {
  if (v instanceof XErr) return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === null || v === undefined || v === OMIT) return 0;
  if (typeof v === 'string') {
    const t = v.trim();
    const n = Number(t);
    return t === '' || isNaN(n) ? ERR('#VALUE!') : n;
  }
  if (isArr(v)) return toNum(v.d[0]);
  return ERR('#VALUE!');
}
export function toStr(v: V): string | XErr {
  if (v instanceof XErr) return v;
  if (v === null || v === undefined || v === OMIT) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return fmtNum(v);
  if (isArr(v)) return toStr(v.d[0]);
  return ERR('#VALUE!');
}
export function toBool(v: V): boolean | XErr {
  if (v instanceof XErr) return v;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v === null || v === undefined || v === OMIT) return false;
  if (typeof v === 'string') {
    const u = v.toUpperCase();
    if (u === 'TRUE') return true;
    if (u === 'FALSE') return false;
  }
  if (isArr(v)) return toBool(v.d[0]);
  return ERR('#VALUE!');
}
export function num(v: V): number {
  const n = toNum(v);
  if (n instanceof XErr) throw new Bail(n);
  return n;
}
export function str(v: V): string {
  const s = toStr(v);
  if (s instanceof XErr) throw new Bail(s);
  return s;
}
export function bool(v: V): boolean {
  const b = toBool(v);
  if (b instanceof XErr) throw new Bail(b);
  return b;
}
export function int(v: V): number {
  return Math.trunc(num(v));
}
export const opt = (v: V, d: V): V => (v === undefined || v === OMIT ? d : v);
export function scal(v: V): V {
  return isArr(v) ? v.d[0] : v;
}

export function broadcast(vals: V[], f: (...xs: V[]) => V): V {
  if (!vals.some(isArr)) return f(...vals);
  let R = 1,
    C = 1;
  for (const v of vals)
    if (isArr(v)) {
      R = Math.max(R, v.rows);
      C = Math.max(C, v.cols);
    }
  const out = new Arr(R, C);
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++) {
      out.set(
        r,
        c,
        f(
          ...vals.map((v) => {
            if (!isArr(v)) return v;
            const rr = v.rows === 1 ? 0 : r,
              cc = v.cols === 1 ? 0 : c;
            return rr < v.rows && cc < v.cols ? v.get(rr, cc) : ERR('#N/A');
          }),
        ),
      );
    }
  return out;
}
/** Applique f élément par élément ; les erreurs sont propagées. */
export function lift(f: (...xs: V[]) => V, errorsOk?: boolean): (args: V[]) => V {
  return (args) =>
    broadcast(args, (...xs) => {
      if (!errorsOk) for (const x of xs) if (x instanceof XErr) return x;
      try {
        const r = f(...xs);
        return r === undefined ? ERR('#VALUE!') : r;
      } catch (e) {
        if (e instanceof Bail) return e.e;
        throw e;
      }
    });
}

export function cmpVals(x: V, y: V): number {
  if (x === null || x === undefined) x = typeof y === 'string' ? '' : typeof y === 'boolean' ? false : 0;
  if (y === null || y === undefined) y = typeof x === 'string' ? '' : typeof x === 'boolean' ? false : 0;
  const tr = (v: V) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2);
  if (tr(x) !== tr(y)) return tr(x) < tr(y) ? -1 : 1;
  if (typeof x === 'string') {
    const a = x.toLowerCase(),
      b = (y as string).toLowerCase();
    return a < b ? -1 : a > b ? 1 : 0;
  }
  if (typeof x === 'boolean') return x === y ? 0 : x ? 1 : -1;
  return x < y ? -1 : x > y ? 1 : 0;
}

export const colNum = (s: string): number => s.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
export const colName = (n: number): string => {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

export function callFn(f: Fn, args: V[]): V {
  const ctx = f.ctx;
  if (args.length > f.params.length) return ERR('#VALUE!');
  if (++ctx.depth > 1500) throw new FormulaError('Calcul trop profond.');
  const env = new Env(f.env);
  f.params.forEach((pn, i) => env.vars.set(pn, i < args.length ? args[i] : OMIT));
  try {
    return ctx.ev(f.body, env, ctx);
  } finally {
    ctx.depth--;
  }
}
export function asScalarResult(v: V): V {
  if (isArr(v)) return v.rows === 1 && v.cols === 1 ? v.d[0] : ERR('#CALC!');
  if (v instanceof Fn) return ERR('#CALC!');
  return v === OMIT ? null : v;
}
