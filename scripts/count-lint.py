#!/usr/bin/env python3
"""Reconcile the hardcoded tool counts in index.html against the catalog.

Why this exists
---------------
The hero sentence computes its own number. The inline script at the foot of
index.html counts

    #tools .site-card:not(.external-card):not(.ghost-card)
           :not([data-status="soon"]):not([data-status="archived"])

and writes it into `#toolCount`, so the visible claim cannot lag the catalog.
Four other copies of that number can, and do: the meta `description`, the
OpenGraph and Twitter descriptions, and the JSON-LD `description`. Those are
read by crawlers before any script runs, so they cannot be computed at load
time, which is exactly why they are the copies that go stale.

This is the repo's recurring defect shape: one fact with several owners, each
copy correct on its own, only the disagreement wrong. It has already happened
once. Commit 0db8374, "fix(hub): tool count is 63, Carnet and Rewind shipped",
exists because two cards shipped and the static copies kept saying 61 while the
hero said 63. Nothing reported it; the page looked right in a browser, because
the one number a person sees is the one the script overwrites. A search engine
and a link preview were quoting a number the page itself disagreed with.

The `#toolCount` span's own literal is checked too, as a fifth copy. It is only
a pre-script fallback, so a visitor never reads it, but a maintainer editing the
hero does, and it is the copy most likely to be trusted next.

The selector above is reproduced here rather than shared, because there is no
way to share it: one side is a CSS selector the browser applies, the other is a
regex over the file. Reproduction is what makes this a check instead of a
second owner. It is only sound while both sides agree, so the plausibility
guard below fails loudly rather than reporting a comfortable zero.

Usage:
    python3 scripts/count-lint.py     # exit 1 on any disagreement
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"

# The catalog has never held fewer than 40 live tools. A count near zero means
# the card markup changed shape and this script is comparing the static copies
# against nothing, which passes by agreeing with itself.
MIN_LIVE = 40


def live_count(html: str) -> tuple[int, list[str]]:
    """Cards the hero sentence counts: the four exclusions, and nothing else.

    Echoes are excluded for free. recent.js and favorites.js retag their clones
    to `data-echo-id`, which is what that attribute is for.
    """
    kept = []
    for _, attrs in re.findall(r"<(a|div)\b([^>]*\bdata-card-id=\"[^\"]+\"[^>]*)>", html):
        if "external-card" in attrs or "ghost-card" in attrs:
            continue
        if 'data-status="soon"' in attrs or 'data-status="archived"' in attrs:
            continue
        kept.append(re.search(r"data-card-id=\"([^\"]+)\"", attrs).group(1))
    return len(kept), kept


def main() -> int:
    html = INDEX.read_text(encoding="utf-8")
    live, ids = live_count(html)

    if live < MIN_LIVE:
        print(
            f"ERROR: only {live} live cards matched (expected at least {MIN_LIVE}). "
            "This check is not reading the catalog, so its 'pass' means nothing.",
            file=sys.stderr,
        )
        return 2

    # Every static copy, with the line it sits on, so a failure names the edit.
    stated = [(html[:m.start()].count("\n") + 1, int(m.group(1)))
              for m in re.finditer(r"(\d+) tools", html)]
    stated += [(html[:m.start()].count("\n") + 1, int(m.group(1)))
               for m in re.finditer(r'id="toolCount">(\d+)<', html)]

    if not stated:
        print(
            "ERROR: found no hardcoded tool count in index.html. The meta and JSON-LD "
            "descriptions are supposed to carry one; this check has nothing to compare.",
            file=sys.stderr,
        )
        return 2

    wrong = [(line, n) for line, n in stated if n != live]
    for line, n in sorted(wrong):
        print(f"COUNT   index.html:{line} says {n} tools, the catalog holds {live}")

    print(f"\ncounts: {live} live tools, {len(stated)} static copies, {len(wrong)} stale")
    if wrong:
        print(f"fix by setting every copy to {live}; the hero span is a fallback, "
              "the other four are what crawlers read")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
