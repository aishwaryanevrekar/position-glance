/** Render the 3D demo: deterministic CDP frames + Indian female narration + generated score. */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCENE = resolve(ROOT, 'video3d');
const DOCS = resolve(ROOT, 'docs');
const TMP = resolve(ROOT, '.render-3d');
const FPS = 12;
const DURATION = 170; // 2:50, under the 3-minute cap
const W = 1280, H = 720;

const LINES = [
  [0.5, 'This is Position Glance, a little app for Even G2 smart glasses. One open position, right in your line of sight.'],
  [9.5, 'It reads a Hyperliquid testnet position through a public address. No login on the glasses, and no keys in the app.'],
  [18.5, 'The display is tiny, five hundred seventy six by two hundred eighty eight, monochrome green. So it shows one thing, not a dashboard.'],
  [27.5, 'Here is the position. Bitcoin long, zero point zero five. Unrealized P and L, plus one thousand dollars. Mark, ninety six thousand one hundred seventy three.'],
  [36.5, 'Those numbers come from the info endpoint. It needs no credentials, and it is read from the master address, never the agent wallet.'],
  [45.5, 'Now the other half, acting on it. One tap starts the glasses microphone, and the audio goes to our own backend as sixteen kilohertz PCM.'],
  [54.5, 'You say it the way you would say it to a friend. Close half my BTC long.'],
  [63.5, 'We wrap the audio in a WAV header, transcribe it, and turn the transcript into strict JSON. Action, coin, fraction, side.'],
  [72.5, 'That becomes a single line on the lens. Sell zero point zero two five Bitcoin, reduce only.'],
  [81.5, 'Nothing is sent at this point. The preview is a draft, and the only way past it is an explicit tap.'],
  [90.5, 'Tap means yes. Swipe means no. Double tap always exits the app, which is what the reviewers check first.'],
  [99.5, 'Behind that tap is a one use token, valid for sixty seconds. It cannot be replayed, and declining sends nothing.'],
  [108.5, 'Only then does the backend sign a reduce only order with a testnet agent wallet. The key never leaves the server.'],
  [117.5, 'The wallet has no withdrawal rights. There is no custody, no user funds, and no way to increase exposure.'],
  [126.5, 'The app never tells you what to do. No scores, no ratings, no should I close. Just the raw numbers you asked for.'],
  [135.5, 'There is also a Telegram bridge. Pair a public address, ask for status, or draft a close and confirm with a yes button.'],
  [144.5, 'That makes the same project eligible for a second track, but the build stays one trusted loop. One number, one sentence, one tap.'],
  [153.5, 'It is open source under MIT, free to run in the simulator, and every receipt says testnet simulated. Position Glance.'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: opts.stdio || 'ignore', ...opts });
    p.on('error', reject);
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
    if (opts.onSpawn) opts.onSpawn(p);
  });
}

/** Simple static server for the scene so Chrome can load it over http. */
function serveStatic(dir, port) {
  return new Promise((done) => {
    const server = http.createServer((req, res) => {
      const name = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = resolve(dir, name);
      if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
      try {
        const data = readFileSync(file);
        res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html' : 'application/octet-stream' }).end(data);
      } catch { res.writeHead(404).end(); }
    });
    server.listen(port, '127.0.0.1', () => done(server));
  });
}

async function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((ok, no) => {
    const n = ++id;
    waiting.set(n, (m) => m.error ? no(new Error(JSON.stringify(m.error))) : ok(m.result));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  return { send, close: () => ws.close() };
}

function wavHeader(dataBytes, rate = 22050) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + dataBytes, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(dataBytes, 40);
  return h;
}

/** Low drone + soft hits at each section, written in code. No paid music service. */
function makeScore(path) {
  const rate = 22050, n = rate * DURATION;
  const buf = Buffer.alloc(n * 2);
  const hits = [0, 14, 42, 76, 110, 140];
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let v = 0.055 * Math.sin(2 * Math.PI * 55 * t) + 0.035 * Math.sin(2 * Math.PI * 82.41 * t);
    v *= 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.08 * t);
    for (const h of hits) {
      const dt = t - h;
      if (dt >= 0 && dt < 1.6) v += 0.11 * Math.exp(-dt * 3.2) * Math.sin(2 * Math.PI * 220 * dt);
    }
    if (t < 1) v *= t;
    if (t > DURATION - 2) v *= (DURATION - t) / 2;
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2);
  }
  writeFileSync(path, Buffer.concat([wavHeader(buf.length), buf]));
}

