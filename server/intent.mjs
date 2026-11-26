import { config } from './config.mjs';

/** Wrap raw 16 kHz s16le mono PCM in a minimal WAV header (44 bytes). */
export function pcmToWav(pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);       // PCM
  header.writeUInt16LE(1, 22);       // mono
  header.writeUInt32LE(16000, 24);   // sample rate
  header.writeUInt32LE(32000, 28);   // byte rate
  header.writeUInt16LE(2, 32);       // block align
  header.writeUInt16LE(16, 34);      // bits
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function transcribe(pcm, { contentType = 'audio/wav' } = {}) {
  if (!config.capabilities.realStt) {
    // Deterministic demo transcript so the whole loop runs with zero keys.
    return { text: 'close half my BTC long', simulated: true };
  }
  const wav = contentType === 'audio/wav' ? pcm : pcmToWav(pcm);
  const form = new FormData();
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'glasses.wav');
  form.append('model', config.sttModel);
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.openaiKey}` },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`STT HTTP ${res.status}`);
  const data = await res.json();
  return { text: String(data.text || ''), simulated: false };
}

const SYSTEM = `You parse a user's SPOKEN ORDER for a testnet trading demo into strict JSON.
You are not an advisor. Never recommend an action, never add opinions, never invent numbers.
Return ONLY JSON with keys: action (reduce|close|none), coin (BTC|ETH|SOL|null), fraction (0..1 or null), size (number or null), side (buy|sell or null).
"close all" => action close, fraction 1. "half" => 0.5. If the user did not explicitly ask to trade, action none.
If a number is given without a unit, treat it as coin size. side is the side of the REDUCING order (sell for a long, buy for a short).`;

/** Deterministic fallback parser — no model needed. */
export function parseDeterministic(text) {
  const t = String(text || '').toLowerCase();
  const coin = ['btc', 'eth', 'sol'].find((c) => t.includes(c))?.toUpperCase() || 'BTC';
  let fraction = null;
  if (/all|everything|full/.test(t)) fraction = 1;
  else if (/half/.test(t)) fraction = 0.5;
  else if (/quarter/.test(t)) fraction = 0.25;
  const sizeMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:btc|eth|sol)?/);
  const size = sizeMatch && fraction === null ? Number(sizeMatch[1]) : null;
  const side = /short|buy back|cover/.test(t) ? 'buy' : 'sell';
  const action = /close|reduce|sell|buy back|cover|exit/.test(t) ? (fraction === 1 ? 'close' : 'reduce') : 'none';
  return { action, coin, fraction, size, side, simulated: true };
}

export async function parseIntent(text) {
  if (!config.capabilities.realIntent) return parseDeterministic(text);

  let url, headers, body;
  if (config.anthropicKey) {
    url = 'https://api.anthropic.com/v1/messages';
    headers = {
      'content-type': 'application/json',
      'x-api-key': config.anthropicKey,
      'anthropic-version': '2023-06-01',
    };
    body = {
      model: config.intentModel,
      max_tokens: 200,
      system: SYSTEM,
      messages: [{ role: 'user', content: String(text) }],
    };
  } else {
    url = 'https://openrouter.ai/api/v1/chat/completions';
    headers = { 'content-type': 'application/json', Authorization: `Bearer ${config.openRouterKey}` };
    body = {
      model: config.openRouterModel,
      max_tokens: 200,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: String(text) }],
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Intent API HTTP ${res.status}`);
  const data = await res.json();
  const content = data?.content?.[0]?.text ?? data?.choices?.[0]?.message?.content ?? '{}';
  const cleaned = String(content).replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1));
  return { ...parsed, simulated: false };
}

/** Resolve a parsed intent against the live position into an exact reducing size. */
export function resolveOrder(intent, position) {
  if (!position || position.empty) return null;
  if (intent.action === 'none' || intent.action === 'hold') return null;
  let size = intent.size;
  if (size === null || size === undefined) {
    const fraction = intent.fraction ?? 0.5;
    size = Number((position.size * Math.min(1, Math.max(0.01, fraction))).toFixed(4));
  }
  if (!Number.isFinite(size) || size <= 0) return null;
  size = Math.min(size, position.size);
  // Reduce-only: the reducing side opposes the open position.
  const reducingSide = position.side === 'buy' ? 'sell' : 'buy';
  const coin = (intent.coin || position.coin).toUpperCase();
  if (coin !== position.coin) return null; // only one position is supported
  return { coin, size, side: reducingSide, reduceOnly: true, source: intent.simulated ? 'demo-parser' : 'llm' };
}
