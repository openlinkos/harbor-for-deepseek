"""Pixel diff of official stills against docs/parity/ours.

Masks the sidebar (brand mark and conversation titles) before comparing.
Writes docs/parity/diff.json and prints a table.
"""
from json import dump
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

OFFICIAL = Path("/cursor/stores/bot/hfd-ref/official-dump")
OURS = Path("/workspace/docs/parity/ours")
OUT = Path("/workspace/docs/parity")
SIDEBAR = 280


def mask(image: Image.Image) -> Image.Image:
    painted = image.convert("RGB")
    draw = ImageDraw.Draw(painted)
    draw.rectangle((0, 0, SIDEBAR, painted.height), fill=(0, 0, 0))
    return painted


def mismatch(official: Path, ours: Path) -> float:
    left = mask(Image.open(official))
    right = mask(Image.open(ours).resize(left.size, Image.Resampling.LANCZOS))
    diff = ImageChops.difference(left, right)
    pixels = diff.convert("L").point(lambda value: 255 if value > 24 else 0)
    changed = sum(1 for value in pixels.getdata() if value)
    return 100 * changed / (left.width * left.height)


def main() -> None:
    rows = []
    for official in sorted(OFFICIAL.glob("*.png")):
        ours = OURS / official.name
        if not ours.exists():
            rows.append({"state": official.stem, "mismatch": None, "status": "missing"})
            continue
        score = round(mismatch(official, ours), 2)
        rows.append({"state": official.stem, "mismatch": score, "status": "pass" if score < 12 else "fail"})
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "diff.json").write_text("", encoding="utf-8")
    with (OUT / "diff.json").open("w", encoding="utf-8") as handle:
        dump(rows, handle, ensure_ascii=False, indent=2)
    print(f"{'state':55} {'mismatch':>8}  status")
    for row in rows:
        score = "—" if row["mismatch"] is None else f"{row['mismatch']:.2f}%"
        print(f"{row['state']:55} {score:>8}  {row['status']}")
    side = OUT / "compare"
    side.mkdir(parents=True, exist_ok=True)
    for official in sorted(OFFICIAL.glob("*.png")):
        ours = OURS / official.name
        if not ours.exists():
            continue
        left = Image.open(official).convert("RGB")
        right = Image.open(ours).convert("RGB").resize(left.size, Image.Resampling.LANCZOS)
        bar = 22
        canvas = Image.new("RGB", (left.width * 2 + 8, left.height + bar), (24, 24, 26))
        draw = ImageDraw.Draw(canvas)
        font = ImageFont.load_default()
        draw.text((12, 4), f"official   {official.stem}", fill=(210, 210, 210), font=font)
        draw.text((left.width + 20, 4), "ours", fill=(210, 210, 210), font=font)
        canvas.paste(left, (0, bar))
        canvas.paste(right, (left.width + 8, bar))
        canvas.save(side / official.name)


if __name__ == "__main__":
    main()
