/* Shared GitHub access for the admin panel: token, API calls, file ids, versions and the history log.
   Used by backups.js and (later) publishing. Exposes window.GH. */
(() => {
  // The site lives in this GitHub repository; GitHub Pages publishes its main branch.
  const params = new URLSearchParams(location.search);
  const REPO = { owner: "rarytudesign", name: "rarytu-site", branch: params.get("branch") || "main" };
  const API = `https://api.github.com/repos/${REPO.owner}/${REPO.name}`;
  const RAW = `https://raw.githubusercontent.com/${REPO.owner}/${REPO.name}`;
  const LOG = "admin/history.json";
  // The backup tool itself (admin/) is not part of a version and is never rolled back by a restore,
  // so restoring an old backup can't take away the ability to restore. Hosting files are kept if a backup lacks them.
  const isTool = (p) => p.startsWith("admin/");
  const HOSTING = new Set(["CNAME", ".nojekyll", "README.md", ".gitignore"]);

  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const fmtDate = (iso) => { const d = new Date(iso); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + ", " + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  const fmtSize = (b) => b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const enc = new TextEncoder();

  // ---------- GitHub access ----------
  // the token lives in auth.js (unlocked by the sign-in, kept encrypted on a remembered device)
  const getToken = () => (window.Auth ? Auth.token() : "");
  const setToken = (t) => { if (window.Auth) Auth.setToken(t); };
  async function gh(path, opts = {}, tries = 3) {
    for (let n = 1; ; n++) {
      let r;
      try {
        r = await fetch(API + path, { ...opts, cache: "no-store", headers: {
          Accept: "application/vnd.github+json",
          ...(getToken() ? { Authorization: "Bearer " + getToken() } : {}),
          ...(opts.body ? { "Content-Type": "application/json" } : {}) } });
      } catch (e) { if (n < tries) { await sleep(800 * n); continue; } throw new Error("No connection to GitHub. Check the internet and try again."); }
      if (r.ok) return r.status === 204 ? null : r.json();
      if (r.status >= 500 && n < tries) { await sleep(800 * n); continue; }
      const e = new Error((await r.json().catch(() => ({}))).message || ("GitHub " + r.status)); e.status = r.status; throw e;
    }
  }
  let afterToken = null;
  function askToken(then) {
    afterToken = then || null;
    if (window.Auth) { const f = afterToken; afterToken = null; Auth.expired(f); return; }   // a new token goes through the sign-in screen, so every device gets it
    $("token").hidden = false; $("token-msg").textContent = "";
    $("token-input").focus(); $("token").scrollIntoView({ block: "center", behavior: "smooth" });
  }
  const needToken = (then) => getToken() ? then() : askToken(then);
  $("token-change").addEventListener("click", () => (window.Auth ? Auth.settings() : askToken()));
  $("token-save").addEventListener("click", async () => {
    const t = $("token-input").value.trim(), msg = $("token-msg");
    if (!t) { setToken(""); msg.textContent = "Token removed from this browser."; return; }
    setToken(t); msg.textContent = "Checking…";
    try {
      await gh("");
      // a harmless write (an empty file object nothing points to) proves the token can write
      await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: "", encoding: "utf-8" }) }).catch((e) => {
        throw new Error(e.status === 403 || e.status === 404 ? "This token can’t write to rarytu-site. Check step 2 (rarytu-site is selected) and step 3 (Contents: Read and write), or make a new token." : e.message);
      });
      msg.textContent = "Connected."; $("token-input").value = "";
      setTimeout(() => { $("token").hidden = true; const f = afterToken; afterToken = null; if (f) f(); }, 600);
    } catch (e) { setToken(""); msg.innerHTML = `<span class="error">${esc(e.status === 401 ? "GitHub didn’t accept this token. Check that it was copied whole." : e.message)}</span>`; }
  });

  // ---------- versions ----------
  // git's id for a file: SHA-1 of "blob <size>\0<bytes>"
  async function gitSha(bytes) {
    const head = enc.encode("blob " + bytes.length + "\0"), all = new Uint8Array(head.length + bytes.length);
    all.set(head); all.set(bytes, head.length);
    return hex(await crypto.subtle.digest("SHA-1", all));
  }
  const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
  // A version is the exact set of site files: same files, same content, same version.
  async function fingerprint(entries) {
    const lines = entries.filter((e) => !isTool(e.path)).map((e) => e.path + " " + e.sha).sort().join("\n");
    return hex(await crypto.subtle.digest("SHA-256", enc.encode(lines))).slice(0, 16);
  }
  async function snapshot() {
    const ref = await gh(`/git/ref/heads/${REPO.branch}`);
    const commit = await gh(`/git/commits/${ref.object.sha}`);
    const tree = await gh(`/git/trees/${commit.tree.sha}?recursive=1`);
    if (tree.truncated) throw new Error("The site has too many files for one request.");
    const files = tree.tree.filter((t) => t.type === "blob");
    return { head: ref.object.sha, files, fp: await fingerprint(files) };
  }
  async function readLog(files) {
    const f = files.find((t) => t.path === LOG);
    if (!f) return { versions: [], events: [] };
    const blob = await gh(`/git/blobs/${f.sha}`);
    const text = new TextDecoder().decode(Uint8Array.from(atob(blob.content.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
    try { const j = JSON.parse(text); return { versions: j.versions || [], events: j.events || [] }; } catch { return { versions: [], events: [] }; }
  }
  function versionFor(log, fp) {
    let v = log.versions.find((x) => x.fp === fp);
    if (!v) { v = { v: log.versions.reduce((m, x) => Math.max(m, x.v), 0) + 1, fp, at: new Date().toISOString() }; log.versions.push(v); }
    return v.v;
  }
  function b64(bytes) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }

  // Commit a full new tree on top of `head`. Fails (422) if someone changed the site meanwhile; callers retry from a fresh snapshot.
  async function commitTree(entries, head, message) {
    const tree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ tree: entries.map((e) => ({ path: e.path, mode: e.mode || "100644", type: "blob", sha: e.sha })) }) });
    const commit = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: tree.sha, parents: [head] }) });
    await gh(`/git/refs/heads/${REPO.branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) }, 1);
    return commit.sha;
  }
  async function logBlob(log) {
    return (await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: JSON.stringify(log, null, 2) + "\n", encoding: "utf-8" }) })).sha;
  }
  // Adding a line to the history changes only admin/history.json, so the site version stays the same.
  async function appendEvent(make) {
    for (let n = 1; n <= 4; n++) {
      const snap = await snapshot(), log = await readLog(snap.files), ev = make(log, snap);
      log.events.push(ev);
      const entries = snap.files.filter((f) => f.path !== LOG).concat([{ path: LOG, sha: await logBlob(log) }]);
      try { await commitTree(entries, snap.head, `History: v.${ev.v} ${ev.type === "backup" ? "backed up" : "restored"}`); return ev; }
      catch (e) { if (e.status !== 422 || n === 4) throw e; await sleep(500 * n); }
    }
  }

  // ---------- Back up: the exact files of the live version, checked one by one ----------
  async function getFile(sha, path, expect) {
    for (let n = 1; n <= 3; n++) {
      try {
        const r = await fetch(`${RAW}/${sha}/${path.split("/").map(encodeURIComponent).join("/")}`, { cache: "no-store" });
        if (!r.ok) throw new Error(r.status);
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (await gitSha(bytes) === expect) return bytes;
        throw new Error("damaged in transfer");
      } catch (e) { if (n === 3) throw new Error(`Couldn’t download ${path} (${e.message}). Try again in a minute.`); await sleep(700 * n); }
    }
  }

  window.GH = { REPO, API, RAW, LOG, isTool, HOSTING, pad, stamp, fmtDate, fmtSize, esc, sleep, enc,
    getToken, setToken, gh, askToken, needToken, gitSha, hex, fingerprint, snapshot, readLog, versionFor, b64,
    commitTree, logBlob, appendEvent, getFile };
})();
