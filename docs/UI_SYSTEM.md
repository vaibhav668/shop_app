# UI System — "Fresh Market"

The goal is for the product to look like it was designed by a person for a neighbourhood shop: warm, clear, fast. It should never look like a generic AI-generated SaaS template.

## 1. Hard rules

- **No purple, violet, indigo, navy, dark blue or blue gradients.** This includes links, focus rings, charts, placeholder art and default library styles. Always override library defaults (e.g. the browser's blue focus outline, Android's ripple colour).
- No glassmorphism, blur backdrops, neon, 3D blobs, AI illustrations, or decorative gradients.
- No emoji in the UI chrome. Real product photos do the visual work.
- Only chips, badges and the quantity stepper use pill shapes. Cards are not pills.
- Borders come before shadows. A shadow is used only for elements that float over content (the bottom cart bar, bottom sheets, toasts).
- CI runs a grep check that fails the build if any hex colour outside the token file appears in `mobile/src` or `admin/src`.

## 2. Colour tokens

| Token | Hex | Use |
|---|---|---|
| `green-600` brand | `#16A34A` | Brand mark, active tab icon, completed timeline steps, selected chips, checkboxes, large surfaces |
| `green-700` action | `#15803D` | **Filled primary buttons, green text, links** (white-on-colour contrast 5.1:1, passes AA) |
| `green-800` pressed | `#166534` | Pressed state of primary buttons |
| `green-100` tint | `#DCFCE7` | Selected backgrounds, "Delivered" badge background, success banners |
| `bg` | `#FAFAF7` | App and page background (warm off-white) |
| `surface` | `#FFFFFF` | Cards, sheets, inputs |
| `surface-muted` | `#F5F5F4` | Product image wells, skeletons, table header |
| `text` | `#171717` | Primary text |
| `text-secondary` | `#737373` | Secondary text, units, captions (4.5:1 on `bg`; never used below 13 px) |
| `text-tertiary` | `#A3A3A3` | Disabled text and placeholders only |
| `border` | `#E7E5E4` | Card, input and divider borders |
| `border-strong` | `#D6D3D1` | Input hover, table grid |
| `amber-500` offer | `#F59E0B` | Offer badges and discount tags **as a fill with `#171717` text**, promo accents |
| `amber-100` | `#FEF3C7` | Promo banner background |
| `amber-800` | `#92400E` | Text on the amber tint |
| `red-600` danger | `#DC2626` | Errors, "Out of stock", cancel actions |
| `red-100` | `#FEE2E2` | Error banner background, "Cancelled" badge background |

