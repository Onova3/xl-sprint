/* Étape 4 (écrire / recopier des formules, validation par le texte)
   et étapes 5 et 6 (exercices vérifiés par calcul réel). La saisie passe toujours par toCanonical. */

import { runFormula, sameResult, sheetFromRows, type Sheet, type V } from '../engine';
import type { Step } from '../data/content';
import { engineMessage, pick, t } from '../i18n';
import { toCanonical } from '../localize';
import { syntaxOf } from '../profile';
import { loc, state } from '../state';
import { weightedSample } from '../storage/progress';
import type { FormulaEvalEx, FormulaTextEx } from '../types';
import { $, esc } from '../ui/dom';
import { FxBar, fxbarHtml } from '../ui/fxbar';
import { dataGridHtml, gridHtml } from '../ui/grid';
import { BaseDrill } from './base';

/** Normalisation de la v1.1 : sans espaces ni $, en majuscules hors guillemets, parenthèses refermées. */
export function normFormula(s: string): string {
  s = String(s).trim();
  if (s.startsWith('=')) s = s.slice(1);
  let out = '',
    inQ = false,
    depth = 0;
  for (const ch of s) {
    if (ch === '"') {
      inQ = !inQ;
      out += ch;
      continue;
    }
    if (inQ) {
      out += ch;
      continue;
    }
    if (/\s/.test(ch) || ch === '$') continue;
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    out += ch.toUpperCase();
  }
  if (!inQ && depth > 0) out += ')'.repeat(depth); // Excel referme les parenthèses à la validation
  return '=' + out;
}
/** Compare une saisie (syntaxe du joueur) aux formules canoniques acceptées. */
export function formulaOk(item: FormulaTextEx, typedCanonical: string): boolean {
  const n = normFormula(typedCanonical);
  if (item.accepted.some((a) => normFormula(a) === n)) return true;
  if (item.acceptRegex && new RegExp(item.acceptRegex).test(n)) return true;
  return false;
}
const canon = (s: string) => toCanonical(s, syntaxOf(state.profile));
export const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(3 - n);

const SAMPLE = [
  ['Date', 'Region', 'Sales', 'Product', 'Units'],
  ['2026-03-02', 'East', '1,250', 'Laptop-Pro', '3'],
  ['2026-03-05', 'West', '480', 'Mouse-Basic', '12'],
  ['2026-03-09', 'North', '760', 'Monitor-27', '4'],
  ['2026-03-14', 'East', '315', 'Dock-USB-C', '2'],
];
function sheetHtml(): string {
  const cols = ['A', 'B', 'C', 'D', 'E'];
  const rows = SAMPLE.map(
    (r, i) =>
      `<tr><th>${i + 1}</th>${r.map((v, j) => `<td class="${i === 0 ? 'hdr' : ''} ${(j === 2 || j === 4) && i ? 'r' : ''}">${esc(v)}</td>`).join('')}</tr>`,
  ).join('');
  return `<div class="sheetwrap">
    <div class="xscroll"><table class="sheet" aria-label="${esc(t('formula.sheet'))}"><thead><tr><th></th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${rows}<tr><th>⋮</th><td colspan="5" class="note">${esc(t('formula.rows100'))}</td></tr></tbody></table></div>
    <div class="side">
      <div class="box"><code>H2</code> = <b>Monitor-27</b> <span class="note">${esc(t('formula.h2'))}</span></div>
      <div class="box">${t('formula.products')}</div>
    </div></div>`;
}

