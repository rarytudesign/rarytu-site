// Test of the content store and drafts (step B3) against the mock GitHub.
// Run: MOCK_GIT=<bare clone of the repo> node tools/test-store.js   (serve the repo on :8811 first)
const { chromium } = require('playwright'); const { execFileSync } = require('child_process');
const mock = require(__dirname + '/mock-github.js');
const git = (a, input) => execFileSync('git', ['--git-dir', process.env.MOCK_GIT, ...a], { input }).toString().trim();
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext();
  await ctx.route(/api\.github\.com|raw\.githubusercontent\.com/, mock.handle);
  await ctx.addInitScript(() => { localStorage.setItem('rarytu-gh-token', 'test'); window.confirm = () => true; });
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('PAGEERR', e.message));
  const state = async () => pg.evaluate(() => ({ draft: document.getElementById('draft-state').textContent, discard: !document.getElementById('discard').hidden,
    publish: !document.getElementById('publish').disabled, changed: Store.changed(), conflicts: Store.conflicts(), source: Store.state.source,
    tabs: [...document.querySelectorAll('#tabs a')].map(a => a.textContent + (a.querySelector('.dot') ? '•' : '')).join(' | ') }));
  const wait = () => pg.waitForFunction(() => /published|Draft/.test(document.getElementById('draft-state').textContent), null, { timeout: 15000 });
  await pg.goto('http://localhost:8811/admin/index.html#about'); await wait();
  console.log('1 loaded', await state());
  await pg.evaluate(() => Store.update('content/pages/about.json', (a) => { a.tools.items.push({ label: 'Blender' }); }));
  await pg.evaluate(() => Store.update('content/cases/hevy.json', (c) => { c.title.en = 'HEVY test'; }));
  await pg.waitForTimeout(500);
  console.log('2 edited', await state());
  await pg.reload(); await wait();
  console.log('3 after reload', await state(), await pg.evaluate(() => Store.get('content/cases/hevy.json').title.en));
  await pg.evaluate(() => Store.update('content/cases/hevy.json', (c) => { c.title.en = 'HEVY / Influencer marketing'; }));
  console.log('4 edited back', (await state()).changed);
  // someone else changes about.json on the site
  const head = git(['rev-parse', 'main']); const env = { ...process.env, GIT_INDEX_FILE: '/tmp/idx-store' };
  execFileSync('git', ['--git-dir', process.env.MOCK_GIT, 'read-tree', head], { env });
  const about = JSON.parse(git(['cat-file', 'blob', head + ':content/pages/about.json'])); about.heading.en = 'Changed elsewhere';
  const blob = git(['hash-object', '-w', '--stdin'], JSON.stringify(about));
  execFileSync('git', ['--git-dir', process.env.MOCK_GIT, 'update-index', '--cacheinfo', '100644,' + blob + ',content/pages/about.json'], { env });
  const tree = execFileSync('git', ['--git-dir', process.env.MOCK_GIT, 'write-tree'], { env }).toString().trim();
  git(['update-ref', 'refs/heads/main', git(['commit-tree', tree, '-p', head, '-m', 'elsewhere'])]);
  await pg.reload(); await wait();
  console.log('5 conflict', (await state()).conflicts);
  await pg.click('#discard'); await pg.waitForTimeout(300);
  console.log('6 discarded', await state());
  await pg.reload(); await wait();
  console.log('7 after reload', (await state()).draft);
  await b.close();
})();
