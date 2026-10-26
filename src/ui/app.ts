/* Interface : parcours des 8 étapes, écran d'étape, résultats, page Regex. Repris de la v1.1. */

import {
  DYN,
  FMT,
  FORMULAS,
  forVersion,
  NAV,
  PATTERNS,
  REGX,
  STEPS,
  stepById,
  type Step,
} from '../data/content';
import { hooks } from '../drills/base';
import { CaseDrill } from '../drills/case';
import { EvalDrill, FormulaDrill } from '../drills/formula';
import { itemKeysHtml, KeysDrill } from '../drills/keys';
import { PatternDrill } from '../drills/pattern';
import { TypingDrill, VbaDrill } from '../drills/typing';
import { pick, t } from '../i18n';
import { loc, saveSettings, state } from '../state';
import type { FormulaEvalEx, FormulaTextEx, RegexPatternEx, ShortcutEx, StepId, VbaEx } from '../types';
import { $, $$, esc, fmtClock } from './dom';
import { countUp } from './motion';
import { courseHtml } from './regexCourse';
import { bindTester, testerHtml } from './regexTester';
import { bestOf, defaultMode, fmtVal, meetsGoal, sessionsOf, spec, stepStatus, type Spec } from './stats';

const stepTitle = (st: Step) => t(`step.${st.id}.title` as 'step.nav.title');
const stepIntro = (st: Step) => t(`step.${st.id}.intro` as 'step.nav.intro');
const cpm = (sp: Spec) => (sp.better === 'high' ? ' ' + t('unit.cpm') : '');

export function renderSteps(): void {
  $('#steps').innerHTML = STEPS.map((st) => {
    const [cls, label] = stepStatus(st);
    const sp = spec(st, defaultMode(st));
    const best = bestOf(sp, sessionsOf(st.id, sp.mode));
    return `<li><button class="step" data-step="${st.id}" aria-current="${st.id === state.current}">
      <span class="rowhead">${st.n}</span>
      <span class="cellbody"><span class="name">${esc(stepTitle(st))}</span>
      <span class="meta"><span class="status ${cls}">${esc(label)}</span>${best != null ? `<span class="num">${esc(t('stat.recordShort', { v: fmtVal(sp, best) + cpm(sp) }))}</span>` : ''}${st.isNew ? `<span class="status new">${esc(t('status.new'))}</span>` : ''}</span></span>
    </button></li>`;
  }).join('');
}

function sparkline(sp: Spec, metrics: number[]): string {
  const pts = metrics.slice(-14);
  if (pts.length < 2) return `<p class="note">${esc(t('spark.empty'))}</p>`;
  const w = 600,
    h = 64,
    pad = 8;
  const goal = sp.goal;
  const lo = Math.min(...pts, goal),
    hi = Math.max(...pts, goal),
    span = hi - lo || 1;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (pts.length - 1);
  const y = (v: number) => pad + (sp.better === 'low' ? (v - lo) / span : (hi - v) / span) * (h - 2 * pad);
  const line = pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${x(0)},${h - pad} ${line} ${x(pts.length - 1)},${h - pad}`;
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(t('spark.label', { n: pts.length }))}">
    <line x1="${pad}" x2="${w - pad}" y1="${y(goal)}" y2="${y(goal)}" stroke="var(--amber)" stroke-dasharray="4 4" stroke-width="1"/>
    <polygon points="${area}" fill="var(--accent-soft)"/>
    <polyline pathLength="1" points="${line}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/>
    <circle cx="${x(pts.length - 1)}" cy="${y(last)}" r="4" fill="var(--accent)"/>
  </svg><p class="note">${esc(t('spark.note', { v: fmtVal(sp, goal) + cpm(sp) }))}</p>`;
}

function segHtml(attr: string, options: [string | number, string][], value: unknown, label: string): string {
  return `<span class="seg" role="group" aria-label="${esc(label)}">${options
    .map(
      ([v, tx]) =>
        `<button data-${attr}="${v}" aria-pressed="${String(value) === String(v)}">${esc(tx)}</button>`,
    )
    .join('')}</span>`;
}