export class FormulaDrill extends BaseDrill {
  kind = 'formula';
  items: FormulaTextEx[];
  chars = 0;
  bar!: FxBar;
  constructor(step: Step, n: number, mode: string, pool: FormulaTextEx[]) {
    super(step, n);
    this.mode = mode;
    this.items = weightedSample(pool, n, state.progress.weak);
  }
  start(): void {
    this.shell(
      `
      ${sheetHtml()}
      <div><div class="ctx" id="ctx"></div><div class="prompt" id="prompt" style="font-size: clamp(20px, 3vw, 28px)"></div></div>
      <div id="targetWrap"></div>
      ${fxbarHtml('G2')}
      <div class="feedback" id="feedback"></div>
      <div class="inline"><button class="btn ghost" id="hintBtn">${esc(t('drill.showAnswer'))}</button>
        <span class="note">${esc(t('formula.note'))}</span></div>`,
      this.mode === 'copy' ? t('formula.titleCopy') : t('formula.titleWrite'),
    );
    this.bar = new FxBar($<HTMLInputElement>('#fx'), $('#suggest'));
    $('#hintBtn').addEventListener('click', () => this.reveal());
    this.show();
    this.begin();
    $('#fx').focus();
  }
  get item(): FormulaTextEx {
    return this.items[this.i];
  }
  show(): void {
    const it = this.item;
    this.errorsOnItem = 0;
    $('#ctx').textContent = t('formula.cell');
    $('#prompt').textContent = pick(it.prompt);
    $('#targetWrap').innerHTML =
      this.mode === 'copy' ? `<div class="target">${esc(loc(it.accepted[0]))}</div>` : '';
    const fx = $<HTMLInputElement>('#fx');
    fx.value = '=';
    fx.focus();
    fx.setSelectionRange(1, 1);
    this.bar.hide();
    this.feedback('');
    this.counter();
  }
  answerHtml(all = false): string {
    const list = all ? this.item.accepted : [this.item.accepted[0]];
    return list
      .map((a) => `<span class="answer">${esc(loc(a))}</span>`)
      .join(`   ${esc(t('formula.or'))}   `);
  }
  reveal(): void {
    if (!this.errorsOnItem) this.markError();
    this.feedback(`${esc(t('drill.answer'))} ${this.answerHtml()} — ${esc(t('formula.typeIt'))}`, 'bad');
    $('#fx').focus();
  }
  markError(): void {
    this.errorsOnItem++;
    if (this.errorsOnItem === 1) {
      this.itemsWithError++;
      this.weak(this.item.id, 1);
      this.misses.push({ label: pick(this.item.prompt), html: this.answerHtml(true) });
    }
  }
  submit(): void {
    const val = canon($<HTMLInputElement>('#fx').value);
    if (normFormula(val) === '=') return;
    const ok =
      this.mode === 'copy'
        ? normFormula(val) === normFormula(this.item.accepted[0])
        : formulaOk(this.item, val);
    if (ok) {
      if (!this.errorsOnItem) this.weak(this.item.id, -1);
      this.chars += loc(this.item.accepted[0]).length;
      this.flash();
      this.i++;
      if (this.i >= this.n) {
        const total = performance.now() - this.t0;
        const acc = (100 * (this.n - this.itemsWithError)) / this.n;
        if (this.mode === 'copy') return this.finish(this.chars / (total / 60000), acc);
        return this.finish(total / 1000 / this.n, acc);
      }
      this.show();
    } else {
      this.markError();
      this.shake();
      const hint = this.errorsOnItem >= 2 ? ` ${esc(t('drill.answer'))} ${this.answerHtml()}` : '';
      this.feedback(esc(t('formula.wrong')) + hint, 'bad');
    }
  }
  onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).id !== 'fx') {
      if (e.key.length === 1 || e.key === 'Backspace') $('#fx').focus();
      return;
    }
    if (this.bar.handleKey(e)) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.bar.hide();
      this.submit();
    }
  }
}