async function main() {
  console.log('[3d] preparing');
  mkdirSync(TMP, { recursive: true }); mkdirSync(DOCS, { recursive: true });
  const frameDir = resolve(TMP, 'frames'); mkdirSync(frameDir, { recursive: true });

  const sceneUrl = `file://${resolve(SCENE, 'index.html')}?render`;
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--remote-debugging-port=9222', '--remote-allow-origins=*',
    `--user-data-dir=${resolve(TMP, 'chrome')}`, '--window-size=1280,720', 'about:blank',
  ], { stdio: 'ignore' });

  let tab;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(sceneUrl)}`, { method: 'PUT' });
      tab = await r.json(); break;
    } catch { await sleep(250); }
  }
  if (!tab) throw new Error('Chrome CDP did not start');
  const cdp = await cdpClient(tab.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  // Force the exact render viewport; Chrome's window chrome otherwise clips the canvas.
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: W, height: H, deviceScaleFactor: 1, mobile: false,
  });
  await sleep(800);
  const ready = await cdp.send('Runtime.evaluate', { expression: 'document.title' });
  if (ready.result?.value !== 'READY') throw new Error(`scene did not load: title=${ready.result?.value}`);
  console.log('[3d] scene loaded');

  const total = FPS * DURATION;
  console.log(`[3d] rendering ${total} frames at ${FPS}fps`);
  for (let n = 0; n < total; n++) {
    const t = n / FPS;
    await cdp.send('Runtime.evaluate', { expression: `window.seek(${t.toFixed(4)})` });
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
    writeFileSync(resolve(frameDir, `f${String(n).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
    if (n % 240 === 0) console.log(`[3d] ${n}/${total}`);
  }
  cdp.close(); chrome.kill('SIGTERM');

  const audioPath = resolve(TMP, 'audio.m4a');
  if (!existsSync(audioPath)) {
  console.log('[3d] building narration');
  const segDir = resolve(TMP, 'voice'); mkdirSync(segDir, { recursive: true });
  for (let i = 0; i < LINES.length; i++) {
    const aiff = resolve(segDir, `s${i}.aiff`), wav = resolve(segDir, `s${i}.wav`);
    await run('say', ['-v', 'Tara (English (India))', '-r', '160', '-o', aiff, LINES[i][1]]);
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', aiff, '-ar', '48000', '-ac', '1', wav]);
  }
  const inputs = [], filters = [];
  LINES.forEach((_, i) => { inputs.push('-i', resolve(segDir, `s${i}.wav`)); });
  LINES.forEach(([start], i) => {
    const ms = Math.round(start * 1000);
    filters.push(`[${i}:a]adelay=${ms}|${ms}[a${i}]`);
  });
  filters.push(LINES.map((_, i) => `[a${i}]`).join('') + `amix=inputs=${LINES.length}:duration=longest:normalize=0,volume=1.3,alimiter=limit=0.95[narr]`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filters.join(';'), '-map', '[narr]', resolve(TMP, 'narration.wav')]);

  console.log('[3d] building score and mixing');
  const score = resolve(TMP, 'score.wav'); makeScore(score);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', resolve(TMP, 'narration.wav'), '-i', score,
    '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=longest:normalize=0,volume=1.0[out]',
    '-map', '[out]', '-c:a', 'aac', '-b:a', '160k', audioPath]);
  } else {
    console.log('[3d] reusing existing narration and score');
  }

  console.log('[3d] encoding');
  const mp4 = resolve(DOCS, 'demo-3d.mp4');
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', resolve(frameDir, 'f%05d.jpg'),
    '-i', resolve(TMP, 'audio.m4a'), '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-preset', 'veryfast',
    '-c:a', 'aac', '-shortest', '-movflags', '+faststart', mp4]);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', resolve(frameDir, 'f%05d.jpg'),
    '-filter_complex', 'scale=400:-1:flags=lanczos,fps=5,split[a][b];[a]palettegen=max_colors=48[p];[b][p]paletteuse=dither=bayer',
    '-loop', '0', resolve(DOCS, 'demo-3d.gif')]);

  console.log(`[3d] done: ${mp4}`);
  rmSync(TMP, { recursive: true, force: true });
}

main().catch((e) => { console.error('[3d] FAILED', e.message); process.exit(1); });
