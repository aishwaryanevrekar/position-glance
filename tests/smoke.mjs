/** Dependency-free smoke test. Boots the backend in demo mode and exercises the full loop. */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn(process.execPath, [resolve(ROOT, 'server/server.mjs')], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), DEMO_MODE: 'true', ALLOWED_ORIGIN: '*' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', (d) => { logs += d.toString(); });
server.stderr.on('data', (d) => { logs += d.toString(); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await sleep(100);
  }
  throw new Error(`server did not start:\n${logs}`);
}
async function get(path) {
  const r = await fetch(BASE + path);
  return { status: r.status, body: await r.json() };
}
async function post(path, body, headers = { 'content-type': 'application/json' }) {
  const r = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}

const results = [];
function check(name, fn) {
  try { fn(); results.push(`  ok  ${name}`); }
  catch (e) { results.push(`FAIL  ${name}: ${e.message}`); throw e; }
}

try {
  await waitForServer();

  let r = await get('/api/config');
  check('config is public and has no secrets', () => {
    assert.equal(r.status, 200);
    assert.equal(r.body.demoMode, true);
    assert.ok(!JSON.stringify(r.body).match(/private_key|apiKey|token/i));
  });

  r = await get('/api/position');
  check('position read returns one glanceable position', () => {
    assert.equal(r.status, 200);
    assert.equal(r.body.position.empty, false);
    assert.equal(r.body.position.simulated, true);
    assert.ok(r.body.position.rows.length <= 4);
    assert.ok(r.body.position.rows.some((x) => x.includes('NO ADVICE')));
  });

  const position = r.body.position;
  r = await post('/api/intent', { text: 'close half my BTC long', position });
  check('voice intent resolves to a reduce-only order + consent token', () => {
    assert.equal(r.status, 200);
    assert.equal(r.body.order.reduceOnly, true);
    assert.equal(r.body.order.side, 'sell');
    assert.equal(r.body.order.size, 0.025);
    assert.ok(r.body.confirmToken);
  });
  const token = r.body.confirmToken;

  r = await post('/api/confirm', { confirmToken: token, confirmed: false });
  check('declining confirmation sends nothing', () => {
    assert.equal(r.body.ok, false);
    assert.match(r.body.message, /Nothing was sent/);
  });

  r = await post('/api/confirm', { confirmToken: token, confirmed: true });
  check('explicit confirmation produces a labelled simulated receipt', () => {
    assert.equal(r.body.ok, true);
    assert.equal(r.body.simulated, true);
    assert.match(r.body.label, /SIMULATED/);
  });

  r = await post('/api/confirm', { confirmToken: token, confirmed: true });
  check('consent token is one-use', () => {
    assert.equal(r.status, 500);
    assert.match(r.body.message, /expired or already used/);
  });

  r = await post('/api/intent', { text: 'what should I do?', position });
  check('non-trade phrase produces no order', () => {
    assert.equal(r.body.order, null);
    assert.equal(r.body.confirmToken, null);
  });

  r = await get('/api/does-not-exist');
  check('unknown route returns JSON 404', () => assert.equal(r.status, 404));

  console.log(results.join('\n'));
  console.log(`\n${results.length} checks passed`);
} catch (e) {
  console.error(results.join('\n'));
  console.error(`\nSmoke test failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
}
