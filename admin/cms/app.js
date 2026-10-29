/* Admin panel shell: loading content, tabs and routing, draft status.
   Routes: #site #work #about #approach #project/<slug> #new-project #backups */
(() => {
  const $ = (id) => document.getElementById(id);
  const TITLES = { site: "Site", work: "Work", about: "About", approach: "Approach", "new-project": "New project" };
  let ready = false, loadError = null;

  const projectName = (slug) => { const c = Store.get(Store.caseFile(slug)); return c ? (typeof c.name === "object" ? c.name.en : c.name) : slug; };

  function renderTabs() {
    const work = Store.get("content/pages/work.json");
    const changed = new Set(Store.changed());
    const mark = (files) => files.some((f) => changed.has(f)) ? '<i class="dot" title="Changed in the draft"></i>' : "";
    $("tabs-projects").innerHTML = work ? work.projects.map((slug) =>
      `<a href="#project/${slug}"><span>${GH.esc(projectName(slug))}</span>${mark([Store.caseFile(slug)])}</a>`).join("")
      + (work.hidden || []).map((slug) => `<a href="#project/${slug}" class="tabs__hidden" title="Hidden from the site"><span>${GH.esc(projectName(slug))}</span>${mark([Store.caseFile(slug)])}</a>`).join("") : "";
    const pageFiles = { site: ["content/site.json"], work: ["content/pages/work.json"], about: ["content/pages/about.json"], approach: ["content/pages/approach.json"] };
    for (const [k, files] of Object.entries(pageFiles)) {
      const a = document.querySelector(`#tabs a[href="#${k}"]`);
      if (a) a.innerHTML = `<span>${TITLES[k]}</span>${mark(files)}`;
    }
    markCurrent();
  }

  function renderDraftState() {
    const pages = Store.changed().length, files = Store.mediaChanged().length, dirty = Store.isDirty();
    const parts = [pages && `${pages} page${pages === 1 ? "" : "s"} changed`, files && `${files} new file${files === 1 ? "" : "s"}`].filter(Boolean).join(", ");
    $("draft-state").textContent = !ready ? (loadError ? "Content not loaded" : "Loading…")
      : dirty ? `Draft: ${parts}, not published` : "All changes published";
    $("discard").hidden = !dirty;
    $("publish").disabled = !dirty;
  }

  function markCurrent() {
    const hash = "#" + (decodeURIComponent(location.hash.slice(1)) || "work");
    document.querySelectorAll("#tabs a").forEach((a) => a.getAttribute("href") === hash ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  }

  function route() {
    const hash = decodeURIComponent(location.hash.slice(1)) || "work";
    markCurrent();
    const isBackups = hash === "backups";
    $("view-backups").hidden = !isBackups;
    $("view-editor").hidden = isBackups;
    if (isBackups) { Backups.open(); document.title = "Site backups · Admin"; return; }
    const title = hash.startsWith("project/") ? projectName(hash.slice(8)) : (TITLES[hash] || hash);
    document.title = title + " · Admin";
    const box = $("view-editor");
    if (loadError) { box.innerHTML = `<div class="placeholder"><h1>${GH.esc(title)}</h1><p class="error">${GH.esc(loadError.message)}</p><p>Restore a newer backup in Site backups, or ask Claude to rebuild the content from the pages.</p></div>`; return; }
    if (!ready) { box.innerHTML = `<div class="placeholder"><h1>${GH.esc(title)}</h1><p>Loading the site’s content…</p></div>`; return; }
    if (window.Editors && Editors.open(hash, box)) return;
    box.innerHTML = `<div class="placeholder"><h1>${GH.esc(title)}</h1><p>The editor for this page is being built. Until then, edits go through Claude.</p></div>`;
  }

  $("discard").addEventListener("click", async () => {
    if (!confirm("Throw away all unpublished changes? The site stays as it is now.")) return;
    await Store.discard(); route();
  });

  // ---------- undo / redo ----------
  function afterHistory() {
    // keep the cursor in the same field if possible
    const form = document.getElementById("ed-form"), boxes = form ? [...form.querySelectorAll("textarea, input")] : [];
    const i = boxes.indexOf(document.activeElement);
    if (window.Editors && document.getElementById("ed-form")) Editors.refresh(); else route();
    if (i >= 0) { const nb = [...document.getElementById("ed-form").querySelectorAll("textarea, input")][i]; if (nb) { nb.focus(); try { nb.setSelectionRange(nb.value.length, nb.value.length); } catch {} } }
  }
  const doUndo = () => { if (Store.undo()) afterHistory(); };
  const doRedo = () => { if (Store.redo()) afterHistory(); };
  $("undo").addEventListener("click", doUndo);
  $("redo").addEventListener("click", doRedo);
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "z") { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
    else if (k === "y" && !e.metaKey) { e.preventDefault(); doRedo(); }
  }, true);
  const renderHistory = () => { $("undo").disabled = !Store.canUndo(); $("redo").disabled = !Store.canRedo(); };

  Store.on(() => { renderTabs(); renderDraftState(); renderHistory(); });
  addEventListener("hashchange", route);
  addEventListener("beforeunload", () => {});  // drafts are saved continuously, nothing to warn about

  renderDraftState(); route();
  // with a remembered device the token is decrypted first, so the content comes straight from GitHub
  (window.Auth ? Auth.ready : Promise.resolve()).then(() => Store.load()).then(() => {
    ready = true;
    const d = Store.state.draft;
    if (d && Store.conflicts().length) {
      const names = Store.conflicts().map((p) => p.replace(/^content\/(pages\/|cases\/)?|\.json$/g, "")).join(", ");
      $("draft-state").title = `Changed on the site since your draft started: ${names}`;
    }
  }).catch((e) => { loadError = e; console.error(e); })
    .finally(() => { renderTabs(); renderDraftState(); route(); });

  window.App = { route };
})();
