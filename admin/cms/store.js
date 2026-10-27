/* Content store for the admin panel. Exposes window.Store.
   - Loads the published content (content/*.json) from GitHub at the current commit,
     or from the published site when GitHub can't be reached without a token.
   - Keeps edits as a draft in this browser (IndexedDB), so a reload or a closed tab loses nothing.
   - For every edited file the draft also keeps the version it started from (base), so publishing
     can tell when the same file was changed elsewhere in the meantime. */
(() => {
  const FILES = ["content/site.json", "content/pages/work.json", "content/pages/about.json", "content/pages/approach.json"];
  const caseFile = (slug) => `content/cases/${slug}.json`;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // ---------- tiny IndexedDB key-value store ----------
  const DB = "rarytu-admin", ST = "kv";
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const idb = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => {
    const tx = d.transaction(ST, mode), req = fn(tx.objectStore(ST));
    tx.oncomplete = () => res(req && req.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  }); };
  const kvGet = (k) => idb("readonly", (s) => s.get(k));
  const kvPut = (k, v) => idb("readwrite", (s) => s.put(v, k));
  const kvDel = (k) => idb("readwrite", (s) => s.delete(k));

  // ---------- state ----------
  const state = {
    head: null,        // commit the published content was read from (null when read from the site)
    published: {},     // path → JSON as published
    draft: null,       // { startedAt, updatedAt, head, files: {path: JSON}, base: {path: JSON|null}, media: {path: Blob} }
    source: "",        // "github" | "site"
  };
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });

  async function fetchJSON(path, head) {
    if (head) {
      const r = await fetch(`${GH.RAW}/${head}/${path}`, { cache: "no-store" });
      if (r.status === 404) return undefined;
      if (!r.ok) throw new Error(`Couldn’t read ${path} (${r.status})`);
      return r.json();
    }
    const r = await fetch(new URL("../" + path, location.href), { cache: "no-store" });
    if (r.status === 404) return undefined;
    if (!r.ok) throw new Error(`Couldn’t read ${path} (${r.status})`);
    return r.json();
  }

  async function load() {
    let head = null, source = "site";
    try { head = (await GH.gh(`/git/ref/heads/${GH.REPO.branch}`)).object.sha; source = "github"; } catch (e) { head = null; }
    const published = {};
    for (const f of FILES) published[f] = await fetchJSON(f, head);
    if (!published["content/pages/work.json"] || !published["content/site.json"]) {
      const e = new Error("The site’s content folder is missing. This happens after restoring a backup made before the panel existed.");
      e.code = "no-content"; throw e;
    }
    // every project ever listed: the published list plus any project only the draft knows about
    const draft = (await kvGet("draft").catch(() => null)) || null;
    const slugs = new Set(published["content/pages/work.json"].projects.concat(published["content/pages/work.json"].hidden || []));
    for (const slug of slugs) published[caseFile(slug)] = await fetchJSON(caseFile(slug), head);
    Object.assign(state, { head, published, draft, source });
    emit();
    return state;
  }

  // current value of a file: the draft's copy if it has one, else the published one
  const get = (path) => (state.draft && path in state.draft.files) ? state.draft.files[path] : state.published[path];
  const read = (path) => { const v = get(path); if (v === undefined) throw new Error("No content file " + path); return v; };

  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { if (state.draft) kvPut("draft", state.draft).catch((e) => console.error("draft not saved", e)); }, 250);
  }
  // replace a whole file in the draft (editors pass a modified copy of get(path))
  const ensureDraft = () => state.draft || (state.draft = { startedAt: new Date().toISOString(), head: state.head, files: {}, base: {}, media: {} });
  function set(path, value) {
    ensureDraft();
    if (!(path in state.draft.base)) state.draft.base[path] = state.published[path] === undefined ? null : clone(state.published[path]);
    state.draft.files[path] = clone(value);
    // a file edited back to its published state is no longer part of the draft
    if (same(state.draft.files[path], state.published[path])) { delete state.draft.files[path]; delete state.draft.base[path]; }
    state.draft.updatedAt = new Date().toISOString();
    persist(); emit();
  }
  // edit helper: Store.update(path, (copy) => { copy.x = 1; })
  function update(path, fn) { const copy = clone(get(path)); fn(copy); set(path, copy); }
  // new or replaced media files (images, videos, documents) waiting to be published
  function addMedia(path, blob) { ensureDraft().media[path] = blob; state.draft.updatedAt = new Date().toISOString(); persist(); emit(); }
  function removeMedia(path) { if (state.draft && state.draft.media) { delete state.draft.media[path]; persist(); emit(); } }

  const changed = () => state.draft ? Object.keys(state.draft.files) : [];
  const mediaChanged = () => state.draft ? Object.keys(state.draft.media || {}) : [];
  const isDirty = () => changed().length > 0 || mediaChanged().length > 0;
  // files whose published version moved on since the draft copied them
  const conflicts = () => changed().filter((p) => !same(state.draft.base[p] === null ? undefined : state.draft.base[p], state.published[p]));

  async function discard() { clearTimeout(saveTimer); state.draft = null; await kvDel("draft").catch(() => {}); emit(); }
  // after a successful publish: what was published becomes the new base
  async function published(newHead, files) { state.head = newHead; Object.assign(state.published, clone(files)); await discard(); }

  window.Store = { load, get, read, set, update, addMedia, removeMedia, changed, mediaChanged, isDirty, conflicts, discard, published,
    on: (f) => (listeners.add(f), () => listeners.delete(f)), state, caseFile, FILES, clone, same };
})();
