/* Moteur de formules de XL Sprint v1.1 (extrait de xl-sprint-v1.1.html).
   À porter en TypeScript dans src/engine/. API : runFormula(src, sheet) -> {ok, value|msg} ; sameResult(a, b) ; sheetFromRows(rows). */

const FUNCS = ("ABS ACCRINT ADDRESS AGGREGATE AND ARABIC ARRAYTOTEXT ASC ASIN ATAN ATAN2 AVEDEV AVERAGE AVERAGEA AVERAGEIF AVERAGEIFS " +
  "BASE BIN2DEC BITAND BYCOL BYROW CEILING CEILING.MATH CELL CHAR CHIDIST CHISQ.DIST CHOOSE CHOOSECOLS CHOOSEROWS CLEAN CODE COLUMN COLUMNS " +
  "COMBIN CONCAT CONCATENATE CONVERT CORREL COS COUNT COUNTA COUNTBLANK COUNTIF COUNTIFS COVARIANCE.S DATE DATEDIF DATEVALUE DAY DAYS DAYS360 " +
  "DEC2BIN DEC2HEX DEGREES DELTA DOLLAR DROP EDATE EOMONTH EVEN EXACT EXP EXPAND FACT FALSE FILTER FILTERXML FIND FINDB FIXED FLOOR FLOOR.MATH " +
  "FORECAST FREQUENCY FV GCD GROUPBY HEX2DEC HLOOKUP HOUR HSTACK HYPERLINK IF IFERROR IFNA IFS IMAGE INDEX INDIRECT INFO INT INTERCEPT IRR " +
  "ISBLANK ISERR ISERROR ISEVEN ISFORMULA ISLOGICAL ISNA ISNUMBER ISODD ISOMITTED ISREF ISTEXT LAMBDA LARGE LCM LEFT LEFTB LEN LENB LET LINEST " +
  "LN LOG LOG10 LOOKUP LOWER MAKEARRAY MAP MATCH MAX MAXA MAXIFS MEDIAN MID MIDB MIN MINA MINIFS MINUTE MMULT MOD MODE MODE.SNGL MONTH MROUND " +
  "N NA NETWORKDAYS NOT NOW NPV NUMBERVALUE ODD OFFSET OR PERCENTILE.INC PERCENTRANK.INC PI PIVOTBY PMT POWER PRODUCT PROPER PV QUARTILE.INC " +
  "QUOTIENT RADIANS RAND RANDARRAY RANDBETWEEN RANK RANK.AVG RANK.EQ RATE RECEIVED REDUCE REGEXEXTRACT REGEXREPLACE REGEXTEST REPLACE REPT RIGHT " +
  "ROMAN ROUND ROUNDDOWN ROUNDUP ROW ROWS SCAN SEARCH SEARCHB SEC SECOND SEQUENCE SHEET SIGN SIN SLOPE SMALL SORT SORTBY SQRT STANDARDIZE STDEV " +
  "STDEV.P STDEV.S SUBSTITUTE SUBTOTAL SUM SUMIF SUMIFS SUMPRODUCT SUMSQ SWITCH T TAKE TAN TEXT TEXTAFTER TEXTBEFORE TEXTJOIN TEXTSPLIT TIME " +
  "TIMEVALUE TOCOL TODAY TOROW TRANSPOSE TREND TRIM TRIMMEAN TRIMRANGE TRUE TRUNC TYPE UNICHAR UNICODE UNIQUE UPPER VALUE VAR VAR.P VAR.S VLOOKUP " +
  "VSTACK WEEKDAY WEEKNUM WORKDAY WRAPCOLS WRAPROWS XLOOKUP XMATCH XOR YEAR YEARFRAC").split(" ");
const FUNCS_SORTED = [...FUNCS].sort();

/* =========================================================================
   Moteur de formules Excel (sous-ensemble Office 365) : vérifie une formule
   par son RÉSULTAT, pas par son texte. Tableaux dynamiques, LET, LAMBDA,
   MAKEARRAY, SCAN, REDUCE, MAP, BYROW, BYCOL, REGEX…
   ========================================================================= */

class XErr { constructor(code) { this.code = code; } toString() { return this.code; } }
const ERR = c => new XErr(c);
class Arr {
  constructor(rows, cols, d) { this.rows = rows; this.cols = cols; this.d = d || new Array(rows * cols).fill(null); }
  get(r, c) { return this.d[r * this.cols + c]; }
  set(r, c, v) { this.d[r * this.cols + c] = v; }
  static from(rows2d) {
    const R = rows2d.length, C = Math.max(...rows2d.map(r => r.length));
    const a = new Arr(R, C);
    rows2d.forEach((row, r) => { for (let c = 0; c < C; c++) a.set(r, c, c < row.length ? row[c] : ERR("#N/A")); });
    return a;
  }
}
class Fn { constructor(params, body, env, ctx) { this.params = params; this.body = body; this.env = env; this.ctx = ctx; } }
const OMIT = { omit: true };
class FormulaError extends Error { }
class Bail { constructor(e) { this.e = e; } }
const isArr = v => v instanceof Arr;
const toArr = v => isArr(v) ? v : new Arr(1, 1, [v]);

/* ------------------------------------------------------------- lecture -- */

function tokenize(s) {
  const toks = [];
  let i = 0, m;
  while (i < s.length) {
    const ch = s[i], rest = s.slice(i);
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '"') {
      let j = i + 1, str = "";
      for (;;) {
        if (j >= s.length) throw new FormulaError("Guillemet non fermé.");
        if (s[j] === '"') { if (s[j + 1] === '"') { str += '"'; j += 2; continue; } break; }
        str += s[j++];
      }
      toks.push({ t: "str", v: str }); i = j + 1; continue;
    }
    if ((m = /^\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?/.exec(rest))) {
      const next = s[i + m[0].length] || "";
      if (!/[A-Za-z0-9_.(]/.test(next)) {
        toks.push({ t: "ref", v: m[0], c1: m[1].toUpperCase(), r1: +m[2], c2: m[3] ? m[3].toUpperCase() : null, r2: m[4] ? +m[4] : null });
        i += m[0].length; continue;
      }
    }
    if ((m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest))) { toks.push({ t: "num", v: parseFloat(m[0]) }); i += m[0].length; continue; }
    if ((m = /^[A-Za-z_\\][A-Za-z0-9_.]*/.exec(rest))) { toks.push({ t: "id", v: m[0] }); i += m[0].length; continue; }
    const two = s.slice(i, i + 2);
    if (two === "<>" || two === "<=" || two === ">=") { toks.push({ t: "op", v: two }); i += 2; continue; }
    if ("+-*/^&=<>%(),{};".includes(ch)) { toks.push({ t: "op", v: ch }); i++; continue; }
    if (ch === "[" || ch === "]") throw new FormulaError("Les références structurées (Table[Colonne]) ne sont pas gérées ici : utilisez les plages de la feuille.");
    throw new FormulaError("Caractère inattendu : « " + ch + " ».");
  }
  return toks;
}

