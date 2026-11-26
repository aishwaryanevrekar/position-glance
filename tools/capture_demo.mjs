/** Capture a real end-to-end API trace against the running backend for the demo video. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:8787';
const steps = [];

function step(name, endpoint, request, response, lens) {
  steps.push({ name, endpoint, request, response, lens });
}

async function call(path, init) {
  const r = await fetch(BASE + path, init);
  return { status: r.status, body: await r.json() };
}

const config = await call('/api/config');
step('BOOT', 'GET /api/config', null, config.body, 'POSITION GLANCE\n\nConnecting…');

const pos = await call('/api/position');
const p = pos.body.position;
step('READ', 'GET /api/position', null, pos.body, p.rows.join('\n') + '\n\nTAP voice · 2× exit');

step('VOICE', 'G2 microphone → WAV → /api/transcribe', { source: 'G2 4-mic, 16 kHz s16le', phrase: 'close half my BTC long' },
  { text: 'close half my BTC long', simulated: true }, 'LISTENING\nSay: close half my BTC long\nTAP to stop');

const stt = await call('/api/transcribe', { method: 'POST', headers: { 'content-type': 'audio/pcm' }, body: new Uint8Array() });
step('STT', 'POST /api/transcribe', { bytes: 0, note: 'demo mode → deterministic transcript' }, stt.body, 'UNDERSTANDING…');

const intent = await call('/api/intent', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text: stt.body.text, position: p }),
});
const o = intent.body.order;
step('INTENT', 'POST /api/intent', { text: stt.body.text }, intent.body,
  `"${stt.body.text}"\n\n${o.side.toUpperCase()} ${o.size} ${o.coin} REDUCE-ONLY\n\nTAP=YES · SWIPE=NO`);

const confirm = await call('/api/confirm', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ confirmToken: intent.body.confirmToken, confirmed: true }),
});
step('CONFIRM (TAP=YES)', 'POST /api/confirm', { confirmed: true, oneUseToken: true }, confirm.body,
  `${confirm.body.label}\n${confirm.body.ok ? 'ORDER ACCEPTED' : 'NOT SENT'}\n${confirm.body.txId}\n\nTAP to retry`);

mkdirSync(resolve(ROOT, 'docs'), { recursive: true });
const out = resolve(ROOT, 'docs/demo-trace.json');
writeFileSync(out, JSON.stringify({ capturedAt: new Date().toISOString(), steps }, null, 2));
console.log(`wrote ${out} (${steps.length} steps)`);
