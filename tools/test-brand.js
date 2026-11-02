// Panel test: link preview picture and site icons (Site tab) → Publish → files and tags in the commit.
// Run: MOCK_GIT=<bare clone> UP=<dir with "share test.jpg", tab.svg, phone.png> node tools/test-brand.js   (serve the repo on :8811 first)
const { chromium } = require('playwright'); const { execFileSync } = require('child_process');
const mock = require(__dirname + '/mock-github.js');
const git = (a) => execFileSync('git', ['--git-dir', process.env.MOCK_GIT, ...a], { maxBuffer: 1 << 28 }).toString().trim();
(async () => {
  const U = process.env.UP + '/'; const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/api\.github\.com|raw\.githubusercontent\.com/, mock.handle);
  await ctx.addInitScript(() => { localStorage.setItem('rarytu-gh-token', 'test'); window.confirm = () => true; });
  const pg = await ctx.newPage(); pg.on('pageerror', (e) => console.log('PAGEERR', e.message)); pg.on('response', (r) => r.status() >= 400 && console.log('HTTP', r.status(), r.url()));
  const choose = async (loc, files) => { const [fc] = await Promise.all([pg.waitForEvent('filechooser'), loc.click()]); await fc.setFiles(files); await pg.waitForTimeout(1500); };
  await pg.goto('http://localhost:8811/admin/index.html'); await pg.waitForTimeout(800); await pg.evaluate(() => Store.discard());
  await pg.goto('http://localhost:8811/admin/index.html#site'); await pg.waitForSelector('.fgroup');
  for (const name of ['Link preview', 'Site icon']) { const g = pg.locator('.fgroup', { hasText: name }).first(); if (!(await g.evaluate((d) => d.open))) await g.locator('summary').first().click(); }
  await choose(pg.locator('.fgroup', { hasText: 'Link preview' }).locator('text=Upload new picture'), [U + 'share test.jpg']);
  console.log('preview note:', await pg.locator('.fgroup', { hasText: 'Link preview' }).locator('.field__status').textContent().catch(() => '-'));
  const ic = pg.locator('.fgroup', { hasText: 'Site icon' });
  await choose(ic.locator('text=Upload new icon').nth(0), [U + 'tab.svg']);
  await choose(ic.locator('text=Upload new icon').nth(1), [U + 'phone.png']);
  console.log('draft media:', JSON.stringify(await pg.evaluate(() => Store.mediaChanged())));
  await pg.screenshot({ path: '/tmp/brand-panel.png', fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 900 } });
  const before = git(['rev-parse', 'main']);
  await pg.click('#publish'); await pg.waitForSelector('dialog[open] [data-go]:not([disabled])'); await pg.click('dialog [data-go]');
  await pg.waitForFunction(() => /Published|Not published|Nothing/.test(document.querySelector('dialog h2').textContent), null, { timeout: 60000 });
  console.log('result:', (await pg.locator('dialog h2').textContent()).trim(), '| commit moved:', before !== git(['rev-parse', 'main']));
  const site = JSON.parse(git(['show', 'main:content/site.json']));
  console.log('shareImage:', JSON.stringify(site.shareImage), '| icons:', JSON.stringify(site.icons));
  const files = git(['ls-tree', '-r', '-l', 'main']).split('\n').filter((l) => /share-|favicon|apple-touch|icons\//.test(l)).map((l) => l.split(/\s+/).slice(3).join(' '));
  console.log('files:', files.join(' | '));
  const root = git(['show', 'main:index.html']), page = git(['show', 'main:ru/about/index.html']);
  console.log('root og:image:', (root.match(/og:image" content="([^"]+)/) || [])[1], '| page og:image:', (page.match(/og:image" content="([^"]+)/) || [])[1]);
  console.log('page icon tags:', (page.match(/<link rel="(icon|apple-touch-icon)"[^>]*>/g) || []).join(' '));
  require('fs').writeFileSync('/tmp/favicon-out.ico', execFileSync('git', ['--git-dir', process.env.MOCK_GIT, 'show', 'main:favicon.ico']));
  require('fs').writeFileSync('/tmp/touch-out.png', execFileSync('git', ['--git-dir', process.env.MOCK_GIT, 'show', 'main:apple-touch-icon.png']));
  await b.close();
})();