function parseFormula(src) {
  let s = String(src).trim();
  if (s.startsWith("=")) s = s.slice(1);
  if (!s.trim()) throw new FormulaError("Formule vide.");
  const toks = tokenize(s);
  let depth = 0;
  for (const t of toks) { if (t.t === "op" && t.v === "(") depth++; if (t.t === "op" && t.v === ")") depth--; }
  for (let k = 0; k < depth; k++) toks.push({ t: "op", v: ")" });   // Excel referme les parenthèses
  let p = 0;
  const isOp = v => toks[p] && toks[p].t === "op" && toks[p].v === v;
  const expect = v => { if (!isOp(v)) throw new FormulaError(`« ${v} » attendu${toks[p] ? " avant « " + toks[p].v + " »" : " en fin de formule"}.`); p++; };
  const CMP = ["=", "<>", "<", ">", "<=", ">="];

  function expr() {
    let l = concat();
    while (toks[p] && toks[p].t === "op" && CMP.includes(toks[p].v)) { const op = toks[p++].v; l = { k: "bin", op, l, r: concat() }; }
    return l;
  }
  function concat() { let l = add(); while (isOp("&")) { p++; l = { k: "bin", op: "&", l, r: add() }; } return l; }
  function add() { let l = mul(); while (isOp("+") || isOp("-")) { const op = toks[p++].v; l = { k: "bin", op, l, r: mul() }; } return l; }
  function mul() { let l = pow(); while (isOp("*") || isOp("/")) { const op = toks[p++].v; l = { k: "bin", op, l, r: pow() }; } return l; }
  function pow() { let l = pct(); while (isOp("^")) { p++; l = { k: "bin", op: "^", l, r: pct() }; } return l; }
  function pct() { let e = unary(); while (isOp("%")) { p++; e = { k: "pct", e }; } return e; }
  function unary() {
    if (isOp("-")) { p++; return { k: "neg", e: unary() }; }
    if (isOp("+")) { p++; return unary(); }
    return postfix();
  }
  function postfix() { let e = primary(); while (isOp("(")) { p++; e = { k: "invoke", f: e, args: args() }; } return e; }
  function args() {
    const out = [];
    if (isOp(")")) { p++; return out; }
    for (;;) {
      if (isOp(",") || isOp(")")) out.push({ k: "omit" }); else out.push(expr());
      if (isOp(",")) { p++; continue; }
      expect(")");
      return out;
    }
  }
  function primary() {
    const t = toks[p];
    if (!t) throw new FormulaError("Formule incomplète.");
    if (t.t === "num") { p++; return { k: "num", v: t.v }; }
    if (t.t === "str") { p++; return { k: "str", v: t.v }; }
    if (t.t === "ref") { p++; return { k: "ref", t }; }
    if (t.t === "id") {
      p++;
      const up = t.v.toUpperCase();
      if (isOp("(")) { p++; return { k: "call", name: up, args: args() }; }
      if (up === "TRUE") return { k: "lit", v: true };
      if (up === "FALSE") return { k: "lit", v: false };
      return { k: "name", name: up };
    }
    if (isOp("(")) { p++; const e = expr(); expect(")"); return e; }
    if (isOp("{")) { p++; return arrayConst(); }
    throw new FormulaError("Élément inattendu : « " + t.v + " ».");
  }
  function arrayConst() {
    const rows = [[]];
    for (;;) {
      let neg = false;
      if (isOp("-")) { p++; neg = true; }
      const t = toks[p++];
      if (!t) throw new FormulaError("Constante de tableau non fermée.");
      let v;
      if (t.t === "num") v = neg ? -t.v : t.v;
      else if (t.t === "str") v = t.v;
      else if (t.t === "id" && /^(TRUE|FALSE)$/i.test(t.v)) v = t.v.toUpperCase() === "TRUE";
      else throw new FormulaError("Constante de tableau invalide.");
      rows[rows.length - 1].push(v);
      if (isOp(",")) { p++; continue; }
      if (isOp(";")) { p++; rows.push([]); continue; }
      expect("}");
      break;
    }
    if (rows.some(r => r.length !== rows[0].length)) throw new FormulaError("Les lignes de la constante de tableau n'ont pas la même longueur.");
    return { k: "lit", v: Arr.from(rows) };
  }
  const ast = expr();
  if (p < toks.length) throw new FormulaError("Élément en trop : « " + toks[p].v + " ».");
  return ast;
}

/* ------------------------------------------------------ conversions -- */

function fmtNum(n) { return Number.isInteger(n) ? String(n) : String(parseFloat(n.toPrecision(15))); }
function toNum(v) {
  if (v instanceof XErr) return v;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null || v === undefined || v === OMIT) return 0;
  if (typeof v === "string") { const t = v.trim(); const n = Number(t); return t === "" || isNaN(n) ? ERR("#VALUE!") : n; }
  if (isArr(v)) return toNum(v.d[0]);
  return ERR("#VALUE!");
}
function toStr(v) {
  if (v instanceof XErr) return v;
  if (v === null || v === undefined || v === OMIT) return "";
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return fmtNum(v);
  if (isArr(v)) return toStr(v.d[0]);
  return ERR("#VALUE!");
}
function toBool(v) {
  if (v instanceof XErr) return v;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (v === null || v === undefined || v === OMIT) return false;
  if (typeof v === "string") { const u = v.toUpperCase(); if (u === "TRUE") return true; if (u === "FALSE") return false; }
  if (isArr(v)) return toBool(v.d[0]);
  return ERR("#VALUE!");
}
function num(v) { const n = toNum(v); if (n instanceof XErr) throw new Bail(n); return n; }
function str(v) { const s = toStr(v); if (s instanceof XErr) throw new Bail(s); return s; }
function bool(v) { const b = toBool(v); if (b instanceof XErr) throw new Bail(b); return b; }
function int(v) { return Math.trunc(num(v)); }
const opt = (v, d) => (v === undefined || v === OMIT) ? d : v;
function scal(v) { return isArr(v) ? v.d[0] : v; }

function broadcast(vals, f) {
  if (!vals.some(isArr)) return f(...vals);
  let R = 1, C = 1;
  for (const v of vals) if (isArr(v)) { R = Math.max(R, v.rows); C = Math.max(C, v.cols); }
  const out = new Arr(R, C);
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    out.set(r, c, f(...vals.map(v => {
      if (!isArr(v)) return v;
      const rr = v.rows === 1 ? 0 : r, cc = v.cols === 1 ? 0 : c;
      return rr < v.rows && cc < v.cols ? v.get(rr, cc) : ERR("#N/A");
    })));
  }
  return out;
}
/* Applique f élément par élément ; les erreurs sont propagées. */
function lift(f, errorsOk) {
  return args => broadcast(args, (...xs) => {
    if (!errorsOk) for (const x of xs) if (x instanceof XErr) return x;
    try { const r = f(...xs); return r === undefined ? ERR("#VALUE!") : r; }
    catch (e) { if (e instanceof Bail) return e.e; throw e; }
  });
}

