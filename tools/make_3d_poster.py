#!/usr/bin/env python3
"""Build a clickable README poster from the 3D demo film."""
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
VIDEO = DOCS / "demo-3d.mp4"
OUT = DOCS / "demo-3d-poster.png"


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
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "160", "-i", str(VIDEO),
                        "-frames:v", "1", str(frame)], check=True)
        img = Image.open(frame).convert("RGBA")
        W, H = img.size
        veil = Image.new("RGBA", (W, H), (4, 8, 5, 150))
        img = Image.alpha_composite(img, veil)
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((60, 140, W - 60, 330), radius=18,
                            fill=(7, 14, 9, 225), outline=(80, 200, 100, 255), width=2)
        cx, cy, r = 145, 235, 48
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(141, 255, 155, 255))
        d.polygon([(cx - 14, cy - 24), (cx - 14, cy + 24), (cx + 28, cy)], fill=(7, 14, 9, 255))
        d.text((230, 180), "POSITION GLANCE — 3D", font=font(30), fill=(141, 255, 155, 255))
        d.text((232, 228), "2:50 · Indian female narration · original score", font=font(17), fill=(205, 216, 207, 255))
        d.text((232, 262), "Read → voice → tap → signed testnet order", font=font(17), fill=(120, 150, 125, 255))
        img.convert("RGB").save(OUT)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
