/* Écran du mode Sprint (façon Monkeytype) : test au clavier, palette Échap, résultats. */

import { forVersion, TYPING } from '../data/content';
import { hooks } from '../drills/base';
import {
  COUNT_SIZES,
  SprintRun,
  sprintOrder,
  TIME_SIZES,
  type SprintMode,
  type Variant,
} from '../drills/sprint';
import { ghostChars } from '../drills/sprintScore';
import { t } from '../i18n';
import { FORMULA_SYMBOLS, mergeStats, pickForSymbols, slowest } from '../pedagogy/symbols';
import { configKey, syntaxOf } from '../profile';
import { loc, state } from '../state';
import type { SprintRecord } from '../types';
import { $, $$, esc } from './dom';
import { argTipHtml } from './argTip';
import { keyboardMapHtml } from './keyboardMap';
import { countUp } from './motion';

interface SprintSettings {
  mode: SprintMode;
  size: number;
  level: 'base' | 'mid' | 'hard' | 'all';
  tab: boolean;
  variants: Variant[];
}
const VARIANTS: Variant[] = ['noBack', 'stopFirst', 'hidden'];

function cfg(): SprintSettings {
  const s = state.settings as Record<string, unknown>;
  const mode: SprintMode = s.sprintMode === 'count' ? 'count' : 'time';
  const sizes = mode === 'time' ? TIME_SIZES : COUNT_SIZES;
  const size = sizes.includes(s.sprintSize as number) ? (s.sprintSize as number) : sizes[1];
  const level = ['base', 'mid', 'hard', 'all'].includes(s.sprintLevel as string)
    ? (s.sprintLevel as SprintSettings['level'])
    : 'base';
  const variants = Array.isArray(s.sprintVariants)
    ? (s.sprintVariants as Variant[]).filter((v) => VARIANTS.includes(v))
    : [];
  return { mode, size, level, tab: s.sprintTab !== false, variants };
}
function setCfg(p: Partial<SprintSettings>): void {
  const c = { ...cfg(), ...p };
  Object.assign(state.settings, {
    sprintMode: c.mode,
    sprintSize: c.size,
    sprintLevel: c.level,
    sprintTab: c.tab,
    sprintVariants: c.variants,
  });
  try {
    localStorage.setItem('xlsprint.settings', JSON.stringify(state.settings));
  } catch {
    /* stockage indisponible */
  }
}

/** Clé de record : mode, taille, niveau, variantes et configuration (langue, séparateur, clavier). */
function recordKey(c: SprintSettings, targeted: boolean): string {
  return [
    c.mode,
    c.size,
    c.level,
    [...c.variants].sort().join('+'),
    targeted ? 'symbols' : '',
    configKey(state.profile),
  ].join('|');
}
const keyOf = (r: SprintRecord) =>
  [
    r.mode,
    r.size,
    r.level,
    r.variants
      .filter((v) => v !== 'symbols')
      .sort()
      .join('+'),
    r.variants.includes('symbols') ? 'symbols' : '',
    r.cfg,
  ].join('|');
function bestFor(key: string): SprintRecord | null {
  const list = state.progress.sprints.filter((r) => keyOf(r) === key);
  return list.length ? list.reduce((a, b) => (b.net > a.net ? b : a)) : null;
}

const fmt = (n: number, d = 0) => {
  const s = n.toFixed(d);
  return state.profile.uiLang === 'fr' ? s.replace('.', ',') : s;
};

let run: SprintRun | null = null;
let targeted: string[] | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let lastWasTab = false;
let paletteSel = 0;
let paletteOpen = false;
let active = false;

function formulasFor(c: SprintSettings): string[] {
  const all = forVersion(TYPING, state.profile.excel);
  const pool = targeted
    ? pickForSymbols(all, (x) => loc(x.formula), targeted, 20)
    : all.filter((x) => c.level === 'all' || x.level === c.level);
  const n = c.mode === 'count' ? c.size : 200;
  return sprintOrder(pool.length ? pool : all, n).map((x) => loc(x.formula));
}

