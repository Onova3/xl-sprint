/* Page d'accueil : présentation, démonstration jouable, offre gratuite et payante. */

import '../ui/fonts.css';
import '../ui/styles.css';
import '../ui/polish.css';
import './landing.css';
import { OFFER } from '../config/offer';
import { setUiLang, t, uiLang, type MessageKey } from '../i18n';
import { loadProfile } from '../profile';
import { readJson, writeJson } from '../storage/local';
import { state } from '../state';
import type { FnLang, UiLang } from '../types';
import { esc } from '../ui/dom';
import { mountDemo, setDemoExcel, startHero } from './demo';

const LANG_KEY = 'xlsprint.landing.lang';
const T = (k: string, p?: Record<string, string | number>) => esc(t(k as MessageKey, p));

const check = `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONS: Record<string, string> = {
  sprint: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  coach: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h2M11 10h2M15 10h2M8 14h8"/>',
  symbols: '<path d="M8 4c-3 3-3 13 0 16M16 4c3 3 3 13 0 16"/>',
  tooltip: '<path d="M4 5h16v10H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  engine: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>',
  universal: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
};
const icon = (k: string) =>
  `<svg class="feat-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;

function proCta(): string {
  if (OFFER.checkoutUrl)
    return `<a class="btn primary big" href="${esc(OFFER.checkoutUrl)}" rel="noopener">${T('landing.pro.cta')}</a>`;
  const notify = OFFER.contactEmail
    ? `<a class="btn big" href="mailto:${esc(OFFER.contactEmail)}?subject=${encodeURIComponent(t('landing.pro.notifySubject'))}">${T('landing.pro.notify')}</a>`
    : '';
  return `<button class="btn primary big" disabled aria-disabled="true">${T('landing.pro.soon')}</button>${notify}`;
}
function proPrice(): string {
  if (!OFFER.priceLabel) return `<span class="price tbd">${T('landing.pro.tbd')}</span>`;
  const per = OFFER.period ? `<span class="per">${esc(OFFER.period[uiLang()])}</span>` : '';
  return `<span class="price">${esc(OFFER.priceLabel)}</span>${per}`;
}

