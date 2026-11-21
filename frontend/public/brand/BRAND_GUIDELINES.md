# Karto — Brand & Logo Usage Guidelines

## 1. The Mark ("Parcel-K")
Karto's symbol distills *karto* (omnichannel cart and parcel fulfillment) into a single bold geometric monogram: an industrial chamfered shipping silhouette carved on exact `45°` planes to form an unmistakable stencil **K**.

## 2. Master Files (`frontend/public/brand/`)
| Variant | File | Use |
| --- | --- | --- |
| Primary symbol | `masters/karto-symbol.svg` | Navigation rail, headers, app tiles, watermarks (`>= 32 px`) |
| Small-size cut | `masters/karto-symbol-small.svg` | Favicons & compact badges (`16–24 px`; heavier arms and wider outer footprint) |
| Horizontal lockup | `masters/karto-horizontal.svg` | Web headers, documents, slide covers, signage |
| Stacked lockup | `masters/karto-stacked.svg` | Square cards, title pages, vertical banners |
| Wordmark only | `masters/karto-wordmark.svg` | Editorial contexts where the Parcel-K symbol already appears nearby |
| Web & app icons | `exports/symbol/favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest` | Browser tabs, bookmarks, and PWA installs |

All master SVGs use pure outlined vector paths (zero `<text>` elements, zero raster embeds, zero filters).

## 3. Colour Palette
| Role | Hex | RGB | Usage |
| --- | --- | --- | --- |
| **Obsidian Ink** | `#171719` | `23, 23, 25` | Primary mark on light surfaces (`#FFFFFF`, `#F5F5F7`) |
| **Pure White** | `#FFFFFF` | `255, 255, 255` | Reversed mark on dark surfaces (`#111113`, `#171719`, black rail) |
| **Pure Black** | `#000000` | `0, 0, 0` | High-contrast monochrome print / PDF stamps |

Always maintain WCAG AAA contrast (`>= 7:1`). Never apply gradients, drop shadows, or multi-colour fills to the mark.

## 4. Clear Space & Minimum Sizes
- **Clear space:** Maintain a minimum clear zone equal to **the chamfer width (`40` units on the `256` grid)** on all four sides.
- **Minimum digital size:** `16 px` for the small-size symbol cut; `24 px` for the primary symbol; `110 px` wide for the horizontal lockup.
- **Minimum print size:** `10 mm` for the symbol; `28 mm` wide for the horizontal lockup.

## 5. Misuse (Do Not)
- Do not stretch, skew, rotate, or alter the `45°` bevel and cutout angles of **Parcel-K**.
- Do not add outlines, drop shadows, gradients, or multi-colour fills to the monogram.
- Do not place the dark mark on mid-grey or busy photographic backgrounds without a solid high-contrast container.
- Do not re-typeset the `KARTO` lockup wordmark in another font; always use the outlined lockup files.
