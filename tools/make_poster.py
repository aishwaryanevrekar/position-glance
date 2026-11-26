#!/usr/bin/env python3
"""Build a clickable README poster from a frame of the narrated demo video."""
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
VIDEO = DOCS / "demo-voice.mp4"
OUT = DOCS / "demo-poster.png"


def font(size):
    for p in ("/System/Library/Fonts/Menlo.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def main():
    if shutil.which("ffmpeg") is None:
        raise SystemExit("ffmpeg not found")
    with tempfile.TemporaryDirectory() as tmp:
        frame = Path(tmp) / "frame.png"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "12", "-i", str(VIDEO),
                        "-frames:v", "1", str(frame)], check=True)
        img = Image.open(frame).convert("RGBA")
        W, H = img.size

        # Darken the left/centre so the overlay reads, keep the right API trace visible.
        veil = Image.new("RGBA", (W, H), (4, 8, 5, 175))
        img = Image.alpha_composite(img, veil)

        d = ImageDraw.Draw(img)
        d.rounded_rectangle((60, 150, W - 60, 330), radius=18, fill=(7, 14, 9, 225), outline=(80, 200, 100, 255), width=2)

        # Play triangle
        cx, cy, r = 145, 240, 48
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(141, 255, 155, 255))
        d.polygon([(cx - 14, cy - 24), (cx - 14, cy + 24), (cx + 28, cy)], fill=(7, 14, 9, 255))

        f1, f2 = font(30), font(17)
        d.text((230, 190), "POSITION GLANCE", font=f1, fill=(141, 255, 155, 255))
        d.text((232, 238), "Demo with Indian-English voiceover · 42 seconds", font=f2, fill=(205, 216, 207, 255))
        d.text((232, 272), "Read → voice → tap → signed testnet order", font=f2, fill=(120, 150, 125, 255))

        img.convert("RGB").save(OUT)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
