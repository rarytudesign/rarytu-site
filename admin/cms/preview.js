/* Live preview of a page rendered from the draft. Exposes window.Preview.
   Preview.mount(el, page) shows `page` ({ key: "work"|"about"|"approach"|"case", slug? }) inside `el`
   and re-renders whenever the draft changes. Animations are switched off in the preview so typing doesn't replay them. */
(() => {
  const WIDTHS = [["Mobile", 390], ["Tablet", 834], ["Desktop", 1440]];
  const pref = (k, d) => { try { return localStorage.getItem("rarytu-preview-" + k) || d; } catch { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem("rarytu-preview-" + k, v); } catch {} };
  const SITE = new URL("../", location.href);   // the published site root
  const STILL = '<style id="preview-still">.skel{display:none!important}.rv,.ls,.lw,.ls *,.lw *{opacity:1!important;transform:none!important}' +
    '*,*::before,*::after{transition-duration:0s!important;animation-delay:0s!important}</style>';

  let current = null, off = null, timer = null, urls = [];

  function pagePath(page, lang) {
    if (page.key === "case") return RarytuRender.casePath(lang, page.slug);
    return RarytuRender.pagePath(lang, page.key);
  }

  function html(page, lang) {
    const path = pagePath(page, lang);
    let out = RarytuRender.renderPage({ lang, key: page.key, slug: page.slug, path }, { site: Store.read("content/site.json"), read: Store.read });
    // media added in the draft isn't on the site yet: point the preview at the files in the browser
    urls.forEach((u) => URL.revokeObjectURL(u)); urls = [];
    const media = (Store.state.draft && Store.state.draft.media) || {};
    for (const [p, blob] of Object.entries(media)) {
      const u = URL.createObjectURL(blob); urls.push(u);
      out = out.split(new RegExp("(?:\\.\\./)*" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")).join(u);
    }
    out = out.replace(/<script[^>]*data-cf-beacon[^>]*><\/script>\n?/, "");   // previews are not visits
    const base = `<base href="${new URL(path, SITE).href}">`;
    return out.replace("<head>", "<head>" + base).replace("</head>", STILL + "</head>");
  }

  function draw() {
    if (!current) return;
    const { el, page } = current, lang = pref("lang", "en"), w = +pref("width", innerWidth < 900 ? "390" : "1440");
    el.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.lang === lang));
    el.querySelectorAll("[data-w]").forEach((b) => b.setAttribute("aria-pressed", +b.dataset.w === w));
    el.querySelector(".pv__open").href = new URL(pagePath(page, lang), SITE).href;
    const frame = el.querySelector("iframe"), stage = el.querySelector(".pv__stage");
    let doc;
    try { doc = html(page, lang); el.querySelector(".pv__err").hidden = true; }
    catch (e) { const er = el.querySelector(".pv__err"); er.hidden = false; er.textContent = "Preview error: " + e.message; return; }
    // keep the scroll position across re-renders
    let y = 0; try { y = frame.contentWindow.scrollY || 0; } catch {}
    frame.onload = () => { try { frame.contentWindow.scrollTo(0, y); frame.contentDocument.addEventListener("click", (ev) => { const a = ev.target.closest("a[href]"); if (a && !a.getAttribute("href").startsWith("#")) ev.preventDefault(); }, true); } catch {} };
    // size the frame first: the site splits headings into lines on load, by the width it has at that moment
    fit(stage, frame, w);
    frame.srcdoc = doc;
  }

  function fit(stage, frame, w) {
    const avail = stage.clientWidth || w, s = Math.min(1, avail / w);
    frame.style.width = w + "px";
    frame.style.height = (stage.clientHeight / s) + "px";
    frame.style.transform = `scale(${s})`;
    frame.style.left = Math.max(0, (avail - w * s) / 2) + "px";
  }

  function mount(el, page) {
    if (off) off();
    current = { el, page };
    el.innerHTML = `<div class="pv">
      <div class="pv__bar">
        <span class="seg">${["en", "ru"].map((l) => `<button type="button" data-lang="${l}">${l.toUpperCase()}</button>`).join("")}</span>
        <span class="seg">${WIDTHS.map(([n, w]) => `<button type="button" data-w="${w}" title="${n}, ${w} px">${n}</button>`).join("")}</span>
        <a class="pv__open" target="_blank" rel="noopener">Open live page ↗</a>
      </div>
      <p class="pv__err error" hidden></p>
      <div class="pv__stage"><iframe title="Preview" loading="eager"></iframe></div>
    </div>`;
    el.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => { setPref("lang", b.dataset.lang); draw(); }));
    el.querySelectorAll("[data-w]").forEach((b) => b.addEventListener("click", () => { setPref("width", b.dataset.w); draw(); }));
    off = Store.on(() => { clearTimeout(timer); timer = setTimeout(draw, 300); });
    draw();
  }
  addEventListener("resize", () => { if (current) fit(current.el.querySelector(".pv__stage"), current.el.querySelector("iframe"), +pref("width", innerWidth < 900 ? "390" : "1440")); });

  window.Preview = { mount, lang: () => pref("lang", "en"), setLang: (l) => { setPref("lang", l); draw(); }, redraw: draw };
})();
