#!/usr/bin/env python3
"""Generate docs/icon-sheet.html: every card icon, in its card's own colour.

Replaces the hand-maintained `icon-comparison.html`, which covered 21 of the 49
card icons, pulled Lucide from a CDN, and had drifted out of date because
nothing regenerated it.

The point of a sheet is not documentation, it is *catching things*. Rendered
side by side, this set gave up two defects that reading the files never would:
`safeguard.svg` and `lockdown.svg` were byte-identical, and three redraws had
silhouettes that read as something else (a trash can, a laptop, a third
document icon). Neither is visible one file at a time.

Sizes shown are 28px, which is how the hub actually renders them, and 60px for
judging the drawing.

    python3 scripts/icon-sheet.py        # writes docs/icon-sheet.html
"""

import html
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "icon-sheet.html"
BRAND_FALLBACK = "#E326E4"


def cards():
    """(label, icon path, accent, masked?) for every card icon, in page order.

    Anchored on the icon tag rather than on a "card" pattern. Cards are `<a>`
    when they link out, `<div>` when they are Soon or multi-tool, and a regex
    that tried to bracket each one found 29 of 54. Walking backwards from the
    icon to the nearest preceding `--card-accent` cannot miss a card shape it
    has not been taught about.
    """
    src = (ROOT / "index.html").read_text(encoding="utf-8")
    found = []
    for icon in re.finditer(r'<(img|span)\b[^>]*\bclass="card-site-icon"[^>]*>', src):
        tag = icon.group(0)
        path = re.search(r"""(?:src="|--icon:\s*url\(')([^"')]+\.(?:svg|png))""", tag)
        if not path:
            continue
        # The icons are aria-hidden (they repeat the card's own name, so they are
        # decorative), which means the label has to come from the card. Look
        # forward to the next .card-name rather than at the icon's attributes.
        after = src[icon.end():]
        name = re.search(r'class="card-name"[^>]*>([^<]+)<', after)
        label = name.group(1) if name else None
        before = src[:icon.start()]
        accents = re.findall(r'--card-accent:\s*([^;"]+)', before)
        found.append({
            "label": (label or "").strip() or pathlib.Path(path.group(1)).stem,
            "path": path.group(1).lstrip("/"),
            "accent": accents[-1].strip() if accents else BRAND_FALLBACK,
            # A <span> is masked and takes the card colour; an <img> is a
            # third-party mark drawing itself.
            "masked": icon.group(1) == "span",
        })
    return found


def render(items):
    def tile(it, px):
        p = html.escape(it["path"])
        if it["masked"]:
            return (f'<span class="ic" style="--icon:url(\'../{p}\');width:{px}px;height:{px}px"></span>')
        return f'<img class="ic raw" src="../{p}" alt="" style="width:{px}px;height:{px}px">'

    cells = "\n".join(
        f'''  <figure class="cell" style="--accent:{html.escape(it['accent'])}">
    <div class="wrap big">{tile(it, 60)}</div>
    <div class="wrap small">{tile(it, 28)}</div>
    <figcaption>{html.escape(it['label'])}{'' if it['masked'] else ' <b>·raw</b>'}</figcaption>
    <code>{html.escape(pathlib.Path(it['path']).name)}</code>
  </figure>''' for it in items)

    masked = sum(1 for i in items if i["masked"])
    return f'''<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Icon sheet - Neorgon</title>
<style>
  :root {{ color-scheme: dark; }}
  body {{ background:#00060f; color:#e8eefc; margin:0; padding:32px;
         font:14px/1.5 'Avenir Next',-apple-system,system-ui,sans-serif; }}
  h1 {{ font-size:1.5rem; margin:0 0 6px; }}
  p.lede {{ color:rgba(255,255,255,.55); margin:0 0 28px; max-width:70ch; }}
  code.k {{ background:rgba(255,255,255,.07); padding:2px 6px; border-radius:4px; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:16px; }}
  .cell {{ margin:0; padding:14px; border-radius:14px; border:1px solid rgba(255,255,255,.08);
          background:rgba(0,12,24,.82); display:flex; flex-direction:column; align-items:center; gap:10px; }}
  .wrap {{ display:flex; align-items:center; justify-content:center; border-radius:12px;
          background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 16%,transparent),rgba(255,255,255,.03));
          border:1px solid color-mix(in srgb,var(--accent) 22%,rgba(255,255,255,.06)); }}
  .big {{ width:88px; height:88px; }}
  .small {{ width:42px; height:42px; }}
  /* Same contract as css/style.css: the SVG is a mask, the element is the colour. */
  .ic {{ display:block; background-color:var(--accent);
        -webkit-mask:var(--icon) center/contain no-repeat; mask:var(--icon) center/contain no-repeat;
        filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.55)); }}
  .ic.raw {{ background:none; -webkit-mask:none; mask:none; }}
  figcaption {{ color:rgba(255,255,255,.72); text-align:center; }}
  figcaption b {{ color:var(--accent); font-weight:600; }}
  .cell code {{ color:rgba(255,255,255,.32); font-size:11px; }}
</style></head><body>
<h1>Icon sheet</h1>
<p class="lede">Every card icon on the hub, in the colour its card gives it, at the 60px
drawing size and the 28px size the hub actually renders. {masked} are masked spans that take
<code class="k">--card-accent</code>; {len(items) - masked} marked <b>·raw</b> are third-party
marks drawing themselves. Generated by <code class="k">scripts/icon-sheet.py</code>; run it
after any icon change and scan for two things: a silhouette that reads as the wrong object,
and two icons that read as each other.</p>
<div class="grid">
{cells}
</div>
</body></html>
'''


def main():
    items = cards()
    if not items:
        print("no card icons found in index.html", file=sys.stderr)
        return 2
    OUT.write_text(render(items), encoding="utf-8")
    masked = sum(1 for i in items if i["masked"])
    print(f"wrote {OUT.relative_to(ROOT)} — {len(items)} icons ({masked} masked, {len(items)-masked} raw)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
