/* Site backups tab: save a ZIP of the whole site, restore from a ZIP, history of versions. Exposes window.Backups. */
(() => {
  const { REPO, LOG, isTool, HOSTING, stamp, fmtDate, fmtSize, esc, sleep, getToken, setToken, gh, askToken, needToken,
    gitSha, fingerprint, snapshot, readLog, versionFor, b64, commitTree, logBlob, appendEvent, getFile } = window.GH;
  const $ = (id) => document.getElementById(id);
  const status = $("status");
  const show = (html) => { status.innerHTML = html; status.hidden = false; status.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
  const setBar = (pct) => { const i = status.querySelector(".progress i"); if (i) i.style.width = pct.toFixed(1) + "%"; };
  const setStep = (t) => { const p = $("step"); if (p) p.textContent = t; };
  const busy = (on) => { $("backup").disabled = on; $("restore").disabled = on; };
  function fail(title, e) {
    if (e && e.status === 401) { setToken(""); show(`<h2 class="error">GitHub refused access</h2><p>The saved token has expired or was deleted. Add a new one below and try again.</p>`); askToken(); return; }
    show(`<h2 class="error">${esc(title)}</h2><p>${esc((e && e.message) || e)}</p><p class="small">Nothing on the site was changed.</p>`);
  }

  async function save(filename, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 120000);
  }
  async function backup() {
    busy(true);
    show('<h2>Making a backup…</h2><p id="step">Reading the site</p><div class="progress"><i></i></div>');
    try {
      const snap = await snapshot(), log = await readLog(snap.files);
      const v = log.versions.find((x) => x.fp === snap.fp)?.v || log.versions.reduce((m, x) => Math.max(m, x.v), 0) + 1;
      const zip = new JSZip(), queue = snap.files.slice(), N = queue.length; let done = 0, bytes = 0;
      const worker = async () => {
        for (let f; (f = queue.shift()); ) {
          const data = await getFile(snap.head, f.path, f.sha);
          zip.file(f.path, data, { binary: true, date: new Date(2020, 0, 1) }); bytes += data.length;
          setBar(++done / N * 80); setStep(`Downloading files: ${done} of ${N}`);
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
      const name = `rarytu-backup-v${v}-${stamp()}.zip`;
      zip.file("backup.json", JSON.stringify({ site: "rarytu", version: v, fingerprint: snap.fp, commit: snap.head, created: new Date().toISOString(), files: N, bytes }, null, 2));
      setStep("Packing the archive");
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }, (m) => setBar(80 + m.percent * 0.15));
      await save(name, blob);
      setStep("Adding it to the history"); setBar(97);
      const ev = await appendEvent((log2, s2) => ({ v: versionFor(log2, snap.fp), type: "backup", at: new Date().toISOString(), file: name }));
      show(`<h2>Backup v.${ev.v} saved</h2><p>${esc(name)}</p><p class="small">${N} files, ${fmtSize(blob.size)}. Your browser put it in Downloads.</p>`);
    } catch (e) { fail("Backup failed", e); }
    finally { busy(false); loadHistory(); }
  }
  $("backup").addEventListener("click", () => needToken(backup));

  // ---------- Restore: the whole site becomes exactly the backup ----------
  async function readBackup(file) {
    const zip = await JSZip.loadAsync(file);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir && !/(^|\/)(\.DS_Store$|__MACOSX\/)/.test(n));
    const first = names[0] || "", top = first.includes("/") ? first.split("/")[0] + "/" : "";
    const prefix = top && names.every((n) => n.startsWith(top)) ? top : "";   // everything inside one folder
    const files = names.map((n) => ({ path: n.slice(prefix.length), entry: zip.files[n] })).filter((f) => f.path && f.path !== "backup.json");
    const has = (p) => files.some((f) => f.path === p);
    let info = null; try { info = JSON.parse(await zip.file(prefix + "backup.json").async("string")); } catch {}
    const checks = [
      ["Home page", has("index.html")],
      ["English pages", ["en/index.html", "en/about/index.html", "en/approach/index.html"].every(has)],
      ["Russian pages", ["ru/index.html", "ru/about/index.html", "ru/approach/index.html"].every(has)],
      ["Styles and scripts", has("assets/styles.css") && has("assets/main.js")],
      ["Images", files.some((f) => f.path.startsWith("assets/img/"))],
    ];
    return { files, info, checks, valid: checks.every((c) => c[1]) };
  }
  let chosen = null;
  $("restore").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", async (ev) => {
    const file = ev.target.files[0]; ev.target.value = "";
    if (!file) return;
    show('<h2>Checking the backup…</h2><p>' + esc(file.name) + '</p><div class="progress"><i style="width:30%"></i></div>');
    try {
      const b = await readBackup(file); chosen = { file, ...b };
      const site = b.files.filter((f) => !isTool(f.path)).length;
      show(`<h2>${b.valid ? (b.info && b.info.version ? `Backup v.${b.info.version}` : "This backup looks complete") : "This doesn’t look like a full site backup"}</h2>
        <p>${esc(file.name)}: ${site} files${b.info && b.info.created ? ", made " + esc(fmtDate(b.info.created)) : ""}</p>
        <ul class="checks">${b.checks.map((c) => `<li class="${c[1] ? "ok" : "bad"}">${c[0]}</li>`).join("")}</ul>
        ${b.valid ? `<p class="note" style="margin-top:14px">The whole site will be replaced with this backup: changed files are put back, added files are removed.</p>
        <div class="row"><button class="primary" id="do-restore" type="button">Restore this backup</button></div>` : ""}`);
      const btn = $("do-restore"); if (btn) btn.addEventListener("click", () => needToken(restore));
    } catch (e) { show(`<h2 class="error">Can’t open this file</h2><p>${esc(file.name)} is not a readable ZIP archive.</p>`); }
  });

  async function restore() {
    const b = chosen; if (!b) return;
    busy(true);
    show('<h2>Restoring…</h2><p id="step">Reading the backup</p><div class="progress"><i></i></div>');
    try {
      // 1. hash every file in the backup
      const site = [];
      for (const [i, f] of b.files.filter((f) => !isTool(f.path)).entries()) {
        const bytes = new Uint8Array(await f.entry.async("uint8array"));
        site.push({ path: f.path, bytes, sha: await gitSha(bytes) });
        if (i % 10 === 0) { setBar(i / b.files.length * 20); setStep(`Reading the backup: ${i} files`); }
      }
      let result;
      for (let n = 1; n <= 4 && !result; n++) {
        // 2. compare with the site as it is right now
        setStep("Comparing with the live site");
        const snap = await snapshot(), now = new Map(snap.files.map((f) => [f.path, f.sha]));
        const changed = site.filter((f) => now.get(f.path) !== f.sha);
        const removed = snap.files.filter((f) => !isTool(f.path) && !HOSTING.has(f.path) && !site.some((s) => s.path === f.path));
        // 3. upload only files that differ, a few at a time
        let up = 0; const queue = changed.slice();
        await Promise.all(Array.from({ length: 4 }, async () => {
          for (let f; (f = queue.shift()); ) {
            const r = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: b64(f.bytes), encoding: "base64" }) });
            if (r.sha !== f.sha) throw new Error(`GitHub received ${f.path} damaged. Try again.`);
            setBar(20 + ++up / Math.max(1, changed.length) * 70); setStep(`Uploading files: ${up} of ${changed.length}`);
          }
        }));
        // 4. the new site: every file from the backup, the backup tool as it is now, hosting files the backup lacks
        const entries = site.map((f) => ({ path: f.path, sha: f.sha }))
          .concat(snap.files.filter((f) => isTool(f.path) && f.path !== LOG).map((f) => ({ path: f.path, sha: f.sha, mode: f.mode })))
          .concat(snap.files.filter((f) => HOSTING.has(f.path) && !site.some((s) => s.path === f.path)).map((f) => ({ path: f.path, sha: f.sha, mode: f.mode })));
        const log = await readLog(snap.files), fp = await fingerprint(entries);
        if (fp === snap.fp) { result = { same: true, v: versionFor(log, fp) }; break; }
        const v = versionFor(log, fp);
        log.events.push({ v, type: "restore", at: new Date().toISOString(), file: b.file.name });
        entries.push({ path: LOG, sha: await logBlob(log) });
        setStep("Saving the new version"); setBar(95);
        try { await commitTree(entries, snap.head, `Restore v.${v} from ${b.file.name}`); result = { v, changed: changed.length, removed: removed.length }; }
        catch (e) { if (e.status !== 422 || n === 4) throw e; await sleep(600 * n); }   // the site changed meanwhile: start over
      }
      // 5. check that the live repository now matches the backup exactly
      const check = await snapshot();
      const want = await fingerprint(site.map((f) => ({ path: f.path, sha: f.sha })).concat(check.files.filter((f) => HOSTING.has(f.path) && !site.some((s) => s.path === f.path))));
      if (check.fp !== want) throw new Error("After restoring, the site doesn’t match the backup. Try once more; if it repeats, tell Claude.");
      setBar(100);
      if (result.same) {
        await appendEvent(() => ({ v: result.v, type: "restore", at: new Date().toISOString(), file: b.file.name }));
        show(`<h2>Site restored to v.${result.v}</h2><p>The site already matched this backup, nothing needed to change.</p>`);
      } else show(`<h2>Site restored to v.${result.v}</h2><p>${result.changed} files put back${result.removed ? ", " + result.removed + " removed" : ""}. GitHub Pages publishes it in 1–2 minutes; then refresh the site.</p>`);
    } catch (e) { fail("Restore failed", e); }
    finally { busy(false); loadHistory(); }
  }

  // ---------- History ----------
  async function loadHistory() {
    const rows = $("history-rows"), live = $("live");
    try {
      const snap = await snapshot(), log = await readLog(snap.files);
      const active = log.versions.find((x) => x.fp === snap.fp);
      const last = log.versions.reduce((m, x) => Math.max(m, x.v), 0);
      live.innerHTML = active ? `Live now: v.${active.v}`
        : last ? `Live now: a newer version with changes made after v.${last}. Save a backup to keep it as v.${last + 1}.`
        : "No backups yet.";
      let marked = false;
      rows.innerHTML = log.events.length ? log.events.slice().reverse().map((e) => {
        const on = !marked && active && e.v === active.v; if (on) marked = true;
        return `<tr><td class="v">v.${e.v}${on ? '<span class="tag">active</span>' : ""}</td>
          <td>${e.type === "backup" ? "Backup downloaded" : "Site restored"}</td>
          <td class="small">${esc(e.file || "")}</td><td>${esc(fmtDate(e.at))}</td></tr>`;
      }).join("") : `<tr><td colspan="4" class="small">The history starts with your first backup.</td></tr>`;
    } catch (e) {
      live.innerHTML = "&nbsp;";
      rows.innerHTML = `<tr><td colspan="4" class="small">${e.status === 403 && !getToken() ? "GitHub limits requests without a token. Connect GitHub to see the history." : "Couldn’t load the history from GitHub (" + esc(e.message) + ")."}</td></tr>`;
    }
  }
  window.Backups = { open: loadHistory };
})();
