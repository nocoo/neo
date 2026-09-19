#!/usr/bin/env python3
"""
Generate transparent UI marks and separate install/touch/social presentations.

Usage:
    python3 scripts/resize-logos.py
    python3 scripts/resize-logos.py --check

Requires: Pillow (`pip install Pillow`)

Outputs:
    public/logo-24.png       — sidebar icon
    public/logo-80.png       — login page icon
    public/icon-192.png      — opaque, textured PWA icon
    public/icon-512.png      — opaque, textured PWA icon
    app/icon.png             — 32x32 favicon (Next.js file-based metadata)
    app/apple-icon.png       — 180x180 Apple touch icon
    app/favicon.ico          — 16+32 multi-size ICO
    app/opengraph-image.png  — 1200x630 OG image (RGB, brand background)
"""

from argparse import ArgumentParser
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "logo.png"

# Existing dark social canvas
BRAND_BG = (15, 15, 15)


def resize(src: Image.Image, size: int) -> Image.Image:
    """Resize preserving RGBA, using LANCZOS resampling."""
    return src.resize((size, size), Image.LANCZOS)


def make_og(src: Image.Image, width: int = 1200, height: int = 630) -> Image.Image:
    """Create an OG image: brand background, logo centered at ~40% canvas height, RGBA→RGB."""
    canvas = Image.new("RGB", (width, height), BRAND_BG)

    # Scale logo to ~40% of canvas height
    logo_h = int(height * 0.4)
    logo = src.resize((logo_h, logo_h), Image.LANCZOS)

    # Center horizontally, place at ~30% from top (visually centered)
    x = (width - logo_h) // 2
    y = (height - logo_h) // 2
    canvas.paste(logo, (x, y), logo)  # use alpha mask

    return canvas


def main() -> None:
    parser = ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify every export against its current master without writing files",
    )
    args = parser.parse_args()

    if not LOGO.exists():
        raise FileNotFoundError(f"Source logo not found: {LOGO}")

    src = Image.open(LOGO).convert("RGBA")
    # The adopted square master includes the texture and contact shadows.
    # Preserve its full canvas: no zoom, cover crop, or pre-rounded iOS mask.
    square = Image.open(ROOT / "assets/brand/icon.png").convert("RGB")
    rounded = Image.open(ROOT / "assets/brand/icon-rounded.png").convert("RGBA")
    print(f"Source: {LOGO} ({src.size[0]}x{src.size[1]}, {src.mode})")

    public = ROOT / "public"
    app = ROOT / "app"
    if not args.check:
        public.mkdir(exist_ok=True)
        app.mkdir(exist_ok=True)

    def export(image: Image.Image, out: Path, format: str = "PNG", **options) -> None:
        buffer = BytesIO()
        image.save(buffer, format=format, **options)
        generated = buffer.getvalue()
        if args.check:
            if not out.exists() or out.read_bytes() != generated:
                raise ValueError(
                    f"Stale or missing asset: {out.relative_to(ROOT)}; "
                    "regenerate with scripts/resize-logos.py"
                )
        else:
            out.write_bytes(generated)

    # -- public/ assets (for <img> usage in components) --
    for size, name in [(24, "logo-24.png"), (80, "logo-80.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
        out = public / name
        export(resize(square if size >= 192 else src, size), out)
        print(f"  ✓ {out.relative_to(ROOT)} ({size}x{size})")

    # -- app/ metadata assets (Next.js file-based conventions) --
    icon32 = resize(src, 32)
    out = app / "icon.png"
    export(icon32, out)
    print(f"  ✓ {out.relative_to(ROOT)} (32x32)")

    apple = resize(square, 180).convert("RGB")
    out = app / "apple-icon.png"
    export(apple, out)
    print(f"  ✓ {out.relative_to(ROOT)} (180x180)")

    # favicon.ico — multi-size (16 + 32)
    out = app / "favicon.ico"
    export(src, out, format="ICO", sizes=[(16, 16), (32, 32)])
    print(f"  ✓ {out.relative_to(ROOT)} (16+32 multi-size)")

    # OG image
    og = make_og(rounded)
    out = app / "opengraph-image.png"
    export(og, out)
    print(f"  ✓ {out.relative_to(ROOT)} (1200x630)")

    print("\nDone! All assets verified." if args.check else "\nDone! All assets generated.")


if __name__ == "__main__":
    main()
