import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv() {
  const out = {};
  const p = resolve(ROOT, '.env');
  if (existsSync(p)) {
    for (const raw of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i < 0) continue;
      let v = line.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[line.slice(0, i).trim()] = v;
    }
  }
  return out;
}
const env = loadEnv();
const get = (k, d = '') => process.env[k] ?? env[k] ?? d;

const hasAgentKey = Boolean(get('HYPERLIQUID_AGENT_PRIVATE_KEY'));
const hasOpenAI = Boolean(get('OPENAI_API_KEY'));
const hasAnthropic = Boolean(get('ANTHROPIC_API_KEY'));
const hasOpenRouter = Boolean(get('OPENROUTER_API_KEY'));

export const config = {
  root: ROOT,
  port: Number(get('PORT', '8787')),
  allowedOrigin: get('ALLOWED_ORIGIN', 'http://localhost:5173'),
  address: get('HYPERLIQUID_ADDRESS', ''),
  network: get('HYPERLIQUID_NETWORK', 'testnet'),
  agentPrivateKey: get('HYPERLIQUID_AGENT_PRIVATE_KEY', ''),
  openaiKey: get('OPENAI_API_KEY', ''),
  sttModel: get('STT_MODEL', 'gpt-4o-mini-transcribe'),
  anthropicKey: get('ANTHROPIC_API_KEY', ''),
  intentModel: get('INTENT_MODEL', 'claude-3-5-haiku-latest'),
  openRouterKey: get('OPENROUTER_API_KEY', ''),
  openRouterModel: get('OPENROUTER_MODEL', 'openai/gpt-4o-mini'),

  // Demo mode is the safe default: it makes the whole loop runnable today with no keys.
  demoMode: get('DEMO_MODE', 'true').toLowerCase() === 'true' || !hasAgentKey,
  capabilities: {
    realRead: Boolean(get('HYPERLIQUID_ADDRESS')) && get('DEMO_MODE', 'true').toLowerCase() !== 'true',
    realWrite: hasAgentKey,
    realStt: hasOpenAI,
    realIntent: hasAnthropic || hasOpenRouter,
  },
};

/** Safe to print / send to the client. Contains no secrets. */
export function publicConfig() {
  return {
    demoMode: config.demoMode,
    network: config.network,
    address: config.address ? `${config.address.slice(0, 6)}…${config.address.slice(-4)}` : null,
    capabilities: config.capabilities,
  };
}
