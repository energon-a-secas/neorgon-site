# Brief — neorgon-site hub: no recency surface, 12 flat categories with no navigation, dead links and stale counts

Started 2026-08-08 10:24. Maintained by the `task` skill; read by `debrief` and `writeup`.

## Problem

neorgon-site hub: no recency surface, 12 flat categories with no navigation, dead links and stale counts

<!-- What was wrong *before*. The symptom someone actually experienced, not the
     absence of the solution. debrief opens its deck on this, so vagueness here
     costs a slide later. -->

## Approach

Five changes to the hub, in dependency order. (1) Give every card a `data-added="YYYY-MM-DD"`
attribute — this is the missing data model; the hub currently has no concept of recency at all.
(2) Build a "Recently Shipped" rail above the categories that reads those dates, renders the
newest 6 as clones, and stamps a self-expiring NEW badge (~30 days) so the badge decays without
anyone maintaining a list. (3) Add a sticky category rail under the header with live counts and
IntersectionObserver scroll-spy, because 12 categories and 50 cards currently have no navigation
at all beyond scrolling. (4) Add a Cmd+K command palette plus Enter-to-open and arrow-key walking
in the existing hero search, and align the floating pills with the real DOM group labels.
(5) Fix the genuine defects found while reading: two stacked footers, a tool count that
contradicts itself in four places, and dead card links.

Executed inline, not delegated: every workstream edits `index.html` and `css/style.css`, so
concurrent subagents would collide on shared files. Streams are tracked for reporting only.

## Rejected

**Deriving launch dates from `docs/site-registry.json` instead of card attributes.** The registry
is the monorepo's source of truth and already lists every site, so this looked right. It lost on
three counts: the registry has no launch-date field to read (it would need adding first), the hub
would gain a runtime `fetch` plus a CSP `connect-src` entry for what is static data, and the rail
would silently empty out whenever that fetch failed. `data-added` on the card keeps the hub a
zero-dependency static page and puts the date next to the thing it describes.

**A hand-curated array of recent card IDs in JS.** Simplest possible option, and rejected because
nothing expires: the NEW badge would sit on a four-month-old tool until someone remembered to
rotate the list. Dates expire on their own.

**Reusing the floating category pills as the navigation.** They already exist and already filter.
But they live inside the hero, scroll away immediately, and their physics simulation makes them
imprecise click targets — wrong tool for "jump to a section 3000px down". The sticky rail is a
separate, boring, reliable surface.

## Decisions

<!-- Appended by: brief.sh note "<what you learned>" -->

- `2026-08-08 10:26` pieza.neorgon.com has NO DNS record at all (dig CNAME empty, curl cannot resolve) yet the hub ships a live card linking to it. pieza-site also has the wrong git remote (points at claude-site-template-configs). Hub card is a dead link today.

- `2026-08-08 10:26` cardforge.neorgon.com serves 200 over HTTP but 000 over HTTPS - GitHub Pages TLS cert not provisioned. Hub card uses https:// so it is effectively dead too. Infra fix, not a hub fix.

- `2026-08-08 10:26` Two footers render stacked: .site-footer (index.html:1357) and legacy .neorgon-footer (index.html:1487). Per root CLAUDE.md both are superseded by the Footer Kit.

- `2026-08-08 10:26` Tool count contradicts itself in 4 places: hero HTML hardcodes 40, inline JS computes 43 at DOMContentLoaded (so it visibly flips), and title/meta description/OG/twitter/JSON-LD all hardcode 'We made 40 tools'.

- `2026-08-08 10:27` stream **data model** done — 50 cards stamped. Two dates are proxies, marked inline: memes-site git history starts 2024-08-24 (repo bootstrap) and pieza-site's remote points at an unrelated repo so its git history is not this project's.

- `2026-08-08 10:36` stream **recent rail** done — 6-card rail + self-expiring NEW badge; clones use data-echo-id so search/previews/sortable skip them

- `2026-08-08 10:36` stream **category nav** done — 11 sticky chips with live counts, IO scroll-spy, suppressed while searching, #group- deep links

- `2026-08-08 10:36` stream **search + palette** done — Cmd+K palette (fuzzy ladder, recency tie-break); Enter-to-open + arrow walking in hero search; all 11 pills now 1:1 with DOM groups

