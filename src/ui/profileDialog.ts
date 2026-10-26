/* Profil du joueur : assistant du premier lancement et écran de réglages (même formulaire). */

import { setUiLang, t } from '../i18n';
import { detectLayout } from '../input/layouts';
import { DEFAULT_SYNTAX, syntaxProblems, toLocal, unverifiedSyntax } from '../localize';
import { saveProfile } from '../profile';
import { state } from '../state';
import { EXCEL_VERSIONS, type FnLang, type KeyboardId, type Profile } from '../types';
import { $, esc } from './dom';

const opt = (v: string, label: string, cur: string, disabled = false) =>
  `<option value="${esc(v)}"${v === cur ? ' selected' : ''}${disabled ? ' disabled' : ''}>${esc(label)}</option>`;

function formHtml(p: Profile, first: boolean, detected: KeyboardId | null | 'pending'): string {
  const unv = unverifiedSyntax(p);
  const warn = (k: 'arrayColSep' | 'arrayRowSep') =>
    unv.includes(k) ? ` <span class="status warn">${esc(t('badge.toVerify'))}</span>` : '';
  const det =
    detected === 'pending'
      ? t('profile.kbDetecting')
      : detected
        ? t('profile.kbDetected', { k: t(`kb.${detected}` as 'kb.qwerty-us') })
        : t('profile.kbNoDetect');
  return `
  <form method="dialog" class="pform" id="pform">
    <h2>${esc(first ? t('profile.welcome') : t('profile.title'))}</h2>
    <p class="note">${esc(t('profile.intro'))}</p>
    <div class="pgrid">
      <label>${esc(t('profile.uiLang'))}
        <select name="uiLang">${opt('fr', 'Français', p.uiLang)}${opt('en', 'English', p.uiLang)}</select></label>
      <label>${esc(t('profile.fnLang'))}
        <select name="fnLang">${opt('en', t('profile.fnEn'), p.fnLang)}${opt('fr', t('profile.fnFr'), p.fnLang)}</select></label>
      <label>${esc(t('profile.listSep'))}
        <select name="listSep">${opt(',', ', ' + t('profile.comma'), p.listSep)}${opt(';', '; ' + t('profile.semicolon'), p.listSep)}</select></label>
      <label>${esc(t('profile.decimalSep'))}
        <select name="decimalSep">${opt('.', '. ' + t('profile.point'), p.decimalSep)}${opt(',', ', ' + t('profile.comma'), p.decimalSep)}</select></label>
      <label>${esc(t('profile.arrayColSep'))}${warn('arrayColSep')}
        <input name="arrayColSep" maxlength="1" value="${esc(p.arrayColSep)}" autocomplete="off"></label>
      <label>${esc(t('profile.arrayRowSep'))}${warn('arrayRowSep')}
        <input name="arrayRowSep" maxlength="1" value="${esc(p.arrayRowSep)}" autocomplete="off"></label>
      <label>${esc(t('profile.keyboard'))}
        <select name="keyboard">${opt('qwerty-us', t('kb.qwerty-us'), p.keyboard)}${opt('azerty-fr', t('kb.azerty-fr'), p.keyboard)}</select>
        <span class="note" id="kbDetect">${esc(det)}</span></label>
      <label>${esc(t('profile.os'))}
        <select name="os">${opt('windows', 'Windows', 'windows')}${opt('mac', 'macOS — ' + t('profile.soon'), 'windows', true)}</select></label>
      <label>${esc(t('profile.excel'))}
        <select name="excel">${EXCEL_VERSIONS.map((v) => opt(v, v === '365' ? 'Microsoft 365' : 'Excel ' + v, p.excel)).join('')}</select>
        <span class="note">${esc(t('profile.excelNote'))}</span></label>
    </div>
    <p class="note">${esc(t('profile.example'))} <code id="pExample"></code></p>
    <p class="feedback bad" id="pErr" role="alert"></p>
    <div class="controls">
      <button class="btn primary" id="pSave" value="save">${esc(first ? t('profile.start') : t('profile.save'))}</button>
      ${first ? '' : `<button class="btn" value="cancel" formnovalidate>${esc(t('profile.cancel'))}</button>`}
    </div>
  </form>`;
}

