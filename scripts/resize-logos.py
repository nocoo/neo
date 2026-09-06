#!/usr/bin/env python3
"""
Generate all derived logo assets from the single-source logo.png.

Usage:
    python3 scripts/resize-logos.py

Requires: Pillow (`pip install Pillow`)

Outputs:
    public/logo-24.png       — sidebar icon
    public/logo-80.png       — login page icon
    app/icon.png             — 32x32 favicon (Next.js file-based metadata)
    app/apple-icon.png       — 180x180 Apple touch icon
    app/favicon.ico          — 16+32 multi-size ICO
    app/opengraph-image.png  — 1200x630 OG image (RGB, brand background)
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "logo.png"

# Brand background color (dark, matches the logo's black background)
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


def make_ico(src: Image.Image) -> list[Image.Image]:
    """Return 16px and 32px RGBA images for ICO embedding."""
    return [resize(src, 16), resize(src, 32)]


def main() -> None:
    if not LOGO.exists():
        raise FileNotFoundError(f"Source logo not found: {LOGO}")

    src = Image.open(LOGO).convert("RGBA")
    print(f"Source: {LOGO} ({src.size[0]}x{src.size[1]}, {src.mode})")

    public = ROOT / "public"
    app = ROOT / "app"
    public.mkdir(exist_ok=True)
    app.mkdir(exist_ok=True)

    # -- public/ assets (for <img> usage in components) --
    for size, name in [(24, "logo-24.png"), (80, "logo-80.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
        out = public / name
        resize(src, size).save(out, "PNG")
        print(f"  ✓ {out.relative_to(ROOT)} ({size}x{size})")

    # -- app/ metadata assets (Next.js file-based conventions) --
    icon32 = resize(src, 32)
    out = app / "icon.png"
    icon32.save(out, "PNG")
    print(f"  ✓ {out.relative_to(ROOT)} (32x32)")

    apple = resize(src, 180)
    out = app / "apple-icon.png"
    apple.save(out, "PNG")
    print(f"  ✓ {out.relative_to(ROOT)} (180x180)")

    # favicon.ico — multi-size (16 + 32)
    ico_sizes = make_ico(src)
    out = app / "favicon.ico"
    ico_sizes[0].save(out, format="ICO", append_images=ico_sizes[1:], sizes=[(16, 16), (32, 32)])
    print(f"  ✓ {out.relative_to(ROOT)} (16+32 multi-size)")

    # OG image
    og = make_og(src)
    out = app / "opengraph-image.png"
    og.save(out, "PNG")
    print(f"  ✓ {out.relative_to(ROOT)} (1200x630)")

    print("\nDone! All assets generated.")


if __name__ == "__main__":
    main()
