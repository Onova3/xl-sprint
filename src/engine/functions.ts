/* Fonctions Excel calculées par le moteur (sous-ensemble Office 365). */

import {
  Arr,
  asScalarResult,
  Bail,
  bool,
  broadcast,
  callFn,
  cmpVals,
  colName,
  ERR,
  Fn,
  int,
  isArr,
  lift,
  num,
  OMIT,
  opt,
  scal,
  str,
  toArr,
  toBool,
  toNum,
  XErr,
  type Ctx,
  type V,
} from './values';

type Impl = (a: V[], ctx?: Ctx) => V;

function nums(args: V[]): number[] {
  const out: number[] = [];
  for (const a of args) {
    if (a === OMIT) continue;
    if (isArr(a)) {
      for (const v of a.d) {
        if (v instanceof XErr) throw new Bail(v);
        if (typeof v === 'number') out.push(v);
      }
    } else {
      if (a instanceof XErr) throw new Bail(a);
      if (a === null) continue;
      out.push(num(a));
    }
  }
  return out;
}
function flat(args: V[]): V[] {
  const out: V[] = [];
  for (const a of args) {
    if (a === OMIT) continue;
    if (isArr(a)) out.push(...a.d);
    else out.push(a);
  }
  return out;
}
function roundTo(n: number, d: number): number {
  const f = Math.pow(10, d);
  const m = +(Math.abs(n) * f).toPrecision(15);
  return (Math.sign(n) * Math.round(m)) / f;
}
function needFn(f: V): Fn {
  if (!(f instanceof Fn)) throw new Bail(ERR('#VALUE!'));
  return f;
}
// Marqueurs 0001 et 0002 : protègent ~* et ~? pendant la conversion.
/* eslint-disable no-control-regex */
function wild(pattern: string): RegExp {
  return new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/~\*/g, '\u0001')
        .replace(/~\?/g, '\u0002')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
        .replace(/\u0001/g, '\\*')
        .replace(/\u0002/g, '\\?') +
      '$',
    'i',
  );
}
/* eslint-enable no-control-regex */
function criteria(crit: V): (v: V) => boolean {
  crit = scal(crit);
  if (typeof crit === 'number' || typeof crit === 'boolean')
    return (v) => cmpVals(v, crit) === 0 && typeof v === typeof crit;
  const s = str(crit);
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(s) as RegExpExecArray;
  const op = m[1] || '=',
    rhs = m[2];
  const n = rhs.trim() !== '' && !isNaN(Number(rhs)) ? Number(rhs) : null;
  if (n !== null)
    return (v) =>
      typeof v === 'number' &&
      (op === '='
        ? v === n
        : op === '<>'
          ? v !== n
          : op === '<'
            ? v < n
            : op === '>'
              ? v > n
              : op === '<='
                ? v <= n
                : v >= n);
  if (op === '=' || op === '<>') {
    const re = wild(rhs);
    const hit = (v: V) => (rhs === '' ? v === null || v === '' : typeof v === 'string' && re.test(v));
    return op === '=' ? hit : (v) => !hit(v);
  }
  return (v) => {
    if (typeof v !== 'string') return false;
    const c = cmpVals(v, rhs);
    return op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
  };
}
function makeRegex(p: V, cs: V, global: boolean): RegExp {
  let pat = str(p),
    flags = global ? 'g' : '';
  if (/^\(\?i\)/.test(pat)) {
    pat = pat.slice(4);
    flags += 'i';
  }
  if (int(opt(cs, 0)) === 1 && !flags.includes('i')) flags += 'i';
  try {
    return new RegExp(pat, flags);
  } catch {
    throw new Bail(ERR('#VALUE!'));
  }
}
function expandRepl(repl: string, m: (string | undefined)[]): string {
  return repl.replace(/\$(\d+|&)/g, (_, g: string) =>
    g === '&' || g === '0' ? (m[0] as string) : m[+g] === undefined ? '' : (m[+g] as string),
  );
}
function sortRows(A: Arr, keyFns: [(i: number) => V, number][]): Arr {
  const idx = Array.from({ length: A.rows }, (_, i) => i);
  idx.sort((i, j) => {
    for (const [key, ord] of keyFns) {
      const c = cmpVals(key(i), key(j));
      if (c) return c * ord;
    }
    return i - j;
  });
  const out = new Arr(A.rows, A.cols);
  idx.forEach((src, r) => {
    for (let c = 0; c < A.cols; c++) out.set(r, c, A.get(src, c));
  });
  return out;
}
function pickRows(A: Arr, rows: number[]): Arr {
  const out = new Arr(rows.length, A.cols);
  rows.forEach((r, i) => {
    for (let c = 0; c < A.cols; c++) out.set(i, c, A.get(r, c));
  });
  return out;
}
function pickCols(A: Arr, cols: number[]): Arr {
  const out = new Arr(A.rows, cols.length);
  for (let r = 0; r < A.rows; r++) cols.forEach((c, j) => out.set(r, j, A.get(r, c)));
  return out;
}
function vectorItems(v: V): V[] {
  return toArr(v).d;
}
function idxList(args: V[], n: number): number[] {
  const out: number[] = [];
  for (const v of flat(args)) {
    let k = int(v);
    if (k < 0) k = n + k + 1;
    if (k < 1 || k > n) throw new Bail(ERR('#VALUE!'));
    out.push(k - 1);
  }
  return out;
}
function textPos(s: string, d: string, inst: number): number[] {
  const pos: number[] = [];
  if (d === '') return pos;
  let i = s.indexOf(d);
  while (i >= 0) {
    pos.push(i);
    i = s.indexOf(d, i + d.length);
  }
  const k = inst > 0 ? inst - 1 : pos.length + inst;
  return k >= 0 && k < pos.length ? [pos[k]] : [];
}
function lookupIndex(lv: V, items: V[], modeArg: V, searchArg: V): number {
  const mode = int(opt(modeArg, 0)),
    search = int(opt(searchArg, 1));
  const order = search === -1 ? items.map((_, i) => items.length - 1 - i) : items.map((_, i) => i);
  if (mode === 3) {
    const re = makeRegex(lv, 0, false);
    for (const i of order) if (typeof items[i] === 'string' && re.test(items[i])) return i;
    return -1;
  }
  if (mode === 2 && typeof lv === 'string') {
    const re = wild(lv);
    for (const i of order) if (typeof items[i] === 'string' && re.test(items[i])) return i;
    return -1;
  }
  for (const i of order)
    if (
      items[i] !== null &&
      cmpVals(items[i], lv) === 0 &&
      (typeof items[i] === typeof lv || items[i] === null)
    )
      return i;
  if (mode === -1 || mode === 1) {
    let best = -1;
    items.forEach((v, i) => {
      if (typeof v !== typeof lv) return;
      const c = cmpVals(v, lv);
      if (mode === -1 && c < 0 && (best < 0 || cmpVals(v, items[best]) > 0)) best = i;
      if (mode === 1 && c > 0 && (best < 0 || cmpVals(v, items[best]) < 0)) best = i;
    });
    return best;
  }
  return -1;
}
const kth = (sorted: number[]) =>
  lift((k) => {
    const i = int(k);
    return i >= 1 && i <= sorted.length ? sorted[i - 1] : ERR('#NUM!');
  });

