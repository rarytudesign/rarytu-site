(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const isMobile = () => innerWidth < 744;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const BRAND = "rgb(84, 23, 37)";

  /* ---------- Every page opens at the top (unless a language switch or an #anchor asks otherwise) ---------- */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  let keepScroll = null;
  try { keepScroll = sessionStorage.getItem("rarytu-scroll"); sessionStorage.removeItem("rarytu-scroll"); } catch {}
  const toTop = () => { if (!location.hash) scrollTo({ top: 0, left: 0, behavior: "instant" }); };
  if (keepScroll === null) {
    toTop();
    addEventListener("pageshow", toTop);
    addEventListener("load", toTop, { once: true });
  } else {
    const go = () => scrollTo({ top: +keepScroll * (document.documentElement.scrollHeight - innerHeight), behavior: "instant" });
    requestAnimationFrame(go); addEventListener("load", go, { once: true });
  }
  $$("[data-lang-switch]").forEach((a) => a.addEventListener("click", () => {
    try { sessionStorage.setItem("rarytu-scroll", String(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight))); } catch {}
  }));

  /* ---------- Background under a point: is it the brand colour? ---------- */
  function onBrand(el) {
    for (let n = el, i = 0; n && n !== document.documentElement && i < 12; n = n.parentElement, i++) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg === BRAND;
    }
    return false;
  }

  /* ---------- Page loader: brand skeleton, heartbeat cursor, then a circular reveal ---------- */
  const easy = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // Easy Ease
  const L = { phase: "live", t: 0, x: innerWidth / 2, y: innerHeight / 2 };
  let markShown;
  const shown = new Promise((r) => (markShown = r)); // content animations start when the page opens
  try { const p = JSON.parse(sessionStorage.getItem("rarytu-ptr") || "null"); if (p && p.x < innerWidth && p.y < innerHeight) { L.x = p.x; L.y = p.y; } } catch {}
  addEventListener("pagehide", () => { try { sessionStorage.setItem("rarytu-ptr", JSON.stringify({ x: L.x, y: L.y })); } catch {} });
  addEventListener("pointermove", (e) => { L.x = e.clientX; L.y = e.clientY; }, { passive: true });
  const skel = $(".skel");
  if (skel) paintSkeleton(skel);
  if (!skel || reduce) {
    if (skel) { skel.style.transition = "opacity 400ms cubic-bezier(.65,0,.35,1)"; addEventListener("load", () => { skel.style.opacity = "0"; setTimeout(() => skel.remove(), 450); }, { once: true }); }
    markShown();
  } else {
    L.phase = "load";
    const t0 = performance.now();
    const ready = new Promise((r) => { if (document.readyState === "complete") r(); else addEventListener("load", r, { once: true }); setTimeout(r, 4000); });
    ready.then(() => new Promise((r) => setTimeout(r, Math.max(0, 900 - (performance.now() - t0))))).then(() => {
      const SHRINK = finePointer ? 260 : 0, OPEN = 950, GROW = 380;
      const start = performance.now();
      const maxR = () => Math.hypot(Math.max(L.x, innerWidth - L.x), Math.max(L.y, innerHeight - L.y)) + 40;
      let opened = false;
      const frame = (now) => {
        const t = now - start;
        if (t < SHRINK) { L.phase = "shrink"; L.t = easy(t / SHRINK); }
        else if (t < SHRINK + OPEN) {
          if (!opened) { opened = true; markShown(); }
          L.phase = "open"; L.t = easy((t - SHRINK) / OPEN);
          const r = L.t * maxR();
          skel.style.setProperty("--x", L.x + "px"); skel.style.setProperty("--y", L.y + "px"); skel.style.setProperty("--r", r + "px");
          skel.classList.add("is-open");
        } else if (t < SHRINK + OPEN + GROW) { if (skel.isConnected) skel.remove(); L.phase = "grow"; L.t = easy((t - SHRINK - OPEN) / GROW); }
        else { if (skel.isConnected) skel.remove(); L.phase = "live"; L.t = 1; return; }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }

  /* ---------- Skeleton traced from the real page ----------
     The loader is drawn from the layout underneath it: each line of text becomes a bar,
     covers and media become blocks, circles stay circles. So it matches every page and breakpoint. */
  function paintSkeleton(sk) {
    const MEDIA_SEL = ".card__cover, .chero, .gitem, .photo img, .media, .xrow__logo, .sbtn, .chip";
    const RING_SEL = ".circle:not(.circle--ring), .pcircle, .circle--ring";
    const PANEL_SEL = ".sidebar, .tbar, .mbar > .mbar__row, .ahero";
    const RULE_SEL = ".nav, .nav li, .frow, .fcell, .xrow, .steps, .xlist ul, .pnav, .rule";
    const SKIP = ".skel, .skip, .sr-only, [hidden], .dots, .mmenu, .tbar__menu, script, style";
    let clipCache = new WeakMap();
    const invisible = (el) => {
      if (clipCache.has(el)) return clipCache.get(el);
      let v = false;
      if (el.closest(SKIP)) v = true;
      else {
        for (let n = el; n && n !== document.body; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.opacity === "0" || cs.visibility === "hidden") { v = true; break; }
          if (cs.overflow !== "visible" && n.offsetWidth <= 2) { v = true; break; }
        }
      }
      clipCache.set(el, v); return v;
    };
    const build = () => {
      clipCache = new WeakMap();
      document.documentElement.classList.add("skel-measure"); // reveal styles off while measuring (same frame, never painted)
      const vw = innerWidth, vh = innerHeight, out = [];
      const vis = (r) => r.width >= 2 && r.height >= 1 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
      const box = (r, cls, style = "") => vis(r) && out.push(`<i class="${cls}" style="left:${r.left.toFixed(1)}px;top:${r.top.toFixed(1)}px;width:${r.width.toFixed(1)}px;height:${r.height.toFixed(1)}px;${style}"></i>`);
      const shown = (el) => el.getClientRects().length && !invisible(el);
      $$(PANEL_SEL).forEach((el) => shown(el) && box(el.getBoundingClientRect(), "pan"));
      $$(RULE_SEL).forEach((el) => {
        if (!shown(el)) return;
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        const t = parseFloat(cs.borderTopWidth), b = parseFloat(cs.borderBottomWidth), l = parseFloat(cs.borderLeftWidth);
        if (t) box({ left: r.left, top: r.top, width: r.width, height: t, right: r.right, bottom: r.top + t }, "rule");
        if (b) box({ left: r.left, top: r.bottom - b, width: r.width, height: b, right: r.right, bottom: r.bottom }, "rule");
        if (l) box({ left: r.left, top: r.top, width: l, height: r.height, right: r.left + l, bottom: r.bottom }, "rule");
      });
      $$(MEDIA_SEL).forEach((el) => {
        if (!shown(el) || el.closest(RING_SEL)) return;
        box(el.getBoundingClientRect(), "blk", `border-radius:${getComputedStyle(el).borderRadius}`);
      });
      $$(RING_SEL).forEach((el) => shown(el) && box(el.getBoundingClientRect(), "ring"));
      $$(".nav a[aria-current] .dot").forEach((el) => shown(el) && box(el.getBoundingClientRect(), "blk", "border-radius:50%"));
      // decorative dots are left out: they only appear once the page has opened
      // text: one bar per rendered line, per block
      const lines = new Map();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.nodeValue.trim() && n.parentElement && !invisible(n.parentElement) ? 1 : 2),
      });
      const range = document.createRange();
      for (let n; (n = walker.nextNode()); ) {
        const host = n.parentElement;
        const blockEl = host.closest("p, h1, h2, h3, li, a, button, figcaption, span.frow__copy, div") || host;
        const fs = parseFloat(getComputedStyle(host).fontSize) || 16;
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) {
          if (r.width < 2 || r.bottom < 0 || r.top > vh) continue;
          const mid = r.top + r.height / 2, key = blockEl;
          let arr = lines.get(key); if (!arr) lines.set(key, (arr = []));
          const hit = arr.find((L) => Math.abs(L.mid - mid) < fs * 0.4);
          if (hit) { hit.l = Math.min(hit.l, r.left); hit.r = Math.max(hit.r, r.right); }
          else arr.push({ l: r.left, r: r.right, mid, fs });
        }
      }
      lines.forEach((arr) => arr.forEach((L) => {
        const h = Math.max(6, L.fs * 0.72);
        box({ left: L.l, top: L.mid - h / 2, width: L.r - L.l, height: h, right: L.r, bottom: L.mid + h / 2 }, "txt", `border-radius:${Math.min(8, h / 3).toFixed(1)}px`);
      }));
      document.documentElement.classList.remove("skel-measure");
      sk.innerHTML = out.join("");
    };
    build();
    document.fonts?.ready.then(() => sk.isConnected && build());
    let rt; addEventListener("resize", () => { if (!sk.isConnected) return; clearTimeout(rt); rt = setTimeout(build, 80); });
  }

  /* ---------- Covers: once the page is in, fetch every remaining cover in the background ---------- */
  // and every gallery / photo image too, in page order, so nothing waits as a grey block when you scroll to it
  const warmCovers = () => $$(".card__cover img[loading=lazy], .chero img[loading=lazy], .gitem img[loading=lazy], .photo img[loading=lazy]").forEach((img) => { img.loading = "eager"; });
  let warmed = false; const warm = () => { if (!warmed) { warmed = true; warmCovers(); } };
  if (document.readyState === "complete") setTimeout(warm, 150); else { addEventListener("load", () => setTimeout(warm, 150), { once: true }); setTimeout(warm, 1800); }

  /* ---------- Decorative dots: appear one after another, full size, stop-motion ---------- */
  const dotGroups = $$(".dots");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.2 });
    shown.then(() => dotGroups.forEach((g) => io.observe(g)));
  } else dotGroups.forEach((g) => g.classList.add("is-in"));

  /* ---------- Text appears line by line ---------- */
  const TEXT = [
    ".display", ".hero__lede", ".work-head p", ".ahero__title", ".ahero__bio h2", ".ahero__bio p", ".sec-title",
    ".xrow__date", ".xrow__n", ".xrow__role h3", ".xrow__role > p", ".xrow__text p", "p.xrow__text", ".intro__head p",
    ".split__text h2", ".split__text p",  /* circle copy is not split: it arrives with its circle */
    ".cover-text h2", ".cover-text p", ".footer__title", ".dfoot__title", ".chead__title",
    ".chead .tags", ".photo figcaption", ".wip__fig figcaption", ".swipe", ".frow__copy",
  ].join(",");
  function splitWords(el) {
    const walk = (node) => {
      [...node.childNodes].forEach((c) => {
        if (c.nodeType === 3) {
          const parts = c.textContent.split(/( +)/);
          if (!c.textContent.trim()) return;
          const f = document.createDocumentFragment();
          parts.forEach((w) => {
            if (!w) return;
            if (/^ +$/.test(w)) { f.appendChild(document.createTextNode(w)); return; }
            const sp = document.createElement("span"); sp.className = "lw"; sp.textContent = w; f.appendChild(sp);
          });
          c.replaceWith(f);
        } else if (c.nodeType === 1 && !/^(BR|SVG|IMG)$/i.test(c.tagName)) walk(c);
      });
    };
    walk(el);
  }
  function numberLines(el) {
    let line = -1, top = null;
    $$(".lw", el).forEach((w) => {
      const t = Math.round(w.getBoundingClientRect().top);
      if (top === null || Math.abs(t - top) > 4) { line++; top = t; }
      w.style.setProperty("--l", line);
    });
  }
  const textEls = reduce ? [] : $$(TEXT).filter((el) => !el.closest(".skel"));
  textEls.forEach((el) => { splitWords(el); el.classList.add("ls"); });
  const renumber = () => textEls.forEach((el) => !el.classList.contains("in") && numberLines(el));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(renumber); else renumber();
  renumber();
  addEventListener("resize", () => { clearTimeout(renumber.t); renumber.t = setTimeout(renumber, 150); });

  /* ---------- Reveal on scroll: nothing is visible until it reaches the screen ---------- */
  if (!reduce && "IntersectionObserver" in window) {
    const groups = [
      ".rule", ".card", ".callouts > .circle", ".frow > .fcell", ".back-top", ".xlist ul", ".steps", ".chip",
      ".pgrid", ".wip__fig video", ".split__media", ".dfoot__btns", ".chead__back", ".chero", ".gitem", ".pnav", ".xrow__logo",
    ];
    if (!isMobile()) groups.push(".photo img", ".pcircle");
    const els = $$(groups.join(",")).filter((el) => !(isMobile() && el.closest("[data-carousel]") && el.matches(".photo img, .pcircle")));
    els.forEach((el) => el.classList.add("rv"));
    const all = els.concat(textEls);
    let batch = 0, batchTimer = 0;
    const show = (el) => {
      el.style.setProperty("--d", `${Math.min(batch++, 6) * 80}ms`);
      if (el.classList.contains("ls")) numberLines(el);
      requestAnimationFrame(() => el.classList.add("in"));
    };
    const rio = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
        .forEach((e) => { show(e.target); rio.unobserve(e.target); });
      clearTimeout(batchTimer); batchTimer = setTimeout(() => (batch = 0), 140);
    }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
    // Blocks at the very end of the page (footer contacts, "Back to top") can sit below that trigger line
    // even when scrolled all the way down, especially on tall screens: reveal whatever is left once the
    // bottom is reached, and anything already on screen after the page opens.
    const flush = () => all.forEach((el) => {
      if (el.classList.contains("in")) return;
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) { show(el); rio.unobserve(el); }
    });
    const atBottom = () => { if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) flush(); };
    addEventListener("scroll", atBottom, { passive: true });
    addEventListener("resize", atBottom, { passive: true });
    shown.then(() => requestAnimationFrame(() => { all.forEach((el) => rio.observe(el)); setTimeout(() => { flush(); atBottom(); }, 400); }));
  }

  /* ---------- Images fade in once decoded (no half-painted frames) ---------- */
  $$(".gitem img, .chero img, .card__cover img, .photo img").forEach((img) => {
    const done = () => img.classList.add("is-loaded");
    if (img.complete && img.naturalWidth) done();
    else img.addEventListener("load", () => (img.decode ? img.decode().catch(() => {}).then(done) : done()), { once: true });
    img.addEventListener("error", done, { once: true });
  });
  // warm up the next gallery images before they scroll into view
  if ("IntersectionObserver" in window) {
    const pre = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { const i = $("img[loading=lazy]", e.target); if (i) i.loading = "eager"; pre.unobserve(e.target); }
    }), { rootMargin: "120% 0px" });
    $$(".gitem").forEach((g) => pre.observe(g));
  }

  /* ---------- Gentle parallax inside card covers and gallery images ---------- */
  const para = [];
  if (para.length) {
    let pt = false;
    const run = () => {
      const vh = innerHeight;
      para.forEach((img) => {
        const r = img.parentElement.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        const p = (r.top + r.height / 2 - vh / 2) / (vh + r.height); // -0.5..0.5
        img.style.setProperty("--py", `${(p * -6).toFixed(2)}%`);
      });
      pt = false;
    };
    addEventListener("scroll", () => { if (!pt) { pt = true; requestAnimationFrame(run); } }, { passive: true });
    addEventListener("resize", run); run();
  }

  /* ---------- Is there text or media under this point? (dots never cover content) ---------- */
  const range = document.createRange();
  const MEDIA = "img, video, iframe, canvas, svg, .chip, .sbtn, .xrow__logo";
  function textAt(x, y, pad = 0) {
    const el = document.elementFromPoint(x, y);
    if (!el) return false;
    if (el.closest(MEDIA)) return true;
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) return true;
      }
    }
    return false;
  }
  // checks the whole circle the dot would cover, plus a small breathing margin
  function blocked(x, y, size) {
    const r = size / 2 + 4;
    const pts = [[0, 0]];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; pts.push([Math.cos(a) * r, Math.sin(a) * r], [Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55]); }
    return pts.some(([dx, dy]) => textAt(x + dx, y + dy, 2));
  }
  const dotSize = () => (innerWidth >= 1280 ? Math.round(Math.min(40, Math.max(28, innerWidth * 0.0208))) : 24);

  /* ---------- Decorative dots never sit on content ----------
     Each dot keeps its designed spot when that spot is free. If text, an image or a button is under it
     (longer copy, another screen width), it moves to the nearest free spot inside its own area. */
  function contentRects(scope) {
    const out = [], walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => n.textContent.trim() && !n.parentElement.closest(".dots, .skel, [hidden], .sr-only, .skip") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    for (let n; (n = walker.nextNode()); ) {
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width && r.height) out.push({ l: r.left, t: r.top + scrollY, r: r.right, b: r.bottom + scrollY });
    }
    // by design (Figma) dots may overlap the edges of the About photos and the Approach video; everything else is off limits
    scope.querySelectorAll(MEDIA + ", .card__cover, a.sbtn, .circle__link").forEach((el) => {
      if (el.closest(".dots, .photo, .wip__fig")) return;
      const r = el.getBoundingClientRect(); if (r.width && r.height) out.push({ l: r.left, t: r.top + scrollY, r: r.right, b: r.bottom + scrollY });
    });
    return out;
  }
  function placeDots() {
    const main = document.querySelector("main"); if (!main) return;
    const groups = [...main.querySelectorAll(".dots")]; if (!groups.length) return;
    groups.forEach((g) => g.querySelectorAll("i").forEach((d) => { d.style.left = ""; d.style.top = ""; }));
    const root = document.documentElement, had = root.classList.contains("skel-measure");
    root.classList.add("skel-measure");   // reveal offsets off while measuring (same frame, never painted)
    const rects = contentRects(main), gap = 8;
    const hits = (x, y, sz) => rects.some((q) => x + sz + gap > q.l && x - gap < q.r && y + sz + gap > q.t && y - gap < q.b);
    const taken = [];
    groups.forEach((g) => {
      const box = g.getBoundingClientRect(), ox = box.left, oy = box.top + scrollY;
      g.querySelectorAll("i").forEach((d) => {
        if (getComputedStyle(d).display === "none") return;
        const sz = d.offsetWidth, x0 = ox + d.offsetLeft, y0 = oy + d.offsetTop;
        const free = (x, y) => x >= ox && y >= oy - sz && x + sz <= ox + box.width && x + sz <= innerWidth - 4 && !hits(x, y, sz)
          && !taken.some((t) => Math.abs(t.x - x) < sz * 1.5 && Math.abs(t.y - y) < sz * 1.5);
        let best = free(x0, y0) ? [x0, y0] : null;
        for (let rad = 8; !best && rad <= 480; rad += 8) {
          for (let k = 0, n = Math.max(8, Math.round(rad / 6)); k < n && !best; k++) {
            const a = (k / n) * Math.PI * 2, x = x0 + Math.cos(a) * rad, y = y0 + Math.sin(a) * rad;
            if (free(x, y)) best = [x, y];
          }
        }
        if (!best) { d.style.display = "none"; return; }   // no free spot nearby: better no dot than a dot on the text
        d.style.display = "";
        if (best[0] !== x0 || best[1] !== y0) { d.style.left = (best[0] - ox) + "px"; d.style.top = (best[1] - oy) + "px"; }
        taken.push({ x: best[0], y: best[1] });
      });
    });
    if (!had) root.classList.remove("skel-measure");
  }
  const placeDotsSoon = () => { clearTimeout(placeDots.t); placeDots.t = setTimeout(placeDots, 120); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeDotsSoon); else placeDotsSoon();
  addEventListener("load", placeDotsSoon);
  addEventListener("resize", () => { document.querySelectorAll("main .dots i").forEach((d) => { d.style.display = ""; }); placeDotsSoon(); });

  /* ---------- Click / tap anywhere empty: a dot lands there ---------- */
  {
    const placed = [];
    document.addEventListener("click", (e) => {
      if (e.button !== 0 || e.target.closest("a, button, input, textarea, select, video, iframe, .sidebar, .tbar, .mbar, .dfoot, .chip, .skel")) return;
      if (isMobile() && e.target.closest("[data-carousel]")) return; // on phones a tap there means "swipe"
      if (getSelection && String(getSelection()).length) return;
      const d = document.createElement("i");
      d.className = "click-dot";
      d.setAttribute("aria-hidden", "true");
      const size = dotSize();
      if (blocked(e.clientX, e.clientY, size)) return;
      if (onBrand(e.target)) d.classList.add("is-light");
      d.style.cssText = `left:${e.pageX}px;top:${e.pageY}px;--s:${size}px`;
      document.body.appendChild(d);
      placed.push(d);
      const max = finePointer ? 12 : 6;
      if (placed.length > max) { const old = placed.shift(); old.remove(); }
    });
  }

  /* ---------- Cursor: a dot (desktop) ---------- */
  // It sits exactly on the pointer (no easing on position, so it never lags or hangs).
  // While a page loads it beats like a heart; on load it shrinks to nothing, the page opens
  // through a growing circle, and the dot grows back.
  if (finePointer && !reduce) {
    const c = document.createElement("div");
    c.className = "cursor is-on"; c.setAttribute("aria-hidden", "true");
    document.body.appendChild(c);
    document.documentElement.classList.add("has-cursor");
    const place = () => { c.style.transform = `translate3d(${L.x}px, ${L.y}px, 0)`; };
    place();
    let target = null;
    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      place();
      if (e.target !== target) {
        target = e.target;
        c.classList.toggle("is-link", !!target.closest("a, button, [role=button], label, .chip"));
      }
      c.classList.toggle("is-light", L.phase === "load" || L.phase === "shrink" || onBrand(target));
      c.classList.toggle("is-text", !c.classList.contains("is-link") && textAt(e.clientX, e.clientY, 2));
      c.classList.add("is-on");
    }, { passive: true });
    document.addEventListener("pointerleave", () => c.classList.remove("is-on"));
    document.addEventListener("pointerenter", () => c.classList.add("is-on"));
    addEventListener("pointerdown", () => c.classList.add("is-down"));
    addEventListener("pointerup", () => c.classList.remove("is-down"));
    // loader states: heartbeat → shrink to 0 → (page opens) → grow back
    if (L.phase !== "live") {
      c.classList.add("is-light");
      const run = (now) => {
        let sc = 1;
        if (L.phase === "load") { const p = (now / 1100) % 1; sc = 1 + 0.3 * Math.pow(Math.sin(Math.PI * Math.min(1, p / 0.55)), 2); }
        else if (L.phase === "shrink") sc = 1 - L.t;
        else if (L.phase === "open") { sc = 0; c.classList.toggle("is-light", onBrand(document.elementFromPoint(L.x, L.y))); }
        else if (L.phase === "grow") sc = L.t;
        c.style.setProperty("--sc", sc.toFixed(3));
        if (L.phase !== "live") requestAnimationFrame(run); else c.style.removeProperty("--sc");
      };
      requestAnimationFrame(run);
    }
  }

  /* ---------- Ring text: always turning slowly (desktop/tablet), scroll adds to it ---------- */
  const rings = $$("[data-rotate]");
  if (rings.length && !reduce) {
    let base = 0, last = performance.now(), visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { last = performance.now(); loop(); } });
    io.observe(rings[0]);
    const loop = () => {
      const now = performance.now();
      if (!isMobile()) base += (now - last) * 0.006; // 6° per second
      last = now;
      const d = base + scrollY * 0.12;
      rings.forEach((r) => (r.style.transform = `rotate(${d}deg)`));
      if (visible) requestAnimationFrame(loop);
    };
    loop();
  }

  /* ---------- Back to top ---------- */
  $$("[data-top]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault(); scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    $("#main")?.focus?.({ preventScroll: true });
  }));

  /* ---------- Email: copies itself ---------- */
  let toastT = 0;
  const toast = (msg) => {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-on"), 1800);
  };
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch {}
    ta.remove(); return ok;
  };
  document.addEventListener("click", async (e) => {
    const a = e.target.closest("[data-copy]");
    if (!a) return;
    e.preventDefault();
    const ok = await copy(a.dataset.copy);
    toast(ok ? document.body.dataset.copied : a.dataset.copy);
  });

  /* ---------- CV: download (in the claude.ai preview through its save dialog) ---------- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-cv]");
    const inPreview = /claudeusercontent\.com$/.test(location.hostname);
    if (!a || !inPreview) return; // real site: the link downloads the file itself
    e.preventDefault();
    const url = a.href, name = decodeURIComponent(url.split("/").pop());
    (async () => {
      try {
        const dl = window.claude && typeof window.claude.use === "function" ? await window.claude.use("downloads") : null;
        if (!dl) throw 0;
        const blob = await fetch(url).then((r) => r.blob());
        await dl.save({ filename: name, data: blob });
      } catch (err) {
        if (err && err.code === "declined") return;
        toast(document.documentElement.lang === "ru" ? "В превью Claude скачивание недоступно. На сайте резюме скачается" : "Downloads are blocked in the Claude preview. On the live site the CV downloads");
      }
    })();
  });

  /* ---------- Tablet dropdown ---------- */
  const tBtn = $(".tbar__current"), tMenu = $("#tbar-menu");
  if (tBtn && tMenu) {
    const close = (focus) => { tMenu.hidden = true; tBtn.setAttribute("aria-expanded", "false"); if (focus) tBtn.focus(); };
    const open = () => { tMenu.hidden = false; tBtn.setAttribute("aria-expanded", "true"); $("a", tMenu)?.focus(); };
    tBtn.addEventListener("click", () => (tMenu.hidden ? open() : close(false)));
    tMenu.addEventListener("click", (e) => { if (e.target.closest('[aria-current="page"]')) { e.preventDefault(); close(true); } });
    document.addEventListener("click", (e) => { if (!tMenu.hidden && !e.target.closest(".tbar__pages")) close(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !tMenu.hidden) close(true); });
  }

  /* ---------- Mobile menu ---------- */
  const mBtn = $(".mbar > .mbar__row .mbar__btn"), mMenu = $("#mmenu");
  if (mBtn && mMenu) {
    const focusables = () => $$("a[href], button", mMenu);
    const open = () => {
      mMenu.hidden = false; mBtn.setAttribute("aria-expanded", "true");
      document.documentElement.classList.add("menu-open"); document.body.classList.add("menu-open");
      focusables()[0]?.focus();
    };
    const close = () => {
      mMenu.hidden = true; mBtn.setAttribute("aria-expanded", "false");
      document.documentElement.classList.remove("menu-open"); document.body.classList.remove("menu-open");
      mBtn.focus();
    };
    mBtn.addEventListener("click", open);
    $("[data-close]", mMenu).addEventListener("click", close);
    mMenu.addEventListener("click", (e) => {
      if (e.target.closest('[aria-current="page"]')) { e.preventDefault(); close(); }
      else if (e.target.closest("[data-contact]")) close();
    });
    document.addEventListener("click", (e) => { if (!mMenu.hidden && !e.target.closest(".mbar")) close(); });
    document.addEventListener("keydown", (e) => {
      if (mMenu.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const f = focusables(); const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- Circles on touch screens: the circle under the finger inverts, like hover ----------
     It follows the finger while the page scrolls under it and fades back when the finger lifts.
     (No pointercancel flashes: that was the jerk you saw while scrolling.) */
  if (!finePointer) {
    const CIRC = ".circle:not(.circle--ring), .pcircle";
    let cur = null, off = 0, tx = 0, ty = 0, raf = 0;
    const set = (el) => { if (el === cur) return; cur?.classList.remove("is-pressed"); cur = el; el?.classList.add("is-pressed"); };
    const under = () => { raf = 0; const el = document.elementFromPoint(tx, ty); set(el ? el.closest(CIRC) : null); };
    const track = (e) => { const t = e.touches[0]; if (!t) return; tx = t.clientX; ty = t.clientY; clearTimeout(off); if (!raf) raf = requestAnimationFrame(under); };
    document.addEventListener("touchstart", track, { passive: true });
    document.addEventListener("touchmove", track, { passive: true });
    addEventListener("scroll", () => { if (cur && !raf) raf = requestAnimationFrame(under); }, { passive: true }); // momentum: keep following
    const lift = () => { clearTimeout(off); off = setTimeout(() => set(null), 160); };
    document.addEventListener("touchend", lift, { passive: true });
    document.addEventListener("touchcancel", lift, { passive: true });
    addEventListener("pageshow", () => set(null));
  }

  /* ---------- Project titles under covers: one line on phones, scaled down if needed ---------- */
  const fitTitles = () => $$(".card__title").forEach((el) => {
    el.style.fontSize = "";
    if (!isMobile()) return;
    for (let i = 0; i < 3 && el.scrollWidth > el.clientWidth + 0.5; i++) {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = Math.max(16, fs * (el.clientWidth / el.scrollWidth) - 0.2).toFixed(2) + "px";
    }
  });
  fitTitles(); document.fonts?.ready.then(fitTitles);
  { let ft; addEventListener("resize", () => { clearTimeout(ft); ft = setTimeout(fitTitles, 100); }); }

  /* Footer contacts: one row on desktop while the labels fit; otherwise the mobile list. */
  function fitFooter() {
    document.querySelectorAll(".footer").forEach((f) => {
      f.classList.remove("footer--stack");
      if (innerWidth < 1280) return;
      const row = f.querySelector(".frow");
      if ((row && row.scrollWidth > row.clientWidth + 1) || [...f.querySelectorAll(".fcell")].some((c) => c.scrollWidth > c.clientWidth + 1)) f.classList.add("footer--stack");
    });
  }
  fitFooter();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitFooter);
  { let fft; addEventListener("resize", () => { clearTimeout(fft); fft = setTimeout(fitFooter, 100); }); }

  /* ---------- Videos: load ahead of time, play only while visible ---------- */
  // In the claude.ai preview the files come from the artifact's asset store, which some browsers
  // (Safari) won't stream; there the whole file is fetched first and played from memory.
  const vids = $$("video");
  if (vids.length && "IntersectionObserver" in window) {
    const visible = new WeakSet();
    const tryPlay = (v) => { if (visible.has(v) && !reduce && v.dataset.ready !== "0") { v.muted = true; v.play().catch(() => {}); } };
    vids.forEach((v) => {
      v.muted = true; v.removeAttribute("autoplay");
      const src = v.getAttribute("src") || "";
      if (src.startsWith("/_blob/")) { v.dataset.src = src; v.dataset.ready = "0"; v.removeAttribute("src"); v.load(); }
    });
    const near = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const v = e.target; near.unobserve(v);
      if (v.dataset.src) {
        fetch(v.dataset.src).then((r) => r.blob()).then((b) => {
          v.src = URL.createObjectURL(b); v.dataset.ready = "1"; tryPlay(v);
        }).catch(() => { v.src = v.dataset.src; v.dataset.ready = "1"; tryPlay(v); });
      } else { v.preload = "auto"; v.load(); }
    }), { rootMargin: "150% 0px" });
    const vio = new IntersectionObserver((es) => es.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) { visible.add(v); tryPlay(v); } else { visible.delete(v); v.pause(); }
    }), { threshold: 0.1 });
    vids.forEach((v) => { near.observe(v); vio.observe(v); });
  }

  /* ---------- Swipe indicators for mobile carousels ---------- */
  $$("[data-carousel]").forEach((track) => {
    const ind = track.nextElementSibling?.classList.contains("swipe") ? track.nextElementSibling : null;
    if (!ind) return;
    const n = $(".swipe__n", ind), bar = $(".swipe__track i", ind);
    const items = track.children.length, total = String(items).padStart(2, "0");
    let tk = false;
    const update = () => {
      tk = false;
      const max = track.scrollWidth - track.clientWidth;
      const w = Math.min(1, track.clientWidth / track.scrollWidth);
      const p = max > 0 ? track.scrollLeft / max : 0;
      bar.style.setProperty("--w", (w * 100).toFixed(2) + "%");
      bar.style.setProperty("--p", (p * (1 / w - 1) * 100).toFixed(2) + "%");
      const idx = Math.min(items, Math.round(p * (items - 1)) + 1);
      n.textContent = String(idx).padStart(2, "0") + " / " + total;
    };
    track.addEventListener("scroll", () => { if (!tk) { tk = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener("resize", update);
    update();
  });

  /* ---------- "Contact" scrolls to whichever contact block is visible ---------- */
  // "Contact" always leads to the contact block at the end of the Approach page
  const contactTarget = () => $$("[data-contact-target]").find((el) => el.offsetParent !== null);
  const onApproach = document.body.classList.contains("page-approach");
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-contact]");
    if (!a || !onApproach) return; // other pages: a normal link to approach/#contact
    const target = contactTarget();
    if (!target) return;
    e.preventDefault();
    setTimeout(() => target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }), 40);
  });
  if (onApproach && location.hash === "#contact") {
    const jump = () => contactTarget()?.scrollIntoView({ behavior: "instant", block: "start" });
    requestAnimationFrame(jump); addEventListener("load", jump, { once: true });
  }

  /* ---------- Liquid dot field (Approach footer, desktop) ---------- */
  const foot = $(".dfoot"), canvas = foot && $(".dfoot__canvas", foot);
  if (canvas) dotField(foot, canvas, reduce);

  // Dots behave like a layer of water made of small balls: gravity, a floor and walls,
  // and every dot keeps the same distance from its neighbours (they never overlap).
  // The pointer is a moving obstacle that pushes the water; it splashes, flows back and settles.
  function dotField(section, cv, still) {
    const ctx = cv.getContext("2d", { alpha: true });
    const DPR = Math.min(devicePixelRatio || 1, 2);
    const COLOR = "#541725";
    let W = 0, H = 0, N = 0, S = 12, R = 3.6;
    let x, y, px, py, hx, hy, head, next, gw = 0, gh = 0;
    let pointer = null, prevPointer = null, running = false, visible = false, calm = 0;
    const GRAV = 0.32, ITER = 2, MAXV = 24, BALL = 70;

    function build() {
      const r = section.getBoundingClientRect();
      W = Math.round(r.width); H = Math.round(r.height);
      if (!W || !H) return;
      cv.width = W * DPR; cv.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      R = 8;                                        // dot radius: the same 16px dot as the cursor
      S = R / 0.33;                                 // distance between dot centres: a clear, even gap
      const b = section.querySelector(".dfoot__btns");
      const level = Math.max(H * 0.42, b ? b.offsetTop + b.offsetHeight + 70 : 0);
      const pts = [], dy = S * Math.sqrt(3) / 2;
      const cols = Math.floor((W - S) / S);
      const x0 = (W - cols * S) / 2;
      for (let j = 0, yy = H - S / 2; yy > level - H * 0.06; j++, yy -= dy) {
        const off = j % 2 ? S / 2 : 0, n = j % 2 ? cols - 1 : cols;
        for (let k = 0; k <= n; k++) {
          const xx = x0 + off + k * S, u = xx / W;
          // a gentle wave on the surface (as in the Figma composition)
          const top = level + H * (0.035 * Math.sin(u * Math.PI * 2.1 + 0.6) + 0.02 * Math.sin(u * Math.PI * 5.3 + 1.7));
          if (yy >= top) pts.push(xx, yy);
        }
      }
      N = pts.length / 2;
      x = new Float32Array(N); y = new Float32Array(N); px = new Float32Array(N); py = new Float32Array(N); next = new Int32Array(N);
      hx = new Float32Array(N); hy = new Float32Array(N);
      for (let i = 0; i < N; i++) { hx[i] = px[i] = x[i] = pts[2 * i]; hy[i] = py[i] = y[i] = pts[2 * i + 1]; }
      gw = Math.ceil(W / S) + 2; gh = Math.ceil((H + 400) / S) + 2; head = new Int32Array(gw * gh);
      draw();
    }

    function hash() {
      head.fill(-1);
      for (let i = 0; i < N; i++) {
        const gx = Math.min(gw - 1, Math.max(0, ((x[i] / S) | 0) + 1)), gy = Math.min(gh - 1, Math.max(0, (((y[i] + 400) / S) | 0) + 1));
        const k = gy * gw + gx; next[i] = head[k]; head[k] = i;
      }
    }

    function step() {
      // integrate: the water wants to return to its calm level (a soft spring to each dot's place),
      // anything thrown above its place falls back under gravity
      for (let i = 0; i < N; i++) {
        let vx = (x[i] - px[i]) * 0.965, vy = (y[i] - py[i]) * 0.965;
        vx += (hx[i] - x[i]) * 0.006; vy += (hy[i] - y[i]) * 0.006;
        if (y[i] < hy[i] - 1) vy += GRAV;
        const v = Math.hypot(vx, vy); if (v > MAXV) { vx *= MAXV / v; vy *= MAXV / v; }
        px[i] = x[i]; py[i] = y[i]; x[i] += vx; y[i] += vy;
      }
      // the pointer: a moving ball that shoves the water along its path
      if (pointer) {
        const mx = pointer.x, my = pointer.y;
        const dvx = prevPointer ? pointer.x - prevPointer.x : 0, dvy = prevPointer ? pointer.y - prevPointer.y : 0;
        const B2 = BALL * BALL;
        for (let i = 0; i < N; i++) {
          const ddx = x[i] - mx, ddy = y[i] - my, d2 = ddx * ddx + ddy * ddy;
          if (d2 >= B2) continue;
          const d = Math.sqrt(d2) || 0.01, push = BALL - d;
          x[i] += (ddx / d) * push * 0.5 + dvx * 0.25;
          y[i] += (ddy / d) * push * 0.5 + dvy * 0.25;
        }
        prevPointer = { ...pointer };
      }
      // keep every pair exactly one spacing apart at most (no overlaps), a few relaxation passes
      const D = S * 0.97, S2 = D * D;
      for (let it = 0; it < ITER; it++) {
        hash();
        for (let i = 0; i < N; i++) {
          const gx = ((x[i] / S) | 0) + 1, gy = (((y[i] + 400) / S) | 0) + 1;
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
            const X = gx + ox, Y = gy + oy; if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue;
            for (let j = head[Y * gw + X]; j !== -1; j = next[j]) {
              if (j <= i) continue;
              const ddx = x[j] - x[i], ddy = y[j] - y[i], d2 = ddx * ddx + ddy * ddy;
              if (d2 >= S2 || d2 < 1e-6) continue;
              const d = Math.sqrt(d2), c = ((D - d) / d) * 0.5;
              x[i] -= ddx * c; y[i] -= ddy * c; x[j] += ddx * c; y[j] += ddy * c;
            }
          }
        }
        for (let i = 0; i < N; i++) {
          if (x[i] < S / 2) x[i] = S / 2; else if (x[i] > W - S / 2) x[i] = W - S / 2;
          if (y[i] > H - S / 2) { y[i] = H - S / 2; px[i] += (x[i] - px[i]) * 0.1; } // floor friction
        }
      }
      let e = 0;
      for (let i = 0; i < N; i++) { const vx = x[i] - px[i], vy = y[i] - py[i]; e += vx * vx + vy * vy; }
      return e / Math.max(1, N);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = COLOR;
      ctx.beginPath();
      for (let i = 0; i < N; i++) { ctx.moveTo(x[i] + R, y[i]); ctx.arc(x[i], y[i], R, 0, 6.2832); }
      ctx.fill();
    }

    function tick() {
      if (!visible) { running = false; return; }
      const e = step();
      draw();
      calm = e > 0.0005 || pointer ? 0 : calm + 1;
      if (calm < 45) requestAnimationFrame(tick); else running = false;
    }
    const kick = () => { if (!running && visible && !still) { running = true; calm = 0; requestAnimationFrame(tick); } };

    const toLocal = (e) => { const r = section.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    if (!still) {
      section.addEventListener("pointermove", (e) => { pointer = toLocal(e); kick(); }, { passive: true });
      section.addEventListener("pointerleave", () => { pointer = null; prevPointer = null; });
      // touch: the finger is the ball, also while the page scrolls under it
      const fromTouch = (e) => { const t = e.touches[0]; if (!t) return; pointer = toLocal(t); kick(); };
      section.addEventListener("touchstart", (e) => { prevPointer = null; fromTouch(e); }, { passive: true });
      section.addEventListener("touchmove", fromTouch, { passive: true });
      const lift = () => { pointer = null; prevPointer = null; };
      section.addEventListener("touchend", lift, { passive: true });
      section.addEventListener("touchcancel", lift, { passive: true });
    }
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }, { rootMargin: "100px" }).observe(section);
    let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(build, 150); }).observe(section);
    build();
  }
})();
