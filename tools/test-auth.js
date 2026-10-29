// Test of the panel sign-in (admin/cms/auth.js) with a fake GitHub: no real repository is touched.
// Run: node tools/test-auth.js   (serves the repo itself)
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..");
const T = { ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".json": "application/json", ".html": "text/html", ".woff2": "font/woff2" };
let vault = null;   // admin/auth.json as "published"
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  if (u === "/admin/auth.json") { if (!vault) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": "application/json" }); return r.end(vault); }
  let f = path.join(ROOT, u); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r);
});
let GOOD = "github_pat_GOOD";
async function fakeGitHub(route) {
  const req = route.request(), url = new URL(req.url()), auth = req.headers()["authorization"] || "";
  const ok = auth === "Bearer " + GOOD;
  const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (url.hostname === "raw.githubusercontent.com") return route.fulfill({ status: 404, body: "" });
  const p = url.pathname.replace("/repos/rarytudesign/rarytu-site", "");
  if (!ok && auth) return json(401, { message: "Bad credentials" });
  if (p === "" ) return json(ok ? 200 : 404, {});
  if (p === "/git/blobs" && req.method() === "POST") return json(ok ? 201 : 403, { sha: "x" });
  if (p === "/contents/admin/auth.json") {
    if (req.method() === "GET") return vault ? json(200, { sha: "v1" }) : json(404, {});
    if (req.method() === "PUT") { if (!ok) return json(403, { message: "no" }); vault = Buffer.from(JSON.parse(req.postData()).content, "base64").toString(); return json(200, {}); }
  }
  return json(404, { message: "not in fake" });
}
const check = (name, cond) => { console.log((cond ? "ok   " : "FAIL ") + name); if (!cond) process.exitCode = 1; };
(async () => {
  await new Promise((r) => srv.listen(0, r)); const base = `http://localhost:${srv.address().port}/admin/index.html`;
  const b = await chromium.launch();
  const open = async (ctx) => { const pg = await ctx.newPage(); await ctx.route(/api\.github\.com|raw\.githubusercontent\.com/, fakeGitHub);
    pg.on("dialog", (d) => d.accept()); pg.on("pageerror", (e) => console.log("PAGEERR", e.message)); await pg.goto(base); await pg.waitForTimeout(1200); return pg; };
  const locked = (pg) => pg.evaluate(() => document.documentElement.classList.contains("auth-locked"));
  const fill = async (pg, vals) => { for (const [k, v] of Object.entries(vals)) await pg.fill(`.auth input[name="${k}"]`, v); await pg.click('.auth [type="submit"]'); await pg.waitForTimeout(2500); };
  const msg = (pg) => pg.evaluate(() => document.querySelector(".auth__msg")?.textContent || "");

  // 1. her computer: an old plain token moves into the device store; the panel opens; sign-in can be set up
  const A = await b.newContext(); await A.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("rarytu-gh-token", "github_pat_GOOD"); sessionStorage.setItem("seeded", 1); } });
  let pg = await open(A);
  check("old token: panel unlocked", !(await locked(pg)));
  check("old token: no plain token left", await pg.evaluate(() => !localStorage.getItem("rarytu-gh-token") && !!localStorage.getItem("rarytu-auth-device")));
  check("no sign-in yet: setup button shown", await pg.isVisible("#auth-setup"));
  await pg.click("#auth-setup");
  await fill(pg, { login: "Nastya", password: "short", password2: "short" });
  check("short password refused", !vault);
  await fill(pg, { login: "Nastya", password: "correct horse 42", password2: "correct horse 42" });
  check("vault written", !!vault && JSON.parse(vault).rounds === 600000 && !vault.includes(GOOD));
  check("setup button hidden after setup", !(await pg.isVisible("#auth-setup")));
  await pg.reload(); await pg.waitForTimeout(1200);
  check("remembered device: no sign-in after reload", !(await locked(pg)) && (await pg.evaluate(() => Auth.token())) === GOOD);

  // 2. a new device: sign-in screen; wrong password; right password without "remember"
  const B = await b.newContext(); pg = await open(B);
  check("new device: locked with sign-in screen", (await locked(pg)) && await pg.isVisible(".auth input[name=password]"));
  await pg.uncheck('.auth input[name="remember"]');
  await fill(pg, { login: "nastya", password: "wrong password!" });
  check("wrong password refused", (await locked(pg)) && /Wrong login or password/.test(await msg(pg)));
  await pg.uncheck('.auth input[name="remember"]');
  await fill(pg, { login: " NASTYA ", password: "correct horse 42" });
  check("right login (any case) and password: unlocked", !(await locked(pg)) && (await pg.evaluate(() => Auth.token())) === GOOD);
  await pg.reload(); await pg.waitForTimeout(1200);
  check("not remembered: same tab stays signed in", !(await locked(pg)));
  const pg2 = await B.newPage(); await pg2.goto(base); await pg2.waitForTimeout(1200);
  check("not remembered: a new tab asks again", await locked(pg2));

  // 3. remembered device, then sign out
  const C = await b.newContext(); pg = await open(C);
  await fill(pg, { login: "nastya", password: "correct horse 42" });
  const pg3 = await C.newPage(); pg3.on("dialog", (d) => d.accept()); await pg3.goto(base); await pg3.waitForTimeout(1200);
  check("remembered: a new tab opens without sign-in", !(await locked(pg3)));
  await pg3.click("#auth-out"); await pg3.waitForTimeout(1500);
  check("signed out: locked again", await locked(pg3));
  check("signed out: nothing left on the device", await pg3.evaluate(() => !localStorage.getItem("rarytu-auth-device")));

  // 4. a year later the token expires: sign-in asks for a new one and saves it for every device
  GOOD = "github_pat_NEW";
  const D = await b.newContext(); pg = await open(D);
  await fill(pg, { login: "nastya", password: "correct horse 42" });
  check("expired token: asks for a new one", await pg.isVisible('.auth input[name="token"]'));
  await fill(pg, { token: "github_pat_NEW", login: "nastya", password: "correct horse 42" });
  check("new token saved: unlocked", !(await locked(pg)) && (await pg.evaluate(() => Auth.token())) === "github_pat_NEW");
  const E = await b.newContext(); pg = await open(E);
  await fill(pg, { login: "nastya", password: "correct horse 42" });
  check("another device gets the new token", !(await locked(pg)) && (await pg.evaluate(() => Auth.token())) === "github_pat_NEW");

  await b.close(); srv.close();
})();
