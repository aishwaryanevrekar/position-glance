import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { config } from './config.mjs';
import { getPosition } from './hyperliquid.mjs';
import { parseIntent, parseDeterministic } from './intent.mjs';
import { resolveOrder } from './intent.mjs';
import { createConsent, execute } from './signer.mjs';

/**
 * Optional Telegram bridge — Track 01 + Best Telegram integration special prize.
 * Bot API long polling only; no webhook, no TLS setup. The bot token stays on the server.
 * Pairing: /pair 0x... ; /status ; /close half (with YES/NO inline confirmation).
 */
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API = `https://api.telegram.org/bot${TOKEN}`;
const PAIR_FILE = resolve(config.root, 'data/telegram-pairings.json');
let pairings = {};
let offset = 0;
let running = false;

if (existsSync(PAIR_FILE)) {
  try { pairings = JSON.parse(readFileSync(PAIR_FILE, 'utf8')); } catch { pairings = {}; }
}
function save() {
  mkdirSync(dirname(PAIR_FILE), { recursive: true });
  writeFileSync(PAIR_FILE, JSON.stringify(pairings, null, 2));
}

async function tg(method, payload) {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || data.error_code}`);
  return data.result;
}

function send(chatId, text, replyMarkup) {
  return tg('sendMessage', { chat_id: chatId, text, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
}

const yesNo = (token) => ({
  inline_keyboard: [[
    { text: 'YES · SEND', callback_data: `yes:${token}` },
    { text: 'NO · CANCEL', callback_data: `no:${token}` },
  ]],
});

async function handleMessage(msg) {
  const chat = msg.chat?.id;
  if (!chat || !msg.text) return;
  const text = String(msg.text || '');
  const cmd = text.split(' ')[0].toLowerCase().split('@')[0];

  if (cmd === '/start') {
    return send(chat, [
      'Position Glance bot',
      '',
      'Pair your Hyperliquid master address, then check it or create a reduce-only testnet close.',
      '',
      '/pair 0x...   pair a public address',
      '/status        show one position + PnL',
      '/close half    draft a reduce-only close (half of the position)',
      '/close all     draft a full close',
      '',
      'Nothing is sent without an explicit YES tap. Testnet / simulated only.',
    ].join('\n'));
  }

  if (cmd === '/pair') {
    const address = (text.split(' ')[1] || '').trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return send(chat, 'Usage: /pair 0x<40 hex chars>  (the master/sub-account address, not the agent wallet)');
    }
    pairings[chat] = address;
    save();
    return send(chat, `Paired public address: ${address.slice(0, 6)}…${address.slice(-4)}\nRead-only. /status to glance.`);
  }

  if (cmd === '/status') {
    if (!pairings[chat]) return send(chat, 'Pair first: /pair 0x...');
    try {
      const { position } = await getPosition(pairings[chat]);
      return send(chat, (position.rows || ['No position']).join('\n'));
    } catch (e) {
      return send(chat, `Could not read position: ${e.message}`);
    }
  }

  if (cmd === '/close') {
    if (!pairings[chat]) return send(chat, 'Pair first: /pair 0x...');
    try {
      const rest = text.slice(cmd.length).trim() || 'close half';
      const { position } = await getPosition(pairings[chat]);
      const intent = config.capabilities.realIntent ? await parseIntent(`close ${rest}`) : parseDeterministic(`close ${rest}`);
      const order = resolveOrder(intent, position);
      if (!order) return send(chat, 'No reducible order parsed. Nothing was sent.');
      const { confirmToken } = createConsent(order);
      return send(chat,
        `CONFIRM REDUCE-ONLY\n${order.side.toUpperCase()} ${order.size} ${order.coin} · testnet\n\nTap YES only if you meant it.`,
        yesNo(confirmToken));
    } catch (e) {
      return send(chat, `Could not draft order: ${e.message}`);
    }
  }

  return send(chat, 'Commands: /start · /pair 0x... · /status · /close half');
}

async function handleCallback(cb) {
  const chat = cb.message?.chat?.id;
  const data = String(cb.data || '');
  await tg('answerCallbackQuery', { callback_query_id: cb.id, text: data.startsWith('no:') ? 'Cancelled' : 'Submitting…' });
  if (!chat) return;
  if (data.startsWith('no:')) return send(chat, 'Cancelled. Nothing was sent.');
  if (!data.startsWith('yes:')) return;
  try {
    const result = await execute(data.slice(4));
    await send(chat, `${result.label}\n${result.ok ? 'ORDER ACCEPTED' : 'NOT SENT'}\n${result.txId || ''}`);
  } catch (e) {
    await send(chat, `Send failed: ${e.message}`);
  }
}

/** Push an execution receipt to every paired Telegram chat. */
export async function notifyReceipt(result) {
  if (!TOKEN) return;
  for (const chat of Object.keys(pairings)) {
    try {
      await send(chat, `[Position Glance] ${result.label}\n${result.order?.side?.toUpperCase()} ${result.order?.size} ${result.order?.coin} reduce-only\n${result.txId || ''}`);
    } catch { /* best effort */ }
  }
}

export function start() {
  if (!TOKEN) {
    console.log('[telegram] TELEGRAM_BOT_TOKEN not set — Telegram bridge disabled');
    return;
  }
  if (running) return;
  running = true;
  console.log('[telegram] bridge enabled (long polling)');
  (async () => {
    while (running) {
      try {
        const updates = await tg('getUpdates', { offset, timeout: 10, allowed_updates: ['message', 'callback_query'] });
        for (const u of updates) {
          offset = Math.max(offset, (u.update_id || 0) + 1);
          if (u.message) await handleMessage(u.message);
          else if (u.callback_query) await handleCallback(u.callback_query);
        }
      } catch (e) {
        console.error('[telegram]', e.message);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  })();
}