- `2026-08-08 10:36` Pill/group drift was worse than a label mismatch: the 'Learning' pill matched no DOM group at all and 'Game' pointed only at the locked ghost rushq, so clicking it filtered the catalog to zero results. Also found teamplay, stash, safeguard and pieza present in the DOM but absent from every pill ids array - unreachable by pill. Verified post-fix with a script comparing pill ids to group membership: 11/11 aligned, only the 3 ghost cards intentionally pill-less.

- `2026-08-08 10:57` Scroll-spy root cause: 'topmost group still intersecting the band wins' is wrong after a jump - the previous group's tail still occupies the top of the band, so 'open health' scrolled correctly but lit Lifehacks. Replaced with geometry: the last group whose top has passed a reading line (rail + header + 24px). Verified correct at 8 scroll positions and on all 11 chips.

- `2026-08-08 10:57` Deep-link offset needed scroll-margin-top, not arithmetic. A JS correction re-fired at 0/120/400/900ms and on 'load' still lost: Chrome re-applies the fragment scroll every time layout shifts during load, so the native jump overwrote every correction and #group-health sat at top:0 under 130px of sticky chrome. scroll-margin-top is the only offset the browser's own jump honours; set from JS because the value depends on the live rail height (62px, wraps on narrow screens). terminal.js 'open <cat>' now delegates to it instead of duplicating the arithmetic.

- `2026-08-08 10:57` CSP defects found while testing, fixed: img-src was missing googletagmanager (GA pixel blocked), and script-src + connect-src were missing esm.sh and the Convex host, so the terminal's lazy-loaded Convex client could never have connected - the admin login path was dead in production. connect-src still has no 'self', which is why in-page fetch of own assets fails; left alone deliberately, the page has no same-origin fetch.

- `2026-08-08 10:57` window.NeoHeader exposes getTheme() as a *function*, not a .theme property. Used the property first in 'stats' and 'theme list'; both would have silently printed 'default' forever regardless of the active theme.

- `2026-08-08 10:57` Roughly 8 turns were lost to Chrome's disk cache replaying the committed pre-edit terminal.js through F5, ?cachebust=, #hash, touch and a full server restart, with no service worker registered. Diagnosed via performance.getEntriesByType('resource'): transferSize 0, decodedBodySize 15875, exactly matching 'git show HEAD:js/terminal.js | wc -c'. Serving on a fresh port is the reliable workaround.

- `2026-08-08 10:57` stream **terminal** done — DOM-driven catalog replaces the hardcoded list, so a new card is reachable by every command with no terminal edit. 12 commands added (tools/categories/goto/open/search/new/random/whois/stats/theme/fortune + Tab completion). theme only sets the visitor cookie via NeoHeader.setTheme; fleet-wide CDN default deliberately not exposed - that belongs in an ops console, not a page anyone can open.

- `2026-08-08 10:57` stream **fixes** done — Removed the duplicate legacy footer; single-sourced the tool count (43) from the DOM in hero + all meta/OG/JSON-LD; fixed 3 CSP directives incl. the two that made the terminal's Convex login impossible in prod; fixed the scroll-spy and deep-link offset. Console errors 8 -> 3, both remaining benign (meta frame-ancestors warning, awesomesites:8831 not running locally). Dead links pieza/cardforge diagnosed but NOT fixed - DNS and TLS, outside this repo.

- `2026-08-08 11:11` Mobile defects found only by resizing to 390px, all fixed: (1) the recent rail stacked 6 cards vertically = 1670px / 1.98 screens, pushing the catalog to y=2228 - now a snap-scrolling row at 0.48 screens with the catalog at y=964; (2) snap alignment needs scroll-padding-inline, not padding-inline, or the first card snaps 18px out of line with its own heading; (3) the rail's sticky top was a hardcoded 62px against a 68px header, so 12px slid underneath - now --cat-rail-top from the live measurement.

- `2026-08-08 11:11` Two offsets computed independently disagreed by 8px on mobile, and that was enough to break the highlight: the reading line (150px) sat *below* where a jump parks a heading (142px), so the group you just jumped to counted as not-yet-reached and the chip lit the section above it. Fixed by deriving both from a single anchorOffset().

- `2026-08-08 11:11` Last-group chip could never light: Platforms is one row above the footer, so the page bottoms out before its heading reaches the reading line. resolveActive() now pins the last group when scrolling has bottomed out. Found by asserting spy correctness at scrollY 99999, not by reading the code.

