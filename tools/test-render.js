// Renderer test: renders pages from content/ and compares them with the HTML files in the repo.
// Run from the repo root: node tools/test-render.js [--shell]   (--shell: only the shared shell, main content passed through)
// "Same" = equal after decoding entities and collapsing whitespace. Prints the first difference per page.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const R = require(path.join(ROOT, "admin/cms/render.js"));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const site = JSON.parse(read("content/site.json"));

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " ", "#39": "'" };
const norm = (s) => s
  .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] ?? m))
  .replace(/\s+/g, " ").replace(/> </g, "><").trim();

function firstDiff(a, b) {
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  return i === a.length && i === b.length ? null : i;
}

const pages = [];
for (const lang of ["en", "ru"]) {
  pages.push({ lang, key: "work", path: `${lang}/index.html` });
  pages.push({ lang, key: "about", path: `${lang}/about/index.html` });
  pages.push({ lang, key: "approach", path: `${lang}/approach/index.html` });
  for (const slug of fs.readdirSync(path.join(ROOT, lang, "work"))) pages.push({ lang, key: "case", slug, path: `${lang}/work/${slug}/index.html` });
}

const onlyShell = process.argv.includes("--shell");
let ok = 0, bad = 0;
for (const p of pages) {
  const orig = read(p.path);
  let out;
  try {
    if (onlyShell) {
      const g = (re) => (orig.match(re) || [])[1];
      const dec = (s) => s == null ? s : s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");
      const ctx = {
        site, lang: p.lang, path: p.path, altPath: p.path.replace(/^(en|ru)/, p.lang === "en" ? "ru" : "en"),
        nav: p.key === "case" ? "work" : p.key, bodyClass: g(/<body[^>]*class="([^"]*)"/),
        title: dec(g(/<title>(.*?)<\/title>/)), description: dec(g(/name="description" content="([^"]*)"/)),
        tagline: dec(g(/sidebar__tagline">(.*?)<\/p>/)), menuTagline: dec(g(/mmenu__tagline">(.*?)<\/p>/)),
      };
      const main = orig.slice(orig.indexOf(">", orig.indexOf('<main class="main"')) + 1, orig.lastIndexOf("</main>")).trim();
      out = R.shell(ctx, main);
    } else {
      out = R.renderPage(p, { site, read: (f) => JSON.parse(read(f)) });
    }
  } catch (e) { console.log("✕", p.path, "render error:", e.message); bad++; continue; }
  const a = norm(orig), b = norm(out), i = firstDiff(a, b);
  if (i === null) { ok++; continue; }
  bad++;
  console.log("✕", p.path, "\n   orig: …" + a.slice(Math.max(0, i - 80), i + 120) + "\n   new:  …" + b.slice(Math.max(0, i - 80), i + 120));
}
console.log(`${ok} same, ${bad} different`);
process.exit(bad ? 1 : 0);
