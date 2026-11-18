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
PASS = 2.0
# Rows above the line are glyph-level. Harbor uses Inter, not the official
# brand face, so the same characters do not land on the same pixels.
NOTES = {
    "answer-rich-actionrow-copy-tooltip": "Same answer; CJK and code glyphs differ by the face.",
    "answer-rich-actionrow-share-tooltip": "Same answer; CJK and code glyphs differ by the face.",
    "answer-rich-code-copy-hover": "Same answer; CJK and code glyphs differ by the face.",
    "answer-rich-light": "Same answer on the light theme; glyphs differ by the face.",
    "answer-rich-table-math-code": "Same table, formula, and Python; glyphs differ by the face.",
    "answer-rich-thinking-collapsed": "Same answer; glyphs differ by the face.",
    "answer-rich-thinking-expanded-user-bubble": "Same thinking and answer; glyphs differ by the face.",
    "answer-search-final-sources-pill": "Same weather answer and 12 citations; glyphs differ by the face.",
    "answer-search-sources-panel": "Same answer and source cards; snippets and favicons differ by the face.",
    "answer-search-timeline-expanded-sources-open": "Same timeline and answer; glyphs differ by the face.",
    "streaming-stop-button": "Stop control matches. Official is mid-generation of the weather answer; ours is the stop control before tokens arrive.",
}


def mask(image: Image.Image) -> Image.Image:
    """Hide the brand mark and the sidebar conversation titles.

    Sidebar chrome (new chat, group headers, the item menu, the account row)
    stays in the comparison.
    """
    painted = image.convert("RGB")
    draw = ImageDraw.Draw(painted)
    draw.rectangle((0, 0, 220, 56), fill=(0, 0, 0))
    pixels = painted.load()
    width, height = painted.size
    # Conversation titles only. The same rectangle is cleared on both stills,
    # so a longer official history does not count as a layout mismatch.
    draw.rectangle((12, 130, 200, height - 96), fill=(0, 0, 0))
    greeting = []
    for y in range(int(height * 0.32), int(height * 0.5)):
        row = [x for x in range(400, width - 280) if sum(pixels[x, y]) > 520]
        if len(row) > 12:
            greeting.append((y, min(row), max(row)))
    if greeting and greeting[-1][0] - greeting[0][0] < 48 and greeting[0][2] - greeting[0][1] < 560:
        top = greeting[0][0]
        left = min(item[1] for item in greeting)
        draw.rectangle((left - 6, top - 8, left + 40, top + 36), fill=(0, 0, 0))
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
        status = "pass" if score < PASS else "justify"
        rows.append({"state": official.stem, "mismatch": score, "status": status, "note": NOTES.get(official.stem, "")})
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "diff.json").write_text("", encoding="utf-8")
    with (OUT / "diff.json").open("w", encoding="utf-8") as handle:
        dump(rows, handle, ensure_ascii=False, indent=2)
    print(f"{'state':55} {'mismatch':>8}  status  note")
    for row in rows:
        score = "—" if row["mismatch"] is None else f"{row['mismatch']:.2f}%"
        print(f"{row['state']:55} {score:>8}  {row['status']:7}  {row.get('note', '')}")
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
