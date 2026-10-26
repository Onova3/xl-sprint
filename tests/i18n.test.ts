import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';
import { STEPS } from '../src/data/content';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sources(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('i18n', () => {
  it('fr et en ont les mêmes clés', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });
  it('aucun texte vide', () => {
    for (const d of [fr, en]) for (const [k, v] of Object.entries(d)) expect(v, k).not.toBe('');
  });
  it('toutes les clés utilisées existent', () => {
    const used = new Set<string>();
    for (const f of sources(join(__dirname, '../src')))
      for (const m of readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/g)) used.add(m[1]);
    for (const st of STEPS) for (const k of ['title', 'intro']) used.add(`step.${st.id}.${k}`);
    for (const st of STEPS) {
      used.add(`per.${st.id}`);
      used.add(`what.${st.kind}`);
    }
    const missing = [...used].filter((k) => !(k in fr));
    expect(missing).toEqual([]);
  });
});
