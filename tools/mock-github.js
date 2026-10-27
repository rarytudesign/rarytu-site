// Fake GitHub API for tests: serves the endpoints the panel uses from a real local bare git repo (MOCK_GIT env).
// Use in Playwright: context.route(/api\.github\.com|raw\.githubusercontent\.com/, require('./mock-github').handle)
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const GD = process.env.MOCK_GIT;
const git = (args, input) => execFileSync('git', ['--git-dir', GD, ...args], { input, maxBuffer: 1 << 30 });
const s = (b) => b.toString().trim();
module.exports.handle = async (route) => {
  const req = route.request(), url = new URL(req.url()), m = req.method();
  const json = (o, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
  if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (url.host === 'raw.githubusercontent.com') {
    const [, , , sha, ...p] = url.pathname.split('/');
    try { return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: git(['cat-file', 'blob', `${sha}:${p.map(decodeURIComponent).join('/')}`]) }); }
    catch { return route.fulfill({ status: 404, body: '' }); }
  }
  const p = url.pathname.replace('/repos/rarytudesign/rarytu-site', '');
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  try {
    if (p === '') return json({ permissions: { push: true } });
    let r;
    if ((r = p.match(/^\/git\/ref\/heads\/(.+)$/)) && m === 'GET') return json({ object: { sha: s(git(['rev-parse', 'refs/heads/' + r[1]])) } });
    if ((r = p.match(/^\/git\/commits\/(\w+)$/))) return json({ tree: { sha: s(git(['rev-parse', r[1] + '^{tree}'])) } });
    if ((r = p.match(/^\/git\/trees\/(\w+)$/))) return json({ truncated: false, tree: s(git(['ls-tree', '-r', r[1]])).split('\n').filter(Boolean).map((l) => { const [a, path] = l.split('\t'); const [mode, type, sha] = a.split(' '); return { path, mode, type, sha }; }) });
    if ((r = p.match(/^\/git\/blobs\/(\w+)$/))) return json({ content: git(['cat-file', 'blob', r[1]]).toString('base64'), encoding: 'base64' });
    if (p === '/git/blobs') return json({ sha: s(git(['hash-object', '-w', '--stdin'], Buffer.from(body.content, body.encoding === 'base64' ? 'base64' : 'utf8'))) }, 201);
    if (p === '/git/trees') {
      const idx = path.join(os.tmpdir(), 'idx' + Math.random());
      const env = { ...process.env, GIT_INDEX_FILE: idx };
      const info = body.tree.map((t) => `${t.mode} ${t.sha}\t${t.path}`).join('\n') + '\n';
      execFileSync('git', ['--git-dir', GD, 'update-index', '--add', '--index-info'], { input: info, env });
      const sha = s(execFileSync('git', ['--git-dir', GD, 'write-tree'], { env })); fs.unlinkSync(idx);
      return json({ sha }, 201);
    }
    if (p === '/git/commits') return json({ sha: s(git(['commit-tree', body.tree, ...body.parents.flatMap((x) => ['-p', x]), '-m', body.message])) }, 201);
    if ((r = p.match(/^\/git\/refs\/heads\/(.+)$/)) && m === 'PATCH') {
      const cur = s(git(['rev-parse', 'refs/heads/' + r[1]]));
      try { git(['merge-base', '--is-ancestor', cur, body.sha]); } catch { return json({ message: 'Update is not a fast forward' }, 422); }
      git(['update-ref', 'refs/heads/' + r[1], body.sha]); return json({ object: { sha: body.sha } });
    }
    return json({ message: 'mock: unknown ' + m + ' ' + p }, 404);
  } catch (e) { return json({ message: 'mock error ' + e.message }, 500); }
};
