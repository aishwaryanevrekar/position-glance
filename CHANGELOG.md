# Changelog

All notable changes are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows semantic versioning where applicable.

## [1.0.0] — 2026-11-26

### Added

- Initial open-source release of Position Glance for the Heads Up: Even Realities Hackathon.
- G2 frontend (`src/main.ts`): one-position glance, voice capture, parsed-order preview, tap-to-confirm, swipe-to-cancel, double-tap exit.
- Backend (`server/`): CORS proxy, Hyperliquid testnet `/info` reads, WAV wrapping + STT, structured intent parsing, one-use consent tokens, server-signed reduce-only orders.
- Optional Telegram bridge (`server/telegram.mjs`): pairing, status, voice-less `/close` with inline YES/NO, execution receipt push.
- Demo assets generated from a real backend API trace (`docs/`), browser preview (`demo/index.html`), and regeneration tools (`tools/`).
- Research basis: `../reports/G2 hackathon track selection.md` and `../research/position_glance_strategy_and_build_plan.md`.
- Dependency-free smoke test (`tests/smoke.mjs`, 8 checks), MIT license, contributing guide, security policy, code of conduct, and CI workflow.
- Human-paced Indian-English female narration (macOS `Tara (English (India))`, en-IN) muxed into `docs/demo-voice.mp4`, with `docs/narration-script.md` and `tools/add_narration.py`.

### Fixed

- `app.json` permissions are now objects with `desc` and a `network` whitelist; `package_id` changed to `com.positionglance.app` (no `"Even"` in the name, ≤20 chars).
- Single-tap detection handles protobuf's omitted zero-value `eventType`.

### Notes

- Demo mode is the default: no keys, no broadcast, everything labelled `TESTNET · SIMULATED`.