type PoolItem = ShortcutEx | FormulaTextEx | FormulaEvalEx | RegexPatternEx | VbaEx;
function poolOf(st: Step): PoolItem[] | null {
  const s = state.settings,
    v = state.profile.excel;
  if (st.kind === 'regex') return s.regexMode === 'excel' ? forVersion(REGX, v) : PATTERNS;
  if (st.kind === 'eval') {
    const all = forVersion(DYN, v);
    return s.dynLevel === 'all' ? all : all.filter((d) => String(d.level) === s.dynLevel);
  }
  if (st.kind === 'typing' || st.kind === 'case') return null;
  if (st.id === 'nav') return NAV;
  if (st.id === 'fmt') return FMT;
  if (st.id === 'formula') return forVersion(FORMULAS, v);
  return null;
}

function weakList(st: Step): string {
  const pool = poolOf(st);
  if (!pool) return '';
  const w = state.progress.weak;
  const weak = pool
    .filter((it) => w[it.id])
    .sort((a, b) => w[b.id] - w[a.id])
    .slice(0, 6);
  if (!weak.length) return '';
  const label = (it: PoolItem) =>
    'action' in it
      ? pick(it.action)
      : 'title' in it
        ? pick(it.title)
        : 'task' in it
          ? pick(it.task)
          : 'prompt' in it
            ? pick(it.prompt)
            : 'code' in it
              ? it.code.split('\n')[0]
              : '';
  const right = (it: PoolItem) =>
    'keys' in it
      ? itemKeysHtml(it)
      : 'accepted' in it
        ? `<span class="answer">${esc(loc(it.accepted[0]))}</span>`
        : 'solutions' in it
          ? `<span class="answer">${esc(loc(it.solutions[0]))}</span>`
          : 'solution' in it
            ? `<span class="answer">${esc(it.solution)}</span>`
            : '';
  return `<div><span class="eyebrow">${esc(t('weak.title'))}</span><ul class="misses">${weak
    .map((it) => `<li><span>${esc(label(it))}</span>${right(it)}</li>`)
    .join('')}</ul></div>`;
}

const TYPING_LEVELS = (): [string, string][] => [
  ['base', t('level.base')],
  ['mid', t('level.mid')],
  ['hard', t('level.hard')],
  ['all', t('level.all')],
];
const DYN_LEVELS = (): [string, string][] => [
  ['all', t('level.allDyn')],
  ['1', '★'],
  ['2', '★★'],
  ['3', '★★★'],
];

function regexTabs(): string {
  const tab = state.settings.regexTab;
  return `<div class="tabs" role="tablist">${(
    [
      ['cours', t('regex.tab.course')],
      ['testeur', t('regex.tab.tester')],
      ['train', t('regex.tab.train')],
    ] as const
  )
    .map(([k, l]) => `<button role="tab" data-rtab="${k}" aria-selected="${tab === k}">${esc(l)}</button>`)
    .join('')}</div>`;
}
function bindRegexTabs(): void {
  $$('[data-rtab]', $('#work')).forEach((b) =>
    b.addEventListener('click', () => {
      state.settings.regexTab = b.dataset.rtab as 'cours';
      saveSettings();
      renderAll();
    }),
  );
}
function renderRegexPage(st: Step): void {
  $('#work').innerHTML = `
    <div class="work-head"><div><span class="eyebrow">${esc(t('intro.eyebrow', { n: st.n, total: STEPS.length }))}</span><h2>${esc(stepTitle(st))}</h2><p>${esc(stepIntro(st))}</p></div></div>
    ${regexTabs()}
    <div id="rbody">${state.settings.regexTab === 'cours' ? courseHtml() : testerHtml()}</div>`;
  bindRegexTabs();
  if (state.settings.regexTab === 'testeur') bindTester();
  $$('[data-goto]', $('#work')).forEach((b) =>
    b.addEventListener('click', () => {
      state.settings.regexTab = b.dataset.goto as 'cours';
      saveSettings();
      renderAll();
    }),
  );
}