function newRun(): void {
  const c = cfg();
  run = new SprintRun({
    mode: c.mode,
    size: c.size,
    variants: c.variants,
    tab: c.tab,
    syn: syntaxOf(state.profile),
    formulas: formulasFor(c),
  });
  lastWasTab = false;
  renderLive();
}

/* ------------------------------------------------------------- rendu -- */

function seg(attr: string, opts: [string | number, string][], cur: unknown, label: string): string {
  return `<span class="seg" role="group" aria-label="${esc(label)}">${opts
    .map(
      ([v, l]) =>
        `<button data-${attr}="${v}" aria-pressed="${String(cur) === String(v)}" tabindex="-1">${esc(l)}</button>`,
    )
    .join('')}</span>`;
}

function controlsHtml(c: SprintSettings): string {
  const sizes =
    c.mode === 'time'
      ? TIME_SIZES.map((s) => [s, s + ' s'] as [number, string])
      : COUNT_SIZES.map((s) => [s, String(s)] as [number, string]);
  return `<div class="controls sprint-controls">
    ${seg(
      'smode',
      [
        ['time', t('sprint.mode.time')],
        ['count', t('sprint.mode.count')],
      ],
      c.mode,
      t('sprint.mode.label'),
    )}
    ${seg('ssize', sizes, c.size, t('sprint.size'))}
    ${seg(
      'slevel',
      [
        ['base', t('level.base')],
        ['mid', t('level.mid')],
        ['hard', t('level.hard')],
        ['all', t('level.all')],
      ],
      c.level,
      t('level.label'),
    )}
    ${seg(
      'stab',
      [
        ['1', t('typing.tabOn')],
        ['0', t('typing.tabOff')],
      ],
      c.tab ? '1' : '0',
      t('typing.completion'),
    )}
    <span class="seg" role="group" aria-label="${esc(t('sprint.variants'))}">${VARIANTS.map(
      (v) =>
        `<button data-svar="${v}" aria-pressed="${c.variants.includes(v)}" tabindex="-1">${esc(t(`sprint.v.${v}` as 'sprint.v.noBack'))}</button>`,
    ).join('')}</span>
    ${targeted ? `<span class="status warn">${esc(t('sprint.targeted', { s: targeted.join(' ') }))}</span>` : ''}
  </div>`;
}

function targetHtml(r: SprintRun): string {
  const tg = r.target,
    ty = r.typed,
    hidden = r.has('hidden');
  let html = '';
  for (let k = 0; k < tg.length; k++) {
    let cls = 'p';
    if (k < ty.length) cls = ty[k].toLowerCase() === tg[k].toLowerCase() ? 'k' : 'x';
    if (k === ty.length) cls += ' cur';
    // texte masqué : seuls les 5 caractères suivants sont visibles
    const ch = hidden && k >= ty.length + 5 ? '·' : tg[k];
    html += `<span class="${cls}">${esc(ch)}</span>`;
  }
  for (let k = tg.length; k < ty.length; k++) html += `<span class="x">${esc(ty[k])}</span>`;
  if (ty.length >= tg.length) html += '<span class="cur"> </span>';
  return html;
}

