/* Rarytu site renderer: content JSON → page HTML.
   Pure string functions, no DOM. Works in the browser (admin panel: preview and publish)
   and in Node (tools/test-render.js). Output must match the hand-made pages exactly
   for the current content (see docs/cms/SKILL.md). */
(function (root) {
  "use strict";

  // ---------- text helpers ----------
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  // attribute / plain text: escape everything
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ESC[c]);
  // Content text may contain a few inline tags; everything else is escaped.
  const INLINE = /<(br|br class="[\w -]+"|span class="nw"|\/span|b|\/b|i|\/i|\/a|a href="[^"<>]*")>/g;
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
    burger: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.4"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.4"/></svg>',
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
    const utility = `<div class="utility"><a class="u-link" href="${href(pagePath(lang, "approach"))}#contact" data-contact>${esc(ui.contact)}</a>
      <a class="u-link" href="${href(site.cv[lang])}" download data-cv>${esc(ui.downloadCV)}</a></div>`;
    const enPath = lang === "en" ? path : ctx.altPath, ruPath = lang === "ru" ? path : ctx.altPath;
    const title = esc(ctx.title), desc = esc(ctx.description);
    return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#F6F6F6">
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
<link rel="stylesheet" href="${href("assets/styles.css")}">
<script>document.documentElement.classList.add("js");try{history.scrollRestoration="manual"}catch(e){}</script>
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
<script src="${href("assets/main.js")}"></script>
</body>
</html>
`;
  }

  // ---------- shared footer (contacts) ----------
  const NEXT = { work: "about", about: "approach", approach: "work" };
  /* opts: { compact: bool (Approach mobile footer), title } */
  function footer(ctx, opts = {}) {
    const { site, lang, path } = ctx, r = up(path), ui = site.ui[lang], next = NEXT[ctx.nav];
    const cells = site.contacts.map((c) =>
      `    <a class="fcell" href="${esc(c.url)}"${c.copy ? ` data-copy="${esc(c.copy)}"` : ' target="_blank" rel="noopener"'}><span class="fcell__label">${esc(c.label)}</span><span class="fcell__arrow" aria-hidden="true">↗</span></a>`).join("\n");
    return `<footer class="footer ${opts.compact ? "footer--compact" : ""}" id="${opts.compact ? "contact-m" : "contact"}" data-contact-target>
  <h2 class="footer__title">${rich(opts.title != null ? opts.title : ui.footerTitle)}</h2>
  <div class="frow">
    <span class="frow__copy">${esc(site.copyright)}</span>
${cells}
  </div>
  <div class="fbottom"><span class="frow__copy">${esc(site.copyright)}</span><a class="fnext arrow-link only-t" href="${r + pagePath(lang, next)}"><span>${esc(ui.nav[next])}</span> <span class="arr arr--right" aria-hidden="true">→</span></a><a class="back-top arrow-link no-t" href="#top" data-top><span>${esc(ui.backToTop)}</span> <span class="arr arr--up" aria-hidden="true">↑</span></a></div>
</footer>`;
  }

  // ---------- media ----------
  const imgSet = (r, base, w1, w2) => `src="${r}${base}-sm.webp" srcset="${r}${base}-sm.webp ${w1}w, ${r}${base}.webp ${w2}w"`;

  // ---------- case page ----------
  function caseMain(ctx, c, order, cases) {
    const { site, lang, path } = ctx, r = up(path), ui = site.ui[lang];
    const i = order.indexOf(c.slug), n = order.length;
    const prev = cases[order[(i - 1 + n) % n]], next = cases[order[(i + 1) % n]];
    const title = tr(c.title, lang), h = c.hero || {};
    const heroImg = h.image ? `<img class="" ${imgSet(r, h.image, 960, 1920)} sizes="(max-width: 743px) 320px, (max-width: 1279px) 100vw, 72vw" alt="${esc(title)}" fetchpriority="high" decoding="async">` : "";
    const heroVid = h.video ? `<video class="chero__v" src="${r}${h.video}" poster="${r}${h.poster}" muted loop playsinline autoplay preload="auto"></video>` : "";
    const gallery = (c.gallery || []).map((g, k) => g.video
      ? `<div class="gitem gitem--video" style="--ar:${g.ar}"><video class="gitem__v" src="${r}${g.video}" poster="${r}${g.poster}" muted loop playsinline autoplay preload="metadata"></video></div>`
      : `<div class="gitem" style="--ar:${g.ar}"><img class="" ${imgSet(r, g.image, 960, 1920)} sizes="(max-width: 743px) 320px, (max-width: 1279px) 100vw, 1370px" alt="" ${k < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`).join("");
    const paras = (pick(c.overview.text, lang) || []).map((p) => `<p>${rich(p)}</p>`).join("");
    return `<article class="case">
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
  <div class="case__top"><a class="back-top arrow-link" href="#top" data-top><span>${esc(ui.backToTop)}</span> <span class="arr arr--up" aria-hidden="true">↑</span></a></div>
</article>`;
  }

  // ---------- shared bits ----------
  const ICO_NE = '<svg class="ico-ne" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 8.5 8.5 1.5M3 1.5h5.5V7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  // paragraph that may have desktop and mobile+tablet versions
  function vp(v, lang, cls) {
    const x = pick(v, lang), c = cls ? cls + " " : "";
    if (x && typeof x === "object") return `<p class="${c}v-d">${rich(x.d)}</p><p class="${c}v-mt">${rich(x.mt)}</p>`;
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
        <h3 class="card__title"><span class="card__arr" aria-hidden="true">→</span>${rich(tr(c.title, lang))}</h3>
      </div>
    </a>`; }).join("\n");
    const circles = w.callouts.map((c) => `  <div class="circle">
    <a class="circle__hit" href="${r + pagePath(lang, c.target)}" tabindex="-1" aria-hidden="true"></a>
    <h3>${rich(tr(c.title, lang))}</h3>
    ${vp(c.text, lang)}
    <a class="circle__link" href="${r + pagePath(lang, c.target)}">${rich(tr(c.link, lang))} ${ICO_NE}</a>
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
${cards}
  </div>
</section>

<section class="callouts">
${circles}
  <div class="circle circle--ring" aria-hidden="true">
    ${pick(w.ring.svg, lang)}
    <p class="ring__center">${rich(tr(w.ring.center, lang))}</p>
  </div>
</section>

${footer(ctx)}`;
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
      return "<div>" + ["d", "mt"].map((k) => `<div class="v-${k}"><h2>${rich(c[k].heading)}</h2>${c[k].text.map((x) => `<p>${rich(x)}</p>`).join("")}</div>`).join("") + "</div>"; }).join("");
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

${footer(ctx)}`;
  }

  // ---------- pages ----------
  /* p: { lang, key: "work"|"about"|"approach"|"case", slug? , path }
     data: { site, read(file) → parsed JSON }  (read is sync in Node; the panel passes a cache) */
  function renderPage(p, data) {
    const { site } = data, lang = p.lang, other = lang === "en" ? "ru" : "en";
    const work = data.read("content/pages/work.json");
    const ctx = { site, lang, path: p.path, altPath: p.path.replace(/^(en|ru)\//, other + "/") };
    if (p.key === "case") {
      const cases = {}; for (const s of work.projects) cases[s] = data.read(`content/cases/${s}.json`);
      const c = cases[p.slug] || data.read(`content/cases/${p.slug}.json`);
      Object.assign(ctx, { nav: "work", bodyClass: "page-case", title: `${tr(c.title, lang)} · ${site.name}`,
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
    throw new Error("page type not rendered yet: " + p.key);
  }

  const api = { renderPage, aboutMain, caseMain, workMain, vp, esc, rich, pick, variant, tr, up, pagePath, casePath, shell, footer, SVG };
  root.RarytuRender = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
