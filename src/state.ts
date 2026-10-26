/* État partagé de l'application (un seul onglet, une seule séance à la fois). */

import { localName, toLocal } from './localize';
import { defaultProfile, syntaxOf } from './profile';
import { emptyProgress } from './storage/progress';
import { readJson, writeJson } from './storage/local';
import type { Profile, Progress, SessionRecord, StepId } from './types';

export const SETTINGS_KEY = 'xlsprint.settings';

/** Réglages des séances : même forme et même clé que la v1.1. */
export interface Settings {
  nav: number;
  fmt: number;
  typing: number;
  formula: number;
  dyn: number;
  regex: number;
  vba: number;
  case: number;
  formulaMode: 'write' | 'copy';
  typingLevel: 'base' | 'mid' | 'hard' | 'all';
  typingTab: boolean;
  dynLevel: 'all' | '1' | '2' | '3';
  regexMode: 'pattern' | 'excel';
  regexTab: 'cours' | 'testeur' | 'train';
  [k: string]: unknown;
}

export interface Miss {
  label: string;
  html: string;
}
export interface LastResult {
  step: StepId;
  session: SessionRecord;
  record: boolean;
  first: boolean;
  misses: Miss[];
  mode: string | null;
}
export interface DrillHandle {
  stop(showIntro: boolean): void;
}

export const state = {
  profile: defaultProfile() as Profile,
  hasProfile: false,
  progress: emptyProgress() as Progress,
  settings: {
    nav: 20,
    fmt: 20,
    typing: 10,
    formula: 10,
    dyn: 5,
    regex: 5,
    vba: 3,
    case: 3,
    formulaMode: 'write',
    typingLevel: 'base',
    typingTab: true,
    dynLevel: 'all',
    regexMode: 'pattern',
    regexTab: 'cours',
  } as Settings,
  current: 'nav' as StepId,
  drill: null as DrillHandle | null,
  lastResult: null as LastResult | null,
  cloud: false,
};

export function loadSettings(): void {
  const raw = readJson(SETTINGS_KEY);
  if (raw && typeof raw === 'object') Object.assign(state.settings, raw);
}
export const saveSettings = (): void => void writeJson(SETTINGS_KEY, state.settings);

/** Formule canonique affichée dans la syntaxe du joueur. */
export const loc = (canonical: string): string => toLocal(canonical, syntaxOf(state.profile));
/** Nom de fonction affiché dans la langue du joueur. */
export const fnName = (canonical: string): string => localName(canonical, state.profile.fnLang);
