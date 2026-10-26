/* Démarrage : profil (assistant au premier lancement), progression, mise en page. */

import './ui/styles.css';
import { hooks } from './drills/base';
import { setUiLang, t } from './i18n';
import { loadProfile, readProfile, saveProfile } from './profile';
import { loadSettings, saveSettings, state } from './state';
import { loadProgress, saveProgress } from './storage/local';
import { makeExport, mergeProgress, parseImport } from './storage/progress';
import type { StepId } from './types';
import { renderAll, selectStep } from './ui/app';
import { $, esc } from './ui/dom';
import { openProfileDialog } from './ui/profileDialog';

type CloudDoc = { get(): Promise<{ exists: boolean; data(): unknown }>; set(v: unknown): Promise<void> };
type ClaudeRuntime = { use(name: string): Promise<unknown> };
const cloud = { ref: null as CloudDoc | null, queue: Promise.resolve() as Promise<unknown> };

function persist(): void {
  saveProgress(state.progress);
  if (!state.cloud || !cloud.ref) return;
  const body = JSON.parse(JSON.stringify(state.progress));
  cloud.queue = cloud.queue
    .then(() => cloud.ref?.set(body))
    .catch((err: { code?: string }) => {
      if (err && ['invalid_argument', 'revoked', 'not_granted'].includes(err.code ?? '')) {
        state.cloud = false;
        setChip();
      }
    });
}

/** Synchronisation optionnelle de la v1.1 quand la page tourne dans un environnement qui la propose. */
async function initCloud(): Promise<void> {
  const rt = (window as unknown as { claude?: ClaudeRuntime }).claude;
  if (!rt || typeof rt.use !== 'function') return;
  try {
    const [user, db] = (await Promise.all([rt.use('user'), rt.use('db')])) as [
      { id(): Promise<string> } | null,
      { doc(p: string): CloudDoc } | null,
    ];
    const uid = user ? await user.id() : null;
    if (!db || !uid) return;
    const ref = db.doc('data/users/' + uid + '/progress');
    const snap = await ref.get();
    const remote = snap.exists ? parseImport(JSON.stringify(snap.data())) : null;
    if (remote) state.progress = mergeProgress(remote.progress, state.progress);
    cloud.ref = ref;
    state.cloud = true;
    setChip();
    renderAll();
  } catch {
    /* on reste en local */
  }
}

function setChip(): void {
  const chip = document.getElementById('storeChip');
  if (!chip) return;
  chip.textContent = state.cloud ? t('chip.cloud') : t('chip.local');
  chip.classList.toggle('ok', state.cloud);
}

function profileSummary(): string {
  const p = state.profile;
  return t('header.profile', {
    fn: t(p.fnLang === 'fr' ? 'profile.fnFr' : 'profile.fnEn'),
    sep: p.listSep,
    kb: t(`kb.${p.keyboard}` as 'kb.qwerty-us'),
  });
}

function shellHtml(): string {
  const p = state.profile;
  return `<div class="shell">
  <header class="top">
    <div class="brand">
      <h1>XL <span class="cell">Sprint</span></h1>
      <p>${esc(t('header.tagline'))} · ${esc(profileSummary())}</p>
    </div>
    <div class="chips">
      <span class="chip" id="storeChip"></span>
      <span class="chip">Windows · ${esc(p.excel === '365' ? 'Excel 365' : 'Excel ' + p.excel)}</span>
      <button class="btn" id="profileBtn">${esc(t('header.settings'))}</button>
    </div>
  </header>
  <div class="layout">
    <aside class="path">
      <nav class="panel" aria-label="${esc(t('aside.path'))}">
        <div style="padding: 12px 14px 8px;"><span class="eyebrow">${esc(t('aside.path'))}</span></div>
        <ol class="steps" id="steps"></ol>
      </nav>
      <section class="panel roadmap" aria-labelledby="dataTitle">
        <span class="eyebrow" id="dataTitle">${esc(t('data.title'))}</span>
        <p class="note">${esc(t('data.note'))}</p>
        <div class="controls">
          <button class="btn" id="exportBtn">${esc(t('data.export'))}</button>
          <label class="btn" for="importFile">${esc(t('data.import'))}</label>
          <input type="file" id="importFile" accept="application/json,.json" class="visually-hidden">
        </div>
        <p class="feedback" id="dataMsg" role="status"></p>
      </section>
      <section class="panel roadmap" aria-labelledby="rmTitle">
        <span class="eyebrow" id="rmTitle">${esc(t('roadmap.title'))}</span>
        <ol>
          <li class="now"><b>1</b><span>${esc(t('roadmap.p1'))}</span></li>
          <li><b>2</b><span>${esc(t('roadmap.p2'))}</span></li>
          <li><b>3</b><span>${esc(t('roadmap.p3'))}</span></li>
          <li><b>4</b><span>${esc(t('roadmap.p4'))}</span></li>
        </ol>
      </section>
    </aside>
    <main class="panel work" id="work"></main>
  </div>
  <p class="foot">${esc(t('footer.shortcuts'))}</p>
</div>`;
}

function exportProgress(): void {
  const file = makeExport(state.progress, state.settings, { ...state.profile });
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `xl-sprint-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $('#dataMsg').textContent = t('data.exported');
}

function importProgress(fileInput: HTMLInputElement): void {
  const f = fileInput.files?.[0];
  if (!f) return;
  f.text().then((text) => {
    const msg = $('#dataMsg');
    const imp = parseImport(text);
    fileInput.value = '';
    if (!imp) {
      msg.className = 'feedback bad';
      msg.textContent = t('data.importError');
      return;
    }
    state.progress = mergeProgress(state.progress, imp.progress);
    if (imp.settings) Object.assign(state.settings, imp.settings);
    saveSettings();
    persist();
    msg.className = 'feedback good';
    msg.textContent = t('data.imported', { n: imp.progress.sessions.length });
    const prof = readProfile(imp.profile);
    if (prof && JSON.stringify(prof) !== JSON.stringify(state.profile)) {
      // le profil importé n'est appliqué que si le joueur le confirme
      if (window.confirm(t('data.applyProfile'))) {
        saveProfile(prof);
        state.profile = prof;
        return mount();
      }
    }
    renderAll();
  });
}

function mount(): void {
  setUiLang(state.profile.uiLang);
  document.title = 'XL Sprint';
  document.getElementById('app')!.innerHTML = shellHtml();
  setChip();
  $('#profileBtn').addEventListener('click', () => {
    if (state.drill) state.drill.stop(false);
    openProfileDialog(false, (p) => {
      if (p) mount();
    });
  });
  $('#exportBtn').addEventListener('click', exportProgress);
  $<HTMLInputElement>('#importFile').addEventListener('change', (e) =>
    importProgress(e.target as HTMLInputElement),
  );
  renderAll();
}

document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-step]');
  if (b) selectStep(b.dataset.step as StepId);
});

hooks.save = persist;
state.progress = loadProgress();
loadSettings();
const saved = loadProfile();
if (saved) {
  state.profile = saved;
  state.hasProfile = true;
}
mount();
if (!saved) openProfileDialog(true, () => mount());
initCloud();
