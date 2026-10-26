import{G as e,K as t,N as n,O as r,S as i,T as a,at as o,i as s,it as c,j as l,l as u,m as d,ot as f,t as p,u as m}from"./argTip-DB-YzMz7.js";var h={priceLabel:null,period:null,checkoutUrl:``,contactEmail:``},g=[`=SUM(C2:C100)`,`=IF(C2>=500,"Pass","Fail")`,`=XLOOKUP(H2,A2:A100,C2:C100,"Not found")`],_=`=SUMIFS(C2:C100,B2:B100,"East")`,v=()=>window.matchMedia?.(`(prefers-reduced-motion: reduce)`).matches;function y(e){Object.assign(i.profile,t[e],{keyboard:e===`fr`?`azerty-fr`:`qwerty-us`})}var b=t=>e(t,r(i.profile)),x=null;function S(e){x&&clearTimeout(x);let t=e.querySelector(`.hero-fx-text`),n=e.querySelector(`.hero-sugg`),a=e.querySelector(`.hero-tip`),o=b(_),s=(e,r)=>{t.textContent=e,n.hidden=!r,n.textContent=r??``;let i=p(e);a.innerHTML=i,a.hidden=!i};if(v()){s(o.slice(0,o.length-6),null);return}let c=``,l=()=>{if(c.length>=o.length){x=setTimeout(()=>{c=``,l()},2200);return}let e=u(c),t=e&&e.word.length>=3?m(e.word,e.before,r(i.profile))[0]:null,n=e?c.length-e.word.length:0;t&&t.fn&&o.slice(n).toUpperCase().startsWith(t.insert.toUpperCase())?(s(c,`Tab → ${t.insert}`),x=setTimeout(()=>{c=o.slice(0,n+t.insert.length),s(c,null),x=setTimeout(l,260)},650)):(c+=o[c.length],s(c,null),x=setTimeout(l,70+Math.random()*60))};l()}function C(e){let t,n=e.querySelector(`.demo-code`),a=e.querySelector(`.demo-status`),c=e.querySelector(`.demo-hint`),l=e.querySelector(`.demo-tip`),u=e.querySelector(`.demo-result`),f=e.querySelector(`.demo-stage`),m=()=>{t=new s({mode:`count`,size:g.length,variants:[],tab:!0,syn:r(i.profile),formulas:g.map(b)}),u.hidden=!0,h()},h=()=>{let e=t.finished?t.logs[t.logs.length-1].target:null,r=e??t.target,i=e??t.typed,s=``;for(let e=0;e<r.length;e++){let t=`p`;e<i.length&&(t=i[e].toLowerCase()===r[e].toLowerCase()?`k`:`x`),e===i.length&&(t+=` cur`),s+=`<span class="${t}">${d(r[e])}</span>`}for(let e=r.length;e<i.length;e++)s+=`<span class="x">${d(i[e])}</span>`;i.length>=r.length&&(s+=`<span class="cur"> </span>`),n.innerHTML=s,a.textContent=o(`landing.demo.progress`,{n:Math.min(t.formulasDone+1,g.length),total:g.length});let u=t.candidate();c.innerHTML=u?`<kbd>Tab</kbd> → ${d(u.insert)}`:`&nbsp;`;let f=p(i);l.innerHTML=f,l.hidden=!f},_=()=>{let e=t.score(),n=t.coach();u.innerHTML=`<p class="demo-score">${d(o(`landing.demo.result`,{v:Math.round(e.net),acc:Math.round(e.acc)}))}</p>
      <p class="note">${d(o(`coach.summary`,{keys:n.keys,min:n.min}))}</p>`,u.hidden=!1,h()};f.addEventListener(`keydown`,e=>{if(e.ctrlKey||e.metaKey||e.altKey&&!e.getModifierState?.(`AltGraph`)||t.finished)return;let n=performance.now(),r;if(e.key===`Tab`){if(!t.started||!t.candidate())return;r=t.key({kind:`tab`},n)}else if(e.key===`Backspace`)r=t.key({kind:`back`},n);else if(e.key.length===1)r=t.key({kind:`char`,ch:e.key},n);else return;e.preventDefault(),r?_():h()}),e.querySelector(`.demo-again`)?.addEventListener(`click`,()=>{m(),f.focus()}),e.addEventListener(`demo:reset`,m),m()}var w=`xlsprint.landing.lang`,T=(e,t)=>d(o(e,t)),E=`<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,D={sprint:`<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>`,coach:`<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h2M11 10h2M15 10h2M8 14h8"/>`,symbols:`<path d="M8 4c-3 3-3 13 0 16M16 4c3 3 3 13 0 16"/>`,tooltip:`<path d="M4 5h16v10H9l-5 4z"/><path d="M8 9h8M8 12h5"/>`,engine:`<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>`,universal:`<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>`},O=e=>`<svg class="feat-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${D[e]}</svg>`;function k(){if(h.checkoutUrl)return`<a class="btn primary big" href="${d(h.checkoutUrl)}" rel="noopener">${T(`landing.pro.cta`)}</a>`;let e=h.contactEmail?`<a class="btn big" href="mailto:${d(h.contactEmail)}?subject=${encodeURIComponent(o(`landing.pro.notifySubject`))}">${T(`landing.pro.notify`)}</a>`:``;return`<button class="btn primary big" disabled aria-disabled="true">${T(`landing.pro.soon`)}</button>${e}`}function A(){if(!h.priceLabel)return`<span class="price tbd">${T(`landing.pro.tbd`)}</span>`;let e=h.period?`<span class="per">${d(h.period[f()])}</span>`:``;return`<span class="price">${d(h.priceLabel)}</span>${e}`}function j(){let e=[`sprint`,`coach`,`symbols`,`tooltip`,`engine`,`universal`],t=i.profile.fnLang===`fr`;return`
  <a class="skip" href="#demo">${T(`landing.hero.try`)}</a>
  <header class="lnav" id="lnav">
    <div class="lwrap lnav-in">
      <a class="logo" href="#top" aria-label="XL Sprint">XL <span class="cell">Sprint</span></a>
      <nav class="lnav-links" aria-label="${T(`landing.nav.features`)}">
        <a href="#demo">${T(`landing.nav.demo`)}</a><a href="#features">${T(`landing.nav.features`)}</a>
        <a href="#pricing">${T(`landing.nav.pricing`)}</a><a href="#faq">${T(`landing.nav.faq`)}</a>
      </nav>
      <div class="lnav-right">
        <span class="seg" role="group" aria-label="${T(`landing.lang`)}">
          <button data-lang="fr" aria-pressed="${f()===`fr`}" lang="fr">FR</button><button data-lang="en" aria-pressed="${f()===`en`}" lang="en">EN</button>
        </span>
        <a class="btn primary" href="./app.html">${T(`landing.open`)}</a>
      </div>
    </div>
  </header>

  <main id="top">
    <section class="hero lwrap">
      <div class="hero-copy">
        <span class="eyebrow">${T(`landing.hero.kicker`)}</span>
        <h1>${T(`landing.hero.title`)}</h1>
        <p class="lead">${T(`landing.hero.sub`)}</p>
        <div class="controls"><a class="btn primary big" href="#demo">${T(`landing.hero.try`)}</a><a class="btn big" href="./app.html">${T(`landing.open`)}</a></div>
        <p class="note">${E} ${T(`landing.hero.note`)}</p>
      </div>
      <div class="hero-visual" role="img" aria-label="${T(`landing.hero.visual`)}">
        <div class="hero-card">
          <div class="fbar hero-fbar"><span class="namebox">C2</span><span class="fx">fx</span><span class="hero-fx"><span class="hero-fx-text"></span><span class="hero-caret"></span></span></div>
          <div class="hero-sugg" hidden></div>
          <div class="argtip hero-tip" hidden></div>
          <div class="hero-grid" aria-hidden="true">${Array.from({length:24},(e,t)=>`<i style="--d:${t}"></i>`).join(``)}</div>
        </div>
      </div>
    </section>

    <section class="lsec lwrap reveal" id="demo" aria-labelledby="demoTitle">
      <div class="lsec-head"><h2 id="demoTitle">${T(`landing.demo.title`)}</h2><p class="lead">${T(`landing.demo.sub`)}</p></div>
      <div class="demo panel">
        <div class="demo-top">
          <span class="label">${T(`landing.demo.excel`)}</span>
          <span class="seg" role="group" aria-label="${T(`landing.demo.excel`)}">
            <button data-excel="en" aria-pressed="${!t}">${T(`landing.demo.en`)}</button><button data-excel="fr" aria-pressed="${t}">${T(`landing.demo.fr`)}</button>
          </span>
          <span class="num demo-status"></span>
        </div>
        <div class="stage demo-stage" tabindex="0" aria-label="${T(`landing.demo.click`)}">
          <pre class="code formula-target demo-code"></pre>
          <div class="argtip demo-tip" hidden></div>
          <div class="hintchip demo-hint"></div>
          <span class="demo-cta note">${T(`landing.demo.click`)}</span>
        </div>
        <div class="demo-result" hidden></div>
        <div class="controls"><button class="btn demo-again">${T(`landing.demo.again`)}</button><a class="btn primary" href="./app.html">${T(`landing.demo.continue`)}</a>
          <span class="note kbdnote">${T(`landing.demo.kbd`)}</span></div>
      </div>
    </section>

    <section class="lsec lwrap" id="features" aria-labelledby="featTitle">
      <div class="lsec-head reveal"><h2 id="featTitle">${T(`landing.features.title`)}</h2><p class="lead">${T(`landing.features.sub`)}</p></div>
      <div class="feats">${e.map((e,t)=>`<article class="feat panel reveal" style="--i:${t}">${O(e)}<h3>${T(`landing.f.${e}.t`)}</h3><p>${T(`landing.f.${e}.d`)}</p></article>`).join(``)}</div>
    </section>

    <section class="lsec lwrap" aria-labelledby="howTitle">
      <div class="lsec-head reveal"><h2 id="howTitle">${T(`landing.how.title`)}</h2></div>
      <ol class="how">${[1,2,3].map(e=>`<li class="reveal" style="--i:${e}"><span class="how-n">${e}</span><h3>${T(`landing.how.${e}.t`)}</h3><p>${T(`landing.how.${e}.d`)}</p></li>`).join(``)}</ol>
    </section>

    <section class="lsec lwrap" id="pricing" aria-labelledby="priceTitle">
      <div class="lsec-head reveal"><h2 id="priceTitle">${T(`landing.pricing.title`)}</h2><p class="lead">${T(`landing.pricing.sub`)}</p></div>
      <div class="plans">
        <article class="plan panel reveal">
          <h3>${T(`landing.free.name`)}</h3>
          <p class="price-line"><span class="price">${T(`landing.free.price`)}</span></p>
          <ul>${[1,2,3,4,5].map(e=>`<li>${E}${T(`landing.free.${e}`)}</li>`).join(``)}</ul>
          <div class="controls"><a class="btn big" href="./app.html">${T(`landing.free.cta`)}</a></div>
        </article>
        <article class="plan plan-pro panel reveal" style="--i:1">
          <span class="plan-badge">${T(`landing.pro.badge`)}</span>
          <h3>${T(`landing.pro.name`)}</h3>
          <p class="price-line">${A()}</p>
          <p class="note">${T(`landing.pro.all`)}</p>
          <ul>${[1,2,3,4,5].map(e=>`<li>${E}${T(`landing.pro.${e}`)}</li>`).join(``)}</ul>
          <div class="controls">${k()}</div>
        </article>
      </div>
    </section>

    <section class="lsec lwrap" id="faq" aria-labelledby="faqTitle">
      <div class="lsec-head reveal"><h2 id="faqTitle">${T(`landing.faq.title`)}</h2></div>
      <div class="faq">${[`account`,`offline`,`french`,`mac`,`data`].map(e=>`<details class="panel reveal"><summary>${T(`landing.faq.${e}.q`)}</summary><p>${T(`landing.faq.${e}.a`)}</p></details>`).join(``)}</div>
    </section>
  </main>

  <footer class="lfoot">
    <div class="lwrap lfoot-in">
      <a class="logo small" href="#top">XL <span class="cell">Sprint</span></a>
      <nav aria-label="${T(`landing.footer.app`)}"><a href="./app.html">${T(`landing.footer.app`)}</a>${h.contactEmail?`<a href="mailto:${d(h.contactEmail)}">${T(`landing.footer.contact`)}</a>`:``}</nav>
      <p class="note">${T(`landing.footer.excel`)}<br>${T(`landing.footer.fonts`)}</p>
    </div>
  </footer>`}function M(){document.title=o(`landing.meta.title`),document.querySelector(`meta[name="description"]`)?.setAttribute(`content`,o(`landing.meta.description`));let e=document.getElementById(`landing`);e.innerHTML=j(),S(e.querySelector(`.hero-card`)),C(e.querySelector(`#demo`)),e.querySelectorAll(`[data-lang]`).forEach(e=>e.addEventListener(`click`,()=>{let t=e.dataset.lang;c(t),n(w,t),M()})),e.querySelectorAll(`[data-excel]`).forEach(t=>t.addEventListener(`click`,()=>{y(t.dataset.excel),e.querySelectorAll(`[data-excel]`).forEach(e=>e.setAttribute(`aria-pressed`,String(e===t))),e.querySelector(`#demo`)?.dispatchEvent(new Event(`demo:reset`)),S(e.querySelector(`.hero-card`))}));let t=e.querySelectorAll(`.reveal`);if(!(`IntersectionObserver`in window)||window.matchMedia(`(prefers-reduced-motion: reduce)`).matches)t.forEach(e=>e.classList.add(`in`));else{let e=new IntersectionObserver(t=>t.forEach(t=>{t.isIntersecting&&(t.target.classList.add(`in`),e.unobserve(t.target))}),{rootMargin:`0px 0px -8% 0px`});t.forEach(t=>e.observe(t))}}window.addEventListener(`scroll`,()=>document.getElementById(`lnav`)?.classList.toggle(`scrolled`,window.scrollY>8),{passive:!0});var N=l(w),P=a();P&&Object.assign(i.profile,P);var F=N===`fr`||N===`en`?N:P?.uiLang??(navigator.language.startsWith(`fr`)?`fr`:`en`);c(F),P||y(F===`fr`?`fr`:`en`),M();