/* Testeur regex en direct (étape 6), repris de la v1.1. */

import { t } from '../i18n';
import { loc, fnName } from '../state';
import { $, copyText, esc } from './dom';

const tester = {
  pat: '\\b([A-Z]{2})-(\\d{3,4})\\b',
  ci: false,
  text: 'Orders today: AB-123, XL-2026 and ab-999.\nRefunds: CR-44, ZZ-10000, QA-0007\nContact: ana@mail.com / (555) 123-4567',
};

export function testerHtml(): string {
  return `<div class="tester">
    <label class="label" for="tPat">${esc(t('tester.pattern'))}</label>
    <div class="patbar"><span>"</span><input id="tPat" spellcheck="false" autocomplete="off" value="${esc(tester.pat)}"><span>"</span></div>
    <label class="check"><input type="checkbox" id="tCi" ${tester.ci ? 'checked' : ''}> ${esc(t('tester.ci'))}</label>
    <label class="label" for="tText">${esc(t('tester.text'))}</label>
    <textarea id="tText" spellcheck="false">${esc(tester.text)}</textarea>
    <div class="feedback" id="tMsg"></div>
    <div><span class="eyebrow">${esc(t('tester.highlighted'))}</span><div class="hl" id="tOut"></div></div>
    <div><span class="eyebrow">${esc(t('tester.detail'))}</span><div class="xscroll" id="tList"></div></div>
    <div><span class="eyebrow">${esc(t('tester.formulas'))}</span><div id="tFx" class="fxlist"></div></div>
  </div>`;
}
const excelStr = (s: string) => '"' + s.replace(/"/g, '""') + '"';

export function bindTester(): void {
  const upd = () => {
    tester.pat = $<HTMLInputElement>('#tPat').value;
    tester.ci = $<HTMLInputElement>('#tCi').checked;
    tester.text = $<HTMLTextAreaElement>('#tText').value;
    let re: RegExp | null = null,
      msg = '';
    try {
      let p = tester.pat,
        f = 'g';
      if (p.startsWith('(?i)')) {
        p = p.slice(4);
        f += 'i';
      }
      if (tester.ci && !f.includes('i')) f += 'i';
      if (p) re = new RegExp(p, f);
    } catch (e) {
      msg = t('pattern.invalid') + ' ' + (e as Error).message;
    }
    $('#tMsg').className = 'feedback ' + (msg ? 'bad' : '');
    $('#tMsg').textContent = msg;
    let html = '',
      rows = '';
    tester.text.split('\n').forEach((ln, i) => {
      if (!re) {
        html += esc(ln) + '\n';
        return;
      }
      let out = '',
        last = 0;
      for (const m of ln.matchAll(re)) {
        if (m[0] === '') continue;
        const idx = m.index ?? 0;
        out += esc(ln.slice(last, idx)) + '<mark>' + esc(m[0]) + '</mark>';
        last = idx + m[0].length;
        rows += `<tr><td class="num">A${i + 1}</td><td><code>${esc(m[0])}</code></td><td>${
          m.length > 1
            ? m
                .slice(1)
                .map((g, k) => `<code>$${k + 1}</code> ${esc(g === undefined ? '' : g)}`)
                .join(' · ')
            : '—'
        }</td></tr>`;
      }
      html += out + esc(ln.slice(last)) + '\n';
    });
    $('#tOut').innerHTML = html;
    $('#tList').innerHTML = rows
      ? `<table class="tbl"><thead><tr><th>${esc(t('tester.cell'))}</th><th>${esc(t('tester.match'))}</th><th>${esc(t('tester.groups'))}</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<p class="note">${esc(t('tester.none'))}</p>`;
    const p = excelStr(tester.pat),
      cs = tester.ci ? ',1' : '';
    // Formules écrites en canonique puis affichées dans la syntaxe du joueur
    const fx: [string, string][] = [
      [`=REGEXTEST(A1,${p}${cs})`, t('tester.fxTest', { v: fnName('TRUE') })],
      [`=REGEXEXTRACT(A1,${p}${tester.ci ? ',0,1' : ''})`, t('tester.fxFirst')],
      [`=REGEXEXTRACT(A1,${p},1${cs})`, t('tester.fxAll')],
      [`=REGEXEXTRACT(A1,${p},2${cs})`, t('tester.fxGroups')],
      [`=REGEXREPLACE(A1,${p},""${tester.ci ? ',0,1' : ''})`, t('tester.fxRemove')],
    ].map(([f, d]) => [loc(f), d]);
    $('#tFx').innerHTML = fx
      .map(
        ([f, d], k) =>
          `<div class="fxrow"><code>${esc(f)}</code><span class="note">${esc(d)}</span><button class="btn" data-copy="${k}">${esc(t('tester.copy'))}</button></div>`,
      )
      .join('');
    $('#tFx')
      .querySelectorAll<HTMLElement>('[data-copy]')
      .forEach((b) =>
        b.addEventListener('click', () => {
          copyText(fx[+(b.dataset.copy as string)][0]).then(
            () => (b.textContent = t('tester.copied')),
            () => (b.textContent = t('tester.selectText')),
          );
        }),
      );
  };
  ['tPat', 'tText'].forEach((id) => $('#' + id).addEventListener('input', upd));
  $('#tCi').addEventListener('change', upd);
  upd();
}
