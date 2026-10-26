/* Barre de formule avec complétion (Tab), comme dans Excel, dans la langue du joueur. */

import { t } from '../i18n';
import { completableWord, completions, type Completion } from '../pedagogy/completion';
import { syntaxOf } from '../profile';
import { state } from '../state';
import { esc } from './dom';

export class FxBar {
  sugg: Completion[] = [];
  sel = 0;
  tok: { start: number; end: number; text: string } | null = null;
  constructor(
    public input: HTMLInputElement,
    public box: HTMLElement,
  ) {
    input.addEventListener('input', () => {
      this.sel = 0;
      this.update();
    });
    input.addEventListener('click', () => this.update());
  }
  token() {
    const fx = this.input,
      caret = fx.selectionStart ?? fx.value.length,
      left = fx.value.slice(0, caret);
    const w = completableWord(left);
    if (!w || !w.before) return null;
    if (fx.value.charAt(caret) === '(') return null;
    return { start: caret - w.word.length, end: caret, text: w.word };
  }
  update(): void {
    const tk = this.token();
    if (!tk) return this.hide();
    this.sugg = completions(tk.text, this.input.value.slice(0, tk.start), syntaxOf(state.profile)).slice(
      0,
      8,
    );
    if (!this.sugg.length) return this.hide();
    this.sel = Math.min(this.sel, this.sugg.length - 1);
    this.tok = tk;
    this.paint();
    this.box.hidden = false;
  }
  paint(): void {
    this.box.innerHTML = this.sugg
      .map(
        (o, k) =>
          `<div aria-selected="${k === this.sel}">${esc(o.label)}${o.fn ? '' : `<span class="tag">${esc(t('fx.name'))}</span>`}</div>`,
      )
      .join('');
  }
  hide(): void {
    this.sugg = [];
    this.sel = 0;
    this.box.hidden = true;
  }
  accept(): void {
    const fx = this.input,
      o = this.sugg[this.sel],
      tk = this.tok;
    if (!o || !tk) return;
    fx.value = fx.value.slice(0, tk.start) + o.insert + fx.value.slice(tk.end);
    const pos = tk.start + o.insert.length;
    fx.setSelectionRange(pos, pos);
    this.hide();
  }
  handleKey(e: KeyboardEvent): boolean {
    const open = this.sugg.length > 0 && !this.box.hidden;
    if (e.key === 'Tab') {
      e.preventDefault();
      if (open) this.accept();
      return true;
    }
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      this.sel = (this.sel + (e.key === 'ArrowDown' ? 1 : this.sugg.length - 1)) % this.sugg.length;
      this.paint();
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.hide();
      return true;
    }
    if (
      e.ctrlKey &&
      ['s', 'p', 'd', 'r', 'f', 'g', 'h', 'k', 'l', 'u', 'b', 'i', 'n'].includes(e.key.toLowerCase())
    )
      e.preventDefault();
    return false;
  }
}

export const fxbarHtml = (
  nb: string,
): string => `<div class="fbar"><span class="namebox" id="nb">${esc(nb)}</span><span class="fx">fx</span>
  <input id="fx" autocomplete="off" spellcheck="false" aria-label="${esc(t('fx.label'))}">
  <div class="suggest" id="suggest" hidden></div></div>`;
