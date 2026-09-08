#!/usr/bin/env python3
"""
Regenerate PastQ's icon set from one definition.

The mark is a sheet of paper with its top-right corner turned back and a bold
Q on it. Anything finer — ruled lines, thin strokes — turns to mud at the 40px
a home screen actually renders, so the whole icon is two shapes and a letter.

    python3 scripts/make-icons.py
    python3 scripts/make-icons.py --preview /tmp/sizes.png

Needs Pillow (`pip install Pillow`). It is a design-time tool, not a runtime
dependency of the app, so it is deliberately not in package.json.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

# --- palette ---------------------------------------------------------------

INK = (18, 32, 58)        # ground, and the Q itself
PAPER = (245, 241, 230)   # warm off-white, not a sterile pure white
AMBER = (233, 161, 59)    # the underside of the turned corner

# --- geometry, as fractions of the icon's edge ------------------------------

INSET_X = 0.175
INSET_Y = 0.145
FOLD = 0.155
GLYPH_HEIGHT = 0.60       # cap height of the Q relative to the sheet

ASSETS = Path(__file__).resolve().parent.parent / "assets" / "images"

FONT_CANDIDATES = (
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
)


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_sheet(d: ImageDraw.ImageDraw, box, fold, *, paper, mark, flap) -> None:
    x0, y0, x1, y1 = box
    d.polygon([(x0, y0), (x1 - fold, y0), (x1, y0 + fold), (x1, y1), (x0, y1)], fill=paper)
    d.polygon([(x1 - fold, y0), (x1, y0 + fold), (x1 - fold, y0 + fold)], fill=flap)

    font = load_font(int((y1 - y0) * GLYPH_HEIGHT))
    width = d.textlength("Q", font=font)
    ascent, descent = font.getmetrics()
    # Optical centring: the Q's tail hangs low, so nudge it up off the true middle.
    d.text(
        ((x0 + x1 - width) / 2, (y0 + y1 - (ascent + descent)) / 2 + (y1 - y0) * 0.02),
        "Q",
        font=font,
        fill=mark,
    )


def render(size: int, *, transparent: bool = False, mono: bool = False) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if not transparent:
        d.rectangle([0, 0, size, size], fill=INK)

    box = (size * INSET_X, size * INSET_Y, size * (1 - INSET_X), size * (1 - INSET_Y))

    if mono:
        # Android themed icons are a single-colour silhouette; the Q is knocked
        # out of the sheet and the flap only differs by opacity.
        draw_sheet(d, box, size * FOLD,
                   paper=(255, 255, 255, 255), mark=(0, 0, 0, 0), flap=(255, 255, 255, 140))
    else:
        draw_sheet(d, box, size * FOLD, paper=PAPER, mark=INK, flap=AMBER)

    return img


def write_all() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)

    # iOS and the stores: full bleed, no alpha, no baked corner radius. iOS
    # masks the icon itself, and a pre-rounded one shows dark slivers under it.
    render(1024).convert("RGB").save(ASSETS / "icon.png")

    # Android adaptive: the system crops and animates the foreground, so the art
    # has to sit inside the safe zone rather than filling the layer.
    foreground = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    art = render(330, transparent=True)
    foreground.paste(art, (91, 91), art)
    foreground.save(ASSETS / "android-icon-foreground.png")

    # Must match the foreground's dimensions.
    Image.new("RGB", (512, 512), INK).save(ASSETS / "android-icon-background.png")

    monochrome = Image.new("RGBA", (432, 432), (0, 0, 0, 0))
    silhouette = render(280, transparent=True, mono=True)
    monochrome.paste(silhouette, (76, 76), silhouette)
    monochrome.save(ASSETS / "android-icon-monochrome.png")

    render(1024).resize((48, 48), Image.LANCZOS).convert("RGB").save(ASSETS / "favicon.png")
    render(512, transparent=True).save(ASSETS / "splash-icon.png")

    for name in ("icon", "android-icon-foreground", "android-icon-background",
                 "android-icon-monochrome", "favicon", "splash-icon"):
        path = ASSETS / f"{name}.png"
        print(f"  {path.relative_to(ASSETS.parent.parent)}  {Image.open(path).size}")


def write_preview(dest: Path) -> None:
    """A contact sheet at the sizes iOS renders, masked the way iOS masks."""
    source = Image.open(ASSETS / "icon.png").convert("RGB")
    sizes = [180, 120, 87, 60, 40]
    gap, pad = 34, 40

    def masked(size: int) -> Image.Image:
        im = source.resize((size, size), Image.LANCZOS).convert("RGBA")
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [0, 0, size - 1, size - 1], radius=int(size * 0.2237), fill=255
        )
        im.putalpha(mask)
        return im

    width = pad * 2 + sum(sizes) + gap * (len(sizes) - 1)
    height = pad * 2 + max(sizes) + 40
    sheet = Image.new("RGB", (width, height), (238, 238, 241))
    d = ImageDraw.Draw(sheet)
    label_font = load_font(18)

    x = pad
    for size in sizes:
        icon = masked(size)
        sheet.paste(icon, (x, pad + (max(sizes) - size)), icon)
        label = f"{size}px"
        d.text(
            (x + (size - d.textlength(label, font=label_font)) / 2, pad + max(sizes) + 12),
            label,
            font=label_font,
            fill=(70, 70, 80),
        )
        x += size + gap

    sheet.save(dest)
    print(f"  preview -> {dest}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", type=Path, help="also write a size contact sheet here")
    args = parser.parse_args()

    print("writing icons:")
    write_all()
    if args.preview:
        write_preview(args.preview)
