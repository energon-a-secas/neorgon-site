#!/usr/bin/env python3
"""Check (and fix) the card icons in assets/icons against one drawing standard.

Why this exists
---------------
The icons are rendered through `<img class="card-site-icon">` at a fixed 28x28.
That makes the *authored* stroke-width meaningless on its own: what the eye sees
is `stroke-width / viewBox-size * 28`. The set had been drawn on 15-, 20-, 24-,
36-, 48- and 64-unit canvases with stroke widths picked per icon, so effective
weight ran from 0.88px (64-unit canvas at stroke-width 2) to 2.33px (the
24-unit majority at stroke-width 2) — a 2.7x spread that read as "some of these
icons are faint" with no obvious cause.

The standard
------------
  stroke-width == viewBox-size / STROKE_DIVISOR      (one effective weight)
  stroke       == BRAND                              (never currentColor)
  linecap/linejoin == round                          (one corner language)
  no width/height attributes                         (CSS owns the box)

`currentColor` deserves its own note: it is the correct choice for an inlined
SVG and completely wrong here. An `<img>` loads the file as a separate document
with no access to the host page's colour, so `stroke="currentColor"` resolved to
black and those icons were rendering nearly invisible on a dark card.

Usage:
    python3 scripts/icon-lint.py            # report, exit 1 if anything is off
    python3 scripts/icon-lint.py --fix      # rewrite the offenders in place
"""

import argparse
import pathlib
import re
import sys

BRAND = "#E326E4"
STROKE_DIVISOR = 11          # 24/11 = 2.2 -> 2.55px at the 28px render size
ICON_DIR = pathlib.Path(__file__).resolve().parent.parent / "assets" / "icons"

# Third-party marks: someone else's trademark, drawn to someone else's rules.
# Recolouring or re-weighting these would make them wrong, not consistent.
EXEMPT = {"github.svg", "gitlab.svg", "docker.svg", "youtube.svg"}


def used_icons(root: pathlib.Path) -> set[str]:
    """Icons rendered as `.card-site-icon`, and only those.

    Scoped to the class rather than to any `assets/icons/` reference in the
    page: the icon dir also holds dead `-old`/`-bkp` files, and the secret
    trigger draws `warning.svg` white and `earth.svg` at 1024 units with
    explicit dimensions. Those are not card icons and this standard would
    actively break them — recolouring a white warning glyph magenta is not
    consistency.
    """
    html = (root / "index.html").read_text(encoding="utf-8")
    names: dict[str, str] = {}
    # Card icons are masked `<span style="--icon: url('/assets/icons/x.svg')">`;
    # the third-party brand marks are still `<img src="assets/icons/x.svg">`.
    # Matching only one of the two is how this check silently linted nothing and
    # still exited 0 the day the markup changed.
    for tag in re.finditer(r"<(img|span)\b[^>]*>", html):
        whole = tag.group(0)
        if "card-site-icon" not in whole:
            continue
        m = re.search(r"""(?:src="|--icon:\s*url\(')/?(?:assets/icons/)([A-Za-z0-9._-]+\.svg)""", whole)
        if m:
            names[m.group(1)] = tag.group(1)
    return names


def check_render_mode(used: dict[str, str]) -> list[str]:
    """A masked element takes `--card-accent`; an `<img>` draws its own colours.

    Which one an icon uses is not a styling detail, it is the difference between
    "our icon, in this card's colour" and "somebody else's trademark, recoloured
    to match our card". EXEMPT names must stay `<img>` and everything else must
    stay a masked `<span>`; both directions are silent when wrong, because the
    page still renders either way.
    """
    problems = []
    for name, tag in sorted(used.items()):
        if name in EXEMPT and tag != "img":
            problems.append(f"{name}: third-party mark rendered as <{tag}> — masking recolours "
                            f"a trademark to the card accent; it must stay an <img>")
        elif name not in EXEMPT and tag != "span":
            problems.append(f"{name}: rendered as <{tag}> — our icons are masked <span>s so they "
                            f"take var(--card-accent); an <img> is stuck on the colour in the file")
    return problems


def target_width(viewbox: str) -> float | None:
    parts = viewbox.replace(",", " ").split()
    if len(parts) != 4:
        return None
    try:
        size = max(float(parts[2]), float(parts[3]))
    except ValueError:
        return None
    return round(size / STROKE_DIVISOR, 1)


def fmt(n: float) -> str:
    return str(int(n)) if n == int(n) else str(n)


