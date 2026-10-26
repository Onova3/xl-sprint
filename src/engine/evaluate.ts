/* Évaluation de l'arbre : opérateurs, LET, LAMBDA, IF, IFERROR, ROW/COLUMN, puis fonctions de FN. */

import { FN } from './functions';
import type { Node } from './parser';
import {
  Bail,
  broadcast,
  callFn,
  cmpVals,
  colName,
  colNum,
  Env,
  ERR,
  Fn,
  FormulaError,
  isArr,
  OMIT,
  toBool,
  toNum,
  toStr,
  XErr,
  Arr,
  type Ctx,
  type RefTok,
  type Sheet,
  type V,
} from './values';

function binop(op: string, a: V, b: V): V {
  return broadcast([a, b], (x, y) => {
    if (x instanceof XErr) return x;
    if (y instanceof XErr) return y;
    if (x instanceof Fn || y instanceof Fn) return ERR('#CALC!');
    if (op === '&') return (toStr(x) as string) + (toStr(y) as string);
    if ('+-*/^'.includes(op)) {
      const p = toNum(x),
        q = toNum(y);
      if (p instanceof XErr) return p;
      if (q instanceof XErr) return q;
      if (op === '+') return p + q;
      if (op === '-') return p - q;
      if (op === '*') return p * q;
      if (op === '/') return q === 0 ? ERR('#DIV/0!') : p / q;
      const r = Math.pow(p, q);
      return isFinite(r) ? r : ERR('#NUM!');
    }
    const c = cmpVals(x, y);
    return op === '='
      ? c === 0
      : op === '<>'
        ? c !== 0
        : op === '<'
          ? c < 0
          : op === '>'
            ? c > 0
            : op === '<='
              ? c <= 0
              : c >= 0;
  });
}

export function validName(n: string): boolean {
  return (
    /^[A-Z_\\][A-Z0-9_.]*$/.test(n) &&
    !/^\$?[A-Z]{1,3}\$?\d+$/.test(n) &&
    !/^R\d*C\d*$/.test(n) &&
    n !== 'TRUE' &&
    n !== 'FALSE' &&
    n !== 'R' &&
    n !== 'C'
  );
}
function nameOf(node: Node, what: string): string {
  if (node.k === 'name' && validName(node.name)) return node.name;
  const shown = node.k === 'name' ? node.name : node.k === 'ref' ? node.t.v : '?';
  throw new FormulaError(
    `Nom de ${what} invalide : « ${shown} ». Évitez c, r et les noms qui ressemblent à une cellule (A1, ab12).`,
  );
}

export function makeCtx(sheet: Sheet): Ctx {
  const ctx: Ctx = {
    sheet,
    budget: 400000,
    depth: 0,
    ev,
    cell: (c, r) => {
      const v = sheet[c + r];
      return v === undefined ? null : v;
    },
    ref: (t: RefTok) => {
      const c1 = colNum(t.c1),
        r1 = t.r1;
      if (!t.c2) return ctx.cell(t.c1, r1);
      const c2 = colNum(t.c2),
        r2 = t.r2 as number;
      const R0 = Math.min(r1, r2),
        R1 = Math.max(r1, r2),
        C0 = Math.min(c1, c2),
        C1 = Math.max(c1, c2);
      const a = new Arr(R1 - R0 + 1, C1 - C0 + 1);
      for (let r = R0; r <= R1; r++)
        for (let c = C0; c <= C1; c++) a.set(r - R0, c - C0, ctx.cell(colName(c), r));
      return a;
    },
  };
  return ctx;
}