function readForm(form: HTMLFormElement, base: Profile): Profile {
  const f = new FormData(form);
  const g = (k: string) => String(f.get(k) ?? '');
  return {
    ...base,
    uiLang: g('uiLang') === 'en' ? 'en' : 'fr',
    fnLang: g('fnLang') === 'fr' ? 'fr' : 'en',
    listSep: g('listSep') === ';' ? ';' : ',',
    decimalSep: g('decimalSep') === ',' ? ',' : '.',
    arrayColSep: g('arrayColSep'),
    arrayRowSep: g('arrayRowSep'),
    keyboard: g('keyboard') === 'azerty-fr' ? 'azerty-fr' : 'qwerty-us',
    excel: (EXCEL_VERSIONS as string[]).includes(g('excel')) ? (g('excel') as Profile['excel']) : '365',
  };
}

/** Ouvre le formulaire ; `done` est appelé avec le profil enregistré (ou rien si annulé). */
export function openProfileDialog(first: boolean, done: (p: Profile | null) => void): void {
  let dlg = document.getElementById('profileDlg') as HTMLDialogElement | null;
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'profileDlg';
    dlg.className = 'pdialog';
    document.body.appendChild(dlg);
  }
  const d = dlg;
  let draft: Profile = { ...state.profile };
  let detected: KeyboardId | null | 'pending' = 'pending';

  const render = () => {
    d.innerHTML = formHtml(draft, first, detected);
    const form = $<HTMLFormElement>('#pform', d);
    const example = () => {
      const p = readForm(form, draft);
      // aperçu construit à partir du profil : aucune traduction inventée
      const el = document.getElementById('pExample');
      if (el) el.textContent = toLocal('=IF(SUM({1.5,2;3,4})>0,TRUE,FALSE)', p);
      const probs = syntaxProblems(p);
      $('#pErr', d).textContent = probs.length ? t('profile.sepError') : '';
      $<HTMLButtonElement>('#pSave', d).disabled = probs.length > 0;
    };
    form.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      const prev = draft;
      draft = readForm(form, draft);
      if (target.name === 'fnLang') {
        // séparateurs proposés selon la langue, modifiables ensuite
        draft = { ...draft, ...DEFAULT_SYNTAX[draft.fnLang as FnLang], fnLang: draft.fnLang };
        if (!draft.keyboardDetected) draft.keyboard = draft.fnLang === 'fr' ? 'azerty-fr' : 'qwerty-us';
      }
      if (target.name === 'keyboard') draft.keyboardDetected = false;
      if (target.name === 'uiLang') setUiLang(draft.uiLang);
      if (prev.fnLang !== draft.fnLang || target.name === 'uiLang') return render();
      example();
    });
    form.addEventListener('input', example);
    form.addEventListener('submit', (e) => {
      const btn = (e as SubmitEvent).submitter as HTMLButtonElement | null;
      if (btn?.value === 'cancel') {
        setUiLang(state.profile.uiLang);
        return;
      }
      const p = readForm(form, draft);
      if (syntaxProblems(p).length) {
        e.preventDefault();
        return;
      }
      saveProfile(p);
      state.profile = p;
      state.hasProfile = true;
      setUiLang(p.uiLang);
      done(p);
    });
    example();
  };
  d.addEventListener(
    'cancel',
    (e) => {
      if (first)
        e.preventDefault(); // le premier lancement demande un profil
      else {
        setUiLang(state.profile.uiLang);
        done(null);
      }
    },
    { once: !first },
  );
  render();
  if (!d.open) d.showModal();
  detectLayout().then((kb) => {
    detected = kb;
    if (kb && first) draft = { ...draft, keyboard: kb, keyboardDetected: true };
    if (d.open) render();
  });
}
