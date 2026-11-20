# Estante — Brand & Logo Usage Guidelines

## 1. The Mark ("Standing Shelf")
Estante's symbol distills *estante* (bookshelf / structured archive) into four pure geometric primitives: two upright volumes (`SIS`, `LMS`) and one 15° leaning volume (`Library`) resting evenly above a single unified horizontal shelf (`Master Store`).

## 2. Master Files (`frontend/public/brand/`)
| Variant | File | Use |
| --- | --- | --- |
| Primary symbol | `masters/estante-symbol.svg` | Navigation rail, headers, app tiles, watermarks (`>= 32 px`) |
| Small-size cut | `masters/estante-symbol-small.svg` | Favicons & compact badges (`16–24 px`; wider gaps & bolder strokes) |
| Horizontal lockup | `masters/estante-horizontal.svg` | Primary web headers, documents, slide covers, signage |
| Stacked lockup | `masters/estante-stacked.svg` | Square cards, title pages, vertical banners |
| Wordmark only | `masters/estante-wordmark.svg` | Editorial contexts where the symbol already appears nearby |
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
- **Clear space:** Maintain a minimum clear zone equal to **`1×` the height of the horizontal shelf bar** (`30` units on the `256` grid) on all four sides.
- **Minimum digital size:** `16 px` for the small-size symbol cut; `24 px` for the primary symbol; `110 px` wide for the horizontal lockup.
- **Minimum print size:** `10 mm` for the symbol; `28 mm` wide for the horizontal lockup.

## 5. Misuse (Do Not)
- Do not stretch, skew, rotate, or alter the 15° angle of the leaning volume.
- Do not change the relative spacing between the volumes and the shelf base.
- Do not place the dark mark on mid-grey or busy photographic backgrounds without a solid high-contrast container.
- Do not re-typeset the `ESTANTE` lockup wordmark in another font; always use the outlined lockup files.
