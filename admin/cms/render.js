/* Rarytu site renderer: content JSON → page HTML.
   Pure string functions, no DOM. Works in the browser (admin panel: preview and publish)
   and in Node (tools/test-render.js). Output must match the hand-made pages exactly
   for the current content (see docs/cms/SKILL.md). */
(function (root) {
  "use strict";

  // ---------- text helpers ----------
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  // attribute / plain text: escape everything
  // Security policy for every page: scripts and files only from the site itself (plus the one inline line below, by its hash),
  // no plugins, no forms, no foreign <base>. If you change HEAD_JS, update HEAD_JS_HASH (tools/build.js checks it).
  const HEAD_JS = 'document.documentElement.classList.add("js");try{history.scrollRestoration="manual"}catch(e){}';
  const HEAD_JS_HASH = "sha256-y+EidEHu7nVIDMKFpc2eAf0ijblpxvdxOZVds/wgcqs=";
  // Visit counter: Cloudflare Web Analytics (no cookies, nothing stored on the visitor's device, so no consent banner).
  // Its script is served from the site itself (assets/vendor/cf-beacon.min.js) so only the small report goes to Cloudflare.
  const CF_REPORT = "https://cloudflareinsights.com";
  const cfToken = (site) => { const t = site && site.analytics && site.analytics.cloudflare; return /^[0-9a-f]{32}$/.test(t || "") ? t : ""; };
  const csp = (site) => `default-src 'self'; script-src 'self' '${HEAD_JS_HASH}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; ` +
    `media-src 'self' blob:; font-src 'self'; connect-src 'self'${cfToken(site) ? " " + CF_REPORT : ""}; object-src 'none'; base-uri 'self'; form-action 'none'; frame-src 'none'`;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ESC[c]);
  // plain text of a rich string (for <title>, alt): line breaks become spaces, other tags go
  const plain = (s) => String(s == null ? "" : s).replace(/<br\b[^>]*>/gi, " ").replace(/<[^>]+>/g, "").replace(/ {2,}/g, " ");
  // Content text may contain a few inline tags; everything else is escaped.
  const INLINE = /<(br|br class="[\w -]+"|span class="[\w -]+"|\/span|b|\/b|i|\/i|\/a|a href="[^"<>]*")>/g;
  function rich(s) {
    const keep = [];
    const marked = String(s == null ? "" : s).replace(INLINE, (m) => "\u0000" + (keep.push(m) - 1) + "\u0000");
    return marked.replace(/[&<>]/g, (c) => ESC[c]).replace(/\u0000(\d+)\u0000/g, (m, i) => keep[+i]);
  }
  // A text value is either { en, ru } or a plain string (same in both languages).
  // A language value is either a string or { d, mt } when desktop and mobile+tablet copy differ.
  const pick = (v, lang) => (v && typeof v === "object" && !Array.isArray(v) && (lang in v)) ? v[lang] : v;
  const variant = (v, which) => (v && typeof v === "object") ? (v[which] != null ? v[which] : v.d) : v;
  const tr = (v, lang) => variant(pick(v, lang), "d");

  // ---------- paths ----------
  // page paths are like "en/about/index.html"; links are relative to the page, as on the hand-made site
  const up = (path) => "../".repeat(path.split("/").length - 1);
  const PAGES = { work: "index.html", about: "about/index.html", approach: "approach/index.html" };
  const pagePath = (lang, key) => `${lang}/${PAGES[key]}`;
  const casePath = (lang, slug) => `${lang}/work/${slug}/index.html`;

  const SVG = {
    chev: '<svg class="chev" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5 6 6.5l5-5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    burger: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 5h22M1 12h22M1 19h22" stroke="currentColor" stroke-width="1.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.5 3.5 17 17M20.5 3.5l-17 17" stroke="currentColor" stroke-width="1.3"/></svg>',
  };

  // ---------- shell ----------
  /* ctx: { site, lang, path, altPath, nav: "work"|"about"|"approach", bodyClass,
            title, description, tagline, menuTagline } */
  function shell(ctx, main) {
    const { site, lang, path } = ctx, r = up(path), ui = site.ui[lang];
    const other = lang === "en" ? "ru" : "en";
    const href = (p) => r + p;
    const brand = `<a class="brand" href="${href(pagePath(lang, "work"))}">${esc(site.name)}</a>`;
    const navItems = ["work", "about", "approach"].map((k) =>
      `<li><a href="${href(pagePath(lang, k))}"${k === ctx.nav ? ' aria-current="page"' : ""}><span>${esc(ui.nav[k])}</span><i class="dot" aria-hidden="true"></i></a></li>`).join("");
    const langNav = `<nav class="lang" aria-label="Language / Язык">` + ["en", "ru"].map((l) => l === lang
      ? `<a aria-current="true" lang="${l}">${l.toUpperCase()}</a>`
      : `<a href="${href(ctx.altPath)}" hreflang="${l}" lang="${l}" data-lang-switch>${l.toUpperCase()}</a>`).join('<span aria-hidden="true">|</span>') + `</nav>`;
    // project pages have no last screen: "Contact" opens the one on Approach
    const contactHref = ctx.bodyClass === "page-case" ? href(pagePath(lang, "approach")) + "#contact" : "#contact";
    const utility = `<div class="utility"><a class="u-link" href="${contactHref}" data-contact>${esc(ui.contact)}</a>
      <a class="u-link" href="${href(site.cv[lang])}" download data-cv>${esc(ui.downloadCV)}</a></div>`;
    const enPath = lang === "en" ? path : ctx.altPath, ruPath = lang === "ru" ? path : ctx.altPath;
    const title = esc(ctx.title), desc = esc(ctx.description);
    return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#F6F6F6">
<meta http-equiv="Content-Security-Policy" content="${csp(site)}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${href(site.shareImage)}">
<link rel="icon" href="${href("assets/favicon.svg")}" type="image/svg+xml">
<link rel="alternate" hreflang="en" href="${href(enPath)}">
<link rel="alternate" hreflang="ru" href="${href(ruPath)}">
<link rel="preload" href="${href("assets/fonts/inter-tight-latin-500-normal.woff2")}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${href("assets/fonts.css")}">
<link rel="stylesheet" href="${href("assets/styles.css")}${site.assetsVersion ? "?v=" + site.assetsVersion : ""}">
<script>${HEAD_JS}</script>
</head>
<body id="top" class="${ctx.bodyClass}" data-copied="${esc(ui.copied)}">
<div class="skel" aria-hidden="true"></div>
<a class="skip" href="#main">${esc(ui.skip)}</a>

<aside class="sidebar" aria-label="Site">
  <div class="sidebar__top">
    <div class="sidebar__row">
      ${brand}
      ${langNav}
    </div>
    <p class="sidebar__tagline">${rich(ctx.tagline)}</p>
  </div>
  <div class="sidebar__bottom">
    <nav aria-label="Main"><ul class="nav">${navItems}</ul></nav>
    ${utility}
  </div>
</aside>

<header class="tbar">
  ${brand}
  <div class="tbar__pages">
    <button class="tbar__current" aria-expanded="false" aria-controls="tbar-menu">${esc(ui.nav[ctx.nav])}${SVG.chev}</button>
    <nav id="tbar-menu" class="tbar__menu" aria-label="Main" hidden><ul class="tnav">${navItems}</ul></nav>
  </div>
  <div class="tbar__right">${utility}${langNav}</div>
</header>

<header class="mbar">
  <div class="mbar__row">
    ${brand}
    <button class="mbar__btn" aria-expanded="false" aria-controls="mmenu" aria-label="${esc(ui.menu)}">${SVG.burger}</button>
  </div>
  <div id="mmenu" class="mmenu" hidden>
    <div class="mbar__row">
      ${brand}
      <button class="mbar__btn" data-close aria-label="${esc(ui.closeMenu)}">${SVG.close}</button>
    </div>
    <p class="mmenu__tagline">${rich(ctx.menuTagline != null ? ctx.menuTagline : ctx.tagline)}</p>
    <nav aria-label="Main"><ul class="nav nav--m">${navItems}</ul></nav>
    <div class="mmenu__foot">${utility}${langNav}</div>
  </div>
</header>
<main class="main" id="main" tabindex="-1">
${main}
</main>
<script src="${href("assets/spheres.js")}${site.assetsVersion ? "?v=" + site.assetsVersion : ""}"></script>
<script src="${href("assets/main.js")}${site.assetsVersion ? "?v=" + site.assetsVersion : ""}"></script>
${cfToken(site) ? `<script defer src="${href("assets/vendor/cf-beacon.min.js")}" data-cf-beacon='{"token": "${cfToken(site)}"}'></script>\n` : ""}</body>
</html>
`;
  }

  // ---------- end of every page: the last screen and the footer ----------
  const NEXT = { work: "about", about: "approach", approach: "work" };   // the round Work → About → Approach → Work; project pages end at prev/next
  // the line arrow from the layout (19×14), drawn as a stroke so its weight always matches the 2px progress line
  const ARROW = '<svg class="sfoot__arrow" viewBox="0 0 19 14" width="19" height="14" aria-hidden="true"><path d="M0 6.98h17.4M11.17.7l6.96 6.28-6.96 6.27" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  /* The last screen: exactly one screen high, "Let's work together" and the round contact buttons a little above
     the middle, the spheres below (assets/spheres.js, run by main.js). Same on every page and device. */
  function lastScreen(ctx) {
    const { site, lang } = ctx;
    const btns = site.contacts.map((c) =>
      `    <a class="sbtn" href="${esc(c.url)}" aria-label="${esc(tr(c.iconLabel || c.label, lang))}"${c.copy ? ` data-copy="${esc(c.copy)}"` : ' target="_blank" rel="noopener"'}>${c.icon || DEFAULT_ICON}<span class="sbtn__label">${esc(c.label)}</span></a>`).join("\n");
    return `<section class="dfoot" id="contact" data-contact-target aria-label="${esc(site.ui[lang].contact)}">
  <canvas class="dfoot__canvas" aria-hidden="true"></canvas>
  <div class="dfoot__block">
    <h2 class="dfoot__title">${rich(ctx.contactTitle || "")}</h2>
    <div class="dfoot__btns">
${btns}
    </div>
  </div>
</section>`;
  }
  /* The footer: a tall brand colour block with ©year and "back to top"; on Work and About also the way on to the
     next page (click it, or keep scrolling at the end of the page until the line fills up). */
  function siteFooter(ctx, next) {
    const { site, lang, path } = ctx, r = up(path), ui = site.ui[lang];
    const go = next ? `
  <a class="sfoot__next" href="${r + pagePath(lang, next)}" data-next>
    <span class="sfoot__name">${esc(ui.nav[next])}</span>
    <span class="sfoot__bar"><span class="sfoot__track"><span class="sfoot__fill"></span></span>${ARROW}</span>
    <span class="sfoot__hint"><span class="sfoot__hint-m">${esc(ui.nextPage || "")}</span><span class="sfoot__hint-d">${esc(ui.keepScrolling || "")}</span></span>
  </a>` : "";
    return `<footer class="sfoot">
  <div class="sfoot__top"><span class="sfoot__copy">${copyright(site)}</span><a class="sfoot__up" href="#top" data-top aria-label="${esc(ui.backToTop)}">${ARROW.replace('class="sfoot__arrow"', 'class="sfoot__uparrow"')}</a></div>${go}
</footer>`;
  }
  const pageEnd = (ctx, next) => lastScreen(ctx) + "\n" + siteFooter(ctx, next);

  // ---------- media ----------
  /* A still on top of every video until it really plays: iOS draws its own play button on a video that can't
     autoplay (Low Power Mode), so the video stays hidden until then (main.js, CSS .vposter). */
  const poster = (r, p) => p ? `<img class="vposter" src="${r}${p}" alt="" aria-hidden="true" decoding="async">` : "";
  const imgSet = (r, base, w1, w2) => `src="${r}${base}-sm.webp" srcset="${r}${base}-sm.webp ${w1}w, ${r}${base}.webp ${w2}w"`;

  // ---------- case page ----------
  function caseMain(ctx, c, order, cases) {
    const { site, lang, path } = ctx, r = up(path), ui = site.ui[lang];
    let i = order.indexOf(c.slug), n = order.length;
    if (i < 0) i = -1;   // a hidden project (preview only): link to the first and last visible ones
    const prev = cases[order[((i < 0 ? 0 : i) - 1 + n) % n]] || c, next = cases[order[(i + 1) % n]] || c;
    const title = tr(c.title, lang), h = c.hero || {}, titleText = plain(title);
    const heroImg = h.image ? `<img class="" ${imgSet(r, h.image, 960, 1920)} sizes="(max-width: 743px) 320px, (max-width: 1279px) 100vw, 72vw" alt="${esc(titleText)}" fetchpriority="high" decoding="async">` : "";
    const heroVid = h.video ? `<video class="chero__v" src="${r}${h.video}" poster="${r}${h.poster}" muted loop playsinline disablepictureinpicture disableremoteplayback controlslist="nodownload nofullscreen noremoteplayback" autoplay preload="auto"></video>${poster(r, h.poster)}` : "";
    const gallery = (c.gallery || []).map((g, k) => g.video
      ? `<div class="gitem gitem--video" style="--ar:${g.ar}"><video class="gitem__v" src="${r}${g.video}" poster="${r}${g.poster}" muted loop playsinline disablepictureinpicture disableremoteplayback controlslist="nodownload nofullscreen noremoteplayback" autoplay preload="metadata"></video>${poster(r, g.poster)}</div>`
      : `<div class="gitem" style="--ar:${g.ar}"><img class="" ${imgSet(r, g.image, 960, 1920)} sizes="(max-width: 743px) 320px, (max-width: 1279px) 100vw, 1370px" alt="" ${k < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`).join("");
    const paras = (pick(c.overview.text, lang) || []).map((p) => `<p>${rich(p)}</p>`).join("");
    return `<article class="case" data-slug="${esc(c.slug)}">
  <header class="chead">
    <a class="chead__back arrow-link" href="${r + pagePath(lang, "work")}"><span class="arr arr--left" aria-hidden="true">←</span> <span>${esc(ui.allWork)}</span></a>
    <h1 class="chead__title">${rich(title)}</h1>
    <p class="tags">${rich(tr(c.tags, lang))}</p>
  </header>
  <div class="chero" style="--bg:${esc(h.bg || "#f6f6f6")}">
      ${heroImg}
      ${heroVid}
    </div>
  <section class="cover-text">
    <h2>${rich(tr(c.overview.heading, lang))}</h2>
    <div>${paras}</div>
  </section>
  <div class="gallery">${gallery}</div>
  <nav class="pnav" aria-label="${esc(ui.moreProjects)}">
    <a class="arrow-link" href="${r + casePath(lang, prev.slug)}" rel="prev"><span class="arr arr--left" aria-hidden="true">←</span> <span>${rich(tr(prev.name, lang))}</span></a>
    <a class="arrow-link" href="${r + casePath(lang, next.slug)}" rel="next"><span>${rich(tr(next.name, lang))}</span> <span class="arr arr--right" aria-hidden="true">→</span></a>
  </nav>
</article>`;
  }

  // ---------- shared bits ----------
  const ICO_NE = '<svg class="ico-ne" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 8.5 8.5 1.5M3 1.5h5.5V7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  // paragraph that may have desktop and mobile+tablet versions
  function vp(v, lang, cls) {
    const x = pick(v, lang), c = cls ? " " + cls : "";
    if (x && typeof x === "object") return `<p class="v-d${c}">${rich(x.d)}</p><p class="v-mt${c}">${rich(x.mt)}</p>`;
    return `<p${cls ? ` class="${cls}"` : ""}>${rich(x)}</p>`;
  }

  // ---------- Work (home) page ----------
  function workMain(ctx, w, cases) {
    const { lang, path } = ctx, r = up(path);
    const head = pick(w.heading, lang);
    const cards = w.projects.map((slug, k) => {
      const c = cases[slug];
      return `    <a class="card" href="${r + casePath(lang, slug)}">
      <div class="card__cover" style="--bg:${esc(c.hero.bg)}">
        <img ${imgSet(r, c.cover, 678, 1356)} sizes="(max-width: 743px) 100vw, (max-width: 1279px) 50vw, 36vw" width="678" height="420" alt="" ${k === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
      </div>
      <div class="card__meta">
        <p class="tags">${rich(tr(c.tags, lang))}</p>
        <h3 class="card__title"><span class="card__arr" aria-hidden="true">→</span>${rich(tr(c.title, lang))}<span class="card__arr-t" aria-hidden="true">\u00a0\u00a0→</span></h3>
      </div>
    </a>`; }).join("\n");
    const circles = w.callouts.map((c) => `  <div class="circle">
    <a class="circle__hit" href="${r + pagePath(lang, c.target)}" tabindex="-1" aria-hidden="true"></a>
    <h3>${rich(tr(c.title, lang))}</h3>
    ${vp(c.text, lang, "circle__text")}
    <a class="circle__link" href="${r + pagePath(lang, c.target)}">${rich(tr(c.link, lang))} ${ICO_NE}</a>
  </div>`).join("\n");
    return `<section class="hero">
  ${pick(w.dots, lang) || ""}
  <div class="hero__text">
    <h1 class="display"><span class="only-d">${rich(variant(head, "d"))}</span><span class="only-mt">${rich(variant(head, "mt"))}</span></h1>
    <p class="hero__lede">${rich(tr(w.lede, lang))}</p>
  </div>
</section>

<section class="section">
  <div class="work-head">
    <h2 class="display">${rich(tr(w.workTitle, lang))}</h2>
    <hr class="rule">
    ${vp(w.workIntro, lang)}
  </div>
  <div class="grid">
${cards}</div>
</section>

<section class="callouts">
${circles}
  <div class="circle circle--ring" aria-hidden="true">
    ${pick(w.ring.svg, lang)}
    <p class="ring__center">${rich(tr(w.ring.center, lang))}</p>
  </div>
</section>

${pageEnd(ctx, NEXT[ctx.nav])}`;
  }

  // ---------- About page ----------
  const secTitle = (v, lang) => `<h2 class="sec-title">{ ${rich(tr(v, lang))} }</h2>`;
  const pad2 = (n) => String(n).padStart(2, "0");
  function xrows(items, lang, r) {
    return items.map((it) => {
      const logo = pick(it.logo, lang), company = tr(it.company, lang);
      return `      <li class="xrow">
        <p class="xrow__date">${rich(tr(it.date, lang))}</p>
        <div class="xrow__role">${logo && logo.src ? `<img class="xrow__logo" src="${r}${esc(logo.src)}" width="${esc(logo.width)}" height="${esc(logo.height)}" alt="" loading="lazy">` : ""}<h3>${rich(tr(it.role, lang))}</h3>${company ? `<p>${rich(company)}</p>` : ""}</div>
        <div class="xrow__text">${(pick(it.text, lang) || []).map((x) => `<p>${rich(x)}</p>`).join("")}</div>
      </li>`; }).join("\n");
  }
  function aboutMain(ctx, a) {
    const { site, lang, path } = ctx, r = up(path), ui = site.ui[lang];
    const bio = a.bio.map((col) => { const c = pick(col, lang);
      // optional phone-only copy (m): then the mobile+tablet copy shows on tablets only
      const hasM = c.m && (c.m.text || []).some((x) => x && String(x).trim());
      const parts = hasM ? [["d", "d"], ["t", "mt"], ["m", "m"]] : [["d", "d"], ["mt", "mt"]];
      return "<div>" + parts.map(([cls, k]) => `<div class="v-${cls}"><h2>${rich(c[k].heading || c.mt.heading)}</h2>${c[k].text.filter((x) => x && String(x).trim()).map((x) => `<p>${rich(x)}</p>`).join("")}</div>`).join("") + "</div>"; }).join("");
    const photos = a.photos.items.map((ph) => `
      <figure class="photo">
        <img class="" ${imgSet(r, ph.image, 960, 1920)} sizes="(max-width: 743px) 80vw, (max-width: 1279px) 45vw, 22vw" alt="" loading="lazy" decoding="async">
        <figcaption>${rich(tr(ph.caption, lang))}</figcaption>
      </figure>`).join("");
    const chips = a.tools.items.map((c) => `<li class="chip">${c.icon || ""}<span>${rich(tr(c.label, lang))}</span></li>`).join("");
    return `<section class="ahero">
  <h1 class="ahero__title">${rich(tr(a.heading, lang))}</h1>
  <div class="ahero__bio">
    ${bio}
  </div>
</section>

<section class="photos">
  ${pick(a.photos.dots, lang) || ""}
  <div class="photos__grid" data-carousel>${photos}</div>
  <div class="swipe" aria-hidden="true"><span class="swipe__n">01 / ${pad2(a.photos.items.length)}</span><span class="swipe__track"><i></i></span><span>${rich(tr(a.photos.swipe, lang))}</span></div>
</section>

<section class="xlist">
  <div class="xlist__head">${secTitle(a.experience.title, lang)}<a class="u-link" href="${r}${site.cv[lang]}" download data-cv>${esc(ui.downloadCV)}</a></div>
  <ul>
${xrows(a.experience.items, lang, r)}</ul>
</section>

<section class="xlist xlist--edu">
  <div class="xlist__head">${secTitle(a.education.title, lang)}</div>
  <ul>
${xrows(a.education.items, lang, r)}</ul>
</section>

<section class="tools">
  ${secTitle(a.tools.title, lang)}
  <ul class="chips">${chips}</ul>
</section>

${pageEnd(ctx, NEXT[ctx.nav])}`;
  }

  // ---------- Approach page ----------
  const isVar = (x) => x && typeof x === "object" && !Array.isArray(x);
  const paras = (list) => (list || []).map((x) => `<p>${rich(x)}</p>`).join("");
  function approachMain(ctx, a) {
    const { site, lang, path } = ctx, r = up(path), ui = site.ui[lang];
    const steps = a.steps.map((st, k) => `    <li class="xrow"><p class="xrow__n">{ ${pad2(k + 1)} }</p><div class="xrow__role"><h3>${rich(tr(st.title, lang))}</h3></div>${vp(st.text, lang, "xrow__text")}</li>`).join("\n");
    const items = a.principles.items.map((it) => {
      const t = pick(it.title, lang), x = pick(it.text, lang);
      if (isVar(t) || isVar(x)) return `    <li class="pcircle"><h3 class="v-d">${rich(variant(t, "d"))}</h3><p class="v-d">${rich(variant(x, "d"))}</p><h3 class="v-mt">${rich(variant(t, "mt"))}</h3><p class="v-mt">${rich(variant(x, "mt"))}</p></li>`;
      return `    <li class="pcircle"><h3>${rich(t)}</h3><p>${rich(x)}</p></li>`; }).join("\n");
    const tt = pick(a.tools.text, lang);
    const toolsText = isVar(tt) ? `<div class="v-d">${paras(tt.d)}</div><div class="v-mt">${paras(tt.mt)}</div>` : `<div>${paras(tt)}</div>`;
    const media = (m) => `<video class="media" src="${r}${m.video}" poster="${r}${m.poster}" muted loop playsinline disablepictureinpicture disableremoteplayback controlslist="nodownload nofullscreen noremoteplayback" autoplay preload="metadata" width="${m.width}" height="${m.height}"></video>`;
    const vbox = (m) => `<span class="vbox">${media(m)}${poster(r, m.poster)}</span>`;
    return `<section class="intro">
  <div class="intro__head">
    <h1 class="display">${rich(tr(a.heading, lang))}</h1>
    ${vp(a.intro, lang)}
  </div>
  <ol class="steps">
${steps}
  </ol>
</section>

<section class="wip">
  ${pick(a.wip.dots, lang) || ""}
  <figure class="wip__fig">
    ${vbox(a.wip)}
    <figcaption>${rich(tr(a.wip.caption, lang))}</figcaption>
  </figure>
</section>

<section class="principles">
  <h2 class="display">${headingVar(a.principles.title, lang)}</h2>
  <ul class="pgrid" data-carousel>
${items}
  </ul>
  <div class="swipe" aria-hidden="true"><span class="swipe__n">01 / ${pad2(a.principles.items.length)}</span><span class="swipe__track"><i></i></span><span>${rich(tr(a.principles.swipe, lang))}</span></div>
</section>

<section class="split">
  <div class="split__media">${vbox(a.tools)}</div>
  <div class="split__text">
    <h2>${rich(tr(a.tools.title, lang))}</h2>
    ${toolsText}
  </div>
</section>

${pageEnd(ctx, NEXT[ctx.nav])}`;
  }
  // icon for a contact that has none: a plain circle with an arrow, same size as the others
  const DEFAULT_ICON = '<svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true"><circle cx="26" cy="26" r="26" fill="currentColor"/><path d="M20 32 32 20M23 20h9v9" fill="none" stroke="#fff" stroke-width="2"/></svg>';

  // Russian typography: a word with a hyphen (веб-дизайн, CRM-коммуникаций) never breaks at the hyphen.
  // Applied to the text of <body> on Russian pages, outside tags, scripts and SVG.
  const HYPH = /(^|[^\p{L}\p{N}-])([\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)+)(?=$|[^\p{L}\p{N}-])/gu;
  // Russian typography: a one- or two-letter word (в, с, и, к, на, по, не…) never stays alone at the end of a line
  const SHORT = /(?<=^|[\s\u00a0(«"])([А-Яа-яЁё]{1,2}) (?=[^\s])/g;
  // (a very long word like "Инфлюенс-маркетинг" may still break at its hyphen: better than running off a phone screen)
  function keepHyphens(html) {
    const at = html.indexOf("<body"); if (at < 0) return html;
    let skip = 0, nw = 0;
    const body = html.slice(at).split(/(<[^>]+>)/).map((part) => {
      if (part.startsWith("<")) {
        if (/^<(script|svg|style)\b/i.test(part)) skip++; else if (/^<\/(script|svg|style)>/i.test(part)) skip = Math.max(0, skip - 1);
        if (/^<span class="nw">/.test(part)) nw++; else if (nw && part === "</span>") nw--;
        return part;
      }
      return skip || nw ? part : part.replace(HYPH, (m, a, w) => w.length > 14 ? m : `${a}<span class="nw">${w}</span>`).replace(SHORT, "$1\u00a0");
    }).join("");
    return html.slice(0, at) + body;
  }
  // heading with a desktop and a mobile+tablet version; when mobile is the start of desktop
  // (e.g. a colon only on desktop), only the extra part is wrapped
  function headingVar(v, lang) {
    const x = pick(v, lang);
    if (!x || typeof x !== "object") return rich(x);
    if (x.d.startsWith(x.mt)) return rich(x.mt) + (x.d.length > x.mt.length ? `<span class="v-d">${rich(x.d.slice(x.mt.length))}</span>` : "");
    return `<span class="v-d">${rich(x.d)}</span><span class="v-mt">${rich(x.mt)}</span>`;
  }

  // "©{year}": the year is filled in when the page is built and kept current in the browser by main.js ([data-year])
  const copyright = (site) => esc(site.copyright || "").replace("{year}", `<span data-year>${new Date().getFullYear()}</span>`);

  // No orphans: the last two words of a paragraph stay together, so a paragraph never ends with one word alone on a line.
  // Applies to <p> and <figcaption> with at least four words; text inside tags and SVG is untouched.
  function noOrphans(html) {
    const at = html.indexOf("<body"); if (at < 0) return html;
    const body = html.slice(at).replace(/(<(p|figcaption)\b[^>]*>)([\s\S]*?)(<\/\2>)/g, (m, open, tag, inner, close) => {
      if (/<svg/i.test(inner) || /class="[^"]*(tagline|circle__text)/.test(open)) return m;   // taglines: display type with their own breaks; circle text: Figma lets the last word sit alone
      const parts = inner.split(/(<[^>]+>)/);
      const words = parts.filter((x, i) => i % 2 === 0).join(" ").trim().split(/[ \u00a0]+/).filter(Boolean);
      if (words.length < 4) return m;
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        if (i % 2 === 1) { if (/^<br/.test(parts[i])) break; continue; }   // stop at a line break: the last line is handled
        const t = parts[i].replace(/\s+$/, ""), k = t.lastIndexOf(" ");
        if (k > 0 && /\u00a0/.test(t.slice(k + 1))) break;   // the last words are already held together: don't make the chain longer
        if (k > 0) { parts[i] = t.slice(0, k) + "\u00a0" + t.slice(k + 1) + parts[i].slice(t.length); break; }
        if (t.trim()) {   // the last word starts this text piece: join it with the end of the previous text piece
          for (let j = i - 2; j >= 0; j -= 2) { if (/ $/.test(parts[j])) { parts[j] = parts[j].replace(/ $/, "\u00a0"); break; } if (parts[j].trim()) break; }
          break;
        }
      }
      return open + parts.join("") + close;
    });
    return html.slice(0, at) + body;
  }

  // ---------- pages ----------
  /* p: { lang, key: "work"|"about"|"approach"|"case", slug? , path }
     data: { site, read(file) → parsed JSON }  (read is sync in Node; the panel passes a cache) */
  function renderPage(p, data) {
    const html = renderRaw(p, data);
    return noOrphans(p.lang === "ru" ? keepHyphens(html) : html);
  }
  function renderRaw(p, data) {
    const { site } = data, lang = p.lang, other = lang === "en" ? "ru" : "en";
    const work = data.read("content/pages/work.json");
    const ctx = { site, lang, path: p.path, altPath: p.path.replace(/^(en|ru)\//, other + "/") };
    // the footer title is set on the Approach page and used by the dot field footer on every page
    ctx.contactTitle = tr(data.read("content/pages/approach.json").contactTitle, lang);
    if (p.key === "case") {
      const cases = {}; for (const s of work.projects) cases[s] = data.read(`content/cases/${s}.json`);
      const c = cases[p.slug] || data.read(`content/cases/${p.slug}.json`);
      Object.assign(ctx, { nav: "work", bodyClass: "page-case", title: `${plain(tr(c.title, lang))} · ${site.name}`,
        description: tr(c.description, lang), tagline: tr(work.tagline, lang) });
      return shell(ctx, caseMain(ctx, c, work.projects, cases));
    }
    if (p.key === "work") {
      const cases = {}; for (const s of work.projects) cases[s] = data.read(`content/cases/${s}.json`);
      Object.assign(ctx, { nav: "work", bodyClass: "page-work", title: tr(work.title, lang),
        description: tr(work.description, lang), tagline: tr(work.tagline, lang) });
      return shell(ctx, workMain(ctx, work, cases));
    }
    if (p.key === "about") {
      const a = data.read("content/pages/about.json");
      Object.assign(ctx, { nav: "about", bodyClass: "page-about", title: tr(a.title, lang),
        description: tr(a.description, lang), tagline: tr(a.tagline, lang), menuTagline: tr(a.menuTagline, lang) });
      return shell(ctx, aboutMain(ctx, a));
    }
    if (p.key === "approach") {
      const a = data.read("content/pages/approach.json");
      Object.assign(ctx, { nav: "approach", bodyClass: "page-approach", title: tr(a.title, lang),
        description: tr(a.description, lang), tagline: tr(a.tagline, lang), menuTagline: tr(a.menuTagline, lang) });
      return shell(ctx, approachMain(ctx, a));
    }
    throw new Error("unknown page type: " + p.key);
  }

  // every page of the site, for building and publishing
  function listPages(work) {
    const out = [];
    for (const lang of ["en", "ru"]) {
      for (const key of ["work", "about", "approach"]) out.push({ lang, key, path: pagePath(lang, key) });
      for (const slug of work.projects) out.push({ lang, key: "case", slug, path: casePath(lang, slug) });
    }
    return out;
  }

  const api = { HEAD_JS, HEAD_JS_HASH, noOrphans, keepHyphens, headingVar, listPages, renderPage, approachMain, aboutMain, caseMain, workMain, vp, esc, rich, pick, variant, tr, up, pagePath, casePath, shell, lastScreen, siteFooter, SVG };
  root.RarytuRender = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
