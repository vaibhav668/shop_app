# UI System — "Emerald Royal"

Bada Bazar should feel like a neighbourhood bazaar dressed like royalty: deep forest emerald, real gold, warm cream, and produce you could almost pick up. It must never look like a generic template.

The approved design board (live mockups of every screen and the motion system): https://claude.ai/artifact/HfHMC5GnY55aishijRnn54

## 1. Hard rules

- **No purple, violet, indigo, navy, dark blue or blue gradients**, anywhere, including library defaults (focus rings, Android ripples, chart colours).
- Colours come only from `mobile/src/theme/tokens.ts` (and `admin/src/styles/tokens.css`). CI (`scripts/check-palette.mjs`) fails on any other hex, or on a hex outside the token files.
- Gradients are allowed only for: the **forest** header/hero fill, the **gold foil**, and the skeleton/cart sheen. No rainbow or decorative blobs.
- Shadows are soft and tinted with deep forest (`shadow.sm/md/float`), never grey-black.
- No emoji in UI chrome. Products are shown by photos (or shaded art) on soft tints.
- Every animation has a reduce-motion fallback (instant or static).

## 2. Colour tokens

| Token | Hex | Use |
|---|---|---|
| `forest` (`action`) | `#14532D` | Primary buttons, ADD, stepper, cart pill, active tab, headers. White text on it is 10:1. |
| `forestDeep` | `#052E16` | Pressed states, gradient end, text on gold |
| `forestMid` | `#166534` | Secondary forest surfaces |
| `brand` | `#16A34A` | Icons, completed timeline, success accents |
| `leaf` / `brandTint` | `#86EFAC` / `#DCFCE7` | Highlights on forest / success backgrounds |
| `gold` | `#F59E0B` | Accents, the notification dot, foil mid-tone |
| `goldBright` | `#FBBF24` | **Text and icons on forest** (stepper, "View cart", active tab icon) |
| `goldPale` · `goldSoft` | `#FDE68A` · `#FEF3C7` | Foil highlights, promo tints |
| `goldDeep` · `crust` | `#92400E` · `#B45309` | Text on gold tints, breadcrumbs, the Devanagari name on light |
| `bg` | `#FAFAF7` | Warm cream page background |
| `surface` / `surfaceMuted` | `#FFFFFF` / `#F5F5F4` | Cards, sheets / quiet wells |
| `text` · `textSecondary` · `textTertiary` | `#171717` · `#737373` · `#A3A3A3` | Ink, secondary, disabled |
| `border` · `borderStrong` | `#E7E5E4` · `#D6D3D1` | Dividers, inputs |
| Tints: `tintMint` `tintSage` `tintButter` `tintPeach` `tintSand` `tintLime` | `#E3F7E8` `#E8EFE2` `#FEF6D8` `#FFEEDC` `#F3EDE2` `#EEF7D6` | Behind product art. `tintFor(id)` gives each product a stable tint. |
| `danger` / `dangerTint` | `#DC2626` / `#FEE2E2` | Errors, out of stock, cancel |

**Foil** = `#FDE68A → #F59E0B → #B45309 → #FBBF24 → #FEF3C7` at 25°. Used on discount ribbons (`Badge tone="foil"`), the brand mark, the order seal and savings banners, always with `forestDeep` text.

Contrast rules: on forest use only white, `goldBright` or `leaf`; body text is always ink on cream/white.

## 3. Typography

- **Plus Jakarta Sans** (600/700/800) for headings, prices and buttons.
- **Inter** (400–700) for body text and labels.
- **Tiro Devanagari Hindi** for the name बड़ा बाज़ार in the brand lockup.

| Variant | Font / size / line | Use |
|---|---|---|
| `hero` | Jakarta 800 · 32/36 | Home greeting, onboarding |
| `display` | Jakarta 800 · 26/31 | Order success |
| `title` | Jakarta 800 · 22/28 | Screen titles, empty states |
| `heading` | Jakarta 800 · 17/23 | Section headers |
| `button` | Jakarta 800 · 15/20 | Buttons, the cart pill, the active tab |
| `price` / `priceLg` | Jakarta 800 · 16/20 · 24/30 | Prices (tabular) |
| `body` / `bodyStrong` | Inter 400/600 · 16/22 | Text, inputs |
| `label` | Inter 500 · 14/20 | Product names, list rows |
| `caption` | Inter 400 · 13/18 | Units, metadata |
| `micro` | Inter 600 · 12/16 | Small status text |
| `tag` | Jakarta 800 · 11/14 | Ribbons ("12% OFF"), ADD |
| `devanagari` | Tiro · 20/30 | बड़ा बाज़ार |

Text scales with the system up to 1.3×; test at 1.3×.

## 4. Space, radius, elevation