function cmpVals(x, y) {
  if (x === null || x === undefined) x = typeof y === "string" ? "" : typeof y === "boolean" ? false : 0;
  if (y === null || y === undefined) y = typeof x === "string" ? "" : typeof x === "boolean" ? false : 0;
  const tr = v => typeof v === "number" ? 0 : typeof v === "string" ? 1 : 2;
  if (tr(x) !== tr(y)) return tr(x) < tr(y) ? -1 : 1;
  if (typeof x === "string") { const a = x.toLowerCase(), b = y.toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; }
  if (typeof x === "boolean") return x === y ? 0 : (x ? 1 : -1);
  return x < y ? -1 : x > y ? 1 : 0;
}
function binop(op, a, b) {
  return broadcast([a, b], (x, y) => {
    if (x instanceof XErr) return x;
    if (y instanceof XErr) return y;
    if (x instanceof Fn || y instanceof Fn) return ERR("#CALC!");
    if (op === "&") return toStr(x) + toStr(y);
    if ("+-*/^".includes(op)) {
      const p = toNum(x), q = toNum(y);
      if (p instanceof XErr) return p;
      if (q instanceof XErr) return q;
      if (op === "+") return p + q;
      if (op === "-") return p - q;
      if (op === "*") return p * q;
      if (op === "/") return q === 0 ? ERR("#DIV/0!") : p / q;
      const r = Math.pow(p, q);
      return isFinite(r) ? r : ERR("#NUM!");
    }
    const c = cmpVals(x, y);
    return op === "=" ? c === 0 : op === "<>" ? c !== 0 : op === "<" ? c < 0 : op === ">" ? c > 0 : op === "<=" ? c <= 0 : c >= 0;
  });
}

/* ---------------------------------------------------------- évaluation -- */

class Env {
  constructor(parent) { this.parent = parent; this.vars = new Map(); }
  lookup(n) { for (let e = this; e; e = e.parent) if (e.vars.has(n)) return e.vars.get(n); return undefined; }
}
const colNum = s => s.split("").reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
const colName = n => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
function validName(n) {
  return /^[A-Z_\\][A-Z0-9_.]*$/.test(n) && !/^\$?[A-Z]{1,3}\$?\d+$/.test(n) && !/^R\d*C\d*$/.test(n) && n !== "TRUE" && n !== "FALSE" && n !== "R" && n !== "C";
}
function nameOf(node, what) {
  if (node.k === "name" && validName(node.name)) return node.name;
  const shown = node.k === "name" ? node.name : node.k === "ref" ? node.t.v : "?";
  throw new FormulaError(`Nom de ${what} invalide : « ${shown} ». Évitez c, r et les noms qui ressemblent à une cellule (A1, ab12).`);
}

function makeCtx(sheet) {
  const ctx = { sheet, budget: 400000, depth: 0 };
  ctx.cell = (c, r) => { const v = sheet[c + r]; return v === undefined ? null : v; };
  ctx.ref = t => {
    const c1 = colNum(t.c1), r1 = t.r1;
    if (!t.c2) return ctx.cell(t.c1, r1);
    const c2 = colNum(t.c2), r2 = t.r2;
    const R0 = Math.min(r1, r2), R1 = Math.max(r1, r2), C0 = Math.min(c1, c2), C1 = Math.max(c1, c2);
    const a = new Arr(R1 - R0 + 1, C1 - C0 + 1);
    for (let r = R0; r <= R1; r++) for (let c = C0; c <= C1; c++) a.set(r - R0, c - C0, ctx.cell(colName(c), r));
    return a;
  };
  return ctx;
}

function callFn(f, args) {
  const ctx = f.ctx;
  if (args.length > f.params.length) return ERR("#VALUE!");
  if (++ctx.depth > 1500) throw new FormulaError("Calcul trop profond.");
  const env = new Env(f.env);
  f.params.forEach((pn, i) => env.vars.set(pn, i < args.length ? args[i] : OMIT));
  try { return ev(f.body, env, ctx); } finally { ctx.depth--; }
}
function asScalarResult(v) {
  if (isArr(v)) return v.rows === 1 && v.cols === 1 ? v.d[0] : ERR("#CALC!");
  if (v instanceof Fn) return ERR("#CALC!");
  return v === OMIT ? null : v;
}

function ev(node, env, ctx) {
  if (--ctx.budget < 0) throw new FormulaError("Calcul trop long.");
  switch (node.k) {
    case "num": case "str": case "lit": return node.v;
    case "omit": return OMIT;
    case "ref": return ctx.ref(node.t);
    case "name": { const v = env.lookup(node.name); return v === undefined ? ERR("#NAME?") : v; }
    case "neg": return broadcast([ev(node.e, env, ctx)], x => { if (x instanceof XErr) return x; const n = toNum(x); return n instanceof XErr ? n : -n; });
    case "pct": return broadcast([ev(node.e, env, ctx)], x => { if (x instanceof XErr) return x; const n = toNum(x); return n instanceof XErr ? n : n / 100; });
    case "bin": return binop(node.op, ev(node.l, env, ctx), ev(node.r, env, ctx));
    case "invoke": {
      const f = ev(node.f, env, ctx);
      if (!(f instanceof Fn)) return f instanceof XErr ? f : ERR("#VALUE!");
      return callFn(f, node.args.map(a => ev(a, env, ctx)));
    }
    case "call": return callNamed(node, env, ctx);
  }
  throw new FormulaError("Expression inconnue.");
}

