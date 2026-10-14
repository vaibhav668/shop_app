"""Renders the app icons, splash and Play Store graphics from SVG with headless Chrome.

    python mobile/store/brand/render_assets.py

Writes into mobile/assets/images/ (app) and mobile/store/ (Play Store). Re-run after editing
the SVG below. Needs Chrome or Edge and Pillow.
"""

import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
MOBILE = HERE.parents[1]
IMAGES = MOBILE / "assets" / "images"
STORE = MOBILE / "store"

BROWSERS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
]

DEFS = """
<defs>
  <linearGradient id="forest" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#166534"/><stop offset="0.55" stop-color="#14532D"/>
    <stop offset="1" stop-color="#052E16"/>
  </linearGradient>
  <linearGradient id="foil" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FDE68A"/><stop offset="0.38" stop-color="#F59E0B"/>
    <stop offset="0.55" stop-color="#B45309"/><stop offset="0.72" stop-color="#FBBF24"/>
    <stop offset="1" stop-color="#FEF3C7"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.78" cy="0.18" r="0.6">
    <stop offset="0" stop-color="#FBBF24" stop-opacity="0.35"/>
    <stop offset="1" stop-color="#FBBF24" stop-opacity="0"/>
  </radialGradient>
  <pattern id="jaali" width="64" height="64" patternUnits="userSpaceOnUse">
    <g fill="none" stroke="#FBBF24" stroke-width="1.6" opacity="0.18">
      <circle cx="0" cy="0" r="32"/><circle cx="64" cy="0" r="32"/><circle cx="0" cy="64" r="32"/>
      <circle cx="64" cy="64" r="32"/><circle cx="32" cy="32" r="32"/><circle cx="32" cy="32" r="7"/>
    </g>
  </pattern>
</defs>
"""


def basket(fill: str, slats: str) -> str:
    """The basket in a 1000x1000 box, centred, about 56% of the width."""
    return f"""
<g>
  <path d="M352 432 C352 300 648 300 648 432" fill="none" stroke="{fill}" stroke-width="46"
        stroke-linecap="round"/>
  <rect x="222" y="430" width="556" height="78" rx="34" fill="{fill}"/>
  <path d="M262 500 H738 L688 726 Q680 760 646 760 H354 Q320 760 312 726 Z" fill="{fill}"/>
  <path d="M410 556 L420 704 M500 556 V704 M590 556 L580 704" stroke="{slats}" stroke-width="22"
        stroke-linecap="round"/>
</g>"""


def svg_doc(w: int, h: int, body: str) -> str:
    return (
        f'<!doctype html><html><body style="margin:0;background:transparent">'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
        f"{DEFS}{body}</svg></body></html>"
    )


def forest_background(w: int, h: int) -> str:
    return (
        f'<rect width="{w}" height="{h}" fill="url(#forest)"/>'
        f'<rect width="{w}" height="{h}" fill="url(#jaali)"/>'
        f'<rect width="{w}" height="{h}" fill="url(#glow)"/>'
    )


def scaled(content: str, scale: float, w: int = 1000, h: int = 1000) -> str:
    """Scales a 1000x1000 drawing about the centre of a w x h canvas."""
    tx = w / 2 - 500 * scale
    ty = h / 2 - 500 * scale
    return f'<g transform="translate({tx} {ty}) scale({scale})">{content}</g>'


ASSETS = {
    # Launcher icon (legacy / Play Store icon source): full-bleed forest, gold basket.
    "icon": (1024, 1024, forest_background(1024, 1024) + scaled(basket("url(#foil)", "#14532D"), 1.02, 1024, 1024)),
    # Adaptive icon foreground: the basket inside the 66% safe zone; background colour is forest.
    "android-icon-foreground": (1024, 1024, scaled(basket("url(#foil)", "#14532D"), 0.74, 1024, 1024)),
    # Themed (monochrome) icon and the status-bar notification icon: white silhouette.
    "android-icon-monochrome": (1024, 1024, scaled(basket("#FFFFFF", "transparent"), 0.74, 1024, 1024)),
    # Splash: the gold basket alone on the forest splash background.
    "splash-icon": (1024, 1024, scaled(basket("url(#foil)", "#14532D"), 1.0, 1024, 1024)),
    # Browser tab icon.
    "favicon": (192, 192, forest_background(192, 192) + scaled(basket("url(#foil)", "#14532D"), 0.2, 192, 192)),
}

FEATURE = (
    1024,
    500,
    forest_background(1024, 500)
    + f'<g transform="translate(70 70) scale(0.36)">{basket("url(#foil)", "#14532D")}</g>'
    + '<text x="440" y="215" font-family="Plus Jakarta Sans, Segoe UI, Arial" font-weight="800" '
    'font-size="76" fill="#FFFFFF" letter-spacing="-2">Bada Bazar</text>'
    + '<text x="442" y="282" font-family="Segoe UI, Arial" font-weight="600" font-size="30" '
    'fill="#FBBF24">The smartest grocery shop of Thalisain</text>'
    + '<text x="442" y="345" font-family="Segoe UI, Arial" font-size="26" fill="#FFFFFF" '
    'opacity="0.8">Fresh groceries at your door · Pay cash or UPI</text>',
)


def render(browser: str, name: str, w: int, h: int, body: str, out: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / f"{name}.html"
        page.write_text(svg_doc(w, h, body), encoding="utf-8")
        shot = Path(tmp) / f"{name}.png"
        subprocess.run(
            [
                browser,
                "--headless=new",
                "--disable-gpu",
                "--hide-scrollbars",
                "--default-background-color=00000000",
                f"--window-size={w},{h}",
                f"--screenshot={shot}",
                page.as_uri(),
            ],
            check=True,
            capture_output=True,
        )
        Image.open(shot).convert("RGBA").crop((0, 0, w, h)).save(out, optimize=True)
    print("wrote", out.relative_to(MOBILE))


def main() -> None:
    browser = next((b for b in BROWSERS if Path(b).exists()), None) or shutil.which("chromium")
    if not browser:
        raise SystemExit("Chrome/Edge not found.")
    for name, (w, h, body) in ASSETS.items():
        render(browser, name, w, h, body, IMAGES / f"{name}.png")
    STORE.mkdir(exist_ok=True)
    # Play Store: 512x512 icon (from the launcher icon) and the 1024x500 feature graphic.
    Image.open(IMAGES / "icon.png").resize((512, 512), Image.Resampling.LANCZOS).save(
        STORE / "play-icon-512.png", optimize=True
    )
    w, h, body = FEATURE
    render(browser, "feature-graphic", w, h, body, STORE / "feature-graphic-1024x500.png")
    # The feature graphic must not be transparent.
    fg = Image.open(STORE / "feature-graphic-1024x500.png").convert("RGB")
    fg.save(STORE / "feature-graphic-1024x500.png", optimize=True)


main()
