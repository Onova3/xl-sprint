import { describe, expect, it } from 'vitest';
import { chordMatches, codeLabel, codeToTok, keyLabels, shortcutVerified } from '../src/input/keycode';
import { layoutFromMap } from '../src/input/layouts';
import shortcuts from '../data/shortcuts/excel-windows-en.json';
import type { ShortcutEx } from '../src/types';

const items = shortcuts.items as ShortcutEx[];
const byId = (id: string) => items.find((x) => x.id === id)!;
const ev = (code: string, mods: Partial<{ ctrlKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) => ({
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  code,
  ...mods,
});

describe('raccourcis et touches physiques', () => {
  it('QWERTY : Ctrl+Z = KeyZ', () => {
    expect(chordMatches(ev('KeyZ', { ctrlKey: true }), byId('n25'), 'qwerty-us')).toBe(true);
  });
  it('AZERTY : Ctrl+Z = touche physique KeyW', () => {
    expect(chordMatches(ev('KeyW', { ctrlKey: true }), byId('n25'), 'azerty-fr')).toBe(true);
    expect(chordMatches(ev('KeyZ', { ctrlKey: true }), byId('n25'), 'azerty-fr')).toBe(false);
    expect(keyLabels(byId('n25'), 'azerty-fr')).toEqual(['Ctrl', 'Z']);
  });
  it('flèches indépendantes du clavier', () => {
    expect(chordMatches(ev('ArrowDown', { ctrlKey: true }), byId('n1'), 'azerty-fr')).toBe(true);
  });
  it('libellés et séquences du ruban sur AZERTY', () => {
    expect(codeLabel('Semicolon', 'azerty-fr')).toBe('M');
    expect(codeToTok('KeyQ', 'azerty-fr')).toBe('A');
    expect(codeToTok('KeyH', 'qwerty-us')).toBe('H');
  });
  it('badge « non vérifié »', () => {
    expect(shortcutVerified(byId('n9'), 'en', 'qwerty-us')).toBe(true);
    expect(shortcutVerified(byId('n9'), 'en', 'azerty-fr')).toBe(false);
    expect(shortcutVerified(byId('f15'), 'fr', 'azerty-fr')).toBe(false);
    expect(shortcutVerified(byId('n1'), 'fr', 'azerty-fr')).toBe(true);
  });
  it('détection de disposition', () => {
    const m = (o: Record<string, string>) => ({ get: (k: string) => o[k] });
    expect(layoutFromMap(m({ KeyQ: 'a', KeyW: 'z', Semicolon: 'm' }))).toBe('azerty-fr');
    expect(layoutFromMap(m({ KeyQ: 'q', KeyW: 'w', Semicolon: ';' }))).toBe('qwerty-us');
    expect(layoutFromMap(m({ KeyQ: 'q', KeyW: 'w', Semicolon: 'ö' }))).toBeNull();
  });
});