function callNamed(node, env, ctx) {
  const name = node.name, A = node.args;
  const E = n => ev(n, env, ctx);
  switch (name) {
    case "LET": {
      if (A.length < 3 || A.length % 2 === 0) throw new FormulaError("LET attend des paires nom, valeur puis un calcul final.");
      const e2 = new Env(env);
      for (let i = 0; i < A.length - 1; i += 2) e2.vars.set(nameOf(A[i], "variable"), ev(A[i + 1], e2, ctx));
      return ev(A[A.length - 1], e2, ctx);
    }
    case "LAMBDA": {
      if (!A.length) throw new FormulaError("LAMBDA attend au moins un calcul.");
      const params = A.slice(0, -1).map(a => nameOf(a, "paramètre"));
      return new Fn(params, A[A.length - 1], env, ctx);
    }
    case "ISOMITTED": return A[0] && A[0].k === "name" ? env.lookup(A[0].name) === OMIT : false;
    case "IF": {
      const c = E(A[0]);
      if (isArr(c)) {
        const t = A[1] ? E(A[1]) : true, f = A[2] && A[2].k !== "omit" ? E(A[2]) : false;
        return broadcast([c, t, f], (x, y, z) => { const b = toBool(x); return b instanceof XErr ? b : b ? (y === OMIT ? 0 : y) : (z === OMIT ? 0 : z); });
      }
      const b = toBool(c);
      if (b instanceof XErr) return b;
      if (b) return A[1] && A[1].k !== "omit" ? E(A[1]) : (A[1] ? 0 : true);
      return A[2] && A[2].k !== "omit" ? E(A[2]) : (A[2] ? 0 : false);
    }
    case "IFERROR": case "IFNA": {
      const v = E(A[0]);
      const hit = x => x instanceof XErr && (name === "IFERROR" || x.code === "#N/A");
      if (isArr(v)) {
        if (!v.d.some(hit)) return v;
        const alt = E(A[1]);
        return broadcast([v, alt], (x, y) => hit(x) ? (y === OMIT ? 0 : y) : x);
      }
      return hit(v) ? E(A[1]) : v;
    }
    case "ROW": case "COLUMN": {
      if (!A.length || A[0].k === "omit") return ERR("#VALUE!");
      if (A[0].k !== "ref") return ERR("#VALUE!");
      const t = A[0].t;
      if (name === "ROW") {
        const r1 = t.r1, r2 = t.r2 || t.r1, lo = Math.min(r1, r2), n = Math.abs(r2 - r1) + 1;
        return n === 1 ? lo : new Arr(n, 1, Array.from({ length: n }, (_, i) => lo + i));
      }
      const c1 = colNum(t.c1), c2 = t.c2 ? colNum(t.c2) : c1, lo = Math.min(c1, c2), n = Math.abs(c2 - c1) + 1;
      return n === 1 ? lo : new Arr(1, n, Array.from({ length: n }, (_, i) => lo + i));
    }
  }
  const bound = env.lookup(name);
  if (bound instanceof Fn) return callFn(bound, A.map(E));
  const fn = FN[name];
  if (!fn) return ERR("#NAME?");
  try { return fn(A.map(E), ctx); }
  catch (e) { if (e instanceof Bail) return e.e; throw e; }
}

/* ----------------------------------------------------------- fonctions -- */

