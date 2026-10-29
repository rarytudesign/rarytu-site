/* Sign-in for the admin panel. Exposes window.Auth (load before github.js).

   The panel can only change the site with Nastya's GitHub token. There is no server to check a password, so the password
   protects the token itself: admin/auth.json holds the token encrypted with a key made from the login and password
   (PBKDF2-SHA-256, 600 000 rounds, AES-GCM). Without the right pair it can't be decrypted, so the screen can't be skipped.

   "Remember this device": the token is stored in this browser encrypted with a key the browser keeps and never lets
   be read out (a non-extractable CryptoKey in IndexedDB). Sign out removes both. A remembered device stays signed in
   for 180 days from the last visit. Without "remember", the sign-in lasts until the tab is closed. */
(() => {
  const DEVICE = "rarytu-auth-device", PLAIN = "rarytu-gh-token", DAYS = 180, ROUNDS = 600000;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };
  const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} } };

  let token = "", remembered = false, vault = null, vaultLoaded = false;
  document.documentElement.classList.add("auth-locked");

  // ---------- the device key (IndexedDB, can't be read out) ----------
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open("rarytu-auth", 1); r.onupgradeneeded = () => r.result.createObjectStore("k"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function deviceKey(create) {
    const db = await idb();
    const get = () => new Promise((res) => { const q = db.transaction("k").objectStore("k").get("key"); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
    let key = await get();
    if (!key && create) {
      key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      await new Promise((res) => { const t = db.transaction("k", "readwrite"); t.objectStore("k").put(key, "key"); t.oncomplete = res; t.onerror = res; });
    }
    db.close(); return key;
  }
  async function dropDeviceKey() { try { const db = await idb(); await new Promise((res) => { const t = db.transaction("k", "readwrite"); t.objectStore("k").delete("key"); t.oncomplete = res; t.onerror = res; }); db.close(); } catch {} }
  async function saveOnDevice(t, remember) {
    const key = await deviceKey(true), iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(t));
    const rec = JSON.stringify({ iv: b64(iv), data: b64(data), until: Date.now() + DAYS * 864e5 });
    if (remember) { ls.set(DEVICE, rec); ss.set(DEVICE, null); } else { ss.set(DEVICE, rec); ls.set(DEVICE, null); }
    remembered = remember;
  }
  async function readDevice() {
    for (const [store, rem] of [[ls, true], [ss, false]]) {
      const raw = store.get(DEVICE); if (!raw) continue;
      try {
        const r = JSON.parse(raw); if (rem && r.until < Date.now()) { store.set(DEVICE, null); continue; }
        const key = await deviceKey(false); if (!key) continue;
        const t = dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(r.iv) }, key, unb64(r.data)));
        if (rem) { r.until = Date.now() + DAYS * 864e5; store.set(DEVICE, JSON.stringify(r)); }   // 180 days from the last visit
        remembered = rem; return t;
      } catch { store.set(DEVICE, null); }
    }
    return "";
  }

  // ---------- the vault (admin/auth.json) ----------
  async function passKey(login, password, salt, rounds) {
    const base = await crypto.subtle.importKey("raw", enc.encode(login.trim().toLowerCase() + "\n" + password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: rounds, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function loadVault() {
    try { const r = await fetch("auth.json?t=" + Date.now(), { cache: "no-store" }); vault = r.ok ? await r.json() : null; } catch { vault = null; }
    vaultLoaded = true; return vault;
  }
  async function openVault(login, password) {
    const key = await passKey(login, password, unb64(vault.salt), vault.rounds);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(vault.iv) }, key, unb64(vault.data));
    return JSON.parse(dec.decode(plain)).token;
  }
  async function makeVault(login, password, t) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await passKey(login, password, salt, ROUNDS);
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify({ token: t, at: new Date().toISOString() })));
    return { v: 1, kdf: "PBKDF2-SHA-256", rounds: ROUNDS, salt: b64(salt), iv: b64(iv), data: b64(data),
      note: "Sign-in for the admin panel: the GitHub token, encrypted with the login and password. Useless without them." };
  }
  async function writeVault(v, t) {
    const repo = (window.GH && GH.REPO) || { owner: "rarytudesign", name: "rarytu-site", branch: "main" };
    const api = `https://api.github.com/repos/${repo.owner}/${repo.name}/contents/admin/auth.json`;
    const h = { Accept: "application/vnd.github+json", Authorization: "Bearer " + t, "Content-Type": "application/json" };
    const cur = await fetch(api + "?ref=" + repo.branch, { headers: h, cache: "no-store" });
    const sha = cur.ok ? (await cur.json()).sha : undefined;
    const body = JSON.stringify({ message: "Admin sign-in updated", branch: repo.branch, sha,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(v, null, 2) + "\n"))) });
    const r = await fetch(api, { method: "PUT", headers: h, body });
    if (!r.ok) { const e = new Error((await r.json().catch(() => ({}))).message || "GitHub " + r.status); e.status = r.status; throw e; }
    vault = v;
  }
  // a token that can read and write the repository (the same check as the GitHub access box)
  async function checkToken(t) {
    const repo = (window.GH && GH.REPO) || { owner: "rarytudesign", name: "rarytu-site" };
    const api = `https://api.github.com/repos/${repo.owner}/${repo.name}`, h = { Accept: "application/vnd.github+json", Authorization: "Bearer " + t };
    const a = await fetch(api, { headers: h, cache: "no-store" });
    if (a.status === 401) throw new Error("GitHub didn’t accept this token: it has expired or was copied incompletely.");
    if (!a.ok) throw new Error("This token can’t open rarytu-site.");
    const w = await fetch(api + "/git/blobs", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ content: "", encoding: "utf-8" }) });
    if (!w.ok) throw new Error("This token can read the site but can’t change it. It needs Contents: Read and write.");
  }

  // ---------- screens ----------
  const TOKEN_HELP = `<details class="auth__help"><summary>How to get a GitHub token</summary><ol>
      <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → new fine-grained token</a>.</li>
      <li>Expiration: 1 year. Repository access: <b>Only select repositories → rarytu-site</b>.</li>
      <li>Permissions → Repository permissions → <b>Contents: Read and write</b>. Generate it and paste it here.</li></ol></details>`;
  let box = null, done = null, after = null;
  function screen(mode, msg, then) {
    after = then || null;
    if (!box) { box = document.createElement("div"); box.className = "auth"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); document.body.appendChild(box); }
    box.hidden = false;
    const tokenField = (required) => `<label class="auth__f"><span>GitHub token${required ? "" : " <i>(only to replace an expired one)</i>"}</span>
        <input name="token" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…" ${required ? "required" : ""}></label>${TOKEN_HELP}`;
    const pass2 = `<label class="auth__f"><span>Password</span><input name="password" type="password" autocomplete="new-password" minlength="10" required></label>
        <label class="auth__f"><span>Password again</span><input name="password2" type="password" autocomplete="new-password" minlength="10" required></label>
        <p class="auth__small">At least 10 characters. It can’t be recovered: if it’s lost, set up sign-in again with a new GitHub token.</p>`;
    const remember = `<label class="auth__check"><input name="remember" type="checkbox" checked> Remember this device</label>`;
    const forms = {
      login: `<h1>Sign in</h1>
        <label class="auth__f"><span>Login</span><input name="login" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
        <label class="auth__f"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
        ${remember}<button class="primary" type="submit">Sign in</button>`,
      setup: `<h1>Set up sign-in</h1><p>Choose a login and password for the panel. ${token ? "" : "This device also needs the GitHub token once; after that the login and password are enough on any device."}</p>
        ${token ? "" : tokenField(true)}
        <label class="auth__f"><span>Login</span><input name="login" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
        ${pass2}${remember}<button class="primary" type="submit">Save and sign in</button>
        ${token ? `<button class="secondary" type="button" data-later>Later</button>` : ""}`,
      settings: `<h1>Sign-in settings</h1><p>Set a new login and password${vault ? "" : " (none is set yet)"}. To replace an expired GitHub token, paste the new one too.</p>
        ${tokenField(!token)}
        <label class="auth__f"><span>Login</span><input name="login" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
        ${pass2}<button class="primary" type="submit">Save</button>
        <button class="secondary" type="button" data-later>Cancel</button>`,
      expired: `<h1>The GitHub token has expired</h1><p>Paste a new token and confirm your login and password, so every device gets it.</p>
        ${tokenField(true)}
        <label class="auth__f"><span>Login</span><input name="login" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
        <label class="auth__f"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
        ${remember}<button class="primary" type="submit">Save and sign in</button>`,
    };
    box.innerHTML = `<form class="auth__card" novalidate><p class="auth__brand">Anastasia Rarytu · Admin</p>${forms[mode]}<p class="auth__msg" aria-live="polite">${msg ? esc(msg) : ""}</p></form>`;
    const form = box.querySelector("form"), say = (t, err) => { const m = form.querySelector(".auth__msg"); m.textContent = t; m.classList.toggle("error", !!err); };
    form.querySelector("input")?.focus();
    form.querySelector("[data-later]")?.addEventListener("click", () => { box.hidden = true; unlock(); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form)); const btn = form.querySelector('[type="submit"]');
      if (!form.reportValidity()) return;
      if ("password2" in f && f.password !== f.password2) return say("The two passwords are different.", true);
      btn.disabled = true;
      try {
        if (mode === "login") {
          say("Checking…");
          let t;
          try { t = await openVault(f.login, f.password); } catch { throw new Error("Wrong login or password."); }
          try { await checkToken(t); } catch { await saveOnDevice(t, !!f.remember); token = t; return screen("expired", "Signed in, but the saved GitHub token no longer works."); }
          token = t; await saveOnDevice(t, !!f.remember);
        } else {
          let t = (f.token || "").trim() || token;
          if (mode === "expired") {   // the password must open the current vault before it's replaced
            try { await openVault(f.login, f.password); } catch { throw new Error("Wrong login or password."); }
          }
          say("Checking the token…"); await checkToken(t);
          say("Saving…");
          await writeVault(await makeVault(f.login, f.password || "", t), t);
          token = t; await saveOnDevice(t, mode === "settings" ? remembered : !!f.remember);
        }
        box.hidden = true; unlock();
        if (after) { const a = after; after = null; a(); }
      } catch (err) { say(err.message, true); } finally { btn.disabled = false; }
    });
  }
  function unlock() {
    document.documentElement.classList.remove("auth-locked");
    const su = document.getElementById("auth-setup"), out = document.getElementById("auth-out");
    if (su) { su.hidden = !!vault; su.onclick = () => screen("setup"); }
    if (out) out.onclick = () => { if (confirm("Sign out on this device? You’ll need the login and password next time.")) Auth.signOut(); };
    if (done) { const d = done; done = null; d(); }
  }

  // ---------- start ----------
  const ready = new Promise((res) => { done = res; });
  (async () => {
    await new Promise((r) => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r, { once: true }) : r());
    // a token saved the old way (plain text in this browser) moves into the device store
    const plain = ls.get(PLAIN);
    if (plain) { ls.set(PLAIN, null); token = plain; try { await saveOnDevice(plain, true); } catch {} }
    else token = await readDevice().catch(() => "");
    await loadVault();
    if (token) { unlock(); return; }   // no sign-in set yet: the "Set up sign-in" button in the top bar asks for it
    screen(vault ? "login" : "setup");
  })();

  window.Auth = {
    ready,
    token: () => token,
    // GitHub access box / expired token: keep the new token on this device; the vault is updated from Sign-in settings
    setToken: (t) => { token = t || ""; if (t) saveOnDevice(t, remembered || !ss.get(DEVICE)).catch(() => {}); else { ls.set(DEVICE, null); ss.set(DEVICE, null); } },
    hasVault: () => !!vault,
    settings: () => screen("settings"),
    expired: (then) => screen(vault ? "expired" : "settings", "GitHub refused the saved token.", then),
    signOut: async () => { token = ""; ls.set(DEVICE, null); ss.set(DEVICE, null); ls.set(PLAIN, null); await dropDeviceKey(); location.reload(); },
  };
})();