export function ev(node: Node, env: Env, ctx: Ctx): V {
  if (--ctx.budget < 0) throw new FormulaError('Calcul trop long.');
  switch (node.k) {
    case 'num':
    case 'str':
    case 'lit':
      return node.v;
    case 'omit':
      return OMIT;
    case 'ref':
      return ctx.ref(node.t);
    case 'name': {
      const v = env.lookup(node.name);
      return v === undefined ? ERR('#NAME?') : v;
    }
    case 'neg':
      return broadcast([ev(node.e, env, ctx)], (x) => {
        if (x instanceof XErr) return x;
        const n = toNum(x);
        return n instanceof XErr ? n : -n;
      });
    case 'pct':
      return broadcast([ev(node.e, env, ctx)], (x) => {
        if (x instanceof XErr) return x;
        const n = toNum(x);
        return n instanceof XErr ? n : n / 100;
      });
    case 'bin':
      return binop(node.op, ev(node.l, env, ctx), ev(node.r, env, ctx));
    case 'invoke': {
      const f = ev(node.f, env, ctx);
      if (!(f instanceof Fn)) return f instanceof XErr ? f : ERR('#VALUE!');
      return callFn(
        f,
        node.args.map((a) => ev(a, env, ctx)),
      );
    }
    case 'call':
      return callNamed(node, env, ctx);
  }
}

function callNamed(node: { name: string; args: Node[] }, env: Env, ctx: Ctx): V {
  const name = node.name,
    A = node.args;
  const E = (n: Node) => ev(n, env, ctx);
  switch (name) {
    case 'LET': {
      if (A.length < 3 || A.length % 2 === 0)
        throw new FormulaError('LET attend des paires nom, valeur puis un calcul final.');
      const e2 = new Env(env);
      for (let i = 0; i < A.length - 1; i += 2) e2.vars.set(nameOf(A[i], 'variable'), ev(A[i + 1], e2, ctx));
      return ev(A[A.length - 1], e2, ctx);
    }
    case 'LAMBDA': {
      if (!A.length) throw new FormulaError('LAMBDA attend au moins un calcul.');
      const params = A.slice(0, -1).map((a) => nameOf(a, 'paramètre'));
      return new Fn(params, A[A.length - 1], env, ctx);
    }
    case 'ISOMITTED':
      return A[0] && A[0].k === 'name' ? env.lookup(A[0].name) === OMIT : false;
    case 'IF': {
      const c = E(A[0]);
      if (isArr(c)) {
        const t = A[1] ? E(A[1]) : true,
          f = A[2] && A[2].k !== 'omit' ? E(A[2]) : false;
        return broadcast([c, t, f], (x, y, z) => {
          const b = toBool(x);
          return b instanceof XErr ? b : b ? (y === OMIT ? 0 : y) : z === OMIT ? 0 : z;
        });
      }
      const b = toBool(c);
      if (b instanceof XErr) return b;
      if (b) return A[1] && A[1].k !== 'omit' ? E(A[1]) : A[1] ? 0 : true;
      return A[2] && A[2].k !== 'omit' ? E(A[2]) : A[2] ? 0 : false;
    }
    case 'IFERROR':
    case 'IFNA': {
      const v = E(A[0]);
      const hit = (x: V) => x instanceof XErr && (name === 'IFERROR' || x.code === '#N/A');
      if (isArr(v)) {
        if (!v.d.some(hit)) return v;
        const alt = E(A[1]);
        return broadcast([v, alt], (x, y) => (hit(x) ? (y === OMIT ? 0 : y) : x));
      }
      return hit(v) ? E(A[1]) : v;
    }
    case 'ROW':
    case 'COLUMN': {
      if (!A.length || A[0].k === 'omit') return ERR('#VALUE!');
      if (A[0].k !== 'ref') return ERR('#VALUE!');
      const t = A[0].t;
      if (name === 'ROW') {
        const r1 = t.r1,
          r2 = t.r2 || t.r1,
          lo = Math.min(r1, r2),
          n = Math.abs(r2 - r1) + 1;
        return n === 1
          ? lo
          : new Arr(
              n,
              1,
              Array.from({ length: n }, (_, i) => lo + i),
            );
      }
      const c1 = colNum(t.c1),
        c2 = t.c2 ? colNum(t.c2) : c1,
        lo = Math.min(c1, c2),
        n = Math.abs(c2 - c1) + 1;
      return n === 1
        ? lo
        : new Arr(
            1,
            n,
            Array.from({ length: n }, (_, i) => lo + i),
          );
    }
  }
  const bound = env.lookup(name);
  if (bound instanceof Fn) return callFn(bound, A.map(E));
  const fn = FN[name];
  if (!fn) return ERR('#NAME?');
  try {
    return fn(A.map(E), ctx);
  } catch (e) {
    if (e instanceof Bail) return e.e;
    throw e;
  }
}
