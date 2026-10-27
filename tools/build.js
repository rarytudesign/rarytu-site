// Writes every page from content/ into the repo (the same HTML the admin panel publishes).
// Run from anywhere: node tools/build.js   → prints which files changed.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const R = require(path.join(ROOT, "admin/cms/render.js"));
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
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
if (stamped !== admin) { fs.writeFileSync(adminFile, stamped); console.log("upd  admin/index.html (asset versions)"); }
