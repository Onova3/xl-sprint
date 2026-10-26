/* Étape 3 (frappe de formules) et étape 7 (VBA) : recopie caractère par caractère. */

import { forVersion, TYPING, VBA, type Step } from '../data/content';
import { t } from '../i18n';
import { completableWord, completions, type Completion } from '../pedagogy/completion';
import { syntaxOf } from '../profile';
import { loc, state } from '../state';
import { weightedSample } from '../storage/progress';
import { $, esc, now } from '../ui/dom';
import { BaseDrill } from './base';

export class TypingDrill extends BaseDrill {
  kind = 'typing';
  items: { id: string; f: string }[];
  keystrokes = 0;
  badKeys = 0;
  chars = 0;
  target = '';
  typed = '';
  constructor(
    step: Step,
    n: number,
    level: string,
    public tab: boolean,
  ) {
    super(step, n);
    this.mode = level;
    const pool = forVersion(
      TYPING.filter((x) => level === 'all' || x.level === level),
      state.profile.excel,
    ).map((x) => ({ id: x.id, f: loc(x.formula) }));
    this.items = weightedSample(pool, n, state.progress.weak);
  }
  start(): void {
    this.shell(
      `
      <div class="ctx">${esc(t('typing.ctx'))}${this.tab ? ' · ' + esc(t('typing.ctxTab')) : ''}</div>
      <pre class="code formula-target" id="code" aria-label="${esc(t('typing.target'))}"></pre>
      <div class="hintchip" id="hint"></div>
      <div class="feedback" id="feedback"></div>
      <span class="note">${esc(t('typing.note'))}</span>`,
      t('step.typing.title'),
    );
    this.show();
    this.begin();
    $('#stage').focus();
  }
  get item() {
    return this.items[this.i];
  }
  show(): void {
    this.target = this.item.f;
    this.typed = '';
    this.errorsOnItem = 0;
    this.render();
    this.counter();
    this.feedback('');
  }
  candidate(): { prefix: string; o: Completion } | null {
    const w = completableWord(this.typed);
    if (!w) return null;
    const opts = completions(w.word, w.before, syntaxOf(state.profile));
    return opts.length ? { prefix: w.word, o: opts[0] } : null;
  }
  render(): void {
    const tg = this.target,
      ty = this.typed;
    let html = '';
    for (let k = 0; k < tg.length; k++) {
      let cls = 'p';
      if (k < ty.length) cls = ty[k].toLowerCase() === tg[k].toLowerCase() ? 'k' : 'x';
      if (k === ty.length) cls += ' cur';
      html += `<span class="${cls}">${esc(tg[k])}</span>`;
    }
    for (let k = tg.length; k < ty.length; k++) html += `<span class="x">${esc(ty[k])}</span>`;
    if (ty.length >= tg.length) html += '<span class="cur"> </span>';
    $('#code').innerHTML = html;
    const c = this.tab ? this.candidate() : null;
    $('#hint').innerHTML = c
      ? `<kbd>Tab</kbd> → ${esc(c.o.insert)}${c.o.fn ? '' : ` <span class="tag">${esc(t('fx.name'))}</span>`}`
      : '&nbsp;';
  }
  put(ch: string): void {
    const pos = this.typed.length;
    if (pos >= this.target.length + 3) return;
    const expected = this.target[pos];
    if (expected === undefined || expected.toLowerCase() !== ch.toLowerCase()) {
      this.badKeys++;
      if (!this.errorsOnItem) {
        this.misses.push({ label: this.target, html: '' });
        this.weak(this.item.id, 1);
      }
      this.errorsOnItem++;
    }
    this.typed += ch;
  }
  onKey(e: KeyboardEvent): void {
    if (this.paused) return;
    if (e.ctrlKey || e.altKey || e.metaKey) {
      // AltGr (Ctrl+Alt sous Windows) sert à taper { [ \ | @ sur AZERTY
      if (!(e.getModifierState && e.getModifierState('AltGraph') && e.key.length === 1)) {
        e.preventDefault();
        return;
      }
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      this.typed = this.typed.slice(0, -1);
      this.render();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!this.tab) return;
      const c = this.candidate();
      if (!c) return;
      this.keystrokes++;
      const before = this.badKeys;
      for (const ch of c.o.insert.slice(c.prefix.length)) this.put(ch);
      if (this.badKeys > before) this.badKeys = before + 1;
    } else if (e.key.length === 1) {
      e.preventDefault();
      this.keystrokes++;
      this.put(e.key);
    } else return;
    this.render();
    if (this.typed.toLowerCase() === this.target.toLowerCase()) {
      if (!this.errorsOnItem) this.weak(this.item.id, -1);
      this.chars += this.target.length;
      this.flash();
      this.i++;
      if (this.i >= this.n) {
        const total = now() - this.t0;
        return this.finish(
          this.chars / (total / 60000),
          (100 * (this.keystrokes - this.badKeys)) / Math.max(1, this.keystrokes),
        );
      }
      this.show();
    }
  }
}

