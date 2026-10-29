// Measures the built site for the Figma check: every text block (box, font size, line height,
// letter spacing, line breaks), media boxes and decorative dots, per page and width.
// Usage: node tools/measure.js out.json [widths=390,820,1920] [pages=all]
// Serves the repo itself on a free port under /rarytu-site/.
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const out = process.argv[2] || "measure.json";
const widths = (process.argv[3] || "390,820,1920").split(",").map(Number);
const SLUGS = ["hevy", "dom", "lumo", "nomi", "kodan", "talktoast"];
const ALL = ["", "about/", "approach/", ...SLUGS.map((s) => "work/" + s + "/")];
const pages = process.argv[4] ? process.argv[4].split(",") : ALL;

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml",
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".woff2": "font/woff2", ".pdf": "application/pdf" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]).replace(/^\/rarytu-site/, "");
  let f = path.join(ROOT, p); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});

// runs in the page
function collect() {
  const vis = (el) => { const s = getComputedStyle(el); if (s.display === "none" || s.visibility === "hidden") return false;
    for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e); if (c.display === "none" || +c.opacity === 0 && !e.classList.contains("rv")) return false; } return true; };
  const blockOf = (n) => { for (let e = n.parentElement; e; e = e.parentElement) { const d = getComputedStyle(e).display; if (d !== "inline" && d !== "contents") return e; } return null; };
  const blocks = new Map(), range = document.createRange();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) =>
    n.textContent.trim() && !n.parentElement.closest("script,style,.skel,.sr-only,.skip,[hidden],svg,noscript") ? 1 : 2 });
  for (let n; (n = walker.nextNode()); ) { const b = blockOf(n); if (!b) continue; if (!blocks.has(b)) blocks.set(b, []); blocks.get(b).push(n); }
  const T = [];
  blocks.forEach((nodes, el) => {
    if (!vis(el)) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    // words with their line (top), in reading order
    const words = [];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const n of nodes) {
      if (!vis(n.parentElement)) continue;
      const t = n.textContent; const re = /\S+/g; let m;
      while ((m = re.exec(t))) {
        range.setStart(n, m.index); range.setEnd(n, m.index + m[0].length);
        const rs = [...range.getClientRects()].filter((q) => q.width > 0);
        if (!rs.length) continue;
        // a word split over two lines by a hyphen break gives two rects
        // a word broken at its hyphen over two lines: give each line its part (split at the hyphen that fits the widths)
        let parts = rs.map((q, i) => (rs.length > 1 ? (i ? "" : m[0]) : m[0]));
        if (rs.length === 2 && m[0].includes("-")) {
          const ratio = rs[0].width / (rs[0].width + rs[1].width); let best = -1, bd = 9;
          for (let h = m[0].indexOf("-"); h >= 0; h = m[0].indexOf("-", h + 1)) { const d = Math.abs((h + 1) / m[0].length - ratio); if (d < bd) { bd = d; best = h; } }
          if (best >= 0) parts = [m[0].slice(0, best + 1), m[0].slice(best + 1)];
        }
        rs.forEach((q, i) => { if (!parts[i] && i) { x1 = Math.max(x1, q.right); return; } words.push({ w: parts[i], t: q.top, b: q.bottom, l: q.left, r: q.right });
          x0 = Math.min(x0, q.left); x1 = Math.max(x1, q.right); y0 = Math.min(y0, q.top); y1 = Math.max(y1, q.bottom); });
      }
    }
    if (!words.length) return;
    const lines = [];
    words.forEach((w) => { const last = lines[lines.length - 1];
      if (last && Math.abs(last.t - w.t) < 4 && w.l >= last.r - 2) { last.s += " " + w.w; last.r = w.r; last.b = Math.max(last.b, w.b); }
      else lines.push({ s: w.w, t: w.t, b: w.b, l: w.l, r: w.r }); });
    const s = getComputedStyle(el), first = nodes.find((n) => vis(n.parentElement)) || nodes[0], fs = getComputedStyle(first.parentElement);
    const lh = fs.lineHeight === "normal" ? null : parseFloat(fs.lineHeight);
    // top of the first line box (what Figma calls the text top): glyph area centred in the line height
    const l0 = lines[0], top = lh ? l0.t - (lh - (l0.b - l0.t)) / 2 : l0.t;
    T.push({ txt: nodes.filter((n) => vis(n.parentElement)).map((n) => n.textContent).join(""), tag: el.tagName.toLowerCase(), cls: el.className && el.className.baseVal === undefined ? el.className : "",
      box: [r.left, r.top + scrollY, r.width, r.height].map((v) => Math.round(v * 10) / 10),
      ink: [x0, y0 + scrollY, x1 - x0, y1 - y0].map((v) => Math.round(v * 10) / 10),
      fs: parseFloat(fs.fontSize), lh, ls: fs.letterSpacing === "normal" ? 0 : parseFloat(fs.letterSpacing), ff: fs.fontFamily.split(",")[0].replace(/"/g, "") + " " + fs.fontWeight,
      tt: fs.textTransform, mw: s.maxWidth, top: Math.round((top + scrollY) * 10) / 10, left: Math.round(Math.min(...lines.map((l) => l.l)) * 10) / 10,
      right: Math.round(Math.max(...lines.map((l) => l.r)) * 10) / 10, ta: s.textAlign, lines: lines.map((l) => l.s.trim()), lt: lines.map((l) => Math.round((l.t + scrollY) * 10) / 10) });
  });
  // media boxes: containers first (an empty hero placeholder counts), then loose images/videos. Opacity is ignored
  // because videos stay transparent until they really play.
  const shownBox = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e); if (c.display === "none" || c.visibility === "hidden") return false; } return true; };
  const BOX = ".chero, .gitem, .card__cover, .photo__img, .photo > img, .photo picture, .vbox, .split__media";
  const M = [...document.querySelectorAll(`main :is(${BOX}), main img, main video`)]
    .filter((e) => shownBox(e) && !e.closest(".dots") && !e.classList.contains("vposter") && !e.parentElement.closest(BOX))
    .map((e) => { const r = e.getBoundingClientRect(); const im = e.querySelector ? (e.matches("img,video") ? e : e.querySelector("img,video")) : null;
      return { tag: e.tagName.toLowerCase(), cls: typeof e.className === "string" ? e.className : "", src: im ? (im.currentSrc || im.getAttribute("src") || im.getAttribute("poster") || "").split("/").pop() : "",
        box: [r.left, r.top + scrollY, r.width, r.height].map((v) => Math.round(v * 10) / 10) }; })
    .filter((m) => m.box[2] > 60 && m.box[3] > 60);
  const D = [...document.querySelectorAll("main .dots i")].filter((d) => getComputedStyle(d).display !== "none").map((d) => { const r = d.getBoundingClientRect();
    return { grp: d.parentElement.className, box: [r.left, r.top + scrollY, r.width, r.height].map((v) => Math.round(v * 10) / 10) }; });
  return { h: document.documentElement.scrollHeight, w: innerWidth, T, M, D };
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch();
  const res = {};
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 744 ? 844 : w < 1280 ? 1194 : 1080 }, reducedMotion: "reduce", deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const lang of ["en", "ru"]) for (const p of pages) {
      const url = `http://localhost:${port}/rarytu-site/${lang}/${p}`;
      await page.goto(url, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      res[`${lang}/${p}@${w}`] = await page.evaluate(collect);
      process.stdout.write(".");
    }
    await ctx.close();
  }
  await browser.close(); server.close();
  fs.writeFileSync(out, JSON.stringify(res));
  console.log("\nwrote " + out);
})();
