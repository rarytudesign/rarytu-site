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
