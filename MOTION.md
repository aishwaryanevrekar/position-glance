# MOTION — Position Glance

Read this file in full before designing, generating or animating anything for this brand.

## 1. Colour and purpose
- `#0B0E0C` near-black — background, always
- `#121812` surface — cards, panels, depth
- `#8DFF9B` signal green — live data, confirmations, key word, play affordance
- `#3D7F4B` dim green — secondary labels, rules, captions
- `#E5E5E5` warm white — primary type
- `#FFB27A` amber — warnings, "testnet", section markers
Never introduce purple-to-blue gradients, neon magenta or stock "AI" palettes.

## 2. Type
Menlo / SFMono-Regular / system monospace only. Headline 56–72 px, body 26–34 px, micro labels 16–20 px at 1280×720. All caps for labels, sentence case for spoken lines. No emoji, no typewriter reveal.

## 3. Timing
A shot holds long enough to read: minimum 4 s for a headline, 3 s for a data card. Cuts on the spoken beat, not on a metronome. Entries ease out over 0.5–0.8 s; exits fade over 0.4 s. Motion on twos for hand-made-feel elements (hold each pose 2 frames at 24 fps). The first 3 seconds must already look like a film.

## 4. Movement
One slow, steady camera dolly forward and slightly up through a dark data space. Cards live in real depth: nearer cards larger, farther cards dimmer and desaturated. No shake, no spins. Rain or particles use a seeded function of time only, never `Math.random` at render time. `window.seek(seconds)` makes every frame reproducible.

## 5. Texture and finish
Matte dark surfaces, one soft green glow per frame maximum, thin 1–2 px rules, no heavy bloom. Reflections stay dim under type. Grain is subtle and fixed-seed. Sound: a low drone, a soft hit on each new shot, a lift on the final line. Silence is a failure.

## 6. Five things motion must never do
1. Never invent a number, date, quote or product claim.
2. Never draw a fake logo or fake product UI from memory.
3. Never address the viewer as "AI" or use "I'm delighted to..." language.
4. Never use typewriter text, bounce, gradient text or stock neon glow.
5. Never let text clip, overlap, or sit on a bright reflection.

## 7. One example, done right
Shot 1: a dark room, a slow dolly past three glass cards in depth. Near card reads `BTC LONG 0.0500`; middle card `uPnL +$1,001.26`; far card `MARK 96,173`. Each appears on its spoken word, white on near-black, green only on the number. Camera rises slightly. The title `POSITION GLANCE` lands lower left in the last third with `GLANCE` in `#8DFF9B`; ground under it stays dark. A low drone fades in, a soft hit marks each card, and the last line lifts.
