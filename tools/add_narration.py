#!/usr/bin/env python3
"""Add a natural Indian-English voiceover to docs/demo.mp4.

Uses macOS `say` with the en-IN voice Rishi (no cloud TTS, no 'AI voice'),
then muxes the result into docs/demo-voice.mp4. Run after make_demo.py.
"""
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
VIDEO = DOCS / "demo.mp4"
OUT = DOCS / "demo-voice.mp4"
AUDIO_OUT = DOCS / "demo-narration.m4a"

VOICE = "Rishi"
RATE = 172
STARTS_MS = [500, 8000, 15500, 23000, 30500, 38000]
LINES = [
    "This is Position Glance. A little app for Even G2 glasses — one open position, right in your line of sight.",
    "The backend pulls a Hyperliquid testnet position. No login on the glasses, no keys in the app.",
    "One tap starts the mic. You just say it naturally: close half my BTC long.",
    "That becomes one clear line: sell zero point zero two five BTC, reduce only.",
    "Nothing goes out until you tap yes. The order is signed on the server, with a testnet agent wallet.",
    "Testnet, simulated, no advice. That's the whole loop.",
]


def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main():
    for tool in ("say", "ffmpeg"):
        if shutil.which(tool) is None:
            raise SystemExit(f"{tool} not found (this tool uses macOS built-in speech)")

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        wavs = []
        for i, line in enumerate(LINES):
            aiff = tmp / f"s{i}.aiff"
            wav = tmp / f"s{i}.wav"
            run(["say", "-v", VOICE, "-r", str(RATE), "-o", str(aiff), line])
            run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(aiff),
                 "-ar", "48000", "-ac", "1", str(wav)])
            wavs.append(wav)

        inputs = []
        for w in wavs:
            inputs += ["-i", str(w)]
        filters = []
        for i, start in enumerate(STARTS_MS):
            filters.append(f"[{i}:a]adelay={start}|{start}[a{i}]")
        filters.append("".join(f"[a{i}]" for i in range(len(wavs))) +
                       f"amix=inputs={len(wavs)}:duration=longest:normalize=0,"
                       "volume=1.15,alimiter=limit=0.95[narr]")
        run(["ffmpeg", "-y", "-loglevel", "error", *inputs,
             "-filter_complex", ";".join(filters), "-map", "[narr]",
             "-c:a", "aac", "-b:a", "160k", str(AUDIO_OUT)])

        run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(VIDEO), "-i", str(AUDIO_OUT),
             "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac",
             "-shortest", str(OUT)])

    print(f"wrote {AUDIO_OUT} ({AUDIO_OUT.stat().st_size // 1024} KB)")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
