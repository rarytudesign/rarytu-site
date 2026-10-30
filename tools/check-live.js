// Final check of the live site: every page at 3 widths, every file it loads, every internal link, CV downloads.
// Run: node tools/check-live.js [https://rarytu.com]
const { chromium } = require("playwright");
const BASE = (process.argv[2] || "https://rarytu.com").replace(/\/$/, "");
const langs = ["en", "ru"], pages = ["index.html", "about/index.html", "approach/index.html",
  ...["hevy", "dom", "lumo", "nomi", "kodan", "talktoast"].map((s) => `work/${s}/index.html`)];
const W = [390, 834, 1440];
(async () => {
  const b = await chromium.launch(); const bad = [], links = new Set(); let loads = 0;
  for (const w of W) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 744 ? 844 : w < 1280 ? 1194 : 900 } });
    const p = await ctx.newPage();
    p.on("console", (m) => { if (m.type() === "error") bad.push(`${w} console ${p.url()}: ${m.text()}`); });
    p.on("pageerror", (e) => bad.push(`${w} js ${p.url()}: ${e.message}`));
    p.on("response", (r) => { loads++; if (r.status() >= 400) bad.push(`${w} ${r.status()} ${r.url()} (on ${p.url()})`); });
    p.on("requestfailed", (r) => { if (!/cloudflareinsights/.test(r.url())) bad.push(`${w} failed ${r.url()} ${r.failure()?.errorText}`); });
    for (const l of langs) for (const pg of pages) {
      const u = `${BASE}/${l}/${pg}`;
      const res = await p.goto(u, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => { bad.push(`${w} goto ${u}: ${e.message}`); });
      if (res && res.status() !== 200) bad.push(`${w} page ${res.status()} ${u}`);
      // scroll through so lazy media loads
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } });
      await p.waitForTimeout(500);
      const info = await p.evaluate(() => ({
        broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).map((i) => i.currentSrc),
        videos: [...document.querySelectorAll("video")].filter((v) => v.error).map((v) => v.currentSrc),
        hx: document.documentElement.scrollWidth > innerWidth + 1,
        links: [...document.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => h.startsWith(location.origin)),
      }));
      info.broken.forEach((s) => bad.push(`${w} image ${s} on ${u}`));
      info.videos.forEach((s) => bad.push(`${w} video ${s} on ${u}`));
      if (info.hx) bad.push(`${w} horizontal scroll on ${u}`);
      info.links.forEach((h) => links.add(h.split("#")[0]));
    }
    await ctx.close();
  }
  for (const h of links) { const r = await fetch(h, { method: "GET" }); if (r.status !== 200) bad.push(`link ${r.status} ${h}`); }
  for (const h of ["/", "/admin/", "/assets/cv/Anastasia_Alekseeva_CV.pdf", "/assets/cv/Anastasia_Alekseeva_CV_RUS.pdf"]) {
    const r = await fetch(BASE + h); if (r.status !== 200) bad.push(`file ${r.status} ${h}`);
  }
  console.log(`pages: ${langs.length * pages.length} x ${W.length} widths, files loaded: ${loads}, internal links: ${links.size}`);
  console.log(bad.length ? "PROBLEMS:\n" + [...new Set(bad)].join("\n") : "no problems");
  await b.close();
})();
