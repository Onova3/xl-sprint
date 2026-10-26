/* Mesures suivies par étape : record, objectif, statut (repris de la v1.1). */

import type { Step } from '../data/content';
import { t } from '../i18n';
import { state } from '../state';
import type { SessionRecord, StepId } from '../types';

export interface Spec {
  better: 'low' | 'high';
  goal: number;
  acc: number;
  /** Unité affichée : « par raccourci », « caractères / min »… */
  per: string;
  mode: string | null;
}

export function defaultMode(st: Step): string | null {
  const s = state.settings;
  if (st.kind === 'formula') return s.formulaMode;
  if (st.kind === 'typing') return s.typingLevel;
  if (st.kind === 'regex') return s.regexMode;
  return null;
}
export function sessionsOf(stepId: StepId, mode?: string | null): SessionRecord[] {
  return state.progress.sessions.filter((s) => s.s === stepId && (!mode || (s.mode || 'write') === mode));
}
export function spec(st: Step, mode: string | null): Spec {
  if (st.kind === 'formula' && mode === 'copy')
    return { better: 'high', goal: 200, acc: 95, per: t('per.cpm'), mode };
  if (st.kind === 'regex' && mode === 'excel')
    return { better: 'low', goal: 60, acc: 70, per: t('per.formula'), mode };
  if (st.kind === 'regex')
    return { better: 'low', goal: 40, acc: 80, per: t('per.pattern'), mode: 'pattern' };
  if (st.kind === 'typing')
    return {
      better: 'high',
      goal: st.goal.metric,
      acc: st.goal.acc,
      per: t('per.cpm'),
      mode: mode || 'base',
    };
  return {
    better: st.better,
    goal: st.goal.metric,
    acc: st.goal.acc,
    per: t(`per.${st.id}` as 'per.nav'),
    mode: st.kind === 'formula' ? 'write' : null,
  };
}
export function fmtVal(sp: Spec, v: number | null | undefined): string {
  if (v == null) return '—';
  const s = sp.better === 'low' ? v.toFixed(v < 10 ? 2 : 1) + ' s' : String(Math.round(v));
  return state.profile.uiLang === 'fr' ? s.replace('.', ',') : s;
}
export function bestOf(sp: Spec, list: SessionRecord[]): number | null {
  if (!list.length) return null;
  return sp.better === 'low'
    ? Math.min(...list.map((s) => s.metric))
    : Math.max(...list.map((s) => s.metric));
}
export function meetsGoal(sp: Spec, s: SessionRecord): boolean {
  const okM = sp.better === 'low' ? s.metric <= sp.goal : s.metric >= sp.goal;
  return okM && s.acc >= sp.acc;
}
export function stepStatus(st: Step): [string, string] {
  const list = sessionsOf(st.id);
  if (
    list.some((s) => !(st.kind === 'formula' && s.mode === 'copy') && meetsGoal(spec(st, s.mode ?? null), s))
  )
    return ['done', t('status.done')];
  if (list.length) return ['going', t('status.going')];
  return ['', t('status.todo')];
}
