import { config } from './config.mjs';

const API = {
  testnet: 'https://api.hyperliquid-testnet.xyz',
  mainnet: 'https://api.hyperliquid.xyz',
};

/** Demo fixture: deterministic, slowly moving, clearly simulated. */
function demoState() {
  const t = Math.floor(Date.now() / 1000);
  const wave = Math.sin(t / 25) * 95;
  return {
    marginSummary: {
      accountValue: '10042.18',
      totalMarginUsed: '1920.40',
      totalNtlPos: '4801.00',
    },
    assetPositions: [{
      type: 'oneWay',
      position: {
        coin: 'BTC',
        szi: '0.0500',
        entryPx: '94172.0',
        positionValue: String(96120 + wave),
        unrealizedPnl: String(948 + wave),
        returnOnEquity: String(0.0494 + wave / 19204),
        leverage: { type: 'cross', value: 5 },
        liquidationPx: '88410.0',
      },
    }],
    mids: { BTC: String(96120 + wave), ETH: '3221.5' },
    simulated: true,
  };
}

async function infoRequest(body) {
  const base = API[config.network] || API.testnet;
  const res = await fetch(`${base}/info`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Hyperliquid /info HTTP ${res.status}`);
  return res.json();
}

/**
 * Read the account's positions. `address` must be the master/sub-account
 * address, NOT an API agent wallet (that returns empty results).
 */
export async function getPosition(addressOverride) {
  if (config.demoMode) return format(demoState());

  const address = addressOverride || config.address;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address || '')) {
    throw new Error('HYPERLIQUID_ADDRESS is missing or invalid. Use the master/sub-account address.');
  }
  const [state, allMids] = await Promise.all([
    infoRequest({ type: 'clearinghouseState', user: address }),
    infoRequest({ type: 'allMids' }),
  ]);
  return format({ ...state, mids: allMids.mids || {}, simulated: false });
}

function format(state) {
  const pos = state?.assetPositions?.[0]?.position;
  if (!pos) {
    return {
      empty: true,
      simulated: Boolean(state?.simulated),
      rows: ['NO OPEN POSITION', 'Tap mic to ask', 'for an order', 'TESTNET · no advice'],
      raw: null,
    };
  }
  const size = Number(pos.szi || 0);
  const side = size >= 0 ? 'LONG' : 'SHORT';
  const mark = Number(state.mids?.[pos.coin] ?? pos.entryPx);
  const pnl = Number(pos.unrealizedPnl || 0);
  const roe = Number(pos.returnOnEquity || 0) * 100;
  const sign = pnl >= 0 ? '+' : '-';
  const rows = [
    `${pos.coin} ${side} ${Math.abs(size).toFixed(4)}`,
    `uPnL ${sign}$${Math.abs(pnl).toFixed(2)}  ${roe >= 0 ? '+' : ''}${roe.toFixed(1)}%`,
    `MARK ${mark.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    `${state.simulated ? 'SIMULATED' : 'TESTNET'} · NO ADVICE`,
  ];
  return {
    empty: false,
    simulated: Boolean(state.simulated),
    coin: pos.coin,
    size: Math.abs(size),
    side: size >= 0 ? 'buy' : 'sell',
    entryPx: Number(pos.entryPx),
    mark,
    pnl,
    roe,
    liquidationPx: Number(pos.liquidationPx || 0),
    rows,
    raw: { accountValue: Number(state.marginSummary?.accountValue || 0) },
  };
}

/** Map a coin symbol to the asset id used by the exchange API. */
export function assetIndex(coin) {
  const map = { BTC: 0, ETH: 1, SOL: 2 };
  return map[String(coin).toUpperCase()] ?? null;
}
