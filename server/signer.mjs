import { randomUUID } from 'node:crypto';
import { config } from './config.mjs';
import { assetIndex } from './hyperliquid.mjs';

/** Short-lived, one-use consent tokens. The client only ever sees the token, never the key. */
const pending = new Map();
const TTL_MS = 60_000;

export function createConsent(order) {
  const token = randomUUID();
  pending.set(token, { order, expiresAt: Date.now() + TTL_MS, used: false });
  // Bound memory growth.
  if (pending.size > 200) {
    for (const [k, v] of pending) if (v.expiresAt < Date.now() || v.used) pending.delete(k);
  }
  return { confirmToken: token, expiresAt: pending.get(token).expiresAt };
}

export function peekConsent(token) {
  const entry = pending.get(token);
  if (!entry || entry.used || entry.expiresAt < Date.now()) return null;
  return entry.order;
}

/**
 * Sign and submit a reduce-only testnet order. The agent key has NO withdrawal
 * rights and never leaves the server. In demo mode nothing is broadcast.
 */
export async function execute(token) {
  const order = peekConsent(token);
  if (!order) throw Object.assign(new Error('Consent token missing, expired or already used'), { code: 'invalid_consent' });
  pending.get(token).used = true;

  if (config.demoMode || !config.capabilities.realWrite) {
    return {
      ok: true,
      simulated: true,
      network: 'SIMULATED',
      label: 'TESTNET · SIMULATED',
      order,
      txId: `sim-${randomUUID().slice(0, 8)}`,
      message: 'No order was broadcast. Demo mode.',
    };
  }

  const a = assetIndex(order.coin);
  if (a === null) throw Object.assign(new Error(`Unsupported coin: ${order.coin}`), { code: 'unsupported_coin' });

  let HttpTransport, ExchangeClient, privateKeyToAccount;
  try {
    ({ HttpTransport, ExchangeClient } = await import('@nktkas/hyperliquid'));
    ({ privateKeyToAccount } = await import('viem/accounts'));
  } catch {
    throw Object.assign(new Error('Install @nktkas/hyperliquid and viem to enable real testnet signing'), { code: 'missing_dependency' });
  }

  const wallet = privateKeyToAccount(config.agentPrivateKey);
  const transport = new HttpTransport({ isTestnet: config.network === 'testnet', timeout: 15_000 });
  const exchange = new ExchangeClient({ transport, wallet });

  const result = await exchange.order({
    orders: [{
      a,
      b: order.side === 'buy',
      // Marketable limit: sell at 1 / buy at a huge price, always reduce-only.
      p: order.side === 'buy' ? '1000000000' : '1',
      s: String(order.size),
      r: true,
      t: { limit: { tif: 'IoC' } },
    }],
    grouping: 'na',
  });

  return {
    ok: true,
    simulated: false,
    network: config.network,
    label: 'TESTNET · LIVE ORDER',
    order,
    result,
    txId: result?.response?.data?.statuses?.[0]?.oid ? String(result.response.data.statuses[0].oid) : null,
    message: 'Reduce-only testnet order submitted.',
  };
}