export class VbaDrill extends BaseDrill {
  kind = 'vba';
  items = weightedSample(VBA, this.n, state.progress.weak);
  keystrokes = 0;
  badKeys = 0;
  chars = 0;
  target = '';
  typed = '';
  start(): void {
    this.shell(
      `<pre class="code" id="code" aria-label="${esc(t('vba.target'))}"></pre>
      <div class="feedback" id="feedback"></div>
      <span class="note">${esc(t('vba.note'))}</span>`,
      t('vba.title'),
    );
    this.show();
    this.begin();
    $('#stage').focus();
  }
  get item() {
    return this.items[this.i];
  }
  show(): void {
    this.target = this.item.code;
    this.typed = '';
    this.errorsOnItem = 0;
    this.itemStart = now();
    this.render();
    this.counter();
    this.feedback('');
  }
  render(): void {
    const tg = this.target,
      ty = this.typed;
    let html = '';
    for (let k = 0; k < tg.length; k++) {
      const ch = tg[k];
      let cls = 'p';
      if (k < ty.length) cls = ty[k].toLowerCase() === ch.toLowerCase() ? 'k' : 'x';
      if (k === ty.length) cls += ' cur';
      if (ch === '\n') html += `<span class="${cls} nl"></span>\n`;
      else html += `<span class="${cls}">${esc(ch)}</span>`;
    }
    if (ty.length >= tg.length) html += '<span class="cur"> </span>';
    $('#code').innerHTML = html;
  }
  type(ch: string): void {
    const pos = this.typed.length;
    if (pos >= this.target.length + 3) return;
    this.keystrokes++;
    const expected = this.target[pos];
    if (expected === undefined || expected.toLowerCase() !== ch.toLowerCase()) {
      this.badKeys++;
      if (!this.errorsOnItem) {
        this.misses.push({ label: this.item.code.split('\n')[0], html: '' });
        this.weak(this.item.id, 1);
      }
      this.errorsOnItem++;
    }
    this.typed += ch;
    if (ch === '\n' && expected === '\n') {
      while (this.target[this.typed.length] === ' ') this.typed += ' ';
    }
  }
  onKey(e: KeyboardEvent): void {
    if (this.paused) return;
    if (e.ctrlKey || e.altKey || e.metaKey) {
      if (!(e.getModifierState && e.getModifierState('AltGraph') && e.key.length === 1)) {
        e.preventDefault();
        return;
      }
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      // une indentation automatique s'efface avec son retour à la ligne
      if (/\n +$/.test(this.typed)) this.typed = this.typed.replace(/\n +$/, '');
      else this.typed = this.typed.slice(0, -1);
      this.render();
      return;
    }
    let ch: string | null = null;
    if (e.key === 'Enter') ch = '\n';
    else if (e.key === 'Tab') {
      e.preventDefault();
      return;
    } else if (e.key.length === 1) ch = e.key;
    if (ch === null) return;
    e.preventDefault();
    this.type(ch);
    this.render();
    if (this.typed.toLowerCase() === this.target.toLowerCase()) {
      if (!this.errorsOnItem) this.weak(this.item.id, -1);
      this.chars += this.target.replace(/^ +/gm, '').length;
      this.flash();
      this.i++;
      if (this.i >= this.n) {
        const total = now() - this.t0;
        return this.finish(
          this.chars / (total / 60000),
          (100 * (this.keystrokes - this.badKeys)) / Math.max(1, this.keystrokes),
        );
      }
      this.show();
    }
  }
}
