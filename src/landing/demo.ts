/* Page d'accueil : barre de formule animée du héros et mini Sprint jouable.
   Réutilise le moteur Sprint, la complétion et l'info-bulle de l'application. */

import { SprintRun } from '../drills/sprint';
import { t } from '../i18n';
import { DEFAULT_SYNTAX, toLocal } from '../localize';
import { completableWord, completions } from '../pedagogy/completion';
import { syntaxOf } from '../profile';
import { state } from '../state';
import type { FnLang } from '../types';
import { argTipHtml } from '../ui/argTip';
import { esc } from '../ui/dom';

/** Formules canoniques de la démo (tirées de data/exercises/typing.json). */
const DEMO = ['=SUM(C2:C100)', '=IF(C2>=500,"Pass","Fail")', '=XLOOKUP(H2,A2:A100,C2:C100,"Not found")'];
const HERO = '=SUMIFS(C2:C100,B2:B100,"East")';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Change la syntaxe Excel de la démo (anglais « , » ou français « ; »). */
export function setDemoExcel(lang: FnLang): void {
  Object.assign(state.profile, DEFAULT_SYNTAX[lang], { keyboard: lang === 'fr' ? 'azerty-fr' : 'qwerty-us' });
}
const local = (f: string) => toLocal(f, syntaxOf(state.profile));

/* ------------------------------------------------- barre animée (héros) -- */

let heroTimer: ReturnType<typeof setTimeout> | null = null;
export function startHero(el: HTMLElement): void {
  if (heroTimer) clearTimeout(heroTimer);
  const input = el.querySelector<HTMLElement>('.hero-fx-text') as HTMLElement;
  const sugg = el.querySelector<HTMLElement>('.hero-sugg') as HTMLElement;
  const tip = el.querySelector<HTMLElement>('.hero-tip') as HTMLElement;
  const target = local(HERO);
  const paint = (typed: string, suggestion: string | null) => {
    input.textContent = typed;
    sugg.hidden = !suggestion;
    sugg.textContent = suggestion ?? '';
    const tp = argTipHtml(typed);
    tip.innerHTML = tp;
    tip.hidden = !tp;
  };
  if (reduced()) {
    paint(target.slice(0, target.length - 6), null);
    return;
  }
  // frappe simulée : quelques lettres, Tab sur la complétion, puis le reste
  let typed = '';
  const step = () => {
    if (typed.length >= target.length) {
      heroTimer = setTimeout(() => {
        typed = '';
        step();
      }, 2200);
      return;
    }
    const w = completableWord(typed);
    const c = w && w.word.length >= 3 ? completions(w.word, w.before, syntaxOf(state.profile))[0] : null;
    const start = w ? typed.length - w.word.length : 0;
    if (c && c.fn && target.slice(start).toUpperCase().startsWith(c.insert.toUpperCase())) {
      paint(typed, `Tab → ${c.insert}`);
      heroTimer = setTimeout(() => {
        typed = target.slice(0, start + c.insert.length);
        paint(typed, null);
        heroTimer = setTimeout(step, 260);
      }, 650);
      return;
    }
    typed += target[typed.length];
    paint(typed, null);
    heroTimer = setTimeout(step, 70 + Math.random() * 60);
  };
  step();
}

/* --------------------------------------------------- mini Sprint jouable -- */

export function mountDemo(root: HTMLElement): void {
  let run: SprintRun;
  const code = root.querySelector<HTMLElement>('.demo-code') as HTMLElement;
  const status = root.querySelector<HTMLElement>('.demo-status') as HTMLElement;
  const hint = root.querySelector<HTMLElement>('.demo-hint') as HTMLElement;
  const tip = root.querySelector<HTMLElement>('.demo-tip') as HTMLElement;
  const result = root.querySelector<HTMLElement>('.demo-result') as HTMLElement;
  const stage = root.querySelector<HTMLElement>('.demo-stage') as HTMLElement;

  const reset = () => {
    run = new SprintRun({
      mode: 'count',
      size: DEMO.length,
      variants: [],
      tab: true,
      syn: syntaxOf(state.profile),
      formulas: DEMO.map(local),
    });
    result.hidden = true;
    paint();
  };
  const paint = () => {
    // test terminé : on laisse la dernière formule affichée, entièrement juste
    const last = run.finished ? run.logs[run.logs.length - 1].target : null;
    const tg = last ?? run.target,
      ty = last ?? run.typed;
    let html = '';
    for (let k = 0; k < tg.length; k++) {
      let cls = 'p';
      if (k < ty.length) cls = ty[k].toLowerCase() === tg[k].toLowerCase() ? 'k' : 'x';
      if (k === ty.length) cls += ' cur';
      html += `<span class="${cls}">${esc(tg[k])}</span>`;
    }
    for (let k = tg.length; k < ty.length; k++) html += `<span class="x">${esc(ty[k])}</span>`;
    if (ty.length >= tg.length) html += '<span class="cur"> </span>';
    code.innerHTML = html;
    status.textContent = t('landing.demo.progress', {
      n: Math.min(run.formulasDone + 1, DEMO.length),
      total: DEMO.length,
    });
    const c = run.candidate();
    hint.innerHTML = c ? `<kbd>Tab</kbd> → ${esc(c.insert)}` : '&nbsp;';
    const tp = argTipHtml(ty);
    tip.innerHTML = tp;
    tip.hidden = !tp;
  };
  const done = () => {
    const sc = run.score();
    const coach = run.coach();
    result.innerHTML = `<p class="demo-score">${esc(t('landing.demo.result', { v: Math.round(sc.net), acc: Math.round(sc.acc) }))}</p>
      <p class="note">${esc(t('coach.summary', { keys: coach.keys, min: coach.min }))}</p>`;
    result.hidden = false;
    paint();
  };
  stage.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || (e.altKey && !e.getModifierState?.('AltGraph'))) return;
    if (run.finished) return;
    const now = performance.now();
    let ended: boolean;
    if (e.key === 'Tab') {
      // sans complétion possible, Tab garde son rôle : sortir de la démo au clavier
      if (!run.started || !run.candidate()) return;
      ended = run.key({ kind: 'tab' }, now);
    } else if (e.key === 'Backspace') ended = run.key({ kind: 'back' }, now);
    else if (e.key.length === 1) ended = run.key({ kind: 'char', ch: e.key }, now);
    else return;
    e.preventDefault();
    if (ended) done();
    else paint();
  });
  root.querySelector('.demo-again')?.addEventListener('click', () => {
    reset();
    stage.focus();
  });
  root.addEventListener('demo:reset', reset);
  reset();
}
