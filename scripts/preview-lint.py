#!/usr/bin/env python3
"""Reconcile PREVIEW_MAP in js/previews.js against the catalog and assets/previews/.

Why this exists
---------------
A card preview fails invisibly by design. `show()` sets `img.src`, and the only
handler for a 404 is `img.onerror`, which adds the id to a `failed` set and
removes the src. Nothing is logged, nothing appears on the card, and the hover
simply does nothing for the rest of the session. So a `PREVIEW_MAP` entry whose
GIF was renamed or never recorded is a dead feature with no symptom to notice.

Five drift classes, and two of them are failures:

  DEAD    a map entry naming a file that is not in assets/previews/
          Hard fail. This is the silent one above.

  SHAPE   a GIF whose aspect does not fit a card box
          Hard fail. A card box is 358px wide and 233..285 tall, an aspect of
          1.26..1.53, and `.card-preview img` is `object-fit: cover`. A preview
          outside that band is not broken, which is exactly the problem: cover
          crops the excess and the result still looks like a screenshot, so a
          preview shot at the wrong shape silently shows two thirds of itself.
          Every preview in the fleet was 646x300 (aspect 2.153) until
          2026-09-18 and every one of them was displayed wrong. This is checked
          on aspect rather than on exact pixels on purpose: the exact output
          size belongs to the recorder that produces these files, and copying
          it here would make the format a fact with two owners. What this repo
          knows, and what actually matters to it, is the shape its own boxes
          can show. Fix by re-recording, not by widening the band:
          `cd ../og-studio-site && make gifs-all`.

  ORPHAN  a GIF in assets/previews/ that no map entry names
          Reported. It breaks nothing, it just ships bytes to nobody.

  GAP     a live catalog card with no map entry
          Reported as a count. Recording a preview is manual work, so a hard
          fail here would be permanently red, and a check that is always red is
          read as noise and then ignored. The count is the useful signal.

  STILL   a GIF with exactly one frame
          Reported as a count. The file is valid, the right shape and the right
          size, and it shows a motionless screenshot: the recorder's default
          profile scrolls, and a page that fits one viewport gives it nothing to
          record. The recorder says so at record time, but that line scrolls off
          a 64-card batch log, which is how 15 of 63 previews came to be stills
          with nobody counting them. Fix one by giving the card a
          `../og-studio-site/scenarios/<id>.json` with click or hover steps, not
          by re-recording harder. Counted rather than failed for the same reason
          as GAP: authoring a scenario is judgment work per card.

Ghost cards (`.ghost-card`) and Soon cards (`data-status="soon"`) are not gaps:
one is hidden until unlocked and the other has nothing to record yet. An entry
for a ghost card is still DEAD if its file is missing, because unlocking it is
supposed to work.

Usage:
    python3 scripts/preview-lint.py     # report, exit 1 on any DEAD entry
"""

import pathlib
import re
import struct
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PREVIEW_DIR = ROOT / "assets" / "previews"
PREVIEWS_JS = ROOT / "js" / "previews.js"
INDEX = ROOT / "index.html"

# The map has never held fewer than 40 entries. Anything near zero means the
# literal moved or was reformatted and this script is reconciling an empty dict
# against the catalog, which passes every check while looking at nothing.
MIN_ENTRIES = 30

# The aspect band a card box can actually show, measured over the 73 catalog
# cards at 1440px: 358px wide by 233..285 tall. See the SHAPE note above for
# why this is a band and not the recorder's exact output size.
BOX_ASPECT_MIN = 1.26
BOX_ASPECT_MAX = 1.53


def gif_size(path: pathlib.Path) -> tuple[int, int]:
    """Width and height from the GIF header. Both are little-endian uint16 at
    offset 6, in every GIF87a and GIF89a, so this needs no image library."""
    with path.open("rb") as handle:
        header = handle.read(10)
    if len(header) < 10 or not header.startswith(b"GIF"):
        return (0, 0)
    return struct.unpack("<HH", header[6:10])


def gif_frames(path: pathlib.Path) -> int:
    """Number of image descriptors in a GIF, by walking its block structure.

    Needs no image library, and no shortcut works here: a one-frame GIF and a
    forty-frame one are byte-identical for the first few hundred bytes, and the
    frame count is not in the header. Returns 0 on anything unparseable, which
    the caller treats as "not a still" rather than as a still, because a file
    this cannot read is a different problem and SHAPE already reports it.
    """
    data = path.read_bytes()
    if len(data) < 13 or not data.startswith(b"GIF"):
        return 0
    pos = 13
    if data[10] & 0x80:  # global colour table present
        pos += 3 * (2 ** ((data[10] & 7) + 1))
    count = 0
    while pos < len(data):
        block = data[pos]
        if block == 0x3B:  # trailer
            break
        if block == 0x21:  # extension: skip its sub-block chain
            pos += 2
            while pos < len(data) and data[pos]:
                pos += data[pos] + 1
            pos += 1
        elif block == 0x2C:  # image descriptor
            count += 1
            flags = data[pos + 9]
            pos += 10
            if flags & 0x80:  # local colour table
                pos += 3 * (2 ** ((flags & 7) + 1))
            pos += 1  # LZW minimum code size
            while pos < len(data) and data[pos]:
                pos += data[pos] + 1
            pos += 1
        else:
            return 0  # not a structure this understands
    return count


