#!/usr/bin/env python3
"""Render a demo video from the REAL backend API trace in docs/demo-trace.json.

Run: node tools/capture_demo.mjs && python3 tools/make_demo.py
Requires Pillow + ffmpeg.
"""
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
TRACE = ROOT / "docs" / "demo-trace.json"
OUT = ROOT / "docs"
W, H, FPS = 1280, 720, 24
BG = (8, 11, 9)
PANEL = (12, 18, 14)
GREEN = (141, 255, 155)
DIM = (100, 122, 105)
WHITE = (205, 216, 207)
AMBER = (255, 178, 122)
CYAN = (110, 190, 255)
X_LENS, Y_LENS = 44, 124
LOG_X, LOG_Y, LOG_W = 660, 124, 576


def font(size):
    for p in ("/System/Library/Fonts/Menlo.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def summary(obj, limit=150):
    s = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    return s if len(s) <= limit else s[:limit] + "…"


def wrap(text, width):
    out = []
    for line in text.split("\n"):
        while len(line) > width:
            cut = line.rfind(" ", 0, width)
            if cut < width // 2:
                cut = width
            out.append(line[:cut])
            line = line[cut:].lstrip()
        out.append(line)
    return out


def frame(trace, t, step_i, frac):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    f14, f18, f22 = font(14), font(18), font(22)

    d.text((44, 26), "POSITION GLANCE", font=f22, fill=GREEN)
    d.text((44, 60), "Track 02 · Crypto & DeFi · Hyperliquid testnet", font=f14, fill=DIM)
    d.rounded_rectangle((W - 260, 30, W - 40, 60), radius=12, outline=GREEN, width=1)
    d.text((W - 246, 35), "SIMULATED · NO ADVICE", font=f14, fill=GREEN)

    # Lens
    d.rounded_rectangle((X_LENS - 16, Y_LENS - 16, X_LENS + 592, Y_LENS + 304), radius=14, outline=(42, 70, 48), width=2)
    d.text((X_LENS, Y_LENS - 32), "GLASSES DISPLAY  576 × 288", font=f14, fill=DIM)
    step = trace["steps"][step_i]
    lens_lines = wrap(step["lens"], 30)[:8]
    revealed = int(len("".join(lens_lines)) * min(1.0, frac * 3.5))
    consumed = 0
    y = Y_LENS + 26
    for line in lens_lines:
        if consumed >= revealed:
            break
        part = line[: max(0, revealed - consumed)]
        col = GREEN
        if "SIMULATED" in line or "TESTNET" in line or "TAP=" in line or "TAP voice" in line:
            col = DIM
        d.text((X_LENS + 22, y), part, font=f18, fill=col)
        consumed += len(line) + 1
        y += 32

    # Step label
    d.text((X_LENS, Y_LENS + 340), f"STEP {step_i + 1}/{len(trace['steps'])}  ·  {step['name']}", font=f18, fill=AMBER)

    # API trace panel
    d.text((LOG_X, LOG_Y - 32), "LIVE BACKEND TRACE", font=f14, fill=DIM)
    d.rounded_rectangle((LOG_X - 12, LOG_Y - 12, LOG_X + LOG_W + 12, LOG_Y + 440), radius=10, fill=PANEL, outline=(30, 48, 34), width=1)
    y = LOG_Y + 4
    for i in range(step_i + 1):
        s = trace["steps"][i]
        if i == step_i and frac < 0.35:
            continue
        d.text((LOG_X, y), f"[{i + 1}] {s['name']}", font=f14, fill=AMBER)
        y += 20
        d.text((LOG_X + 12, y), s["endpoint"], font=f14, fill=CYAN)
        y += 20
        if s["request"] is not None:
            for ln in wrap("req  " + summary(s["request"]), 68)[:2]:
                d.text((LOG_X + 12, y), ln, font=f14, fill=DIM)
                y += 18
        resp_lines = wrap("res  " + summary(s["response"]), 68)[:3]
        for ln in resp_lines:
            d.text((LOG_X + 12, y), ln, font=f14, fill=WHITE)
            y += 18
        y += 12
        if y > LOG_Y + 400:
            break

    # progress
    prog = (step_i + frac) / len(trace["steps"])
    d.rounded_rectangle((44, H - 52, W - 44, H - 44), radius=4, fill=(30, 48, 34))
    d.rounded_rectangle((44, H - 52, 44 + int((W - 88) * prog), H - 44), radius=4, fill=GREEN)
    d.text((44, H - 78), "source: docs/demo-trace.json · every frame shows real backend responses", font=f14, fill=DIM)
    return img


def main():
    if shutil.which("ffmpeg") is None:
        raise SystemExit("ffmpeg not found")
    trace = json.loads(TRACE.read_text())
    steps = trace["steps"]
    # Paced to the natural Indian-English narration (docs/narration-script.md).
    per_step = 7.5
    total = len(steps) * per_step + 1.5

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        n = 0
        for k in range(int(total * FPS)):
            t = k / FPS
            raw = max(0.0, t - 0.5)
            i = min(len(steps) - 1, int(raw / per_step))
            frac = min(1.0, (raw - i * per_step) / per_step)
            frame(trace, t, i, frac).save(tmp / f"f{n:05d}.png")
            n += 1

        mp4 = OUT / "demo.mp4"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS),
                        "-i", str(tmp / "f%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p",
                        "-crf", "22", "-movflags", "+faststart", str(mp4)], check=True)
        gif = OUT / "demo.gif"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS),
                        "-i", str(tmp / "f%05d.png"),
                        "-filter_complex", "[0:v]scale=720:-1:flags=lanczos,fps=8,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer",
                        "-loop", "0", str(gif)], check=True)
    print(f"wrote {mp4} ({mp4.stat().st_size // 1024} KB)")
    print(f"wrote {gif} ({gif.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