function renderLive(): void {
  if (!run) return;
  const c = cfg();
  const best = bestFor(recordKey(c, !!targeted));
  $('#work').innerHTML = `
    <div class="work-head"><div><span class="eyebrow">${esc(t('sprint.eyebrow'))}</span><h2>${esc(t('sprint.title'))}</h2></div>
      <button class="btn ghost" id="sprintExit">${esc(t('sprint.exit'))}</button></div>
    ${controlsHtml(c)}
    <div class="stage sprint-stage" id="stage" tabindex="0">
      <div class="runbar"><span class="num" id="sCounter"></span><span class="num" id="sLive"></span><span class="timer" id="sTimer"></span></div>
      <pre class="code formula-target" id="sCode" aria-label="${esc(t('typing.target'))}"></pre>
      <div class="argtip" id="sArg" hidden></div>
      <div class="hintchip" id="sHint"></div>
      <div class="ghost" id="sGhost" ${best ? '' : 'hidden'}>
        <div class="ghost-track" aria-hidden="true"><i class="ghost-me" id="gMe"></i><i class="ghost-rec" id="gRec"></i></div>
        <span class="note" id="gTxt"></span>
      </div>
      <p class="note">${esc(t('sprint.keysNote'))}</p>
    </div>
    <p class="note kbdnote">${esc(t('intro.kbdNote'))}</p>`;
  bindControls();
  $('#sprintExit').addEventListener('click', closeSprint);
  $('#stage').focus();
  paintLive();
}

function paintLive(): void {
  if (!run || !document.getElementById('sCode')) return;
  const now = performance.now();
  const c = cfg();
  $('#sCode').innerHTML = targetHtml(run);
  const cand = run.candidate();
  $('#sHint').innerHTML = cand
    ? `<kbd>Tab</kbd> → ${esc(cand.insert)}${cand.fn ? '' : ` <span class="tag">${esc(t('fx.name'))}</span>`}`
    : '&nbsp;';
  const tip = argTipHtml(run.typed);
  $('#sArg').innerHTML = tip;
  $('#sArg').hidden = !tip;
  const el = run.elapsed(now);
  $('#sTimer').textContent =
    c.mode === 'time'
      ? (run.started ? fmt(Math.max(0, c.size - el / 1000), 1) : String(c.size)) + ' s'
      : fmt(el / 1000, 1) + ' s';
  $('#sCounter').textContent =
    c.mode === 'count'
      ? `${Math.min(run.formulasDone + 1, c.size)} / ${c.size}`
      : t('sprint.done', { n: run.formulasDone });
  $('#sLive').textContent =
    run.started && el > 500
      ? t('sprint.live', { v: Math.round(run.correctChars / (el / 60000)) })
      : t('sprint.startHint');
  const best = bestFor(recordKey(c, !!targeted));
  if (best && run.started) {
    const ghost = ghostChars(best.perSecond, el);
    const total = Math.max(
      1,
      best.perSecond.reduce((a, b) => a + b, 0),
      run.correctChars,
    );
    $('#gMe').style.left = (100 * run.correctChars) / total + '%';
    $('#gRec').style.left = (100 * ghost) / total + '%';
    const diff = Math.round(run.correctChars - ghost);
    $('#gTxt').textContent =
      diff >= 0 ? t('sprint.ghostAhead', { n: diff }) : t('sprint.ghostBehind', { n: -diff });
  } else if (best) $('#gTxt').textContent = t('sprint.ghostReady', { v: Math.round(best.net) });
}

function chartHtml(perSecond: { ok: number; err: number }[]): string {
  const w = 600,
    h = 120,
    pad = 18;
  const n = perSecond.length;
  const max = Math.max(1, ...perSecond.map((s) => s.ok * 60));
  const bw = (w - 2 * pad) / n;
  const bars = perSecond
    .map((s, i) => {
      const v = s.ok * 60;
      const bh = ((h - 2 * pad) * v) / max;
      const x = pad + i * bw;
      const err = s.err
        ? `<text x="${(x + bw / 2).toFixed(1)}" y="${pad - 4}" text-anchor="middle" font-size="11" fill="var(--bad)">✗${s.err > 1 ? s.err : ''}</text>`
        : '';
      return `<rect style="--i:${i}" x="${(x + 1).toFixed(1)}" y="${(h - pad - bh).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${bh.toFixed(1)}" fill="var(--accent)" opacity="0.85"/>${err}`;
    })
    .join('');
  return `<svg class="spark sprint-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(t('sprint.chartLabel'))}">
    <line x1="${pad}" x2="${w - pad}" y1="${h - pad}" y2="${h - pad}" stroke="var(--line)"/>${bars}
    <text x="${pad}" y="${h - 3}" font-size="11" fill="var(--muted)">0 s</text>
    <text x="${w - pad}" y="${h - 3}" font-size="11" fill="var(--muted)" text-anchor="end">${n} s</text>
  </svg><p class="note">${esc(t('sprint.chartNote', { max: Math.round(max) }))}</p>`;
}

