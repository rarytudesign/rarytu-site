/* Form kit for the editors. Exposes window.F.
   Fields read and write one content file through Store, addressed by a key path:
     F.at("content/pages/about.json", ["experience", "items", 0, "role"])
   Text values keep the content shapes the renderer understands:
     "same in both languages" | { en, ru } | { en: { d, mt }, ru: … } (desktop vs mobile+tablet copy)
   In text boxes a line break stands for <br>. Other inline tags (<span class="nw">, <br class="br-m">) are shown as they are. */
(() => {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v; else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v; else el.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((c) => c != null && el.append(c.nodeType ? c : document.createTextNode(c)));
    return el;
  };
  let uid = 0; const id = () => "f" + (++uid);
  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);

  // ---------- binding to a content file ----------
  function at(file, keys) {
    const dig = (o) => keys.reduce((x, k) => (x == null ? undefined : x[k]), o);
    return {
      file, keys,
      get: () => dig(Store.get(file)),
      set: (v) => Store.update(file, (copy) => {
        let x = copy; for (const k of keys.slice(0, -1)) { if (x[k] == null) x[k] = typeof k === "number" ? [] : {}; x = x[k]; }
        if (v === undefined) delete x[keys[keys.length - 1]]; else x[keys[keys.length - 1]] = v;
      }),
      sub: (...more) => at(file, keys.concat(more)),
    };
  }

  // bilingual accessor for values stored per language at different places: pair(file, (lang) => keys)
  function pair(file, keysFor) {
    const one = (lang) => at(file, keysFor(lang));
    return { get: () => ({ en: one("en").get(), ru: one("ru").get() }),
      set: (v) => Store.update(file, (copy) => { for (const lang of ["en", "ru"]) {
        const val = typeof v === "string" || Array.isArray(v) ? v : v[lang];
        const keys = keysFor(lang); let x = copy; for (const k of keys.slice(0, -1)) x = x[k] ?? (x[k] = {}); x[keys[keys.length - 1]] = val; } }) };
  }

  // ---------- text conversions ----------
  // In text boxes: Enter = line break; [phone break] / [mobile break] = line break on phones only / on phones and tablets.
  // Hyphenated words are kept together automatically on Russian pages, so <span class="nw"> isn't needed (old ones are hidden).
  const toBox = (s) => String(s == null ? "" : s).replace(/<span class="nw">([^<]*)<\/span>/g, "$1")
    .replace(/<br class="br-m">/g, "[phone break]").replace(/<br class="v-mt">/g, "[mobile break]").replace(/<br>/g, "\n");
  const fromBox = (s) => String(s).replace(/\r/g, "").replace(/\[phone break\]/gi, '<br class="br-m">').replace(/\[mobile break\]/gi, '<br class="v-mt">').replace(/\n/g, "<br>");
  const BREAKS_HINT = "Enter starts a new line. [phone break] starts a new line on phones only, [mobile break] on phones and tablets.";
  const parasToBox = (list) => (list || []).map(toBox).join("\n\n");
  const parasFromBox = (s) => String(s).replace(/\r/g, "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map(fromBox);

  // value helpers for the bilingual shapes
  const langVal = (v, lang) => (isObj(v) && ("en" in v || "ru" in v)) ? v[lang] : v;
  const hasVariants = (v) => ["en", "ru"].some((l) => isObj(langVal(v, l)) && ("d" in langVal(v, l)));
  function compact(en, ru) {   // keep plain strings when both languages are the same
    return JSON.stringify(en) === JSON.stringify(ru) && typeof en === "string" ? en : { en, ru };
  }

  function autosize(t) { t.style.height = "auto"; t.style.height = (t.scrollHeight + 2) + "px"; }
  function box(value, oninput, opts = {}) {
    const t = h("textarea", { rows: opts.rows || 1, class: "fbox" + (opts.big ? " fbox--big" : ""), spellcheck: "true", lang: opts.lang || null });
    t.value = value; t.addEventListener("input", () => { autosize(t); oninput(t.value); });
    requestAnimationFrame(() => autosize(t));
    return t;
  }

  /* Bilingual text. opts: { label, hint, paragraphs (list of paragraphs), variants (allow desktop/mobile copy), big } */
  function text(b, opts = {}) {
    const wrap = h("div", { class: "field" });
    const draw = () => {
      wrap.innerHTML = "";
      const v = b.get(), split = hasVariants(v);
      const head = h("div", { class: "field__head" }, h("span", { class: "field__label" }, opts.label || ""));
      if (opts.variants) {
        const cb = h("input", { type: "checkbox", id: id() }); cb.checked = split;
        cb.addEventListener("change", () => {
          const cur = b.get();
          if (cb.checked) b.set({ en: { d: langVal(cur, "en") ?? "", mt: langVal(cur, "en") ?? "" }, ru: { d: langVal(cur, "ru") ?? "", mt: langVal(cur, "ru") ?? "" } });
          else b.set(compact(variantOf(cur, "en", "d"), variantOf(cur, "ru", "d")));
          draw();
        });
        head.append(h("label", { class: "field__toggle", for: cb.id }, cb, " Different text on mobile and tablet"));
      }
      wrap.append(head);
      if (opts.hint) wrap.append(h("p", { class: "field__hint" }, opts.hint));
      const kinds = split ? [["d", "Desktop"], ["mt", "Mobile and tablet"]] : [[null, ""]];
      for (const [k, kname] of kinds) {
        if (kname) wrap.append(h("p", { class: "field__sub" }, kname));
        for (const lang of ["en", "ru"]) {
          const cur = k ? variantOf(b.get(), lang, k) : langVal(b.get(), lang);
          const shown = opts.paragraphs ? parasToBox(cur) : toBox(cur);
          const t = box(shown, (val) => {
            const parsed = opts.paragraphs ? parasFromBox(val) : fromBox(val);
            const now = b.get();
            const other = lang === "en" ? "ru" : "en";
            if (k) {
              const next = { en: { ...variantObj(now, "en") }, ru: { ...variantObj(now, "ru") } };
              next[lang][k] = parsed; b.set(next);
            } else {
              const o = langVal(now, other);
              b.set(lang === "en" ? compact(parsed, o ?? parsed) : compact(o ?? parsed, parsed));
            }
          }, { big: opts.big || opts.paragraphs, rows: opts.paragraphs ? 4 : 1, lang });
          wrap.append(h("div", { class: "field__row" }, h("span", { class: "lang-chip" }, lang.toUpperCase()), t));
        }
      }
      if (opts.paragraphs) wrap.append(h("p", { class: "field__hint" }, "Leave an empty line between paragraphs."));
    };
    draw();
    return wrap;
  }
  const variantOf = (v, lang, k) => { const x = langVal(v, lang); return isObj(x) ? (x[k] ?? x.d) : x; };
  const variantObj = (v, lang) => { const x = langVal(v, lang); return isObj(x) ? x : { d: x, mt: x }; };

  /* Single value, same in both languages (link, colour, number, file path). opts: { label, hint, type: "url"|"color"|"text"|"number", placeholder } */
  function input(b, opts = {}) {
    const wrap = h("div", { class: "field" }, h("div", { class: "field__head" }, h("span", { class: "field__label" }, opts.label || "")));
    if (opts.hint) wrap.append(h("p", { class: "field__hint" }, opts.hint));
    const i = h("input", { class: "finput", type: opts.type === "number" ? "number" : "text", placeholder: opts.placeholder || null, step: opts.step || null });
    i.value = b.get() ?? "";
    const err = h("p", { class: "field__err error", hidden: true });
    i.addEventListener("input", () => {
      let v = i.value.trim();
      if (opts.type === "url" && v && !/^(https?:\/\/|mailto:|tel:|#|\.{0,2}\/|[\w-]+\/)/.test(v)) { err.hidden = false; err.textContent = "Links start with https://, mailto: or tel:"; return; }
      if (opts.type === "color" && v && !/^#[0-9a-f]{3,8}$/i.test(v)) { err.hidden = false; err.textContent = "Colours look like #541725"; return; }
      err.hidden = true;
      b.set(opts.type === "number" ? (v === "" ? undefined : +v) : v);
      if (sw) sw.value = /^#[0-9a-f]{6}$/i.test(v) ? v : sw.value;
    });
    let sw = null;
    const row = h("div", { class: "field__row" });
    if (opts.type === "color") {
      sw = h("input", { type: "color", class: "fswatch" }); sw.value = /^#[0-9a-f]{6}$/i.test(i.value) ? i.value : "#ffffff";
      sw.addEventListener("input", () => { i.value = sw.value; b.set(sw.value); });
      row.append(sw);
    }
    row.append(i); wrap.append(row, err);
    return wrap;
  }

  /* Choice from a list. opts: { label, options: [[value, label]] } */
  function select(b, opts) {
    const s = h("select", { class: "finput" }, opts.options.map(([v, l]) => h("option", { value: v }, l)));
    s.value = b.get() ?? opts.options[0][0];
    s.addEventListener("change", () => b.set(s.value));
    return h("div", { class: "field" }, h("div", { class: "field__head" }, h("span", { class: "field__label" }, opts.label)), s);
  }

  /* Editable list. b points at an array.
     opts: { label, fixed (no delete), thumb(value) → small element for the collapsed row, item(b, i) → element, summary(value, i) → string, make() → new item, addLabel, minItems, note } */
  function list(b, opts) {
    const wrap = h("div", { class: "flist" });
    const open = new Set();
    const draw = () => {
      wrap.innerHTML = "";
      const arr = b.get() || [];
      wrap.append(h("div", { class: "flist__head" }, h("span", { class: "field__label" }, opts.label || ""), h("span", { class: "small" }, `${arr.length} item${arr.length === 1 ? "" : "s"}`)));
      if (opts.note) wrap.append(h("p", { class: "field__hint" }, opts.note));
      arr.forEach((val, i) => {
        const move = (d) => { const a = (b.get() || []).slice(); const [x] = a.splice(i, 1); a.splice(i + d, 0, x); b.set(a);
          const wasOpen = open.has(i); open.delete(i); if (wasOpen) open.add(i + d); draw(); };
        const del = () => {
          if ((b.get() || []).length <= (opts.minItems || 0)) return alert(`Keep at least ${opts.minItems}.`);
          if (!confirm(`Delete “${(opts.summary ? opts.summary(val, i) : "this item").replace(/<[^>]+>/g, "")}”?`)) return;
          const a = (b.get() || []).slice(); a.splice(i, 1); b.set(a); open.clear(); draw(); };
        const d = h("details", { class: "fitem" });
        d.open = open.has(i);
        d.addEventListener("toggle", () => { d.open ? open.add(i) : open.delete(i); if (d.open && !d.dataset.filled) { d.dataset.filled = 1; d.append(h("div", { class: "fitem__body" }, opts.item(b.sub(i), i))); } });
        const sum = h("summary", { class: "fitem__sum" },
          opts.thumb ? opts.thumb(val, i) : null,
          h("span", { class: "fitem__title" }, (opts.summary ? opts.summary(val, i) : `Item ${i + 1}`).replace(/<br[^>]*>/g, " ").replace(/<[^>]+>/g, "") || `Item ${i + 1}`),
          h("span", { class: "fitem__tools" },
            h("button", { type: "button", class: "ibtn", title: "Move up", "aria-label": "Move up", disabled: i === 0 || null, onclick: (e) => { e.preventDefault(); move(-1); } }, "↑"),
            h("button", { type: "button", class: "ibtn", title: "Move down", "aria-label": "Move down", disabled: i === arr.length - 1 || null, onclick: (e) => { e.preventDefault(); move(1); } }, "↓"),
            opts.fixed ? null : h("button", { type: "button", class: "ibtn ibtn--del", title: "Delete", "aria-label": "Delete", onclick: (e) => { e.preventDefault(); del(); } }, "✕")));
        d.append(sum);
        // keep the title in the collapsed row in step with what's typed
        d.addEventListener("input", () => { const t = sum.querySelector(".fitem__title"), v = b.sub(i).get();
          t.textContent = (opts.summary ? opts.summary(v, i) : `Item ${i + 1}`).replace(/<br[^>]*>/g, " ").replace(/<[^>]+>/g, "") || `Item ${i + 1}`; });
        if (d.open) { d.dataset.filled = 1; d.append(h("div", { class: "fitem__body" }, opts.item(b.sub(i), i))); }
        wrap.append(d);
      });
      if (opts.make && opts.maxItems && arr.length >= opts.maxItems) wrap.append(h("p", { class: "field__hint" }, `That’s the maximum of ${opts.maxItems}.`));
      else if (opts.make) wrap.append(h("button", { type: "button", class: "secondary sm flist__add", onclick: () => {
        const a = (b.get() || []).slice(); a.push(opts.make()); b.set(a); open.add(a.length - 1); draw();
        const last = wrap.querySelectorAll(".fitem"); last[last.length - 1]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } }, opts.addLabel || "+ Add"));
    };
    draw();
    return wrap;
  }

  /* Media fields. Here they only show what is there; admin/cms/media.js (step D) replaces them with upload versions.
     image(b, {label, hint, kind}) where b holds a base path like "assets/img/x" (files x-sm.webp and x.webp)
     video(bVideo, bPoster, {label}) where the values are file paths */
  const mediaUrl = (p) => { const m = Store.state.draft && Store.state.draft.media && Store.state.draft.media[p]; return m ? URL.createObjectURL(m) : "../" + p; };
  function image(b, opts = {}) {
    const v = b.get();
    return h("div", { class: "field" }, h("div", { class: "field__head" }, h("span", { class: "field__label" }, opts.label || "Image")),
      v ? h("img", { class: "thumb", src: mediaUrl(v + "-sm.webp"), alt: "" }) : h("p", { class: "field__hint" }, "No image"));
  }
  function video(bv, bp, opts = {}) {
    const v = bv.get(), p = bp.get();
    return h("div", { class: "field" }, h("div", { class: "field__head" }, h("span", { class: "field__label" }, opts.label || "Video")),
      v ? h("video", { class: "thumb", src: mediaUrl(v), poster: p ? mediaUrl(p) : null, muted: true, playsinline: true }) : h("p", { class: "field__hint" }, "No video"));
  }

  /* Collapsible group of fields */
  // groups remember whether they were open (per page, for this browser session), so a rebuilt form looks the same
  const openGroups = (() => { try { return JSON.parse(sessionStorage.getItem("rarytu-groups") || "{}"); } catch { return {}; } })();
  function group(title, ...kids) {
    const key = location.hash + "|" + title;
    const d = h("details", { class: "fgroup" }, h("summary", {}, title), h("div", { class: "fgroup__body" }, ...kids));
    d.dataset.key = key;
    d.addEventListener("toggle", () => { openGroups[key] = d.open; try { sessionStorage.setItem("rarytu-groups", JSON.stringify(openGroups)); } catch {} });
    return d;
  }
  // open the first group by default, or whatever was open before
  function restoreGroups(el) { el.querySelectorAll(".fgroup").forEach((d, i) => { const k = d.dataset.key; d.open = k in openGroups ? openGroups[k] : i === 0; }); }
  const note = (txt) => h("p", { class: "field__hint" }, txt);

  window.F = { BREAKS_HINT, restoreGroups, h, at, pair, image, video, mediaUrl, text, input, select, list, group, note, esc, toBox, fromBox, parasToBox, parasFromBox, compact };
})();
