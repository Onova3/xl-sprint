/* Moteur de formules : API publique. Travaille toujours en syntaxe canonique en-US. */

import { ev, makeCtx } from './evaluate';
import { parseFormula } from './parser';
import { Arr, Bail, colName, Env, Fn, fmtNum, FormulaError, isArr, OMIT, toArr, XErr, ERR } from './values';
import type { Scalar, Sheet, V } from './values';

export { Arr, XErr, parseFormula, fmtNum };
export { tokenize } from './parser';
export { validName } from './evaluate';
export type { Scalar, Sheet, V };

/** Fonctions reconnues par la complétion (noms anglais canoniques), reprises de la v1.1. */
export const FUNCS = (
  'ABS ACCRINT ADDRESS AGGREGATE AND ARABIC ARRAYTOTEXT ASC ASIN ATAN ATAN2 AVEDEV AVERAGE AVERAGEA AVERAGEIF AVERAGEIFS ' +
  'BASE BIN2DEC BITAND BYCOL BYROW CEILING CEILING.MATH CELL CHAR CHIDIST CHISQ.DIST CHOOSE CHOOSECOLS CHOOSEROWS CLEAN CODE COLUMN COLUMNS ' +
  'COMBIN CONCAT CONCATENATE CONVERT CORREL COS COUNT COUNTA COUNTBLANK COUNTIF COUNTIFS COVARIANCE.S DATE DATEDIF DATEVALUE DAY DAYS DAYS360 ' +
  'DEC2BIN DEC2HEX DEGREES DELTA DOLLAR DROP EDATE EOMONTH EVEN EXACT EXP EXPAND FACT FALSE FILTER FILTERXML FIND FINDB FIXED FLOOR FLOOR.MATH ' +
  'FORECAST FREQUENCY FV GCD GROUPBY HEX2DEC HLOOKUP HOUR HSTACK HYPERLINK IF IFERROR IFNA IFS IMAGE INDEX INDIRECT INFO INT INTERCEPT IRR ' +
  'ISBLANK ISERR ISERROR ISEVEN ISFORMULA ISLOGICAL ISNA ISNUMBER ISODD ISOMITTED ISREF ISTEXT LAMBDA LARGE LCM LEFT LEFTB LEN LENB LET LINEST ' +
  'LN LOG LOG10 LOOKUP LOWER MAKEARRAY MAP MATCH MAX MAXA MAXIFS MEDIAN MID MIDB MIN MINA MINIFS MINUTE MMULT MOD MODE MODE.SNGL MONTH MROUND ' +
  'N NA NETWORKDAYS NOT NOW NPV NUMBERVALUE ODD OFFSET OR PERCENTILE.INC PERCENTRANK.INC PI PIVOTBY PMT POWER PRODUCT PROPER PV QUARTILE.INC ' +
  'QUOTIENT RADIANS RAND RANDARRAY RANDBETWEEN RANK RANK.AVG RANK.EQ RATE RECEIVED REDUCE REGEXEXTRACT REGEXREPLACE REGEXTEST REPLACE REPT RIGHT ' +
  'ROMAN ROUND ROUNDDOWN ROUNDUP ROW ROWS SCAN SEARCH SEARCHB SEC SECOND SEQUENCE SHEET SIGN SIN SLOPE SMALL SORT SORTBY SQRT STANDARDIZE STDEV ' +
  'STDEV.P STDEV.S SUBSTITUTE SUBTOTAL SUM SUMIF SUMIFS SUMPRODUCT SUMSQ SWITCH T TAKE TAN TEXT TEXTAFTER TEXTBEFORE TEXTJOIN TEXTSPLIT TIME ' +
  'TIMEVALUE TOCOL TODAY TOROW TRANSPOSE TREND TRIM TRIMMEAN TRIMRANGE TRUE TRUNC TYPE UNICHAR UNICODE UNIQUE UPPER VALUE VAR VAR.P VAR.S VLOOKUP ' +
  'VSTACK WEEKDAY WEEKNUM WORKDAY WRAPCOLS WRAPROWS XLOOKUP XMATCH XOR YEAR YEARFRAC'
).split(' ');
export const FUNCS_SORTED = [...FUNCS].sort();

export type RunResult = { ok: true; value: V } | { ok: false; msg: string };

function finalizeValue(v: V): V {
  const fix = (x: V) =>
    x === null || x === undefined || x === OMIT
      ? 0
      : x instanceof Fn
        ? ERR('#CALC!')
        : isArr(x)
          ? ERR('#CALC!')
          : x;
  if (isArr(v)) return new Arr(v.rows, v.cols, v.d.map(fix));
  return fix(v);
}

export function runFormula(src: string, sheet?: Sheet): RunResult {
  try {
    const ast = parseFormula(src);
    const ctx = makeCtx(sheet || {});
    return { ok: true, value: finalizeValue(ev(ast, new Env(null), ctx)) };
  } catch (e) {
    if (e instanceof FormulaError) return { ok: false, msg: e.message };
    if (e instanceof Bail) return { ok: true, value: e.e };
    if (e instanceof RangeError) return { ok: false, msg: 'Calcul trop profond.' };
    return { ok: false, msg: 'Formule non reconnue : ' + (e as Error).message };
  }
}

function cellEq(x: V, y: V): boolean {
  if (x instanceof XErr || y instanceof XErr)
    return x instanceof XErr && y instanceof XErr && x.code === y.code;
  if (typeof x === 'number' && typeof y === 'number')
    return Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
  if (typeof x === 'number' && typeof y === 'string') return fmtNum(x) === y;
  if (typeof y === 'number' && typeof x === 'string') return fmtNum(y) === x;
  return x === y;
}

export function sameResult(a: V, b: V): boolean {
  const A = toArr(a),
    B = toArr(b);
  const vec = (X: Arr) => X.rows === 1 || X.cols === 1;
  if (!(A.rows === B.rows && A.cols === B.cols) && !(vec(A) && vec(B) && A.d.length === B.d.length))
    return false;
  return A.d.every((x, i) => cellEq(x, B.d[i]));
}

export function sheetFromRows(rows: Scalar[][]): Sheet {
  const sheet: Sheet = {};
  rows.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v !== null && v !== undefined && v !== '') sheet[colName(c + 1) + (r + 1)] = v;
    }),
  );
  return sheet;
}
