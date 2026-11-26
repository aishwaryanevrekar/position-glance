import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { config, publicConfig } from './config.mjs';
import { getPosition } from './hyperliquid.mjs';
import { transcribe, parseIntent, resolveOrder } from './intent.mjs';
import { createConsent, execute } from './signer.mjs';
import { start as startTelegram, notifyReceipt } from './telegram.mjs';

const ROOT = config.root;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': typeof body === 'string' && !headers['content-type'] ? 'application/json' : (headers['content-type'] || 'application/json'),
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', config.allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, x-even-app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Vary', 'Origin');
}

async function readBody(req, limit = 10 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function jsonBody(req) {
  const raw = await readBody(req);
  if (!raw.length) return {};
  try { return JSON.parse(raw.toString('utf8')); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return send(res, 204, '');

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  try {
    if (url.pathname === '/health' || url.pathname === '/api/config') {
      return send(res, 200, url.pathname === '/health' ? { ok: true } : publicConfig());
    }

    if (url.pathname === '/api/position' && req.method === 'GET') {
      const position = await getPosition(url.searchParams.get('address') || undefined);
      return send(res, 200, { position, fetchedAt: new Date().toISOString(), network: config.demoMode ? 'SIMULATED' : config.network });
    }

    if (url.pathname === '/api/transcribe' && req.method === 'POST') {
      const raw = await readBody(req);
      const ct = String(req.headers['content-type'] || 'audio/wav');
      const out = await transcribe(raw, { contentType: ct.includes('pcm') ? 'audio/pcm' : 'audio/wav' });
      return send(res, 200, out);
    }

    if (url.pathname === '/api/intent' && req.method === 'POST') {
      const body = await jsonBody(req);
      const { text, position } = body;
      if (!text) throw Object.assign(new Error('text is required'), { status: 400 });
      const intent = await parseIntent(text);
      const order = resolveOrder(intent, position);
      if (!order) {
        return send(res, 200, { intent, order: null, confirmToken: null, message: 'No reducible order parsed. Nothing was sent.' });
      }
      const consent = createConsent(order);
      return send(res, 200, {
        intent,
        order,
        ...consent,
        message: `${order.side.toUpperCase()} ${order.size} ${order.coin} reduce-only — awaiting explicit confirmation`,
      });
    }

    if (url.pathname === '/api/confirm' && req.method === 'POST') {
      const body = await jsonBody(req);
      if (body.confirmed !== true) {
        return send(res, 200, { ok: false, message: 'Confirmation not given. Nothing was sent.' });
      }
      const result = await execute(String(body.confirmToken || ''));
      void notifyReceipt(result); // push the same receipt to paired Telegram chats
      return send(res, 200, result);
    }

    // Static files for the browser demo / built Even Hub app.
    if (req.method === 'GET' && (url.pathname.startsWith('/demo/') || url.pathname === '/')) {
      const rel = url.pathname === '/' ? 'demo/index.html' : url.pathname.slice(1);
      const safe = resolve(ROOT, rel);
      if (!safe.startsWith(ROOT)) return send(res, 403, { error: 'forbidden' });
      try {
        const data = await readFile(safe);
        return send(res, 200, data, { 'content-type': MIME[extname(safe)] || 'application/octet-stream' });
      } catch {
        return send(res, 404, { error: 'not_found' });
      }
    }

    return send(res, 404, { error: 'not_found', path: url.pathname });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[server]', err?.message || err);
    return send(res, status, { error: err.code || 'server_error', message: err.message || 'Unexpected error' });
  }
});

server.listen(config.port, () => {
  startTelegram();
  console.log(`[position-glance] backend on http://localhost:${config.port}`);
  console.log(`[position-glance] demoMode=${config.demoMode} capabilities=${JSON.stringify(config.capabilities)}`);
  console.log(`[position-glance] ALLOWED_ORIGIN=${config.allowedOrigin}`);
});
