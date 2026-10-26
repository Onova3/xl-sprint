/* Étape 8 : mini-cas chronométrés, résolus dans le vrai Excel du joueur. */

import { t } from '../i18n';
import { loc } from '../state';
import { $, copyText, esc, now } from '../ui/dom';
import { BaseDrill } from './base';
import { makeCase, parseAnswer, type MiniCase } from './cases';

export class CaseDrill extends BaseDrill {
  kind = 'case';
  correctFirst = 0;
  c!: MiniCase;
  start(): void {
    this.shell(`<div id="caseBody"></div><div class="feedback" id="feedback"></div>`, t('case.title'));
    this.begin();
    this.show();
  }
  question(): string {
    return t(this.c.q, this.c.params);
  }
  show(): void {
    this.c = makeCase((Date.now() ^ (this.i * 7919)) >>> 0);
    this.errorsOnItem = 0;
    this.itemStart = now();
    $('#caseBody').innerHTML = `
      <div class="case-q">${esc(this.question())}</div>
      <div class="inline">
        <button class="btn primary" id="copyBtn">${esc(t('case.copy'))}</button>
        <span class="note">${esc(t('case.pasteNote'))}</span>
      </div>
      <div id="copyFallback"></div>
      <div class="datatable"><table class="sheet"><thead><tr><th></th><th>A · Order ID</th><th>B · Date</th><th>C · Region</th><th>D · Product</th><th>E · Units</th><th>F · Unit Price</th></tr></thead>
        <tbody>${this.c.rows.map((x, k) => `<tr><th>${k + 2}</th><td>${x.id}</td><td>${x.date}</td><td>${x.region}</td><td>${x.product}</td><td class="r">${x.units}</td><td class="r">${x.price}</td></tr>`).join('')}</tbody></table></div>
      <form class="inline" id="ansForm">
        <label class="label" for="ans">${esc(t('case.yourResult'))}</label>
        <input type="text" id="ans" autocomplete="off" inputmode="${this.c.text ? 'text' : 'decimal'}">
        <button class="btn primary" type="submit">${esc(t('case.check'))}</button>
        <button class="btn ghost" type="button" id="giveUp">${esc(t('drill.showAnswer'))}</button>
      </form>`;
    $('#copyBtn').addEventListener('click', () => this.copy());
    $('#ansForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      this.check();
    });
    $('#giveUp').addEventListener('click', () => this.giveUp());
    this.feedback('');
    this.counter();
  }
  copy(): void {
    const tsv = this.c.tsv;
    const done = () => this.feedback(esc(t('case.copied')), 'good');
    const fallback = () => {
      $('#copyFallback').innerHTML =
        `<textarea class="copybox" id="copyBox" readonly aria-label="${esc(t('case.dataToCopy'))}"></textarea><p class="note">${esc(t('case.copyRefused'))}</p>`;
      const ta = $<HTMLTextAreaElement>('#copyBox');
      ta.value = tsv;
      ta.focus();
      ta.select();
    };
    copyText(tsv).then(done, fallback);
  }
  check(): void {
    const raw = $<HTMLInputElement>('#ans').value;
    if (!raw.trim()) return;
    let ok: boolean;
    if (this.c.text) ok = raw.trim().toLowerCase() === String(this.c.ans).toLowerCase();
    else {
      const v = parseAnswer(raw);
      ok = v !== null && Math.abs(v - (this.c.ans as number)) < 0.011;
    }
    if (ok) this.next(true);
    else {
      this.errorsOnItem++;
      this.shake();
      this.feedback(esc(t('case.wrong')), 'bad');
    }
  }
  answerText(): string {
    return this.c.text ? String(this.c.ans) : Number(this.c.ans).toLocaleString('en-US');
  }
  giveUp(): void {
    this.errorsOnItem++;
    const ansTxt = this.answerText();
    this.misses.push({ label: this.question(), html: `<span class="answer">${esc(ansTxt)}</span>` });
    const how = loc(this.c.how) + (this.c.howNote ? ' ' + t(this.c.howNote) : '');
    this.feedback(
      `${esc(t('drill.answer'))} <b class="num">${esc(ansTxt)}</b> · ${esc(t('case.lead'))} <span class="answer">${esc(how)}</span>
      <button class="btn" type="button" id="nextCase">${esc(t('case.next'))}</button>`,
      'bad',
    );
    $('#nextCase').addEventListener('click', () => this.next(false));
  }
  next(solved: boolean): void {
    if (solved && !this.errorsOnItem) this.correctFirst++;
    if (solved && this.errorsOnItem)
      this.misses.push({
        label: this.question(),
        html: `<span class="answer">${esc(String(this.c.ans))}</span>`,
      });
    this.flash();
    this.i++;
    if (this.i >= this.n) {
      const total = now() - this.t0;
      return this.finish(total / 1000 / this.n, (100 * this.correctFirst) / this.n);
    }
    this.show();
  }
  onKey(): void {}
}
