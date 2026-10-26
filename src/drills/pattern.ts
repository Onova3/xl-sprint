/* Étape 6 : motifs regex, validés en direct contre les listes « doit / ne doit pas correspondre ». */

import { PATTERNS, type Step } from '../data/content';
import { pick, t } from '../i18n';
import { fnName, state } from '../state';
import { weightedSample } from '../storage/progress';
import type { RegexPatternEx } from '../types';
import { $, esc } from '../ui/dom';
import { BaseDrill } from './base';
import { stars } from './formula';

export class PatternDrill extends BaseDrill {
  kind = 'pattern';
  items: RegexPatternEx[];
  busy = false;
  constructor(step: Step, n: number) {
    super(step, n);
    this.mode = 'pattern';
    this.items = weightedSample(PATTERNS, Math.min(n, PATTERNS.length), state.progress.weak);
    this.n = this.items.length;
  }
  start(): void {
    const T = fnName('TRUE'),
      F = fnName('FALSE');
    this.shell(
      `
      <div class="inline"><span class="stars" id="stars" aria-hidden="true"></span><span class="note" id="lvl"></span><span class="ctx">${esc(t('pattern.ctx'))}</span></div>
      <div class="prompt" id="prompt" style="font-size: clamp(20px, 3vw, 26px)"></div>
      <div class="patbar"><span>"</span><input id="pat" spellcheck="false" autocomplete="off" aria-label="${esc(t('pattern.label'))}"><span>"</span></div>
      <div class="grids">
        <div class="gridbox"><span class="eyebrow">${esc(t('pattern.yes', { v: T }))}</span><ul class="plist" id="yes"></ul></div>
        <div class="gridbox"><span class="eyebrow">${esc(t('pattern.no', { v: F }))}</span><ul class="plist" id="no"></ul></div>
      </div>
      <div class="feedback" id="feedback"></div>
      <div class="inline"><button class="btn ghost" id="solBtn">${esc(t('eval.showSolution'))}</button>
        <span class="note">${esc(t('pattern.note', { f: fnName('REGEXTEST') }))}</span></div>`,
      t('pattern.title'),
    );
    $('#pat').addEventListener('input', () => this.check(false));
    $('#solBtn').addEventListener('click', () => this.reveal());
    this.show();
    this.begin();
  }
  get item(): RegexPatternEx {
    return this.items[this.i];
  }
  show(): void {
    this.errorsOnItem = 0;
    this.busy = false;
    $('#stars').textContent = stars(this.item.level);
    $('#lvl').textContent = t('eval.level', { n: this.item.level });
    $('#prompt').textContent = pick(this.item.task);
    const p = $<HTMLInputElement>('#pat');
    p.value = '';
    p.focus();
    this.check(false);
    this.feedback('');
    this.counter();
  }
  compile(p: string): RegExp {
    let f = '';
    if (p.startsWith('(?i)')) {
      p = p.slice(4);
      f = 'i';
    }
    return new RegExp(p, f);
  }
  rowHtml(s: string, re: RegExp | null, want: boolean): string {
    let shown = s === '' ? `<span class="note">${esc(t('pattern.emptyCell'))}</span>` : esc(s),
      st = '';
    if (re) {
      const m = s.match(re),
        got = !!m;
      if (m && m[0] !== '')
        shown =
          esc(s.slice(0, m.index)) +
          '<mark>' +
          esc(m[0]) +
          '</mark>' +
          esc(s.slice((m.index ?? 0) + m[0].length));
      st = got === want ? 'pass' : 'fail';
    }
    return `<li class="${st}"><span class="mark" aria-label="${st ? esc(t(st === 'pass' ? 'pattern.pass' : 'pattern.fail')) : ''}">${st === 'pass' ? '✓' : st === 'fail' ? '✗' : '·'}</span><span>${shown}</span></li>`;
  }
  check(final: boolean): void {
    const it = this.item,
      p = $<HTMLInputElement>('#pat').value;
    let re: RegExp | null = null;
    if (p) {
      try {
        re = this.compile(p);
      } catch (e) {
        this.feedback(esc(t('pattern.invalid')) + ' ' + esc((e as Error).message), 'bad');
      }
    }
    if (re && $('#feedback').dataset.invalid) this.feedback('');
    $('#feedback').dataset.invalid = p && !re ? '1' : '';
    $('#yes').innerHTML = it.yes.map((s) => this.rowHtml(s, re, true)).join('');
    $('#no').innerHTML = it.no.map((s) => this.rowHtml(s, re, false)).join('');
    const all = re && it.yes.every((s) => re.test(s)) && it.no.every((s) => !re.test(s));
    if (all && !this.busy) {
      if (!this.errorsOnItem) this.weak(it.id, -1);
      this.feedback('✓ ' + esc(t('drill.exact')), 'good');
      this.flash();
      this.busy = true;
      setTimeout(() => {
        if (state.drill !== this) return;
        this.i++;
        if (this.i >= this.n) {
          const total = performance.now() - this.t0;
          return this.finish(total / 1000 / this.n, (100 * (this.n - this.itemsWithError)) / this.n);
        }
        this.show();
      }, 450);
    } else if (final && p) {
      this.markError();
      this.shake();
      this.feedback(esc(t('pattern.notYet')), 'bad');
    }
  }
  markError(): void {
    this.errorsOnItem++;
    if (this.errorsOnItem === 1) {
      this.itemsWithError++;
      this.weak(this.item.id, 1);
      this.misses.push({
        label: pick(this.item.task),
        html: `<span class="answer">${esc(this.item.solution)}</span>`,
      });
    }
  }
  reveal(): void {
    if (!this.errorsOnItem) this.markError();
    this.feedback(
      `${esc(t('pattern.oneSolution'))} <span class="answer">${esc(this.item.solution)}</span> — ${esc(t('pattern.typeIt'))}`,
      'bad',
    );
    $('#pat').focus();
  }
  onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).id !== 'pat') {
      if (e.key.length === 1 || e.key === 'Backspace') $('#pat').focus();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      this.check(true);
    }
  }
}
