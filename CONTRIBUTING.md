# Contributing to Position Glance

Thanks for improving an open-source smart-glasses app built for the Heads Up: Even Realities Hackathon. Contributions are welcome until and after the deadline.

## Ground rules

- **Never commit secrets.** API keys, agent wallet private keys and bot tokens belong only in `.env`, which is gitignored. The client bundle must never contain a key.
- **No funds, no advice.** Keep all trading testnet/paper/simulated and reduce-only. Do not add features that recommend a trade, hold user funds or enable withdrawals.
- **One thing on screen.** The G2 display is 576×288 monochrome. Respect the container limits and keep every glance to a few words.
- **Cite sources** in the research docs when you change a factual claim about an API or judging rule.

## Local development

```bash
npm install
npm test                 # dependency-free backend smoke test (8 checks)
npm run check            # syntax check of server + tests
npm run server           # demo mode, no keys needed
npm run dev              # Vite dev server (needs npm install)
npm run simulate         # Even Hub simulator, requires the CLI tools
```

## Before opening a PR

1. `npm test` and `npm run check` pass.
2. `git grep -Ei '(private_key|api[_-]?key|bot_token)='` finds no real values.
3. If you touch `app.json`, validate against the [Even Hub manifest reference](https://hub.evenrealities.com/docs/ship/packaging): permissions are objects with `desc`, `network` has a non-empty `whitelist`, `package_id` is lowercase reverse-DNS, `name` is ≤20 chars.
4. Update `README.md` and `CHANGELOG.md` for user-visible changes.
5. Keep the demo assets in sync: `node tools/capture_demo.mjs && python3 tools/make_demo.py`.

## Commit style

Short imperative subject, e.g. `Add one-use consent tokens` or `Fix manifest permissions shape`. Reference the issue or research note when relevant.

## Reporting bugs

Open an issue with: what you ran, what you expected, what happened, the request ID / endpoint, and whether it reproduces in demo mode. For sensitive findings, follow `SECURITY.md` instead of filing a public issue.