export const FN: Record<string, Impl> = {
  /* nombres */
  ABS: lift((x) => Math.abs(num(x))),
  INT: lift((x) => Math.floor(num(x))),
  SIGN: lift((x) => Math.sign(num(x))),
  SQRT: lift((x) => {
    const n = num(x);
    return n < 0 ? ERR('#NUM!') : Math.sqrt(n);
  }),
  POWER: lift((x, y) => Math.pow(num(x), num(y))),
  MOD: lift((x, y) => {
    const n = num(x),
      d = num(y);
    return d === 0 ? ERR('#DIV/0!') : n - d * Math.floor(n / d);
  }),
  ROUND: lift((x, d) => roundTo(num(x), int(opt(d, 0)))),
  ROUNDUP: lift((x, d) => {
    const f = Math.pow(10, int(opt(d, 0))),
      n = num(x);
    return (Math.sign(n) * Math.ceil(+(Math.abs(n) * f).toPrecision(15))) / f;
  }),
  ROUNDDOWN: lift((x, d) => {
    const f = Math.pow(10, int(opt(d, 0))),
      n = num(x);
    return (Math.sign(n) * Math.floor(+(Math.abs(n) * f).toPrecision(15))) / f;
  }),
  ISODD: lift((x) => Math.abs(Math.trunc(num(x))) % 2 === 1),
  ISEVEN: lift((x) => Math.abs(Math.trunc(num(x))) % 2 === 0),
  ISNUMBER: lift((x) => typeof x === 'number', true),
  ISTEXT: lift((x) => typeof x === 'string', true),
  ISBLANK: lift((x) => x === null, true),
  ISERROR: lift((x) => x instanceof XErr, true),
  ISNA: lift((x) => x instanceof XErr && x.code === '#N/A', true),
  ISLOGICAL: lift((x) => typeof x === 'boolean', true),
  N: lift((x) => (typeof x === 'number' ? x : typeof x === 'boolean' ? +x : 0)),
  NOT: lift((x) => !bool(x)),
  NA: () => ERR('#N/A'),
  PI: () => Math.PI,
  VALUE: lift((x) => {
    if (typeof x === 'number') return x;
    const s = str(x).trim(),
      n = Number(s);
    return s === '' || isNaN(n) ? ERR('#VALUE!') : n;
  }),
  CHAR: lift((x) => String.fromCharCode(int(x))),
  CODE: lift((x) => {
    const s = str(x);
    return s ? s.charCodeAt(0) : ERR('#VALUE!');
  }),
  ADDRESS: lift((r, c, a) => {
    const k = int(opt(a, 1)),
      cn = colName(int(c)),
      rn = int(r);
    return k === 4 ? cn + rn : k === 2 ? cn + '$' + rn : k === 3 ? '$' + cn + rn : '$' + cn + '$' + rn;
  }),

  /* agrégats */
  SUM: (a) => nums(a).reduce((x, y) => x + y, 0),
  PRODUCT: (a) => nums(a).reduce((x, y) => x * y, 1),
  AVERAGE: (a) => {
    const n = nums(a);
    return n.length ? n.reduce((x, y) => x + y, 0) / n.length : ERR('#DIV/0!');
  },
  MIN: (a) => {
    const n = nums(a);
    return n.length ? Math.min(...n) : 0;
  },
  MAX: (a) => {
    const n = nums(a);
    return n.length ? Math.max(...n) : 0;
  },
  MEDIAN: (a) => {
    const n = nums(a).sort((x, y) => x - y);
    if (!n.length) return ERR('#NUM!');
    const h = n.length >> 1;
    return n.length % 2 ? n[h] : (n[h - 1] + n[h]) / 2;
  },
  COUNT: (a) => flat(a).filter((v) => typeof v === 'number').length,
  COUNTA: (a) => flat(a).filter((v) => v !== null).length,
  COUNTBLANK: (a) => flat(a).filter((v) => v === null || v === '').length,
  LARGE: (a) => kth(nums([a[0]]).sort((x, y) => y - x))([a[1]]),
  SMALL: (a) => kth(nums([a[0]]).sort((x, y) => x - y))([a[1]]),
  AND: (a) => {
    const v = flat(a).filter((x) => x !== null);
    if (!v.length) return ERR('#VALUE!');
    return v.every((x) => bool(x));
  },
  OR: (a) => {
    const v = flat(a).filter((x) => x !== null);
    if (!v.length) return ERR('#VALUE!');
    return v.some((x) => bool(x));
  },
  SUMPRODUCT: (a) => {
    const arrs = a.filter((x) => x !== OMIT).map(toArr);
    const R = arrs[0].rows,
      C = arrs[0].cols;
    if (arrs.some((x) => x.rows !== R || x.cols !== C)) return ERR('#VALUE!');
    let s = 0;
    for (let i = 0; i < R * C; i++) {
      let p = 1;
      for (const x of arrs) {
        const v = x.d[i];
        if (v instanceof XErr) return v;
        p *= typeof v === 'number' ? v : 0;
      }
      s += p;
    }
    return s;
  },
  COUNTIF: (a) => {
    const t = criteria(a[1]);
    return toArr(a[0]).d.filter(t).length;
  },
  SUMIF: (a) => {
    const rng = toArr(a[0]),
      t = criteria(a[1]),
      sr = a[2] && a[2] !== OMIT ? toArr(a[2]) : rng;
    let s = 0;
    rng.d.forEach((v, i) => {
      if (t(v) && typeof sr.d[i] === 'number') s += sr.d[i];
    });
    return s;
  },
  COUNTIFS: (a) => {
    const pairs: [Arr, (v: V) => boolean][] = [];
    for (let i = 0; i < a.length; i += 2) pairs.push([toArr(a[i]), criteria(a[i + 1])]);
    const n = pairs[0][0].d.length;
    let k = 0;
    for (let i = 0; i < n; i++) if (pairs.every(([r, t]) => t(r.d[i]))) k++;
    return k;
  },
  SUMIFS: (a) => {
    const sr = toArr(a[0]),
      pairs: [Arr, (v: V) => boolean][] = [];
    for (let i = 1; i < a.length; i += 2) pairs.push([toArr(a[i]), criteria(a[i + 1])]);
    let s = 0;
    sr.d.forEach((v, i) => {
      if (typeof v === 'number' && pairs.every(([r, t]) => t(r.d[i]))) s += v;
    });
    return s;
  },

  /* logique */
  IFS: (a) =>
    broadcast(a, (...xs) => {
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const b = toBool(xs[i]);
        if (b instanceof XErr) return b;
        if (b) return xs[i + 1];
      }
      return ERR('#N/A');
    }),
  SWITCH: (a) =>
    broadcast(a, (...xs) => {
      const v = xs[0];
      let i = 1;
      for (; i + 1 < xs.length; i += 2) if (cmpVals(v, xs[i]) === 0) return xs[i + 1];
      return i < xs.length ? xs[i] : ERR('#N/A');
    }),
  CHOOSE: (a) =>
    broadcast([a[0]], (k) => {
      const i = Math.trunc(toNum(k) as number);
      return i >= 1 && i < a.length ? a[i] : ERR('#VALUE!');
    }),

  /* texte */
  LEN: lift((x) => str(x).length),
  UPPER: lift((x) => str(x).toUpperCase()),
  LOWER: lift((x) => str(x).toLowerCase()),
  PROPER: lift((x) =>
    str(x)
      .toLowerCase()
      .replace(/(^|[^a-zA-Z])([a-z])/g, (_m, p: string, ch: string) => p + ch.toUpperCase()),
  ),
  TRIM: lift((x) => str(x).replace(/ +/g, ' ').trim()),
  LEFT: lift((t, n) => {
    const k = int(opt(n, 1));
    return k < 0 ? ERR('#VALUE!') : str(t).slice(0, k);
  }),
  RIGHT: lift((t, n) => {
    const k = int(opt(n, 1)),
      s = str(t);
    return k < 0 ? ERR('#VALUE!') : k === 0 ? '' : s.slice(-k);
  }),
  MID: lift((t, s, n) => {
    const a = int(s),
      k = int(n);
    return a < 1 || k < 0 ? ERR('#VALUE!') : str(t).substr(a - 1, k);
  }),
  REPT: lift((t, n) => str(t).repeat(Math.max(0, int(n)))),
  EXACT: lift((x, y) => str(x) === str(y)),
  SUBSTITUTE: lift((t, o, nw, inst) => {
    const s = str(t),
      old = str(o),
      neu = str(nw);
    if (old === '') return s;
    if (inst === undefined || inst === OMIT) return s.split(old).join(neu);
    const k = int(inst);
    let i = -1;
    for (let c = 0; c < k; c++) {
      i = s.indexOf(old, i + 1);
      if (i < 0) return s;
    }
    return s.slice(0, i) + neu + s.slice(i + old.length);
  }),
  SEARCH: lift((f, w, st) => {
    const i = str(w)
      .toLowerCase()
      .indexOf(str(f).toLowerCase(), int(opt(st, 1)) - 1);
    return i < 0 ? ERR('#VALUE!') : i + 1;
  }),
  FIND: lift((f, w, st) => {
    const i = str(w).indexOf(str(f), int(opt(st, 1)) - 1);
    return i < 0 ? ERR('#VALUE!') : i + 1;
  }),
  TEXTBEFORE: lift((t, d, inst) => {
    const s = str(t),
      dl = str(d),
      p = textPos(s, dl, int(opt(inst, 1)));
    return p.length ? s.slice(0, p[0]) : ERR('#N/A');
  }),
  TEXTAFTER: lift((t, d, inst) => {
    const s = str(t),
      dl = str(d),
      p = textPos(s, dl, int(opt(inst, 1)));
    return p.length ? s.slice(p[0] + dl.length) : ERR('#N/A');
  }),
  TEXT: lift((v, f) => {
    const fmt = str(f),
      n = toNum(v);
    if (n instanceof XErr) return str(v);
    const m = /^(#,##)?(0+)(?:\.(0+))?$/.exec(fmt);
    if (!m) return str(v);
    const dec = m[3] ? m[3].length : 0;
    const s = roundTo(n, dec).toFixed(dec);
    let [ip] = s.replace('-', '').split('.');
    const dp = s.replace('-', '').split('.')[1];
    ip = ip.padStart(m[2].length, '0');
    if (m[1]) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 ? '-' : '') + ip + (dp ? '.' + dp : '');
  }),
  CONCAT: (a) => {
    let s = '';
    for (const v of flat(a)) s += str(v);
    return s;
  },
  TEXTJOIN: (a) => {
    const d = str(scal(a[0])),
      ig = bool(scal(opt(a[1], true)));
    const parts = flat(a.slice(2))
      .map((v) => str(v))
      .filter((s) => !(ig && s === ''));
    return parts.join(d);
  },
  TEXTSPLIT: (a) => {
    const s = str(scal(a[0]));
    const toRe = (v: V) => {
      if (v === undefined || v === OMIT) return null;
      const ds = vectorItems(v)
        .map((x) => str(x))
        .filter((x) => x !== '');
      return ds.length ? new RegExp(ds.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')) : null;
    };
    const cre = toRe(a[1]),
      rre = toRe(a[2]),
      ig = bool(opt(a[3], false));
    let rows = rre ? s.split(rre) : [s];
    if (ig) rows = rows.filter((r) => r !== '');
    let grid: V[][] = rows.map((r) => (cre ? r.split(cre) : [r]));
    if (ig) grid = grid.map((r) => r.filter((x) => x !== ''));
    return Arr.from(grid.length ? grid : [['']]);
  },
  REGEXTEST: lift((t, p, cs) => makeRegex(p, cs, false).test(str(t))),
  REGEXREPLACE: lift((t, p, r, occ, cs) => {
    const s = str(t),
      re = makeRegex(p, cs, true),
      repl = str(r),
      o = int(opt(occ, 0));
    const all = [...s.matchAll(re)];
    const target = o === 0 ? -1 : o > 0 ? o - 1 : all.length + o;
    let k = -1;
    return s.replace(re, (...m: unknown[]) => {
      k++;
      const groups = m.slice(0, typeof m[m.length - 1] === 'object' ? -3 : -2) as (string | undefined)[];
      return o === 0 || k === target ? expandRepl(repl, groups) : (m[0] as string);
    });
  }),
  REGEXEXTRACT: (a) => {
    const mode = int(scal(opt(a[2], 0)));
    if (isArr(a[0]) && mode === 0)
      return lift((t, p, _m, cs) => {
        const x = str(t).match(makeRegex(p, cs, false));
        return x ? x[0] : ERR('#N/A');
      })([a[0], a[1], OMIT, opt(a[3], OMIT)]);
    const s = str(scal(a[0]));
    if (mode === 0) {
      const x = s.match(makeRegex(scal(a[1]), scal(opt(a[3], 0)), false));
      return x ? x[0] : ERR('#N/A');
    }
    if (mode === 1) {
      const all = [...s.matchAll(makeRegex(scal(a[1]), scal(opt(a[3], 0)), true))].map((m) => m[0]);
      return all.length ? new Arr(1, all.length, all) : ERR('#N/A');
    }
    if (mode === 2) {
      const x = s.match(makeRegex(scal(a[1]), scal(opt(a[3], 0)), false));
      if (!x) return ERR('#N/A');
      const g = x.length > 1 ? x.slice(1).map((v) => (v === undefined ? '' : v)) : [x[0]];
      return new Arr(1, g.length, g);
    }
    return ERR('#VALUE!');
  },

  /* tableaux */
  ROWS: (a) => toArr(a[0]).rows,
  COLUMNS: (a) => toArr(a[0]).cols,
  TRANSPOSE: (a) => transpose(toArr(a[0])),
  SEQUENCE: (a) => {
    const R = int(scal(opt(a[0], 1))),
      C = int(scal(opt(a[1], 1))),
      st = num(scal(opt(a[2], 1))),
      sp = num(scal(opt(a[3], 1)));
    if (R < 1 || C < 1) return ERR('#CALC!');
    if (R * C > 100000) return ERR('#NUM!');
    const o = new Arr(R, C);
    for (let i = 0; i < R * C; i++) o.d[i] = st + i * sp;
    return o;
  },
  MAKEARRAY: (a) => {
    const R = int(scal(a[0])),
      C = int(scal(a[1])),
      f = needFn(a[2]);
    if (R < 1 || C < 1) return ERR('#CALC!');
    const o = new Arr(R, C);
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) o.set(r, c, asScalarResult(callFn(f, [r + 1, c + 1])));
    return o;
  },
  MAP: (a) => {
    const f = needFn(a[a.length - 1]),
      arrs = a.slice(0, -1).map(toArr);
    const R = Math.max(...arrs.map((x) => x.rows)),
      C = Math.max(...arrs.map((x) => x.cols));
    const o = new Arr(R, C);
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) {
        o.set(
          r,
          c,
          asScalarResult(
            callFn(
              f,
              arrs.map((x) =>
                x.rows === 1 && x.cols === 1 ? x.d[0] : r < x.rows && c < x.cols ? x.get(r, c) : ERR('#N/A'),
              ),
            ),
          ),
        );
      }
    return o;
  },
  SCAN: (a) => {
    let acc = opt(a[0], null);
    const A = toArr(a[1]),
      f = needFn(a[2]),
      o = new Arr(A.rows, A.cols);
    for (let i = 0; i < A.d.length; i++) {
      acc = asScalarResult(callFn(f, [acc, A.d[i]]));
      o.d[i] = acc;
    }
    return o;
  },
  REDUCE: (a) => {
    let acc = opt(a[0], null);
    const A = toArr(a[1]),
      f = needFn(a[2]);
    for (let i = 0; i < A.d.length; i++) acc = callFn(f, [acc, A.d[i]]);
    return acc === OMIT ? null : acc;
  },
  BYROW: (a) => {
    const A = toArr(a[0]),
      f = needFn(a[1]),
      o = new Arr(A.rows, 1);
    for (let r = 0; r < A.rows; r++) o.d[r] = asScalarResult(callFn(f, [pickRows(A, [r])]));
    return o;
  },
  BYCOL: (a) => {
    const A = toArr(a[0]),
      f = needFn(a[1]),
      o = new Arr(1, A.cols);
    for (let c = 0; c < A.cols; c++) o.d[c] = asScalarResult(callFn(f, [pickCols(A, [c])]));
    return o;
  },
  INDEX: (a) => {
    const A = toArr(a[0]);
    let r = opt(a[1], OMIT),
      c = opt(a[2], OMIT);
    if (c === OMIT) {
      if (A.rows === 1 && A.cols > 1) {
        c = r;
        r = 1;
      } else if (A.cols === 1) c = 1;
      else if (!isArr(r)) {
        const k = int(r);
        if (k < 1 || k > A.rows) return ERR('#REF!');
        return pickRows(A, [k - 1]);
      }
    }
    if (r === OMIT) r = 0;
    if (!isArr(r) && !isArr(c)) {
      const ri = int(r),
        ci = int(c);
      if (ri < 0 || ci < 0 || ri > A.rows || ci > A.cols) return ERR('#REF!');
      if (ri === 0 && ci === 0) return A;
      if (ri === 0) return pickCols(A, [ci - 1]);
      if (ci === 0) return pickRows(A, [ri - 1]);
      return A.get(ri - 1, ci - 1);
    }
    return lift((x, y) => {
      const ri = int(x),
        ci = int(y);
      return ri < 1 || ci < 1 || ri > A.rows || ci > A.cols ? ERR('#REF!') : A.get(ri - 1, ci - 1);
    })([r, c]);
  },
  HSTACK: (a) => {
    const arrs = a.filter((x) => x !== OMIT).map(toArr),
      R = Math.max(...arrs.map((x) => x.rows)),
      C = arrs.reduce((s, x) => s + x.cols, 0);
    const o = new Arr(R, C);
    let off = 0;
    for (const x of arrs) {
      for (let r = 0; r < R; r++)
        for (let c = 0; c < x.cols; c++) o.set(r, off + c, r < x.rows ? x.get(r, c) : ERR('#N/A'));
      off += x.cols;
    }
    return o;
  },
  VSTACK: (a) => {
    const arrs = a.filter((x) => x !== OMIT).map(toArr),
      C = Math.max(...arrs.map((x) => x.cols)),
      R = arrs.reduce((s, x) => s + x.rows, 0);
    const o = new Arr(R, C);
    let off = 0;
    for (const x of arrs) {
      for (let r = 0; r < x.rows; r++)
        for (let c = 0; c < C; c++) o.set(off + r, c, c < x.cols ? x.get(r, c) : ERR('#N/A'));
      off += x.rows;
    }
    return o;
  },
  TOCOL: (a) => toLine(a, true),
  TOROW: (a) => toLine(a, false),
  WRAPROWS: (a) => wrap(a, true),
  WRAPCOLS: (a) => wrap(a, false),
  TAKE: (a) => takeDrop(a, true),
  DROP: (a) => takeDrop(a, false),
  CHOOSEROWS: (a) => {
    const A = toArr(a[0]);
    return pickRows(A, idxList(a.slice(1), A.rows));
  },
  CHOOSECOLS: (a) => {
    const A = toArr(a[0]);
    return pickCols(A, idxList(a.slice(1), A.cols));
  },
  EXPAND: (a) => {
    const A = toArr(a[0]),
      R = int(scal(opt(a[1], A.rows))),
      C = int(scal(opt(a[2], A.cols))),
      pad = opt(a[3], ERR('#N/A'));
    if (R < A.rows || C < A.cols) return ERR('#VALUE!');
    const o = new Arr(R, C);
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++) o.set(r, c, r < A.rows && c < A.cols ? A.get(r, c) : scal(pad));
    return o;
  },
  SORT: (a) => {
    const A = toArr(a[0]),
      k = int(scal(opt(a[1], 1))),
      ord = int(scal(opt(a[2], 1))) === -1 ? -1 : 1,
      byCol = bool(scal(opt(a[3], false)));
    if (byCol) {
      const T = transpose(A);
      return transpose(sortRows(T, [[(i) => T.get(i, k - 1), ord]]));
    }
    if (k < 1 || k > A.cols) return ERR('#VALUE!');
    return sortRows(A, [[(i) => A.get(i, k - 1), ord]]);
  },
  SORTBY: (a) => {
    const A = toArr(a[0]),
      keys: [(i: number) => V, number][] = [];
    for (let i = 1; i < a.length; i += 2) {
      const K = toArr(a[i]),
        ord = int(scal(opt(a[i + 1], 1))) === -1 ? -1 : 1;
      if (K.d.length !== A.rows) return ERR('#VALUE!');
      keys.push([(j) => K.d[j], ord]);
    }
    return sortRows(A, keys);
  },
  UNIQUE: (a) => {
    const A = toArr(a[0]),
      byCol = bool(scal(opt(a[1], false))),
      once = bool(scal(opt(a[2], false)));
    const M = byCol ? transpose(A) : A;
    const keyOf = (r: number) => {
      const ks: string[] = [];
      for (let c = 0; c < M.cols; c++) {
        const v = M.get(r, c);
        ks.push(typeof v + ':' + (typeof v === 'string' ? v.toLowerCase() : String(v)));
      }
      return ks.join('\u0001');
    };
    const count = new Map<string, number>(),
      first: number[] = [];
    for (let r = 0; r < M.rows; r++) {
      const k = keyOf(r);
      if (!count.has(k)) {
        count.set(k, 0);
        first.push(r);
      }
      count.set(k, (count.get(k) as number) + 1);
    }
    const rows = first.filter((r) => !once || count.get(keyOf(r)) === 1);
    if (!rows.length) return ERR('#CALC!');
    const out = pickRows(M, rows);
    return byCol ? transpose(out) : out;
  },
  FILTER: (a) => {
    const A = toArr(a[0]),
      inc = toArr(a[1]);
    let byRows: boolean;
    if (inc.cols === 1 && inc.rows === A.rows) byRows = true;
    else if (inc.rows === 1 && inc.cols === A.cols) byRows = false;
    else return ERR('#VALUE!');
    const keep: number[] = [];
    for (let i = 0; i < inc.d.length; i++) {
      const b = toBool(inc.d[i]);
      if (b instanceof XErr) return b;
      if (b) keep.push(i);
    }
    if (!keep.length) return a[2] !== undefined && a[2] !== OMIT ? a[2] : ERR('#CALC!');
    return byRows ? pickRows(A, keep) : pickCols(A, keep);
  },
  XLOOKUP: (a) => {
    const la = toArr(a[1]),
      ra = toArr(a[2]),
      items = la.d,
      horiz = la.rows === 1 && la.cols > 1;
    const nf = a[3] === undefined || a[3] === OMIT ? ERR('#N/A') : a[3];
    const one = (lv: V): V => {
      const i = lookupIndex(lv, items, a[4], a[5]);
      if (i < 0) return nf;
      if (horiz) return ra.rows === 1 ? ra.get(0, i) : pickCols(ra, [i]);
      return ra.cols === 1 ? ra.get(i, 0) : pickRows(ra, [i]);
    };
    if (isArr(a[0])) return lift((lv) => asScalarResult(one(lv)))([a[0]]);
    return one(a[0]);
  },
  XMATCH: (a) => {
    const items = toArr(a[1]).d;
    return lift((lv) => {
      const i = lookupIndex(lv, items, a[2], a[3]);
      return i < 0 ? ERR('#N/A') : i + 1;
    })([a[0]]);
  },
  MATCH: (a) => {
    const items = toArr(a[1]).d,
      t = int(scal(opt(a[2], 1)));
    return lift((lv) => {
      if (t === 0) {
        const i =
          typeof lv === 'string' && /[*?]/.test(lv)
            ? items.findIndex((v) => typeof v === 'string' && wild(lv).test(v))
            : lookupIndex(lv, items, 0, 1);
        return i < 0 ? ERR('#N/A') : i + 1;
      }
      let best = -1;
      items.forEach((v, i) => {
        if (typeof v === typeof lv && (t === 1 ? cmpVals(v, lv) <= 0 : cmpVals(v, lv) >= 0)) best = i;
      });
      return best < 0 ? ERR('#N/A') : best + 1;
    })([a[0]]);
  },
};

