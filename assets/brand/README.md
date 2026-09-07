# Neo logo assets

The original animal is retained byte-for-byte. This Refined pass adds the folded sunlight background, fine grain, and shallow contact shadows. No image model was called. The transparent foreground keeps its original pose, colors, anatomy, and native canvas.

## Asset roles

| Surface | Asset | Treatment |
| --- | --- | --- |
| README header | `assets/brand/icon-rounded.png` | Selected presentation at 128 px |
| Sidebar / landing / login | `public/logo-24.png; logo-80.png` | Transparent original; login avatar no longer clips the animal to a circle |
| Browser icons | `app/icon.png; app/favicon.ico` | Next file metadata; transparent 32 px PNG and decoded 16/32 px ICO |
| Apple touch | `app/apple-icon.png` | Square presentation at 180 px; the platform supplies the mask |
| Installed app / shortcuts | `public/icon-192.png; icon-512.png` | Square presentations; the duplicate maskable declaration was removed to protect the original framing |
| Open Graph | `app/opengraph-image.png` | Rounded presentation on the existing 1200 × 630 dark canvas |
| Independent identities | `worker/src/favicon.ts` | Fetched website favicons are unrelated to the Neo mascot and remain unchanged |

Root `logo.png` remains the canonical 2048 × 2048 transparent master. `icon.png` and `icon-rounded.png` in this directory are separate square and rounded presentations at the same native dimensions. Small UI marks use the foreground with no external glow, added background, or circular crop. Localized and package READMEs were checked for additional logo headers.

## Reproduce and verify

```sh
uv run --with pillow python scripts/resize-logos.py
```

The exact source, sampled palette, independent background layers, every export size, and frozen finishing recipe are archived in `nocoo/hexly.ai` under `artwork/logo-family/neo/2026-09-07-03/finishing/01`. [source.json](source.json) records provenance and all master SHA-256 values. The separate UI theme palette is unchanged.

- [Individual logo review](https://hexly.ai/logos/neo)
- [Local static review](https://index.dev.hexly.ai/artwork/logo-family/neo/2026-09-07-03/review.html)
- [Shared logo usage SOP](https://github.com/nocoo/hexly.ai/blob/main/docs/07-logo-usage-sop.md)

Before/after deliberately shares the same original foreground. Verify small marks at their actual displayed sizes on both themes, decode every ICO resolution, and keep any platform-specific mask separate from the transparent source.

The original lower shoulder entry deliberately meets the rounded tile base. The rounded mask intersects 3,798 terminal shoulder pixels at native resolution (about 0.14% of visible foreground), while ears, eyes, muzzle, and tongue remain clear. The transparent master is never clipped.