**Why the adjustment:** white text on `#16A34A` has a contrast ratio of 3.3:1, which fails WCAG AA for button labels. `#16A34A` stays the recognisable brand green. `#15803D` (which is already the brief's secondary green) carries text.

Status badge colours: Awaiting payment / Pending use amber-100 + amber-800; Confirmed / Preparing / Out for delivery use green-100 + green-700; Delivered uses green-600 + white (bold); Cancelled uses red-100 + red-600.

## 3. Typography

Inter (mobile: `@expo-google-fonts/inter`; admin: `@fontsource-variable/inter`). Prices use `fontVariant: ['tabular-nums']`.

| Style | Size / line height | Weight | Use |
|---|---|---|---|
| `display` | 28 / 34 | 700 | Home greeting, order success |
| `title` | 22 / 28 | 700 | Screen titles |
| `heading` | 18 / 24 | 600 | Section headers ("Fresh picks") |
| `body` | 16 / 22 | 400 | Body, inputs |
| `body-strong` | 16 / 22 | 600 | Prices, button labels |
| `label` | 14 / 20 | 500 | Product names in cards, list rows |
| `caption` | 13 / 18 | 400 | Units, metadata |
| `micro` | 12 / 16 | 600 | Badges (e.g. "12% OFF") |

Respect Android font scaling up to 1.3× without the layout breaking. Test at 1.3×.

## 4. Space, radius, elevation

- Spacing scale (4-pt): `4, 8, 12, 16, 20, 24, 32, 40`. The screen side gutter is 16.
- Radius: `sm 8` (badges, image corners inside cards) · `md 10` (inputs, buttons) · `lg 12` (cards) · `xl 16` (bottom sheets, banners) · `full` (chips, stepper only).
- Elevation: `none` (default; a 1 px `border` separates elements) · `float` (`0 4 12 rgba(23,23,23,0.08)`, Android `elevation: 4`), used only for the cart bar, sheets and toasts.
- Touch targets are at least 44×44 dp.

## 5. Key components

**ProductCard** (2-column grid, ~164 dp wide)
- A square image well on `surface-muted` with the photo contained and 8 px padding. A discount tag sits in the top-left corner (amber fill, dark text, `micro`).
- Name (`label`, 2 lines max) → unit (`caption`, secondary) → the price row: price (`body-strong`) + MRP with strikethrough (`caption`, tertiary), and the **ADD** button on the right.
- **ADD** is an outlined `green-700` button, 32 dp tall. After tapping it becomes a filled **stepper** `− 1 +` (green-700, white), with a 180 ms width/opacity transition.
- Out of stock: the image is shown at 50% opacity, a red "Out of stock" label appears, and the ADD button is replaced by nothing (no disabled grey button).

**CartBar**: a full-width bar 16 dp from the screen edges, above the tabs, in `green-700`: "3 items · ₹245" on the left and "View cart ›" on the right. It slides up (220 ms) when the first item is added. It carries the one `float` shadow on the screen.

**QuantityStepper**: the pill shape; the number changes with a short vertical tick (120 ms). Reaching the maximum disables `+` and shows a caption such as "Max 5 per order".

**Order timeline**: vertical steps. Completed steps show a filled `green-600` dot with a line, and the time on the right. The current step has a pulsing ring (once every 2 s; no pulse under reduce-motion). Future steps show a `border-strong` hollow dot and `text-tertiary` label. A cancelled order shows one red step with the reason.

**Buttons**: primary (green-700 fill), secondary (white + border), ghost (text green-700), danger (text red-600, or a filled red only inside confirm dialogs). All are 48 dp tall on mobile and 40 px in admin.

**Inputs**: white, 1 px `border`, radius 10. The focus ring is 2 px `green-600`. Errors show a red border and a red caption below.

**Skeletons**: `surface-muted` blocks shaped like the real content, with a subtle opacity pulse between 0.6 and 1 (no shimmer gradient).

**Empty / error states**: a simple line icon (lucide, 40 px, `text-tertiary`), one sentence, and one action.

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

Built with Reanimated. Durations are 120–250 ms with a standard ease-out. When the system's reduce-motion setting is on, animations become instant.
Animated (and nothing else): the ADD → stepper morph, stepper number tick, cart bar entrance and total change, a small scale bounce (1 → 1.04 → 1) on the cart bar when an item is added, screen transitions (the native stack default), timeline step fill, the order-success checkmark (a single 600 ms draw), and skeleton pulse.

## 8. Iconography & imagery

- One icon set: **Lucide** (`lucide-react-native`, `lucide-react`), 1.75 px stroke, 20/24 px.
- Product photos on white or transparent backgrounds, square, at least 800 px. They are delivered through Cloudinary at 2× display size in WebP/AVIF. A blurhash placeholder is shown while loading.
- Banners: real photography of produce or of the shop, 16:7, with text drawn by the app (not baked into the image) so it stays sharp and editable.

## 9. Admin specifics

- Same tokens as CSS variables in `admin/src/styles/tokens.css`.
- Dense but calm: table rows 44 px tall, 14 px text, sticky table header on `surface-muted`, zebra striping off, row hover `#FAFAF7`.
- Numbers are right-aligned with tabular figures. Low stock shows an amber dot + number; zero stock shows a red "0" in bold.
- The one primary action per page sits top-right. Destructive actions always ask for confirmation.
- Keyboard: `/` focuses search; in Quick Stock, Enter and ↓ move to the next row, ↑ to the previous one, and Ctrl+S saves.
- Minimum supported width is 900 px (tablet landscape); the sidebar collapses below 1200 px.
