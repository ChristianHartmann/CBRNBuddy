#!/usr/bin/env python3
"""
Render the app icon assets from the master artwork.

    python3 scripts/generate-app-icons.py

Source is branding/cbrn-buddy-icon.png, output goes to apps/mobile/assets/. The files
are consumed by app.json, which is also where the background colour behind the adaptive
icon and the splash screen is set - keep the two in sync.

Four assets, three different rules:

  adaptive-icon.png  Android foreground layer. Transparent, artwork inside the launcher
                     safe zone, see app_icons.py.
  icon.png           Square store and fallback icon. Opaque: neither Play nor the App
                     Store accept an alpha channel here.
  splash-icon.png    Drawn with resizeMode "contain" and therefore transparent, with
                     enough margin that it does not touch the screen edges.
  favicon.png        Web build only.

Regenerating produces byte identical files, so a no-op run leaves the working tree clean.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from app_icons import ADAPTIVE_FRACTION, SPLASH_FRACTION, SQUARE_FRACTION, fit_box

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = REPO_ROOT / "branding" / "cbrn-buddy-icon.png"
DEFAULT_OUT = REPO_ROOT / "apps" / "mobile" / "assets"

# app.json: expo.splash.backgroundColor and expo.android.adaptiveIcon.backgroundColor.
BACKGROUND = (18, 18, 18, 255)

# name, canvas edge in pixels, fraction of the canvas, opaque
ASSETS = [
    ("adaptive-icon.png", 1024, ADAPTIVE_FRACTION, False),
    ("icon.png", 1024, SQUARE_FRACTION, True),
    ("splash-icon.png", 1024, SPLASH_FRACTION, False),
    ("favicon.png", 64, SQUARE_FRACTION, False),
]


def render(source, canvas, fraction, opaque):
    from PIL import Image

    x, y, width, height = fit_box(source.size, canvas, fraction)
    artwork = source.resize((width, height), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), BACKGROUND if opaque else (0, 0, 0, 0))
    out.paste(artwork, (x, y), artwork)
    return out.convert("RGB") if opaque else out


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args(argv)

    try:
        from PIL import Image
    except ImportError:
        print("Pillow is missing: pip install -r scripts/requirements.txt", file=sys.stderr)
        return 1

    if not args.source.is_file():
        print(f"Source artwork not found: {args.source}", file=sys.stderr)
        return 1

    source = Image.open(args.source).convert("RGBA")
    args.out.mkdir(parents=True, exist_ok=True)
    for name, canvas, fraction, opaque in ASSETS:
        target = args.out / name
        render(source, canvas, fraction, opaque).save(target)
        print(f"{target.relative_to(REPO_ROOT)}  {canvas}x{canvas}  {fraction:.0%}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
