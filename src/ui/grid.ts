/* Affichage d'un tableau de valeurs façon feuille Excel, dans la syntaxe du joueur. */

import { Arr, XErr, type Scalar, type V } from '../engine';
import { colName, colNum, toArr } from '../engine/values';
import { t } from '../i18n';
import { fnName, state } from '../state';
import { esc } from './dom';

export function dispVal(v: V): { t: string; cls: string } {
  // Les codes d'erreur restent ceux d'Excel en anglais : leur traduction n'est pas sourcée.
  if (v instanceof XErr) return { t: v.code, cls: 'err' };
  if (typeof v === 'boolean') return { t: fnName(v ? 'TRUE' : 'FALSE'), cls: 'bool' };
  if (typeof v === 'number') {
    const s = Number.isInteger(v) ? String(v) : String(+v.toPrecision(10));
    return { t: state.profile.decimalSep === ',' ? s.replace('.', ',') : s, cls: 'r' };
  }
  if (v === null || v === undefined) return { t: '', cls: '' };
  return { t: String(v), cls: '' };
}

export function gridHtml(value: V, origin: string, label: string): string {
  const A = toArr(value);
  const m = /^([A-Z]+)(\d+)$/.exec(origin || 'A1') as RegExpExecArray;
  const c0 = colNum(m[1]),
    r0 = +m[2];
  const R = Math.min(A.rows, 40),
    C = Math.min(A.cols, 20);
  let h = `<div class="xscroll"><table class="sheet" aria-label="${esc(label)}"><thead><tr><th></th>`;
  for (let c = 0; c < C; c++) h += `<th>${colName(c0 + c)}</th>`;
  h += '</tr></thead><tbody>';
  for (let r = 0; r < R; r++) {
    h += `<tr><th>${r0 + r}</th>`;
    for (let c = 0; c < C; c++) {
      const d = dispVal(A.get(r, c));
      h += `<td class="${d.cls}">${esc(d.t)}</td>`;
    }
    h += '</tr>';
  }
  h += '</tbody></table></div>';
  if (A.rows > R || A.cols > C)
    h += `<p class="note">${esc(t('grid.preview', { r: A.rows, c: A.cols }))}</p>`;
  return h;
}

export function dataGridHtml(rows: Scalar[][]): string {
  if (!rows.length) return `<p class="note">${esc(t('grid.empty'))}</p>`;
  const C = Math.max(...rows.map((r) => r.length));
  const A = new Arr(rows.length, C);
  rows.forEach((row, r) => row.forEach((v, c) => A.set(r, c, v === '' ? null : v)));
  return gridHtml(A, 'A1', t('grid.data'));
}