def check(path: pathlib.Path, fix: bool) -> list[str]:
    src = path.read_text(encoding="utf-8")
    out = src
    problems: list[str] = []

    m = re.search(r'viewBox="([^"]+)"', out)
    if not m:
        return ["no viewBox"]
    want = target_width(m.group(1))
    if want is None:
        return [f"unparseable viewBox {m.group(1)!r}"]

    # A stroke icon is one that draws with lines; solid-fill glyphs have no
    # stroke to normalise and are judged by eye, not by this script.
    is_stroke = 'fill="none"' in out or "stroke=" in out

    if is_stroke:
        for got in set(re.findall(r'stroke-width="([^"]+)"', out)):
            try:
                if abs(float(got) - want) < 0.05:
                    continue
            except ValueError:
                pass
            problems.append(f"stroke-width {got} != {fmt(want)}")
            out = out.replace(f'stroke-width="{got}"', f'stroke-width="{fmt(want)}"')

        if 'stroke-width="' not in out:
            problems.append(f"no stroke-width (want {fmt(want)})")
            out = re.sub(r"<svg\b", f'<svg stroke-width="{fmt(want)}"', out, count=1)

        for bad in set(re.findall(r'stroke="([^"]+)"', out)):
            if bad.lower() in (BRAND.lower(), "none"):
                continue
            problems.append(f"stroke {bad} != {BRAND}")
            out = out.replace(f'stroke="{bad}"', f'stroke="{BRAND}"')

        for attr in ("stroke-linecap", "stroke-linejoin"):
            if f'{attr}="round"' not in out:
                problems.append(f"missing {attr}=round")
                out = re.sub(r"<svg\b", f'<svg {attr}="round"', out, count=1)

        # The stroke has to be declared on the ROOT <svg>, not only on children.
        # Nothing here cared until the favicon kit started recolouring these
        # glyphs: it reads the root tag to decide whether an icon draws with
        # lines or with solid shapes, so a glyph that puts stroke= only on its
        # paths is classified as filled, takes the wrong padding, and keeps its
        # authored magenta instead of the site's accent. Five files in this
        # folder are drawn that way and would ship pink the day a card used one.
        root = re.match(r"^.*?<svg[^>]*>", out, flags=re.S)
        if root and not re.search(r'stroke="(?!none)', root.group(0)):
            problems.append(f"stroke declared on children only, not on the root svg "
                            f"(the favicon kit reads the root to tell stroke from fill)")
            out = re.sub(r"<svg\b", f'<svg stroke="{BRAND}"', out, count=1)

    # `width="800px"` on the root fights the 28px CSS box and, worse, is what a
    # download from an icon site leaves behind — a reliable tell for "pasted in".
    for attr in ("width", "height"):
        m2 = re.search(rf'<svg[^>]*?\s{attr}="([^"]+)"', out)
        if m2:
            problems.append(f'root {attr}="{m2.group(1)}" (CSS owns the box)')
            out = re.sub(rf'(<svg[^>]*?)\s{attr}="[^"]+"', r"\1", out, count=1)

    if fix and out != src:
        path.write_text(out, encoding="utf-8")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fix", action="store_true", help="rewrite offenders in place")
    args = ap.parse_args()

    root = ICON_DIR.parent.parent
    used = used_icons(root)
    if not used:
        print("no icon references found in index.html", file=sys.stderr)
        return 2

    offenders = 0
    render_problems = check_render_mode(used)
    for problem in render_problems:
        print(f"RENDER  {problem}")
    offenders += len(render_problems)

    for name in sorted(used):
        if name in EXEMPT:
            continue
        path = ICON_DIR / name
        if not path.exists():
            print(f"MISSING  {name}")
            offenders += 1
            continue
        problems = check(path, args.fix)
        if problems:
            offenders += 1
            print(f"{'FIXED ' if args.fix else 'CHECK '} {name}: {'; '.join(problems)}")

    linted = len(set(used) - EXEMPT)
    # A run that checked nothing is a broken check, not a clean one. The set has
    # never been smaller than 40; anything near zero means the markup moved and
    # this script no longer recognises it.
    if linted < 20:
        print(f"\nERROR: only {linted} icons matched in index.html. This check is not "
              f"looking at the right markup, so its 'pass' means nothing.", file=sys.stderr)
        return 2

    if offenders:
        print(f"\n{offenders} of {linted} linted icons {'fixed' if args.fix else 'off standard'}"
              f" (exempt: {len(EXEMPT)} third-party marks)")
        return 0 if args.fix else 1
    print(f"all {linted} linted icons on standard (exempt: {len(EXEMPT)} third-party marks)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
