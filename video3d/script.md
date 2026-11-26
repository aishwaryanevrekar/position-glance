# Position Glance 3D demo — narration script

Voice: macOS `Tara (English (India))`, en-IN female, rate 160. Target duration 2:50 (170 s). Rendered by `tools/render_3d.mjs`.

Every number here comes from `docs/demo-trace.json`, `README.md` or the DoraHacks brief. Nothing is invented.

| Start | Spoken line |
|---|---|
| 0.5 | This is Position Glance, a little app for Even G2 smart glasses. One open position, right in your line of sight. |
| 9.5 | It reads a Hyperliquid testnet position through a public address. No login on the glasses, and no keys in the app. |
| 18.5 | The display is tiny, five hundred seventy six by two hundred eighty eight, monochrome green. So it shows one thing, not a dashboard. |
| 27.5 | Here is the position. Bitcoin long, zero point zero five. Unrealized P and L, plus one thousand dollars. Mark, ninety six thousand one hundred seventy three. |
| 36.5 | Those numbers come from the info endpoint. It needs no credentials, and it is read from the master address, never the agent wallet. |
| 45.5 | Now the other half, acting on it. One tap starts the glasses microphone, and the audio goes to our own backend as sixteen kilohertz PCM. |
| 54.5 | You say it the way you would say it to a friend. Close half my BTC long. |
| 63.5 | We wrap the audio in a WAV header, transcribe it, and turn the transcript into strict JSON. Action, coin, fraction, side. |
| 72.5 | That becomes a single line on the lens. Sell zero point zero two five Bitcoin, reduce only. |
| 81.5 | Nothing is sent at this point. The preview is a draft, and the only way past it is an explicit tap. |
| 90.5 | Tap means yes. Swipe means no. Double tap always exits the app, which is what the reviewers check first. |
| 99.5 | Behind that tap is a one use token, valid for sixty seconds. It cannot be replayed, and declining sends nothing. |
| 108.5 | Only then does the backend sign a reduce only order with a testnet agent wallet. The key never leaves the server. |
| 117.5 | The wallet has no withdrawal rights. There is no custody, no user funds, and no way to increase exposure. |
| 126.5 | The app never tells you what to do. No scores, no ratings, no should I close. Just the raw numbers you asked for. |
| 135.5 | There is also a Telegram bridge. Pair a public address, ask for status, or draft a close and confirm with a yes button. |
| 144.5 | That makes the same project eligible for a second track, but the build stays one trusted loop. One number, one sentence, one tap. |
| 153.5 | It is open source under MIT, free to run in the simulator, and every receipt says testnet simulated. Position Glance. |
