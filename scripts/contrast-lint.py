#!/usr/bin/env python3
"""Check that every card's accent-coloured text clears WCAG AA.

Why this exists
---------------
Each card's small text in its own colour (the domain line, the tags, the Soon
and New badges, the shipped stamp) used to be painted in the raw
`--card-accent`. That accent is chosen for the icon and the glow, where it only
has to read as a hue, and on a near-black card 15 of 85 accents fell under
4.5:1 as 10 to 12px text. Nothing reported it, because a colour that is fine as
an icon fill looks fine in review until someone measures it as text.

So text no longer uses the accent. It uses `--card-ink`, derived from it in
css/style.css:

    oklch(from var(--card-accent) max(l, INK_MIN_L) c h)       relative colour
    color-mix(in oklch, var(--card-accent) INK_MIX%, #fff)      fallback

The accent keeps its hue and chroma and is only lifted to a floor lightness,
so light accents stay exactly as authored and dark ones lift just far enough.
The L background mode puts the cards on paper, where the same idea runs the
other way: a lightness ceiling (`min(l, PAPER_MAX_L)`, fallback a mix with
black), checked here against the paper surface.

This script reproduces both formulas (the stylesheet cannot be imported, so
reproduction is what makes this a check instead of a second owner), reads
every `--card-accent` in index.html, and fails if either result is under 4.5:1
on the card surface or on the most tinted badge fill drawn behind that text.
The two constants below must match css/style.css; the guard at the bottom
fails if they drift apart.

Usage:
    python3 scripts/contrast-lint.py      # exit 1 on any failure
"""

import math
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
STYLE = ROOT / "css" / "style.css"

INK_MIN_L = 0.74   # oklch lightness floor for --card-ink
INK_MIX = 62       # percent of accent in the color-mix fallback
PAPER_MAX_L = 0.45 # oklch lightness ceiling for --card-ink on L's paper cards
PAPER_MIX = 55     # percent of accent in the paper fallback (mixed with black)
AA = 4.5

# The card surface: rgba(0,12,24,.82) over the page void #000912, plus the top
# sheen (white at .045) the domain line sits under. The lighter of the two is
# the harder background, so it is the one checked.
CARD = (11.5, 22.4, 33.7)
# Fills drawn behind accent text, as alpha of the accent over the card.
FILLS = {"card": 0.0, "tag": 0.08, "soon badge": 0.12, "new badge": 0.18}
# The +N tag chip draws the accent over its own near-opaque navy, not the card.
CHIP = (8 * 0.9 + 11.5 * 0.1, 12 * 0.9 + 22.4 * 0.1, 26 * 0.9 + 33.7 * 0.1)
# L's paper card: white at .92 over #ededea. Only the badges and the shipped
# stamp take ink there; tags and the domain line have their own greys.
PAPER = tuple(0.92 * 255 + 0.08 * c for c in (237, 237, 234))
PAPER_FILLS = {"paper": 0.0, "paper soon badge": 0.12, "paper new badge": 0.18}


def hex_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def unlin(c):
    c = max(0.0, min(1.0, c))
    return 255 * (12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055)


def to_oklch(rgb):
    r, g, b = (lin(c) for c in rgb)
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = (math.copysign(abs(v) ** (1 / 3), v) for v in (l, m, s))
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(a, bb), math.degrees(math.atan2(bb, a)) % 360


def oklch_lin(L, C, H):
    a, b = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)


def in_gamut(L, C, H):
    return all(-1e-6 <= v <= 1 + 1e-6 for v in oklch_lin(L, C, H))


def from_oklch(L, C, H, mapping):
    """sRGB for an oklch colour. 'clip' clamps channels; 'chroma' lowers chroma
    until the colour is in gamut (the CSS Color 4 approach). Browsers differ,
    so both are checked."""
    if mapping == "chroma" and not in_gamut(L, C, H):
        lo, hi = 0.0, C
        for _ in range(40):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if in_gamut(L, mid, H) else (lo, mid)
        C = lo
    return tuple(unlin(v) for v in oklch_lin(L, C, H))


def luminance(rgb):
    r, g, b = (lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def over(fg, alpha, bg):
    return tuple(alpha * f + (1 - alpha) * b for f, b in zip(fg, bg))


def inks(accent):
    L, C, H = to_oklch(accent)
    out = {}
    for mapping in ("clip", "chroma"):
        out["relative/" + mapping] = from_oklch(max(L, INK_MIN_L), C, H, mapping)
    p = INK_MIX / 100
    out["mix"] = from_oklch(p * L + (1 - p) * 1.0, p * C, H, "clip")
    return out


def paper_inks(accent):
    L, C, H = to_oklch(accent)
    out = {}
    for mapping in ("clip", "chroma"):
        out["relative/" + mapping] = from_oklch(min(L, PAPER_MAX_L), C, H, mapping)
    p = PAPER_MIX / 100
    out["mix"] = from_oklch(p * L, p * C, H, "clip")
    return out


def main():
    css = STYLE.read_text()
    floor = str(INK_MIN_L).lstrip("0")
    if f"max(l, {floor})" not in css and f"max(l, {INK_MIN_L})" not in css:
        print(f"contrast-lint: css/style.css no longer derives --card-ink with max(l, {floor}); update INK_MIN_L here")
        return 1
    if f"var(--card-accent, #818cf8) {INK_MIX}%, #fff)" not in css:
        print(f"contrast-lint: css/style.css no longer mixes --card-ink at {INK_MIX}% accent; update INK_MIX here")
        return 1
    ceiling = str(PAPER_MAX_L).lstrip("0")
    if f"min(l, {ceiling})" not in css or f"var(--card-accent, #818cf8) {PAPER_MIX}%, #000)" not in css:
        print(f"contrast-lint: css/style.css no longer derives the paper ink with min(l, {ceiling}) and a {PAPER_MIX}% black mix; update the PAPER_ constants here")
        return 1

    accents = sorted(set(re.findall(r"--card-accent:\s*(#[0-9a-fA-F]{3,6})", INDEX.read_text())))
    accents.append("#818cf8")  # the fallback in every var() above
    if len(accents) < 20:
        print(f"contrast-lint: only {len(accents)} accents found in index.html; the markup changed shape")
        return 1

    failures = []
    worst = (99, None)
    for hx in accents:
        acc = hex_rgb(hx)
        surfaces = [(inks(acc), {**{f: over(acc, a, CARD) for f, a in FILLS.items()},
                                  "tag chip": over(acc, 0.12, CHIP)}),
                    (paper_inks(acc), {f: over(acc, a, PAPER) for f, a in PAPER_FILLS.items()})]
        for ink_set, backgrounds in surfaces:
            for how, ink in ink_set.items():
                for fill, bg in backgrounds.items():
                    ratio = contrast(ink, bg)
                    worst = min(worst, (ratio, f"{hx} {how} on {fill}"))
                    if ratio < AA:
                        failures.append(f"  {hx}  {how:16} on {fill:16} {ratio:.2f}:1")

    if failures:
        print(f"contrast-lint: {len(failures)} accent text pairs under {AA}:1")
        print("\n".join(failures))
        return 1
    print(f"contrast: {len(accents)} accents, every --card-ink pair >= {AA}:1 (lowest {worst[0]:.2f}:1, {worst[1]})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
