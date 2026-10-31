// Writes every page from content/ into the repo (the same HTML the admin panel publishes).
// Run from anywhere: node tools/build.js   → prints which files changed.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const R = require(path.join(ROOT, "admin/cms/render.js"));
// the pages' security policy allows exactly one inline script, by its hash: stop if the two drifted apart
{ const h = "sha256-" + require("crypto").createHash("sha256").update(R.HEAD_JS).digest("base64");
  if (h !== R.HEAD_JS_HASH) { console.error("render.js: HEAD_JS_HASH must be " + h); process.exit(1); } }
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
// Site styles and script: their content hash goes into site.json (assetsVersion) and the pages link
// assets/styles.css?v=<hash>, so after a change visitors get the new files at once, not after the ~10 minute cache.
{
  const h = require("crypto").createHash("sha1");
  for (const f of ["assets/styles.css", "assets/main.js", "assets/spheres.js"]) h.update(fs.readFileSync(path.join(ROOT, f)));
  const v = h.digest("hex").slice(0, 8), s = read("content/site.json");
  if (s.assetsVersion !== v) { s.assetsVersion = v; fs.writeFileSync(path.join(ROOT, "content/site.json"), JSON.stringify(s, null, 2) + "\n"); console.log("upd  content/site.json (assetsVersion " + v + ")"); }
}
const site = read("content/site.json"), work = read("content/pages/work.json");
const pages = R.listPages(work);
let changed = 0;
for (const p of pages) {
  const out = R.renderPage(p, { site, read });
  const file = path.join(ROOT, p.path);
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (before === out) continue;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out); changed++;
  console.log(before === null ? "new " : "upd ", p.path);
}
console.log(`${pages.length} pages, ${changed} written`);

// Admin panel: stamp its scripts and styles with a short content hash (cms/x.js?v=abc123),
// so browsers never mix a new panel page with old cached code (GitHub Pages caches for ~10 minutes).
const crypto = require("crypto");
const adminFile = path.join(ROOT, "admin/index.html");
let admin = fs.readFileSync(adminFile, "utf8");
const stamped = admin.replace(/(src|href)="(cms\/[\w.-]+\.(?:js|css))(?:\?v=\w+)?"/g, (m, attr, f) => {
  const hash = crypto.createHash("sha1").update(fs.readFileSync(path.join(ROOT, "admin", f))).digest("hex").slice(0, 8);
  return `${attr}="${f}?v=${hash}"`;
});
// the panel's preview shows real pages inside the panel, so the panel's policy allows the pages' inline line too
const final = stamped.replace(/script-src 'self'( 'sha256-[^']+')?/, `script-src 'self' '${R.HEAD_JS_HASH}'`);
if (final !== admin) { fs.writeFileSync(adminFile, final); console.log("upd  admin/index.html (asset versions, policy)"); }