def preview_map() -> dict[str, str]:
    """Parse the PREVIEW_MAP object literal. Keys are bare or single-quoted."""
    source = PREVIEWS_JS.read_text(encoding="utf-8")
    try:
        body = source.split("PREVIEW_MAP = {", 1)[1].split("};", 1)[0]
    except IndexError:
        sys.exit("ERROR: could not find the PREVIEW_MAP literal in js/previews.js")
    return dict(re.findall(r"'?([A-Za-z0-9_-]+)'?\s*:\s*'([^']+)'", body))


def cards() -> list[tuple[str, str]]:
    """Every element carrying data-card-id, as (id, raw attribute string).

    Echoes are excluded for free: recent.js and favorites.js retag their clones
    to `data-echo-id`, which is the whole point of that attribute.
    """
    html = INDEX.read_text(encoding="utf-8")
    out = []
    for _, attrs in re.findall(r"<(a|div)\b([^>]*\bdata-card-id=\"[^\"]+\"[^>]*)>", html):
        out.append((re.search(r"data-card-id=\"([^\"]+)\"", attrs).group(1), attrs))
    return out


def main() -> int:
    mapping = preview_map()
    if len(mapping) < MIN_ENTRIES:
        print(
            f"ERROR: only {len(mapping)} PREVIEW_MAP entries parsed (expected at least "
            f"{MIN_ENTRIES}). This check is not reading the map, so its 'pass' means nothing.",
            file=sys.stderr,
        )
        return 2

    on_disk = {p.name for p in PREVIEW_DIR.iterdir() if p.suffix == ".gif"}
    named = set(mapping.values())

    entries = cards()
    if not entries:
        print("ERROR: no data-card-id cards found in index.html.", file=sys.stderr)
        return 2
    skip = {cid for cid, attrs in entries
            if "ghost-card" in attrs or 'data-status="soon"' in attrs}
    coverable = {cid for cid, _ in entries} - skip

    dead = sorted((cid, f) for cid, f in mapping.items() if f not in on_disk)
    orphans = sorted(on_disk - named)
    gaps = sorted(coverable - set(mapping))

    # Shape is checked on every GIF present, orphans included: an unreferenced
    # file is a candidate for a future map entry, and one shipped at the wrong
    # aspect would come back through that door.
    misshaped = []
    for filename in sorted(on_disk):
        width, height = gif_size(PREVIEW_DIR / filename)
        if not width or not height:
            misshaped.append((filename, width, height, None))
            continue
        aspect = width / height
        if not BOX_ASPECT_MIN <= aspect <= BOX_ASPECT_MAX:
            misshaped.append((filename, width, height, aspect))

    for cid, filename in dead:
        print(f"DEAD    {cid}: assets/previews/{filename} does not exist")
    for filename, width, height, aspect in misshaped:
        shape = f"{width}x{height}" if width else "unreadable GIF header"
        ratio = f" (aspect {aspect:.3f}, outside {BOX_ASPECT_MIN}..{BOX_ASPECT_MAX})" if aspect else ""
        print(f"SHAPE   {filename} is {shape}{ratio}")
    for filename in orphans:
        kb = (PREVIEW_DIR / filename).stat().st_size // 1024
        print(f"ORPHAN  {filename} ({kb} KB) is named by no map entry")
    if gaps:
        print(f"GAP     {len(gaps)} of {len(coverable)} cards have no preview: "
              f"{', '.join(gaps)}")

    # Only the mapped files: an orphan nobody shows cannot bore a visitor.
    stills = sorted(cid for cid, filename in mapping.items()
                    if filename in on_disk
                    and gif_frames(PREVIEW_DIR / filename) == 1)
    if stills:
        print(f"STILL   {len(stills)} previews are a single motionless frame: "
              f"{', '.join(stills)}")

    covered = len(coverable) - len(gaps)
    print(f"\npreviews: {covered}/{len(coverable)} cards covered, "
          f"{len(dead)} dead, {len(misshaped)} misshaped, {len(orphans)} orphan, "
          f"{len(stills)} still")
    if misshaped:
        print("re-record with: cd ../og-studio-site && make gifs-all")
    return 1 if dead or misshaped else 0


if __name__ == "__main__":
    raise SystemExit(main())
