/* Dispositions de clavier (data/keyboards) et détection avec navigator.keyboard.getLayoutMap(). */

import qwerty from '../../data/keyboards/qwerty-us.json';
import azerty from '../../data/keyboards/azerty-fr.json';
import type { KeyboardId } from '../types';

type Layout = { layout: string; keys: Record<string, (string | null)[]> };
export const LAYOUTS: Record<KeyboardId, Layout> = {
  'qwerty-us': qwerty as Layout,
  'azerty-fr': azerty as Layout,
};

/** Caractère de base d'une touche physique dans une disposition (« (touche morte) » retiré). */
export function baseChar(kb: KeyboardId, code: string): string | null {
  const v = LAYOUTS[kb].keys[code]?.[0];
  return v ? v.replace(/\s*\(.*\)$/, '') : null;
}

/** Touche physique qui porte cette lettre dans la disposition (KeyQ porte « a » en AZERTY). */
export function codeForLetter(kb: KeyboardId, letter: string): string | null {
  const l = letter.toLowerCase();
  for (const [code, chars] of Object.entries(LAYOUTS[kb].keys)) if (chars[0] === l) return code;
  return null;
}

/** Disposition reconnue à partir de la carte du navigateur, ou null. */
export function layoutFromMap(map: { get(code: string): string | undefined }): KeyboardId | null {
  const q = map.get('KeyQ'),
    w = map.get('KeyW'),
    m = map.get('Semicolon');
  if (q === 'a' && w === 'z' && m === 'm') return 'azerty-fr';
  if (q === 'q' && w === 'w' && m === ';') return 'qwerty-us';
  return null;
}

type KeyboardApi = { getLayoutMap(): Promise<{ get(code: string): string | undefined }> };

/** Détection automatique si le navigateur la propose (Chrome, Edge) ; sinon null. */
export async function detectLayout(): Promise<KeyboardId | null> {
  const kb = (navigator as Navigator & { keyboard?: KeyboardApi }).keyboard;
  if (!kb || typeof kb.getLayoutMap !== 'function') return null;
  try {
    return layoutFromMap(await kb.getLayoutMap());
  } catch {
    return null;
  }
}
