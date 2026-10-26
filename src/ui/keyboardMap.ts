/* Clavier du joueur dessiné depuis data/keyboards, coloré selon la vitesse et les erreurs par touche.
   Chaque touche porte aussi un chiffre (ms moyen) : l'information n'est pas portée par la couleur seule. */

import { LAYOUTS } from '../input/layouts';
import { t } from '../i18n';
import type { SymStats } from '../pedagogy/symbols';
import type { KeyboardId } from '../types';
import { esc } from './dom';

const ROWS = [
  [
    'Backquote',
    'Digit1',
    'Digit2',
    'Digit3',
    'Digit4',
    'Digit5',
    'Digit6',
    'Digit7',
    'Digit8',
    'Digit9',
    'Digit0',
    'Minus',
    'Equal',
  ],
  [
    'KeyQ',
    'KeyW',
    'KeyE',
    'KeyR',
    'KeyT',
    'KeyY',
    'KeyU',
    'KeyI',
    'KeyO',
    'KeyP',
    'BracketLeft',
    'BracketRight',
    'Backslash',
  ],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'],
  ['IntlBackslash', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'],
];
const LAYER = ['', 'Shift', 'AltGr'];
const clean = (c: string | null | undefined) => (c ? c.replace(/\s*\(.*\)$/, '') : '');

/** Touche physique et modificateur qui produisent ce caractère sur le clavier du joueur. */
export function keyForChar(kb: KeyboardId, ch: string): { code: string; layer: string } | null {
  for (const [code, chars] of Object.entries(LAYOUTS[kb].keys))
    for (let l = 0; l < chars.length; l++) if (clean(chars[l]) === ch) return { code, layer: LAYER[l] };
  const low = ch.toLowerCase();
  if (low !== ch) {
    const k = keyForChar(kb, low);
    if (k) return { code: k.code, layer: 'Shift' };
  }
  return null;
}

/** Statistiques regroupées par touche physique (tous les caractères qu'elle porte). */
function perKey(
  kb: KeyboardId,
  stats: SymStats,
): Map<string, { n: number; ms: number; err: number; chars: string[] }> {
  const out = new Map<string, { n: number; ms: number; err: number; chars: string[] }>();
  for (const [k, s] of Object.entries(stats)) {
    if (!k.startsWith('c:')) continue;
    const ch = k.slice(2);
    // les lettres sont stockées en majuscules : on cherche d'abord la touche de la minuscule
    const key = keyForChar(kb, ch.toLowerCase()) ?? keyForChar(kb, ch);
    if (!key) continue;
    const e = out.get(key.code) ?? { n: 0, ms: 0, err: 0, chars: [] };
    e.n += s.n;
    e.ms += s.ms;
    e.err += s.err;
    e.chars.push(key.layer ? `${ch} (${key.layer})` : ch);
    out.set(key.code, e);
  }
  return out;
}

export function keyboardMapHtml(kb: KeyboardId, stats: SymStats): string {
  const data = perKey(kb, stats);
  const avgs = [...data.values()].filter((d) => d.n).map((d) => d.ms / d.n);
  const lo = Math.min(...avgs, 9999),
    hi = Math.max(...avgs, 0);
  let k = 0;
  const rows = ROWS.map((row, r) => {
    const keys = row
      .filter((code) => LAYOUTS[kb].keys[code])
      .map((code) => {
        const chars = LAYOUTS[kb].keys[code];
        const label = clean(chars[0]);
        const d = data.get(code);
        const avg = d && d.n ? d.ms / d.n : null;
        // 0 = rapide, 1 = lent ; la teinte et le chiffre disent la même chose
        const heat = avg === null || hi === lo ? 0 : (avg - lo) / (hi - lo);
        const errRate = d ? d.err / Math.max(1, d.n + d.err) : 0;
        const title = d
          ? t('kbmap.keyTitle', {
              chars: d.chars.join(', '),
              ms: avg === null ? '—' : Math.round(avg),
              err: Math.round(errRate * 100),
            })
          : label;
        return `<span class="kmap-key${d ? ' has' : ''}${errRate >= 0.1 ? ' errs' : ''}" style="--heat:${heat.toFixed(2)};--k:${k++}" title="${esc(title)}">
          <span class="kmap-ch">${esc(label.toUpperCase())}</span>${avg !== null ? `<span class="kmap-ms">${Math.round(avg)}</span>` : ''}${errRate >= 0.1 ? '<span class="kmap-x" aria-hidden="true">✗</span>' : ''}</span>`;
      })
      .join('');
    return `<div class="kmap-row" style="--indent:${[0, 0.5, 0.75, 0.25][r]}">${keys}</div>`;
  }).join('');
  return `<figure class="kmap" aria-label="${esc(t('kbmap.label', { kb: t(`kb.${kb}` as 'kb.qwerty-us') }))}">${rows}
    <figcaption class="note">${esc(t('kbmap.legend'))}</figcaption></figure>`;
}