- Spacing (4-pt): `4, 8, 12, 16, 20, 24, 32, 40`; screen gutter 16.
- Radius: `sm 8` badges · `md 14` buttons, inputs, stepper · `lg 20` cards and tiles · `xl 24` banners · `xxl 28` sheets and header corners · `full` chips, tab bar.
- Elevation: `shadow.sm` cards · `shadow.md` raised buttons, tab bar · `shadow.float` cart pill, sheets, toasts.
- Touch targets ≥ 44×44 dp.

## 5. Key components

**Decor** (`components/decor`): `Gradient`, `ForestFill`, `Foil` (SVG gradients that sit behind content) and `Jaali`, the gold lattice of a palace window screen, drawn behind forest headers at low opacity.

**PressableScale**: every tappable surface sinks to ~0.96 under the finger and springs back (`springs.press`).

**Button**: `primary` forest with a gold icon and a soft raised shadow · `gold` for forest surfaces · `secondary` white + border · `ghost` · `danger`. 52 dp tall (38 small).

**ProductCard**: white card, `shadow.sm`, radius 20, a tinted image well (`tintFor(product.id)`), a foil discount ribbon, the price in Jakarta 800, and a forest **ADD** with gold text that becomes the forest stepper.

**QuantityStepper**: forest squircle with gold − / +; the digit rolls in from above; `+` dims at the maximum.

**CartBar (cart pill)**: forest, radius 20, `shadow.float`, up to three overlapping product thumbnails, "3 items · ₹245", the amount left for free delivery, and a gold "View cart ›". It springs in, bounces when the count changes, and a gold sheen passes every few seconds.

**FloatingTabBar**: a white floating pill; the active tab grows into a labelled forest pill with a gold icon (labels never clip). The Account icon carries a gold dot for unread notifications.

**Chip**: white with a border; selected turns solid ink with white text.

**Skeleton**: a warm grey block with a light sweeping across it (static under reduce-motion).

**Empty / error states**: the icon in a mint medallion on a sage halo, a Jakarta title, one sentence, one primary action.

**BrandMark / BrandLockup**: a gold-foil squircle with a forest basket; the lockup adds "Bada Bazar" and बड़ा बाज़ार.

**Order timeline**: completed steps filled `brand`, the current step pulses gold, future steps hollow.

## 6. Copy

| Situation | Text |
|---|---|
| No products | "Nothing here yet." |
| Empty cart | "Your cart is waiting for something good." → [Start shopping] |
| No orders | "You haven't placed an order yet." |
| No search results | "No results for "paneer". Try a simpler word." |
| Offline | "You're offline. Showing what we saved earlier." |
| Generic error | "That didn't work. Try again?" → [Retry] |
| Shop closed | the `closed_message` from settings |
| Price changed | "Prices updated since you added these items. Please review your total." |
| Payment pending | "Waiting for payment confirmation… This usually takes a few seconds." |

Tone: short, plain, warm and local. Money is formatted with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`, and whole rupees drop the `.00`.

## 7. Motion

Built with Reanimated 4 on the UI thread. Presses and layout use springs (`springs.press`, `springs.layout`, `springs.bouncy` in tokens); timed fades use 120–400 ms. With reduce-motion on, animations are instant and loops (sheen, shimmer, pulses) are off.

Signature moves: press scale · ADD → stepper with a rolling digit · fly-to-cart into the cart pill · cart pill bounce and sheen · tab pill growing · collapsing Home header · big-word category tabs · offer carousel · product image parallax · swipe-to-remove in the cart · the order seal (pop, check draw, confetti, count-up) · the rider moving along the tracking route. The design board lists timings for each.

## 8. Iconography & imagery

- One icon set: **Lucide** (`lucide-react-native`, `lucide-react`), 1.9–2 px stroke, 20/24 px.
- Product photos on white or transparent backgrounds, square, at least 800 px. They are delivered through Cloudinary at 2× display size in WebP/AVIF. A blurhash placeholder is shown while loading.
- Banners: real photography of produce or of the shop, 16:7, with text drawn by the app (not baked into the image) so it stays sharp and editable.

## 9. Admin specifics

- Same tokens as CSS variables in `admin/src/styles/tokens.css`.
- Dense but calm: table rows 44 px tall, 14 px text, sticky table header on `surface-muted`, zebra striping off, row hover `#FAFAF7`.
- Numbers are right-aligned with tabular figures. Low stock shows an amber dot + number; zero stock shows a red "0" in bold.
- The one primary action per page sits top-right. Destructive actions always ask for confirmation.
- Keyboard: `/` focuses search; in Quick Stock, Enter and ↓ move to the next row, ↑ to the previous one, and Ctrl+S saves.
- Minimum supported width is 900 px (tablet landscape); the sidebar collapses below 1200 px.