function page(): string {
  const feats = ['sprint', 'coach', 'symbols', 'tooltip', 'engine', 'universal'];
  const fr = state.profile.fnLang === 'fr';
  return `
  <a class="skip" href="#demo">${T('landing.hero.try')}</a>
  <header class="lnav" id="lnav">
    <div class="lwrap lnav-in">
      <a class="logo" href="#top" aria-label="XL Sprint">XL <span class="cell">Sprint</span></a>
      <nav class="lnav-links" aria-label="${T('landing.nav.features')}">
        <a href="#demo">${T('landing.nav.demo')}</a><a href="#features">${T('landing.nav.features')}</a>
        <a href="#pricing">${T('landing.nav.pricing')}</a><a href="#faq">${T('landing.nav.faq')}</a>
      </nav>
      <div class="lnav-right">
        <span class="seg" role="group" aria-label="${T('landing.lang')}">
          <button data-lang="fr" aria-pressed="${uiLang() === 'fr'}" lang="fr">FR</button><button data-lang="en" aria-pressed="${uiLang() === 'en'}" lang="en">EN</button>
        </span>
        <a class="btn primary" href="./app.html">${T('landing.open')}</a>
      </div>
    </div>
  </header>

  <main id="top">
    <section class="hero lwrap">
      <div class="hero-copy">
        <span class="eyebrow">${T('landing.hero.kicker')}</span>
        <h1>${T('landing.hero.title')}</h1>
        <p class="lead">${T('landing.hero.sub')}</p>
        <div class="controls"><a class="btn primary big" href="#demo">${T('landing.hero.try')}</a><a class="btn big" href="./app.html">${T('landing.open')}</a></div>
        <p class="note">${check} ${T('landing.hero.note')}</p>
      </div>
      <div class="hero-visual" role="img" aria-label="${T('landing.hero.visual')}">
        <div class="hero-card">
          <div class="fbar hero-fbar"><span class="namebox">C2</span><span class="fx">fx</span><span class="hero-fx"><span class="hero-fx-text"></span><span class="hero-caret"></span></span></div>
          <div class="hero-sugg" hidden></div>
          <div class="argtip hero-tip" hidden></div>
          <div class="hero-grid" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<i style="--d:${i}"></i>`).join('')}</div>
        </div>
      </div>
    </section>

    <section class="lsec lwrap reveal" id="demo" aria-labelledby="demoTitle">
      <div class="lsec-head"><h2 id="demoTitle">${T('landing.demo.title')}</h2><p class="lead">${T('landing.demo.sub')}</p></div>
      <div class="demo panel">
        <div class="demo-top">
          <span class="label">${T('landing.demo.excel')}</span>
          <span class="seg" role="group" aria-label="${T('landing.demo.excel')}">
            <button data-excel="en" aria-pressed="${!fr}">${T('landing.demo.en')}</button><button data-excel="fr" aria-pressed="${fr}">${T('landing.demo.fr')}</button>
          </span>
          <span class="num demo-status"></span>
        </div>
        <div class="stage demo-stage" tabindex="0" aria-label="${T('landing.demo.click')}">
          <pre class="code formula-target demo-code"></pre>
          <div class="argtip demo-tip" hidden></div>
          <div class="hintchip demo-hint"></div>
          <span class="demo-cta note">${T('landing.demo.click')}</span>
        </div>
        <div class="demo-result" hidden></div>
        <div class="controls"><button class="btn demo-again">${T('landing.demo.again')}</button><a class="btn primary" href="./app.html">${T('landing.demo.continue')}</a>
          <span class="note kbdnote">${T('landing.demo.kbd')}</span></div>
      </div>
    </section>

    <section class="lsec lwrap" id="features" aria-labelledby="featTitle">
      <div class="lsec-head reveal"><h2 id="featTitle">${T('landing.features.title')}</h2><p class="lead">${T('landing.features.sub')}</p></div>
      <div class="feats">${feats
        .map(
          (f, i) =>
            `<article class="feat panel reveal" style="--i:${i}">${icon(f)}<h3>${T(`landing.f.${f}.t`)}</h3><p>${T(`landing.f.${f}.d`)}</p></article>`,
        )
        .join('')}</div>
    </section>

    <section class="lsec lwrap" aria-labelledby="howTitle">
      <div class="lsec-head reveal"><h2 id="howTitle">${T('landing.how.title')}</h2></div>
      <ol class="how">${[1, 2, 3]
        .map(
          (n) =>
            `<li class="reveal" style="--i:${n}"><span class="how-n">${n}</span><h3>${T(`landing.how.${n}.t`)}</h3><p>${T(`landing.how.${n}.d`)}</p></li>`,
        )
        .join('')}</ol>
    </section>

    <section class="lsec lwrap" id="pricing" aria-labelledby="priceTitle">
      <div class="lsec-head reveal"><h2 id="priceTitle">${T('landing.pricing.title')}</h2><p class="lead">${T('landing.pricing.sub')}</p></div>
      <div class="plans">
        <article class="plan panel reveal">
          <h3>${T('landing.free.name')}</h3>
          <p class="price-line"><span class="price">${T('landing.free.price')}</span></p>
          <ul>${[1, 2, 3, 4, 5].map((n) => `<li>${check}${T(`landing.free.${n}`)}</li>`).join('')}</ul>
          <div class="controls"><a class="btn big" href="./app.html">${T('landing.free.cta')}</a></div>
        </article>
        <article class="plan plan-pro panel reveal" style="--i:1">
          <span class="plan-badge">${T('landing.pro.badge')}</span>
          <h3>${T('landing.pro.name')}</h3>
          <p class="price-line">${proPrice()}</p>
          <p class="note">${T('landing.pro.all')}</p>
          <ul>${[1, 2, 3, 4, 5].map((n) => `<li>${check}${T(`landing.pro.${n}`)}</li>`).join('')}</ul>
          <div class="controls">${proCta()}</div>
        </article>
      </div>
    </section>

    <section class="lsec lwrap" id="faq" aria-labelledby="faqTitle">
      <div class="lsec-head reveal"><h2 id="faqTitle">${T('landing.faq.title')}</h2></div>
      <div class="faq">${['account', 'offline', 'french', 'mac', 'data']
        .map(
          (k) =>
            `<details class="panel reveal"><summary>${T(`landing.faq.${k}.q`)}</summary><p>${T(`landing.faq.${k}.a`)}</p></details>`,
        )
        .join('')}</div>
    </section>
  </main>

  <footer class="lfoot">
    <div class="lwrap lfoot-in">
      <a class="logo small" href="#top">XL <span class="cell">Sprint</span></a>
      <nav aria-label="${T('landing.footer.app')}"><a href="./app.html">${T('landing.footer.app')}</a>${OFFER.contactEmail ? `<a href="mailto:${esc(OFFER.contactEmail)}">${T('landing.footer.contact')}</a>` : ''}</nav>
      <p class="note">${T('landing.footer.excel')}<br>${T('landing.footer.fonts')}</p>
    </div>
  </footer>`;
}

function mount(): void {
  document.title = t('landing.meta.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('landing.meta.description'));
  const app = document.getElementById('landing') as HTMLElement;
  app.innerHTML = page();
  startHero(app.querySelector('.hero-card') as HTMLElement);
  mountDemo(app.querySelector('#demo') as HTMLElement);

  app.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) =>
    b.addEventListener('click', () => {
      const l = b.dataset.lang as UiLang;
      setUiLang(l);
      writeJson(LANG_KEY, l);
      mount();
    }),
  );
  app.querySelectorAll<HTMLElement>('[data-excel]').forEach((b) =>
    b.addEventListener('click', () => {
      setDemoExcel(b.dataset.excel as FnLang);
      app.querySelectorAll('[data-excel]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      app.querySelector('#demo')?.dispatchEvent(new Event('demo:reset'));
      startHero(app.querySelector('.hero-card') as HTMLElement);
    }),
  );

  // apparitions au défilement (immédiates si le mouvement est réduit ou sans IntersectionObserver)
  const items = app.querySelectorAll<HTMLElement>('.reveal');
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            io.unobserve(en.target);
          }
        }),
      { rootMargin: '0px 0px -8% 0px' },
    );
    items.forEach((el) => io.observe(el));
  }
}

// en-tête : ombre et flou dès qu'on défile
window.addEventListener(
  'scroll',
  () => document.getElementById('lnav')?.classList.toggle('scrolled', window.scrollY > 8),
  { passive: true },
);

// langue : choix mémorisé, sinon profil de l'application, sinon langue du navigateur
const saved = readJson(LANG_KEY);
const profile = loadProfile();
if (profile) Object.assign(state.profile, profile);
const lang: UiLang =
  saved === 'fr' || saved === 'en'
    ? saved
    : (profile?.uiLang ?? (navigator.language.startsWith('fr') ? 'fr' : 'en'));
setUiLang(lang);
if (!profile) setDemoExcel(lang === 'fr' ? 'fr' : 'en');
mount();
