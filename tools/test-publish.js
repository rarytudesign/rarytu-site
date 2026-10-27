// End-to-end publish test against the mock GitHub.
// Run: S=<dir with up/Mockup Final.jpg> MOCK_GIT=<bare clone> node tools/test-publish.js   (serve the repo on :8811 first)
const { chromium } = require('playwright'); const { execFileSync } = require('child_process');
const mock = require(__dirname + '/mock-github.js');
const git = (a) => execFileSync('git', ['--git-dir', process.env.MOCK_GIT, ...a], { maxBuffer: 1 << 28 }).toString().trim();
(async () => {
  const U = process.env.S + '/up/'; const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/api\.github\.com|raw\.githubusercontent\.com/, mock.handle);
  await ctx.addInitScript(() => { localStorage.setItem('rarytu-gh-token', 'test'); window.confirm = () => true; });
  const pg = await ctx.newPage(); pg.on('pageerror', (e) => console.log('PAGEERR', e.message));
  const choose = async (loc, files) => { const [fc] = await Promise.all([pg.waitForEvent('filechooser'), loc.click()]); await fc.setFiles(files); await pg.waitForTimeout(1500); };
  await pg.goto('http://localhost:8811/admin/index.html'); await pg.waitForTimeout(800); await pg.evaluate(() => Store.discard());
  const before = git(['rev-parse', 'main']);
  // 1. About heading
  await pg.goto('http://localhost:8811/admin/index.html#about'); await pg.waitForSelector('.fgroup textarea');
  await pg.locator('.fgroup').first().locator('textarea').first().fill('I’m Anastasia,<br>a designer who publishes herself');
  // 2. image into Lumo gallery
  await pg.goto('http://localhost:8811/admin/index.html#project/lumo'); await pg.waitForSelector('.fgroup');
  const gal = pg.locator('.fgroup', { hasText: 'Gallery' }); if (!(await gal.evaluate((d) => d.open))) await gal.locator('summary').first().click();
  await choose(pg.locator('text=+ Add images'), [U + 'Mockup Final.jpg']);
  // 3. new project without cover → publish must be blocked
  await pg.goto('http://localhost:8811/admin/index.html#new-project'); await pg.waitForSelector('.ed__form textarea');
  await pg.locator('.ed__form textarea').nth(0).fill('Orbit'); await pg.click('text=Create project'); await pg.waitForTimeout(800);
  await pg.click('#publish'); await pg.waitForSelector('dialog[open]');
  console.log('blocked:', await pg.locator('dialog .probs').first().textContent(), '| button disabled:', await pg.locator('dialog [data-go]').isDisabled());
  await pg.locator('dialog [data-x]').last().click();
  // add cover + hero image to Orbit
  const card = pg.locator('.fgroup', { hasText: 'Card on Work' }); await choose(card.locator('text=Upload image'), [U + 'Mockup Final.jpg']);
  const hero = pg.locator('.fgroup', { hasText: 'Big image at the top' }); if (!(await hero.evaluate((d) => d.open))) await hero.locator('summary').first().click();
  await choose(hero.locator('text=Upload image').first(), [U + 'poster tall.jpg']);
  // 4. hide Nomi
  await pg.goto('http://localhost:8811/admin/index.html#project/nomi'); await pg.waitForSelector('.fgroup');
  await pg.locator('summary', { hasText: 'Hide or delete' }).click(); await pg.click('text=Hide from the site'); await pg.waitForTimeout(400);
  // 5. publish
  await pg.click('#publish'); await pg.waitForSelector('dialog[open] [data-go]:not([disabled])');
  console.log('dialog:', (await pg.locator('dialog p').first().textContent()).trim());
  await pg.click('dialog [data-go]');
  await pg.waitForFunction(() => /Published|Not published|Nothing/.test(document.querySelector('dialog h2').textContent), null, { timeout: 60000 });
  console.log('result:', (await pg.locator('dialog').textContent()).replace(/\s+/g, ' ').trim());
  console.log('draft state:', await pg.textContent('#draft-state'));
  // 6. check the repository
  const after = git(['rev-parse', 'main']), msg = git(['log', '-1', '--format=%s', 'main']);
  console.log('commit moved:', before !== after, '|', msg);
  const files = git(['ls-tree', '-r', '--name-only', 'main']).split('\n');
  console.log('orbit pages:', files.filter((f) => f.includes('work/orbit/')).join(' '), '| nomi pages:', files.filter((f) => /work\/nomi\//.test(f)).length);
  console.log('new media:', files.filter((f) => /mockup-final|poster-tall/.test(f)).length);
  console.log('about page has heading:', git(['show', 'main:en/about/index.html']).includes('a designer who publishes herself'));
  const log = JSON.parse(git(['show', 'main:admin/history.json'])); console.log('last event:', JSON.stringify(log.events.at(-1)));
  // 7. publish again with nothing changed is impossible (button disabled)
  console.log('publish disabled after:', await pg.locator('#publish').isDisabled());
  await b.close();
})();