function finishRun(): void {
  if (!run) return;
  const r = run;
  const c = cfg();
  const sc = r.score();
  const key = recordKey(c, !!targeted);
  const prev = bestFor(key);
  const rec: SprintRecord = {
    t: Date.now(),
    mode: c.mode,
    size: c.size,
    level: c.level,
    variants: [...c.variants, ...(targeted ? ['symbols'] : [])],
    cfg: configKey(state.profile),
    net: Math.round(sc.net * 10) / 10,
    raw: Math.round(sc.raw * 10) / 10,
    fpm: Math.round(sc.formulasPerMin * 100) / 100,
    acc: Math.round(sc.acc * 10) / 10,
    consistency: Math.round(sc.consistency),
    ms: Math.round(r.endAt - r.t0),
    perSecond: sc.perSecond.map((s) => s.ok),
  };
  // un test arrêté avant la fin ou sans frappe juste ne compte pas comme record
  const valid = sc.net > 0 && !(r.stoppedOnError && c.mode === 'time' && rec.ms < 1000);
  if (valid) {
    state.progress.sprints.push(rec);
    state.progress.symbols = mergeStats(state.progress.symbols, r.symbols);
    hooks.save();
  }
  const isRecord = valid && (!prev || rec.net > prev.net);
  const coach = r.coach();
  const slowRun = slowest(r.symbols, 'c', FORMULA_SYMBOLS, 1).slice(0, 5);
  const slowAll = slowest(state.progress.symbols, 'c', FORMULA_SYMBOLS).slice(0, 5);
  const slowList = (slowAll.length ? slowAll : slowRun).map((x) => x.sym);
  const coachHtml = coach.keys
    ? `<p>${esc(t('coach.summary', { keys: coach.keys, min: coach.min }))}</p>${
        coach.tips.length
          ? `<ul class="misses">${coach.tips
              .slice(0, 6)
              .map(
                (tp) =>
                  `<li><span class="answer">${esc(tp.word)}</span><span>${esc(t('coach.tip', { prefix: tp.prefix, n: tp.saved }))}</span></li>`,
              )
              .join('')}</ul>`
          : `<p class="note">${esc(t('coach.noTip'))}</p>`
      }`
    : `<p class="note">${esc(t('coach.none'))}</p>`;
  $('#work').innerHTML = `
    <div class="work-head"><div><span class="eyebrow">${esc(t('sprint.eyebrow'))} · ${esc(t('sprint.result'))}</span><h2>${esc(t('sprint.title'))}</h2></div>
      ${isRecord ? `<span class="record">${esc(t('result.record'))}</span>` : ''}
      <button class="btn ghost" id="sprintExit">${esc(t('sprint.exit'))}</button></div>
    ${r.stoppedOnError ? `<p class="feedback bad">${esc(t('sprint.stopped'))}</p>` : ''}
    <div class="stats">
      <div class="stat best"><span class="k">${esc(t('sprint.net'))}</span><span class="v">${fmt(sc.net)}</span><span class="label">${esc(t('unit.cpm'))}${prev ? ' · ' + esc(t('sprint.prevBest', { v: Math.round(prev.net) })) : ''}</span></div>
      <div class="stat"><span class="k">${esc(t('sprint.raw'))}</span><span class="v">${fmt(sc.raw)}</span><span class="label">${esc(t('unit.cpm'))}</span></div>
      <div class="stat"><span class="k">${esc(t('sprint.fpm'))}</span><span class="v">${fmt(sc.formulasPerMin, 1)}</span><span class="label">${esc(t('sprint.formulas', { n: r.formulasDone }))}</span></div>
      <div class="stat"><span class="k">${esc(t('result.accuracy'))}</span><span class="v num">${fmt(sc.acc)} %</span><span class="label">${esc(t('sprint.consistency', { v: Math.round(sc.consistency) }))}</span></div>
    </div>
    ${chartHtml(sc.perSecond)}
    <section><span class="eyebrow">${esc(t('coach.title'))}</span>${coachHtml}</section>
    <section><span class="eyebrow">${esc(t('symbols.title'))}</span>
      ${slowList.length ? `<p>${esc(t('symbols.slow'))} ${slowList.map((s) => `<kbd>${esc(s)}</kbd>`).join(' ')}</p>` : `<p class="note">${esc(t('symbols.notEnough'))}</p>`}
      ${keyboardMapHtml(state.profile.keyboard, state.progress.symbols)}
    </section>
    <div class="controls">
      <button class="btn primary" id="sAgain">${esc(t('result.again'))}</button>
      ${slowList.length ? `<button class="btn" id="sTarget">${esc(t('symbols.train'))}</button>` : ''}
      ${targeted ? `<button class="btn" id="sUntarget">${esc(t('sprint.untarget'))}</button>` : ''}
      <span class="note">${esc(t('sprint.restartNote'))}</span>
    </div>`;
  $('#sprintExit').addEventListener('click', closeSprint);
  $('#sAgain').addEventListener('click', newRun);
  document.getElementById('sTarget')?.addEventListener('click', () => {
    targeted = slowList;
    newRun();
  });
  document.getElementById('sUntarget')?.addEventListener('click', () => {
    targeted = null;
    newRun();
  });
  $('#sAgain').focus();
  countUp($('#work'));
}