export function renderIntro(): void {
  const st = stepById(state.current);
  const s = state.settings;
  if (st.kind === 'regex' && s.regexTab !== 'train') return renderRegexPage(st);
  const mode = defaultMode(st);
  const sp = spec(st, mode);
  const list = sessionsOf(st.id, sp.mode);
  const best = bestOf(sp, list);
  const lastS = list[list.length - 1];
  const sizes = segHtml(
    'size',
    st.sizes.map((n) => [n, String(n)]),
    s[st.id],
    t('intro.sessionLength'),
  );
  const goalTxt =
    t(sp.better === 'low' ? 'intro.goalLow' : 'intro.goalHigh', {
      v: sp.better === 'low' ? fmtVal(sp, sp.goal) : String(sp.goal),
      per: sp.per,
      acc: sp.acc,
    }) + (sp.mode === 'copy' ? ' ' + t('intro.goalCopy') : '');
  const what = t(`what.${st.kind}` as 'what.keys');
  let extra = '';
  if (st.kind === 'formula')
    extra = segHtml(
      'fmode',
      [
        ['write', t('mode.write')],
        ['copy', t('mode.copy')],
      ],
      sp.mode,
      t('mode.label'),
    );
  if (st.kind === 'typing')
    extra =
      segHtml('tlevel', TYPING_LEVELS(), s.typingLevel, t('level.label')) +
      segHtml(
        'ttab',
        [
          ['1', t('typing.tabOn')],
          ['0', t('typing.tabOff')],
        ],
        s.typingTab ? '1' : '0',
        t('typing.completion'),
      );
  if (st.kind === 'eval') extra = segHtml('dlevel', DYN_LEVELS(), s.dynLevel, t('level.difficulty'));
  if (st.kind === 'regex')
    extra = segHtml(
      'rmode',
      [
        ['pattern', t('regex.mode.pattern')],
        ['excel', t('regex.mode.excel')],
      ],
      s.regexMode,
      t('regex.mode.label'),
    );
  const modeLabel =
    st.kind === 'typing'
      ? t('modeLabel.level', {
          l: (TYPING_LEVELS().find((l) => l[0] === sp.mode) ?? ['', ''])[1].toLowerCase(),
        })
      : t(`modeLabel.${sp.mode ?? 'done'}` as 'modeLabel.done');
  const pool = poolOf(st);
  const empty = pool && !pool.length ? `<p class="feedback bad">${esc(t('intro.emptyPool'))}</p>` : '';
  $('#work').innerHTML = `
    <div class="work-head">
      <div><span class="eyebrow">${esc(t('intro.eyebrow', { n: st.n, total: STEPS.length }))}</span><h2>${esc(stepTitle(st))}</h2><p>${esc(stepIntro(st))}</p></div>
    </div>
    ${st.kind === 'regex' ? regexTabs() : ''}
    <div class="goal">${goalTxt}</div>
    <div class="controls">
      <span class="label">${esc(what)}</span>${sizes}${extra}
      <button class="btn primary" id="startBtn" ${empty ? 'disabled' : ''}>${esc(t('intro.start'))}</button>
    </div>
    ${empty}
    ${st.kind === 'keys' ? keysNote() : ''}
    <p class="note kbdnote">${esc(t('intro.kbdNote'))}</p>
    <div class="stats">
      <div class="stat best"><span class="k">${esc(t('stat.record'))}</span><span class="v">${fmtVal(sp, best)}</span><span class="label">${esc(sp.per)}</span></div>
      <div class="stat"><span class="k">${esc(t('stat.last'))}</span><span class="v">${lastS ? fmtVal(sp, lastS.metric) : '—'}</span><span class="label">${esc(lastS ? t('stat.accuracy', { v: Math.round(lastS.acc) }) : t('stat.noSession'))}</span></div>
      <div class="stat"><span class="k">${esc(t('stat.sessions'))}</span><span class="v num">${list.length}</span><span class="label">${esc(modeLabel)}</span></div>
    </div>
    ${sparkline(
      sp,
      list.map((x) => x.metric),
    )}
    ${weakList(st)}
  `;
  const W = $('#work');
  $('#startBtn').addEventListener('click', startDrill);
  const bind = (attr: string, fn: (v: string) => void) =>
    $$(`[data-${attr}]`, W).forEach((b) =>
      b.addEventListener('click', () => {
        fn(b.dataset[attr] as string);
        saveSettings();
        renderAll();
      }),
    );
  bind('size', (v) => (s[st.id] = Number(v)));
  bind('fmode', (v) => (s.formulaMode = v as 'write'));
  bind('tlevel', (v) => (s.typingLevel = v as 'base'));
  bind('ttab', (v) => (s.typingTab = v === '1'));
  bind('dlevel', (v) => (s.dynLevel = v as 'all'));
  bind('rmode', (v) => (s.regexMode = v as 'pattern'));
  bindRegexTabs();
}

