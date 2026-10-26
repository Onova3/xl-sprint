/* Info-bulle des arguments, comme dans Excel : signature, argument en cours en gras, facultatifs entre [ ]. */

import { t } from '../i18n';
import { syntaxOf } from '../profile';
import { highlightIndex, openCallAt, signatureOf, SIGNATURES_VERIFIED } from '../pedagogy/signature';
import { fnName, state } from '../state';
import { esc } from './dom';

/** HTML de l'info-bulle pour le texte avant le curseur, ou '' s'il n'y a rien à montrer. */
export function argTipHtml(before: string): string {
  const syn = syntaxOf(state.profile);
  const call = openCallAt(before, syn);
  if (!call) return '';
  const args = signatureOf(call.fn);
  if (!args) return '';
  const hi = highlightIndex(args, call.arg);
  const sep = syn.listSep + ' ';
  const parts = args.map((a, i) => (i === hi ? `<b>${esc(a)}</b>` : esc(a))).join(esc(sep));
  // les noms d'arguments ne sont sourcés qu'en anglais et restent à vérifier
  const badge =
    !SIGNATURES_VERIFIED || state.profile.fnLang !== 'en'
      ? ` <span class="status warn" title="${esc(t('argtip.unverified'))}">${esc(t('badge.toVerify'))}</span>`
      : '';
  return `<span class="argtip-sig">${esc(fnName(call.fn))}(${parts})</span>${badge}`;
}

export function updateArgTip(el: HTMLElement | null, before: string): void {
  if (!el) return;
  const html = argTipHtml(before);
  el.innerHTML = html;
  el.hidden = !html;
}
