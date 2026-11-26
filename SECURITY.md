# Security Policy

## Supported versions

This is a hackathon submission and research artifact. Security fixes are applied to the `master` branch.

## Threat model summary

- The G2 WebView is untrusted: it must never receive a private key, bot token or cloud API key.
- The backend is the only holder of secrets, loaded from `.env` and never logged.
- Orders are reduce-only, testnet-only and require a one-use, 60-second consent token issued after an explicit user confirmation.
- No user funds are held, no withdrawals are exposed, and the app never gives financial advice.
- Position data and voice transcripts are not persisted; Telegram pairings store only a public address and chat id.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Email the maintainer through GitHub (`@aishwaryanevrekar`) or use GitHub's private vulnerability reporting on this repository. Include:

- the affected file/endpoint
- a minimal reproduction
- the impact (e.g. secret exposure, unintended order, bypass of confirmation)
- a suggested fix if you have one

You should receive an acknowledgement within a few days. We will credit reporters in `CHANGELOG.md` unless you prefer anonymity.

## Out of scope

- Findings that require a user to voluntarily paste their own private key into the app
- Mainnet trading configurations (this project only supports testnet/simulated writes)
- Issues in third-party APIs (Even Hub, Hyperliquid, Telegram, OpenAI, Anthropic, OpenRouter) — please report those to the respective provider and open an issue here only for our integration