function transpose(A: Arr): Arr {
  const o = new Arr(A.cols, A.rows);
  for (let r = 0; r < A.rows; r++) for (let c = 0; c < A.cols; c++) o.set(c, r, A.get(r, c));
  return o;
}
function toLine(a: V[], col: boolean): V {
  const A = toArr(a[0]),
    ig = int(scal(opt(a[1], 0))),
    byCol = bool(scal(opt(a[2], false)));
  const vals: V[] = [];
  const push = (v: V) => {
    if ((ig === 1 || ig === 3) && v === null) return;
    if ((ig === 2 || ig === 3) && v instanceof XErr) return;
    vals.push(v);
  };
  if (byCol) {
    for (let c = 0; c < A.cols; c++) for (let r = 0; r < A.rows; r++) push(A.get(r, c));
  } else A.d.forEach(push);
  if (!vals.length) return ERR('#CALC!');
  return col ? new Arr(vals.length, 1, vals) : new Arr(1, vals.length, vals);
}
function wrap(a: V[], rowsFirst: boolean): V {
  const v = toArr(a[0]).d,
    n = int(scal(a[1])),
    pad = opt(a[2], ERR('#N/A'));
  if (n < 1) return ERR('#NUM!');
  const k = Math.ceil(v.length / n);
  const o = rowsFirst ? new Arr(k, n) : new Arr(n, k);
  for (let i = 0; i < k * n; i++) {
    const val = i < v.length ? v[i] : scal(pad);
    if (rowsFirst) o.d[i] = val;
    else o.set(i % n, Math.floor(i / n), val);
  }
  return o;
}
function takeDrop(a: V[], take: boolean): V {
  const A = toArr(a[0]);
  const rArg = opt(a[1], OMIT),
    cArg = opt(a[2], OMIT);
  const span = (n: number, arg: V): [number, number] | null => {
    if (arg === OMIT) return [0, n];
    const k = int(scal(arg));
    if (take) {
      if (k === 0) return null;
      return k > 0 ? [0, Math.min(k, n)] : [Math.max(0, n + k), n];
    }
    return k >= 0 ? [Math.min(k, n), n] : [0, Math.max(0, n + k)];
  };
  const rs = span(A.rows, rArg),
    cs = span(A.cols, cArg);
  if (!rs || !cs || rs[1] - rs[0] < 1 || cs[1] - cs[0] < 1) return ERR('#CALC!');
  const rows: number[] = [],
    cols: number[] = [];
  for (let r = rs[0]; r < rs[1]; r++) rows.push(r);
  for (let c = cs[0]; c < cs[1]; c++) cols.push(c);
  return pickCols(pickRows(A, rows), cols);
}
