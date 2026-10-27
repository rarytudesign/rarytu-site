/* Publish: turn the draft into one commit on GitHub. Exposes window.Publish.
   1. check the draft (missing covers, empty images, empty titles)
   2. warn when files in the draft were changed on the site after the draft started
   3. render every page, upload only changed files and new media, remove pages of hidden/deleted projects
   4. one commit with a full tree (+ history event "publish"), then check the result and clear the draft */
(() => {
  const { h } = F;
  const WORK = "content/pages/work.json";
  const enc = new TextEncoder();
  const json = (v) => JSON.stringify(v, null, 2) + "\n";
  const tabOf = (path) => { const m = path.match(/^content\/(?:pages\/(\w+)|cases\/([\w-]+))\.json$/); return m ? (m[1] ? "#" + m[1] : "#project/" + m[2]) : path === "content/site.json" ? "#site" : ""; };
  const nameOf = (path) => { const t = tabOf(path); if (t.startsWith("#project/")) { const c = Store.get(path) || Store.state.published[path]; return c ? (c.name.en || c.name) : t.slice(9); }
    return { "#site": "Site", "#work": "Work", "#about": "About", "#approach": "Approach" }[t] || path; };
  const enOf = (v) => (v && typeof v === "object" ? (v.en ?? "") : (v ?? ""));

  // ---------- 1. checks ----------
  function problems() {
    const out = [], w = Store.get(WORK);
    for (const slug of w.projects) {
      const c = Store.get(Store.caseFile(slug)), tab = "#project/" + slug, n = c ? enOf(c.name) || slug : slug;
      if (!c) { out.push({ tab, text: `${slug}: the project file is missing.` }); continue; }
      if (!c.cover) out.push({ tab, text: `${n}: no cover for the Work page.` });
      if (!enOf(c.title) || !(c.title.ru ?? c.title)) out.push({ tab, text: `${n}: the title is empty in one of the languages.` });
      if (!(c.hero && (c.hero.image || c.hero.video))) out.push({ tab, text: `${n}: no big image at the top of the page.`, soft: true });
      (c.gallery || []).forEach((g, i) => { if (!g.image && !g.video) out.push({ tab, text: `${n}: gallery item ${i + 1} has no file.` }); });
    }
    const a = Store.get("content/pages/about.json");
    (a.photos.items || []).forEach((p, i) => { if (!p.image) out.push({ tab: "#about", text: `About: photo ${i + 1} has no file.` }); });
    return out;
  }

  // ---------- 3. build the new tree ----------
  async function build(snap, onStep) {
    const draft = Store.state.draft, now = new Map(snap.files.map((f) => [f.path, f]));
    const out = new Map(snap.files.map((f) => [f.path, { path: f.path, sha: f.sha, mode: f.mode }]));
    const uploads = [];   // { path, bytes } still to send
    const put = async (path, bytes) => { const sha = await GH.gitSha(bytes); if (!now.has(path) || now.get(path).sha !== sha) uploads.push({ path, bytes, sha }); out.set(path, { path, sha }); };

    onStep("Preparing the content");
    for (const [path, v] of Object.entries(draft.files)) {
      if (v === null) out.delete(path); else await put(path, enc.encode(json(v)));
    }
    for (const [path, blob] of Object.entries(draft.media || {})) await put(path, new Uint8Array(await blob.arrayBuffer()));

    onStep("Building the pages");
    const site = Store.read("content/site.json"), work = Store.read(WORK);
    const pages = RarytuRender.listPages(work);
    for (const p of pages) await put(p.path, enc.encode(RarytuRender.renderPage(p, { site, read: Store.read })));
    // pages of projects that are no longer listed go away
    const keep = new Set(pages.map((p) => p.path));
    for (const path of [...out.keys()]) if (/^(en|ru)\/work\/[^/]+\/index\.html$/.test(path) && !keep.has(path)) out.delete(path);
    const removed = snap.files.filter((f) => !out.has(f.path)).map((f) => f.path);
    return { out, uploads, removed, pages };
  }

  async function run(ui) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      ui.step("Reading the live site"); ui.bar(3);
      const snap = await GH.snapshot();
      const { out, uploads, removed } = await build(snap, ui.step);
      if (!uploads.length && !removed.length) return { nothing: true };
      // upload, a few at a time; GitHub returns the same id we computed, which proves the file arrived whole
      let done = 0; const queue = uploads.slice();
      await Promise.all(Array.from({ length: 4 }, async () => {
        for (let f; (f = queue.shift()); ) {
          ui.step(`Uploading ${f.path.split("/").pop()} (${done + 1} of ${uploads.length})`);
          const r = await GH.gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: GH.b64(f.bytes), encoding: "base64" }) });
          if (r.sha !== f.sha) throw new Error(`GitHub received ${f.path} damaged. Try again.`);
          ui.bar(5 + (++done / uploads.length) * 85);
        }
      }));
      // version and history
      const entries = [...out.values()].filter((e) => e.path !== GH.LOG);
      const fp = await GH.fingerprint(entries), log = await GH.readLog(snap.files), v = GH.versionFor(log, fp);
      const pagesChanged = uploads.filter((u) => /\.html$/.test(u.path)).length;
      log.events.push({ v, type: "publish", at: new Date().toISOString(), file: `${pagesChanged} page${pagesChanged === 1 ? "" : "s"} updated` });
      entries.push({ path: GH.LOG, sha: await GH.logBlob(log) });
      ui.step("Saving the new version"); ui.bar(93);
      const names = [...new Set(Object.keys(Store.state.draft.files).map(nameOf))].join(", ");
      try {
        const sha = await GH.commitTree(entries, snap.head, `Publish v.${v} from the admin panel: ${names || "media"}`);
        // check: the repository now holds exactly what we built
        const check = await GH.snapshot();
        if (check.fp !== fp) throw new Error("After publishing, the site doesn’t match the draft. Nothing is lost: the draft is still here. Try again.");
        return { sha, v, files: uploads.length, removed: removed.length, pagesChanged };
      } catch (e) { if (e.status !== 422 || attempt === 4) throw e; await GH.sleep(700 * attempt); }   // the site changed meanwhile: start over
    }
  }

  // ---------- dialog ----------
  let dlg = null;
  function dialog(html) {
    if (!dlg) { dlg = h("dialog", { class: "dlg" }); document.body.append(dlg); dlg.addEventListener("cancel", (e) => { if (dlg.dataset.busy) e.preventDefault(); }); }
    dlg.innerHTML = html; if (!dlg.open) dlg.showModal(); return dlg;
  }
  const close = () => dlg && dlg.close();

  async function open() {
    // make sure we compare against the site as it is right now
    try { await Store.load(); } catch (e) { return dialog(`<h2 class="error">Can’t reach the site</h2><p>${GH.esc(e.message)}</p><div class="row"><button class="secondary" data-x>Close</button></div>`).querySelector("[data-x]").onclick = close; }
    const files = Store.changed(), media = Store.mediaChanged();
    const probs = problems(), hard = probs.filter((p) => !p.soft), soft = probs.filter((p) => p.soft), conflicts = Store.conflicts();
    const list = [...new Set(files.map(nameOf))];
    const d = dialog(`<h2>Publish changes</h2>
      <p>${list.length ? "Changed: " + GH.esc(list.join(", ")) : ""}${media.length ? `${list.length ? ". " : ""}${media.length} new file${media.length === 1 ? "" : "s"}` : ""}.</p>
      ${hard.length ? `<p class="error"><b>Fix these first:</b></p><ul class="probs">${hard.map((p) => `<li><a href="${p.tab}" data-x>${GH.esc(p.text)}</a></li>`).join("")}</ul>` : ""}
      ${soft.length ? `<p class="note">Worth a look:</p><ul class="probs">${soft.map((p) => `<li><a href="${p.tab}" data-x>${GH.esc(p.text)}</a></li>`).join("")}</ul>` : ""}
      ${conflicts.length ? `<p class="note"><b>${GH.esc(conflicts.map(nameOf).join(", "))}</b> changed on the site after you started this draft (for example, Claude edited ${conflicts.length === 1 ? "it" : "them"}). Publishing replaces those changes with your version.</p>` : ""}
      <p class="small">The site updates 1–2 minutes after publishing. The current version stays in Site backups history.</p>
      <div class="row"><button class="primary" data-go ${hard.length ? "disabled" : ""}>${conflicts.length ? "Publish anyway" : "Publish"}</button><button class="secondary" data-x>Cancel</button></div>`);
    d.querySelectorAll("[data-x]").forEach((x) => x.addEventListener("click", close));
    d.querySelector("[data-go]").addEventListener("click", () => { if (GH.getToken()) go(); else { close(); GH.askToken(go); } });
  }

  async function go() {
    const d = dialog(`<h2>Publishing…</h2><p id="pub-step">Starting</p><div class="progress"><i id="pub-bar"></i></div>`);
    d.dataset.busy = 1;
    const ui = { step: (t) => { const p = d.querySelector("#pub-step"); if (p) p.textContent = t; }, bar: (x) => { const i = d.querySelector("#pub-bar"); if (i) i.style.width = x.toFixed(1) + "%"; } };
    try {
      const r = await run(ui);
      delete d.dataset.busy;
      if (r.nothing) { await Store.discard(); dialog(`<h2>Nothing to publish</h2><p>The site already shows exactly this. The draft was cleared.</p><div class="row"><button class="primary" data-x>OK</button></div>`); }
      else {
        const files = {}; for (const [p, v] of Object.entries(Store.state.draft.files)) files[p] = v;
        await Store.published(r.sha, files);
        for (const [p, v] of Object.entries(files)) if (v === null) delete Store.state.published[p];
        dialog(`<h2>Published v.${r.v}</h2><p>${r.pagesChanged} page${r.pagesChanged === 1 ? "" : "s"} updated${r.removed ? `, ${r.removed} file${r.removed === 1 ? "" : "s"} removed` : ""}. The site shows the changes in 1–2 minutes.</p>
          <div class="row"><a class="btnlink primary" href="../index.html" target="_blank" rel="noopener">Open the site ↗</a><button class="secondary" data-x>Close</button></div>`);
        App.route();
      }
    } catch (e) {
      delete d.dataset.busy;
      if (e.status === 401 || e.status === 403) { GH.setToken(""); close(); GH.askToken(go); return; }
      dialog(`<h2 class="error">Not published</h2><p>${GH.esc(e.message || e)}</p><p class="small">The site wasn’t changed and your draft is safe. Try again in a minute.</p><div class="row"><button class="primary" data-retry>Try again</button><button class="secondary" data-x>Close</button></div>`)
        .querySelector("[data-retry]").addEventListener("click", go);
    }
    dlg.querySelectorAll("[data-x]").forEach((x) => x.addEventListener("click", close));
  }

  document.getElementById("publish").addEventListener("click", open);
  window.Publish = { open, problems, build, run };
})();