function nums(args) {
  const out = [];
  for (const a of args) {
    if (a === OMIT) continue;
    if (isArr(a)) { for (const v of a.d) { if (v instanceof XErr) throw new Bail(v); if (typeof v === "number") out.push(v); } }
    else { if (a instanceof XErr) throw new Bail(a); if (a === null) continue; out.push(num(a)); }
  }
  return out;
}
function flat(args) { const out = []; for (const a of args) { if (a === OMIT) continue; if (isArr(a)) out.push(...a.d); else out.push(a); } return out; }
function roundTo(n, d) {
  const f = Math.pow(10, d);
  const m = +(Math.abs(n) * f).toPrecision(15);
  return Math.sign(n) * Math.round(m) / f;
}
function needFn(f) { if (!(f instanceof Fn)) throw new Bail(ERR("#VALUE!")); return f; }
function wild(pattern) {
  return new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/~\*/g, "\u0001").replace(/~\?/g, "\u0002")
    .replace(/\*/g, ".*").replace(/\?/g, ".").replace(/\u0001/g, "\\*").replace(/\u0002/g, "\\?") + "$", "i");
}
function criteria(crit) {
  crit = scal(crit);
  if (typeof crit === "number" || typeof crit === "boolean") return v => cmpVals(v, crit) === 0 && typeof v === typeof crit;
  const s = str(crit);
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(s);
  const op = m[1] || "=", rhs = m[2];
  const n = rhs.trim() !== "" && !isNaN(Number(rhs)) ? Number(rhs) : null;
  if (n !== null) return v => typeof v === "number" && (op === "=" ? v === n : op === "<>" ? v !== n : op === "<" ? v < n : op === ">" ? v > n : op === "<=" ? v <= n : v >= n);
  if (op === "=" || op === "<>") {
    const re = wild(rhs);
    const hit = v => rhs === "" ? (v === null || v === "") : (typeof v === "string" && re.test(v));
    return op === "=" ? hit : v => !hit(v);
  }
  return v => { if (typeof v !== "string") return false; const c = cmpVals(v, rhs); return op === "<" ? c < 0 : op === ">" ? c > 0 : op === "<=" ? c <= 0 : c >= 0; };
}
function makeRegex(p, cs, global) {
  let pat = str(p), flags = global ? "g" : "";
  if (/^\(\?i\)/.test(pat)) { pat = pat.slice(4); flags += "i"; }
  if (int(opt(cs, 0)) === 1 && !flags.includes("i")) flags += "i";
  try { return new RegExp(pat, flags); } catch (e) { throw new Bail(ERR("#VALUE!")); }
}
function expandRepl(repl, m) {
  return repl.replace(/\$(\d+|&)/g, (_, g) => g === "&" || g === "0" ? m[0] : (m[+g] === undefined ? "" : m[+g]));
}
function sortRows(A, keyFns) {
  const idx = Array.from({ length: A.rows }, (_, i) => i);
  idx.sort((i, j) => { for (const [key, ord] of keyFns) { const c = cmpVals(key(i), key(j)); if (c) return c * ord; } return i - j; });
  const out = new Arr(A.rows, A.cols);
  idx.forEach((src, r) => { for (let c = 0; c < A.cols; c++) out.set(r, c, A.get(src, c)); });
  return out;
}
function pickRows(A, rows) { const out = new Arr(rows.length, A.cols); rows.forEach((r, i) => { for (let c = 0; c < A.cols; c++) out.set(i, c, A.get(r, c)); }); return out; }
function pickCols(A, cols) { const out = new Arr(A.rows, cols.length); for (let r = 0; r < A.rows; r++) cols.forEach((c, j) => out.set(r, j, A.get(r, c))); return out; }
function vectorItems(v) { const a = toArr(v); return a.d; }
function idxList(args, n) {
  const out = [];
  for (const v of flat(args)) {
    let k = int(v);
    if (k < 0) k = n + k + 1;
    if (k < 1 || k > n) throw new Bail(ERR("#VALUE!"));
    out.push(k - 1);
  }
  return out;
}
function textPos(s, d, inst) {
  const pos = [];
  if (d === "") return pos;
  let i = s.indexOf(d);
  while (i >= 0) { pos.push(i); i = s.indexOf(d, i + d.length); }
  const k = inst > 0 ? inst - 1 : pos.length + inst;
  return k >= 0 && k < pos.length ? [pos[k]] : [];
}
function lookupIndex(lv, items, mode, search) {
  mode = int(opt(mode, 0)); search = int(opt(search, 1));
  const order = search === -1 ? items.map((_, i) => items.length - 1 - i) : items.map((_, i) => i);
  if (mode === 3) { const re = makeRegex(lv, 0, false); for (const i of order) if (typeof items[i] === "string" && re.test(items[i])) return i; return -1; }
  if (mode === 2 && typeof lv === "string") { const re = wild(lv); for (const i of order) if (typeof items[i] === "string" && re.test(items[i])) return i; return -1; }
  for (const i of order) if (items[i] !== null && cmpVals(items[i], lv) === 0 && (typeof items[i] === typeof lv || items[i] === null)) return i;
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

const FN = {
  /* nombres */
  ABS: lift(x => Math.abs(num(x))),
  INT: lift(x => Math.floor(num(x))),
  SIGN: lift(x => Math.sign(num(x))),
  SQRT: lift(x => { const n = num(x); return n < 0 ? ERR("#NUM!") : Math.sqrt(n); }),
  POWER: lift((x, y) => Math.pow(num(x), num(y))),
  MOD: lift((x, y) => { const n = num(x), d = num(y); return d === 0 ? ERR("#DIV/0!") : n - d * Math.floor(n / d); }),
  ROUND: lift((x, d) => roundTo(num(x), int(opt(d, 0)))),
  ROUNDUP: lift((x, d) => { const f = Math.pow(10, int(opt(d, 0))), n = num(x); return Math.sign(n) * Math.ceil(+(Math.abs(n) * f).toPrecision(15)) / f; }),
  ROUNDDOWN: lift((x, d) => { const f = Math.pow(10, int(opt(d, 0))), n = num(x); return Math.sign(n) * Math.floor(+(Math.abs(n) * f).toPrecision(15)) / f; }),
  ISODD: lift(x => Math.abs(Math.trunc(num(x))) % 2 === 1),
  ISEVEN: lift(x => Math.abs(Math.trunc(num(x))) % 2 === 0),
  ISNUMBER: lift(x => typeof x === "number", true),
  ISTEXT: lift(x => typeof x === "string", true),
  ISBLANK: lift(x => x === null, true),
  ISERROR: lift(x => x instanceof XErr, true),
  ISNA: lift(x => x instanceof XErr && x.code === "#N/A", true),
  ISLOGICAL: lift(x => typeof x === "boolean", true),
  N: lift(x => typeof x === "number" ? x : typeof x === "boolean" ? +x : 0),
  NOT: lift(x => !bool(x)),
  NA: () => ERR("#N/A"),
  PI: () => Math.PI,
  VALUE: lift(x => { if (typeof x === "number") return x; const s = str(x).trim(), n = Number(s); return s === "" || isNaN(n) ? ERR("#VALUE!") : n; }),
  CHAR: lift(x => String.fromCharCode(int(x))),
  CODE: lift(x => { const s = str(x); return s ? s.charCodeAt(0) : ERR("#VALUE!"); }),
  ADDRESS: lift((r, c, a) => { const k = int(opt(a, 1)), cn = colName(int(c)), rn = int(r); return k === 4 ? cn + rn : k === 2 ? cn + "$" + rn : k === 3 ? "$" + cn + rn : "$" + cn + "$" + rn; }),

  /* agrégats */
  SUM: a => nums(a).reduce((x, y) => x + y, 0),
  PRODUCT: a => nums(a).reduce((x, y) => x * y, 1),
  AVERAGE: a => { const n = nums(a); return n.length ? n.reduce((x, y) => x + y, 0) / n.length : ERR("#DIV/0!"); },
  MIN: a => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
  MAX: a => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
  MEDIAN: a => { const n = nums(a).sort((x, y) => x - y); if (!n.length) return ERR("#NUM!"); const h = n.length >> 1; return n.length % 2 ? n[h] : (n[h - 1] + n[h]) / 2; },
  COUNT: a => flat(a).filter(v => typeof v === "number").length,
  COUNTA: a => flat(a).filter(v => v !== null).length,
  COUNTBLANK: a => flat(a).filter(v => v === null || v === "").length,
  LARGE: a => { const n = nums([a[0]]).sort((x, y) => y - x); return lift(k => { const i = int(k); return i >= 1 && i <= n.length ? n[i - 1] : ERR("#NUM!"); })([a[1]]); },
  SMALL: a => { const n = nums([a[0]]).sort((x, y) => x - y); return lift(k => { const i = int(k); return i >= 1 && i <= n.length ? n[i - 1] : ERR("#NUM!"); })([a[1]]); },
  AND: a => { const v = flat(a).filter(x => x !== null); if (!v.length) return ERR("#VALUE!"); return v.every(x => bool(x)); },
  OR: a => { const v = flat(a).filter(x => x !== null); if (!v.length) return ERR("#VALUE!"); return v.some(x => bool(x)); },
  SUMPRODUCT: a => {
    const arrs = a.filter(x => x !== OMIT).map(toArr);
    const R = arrs[0].rows, C = arrs[0].cols;
    if (arrs.some(x => x.rows !== R || x.cols !== C)) return ERR("#VALUE!");
    let s = 0;
    for (let i = 0; i < R * C; i++) {
      let p = 1;
      for (const x of arrs) { const v = x.d[i]; if (v instanceof XErr) return v; p *= typeof v === "number" ? v : 0; }
      s += p;
    }
    return s;
  },
  COUNTIF: a => { const t = criteria(a[1]); return toArr(a[0]).d.filter(t).length; },
  SUMIF: a => { const rng = toArr(a[0]), t = criteria(a[1]), sr = a[2] && a[2] !== OMIT ? toArr(a[2]) : rng; let s = 0; rng.d.forEach((v, i) => { if (t(v) && typeof sr.d[i] === "number") s += sr.d[i]; }); return s; },
  COUNTIFS: a => {
    const pairs = []; for (let i = 0; i < a.length; i += 2) pairs.push([toArr(a[i]), criteria(a[i + 1])]);
    const n = pairs[0][0].d.length; let k = 0;
    for (let i = 0; i < n; i++) if (pairs.every(([r, t]) => t(r.d[i]))) k++;
    return k;
  },
  SUMIFS: a => {
    const sr = toArr(a[0]), pairs = []; for (let i = 1; i < a.length; i += 2) pairs.push([toArr(a[i]), criteria(a[i + 1])]);
    let s = 0; sr.d.forEach((v, i) => { if (typeof v === "number" && pairs.every(([r, t]) => t(r.d[i]))) s += v; }); return s;
  },

  /* logique */
  IFS: a => broadcast(a, (...xs) => { for (let i = 0; i + 1 < xs.length; i += 2) { const b = toBool(xs[i]); if (b instanceof XErr) return b; if (b) return xs[i + 1]; } return ERR("#N/A"); }),
  SWITCH: a => broadcast(a, (...xs) => { const v = xs[0]; let i = 1; for (; i + 1 < xs.length; i += 2) if (cmpVals(v, xs[i]) === 0) return xs[i + 1]; return i < xs.length ? xs[i] : ERR("#N/A"); }),
  CHOOSE: a => broadcast([a[0]], k => { const i = Math.trunc(toNum(k)); return i >= 1 && i < a.length ? a[i] : ERR("#VALUE!"); }),

  /* texte */
  LEN: lift(x => str(x).length),
  UPPER: lift(x => str(x).toUpperCase()),
  LOWER: lift(x => str(x).toLowerCase()),
  PROPER: lift(x => str(x).toLowerCase().replace(/(^|[^a-zA-Z])([a-z])/g, (m, p, ch) => p + ch.toUpperCase())),
  TRIM: lift(x => str(x).replace(/ +/g, " ").trim()),
  LEFT: lift((t, n) => { const k = int(opt(n, 1)); return k < 0 ? ERR("#VALUE!") : str(t).slice(0, k); }),
  RIGHT: lift((t, n) => { const k = int(opt(n, 1)), s = str(t); return k < 0 ? ERR("#VALUE!") : k === 0 ? "" : s.slice(-k); }),
  MID: lift((t, s, n) => { const a = int(s), k = int(n); return a < 1 || k < 0 ? ERR("#VALUE!") : str(t).substr(a - 1, k); }),
  REPT: lift((t, n) => str(t).repeat(Math.max(0, int(n)))),
  EXACT: lift((x, y) => str(x) === str(y)),
  SUBSTITUTE: lift((t, o, nw, inst) => {
    const s = str(t), old = str(o), neu = str(nw);
    if (old === "") return s;
    if (inst === undefined || inst === OMIT) return s.split(old).join(neu);
    const k = int(inst); let i = -1;
    for (let c = 0; c < k; c++) { i = s.indexOf(old, i + 1); if (i < 0) return s; }
    return s.slice(0, i) + neu + s.slice(i + old.length);
  }),
  SEARCH: lift((f, w, st) => { const i = str(w).toLowerCase().indexOf(str(f).toLowerCase(), int(opt(st, 1)) - 1); return i < 0 ? ERR("#VALUE!") : i + 1; }),
  FIND: lift((f, w, st) => { const i = str(w).indexOf(str(f), int(opt(st, 1)) - 1); return i < 0 ? ERR("#VALUE!") : i + 1; }),
  TEXTBEFORE: lift((t, d, inst) => { const s = str(t), dl = str(d), p = textPos(s, dl, int(opt(inst, 1))); return p.length ? s.slice(0, p[0]) : ERR("#N/A"); }),
  TEXTAFTER: lift((t, d, inst) => { const s = str(t), dl = str(d), p = textPos(s, dl, int(opt(inst, 1))); return p.length ? s.slice(p[0] + dl.length) : ERR("#N/A"); }),
  TEXT: lift((v, f) => {
    const fmt = str(f), n = toNum(v);
    if (n instanceof XErr) return str(v);
    const m = /^(#,##)?(0+)(?:\.(0+))?$/.exec(fmt);
    if (!m) return str(v);
    const dec = m[3] ? m[3].length : 0;
    let s = roundTo(n, dec).toFixed(dec);
    let [ip, dp] = s.replace("-", "").split(".");
    ip = ip.padStart(m[2].length, "0");
    if (m[1]) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (n < 0 ? "-" : "") + ip + (dp ? "." + dp : "");
  }),
  CONCAT: a => { let s = ""; for (const v of flat(a)) s += str(v); return s; },
  TEXTJOIN: a => {
    const d = str(scal(a[0])), ig = bool(scal(opt(a[1], true)));
    const parts = flat(a.slice(2)).map(v => str(v)).filter(s => !(ig && s === ""));
    return parts.join(d);
  },
  TEXTSPLIT: a => {
    const s = str(scal(a[0]));
    const toRe = v => { if (v === undefined || v === OMIT) return null; const ds = vectorItems(v).map(x => str(x)).filter(x => x !== ""); return ds.length ? new RegExp(ds.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")) : null; };
    const cre = toRe(a[1]), rre = toRe(a[2]), ig = bool(opt(a[3], false));
    let rows = rre ? s.split(rre) : [s];
    if (ig) rows = rows.filter(r => r !== "");
    let grid = rows.map(r => cre ? r.split(cre) : [r]);
    if (ig) grid = grid.map(r => r.filter(x => x !== ""));
    return Arr.from(grid.length ? grid : [[""]]);
  },
  REGEXTEST: lift((t, p, cs) => makeRegex(p, cs, false).test(str(t))),
  REGEXREPLACE: lift((t, p, r, occ, cs) => {
    const s = str(t), re = makeRegex(p, cs, true), repl = str(r), o = int(opt(occ, 0));
    const all = [...s.matchAll(re)];
    const target = o === 0 ? -1 : o > 0 ? o - 1 : all.length + o;
    let k = -1;
    return s.replace(re, (...m) => {
      k++;
      const groups = m.slice(0, typeof m[m.length - 1] === "object" ? -3 : -2);
      return (o === 0 || k === target) ? expandRepl(repl, groups) : m[0];
    });
  }),
  REGEXEXTRACT: a => {
    const mode = int(scal(opt(a[2], 0)));
    if (isArr(a[0]) && mode === 0) return lift((t, p, m, cs) => { const x = str(t).match(makeRegex(p, cs, false)); return x ? x[0] : ERR("#N/A"); })([a[0], a[1], OMIT, opt(a[3], OMIT)]);
    const s = str(scal(a[0]));
    if (mode === 0) { const x = s.match(makeRegex(scal(a[1]), scal(opt(a[3], 0)), false)); return x ? x[0] : ERR("#N/A"); }
    if (mode === 1) { const all = [...s.matchAll(makeRegex(scal(a[1]), scal(opt(a[3], 0)), true))].map(m => m[0]); return all.length ? new Arr(1, all.length, all) : ERR("#N/A"); }
    if (mode === 2) { const x = s.match(makeRegex(scal(a[1]), scal(opt(a[3], 0)), false)); if (!x) return ERR("#N/A"); const g = x.length > 1 ? x.slice(1).map(v => v === undefined ? "" : v) : [x[0]]; return new Arr(1, g.length, g); }
    return ERR("#VALUE!");
  },

  /* tableaux */
  ROWS: a => toArr(a[0]).rows,
  COLUMNS: a => toArr(a[0]).cols,
  TRANSPOSE: a => { const A = toArr(a[0]), o = new Arr(A.cols, A.rows); for (let r = 0; r < A.rows; r++) for (let c = 0; c < A.cols; c++) o.set(c, r, A.get(r, c)); return o; },
  SEQUENCE: a => {
    const R = int(scal(opt(a[0], 1))), C = int(scal(opt(a[1], 1))), st = num(scal(opt(a[2], 1))), sp = num(scal(opt(a[3], 1)));
    if (R < 1 || C < 1) return ERR("#CALC!");
    if (R * C > 100000) return ERR("#NUM!");
    const o = new Arr(R, C); for (let i = 0; i < R * C; i++) o.d[i] = st + i * sp; return o;
  },
  MAKEARRAY: a => {
    const R = int(scal(a[0])), C = int(scal(a[1])), f = needFn(a[2]);
    if (R < 1 || C < 1) return ERR("#CALC!");
    const o = new Arr(R, C);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) o.set(r, c, asScalarResult(callFn(f, [r + 1, c + 1])));
    return o;
  },
  MAP: a => {
    const f = needFn(a[a.length - 1]), arrs = a.slice(0, -1).map(toArr);
    const R = Math.max(...arrs.map(x => x.rows)), C = Math.max(...arrs.map(x => x.cols));
    const o = new Arr(R, C);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      o.set(r, c, asScalarResult(callFn(f, arrs.map(x => (x.rows === 1 && x.cols === 1) ? x.d[0] : (r < x.rows && c < x.cols ? x.get(r, c) : ERR("#N/A"))))));
    }
    return o;
  },
  SCAN: a => {
    let acc = opt(a[0], null); const A = toArr(a[1]), f = needFn(a[2]), o = new Arr(A.rows, A.cols);
    for (let i = 0; i < A.d.length; i++) { acc = asScalarResult(callFn(f, [acc, A.d[i]])); o.d[i] = acc; }
    return o;
  },
  REDUCE: a => {
    let acc = opt(a[0], null); const A = toArr(a[1]), f = needFn(a[2]);
    for (let i = 0; i < A.d.length; i++) acc = callFn(f, [acc, A.d[i]]);
    return acc === OMIT ? null : acc;
  },
  BYROW: a => { const A = toArr(a[0]), f = needFn(a[1]), o = new Arr(A.rows, 1); for (let r = 0; r < A.rows; r++) o.d[r] = asScalarResult(callFn(f, [pickRows(A, [r])])); return o; },
  BYCOL: a => { const A = toArr(a[0]), f = needFn(a[1]), o = new Arr(1, A.cols); for (let c = 0; c < A.cols; c++) o.d[c] = asScalarResult(callFn(f, [pickCols(A, [c])])); return o; },
  INDEX: a => {
    const A = toArr(a[0]);
    let r = opt(a[1], OMIT), c = opt(a[2], OMIT);
    if (c === OMIT) {
      if (A.rows === 1 && A.cols > 1) { c = r; r = 1; }
      else if (A.cols === 1) c = 1;
      else if (!isArr(r)) { const k = int(r); if (k < 1 || k > A.rows) return ERR("#REF!"); return pickRows(A, [k - 1]); }
    }
    if (r === OMIT) r = 0;
    if (!isArr(r) && !isArr(c)) {
      const ri = int(r), ci = int(c);
      if (ri < 0 || ci < 0 || ri > A.rows || ci > A.cols) return ERR("#REF!");
      if (ri === 0 && ci === 0) return A;
      if (ri === 0) return pickCols(A, [ci - 1]);
      if (ci === 0) return pickRows(A, [ri - 1]);
      return A.get(ri - 1, ci - 1);
    }
    return lift((x, y) => { const ri = int(x), ci = int(y); return ri < 1 || ci < 1 || ri > A.rows || ci > A.cols ? ERR("#REF!") : A.get(ri - 1, ci - 1); })([r, c]);
  },
  HSTACK: a => {
    const arrs = a.filter(x => x !== OMIT).map(toArr), R = Math.max(...arrs.map(x => x.rows)), C = arrs.reduce((s, x) => s + x.cols, 0);
    const o = new Arr(R, C); let off = 0;
    for (const x of arrs) { for (let r = 0; r < R; r++) for (let c = 0; c < x.cols; c++) o.set(r, off + c, r < x.rows ? x.get(r, c) : ERR("#N/A")); off += x.cols; }
    return o;
  },
  VSTACK: a => {
    const arrs = a.filter(x => x !== OMIT).map(toArr), C = Math.max(...arrs.map(x => x.cols)), R = arrs.reduce((s, x) => s + x.rows, 0);
    const o = new Arr(R, C); let off = 0;
    for (const x of arrs) { for (let r = 0; r < x.rows; r++) for (let c = 0; c < C; c++) o.set(off + r, c, c < x.cols ? x.get(r, c) : ERR("#N/A")); off += x.rows; }
    return o;
  },
  TOCOL: a => toLine(a, true),
  TOROW: a => toLine(a, false),
  WRAPROWS: a => wrap(a, true),
  WRAPCOLS: a => wrap(a, false),
  TAKE: a => takeDrop(a, true),
  DROP: a => takeDrop(a, false),
  CHOOSEROWS: a => { const A = toArr(a[0]); return pickRows(A, idxList(a.slice(1), A.rows)); },
  CHOOSECOLS: a => { const A = toArr(a[0]); return pickCols(A, idxList(a.slice(1), A.cols)); },
  EXPAND: a => {
    const A = toArr(a[0]), R = int(scal(opt(a[1], A.rows))), C = int(scal(opt(a[2], A.cols))), pad = opt(a[3], ERR("#N/A"));
    if (R < A.rows || C < A.cols) return ERR("#VALUE!");
    const o = new Arr(R, C);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) o.set(r, c, r < A.rows && c < A.cols ? A.get(r, c) : scal(pad));
    return o;
  },
  SORT: a => {
    const A = toArr(a[0]), k = int(scal(opt(a[1], 1))), ord = int(scal(opt(a[2], 1))) === -1 ? -1 : 1, byCol = bool(scal(opt(a[3], false)));
    if (byCol) { const T = FN.TRANSPOSE([A]); return FN.TRANSPOSE([sortRows(T, [[i => T.get(i, k - 1), ord]])]); }
    if (k < 1 || k > A.cols) return ERR("#VALUE!");
    return sortRows(A, [[i => A.get(i, k - 1), ord]]);
  },
  SORTBY: a => {
    const A = toArr(a[0]), keys = [];
    for (let i = 1; i < a.length; i += 2) {
      const K = toArr(a[i]), ord = int(scal(opt(a[i + 1], 1))) === -1 ? -1 : 1;
      if (K.d.length !== A.rows) return ERR("#VALUE!");
      keys.push([j => K.d[j], ord]);
    }
    return sortRows(A, keys);
  },
  UNIQUE: a => {
    const A = toArr(a[0]), byCol = bool(scal(opt(a[1], false))), once = bool(scal(opt(a[2], false)));
    const M = byCol ? FN.TRANSPOSE([A]) : A;
    const keyOf = r => { const ks = []; for (let c = 0; c < M.cols; c++) { const v = M.get(r, c); ks.push(typeof v + ":" + (typeof v === "string" ? v.toLowerCase() : String(v))); } return ks.join("\u0001"); };
    const count = new Map(), first = [];
    for (let r = 0; r < M.rows; r++) { const k = keyOf(r); if (!count.has(k)) { count.set(k, 0); first.push(r); } count.set(k, count.get(k) + 1); }
    const rows = first.filter(r => !once || count.get(keyOf(r)) === 1);
    if (!rows.length) return ERR("#CALC!");
    const out = pickRows(M, rows);
    return byCol ? FN.TRANSPOSE([out]) : out;
  },
  FILTER: a => {
    const A = toArr(a[0]), inc = toArr(a[1]);
    let keep, byRows;
    if (inc.cols === 1 && inc.rows === A.rows) byRows = true;
    else if (inc.rows === 1 && inc.cols === A.cols) byRows = false;
    else return ERR("#VALUE!");
    keep = [];
    for (let i = 0; i < inc.d.length; i++) { const b = toBool(inc.d[i]); if (b instanceof XErr) return b; if (b) keep.push(i); }
    if (!keep.length) return a[2] !== undefined && a[2] !== OMIT ? a[2] : ERR("#CALC!");
    return byRows ? pickRows(A, keep) : pickCols(A, keep);
  },
  XLOOKUP: a => {
    const la = toArr(a[1]), ra = toArr(a[2]), items = la.d, horiz = la.rows === 1 && la.cols > 1;
    const nf = a[3] === undefined || a[3] === OMIT ? ERR("#N/A") : a[3];
    const one = lv => {
      const i = lookupIndex(lv, items, a[4], a[5]);
      if (i < 0) return nf;
      if (horiz) return ra.rows === 1 ? ra.get(0, i) : pickCols(ra, [i]);
      return ra.cols === 1 ? ra.get(i, 0) : pickRows(ra, [i]);
    };
    if (isArr(a[0])) return lift(lv => asScalarResult(one(lv)))([a[0]]);
    return one(a[0]);
  },
  XMATCH: a => { const items = toArr(a[1]).d; return lift(lv => { const i = lookupIndex(lv, items, a[2], a[3]); return i < 0 ? ERR("#N/A") : i + 1; })([a[0]]); },
  MATCH: a => {
    const items = toArr(a[1]).d, t = int(scal(opt(a[2], 1)));
    return lift(lv => {
      if (t === 0) { const i = typeof lv === "string" && /[*?]/.test(lv) ? items.findIndex(v => typeof v === "string" && wild(lv).test(v)) : lookupIndex(lv, items, 0, 1); return i < 0 ? ERR("#N/A") : i + 1; }
      let best = -1; items.forEach((v, i) => { if (typeof v === typeof lv && (t === 1 ? cmpVals(v, lv) <= 0 : cmpVals(v, lv) >= 0)) best = i; });
      return best < 0 ? ERR("#N/A") : best + 1;
    })([a[0]]);
  }
};
function toLine(a, col) {
  const A = toArr(a[0]), ig = int(scal(opt(a[1], 0))), byCol = bool(scal(opt(a[2], false)));
  const vals = [];
  const push = v => { if ((ig === 1 || ig === 3) && v === null) return; if ((ig === 2 || ig === 3) && v instanceof XErr) return; vals.push(v); };
  if (byCol) { for (let c = 0; c < A.cols; c++) for (let r = 0; r < A.rows; r++) push(A.get(r, c)); }
  else A.d.forEach(push);
  if (!vals.length) return ERR("#CALC!");
  return col ? new Arr(vals.length, 1, vals) : new Arr(1, vals.length, vals);
}
function wrap(a, rowsFirst) {
  const v = toArr(a[0]).d, n = int(scal(a[1])), pad = opt(a[2], ERR("#N/A"));
  if (n < 1) return ERR("#NUM!");
  const k = Math.ceil(v.length / n);
  const o = rowsFirst ? new Arr(k, n) : new Arr(n, k);
  for (let i = 0; i < k * n; i++) {
    const val = i < v.length ? v[i] : scal(pad);
    if (rowsFirst) o.d[i] = val; else o.set(i % n, Math.floor(i / n), val);
  }
  return o;
}
function takeDrop(a, take) {
  const A = toArr(a[0]);
  const rArg = opt(a[1], OMIT), cArg = opt(a[2], OMIT);
  const span = (n, arg) => {
    if (arg === OMIT) return [0, n];
    const k = int(scal(arg));
    if (take) { if (k === 0) return null; return k > 0 ? [0, Math.min(k, n)] : [Math.max(0, n + k), n]; }
    return k >= 0 ? [Math.min(k, n), n] : [0, Math.max(0, n + k)];
  };
  const rs = span(A.rows, rArg), cs = span(A.cols, cArg);
  if (!rs || !cs || rs[1] - rs[0] < 1 || cs[1] - cs[0] < 1) return ERR("#CALC!");
  const rows = [], cols = [];
  for (let r = rs[0]; r < rs[1]; r++) rows.push(r);
  for (let c = cs[0]; c < cs[1]; c++) cols.push(c);
  return pickCols(pickRows(A, rows), cols);
}

/* ------------------------------------------------------------ résultat -- */

function finalizeValue(v) {
  const fix = x => (x === null || x === undefined || x === OMIT) ? 0 : x instanceof Fn ? ERR("#CALC!") : isArr(x) ? ERR("#CALC!") : x;
  if (isArr(v)) return new Arr(v.rows, v.cols, v.d.map(fix));
  return fix(v);
}
function runFormula(src, sheet) {
  try {
    const ast = parseFormula(src);
    const ctx = makeCtx(sheet || {});
    return { ok: true, value: finalizeValue(ev(ast, new Env(null), ctx)) };
  } catch (e) {
    if (e instanceof FormulaError) return { ok: false, msg: e.message };
    if (e instanceof Bail) return { ok: true, value: e.e };
    if (e instanceof RangeError) return { ok: false, msg: "Calcul trop profond." };
    return { ok: false, msg: "Formule non reconnue : " + e.message };
  }
}
function cellEq(x, y) {
  if (x instanceof XErr || y instanceof XErr) return x instanceof XErr && y instanceof XErr && x.code === y.code;
  if (typeof x === "number" && typeof y === "number") return Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
  if (typeof x === "number" && typeof y === "string") return fmtNum(x) === y;
  if (typeof y === "number" && typeof x === "string") return fmtNum(y) === x;
  return x === y;
}
function sameResult(a, b) {
  const A = toArr(a), B = toArr(b);
  const vec = X => X.rows === 1 || X.cols === 1;
  if (!(A.rows === B.rows && A.cols === B.cols) && !(vec(A) && vec(B) && A.d.length === B.d.length)) return false;
  return A.d.every((x, i) => cellEq(x, B.d[i]));
}
function sheetFromRows(rows) {
  const sheet = {};
  rows.forEach((row, r) => row.forEach((v, c) => { if (v !== null && v !== undefined && v !== "") sheet[colName(c + 1) + (r + 1)] = v; }));
  return sheet;
}


if (typeof module !== 'undefined') module.exports = { runFormula, sameResult, sheetFromRows, parseFormula, Arr, XErr, FUNCS, FUNCS_SORTED };