export class EvalDrill extends BaseDrill {
  kind = 'eval';
  items: FormulaEvalEx[];
  busy = false;
  bar!: FxBar;
  sheet: Sheet = {};
  expected: V = null;
  constructor(step: Step, n: number, pool: FormulaEvalEx[], mode: string | null) {
    super(step, n);
    this.mode = mode;
    this.items = weightedSample(pool, Math.min(n, pool.length), state.progress.weak);
    this.n = this.items.length;
  }
  start(): void {
    this.shell(
      `
      <div class="inline"><span class="stars" id="stars" aria-hidden="true"></span><span class="note" id="lvl"></span><span class="ctx" id="ctx"></span></div>
      <div class="prompt" id="prompt" style="font-size: clamp(20px, 3vw, 26px)"></div>
      <div class="grids">
        <div class="gridbox"><span class="eyebrow">${esc(t('eval.data'))}</span><div id="dataGrid"></div></div>
        <div class="gridbox"><span class="eyebrow">${esc(t('eval.expected'))}</span><div id="expGrid"></div></div>
        <div class="gridbox" id="gotBox" hidden><span class="eyebrow">${esc(t('eval.yours'))}</span><div id="gotGrid"></div></div>
      </div>
      ${fxbarHtml('C2')}
      <div class="feedback" id="feedback"></div>
      <div class="inline"><button class="btn ghost" id="tipBtn">${esc(t('eval.hint'))}</button><button class="btn ghost" id="solBtn">${esc(t('eval.showSolution'))}</button>
        <span class="note">${esc(t('eval.note'))}</span></div>`,
      t('formula.titleWrite'),
    );
    this.bar = new FxBar($<HTMLInputElement>('#fx'), $('#suggest'));
    $('#tipBtn').addEventListener('click', () => {
      this.feedback(esc(t('eval.hintPrefix')) + ' ' + esc(pick(this.item.hint)), '');
      $('#fx').focus();
    });
    $('#solBtn').addEventListener('click', () => this.reveal());
    this.show();
    this.begin();
    $('#fx').focus();
  }
  get item(): FormulaEvalEx {
    return this.items[this.i];
  }
  show(): void {
    const it = this.item;
    this.errorsOnItem = 0;
    this.busy = false;
    this.sheet = sheetFromRows(it.sheet);
    const ref = runFormula(it.solutions[0], this.sheet);
    this.expected = ref.ok ? ref.value : null;
    $('#stars').textContent = stars(it.level);
    $('#lvl').textContent = t('eval.level', { n: it.level });
    $('#ctx').textContent = pick(it.title);
    $('#prompt').textContent = pick(it.prompt);
    $('#dataGrid').innerHTML = dataGridHtml(it.sheet);
    $('#expGrid').innerHTML = gridHtml(this.expected, it.output, t('eval.expected'));
    $('#gotBox').hidden = true;
    $('#gotBox').className = 'gridbox';
    $('#nb').textContent = it.output;
    const fx = $<HTMLInputElement>('#fx');
    fx.value = '=';
    fx.focus();
    fx.setSelectionRange(1, 1);
    this.bar.hide();
    this.feedback('');
    this.counter();
  }
  markError(): void {
    this.errorsOnItem++;
    if (this.errorsOnItem === 1) {
      this.itemsWithError++;
      this.weak(this.item.id, 1);
      this.misses.push({
        label: pick(this.item.title),
        html: `<span class="answer">${esc(loc(this.item.solutions[0]))}</span>`,
      });
    }
  }
  reveal(): void {
    if (!this.errorsOnItem) this.markError();
    this.feedback(
      esc(t('eval.solutions')) +
        '<br>' +
        this.item.solutions.map((s) => `<span class="answer">${esc(loc(s))}</span>`).join('<br>') +
        '<br>' +
        esc(t('eval.typeOne')),
      'bad',
    );
    $('#fx').focus();
  }
  submit(): void {
    if (this.busy) return;
    const val = canon($<HTMLInputElement>('#fx').value);
    if (normFormula(val) === '=') return;
    const r = runFormula(val, this.sheet);
    if (!r.ok) {
      this.markError();
      this.shake();
      this.feedback(esc(t('eval.invalid')) + ' ' + esc(engineMessage(r.msg)), 'bad');
      return;
    }
    const box = $('#gotBox');
    box.hidden = false;
    $('#gotGrid').innerHTML = gridHtml(r.value, this.item.output, t('eval.yours'));
    if (sameResult(this.expected, r.value)) {
      box.className = 'gridbox result-ok';
      if (!this.errorsOnItem) this.weak(this.item.id, -1);
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
    } else {
      box.className = 'gridbox result-bad';
      this.markError();
      this.shake();
      this.feedback('✗ ' + esc(t('eval.mismatch')), 'bad');
    }
  }
  onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).id !== 'fx') {
      if (e.key.length === 1 || e.key === 'Backspace') $('#fx').focus();
      return;
    }
    if (this.bar.handleKey(e)) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.bar.hide();
      this.submit();
    }
  }
}
