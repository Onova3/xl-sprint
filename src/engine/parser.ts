/* Lecture d'une formule canonique (en-US) : jetons puis arbre syntaxique. */

import { Arr, FormulaError, type RefTok, type V } from './values';

export type Tok =
  | { t: 'str'; v: string }
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | RefTok;

export type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'lit'; v: V }
  | { k: 'omit' }
  | { k: 'ref'; t: RefTok }
  | { k: 'name'; name: string }
  | { k: 'neg'; e: Node }
  | { k: 'pct'; e: Node }
  | { k: 'bin'; op: string; l: Node; r: Node }
  | { k: 'invoke'; f: Node; args: Node[] }
  | { k: 'call'; name: string; args: Node[] };

export function tokenize(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0,
    m: RegExpExecArray | null;
  while (i < s.length) {
    const ch = s[i],
      rest = s.slice(i);
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '"') {
      let j = i + 1,
        str = '';
      for (;;) {
        if (j >= s.length) throw new FormulaError('Guillemet non fermé.');
        if (s[j] === '"') {
          if (s[j + 1] === '"') {
            str += '"';
            j += 2;
            continue;
          }
          break;
        }
        str += s[j++];
      }
      toks.push({ t: 'str', v: str });
      i = j + 1;
      continue;
    }
    if ((m = /^\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?/.exec(rest))) {
      const next = s[i + m[0].length] || '';
      if (!/[A-Za-z0-9_.(]/.test(next)) {
        toks.push({
          t: 'ref',
          v: m[0],
          c1: m[1].toUpperCase(),
          r1: +m[2],
          c2: m[3] ? m[3].toUpperCase() : null,
          r2: m[4] ? +m[4] : null,
        });
        i += m[0].length;
        continue;
      }
    }
    if ((m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest))) {
      toks.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if ((m = /^[A-Za-z_\\][A-Za-z0-9_.]*/.exec(rest))) {
      toks.push({ t: 'id', v: m[0] });
      i += m[0].length;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (two === '<>' || two === '<=' || two === '>=') {
      toks.push({ t: 'op', v: two });
      i += 2;
      continue;
    }
    if ('+-*/^&=<>%(),{};'.includes(ch)) {
      toks.push({ t: 'op', v: ch });
      i++;
      continue;
    }
    if (ch === '[' || ch === ']')
      throw new FormulaError(
        'Les références structurées (Table[Colonne]) ne sont pas gérées ici : utilisez les plages de la feuille.',
      );
    throw new FormulaError('Caractère inattendu : « ' + ch + ' ».');
  }
  return toks;
}

const CMP = ['=', '<>', '<', '>', '<=', '>='];

export function parseFormula(src: string): Node {
  let s = String(src).trim();
  if (s.startsWith('=')) s = s.slice(1);
  if (!s.trim()) throw new FormulaError('Formule vide.');
  const toks = tokenize(s);
  let depth = 0;
  for (const t of toks) {
    if (t.t === 'op' && t.v === '(') depth++;
    if (t.t === 'op' && t.v === ')') depth--;
  }
  for (let k = 0; k < depth; k++) toks.push({ t: 'op', v: ')' }); // Excel referme les parenthèses
  let p = 0;
  const isOp = (v: string) => !!toks[p] && toks[p].t === 'op' && toks[p].v === v;
  const expect = (v: string) => {
    if (!isOp(v))
      throw new FormulaError(
        `« ${v} » attendu${toks[p] ? ' avant « ' + toks[p].v + ' »' : ' en fin de formule'}.`,
      );
    p++;
  };
  const opv = () => toks[p++].v as string;

  function expr(): Node {
    let l = concat();
    while (toks[p] && toks[p].t === 'op' && CMP.includes(toks[p].v as string)) {
      const op = opv();
      l = { k: 'bin', op, l, r: concat() };
    }
    return l;
  }
  function concat(): Node {
    let l = add();
    while (isOp('&')) {
      p++;
      l = { k: 'bin', op: '&', l, r: add() };
    }
    return l;
  }
  function add(): Node {
    let l = mul();
    while (isOp('+') || isOp('-')) {
      const op = opv();
      l = { k: 'bin', op, l, r: mul() };
    }
    return l;
  }
  function mul(): Node {
    let l = pow();
    while (isOp('*') || isOp('/')) {
      const op = opv();
      l = { k: 'bin', op, l, r: pow() };
    }
    return l;
  }
  function pow(): Node {
    let l = pct();
    while (isOp('^')) {
      p++;
      l = { k: 'bin', op: '^', l, r: pct() };
    }
    return l;
  }
  function pct(): Node {
    let e = unary();
    while (isOp('%')) {
      p++;
      e = { k: 'pct', e };
    }
    return e;
  }
  function unary(): Node {
    if (isOp('-')) {
      p++;
      return { k: 'neg', e: unary() };
    }
    if (isOp('+')) {
      p++;
      return unary();
    }
    return postfix();
  }
  function postfix(): Node {
    let e = primary();
    while (isOp('(')) {
      p++;
      e = { k: 'invoke', f: e, args: args() };
    }
    return e;
  }
  function args(): Node[] {
    const out: Node[] = [];
    if (isOp(')')) {
      p++;
      return out;
    }
    for (;;) {
      if (isOp(',') || isOp(')')) out.push({ k: 'omit' });
      else out.push(expr());
      if (isOp(',')) {
        p++;
        continue;
      }
      expect(')');
      return out;
    }
  }
  function primary(): Node {
    const t = toks[p];
    if (!t) throw new FormulaError('Formule incomplète.');
    if (t.t === 'num') {
      p++;
      return { k: 'num', v: t.v };
    }
    if (t.t === 'str') {
      p++;
      return { k: 'str', v: t.v };
    }
    if (t.t === 'ref') {
      p++;
      return { k: 'ref', t };
    }
    if (t.t === 'id') {
      p++;
      const up = t.v.toUpperCase();
      if (isOp('(')) {
        p++;
        return { k: 'call', name: up, args: args() };
      }
      if (up === 'TRUE') return { k: 'lit', v: true };
      if (up === 'FALSE') return { k: 'lit', v: false };
      return { k: 'name', name: up };
    }
    if (isOp('(')) {
      p++;
      const e = expr();
      expect(')');
      return e;
    }
    if (isOp('{')) {
      p++;
      return arrayConst();
    }
    throw new FormulaError('Élément inattendu : « ' + t.v + ' ».');
  }
  function arrayConst(): Node {
    const rows: V[][] = [[]];
    for (;;) {
      let neg = false;
      if (isOp('-')) {
        p++;
        neg = true;
      }
      const t = toks[p++];
      if (!t) throw new FormulaError('Constante de tableau non fermée.');
      let v: V;
      if (t.t === 'num') v = neg ? -t.v : t.v;
      else if (t.t === 'str') v = t.v;
      else if (t.t === 'id' && /^(TRUE|FALSE)$/i.test(t.v)) v = t.v.toUpperCase() === 'TRUE';
      else throw new FormulaError('Constante de tableau invalide.');
      rows[rows.length - 1].push(v);
      if (isOp(',')) {
        p++;
        continue;
      }
      if (isOp(';')) {
        p++;
        rows.push([]);
        continue;
      }
      expect('}');
      break;
    }
    if (rows.some((r) => r.length !== rows[0].length))
      throw new FormulaError("Les lignes de la constante de tableau n'ont pas la même longueur.");
    return { k: 'lit', v: Arr.from(rows) };
  }
  const ast = expr();
  if (p < toks.length) throw new FormulaError('Élément en trop : « ' + toks[p].v + ' ».');
  return ast;
}
