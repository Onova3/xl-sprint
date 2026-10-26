/* Moteur commun d'exercice : chronomètre, compteur, pause, retours visuels, fin de séance. */

import type { Step } from '../data/content';
import { t } from '../i18n';
import { configKey } from '../profile';
import { state, type Miss } from '../state';
import { bumpWeak } from '../storage/progress';
import type { SessionRecord } from '../types';
import { $, esc, fmtClock, now } from '../ui/dom';
import { bestOf, sessionsOf, spec } from '../ui/stats';

/** Fonctions fournies par l'application (évite une dépendance circulaire). */
export const hooks = {
  renderAll: (): void => {},
  renderSteps: (): void => {},
  renderResult: (): void => {},
  save: (): void => {},
};

export abstract class BaseDrill {
  i = 0;
  t0 = 0;
  itemStart = 0;
  misses: Miss[] = [];
  errorsOnItem = 0;
  itemsWithError = 0;
  timerId: ReturnType<typeof setInterval> | null = null;
  paused = false;
  mode: string | null = null;
  abstract kind: string;

  constructor(
    public step: Step,
    public n: number,
  ) {
    this.onKey = this.onKey.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onBlur = this.onBlur.bind(this);
  }
  abstract start(): void;
  abstract onKey(e: KeyboardEvent): void;

  shell(inner: string, title: string): void {
    $('#work').innerHTML = `
      <div class="work-head"><div><span class="eyebrow">${esc(t('drill.eyebrow', { n: this.step.n, title: t(`step.${this.step.id}.title` as 'step.nav.title') }))}</span><h2>${esc(title)}</h2></div>
        <button class="btn ghost" id="stopBtn">${esc(t('drill.stop'))}</button></div>
      <div class="stage" id="stage" tabindex="0">
        <div class="runbar"><span class="num" id="counter"></span><span class="timer" id="timer">0:00.0</span></div>
        <div class="progress"><i id="bar" style="width:0%"></i></div>
        ${inner}
      </div>`;
    $('#stopBtn').addEventListener('click', () => this.stop(true));
  }
  begin(): void {
    this.t0 = now();
    this.itemStart = this.t0;
    this.timerId = setInterval(() => {
      const el = document.getElementById('timer');
      if (el) el.textContent = fmtClock(now() - this.t0);
    }, 100);
    document.addEventListener('keydown', this.onKey, true);
    document.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('blur', this.onBlur);
  }
  counter(): void {
    const c = document.getElementById('counter');
    if (c) c.textContent = `${Math.min(this.i + 1, this.n)} / ${this.n}`;
    const b = document.getElementById('bar');
    if (b) b.style.width = (this.i / this.n) * 100 + '%';
  }
  onKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Alt') e.preventDefault();
  }
  /** Pause quand la fenêtre perd le focus (exercices au clavier seulement). */
  onBlur(): void {
    if (state.drill !== this || !['keys', 'typing', 'vba'].includes(this.kind)) return;
    this.paused = true;
    const stage = document.getElementById('stage');
    if (stage && !document.getElementById('pausedOverlay')) {
      const d = document.createElement('div');
      d.className = 'paused';
      d.id = 'pausedOverlay';
      d.textContent = t('drill.paused');
      d.addEventListener('click', () => {
        d.remove();
        this.paused = false;
        stage.focus();
      });
      stage.appendChild(d);
    }
  }
  detach(): void {
    if (this.timerId) clearInterval(this.timerId);
    document.removeEventListener('keydown', this.onKey, true);
    document.removeEventListener('keyup', this.onKeyUp, true);
    window.removeEventListener('blur', this.onBlur);
  }
  stop(showIntro: boolean): void {
    this.detach();
    state.drill = null;
    if (showIntro) hooks.renderAll();
  }
  feedback(msg: string, cls?: string): void {
    const f = document.getElementById('feedback');
    if (!f) return;
    f.className = 'feedback ' + (cls || '');
    f.innerHTML = msg;
  }
  private anim(cls: string): void {
    const s = document.getElementById('stage');
    if (!s) return;
    s.classList.remove(cls);
    void s.offsetWidth;
    s.classList.add(cls);
  }
  shake(): void {
    this.anim('shake');
  }
  flash(): void {
    this.anim('flash');
  }
  weak(id: string, delta: number): void {
    bumpWeak(state.progress, id, delta);
  }
  finish(metric: number, acc: number, extraHtml?: string): void {
    const totalMs = now() - this.t0;
    this.detach();
    state.drill = null;
    const st = this.step;
    const sp = spec(st, this.mode);
    const prevBest = bestOf(sp, sessionsOf(st.id, sp.mode));
    const better =
      sp.better === 'low' ? prevBest == null || metric < prevBest : prevBest == null || metric > prevBest;
    const session: SessionRecord = {
      s: st.id,
      t: Date.now(),
      n: this.n,
      ms: Math.round(totalMs),
      metric: Math.round(metric * 100) / 100,
      acc: Math.round(acc * 10) / 10,
      cfg: configKey(state.profile),
    };
    if (this.mode) session.mode = this.mode;
    state.progress.sessions.push(session);
    hooks.save();
    state.lastResult = {
      step: st.id,
      session,
      record: better && prevBest != null,
      first: prevBest == null,
      misses: this.misses,
      mode: this.mode,
      extraHtml,
    };
    hooks.renderSteps();
    hooks.renderResult();
  }
}