function keysNote(): string {
  const p = state.profile;
  if (p.fnLang === 'en' && p.keyboard === 'qwerty-us') return '';
  return `<p class="note"><span class="status warn">${esc(t('badge.unverifiedConfig'))}</span> ${esc(t('keys.configNote'))}</p>`;
}

export function renderResult(): void {
  const res = state.lastResult;
  if (!res) return;
  const st = stepById(res.step),
    s = res.session;
  const sp = spec(st, res.mode);
  const goalMet = meetsGoal(sp, s);
  $('#work').innerHTML = `
    <div class="work-head"><div><span class="eyebrow">${esc(t('result.eyebrow', { n: st.n }))}</span><h2>${esc(stepTitle(st))}</h2></div>
      ${res.record ? `<span class="record">${esc(t('result.record'))}</span>` : ''}</div>
    <div class="stats">
      <div class="stat best"><span class="k">${esc(sp.better === 'high' ? t('result.speed') : t('result.avgTime'))}</span><span class="v">${fmtVal(sp, s.metric)}</span><span class="label">${esc(sp.per)}${goalMet ? ' · ' + esc(t('result.goalMet')) : ''}</span></div>
      <div class="stat"><span class="k">${esc(t('result.accuracy'))}</span><span class="v num">${Math.round(s.acc)} %</span><span class="label">${esc(t('result.goalAcc', { v: sp.acc }))}</span></div>
      <div class="stat"><span class="k">${esc(t('result.totalTime'))}</span><span class="v num">${fmtClock(s.ms)}</span><span class="label">${esc(t(st.kind === 'case' ? 'result.nCases' : 'result.nItems', { n: s.n }))}</span></div>
    </div>
    ${
      res.misses.length
        ? `<div><span class="eyebrow">${esc(t('result.review'))}</span><ul class="misses">${res.misses.map((m) => `<li><span>${esc(m.label)}</span>${m.html}</li>`).join('')}</ul></div>`
        : `<p class="note">${esc(t('result.noError'))}</p>`
    }
    ${res.extraHtml ?? ''}
    <div class="controls"><button class="btn primary" id="againBtn">${esc(t('result.again'))}</button><button class="btn" id="backBtn">${esc(t('result.back'))}</button></div>`;
  $('#againBtn').addEventListener('click', () => {
    state.lastResult = null;
    startDrill();
  });
  $('#backBtn').addEventListener('click', () => {
    state.lastResult = null;
    renderIntro();
  });
  $('#againBtn').focus();
  countUp($('#work'));
}

export function renderAll(): void {
  renderSteps();
  if (state.drill) return;
  if (state.lastResult && state.lastResult.step === state.current) renderResult();
  else renderIntro();
}

export function startDrill(): void {
  const st = stepById(state.current);
  const s = state.settings;
  const n = s[st.id] as number;
  const pool = poolOf(st);
  if (pool && !pool.length) return;
  let d;
  if (st.kind === 'keys') d = new KeysDrill(st, n, pool as ShortcutEx[]);
  else if (st.kind === 'typing') d = new TypingDrill(st, n, s.typingLevel, s.typingTab);
  else if (st.kind === 'formula') d = new FormulaDrill(st, n, s.formulaMode, pool as FormulaTextEx[]);
  else if (st.kind === 'eval') d = new EvalDrill(st, n, pool as FormulaEvalEx[], null);
  else if (st.kind === 'regex')
    d =
      s.regexMode === 'excel'
        ? new EvalDrill(st, n, pool as FormulaEvalEx[], 'excel')
        : new PatternDrill(st, n);
  else if (st.kind === 'vba') d = new VbaDrill(st, n);
  else d = new CaseDrill(st, n);
  if (d instanceof TypingDrill && !d.items.length) return;
  state.drill = d;
  d.start();
}

export function selectStep(id: StepId): void {
  if (state.drill) state.drill.stop(false);
  state.current = id;
  state.lastResult = null;
  renderAll();
  if (window.matchMedia('(max-width: 900px)').matches) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('#work').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
}

hooks.renderAll = renderAll;
hooks.renderSteps = renderSteps;
hooks.renderResult = renderResult;