- `2026-08-08 11:11` NEW badges totalled 19 against 13 fresh tools - the extra 6 were clones inheriting the badge, since recent.js stamps before cloning. Dropped on the echo: inside a shelf headed 'Recently shipped' with a 'Shipped 2d ago' stamp, a 'New' badge labels the obvious. Now 13, all in the catalog.

- `2026-08-08 11:11` Repeated SIGKILL of the Playwright MCP Chrome left its profile unopenable (locked UKM db, login-database errors, immediate close). Deleting the whole mcp-chrome-<id> directory is the fix; killing processes alone is not.

## Measured

All figures below were read out of a live page via `browser_evaluate` against
`python3 -m http.server`, not estimated.

| Quantity | Before | After | How |
|---|---|---|---|
| Categories reachable by pill | 11 of 13 pills mapped to a real group; `Learning` matched none, `Game` filtered to 0 results | 11/11 aligned, only the 3 ghost cards intentionally pill-less | script comparing each pill's `ids` to group membership |
| Cards reachable by pill | 4 missing entirely (teamplay, stash, safeguard, pieza) | 0 missing | same script |
| Chip → correct section + correct chip lit | no navigation existed | 11/11 at 1440px, 11/11 at 390px | clicking every chip, asserting `getBoundingClientRect().top` and `.active` |
| Scroll-spy accuracy | n/a | 6/6 sample positions incl. page bottom | scrollY 1200→99999, comparing lit chip to geometry |
| Deep link `#group-health` heading position | `top: 0`, under 130px of sticky chrome | `top: 146`, Health chip lit | fresh navigation, measured after 1.8s settle |
| Recent rail height on a 390×844 phone | 1670px (1.98 screens), catalog started at y=2228 | 406px (0.48 screens), catalog at y=964 | `getBoundingClientRect().height / innerHeight` |
| Rail sliding under the header | 12px (sticky `top: 62px` vs 68px header) | 0px overlap, rail top == header bottom == 68 | comparing both rects while scrolled |
| `New` badges on the page | 19 (6 were clones inheriting one) | 13, matching the 13 tools inside 30 days | counting `.card-new-badge` grouped by container |
| Hero tool count vs DOM | HTML said 40, JS computed 43 → visibly flipped; 5 meta/OG/JSON-LD fields said 40 | 43 everywhere, single-sourced from the DOM | `#toolCount` vs a DOM query |
| Footers rendered | 2 (stacked) | 1 | `querySelectorAll('footer, .site-footer, .neorgon-footer')` |
| Console errors on load | 8 | 3 | `browser_console_messages` |

The 3 remaining console messages are all benign: the `frame-ancestors`-via-meta
warning (Chrome ignores that directive in a `<meta>` tag by design), and two from
`awesome-sites-hub.js` trying `localhost:8831` because that sibling site is not
running locally — production uses `awesomesites.neorgon.com`, which `connect-src`
allows.

## Open

**Two hub cards are dead links right now, and both are infra, not this repo.**
`pieza.neorgon.com` has no DNS record at all (`dig CNAME` empty) — the card
shipped before the subdomain existed. `cardforge.neorgon.com` answers 200 over
HTTP but 000 over HTTPS because GitHub Pages has not provisioned its
certificate; re-asserting the CNAME left `cert: null`, and the API returns 422 or
404 for attempts to force it, so it has to be waited out. `pieza-site` also has
the wrong git remote (it points at `claude-site-template-configs`), which needs
fixing before that site can be published at all.

**Registry disagrees with reality on five sites.** `battlecard` and `hwinfo` are
live with no hub card; `tickbox`, `failsafe` and `fitprofile` return 000 but are
marked `has_hub_card: true`. Not touched — reconciling the registry is an ops
task, and guessing which side is wrong per site would be worse than leaving it
visible.

**Two `data-added` dates are proxies, marked inline in the HTML.** `memes-site`'s
git history begins at a repo bootstrap commit, and `pieza-site`'s remote points
at an unrelated repo so its history is not this project's. Both are close enough
to order the rail correctly today, but they are not ship dates.

**Deferred deliberately, with the reasoning:** the Footer Kit migration (the hub
still uses `.site-footer` rather than `.neo-footer`; worth doing, but it is a
fleet-wide change with its own runbook, not a hub edit); and CDN/header control
from the terminal, which the user explicitly reassigned to an ops console — the
terminal only sets the visitor's own `neo_theme` cookie.

_Closed 2026-08-08 11:12._
