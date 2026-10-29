// node tools/shot.js out.png url-path width [selector]  -> screenshot of an element (or full page) of the built site
const http = require("http"), fs = require("fs"), path = require("path"); const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, ".."); const [out, p, w, sel] = process.argv.slice(2);
const T = { ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".mp4": "video/mp4", ".html": "text/html" };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0]).replace(/^\/rarytu-site/, ""));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
(async () => { await new Promise((r) => srv.listen(0, r)); const b = await chromium.launch();
  const W = +w, pg = await (await b.newContext({ viewport: { width: W, height: W < 744 ? 844 : W < 1280 ? 1194 : 1080 }, reducedMotion: "reduce" })).newPage();
  await pg.goto(`http://localhost:${srv.address().port}/rarytu-site/${p}`, { waitUntil: "load" }); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(400);
  if (sel) await (await pg.$(sel)).screenshot({ path: out }); else await pg.screenshot({ path: out, fullPage: true });
  await b.close(); srv.close(); })();