/* -------------------------------------------------------- palette Échap -- */

interface Cmd {
  label: string;
  run: () => void;
}
function commands(): Cmd[] {
  const c = cfg();
  const out: Cmd[] = [];
  for (const s of TIME_SIZES)
    out.push({ label: t('palette.time', { n: s }), run: () => setCfg({ mode: 'time', size: s }) });
  for (const s of COUNT_SIZES)
    out.push({ label: t('palette.count', { n: s }), run: () => setCfg({ mode: 'count', size: s }) });
  for (const v of VARIANTS)
    out.push({
      label: t(c.variants.includes(v) ? 'palette.off' : 'palette.on', {
        v: t(`sprint.v.${v}` as 'sprint.v.noBack'),
      }),
      run: () =>
        setCfg({ variants: c.variants.includes(v) ? c.variants.filter((x) => x !== v) : [...c.variants, v] }),
    });
  out.push({ label: t(c.tab ? 'palette.tabOff' : 'palette.tabOn'), run: () => setCfg({ tab: !c.tab }) });
  for (const l of ['base', 'mid', 'hard', 'all'] as const)
    out.push({
      label: t('palette.level', { l: t(`level.${l}` as 'level.base') }),
      run: () => setCfg({ level: l }),
    });
  out.push({ label: t('sprint.exit'), run: closeSprint });
  return out;
}
function paintPalette(): void {
  let el = document.getElementById('sPalette');
  if (!paletteOpen) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'sPalette';
    el.className = 'palette';
    el.setAttribute('role', 'listbox');
    el.setAttribute('aria-label', t('palette.label'));
    document.body.appendChild(el);
  }
  const cmds = commands();
  el.innerHTML =
    `<p class="note">${esc(t('palette.help'))}</p>` +
    cmds
      .map(
        (cm, i) =>
          `<div role="option" aria-selected="${i === paletteSel}" data-cmd="${i}">${esc(cm.label)}</div>`,
      )
      .join('');
  $$('[data-cmd]', el).forEach((d) =>
    d.addEventListener('click', () => {
      paletteSel = Number(d.dataset.cmd);
      runPalette();
    }),
  );
  el.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
}
function runPalette(): void {
  const cm = commands()[paletteSel];
  paletteOpen = false;
  paintPalette();
  if (!cm) return;
  cm.run();
  if (active) newRun();
}

