/* Étapes 1 et 2 : raccourcis clavier, détectés par la touche physique (e.code). */

import type { Step } from '../data/content';
import { pick, t } from '../i18n';
import {
  chordMatches,
  codeToTok,
  eventLabels,
  isSequence,
  keyLabels,
  MODCODES,
  shortcutVerified,
} from '../input/keycode';
import { state } from '../state';
import { weightedSample } from '../storage/progress';
import type { ShortcutEx } from '../types';
import { $, esc, keysHtml, now } from '../ui/dom';
import { BaseDrill } from './base';

export const itemKeysHtml = (it: ShortcutEx): string =>
  keysHtml(keyLabels(it, state.profile.keyboard), isSequence(it));

export const unverifiedBadge = (it: ShortcutEx): string =>
  shortcutVerified(it, state.profile.fnLang, state.profile.keyboard)
    ? ''
    : `<span class="status warn" title="${esc(it.localized ?? '')}">${esc(t('badge.unverifiedConfig'))}</span>`;

export class KeysDrill extends BaseDrill {
  kind = 'keys';
  items: ShortcutEx[];
  seq: string[] | null = null;
  opts: ShortcutEx[] = [];
  constructor(
    step: Step,
    n: number,
    public pool: ShortcutEx[],
  ) {
    super(step, n);
    this.items = weightedSample(pool, n, state.progress.weak);
  }
  start(): void {
    this.shell(
      `
      <div><div class="ctx" id="ctx"></div><div class="prompt" id="prompt"></div><div id="badge"></div></div>
      <div class="pressed" id="pressed"></div>
      <div id="choices"></div>
      <div class="feedback" id="feedback"></div>
      <div class="inline"><button class="btn ghost" id="hintBtn">${esc(t('drill.showAnswer'))}</button><span class="note">${esc(t('keys.escNote'))}</span></div>`,
      t('keys.title'),
    );
    $('#hintBtn').addEventListener('click', () => this.reveal());
    this.show();
    this.begin();
    $('#stage').focus();
  }
  get item(): ShortcutEx {
    return this.items[this.i];
  }
  show(): void {
    const it = this.item;
    this.errorsOnItem = 0;
    this.seq = null;
    this.itemStart = now();
    $('#ctx').textContent = it.context;
    $('#prompt').textContent = pick(it.action);
    $('#badge').innerHTML = unverifiedBadge(it);
    $('#pressed').innerHTML = '';
    this.feedback('');
    const ch = $('#choices');
    if (it.browserReserved) {
      const others = this.pool.filter((x) => x.id !== it.id && !isSequence(x));
      const opts = [it, ...weightedSample(others, 2, state.progress.weak)].sort(() => Math.random() - 0.5);
      this.opts = opts;
      ch.innerHTML = `<p class="note">${esc(t('keys.reserved'))}</p>
        <div class="choices">${opts.map((o, k) => `<button class="choice" data-opt="${k}"><span class="idx">${k + 1}</span>${itemKeysHtml(o)}</button>`).join('')}</div>`;
      ch.querySelectorAll<HTMLElement>('[data-opt]').forEach((b) =>
        b.addEventListener('click', () => this.choose(Number(b.dataset.opt))),
      );
    } else ch.innerHTML = '';
    this.counter();
  }
  showPressed(labels: string[], seq: boolean): void {
    $('#pressed').innerHTML = labels.length ? keysHtml(labels, seq) : '';
  }
  reveal(): void {
    if (!this.errorsOnItem) this.markError();
    this.feedback(t('drill.answer') + ' ' + itemKeysHtml(this.item), 'bad');
    $('#stage').focus();
  }
  markError(): void {
    this.errorsOnItem++;
    if (this.errorsOnItem === 1) {
      this.itemsWithError++;
      this.weak(this.item.id, 1);
      this.misses.push({ label: pick(this.item.action), html: itemKeysHtml(this.item) });
    }
  }
  miss(labels: string[], seq: boolean): void {
    this.markError();
    this.showPressed(labels, seq);
    this.shake();
    const hint = this.errorsOnItem >= 2 ? ' ' + t('drill.answer') + ' ' + itemKeysHtml(this.item) : '';
    this.feedback(esc(t('keys.wrong')) + hint, 'bad');
  }
  hit(): void {
    if (!this.errorsOnItem) this.weak(this.item.id, -1);
    this.flash();
    this.i++;
    if (this.i >= this.n) {
      const total = now() - this.t0;
      return this.finish(total / 1000 / this.n, (100 * (this.n - this.itemsWithError)) / this.n);
    }
    this.show();
  }
  choose(k: number): void {
    if (this.opts[k] === this.item) this.hit();
    else {
      this.markError();
      this.shake();
      this.feedback(esc(t('keys.no')) + ' ' + itemKeysHtml(this.item), 'bad');
    }
  }
  onKey(e: KeyboardEvent): void {
    if (this.paused) return;
    const it = this.item;
    if (!it) return;
    e.preventDefault();
    e.stopPropagation();
    const kb = state.profile.keyboard;
    if (MODCODES.has(e.code)) {
      if (
        (e.code === 'AltLeft' || e.code === 'AltRight') &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.repeat &&
        isSequence(it)
      ) {
        this.seq = [];
        this.showPressed(['Alt'], true);
      }
      return;
    }
    if (e.repeat) return;
    if (it.browserReserved) {
      const d = /^(Digit|Numpad)([1-3])$/.exec(e.code);
      if (d) this.choose(Number(d[2]) - 1);
      return;
    }
    if (isSequence(it)) {
      const expected = it.keys.split(' ').slice(1);
      if (e.code === 'Escape') {
        this.seq = null;
        this.showPressed([], false);
        return;
      }
      if (this.seq === null || e.ctrlKey || e.shiftKey) {
        this.seq = null;
        return this.miss(eventLabels(e, kb), false);
      }
      const tok = codeToTok(e.code, kb);
      this.seq.push(tok);
      const labels = ['Alt', ...this.seq];
      if (tok !== expected[this.seq.length - 1]) {
        this.seq = null;
        return this.miss(labels, true);
      }
      this.showPressed(labels, true);
      if (this.seq.length === expected.length) {
        this.seq = null;
        this.hit();
      }
      return;
    }
    if (chordMatches(e, it, kb)) {
      this.showPressed(eventLabels(e, kb), false);
      this.hit();
    } else this.miss(eventLabels(e, kb), false);
  }
}
