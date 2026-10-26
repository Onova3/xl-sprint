/* Raccourcis : notation « Ctrl+Shift+L » / « Alt H H » <-> touches physiques (KeyboardEvent.code).
   Repris de la v1.1 ; les lettres suivent la disposition du joueur (Ctrl+Z = touche qui porte Z). */

import { baseChar, codeForLetter } from './layouts';
import type { KeyboardId, ShortcutEx } from '../types';

const NAMED: Record<string, string> = {
  '=': 'Equal',
  '-': 'Minus',
  ';': 'Semicolon',
  "'": 'Quote',
  '`': 'Backquote',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Esc: 'Escape',
  Up: 'ArrowUp',
  Down: 'ArrowDown',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Delete: 'Delete',
};
const LABEL: Record<string, string> = {
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Escape: 'Esc',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Home: 'Home',
  End: 'End',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  Delete: 'Del',
  Backspace: 'Backspace',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadEnter: 'Enter',
};
export const MODCODES = new Set([
  'ControlLeft',
  'ControlRight',
  'ShiftLeft',
  'ShiftRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
  'CapsLock',
]);

export function tokToCode(t: string, kb: KeyboardId = 'qwerty-us'): string {
  if (/^[A-Z]$/.test(t)) return codeForLetter(kb, t) ?? 'Key' + t;
  if (/^[0-9]$/.test(t)) return 'Digit' + t;
  if (/^F\d{1,2}$/.test(t)) return t;
  return NAMED[t] || t;
}
/** Jeton d'une touche pour les séquences du ruban (lettre affichée par la disposition). */
export function codeToTok(code: string, kb: KeyboardId = 'qwerty-us'): string {
  if (/^(Key[A-Z]|Semicolon|Comma|Quote|Period|Slash|BracketLeft|BracketRight)$/.test(code)) {
    const ch = baseChar(kb, code);
    if (ch && /^[a-z]$/i.test(ch)) return ch.toUpperCase();
  }
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return code.slice(6);
  return code;
}
/** Libellé d'une touche physique sur le clavier du joueur. */
export function codeLabel(code: string, kb: KeyboardId = 'qwerty-us'): string {
  if (LABEL[code]) return LABEL[code];
  if (/^(Digit|Numpad)\d$/.test(code) && kb === 'qwerty-us') return code.slice(-1);
  if (/^F\d{1,2}$/.test(code)) return code;
  const ch = baseChar(kb, code);
  if (ch && ch.trim()) return /^[a-z]$/.test(ch) ? ch.toUpperCase() : ch;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  return code;
}

export interface Chord {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  code: string;
}
export function parseChord(s: string, kb: KeyboardId = 'qwerty-us'): Chord {
  const c: Chord = { ctrl: false, shift: false, alt: false, code: '' };
  for (const p of s.split('+').map((x) => x || '+')) {
    if (p === 'Ctrl') c.ctrl = true;
    else if (p === 'Shift') c.shift = true;
    else if (p === 'Alt') c.alt = true;
    else c.code = tokToCode(p, kb);
  }
  return c;
}
export const isSequence = (it: ShortcutEx): boolean => it.kind === 'ribbon-sequence';

export function keyLabels(it: ShortcutEx, kb: KeyboardId): string[] {
  if (isSequence(it)) return it.keys.split(' ');
  const c = parseChord(it.keys, kb),
    out: string[] = [];
  if (c.ctrl) out.push('Ctrl');
  if (c.shift) out.push('Shift');
  if (c.alt) out.push('Alt');
  out.push(codeLabel(c.code, kb));
  return out;
}
export interface KeyLike {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  code: string;
}
export function eventLabels(e: KeyLike, kb: KeyboardId): string[] {
  const out: string[] = [];
  if (e.ctrlKey) out.push('Ctrl');
  if (e.shiftKey) out.push('Shift');
  if (e.altKey) out.push('Alt');
  if (!MODCODES.has(e.code)) out.push(codeLabel(e.code, kb));
  return out;
}
export function codeMatches(code: string, expected: string, shift: boolean): boolean {
  if (code === expected) return true;
  if (code === 'NumpadEnter' && expected === 'Enter') return true;
  if (code === 'NumpadAdd' && expected === 'Equal' && shift) return true; // Ctrl+Num+ = insérer
  if (code === 'NumpadSubtract' && expected === 'Minus') return true;
  return false;
}
export function chordMatches(e: KeyLike, it: ShortcutEx, kb: KeyboardId): boolean {
  const c = parseChord(it.keys, kb);
  return (
    e.ctrlKey === c.ctrl &&
    e.shiftKey === c.shift &&
    e.altKey === c.alt &&
    codeMatches(e.code, c.code, e.shiftKey)
  );
}

/** Le raccourci est-il connu comme correct pour ce profil ? (sinon badge « non vérifié »). */
export function shortcutVerified(it: ShortcutEx, fnLang: 'en' | 'fr', kb: KeyboardId): boolean {
  if (fnLang === 'en' && kb === 'qwerty-us') return true;
  const loc = it.localized ?? '';
  if (!loc) return true;
  if (/symbol\/digit/.test(loc)) return kb === 'qwerty-us';
  // lettres mnémoniques et KeyTips : dépendent de la langue de l'interface d'Excel
  return fnLang === 'en';
}