/* ---------------------------------------------------------- clavier -- */

function onKey(e: KeyboardEvent): void {
  if (!active) return;
  if (paletteOpen) {
    e.preventDefault();
    const n = commands().length;
    if (e.key === 'Escape') {
      paletteOpen = false;
      paintPalette();
    } else if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) paletteSel = (paletteSel + 1) % n;
    else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) paletteSel = (paletteSel + n - 1) % n;
    else if (e.key === 'Enter') return runPalette();
    paintPalette();
    return;
  }
  if (document.getElementById('profileDlg')?.hasAttribute('open')) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    paletteOpen = true;
    paletteSel = 0;
    paintPalette();
    return;
  }
  // Tab puis Entrée : recommencer (pendant le test comme sur l'écran de résultats)
  if (e.key === 'Enter') {
    if (lastWasTab) {
      e.preventDefault();
      newRun();
      return;
    }
    if (run?.finished) return; // laisse Entrée activer le bouton qui a le focus
  }
  const wasTab = e.key === 'Tab';
  if (!run || run.finished) {
    // sur les résultats, Tab garde son rôle (passer d'un bouton à l'autre)
    lastWasTab = wasTab;
    return;
  }
  const altGr = e.getModifierState?.('AltGraph');
  if ((e.ctrlKey || e.altKey || e.metaKey) && !(altGr && e.key.length === 1)) return;
  let ended: boolean;
  const now = performance.now();
  if (wasTab) {
    e.preventDefault();
    ended = run.key({ kind: 'tab' }, now);
  } else if (e.key === 'Backspace') {
    e.preventDefault();
    ended = run.key({ kind: 'back' }, now);
  } else if (e.key.length === 1) {
    e.preventDefault();
    ended = run.key({ kind: 'char', ch: e.key }, now);
  } else return;
  lastWasTab = wasTab;
  if (ended) finishRun();
  else paintLive();
}

function bindControls(): void {
  const W = $('#work');
  const bind = (attr: string, fn: (v: string) => void) =>
    $$(`[data-${attr}]`, W).forEach((b) =>
      b.addEventListener('click', () => {
        fn(b.dataset[attr] as string);
        newRun();
      }),
    );
  bind('smode', (v) => setCfg({ mode: v as SprintMode, size: v === 'time' ? 30 : 10 }));
  bind('ssize', (v) => setCfg({ size: Number(v) }));
  bind('slevel', (v) => setCfg({ level: v as SprintSettings['level'] }));
  bind('stab', (v) => setCfg({ tab: v === '1' }));
  bind('svar', (v) => {
    const c = cfg();
    const x = v as Variant;
    setCfg({ variants: c.variants.includes(x) ? c.variants.filter((y) => y !== x) : [...c.variants, x] });
  });
}

/* ------------------------------------------------------- ouverture -- */

export function openSprint(): void {
  if (state.drill) state.drill.stop(false);
  active = true;
  targeted = null;
  document.body.classList.add('focus-mode');
  $$('[data-step]').forEach((b) => b.setAttribute('aria-current', 'false'));
  newRun();
  if (!timer)
    timer = setInterval(() => {
      if (!run || !active) return;
      if (run.started && !run.finished && run.tick(performance.now())) finishRun();
      else if (run.started && !run.finished) paintLive();
    }, 100);
}
export function closeSprint(): void {
  active = false;
  run = null;
  paletteOpen = false;
  paintPalette();
  if (timer) clearInterval(timer);
  timer = null;
  document.body.classList.remove('focus-mode');
  hooks.renderAll();
}
export const sprintActive = (): boolean => active;

document.addEventListener('keydown', onKey, true);
