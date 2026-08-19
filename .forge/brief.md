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

- `2026-08-11 17:54` Approach: three independent edits to the catalog. (1) Delete the API-fed Awesome Sites group + js/awesome-sites-hub.js + its CSP connect-src grant — the hub's contract becomes 'every card is a destination we own'. The Awesome Sites *card* stays: awesomesites.neorgon.com is ours, and Platforms stays for the same reason. (2) Add a data-status="soon" card state for the registry's three 'ready' sites (pieza, rigcheck, tickbox — all three 404 today), rendered as a non-link so a Soon card cannot send anyone to a dead domain. (3) Cap the entrance stagger and stop the rail inheriting it.

- `2026-08-11 17:54` Root cause of the slow rail: js/entrance.js sets an INLINE animation-delay of index*110ms on every catalog card (~5.4s at the 49th). js/recent.js then cloneNode()s those cards for the Recently-shipped rail, and cloneNode copies the inline style — so the echo's inherited animation-delay overrides the CSS 'animation-delay: var(--echo-delay)' at style.css:2236. The shelf whose whole job is 'look what just shipped' was the last thing on the page to appear.

- `2026-08-11 17:54` Rejected: an IntersectionObserver scroll-reveal for the catalog. It reads better on a long page, but the CSS default is 'opacity:0 + animation forwards', which is what keeps the catalog visible when JS fails; driving reveal from an observer means a card is a blank slot if the observer never fires. Capping the stagger fixes the reported symptom with no new failure mode.

- `2026-08-11 17:54` Rejected: hiding unpublished sites from the hub entirely. It solves the dead link but loses the thing asked for — a slot to put new work in before it ships. A dimmed Soon card is a roadmap; an absent card is nothing.

- `2026-08-11 17:55` stream **awesome-feed** done — Group markup, js/awesome-sites-hub.js, the script tag and the awesomesites CSP connect-src grant are gone. The Awesome Sites card stays in Productivity. catnav.js's hidden-group filter was dead once the feed left — replaced with an empty-group filter, which is the invariant the original comment was actually protecting.

- `2026-08-11 18:05` stream **soon-state** done — data-status=soon is one attribute that the card markup, hero count, search count, rail, palette and terminal all read. Cards render as <div> so they cannot navigate to a reserved domain. Verified: hero 46→43, palette shows a Soon chip and Enter scrolls instead of navigating (URL unchanged), search reports '5 of 43 tools · 1 coming soon' on a mixed query and no longer says 'no results' when the only match is a Soon card.

- `2026-08-11 18:06` stream **entrance** done — Measured on the running page: 50 cards, worst-case entrance delay 5390ms → 440ms. Rail echoes now carry no inline animation-delay (cleared in recent.js) and compute 0/60/120/180/240/300ms from --echo-delay as the CSS intended. Also fixed a latent reduced-motion bug in the same file: the old branch set opacity:1 but left cardEnter running at delay 0, so reduced-motion users got the animation anyway.

- `2026-08-11 18:12` stream **docs** done — PROJECTS.md gains the hub's ownership rule + the Soon-card contract, a rigcheck-site row and a Rigcheck accent; HUB_REGISTRY.md gains a Soon-cards section with the markup and the flip-to-live steps; neorgon-site/CLAUDE.md documents data-status and warns entrance.js off a global counter. Caught two accent collisions while writing the docs: PROJECTS.md already reserved #22c55e for TickBox (I had used #16a34a) and #7c3aed belongs to CardForge (I had given it to Rigcheck) — both corrected in index.html, Rigcheck is now #0ea5e9.

- `2026-08-11 18:12` Verified on the running page (localhost:8800): hero 46→43; no Soon card has an href, a New badge, or a rail slot; search reads '5 of 43 tools · 1 coming soon' on a mixed query; palette Enter on a Soon row leaves the URL unchanged; worst catalog entrance delay 5390ms→440ms; rail echoes carry no inherited inline delay and compute 0–300ms. `make smoke` 18/18.

- `2026-08-11 19:04` Approach: a Favorites shelf above the catalog, never inside it. The catalog is ours (eleven categories in an order we chose); favorites are theirs. Reordering or filtering the catalog per visitor would make the hub's shape depend on who is looking, so this adds a shelf and leaves the categories byte-for-byte unchanged. Storage is localStorage ('neorgon-favorites', array of card ids in save order), no account, nothing leaves the page.

- `2026-08-11 19:04` The shelf renders clones through window._neoMakeEcho, extracted from recent.js in this session. Two shelves now clone catalog cards and every rule about a safe clone (retag data-card-id to data-echo-id, drop entrance.js's inline delay, convert a multi-tool card to a link) is a rule both must follow. A second copy of those rules would be a second chance to get one wrong. Consequence: favoriting a tool moves no number on the page, because data-echo-id is already what search, the count, sortable, the palette and the terminal all skip.

- `2026-08-11 19:04` Rejected: wrapping each card in a .card-slot so the star could be a real <button> sibling of the <a>. search.js reparents .site-card elements into the merged grid and keys a WeakMap on card.parentElement, and sortable.js drags .sites-grid children — the wrapper would have needed surgery on both, and search is the most-used feature on the page. Chose a <span role=button tabindex=0> inside the card with the click intercepted and stopPropagation()d, which is the interception cards.js already does for multi-tool cards. Named trade-off: a screen reader announces a button inside a link.

- `2026-08-11 19:04` toggle() returns true saved / false removed / null when the id names nothing in the catalog. Started with a two-outcome boolean plus a #tools guard in terminal.js; that guard was unreachable (resolveTool already drops locked ghost cards) and the boolean would have let the terminal print 'Removed X' for a tool it never held. Three outcomes deleted the dead code and made the wrong report impossible.

- `2026-08-11 20:09` Refinement pass: the single 28px star became a .card-tools pill (star + pin + drag handle) with secondary controls collapsing to zero width at rest, and 'saved' moved from an icon to a border state — a warm rim plus the card's existing ::after top hairline held on, with a brighter rim and corner wash for pinned. The old star was a precision target; a strip with a surface behind it means hovering anywhere on the card lands on something usable.

- `2026-08-11 20:09` Drag needed forceFallback: true, which the catalog's own sortable.js does not set. Shelf cards are <a> elements and SortableJS's default path is native HTML5 drag-and-drop, which on an anchor is the browser's own 'drag this link' gesture competing for the same motion. It is also unreachable from synthetic pointer events, so the default path could not be verified at all — with the fallback the whole drag was exercised end to end (Sortable.active true mid-drag, .sortable-fallback on the page, order and localStorage both updated).

- `2026-08-11 20:09` Pinned/unpinned is a band, not a sort key you can fight: onMove refuses a cross-band drag while it is happening, so the card stops at the boundary instead of snapping back after the drop. ArrowLeft/ArrowRight on the drag handle do the same move from the keyboard, because a reorder that only exists for mice is not a reorder.

- `2026-08-14 09:31` stream **run-the-checks** done — make check runs the linter, regenerates the sheet, and fails if the sheet was stale. make hooks routes core.hooksPath at .githooks/ so it runs pre-commit, scoped to commits that touch assets/icons, index.html, css/style.css or scripts/icon-*. Verified: a README-only commit skips the check entirely.

- `2026-08-14 09:31` DESTRUCTIVE MISTAKE, self-inflicted: while proving the pre-commit hook I made a throwaway commit and ran 'git reset --hard HEAD~1' to undo it. That discards uncommitted work, and every tracked modification from this whole effort was unstaged. Lost index.html, css/style.css, js/search.js, 49 icons, docs/ICONS.md, the Makefile, and the blog registration. Untracked files (scripts/, post/, blog/img/, the post HTML, the briefs) survived. Rebuilt everything from the edits in session history; the diagram generator independently re-derived 0.88-2.33px -> 2.57px and .card-site-icon n->Y from the restored files, which confirms the restoration rather than assuming it.

- `2026-08-14 09:31` Never use 'git reset --hard' to undo a probe commit while unrelated work is uncommitted. 'git reset --soft HEAD~1' would have undone the commit and kept everything.

- `2026-08-14 09:37` Found while verifying the brand-mark exception, not part of the plan: searching 'github' put three cards on screen under the words 'No tools match your search.' countable() excludes .external-card so the 4 outbound destinations do not inflate M, but the empty-state check read that same number. Identical in shape to the Soon-card trap the code had already fixed and commented, one occupant later. Now counted separately: 'github' -> '1 external', 'youtube' -> '1 of 43 tools · 1 external'.

- `2026-08-14 09:37` The brand-mark exemption needed no visual work: .external-card already draws a dashed border and an EXTERNAL badge with an outbound glyph, so the differently-coloured icon reads as deliberate before anyone reaches it. Verified rather than assumed.

- `2026-08-15 21:56` Header report reproduced only as a mechanism, not a symptom: in the Chrome pane the bar sits at rectTop 0 at scrollY 900, so it IS sticky here. But css/style.css:35 sets 'body { overflow-x: hidden }', which is the exact hazard the root CLAUDE.md documents against the footer kit ('a dozen sites set overflow-x:hidden on body, which breaks sticky'). hidden makes body a scroll container in engines that do not propagate body overflow to the viewport; the header then sticks to a box that never scrolls. Fixing the mechanism rather than arguing with the report.

- `2026-08-15 21:56` Search 'parla' measured on the running page: '6 of 47 tools', order [Vibe Check, Hiring Pack, Character Sheet, Parla, Playbook, TubeStack]. Cause is two-part and both parts are needed: (1) doFilter adds EVERY id of any category whose keyword blob contains the substring — 'parla' is inside Social's keywords, so all 6 Social cards become matches; (2) the merged grid is filled in catalogCardsOrdered (DOM) order, so there is no ranking at all. Fixing only the ranking would still show 6 results for a 1-tool query.

- `2026-08-15 22:02` stream **search ranking** done — Two defects, both fixed: scoreCard/rank() gives every match a score (name-exact 1000 down to loose 120) and syncCatalogMerge appends in that order; and the keyword blob is demoted to a fallback vocabulary that only expands a group when the query matched no card directly. Category labels still expand unconditionally because that is the pill-click path.

- ~~`2026-08-15 22:18` stream **sticky header** done — css/style.css:35 'body { overflow-x: hidden }' -> 'hidden' then 'clip'. clip cuts the horizontal overflow without making body a scroll container, so .header-bar and .cat-rail stick to the viewport in every engine, not only ones that propagate body overflow upward. Verified: computed overflow-x 'clip', overflow-y back to 'visible' (was 'auto' — that was the scroll container), header rectTop 0 at scrollY 1600, no horizontal overflow at 1280 or 375. HONEST LIMIT: could not reproduce the drifting header in this Chrome pane, where it was already sticky. What is fixed is the documented mechanism, not an observed symptom.~~ · superseded 2026-08-15 22:29, see correction below

- `2026-08-15 22:18` stream **space + scroll cue** done — Both shelves are one horizontal row at every width (were a 3-col grid, so 6 cards = 2 rows). Measured at 1280x800: Recently shipped 609px -> 379px, category rail y=1297 -> y=1132 (165px higher), and with favorites also showing the saving is ~340px. Recently shipped itself sits 74px LOWER (664 -> 738) because the hero grew, which is the other half of what was asked. Scroll cue is a chevron pair in the hero that retires on the first scroll and is also a button that jumps to the first live section below.

- `2026-08-15 22:18` stream **pill navigation** done — Constellation no longer collapses during a search. Matched pills travel to the middle (spring 0.003 -> 0.014 — at 0.003 they crept a third of the way in the second a reader looks, so it read as a dim, not a move), unmatched take a peripheral ring (0.008 -> 0.02, radius 0.38W -> 0.46W) at 16% opacity, hover back to full. The connection web became a proximity route map: k=2 nearest neighbours re-derived every 40 frames, quadratic-bezier bows, and a tapered signal head that takes the colour of the pill it travels toward. Chips now render only when the pill cloud never booted — verified in exactly that state (hidden pane, rAF frozen, pills 0, chips 'Social').

- `2026-08-15 22:18` stream **hero copy** done — Tailor-made lead. Badge 'Free · Local · No account' with an 8-phrase rotation; H1 'Made to fit' + one of four typed completions; sub 'N tools, each cut for one job. Nothing to sign up for, nothing phoning home — and none of them are finished.' The page title, meta description, OG/Twitter pairs and the JSON-LD description carried the retired heading and the paywall joke, so all seven moved together. Nothing else in the fleet quoted them (grepped PROJECTS.md, HUB_REGISTRY.md, llms.txt, README).

- `2026-08-15 22:18` Measured after the fact, worth recording because it contradicts the estimate the layout option was chosen on: the predicted rail position was y~890 and the actual is y=1132. Two things I did not price — a shelf card is ~285px tall, not ~200, and the hero grew 74px (the scroll cue, plus the new sub-line wrapping to two lines). The direction is right and both asks are satisfied; the number is not the one on the option card.

- `2026-08-15 22:29` CORRECTION of the struck note above: The header report was literal and I mis-read it. The user does not want the bar pinned at all — they want it to LEAVE on the way down. The overflow-x fix stands on its own merit (body was a scroll container, which is a real defect), but it was not the ask. What they asked for is auto-hide.

- `2026-08-15 22:29` stream **header auto-hide** done — Auto-hide was welded to data-header-mode='app' in both the kit CSS and JS, so wanting the behaviour meant taking the slim 56px gradient bar with it. Added data-header-autohide='on' as an opt-in any mode can take, in the canonical packages/neorgon-ui/header/ (README documented), vendored to neorgon-site only via sync-header.sh --to. The hub keeps its transparent glass and now leaves on the way down. The docked category rail closes the 68px hole with one sibling rule, .header-bar.header-hidden ~ .cat-rail { top: 0 }, matched to the bar's own .26s — no JS and no second source of truth for the offset. Verified by driving the kit's own rAF-throttled listener with a synchronous rAF shim: visible at 60px (under its 80px threshold), hidden at 500/1500/2500 with the rail docked at 0, returns on a 200px scroll up, hides again on the next scroll down.

- `2026-08-15 22:29` Em dashes are out of the hero sub-line and the two meta/JSON-LD descriptions that mirror it. The rest of the page's em dashes are pre-existing card copy and comments, deliberately left alone — the note was about the subtitle.

- `2026-08-17 09:45` stream **debrief + writeup** done — Deck: docs/debrief-2026-08-17.yaml, 26 slides, eng audience, slides-site YAML. Dated filename because docs/debrief-2026-08.yaml already holds the Aug 13 pass and would have been clobbered. validate.mjs exit 0; geometry checked by walking all 26 slides in the player and measuring scrollHeight against clientHeight, zero overflow in either axis. Post: post/POST-planets.md (1768 words) plus blog/i-deleted-the-thing-i-defended.html, registered in blog/index.html, feed.xml and atom.xml, all three XML files re-parsed clean. Three diagrams from post/build-visuals-planets.mjs, which parses js/search.js for CATEGORIES membership, the SCORE table and the depth expression, so none of them can drift from the code. Two render defects caught and fixed in the generator rather than the SVG: overlapping pills in the depth field (added a separation pass) and a legend drawn through the last two rows of the score ladder (grew the canvas).

- `2026-08-17 09:45` Found while writing the blog post, NOT fixed: blog/everything-on-the-page-was-correct.html loads <script src="js/starfield.js"> relative, which resolves to /blog/js/starfield.js and 404s — there is no blog/js directory. The new post uses /js/starfield.js. Left alone because it is a published post outside this change; flagged as a separate task.

- `2026-08-18 17:22` Root cause was two defects, not one. The visible half: an idle physics tick (spring to a random home + two sine wobbles scaled by depth^2 + pill-to-pill repulsion + damping) ran every frame. The hidden half: randomPositions() was asked for 12 points >=80px apart inside a box 680 wide and 108-200 tall, which is unsatisfiable, so it gave up after 200 attempts, dropped pills on top of each other, and the repulsion spent every frame failing to separate a layout that could not be separated. Killing only the wobble would have left overlapping pills.

- `2026-08-18 17:22` Chose fixed positions on two drawn concentric ellipses over freezing the existing random scatter. A frozen random scatter reads as an animation that stopped; a body parked on a visible orbit reads as placed. Drawing the orbits is what makes the stillness legible, so it is not decoration, it is the reason the change works.

- `2026-08-18 17:22` Filter is now light-up-in-place: matched pills scale to 1.14 and go to full opacity, unmatched drop to a .16 trace, and only matched-to-matched routes stay lit. Rejected moving matched pills to a centre rosette (the old behaviour) because rearranging on every keystroke spends the positions the reader has just learned. Verified: 0 of 12 pills move on filter and 0 on clear.

- `2026-08-18 17:22` Split the centring translate and the state scale onto the CSS translate and scale longhands instead of one transform. Found by measurement, not by design: with both in one transform, the mobile row's transform:none !important could not cancel the -50%/-50% centring without also flattening the depth scale, and the pills rendered offset by half their own size on a ragged baseline. The longhands answer to different owners (placement never changes, scale changes constantly) so they cannot collide.

- `2026-08-18 17:22` Inner ring phase is 0.25, not 0.5. At phase 0 or 0.5 the inner ring's 4 slots (every 90deg) land on the outer ring's 8 slots (every 45deg), putting an outer pill directly behind each inner one. Measured at 609px: Productivity overlapped Board Games by 4.2px. Phase 0.25 sits the inner ring exactly between outer slots, the maximum offset available.

- `2026-08-18 17:22` Swapped window.resize for a ResizeObserver on the box. The layout is a function of the box's own size and window.resize is only a proxy for it; measured on a 609px pane the window listener left H at 200 against a box that was 130, putting four pills outside their own container. The old code hid this because it re-scattered on resize, so a stale layout always looked freshly random.

- `2026-08-18 17:22` COST, needs the user's call: raised .constellation-box height floor from 108px to 150px. Two orbits of ~28px pills need a minimum vertical span regardless of viewport width, and 16vw does not reach 150px until ~940px wide. This spends up to 42px of fold on viewports between 601px and ~940px, which commit a24cf97 had deliberately fought to reclaim. Above ~940px it costs nothing.

- `2026-08-18 17:22` Measured clearances after the fix, worst pair over all 66 pairs: 9.8px at 565x150 (601px viewport, worst case), 20px at 680x200. No pill bleeds outside the box at any size. Signal speed halved (full traverse ~11s, was ~5s) and edge state is hashed from the pair rather than Math.random, so the same two categories get the same route on every load.

- `2026-08-18 17:38` FOLLOW-UP PASS. Spacing: measured 12.4px between the search field and the top pill against 43.6px from the bottom pill down to the end of the scroll arrow. The top and bottom pills sit flush against the box edges, so the box margin IS the breathing room. Set margin-top to 44px (the cue's 14px margin plus its 30px of arrow), measured after: 44.4 above vs 43.6 below.

- `2026-08-18 17:38` Scroll cue drift cycle 2.8s -> 1.7s, second chevron delay .3s -> .18s. It answers 'is there more below', and a 2.8s cycle made the reader wait most of a beat for the answer.

- `2026-08-18 17:38` Signals now travel between pill borders, not pill centres. Trimming a quadratic bezier to [t0,t1] yields another quadratic bezier exactly, so the trimmed geometry is precomputed once per layout and both the base path and the signal sample the same curve. Gap is 7px, computed against the pill's WIDEST state (depth x 1.14, the matched scale), or a route that looked trimmed at rest would slide under the label the moment its category was the one searched.

- `2026-08-18 17:38` Endpoint trimming alone was not enough, and only measurement caught it: 96 of 656 stroked coordinates still landed inside a pill, every one inside Productivity, the widest label and the one the inner ring's chords cross. A pill background is color-mix(... 8%, transparent), so those lines were drawn ACROSS the label, not hidden behind it. Routes that tunnel under a third pill are now dropped rather than clipped in two, because a route broken in the middle reads as two unrelated routes. Cost: the graph thinned from 14 routes to 8. An orphan-rescue pass gives any pill left with zero routes its shortest dropped edge back; measured after, 0 orphans and 0 of 654 coordinates inside a pill.

- `2026-08-18 17:38` PERF, measured by patching CanvasRenderingContext2D and normalising by clearRect (exactly 1 per canvas per frame). Constellation before: 505 canvas ops/frame including ~14 createLinearGradient allocations (840/sec). After: 182 ops/frame, 0 gradients in steady state, a 64% cut. Won by rendering orbits and base routes once into an offscreen canvas and blitting them (1 drawImage), plus SIGNAL_SEGS 7->5 and dropping will-change:scale from 12 pills. Control: the starfield, untouched, measured 594 ops/frame before and 601 after, which is what validates the normalisation.

- `2026-08-18 17:38` THE BIGGER REMAINING CONSUMER IS NOT THE CONSTELLATION. The starfield draws 200 stars as beginPath+arc+fill every frame, 601 ops/frame, now 3.3x the constellation's cost (they were roughly equal before this pass). If stutter persists, that is where to look. Untouched here because it was out of scope.

- `2026-08-18 17:38` FPS could not be measured in this environment: the browser pane backgrounds itself intermittently, which pauses rAF and made every frame-timing sample garbage (10 frames in 8s). Per-frame operation counts are sound because every frame does identical work, but a real FPS before/after was NOT obtained.

- `2026-08-18 18:11` THIRD PASS. Scroll cue: the chevron used to touch full opacity at one instant (30% of the cycle) and immediately start fading, so the thing meant to be noticed was never still. Added a lit plateau, 18% to 55%, and lengthened the cycle 1.7s to 1.9s. It now reaches full opacity at 342ms where it used to take 510ms, so it arrives sooner AND holds for ~0.7s.

- `2026-08-18 18:11` Sonar arrival replaces the index stagger. The old entrance animated CATEGORIES order, which is an order the chart does not draw. Now one ping leaves the centre at constant rate and each pill appears as the front reaches it, delay = (ring rx / outer rx) * 820ms. Measured: the 4 inner-ring pills arrive at 362ms and the 8 outer at 820ms, which is the geometry exactly. Each contact returns its own expanding ring in the pill's colour, and the routes fade in with the front so no route is drawn to an endpoint that is not there yet.

- `2026-08-18 18:11` The sonar front is elliptical, matching the orbit aspect, not circular. Consequence worth knowing: pills on one orbit are all reached simultaneously, so the entrance is 2 beats rather than a smooth 12-pill sweep. A circular front would give 12 distinct arrivals but would leave the box vertically almost immediately on a 680x200 band and would not align with the drawn orbits. Chose coherence with the orbits; the 2-beat read is a deliberate consequence, not an oversight.

- `2026-08-18 18:11` Front is linear, not eased. A sonar pulse travels at one speed, and easing it would mean easing every pill's CSS delay to match or watching the two drift apart.

- `2026-08-18 18:11` Sonar costs nothing after it finishes: measured steady state 184.6 canvas ops/frame with 0 ellipse calls and 0 static-layer redraws, against 182 measured before the sonar existed.

- `2026-08-18 18:11` RESPONSIVENESS: two apparent bugs investigated and both were NOT bugs. (1) 'Horizontal overflow at 601px, document 671 wide in a 601 viewport.' The preview pane evaluates media queries at the requested width but lays out at the real window width, so documentElement.clientWidth reported 601 while innerWidth and visualViewport reported 671. Hiding every suspect overlay changed scrollWidth by 0. (2) 'The constellation canvas overflows the body by 8px at 601px.' Real geometry (the canvas bleeds 30px per side for the sonar front and route bows) but already handled: body carries overflow-x: clip, and scrolling to x=500 lands at 0. Reverted a .hero clip rule added before testing it. Lesson: measure the symptom, not the metric.

- `2026-08-18 18:11` NAVIGATION measured: search filter across 58 cards, 17 keystrokes with a forced synchronous layout after each, median 4.3ms and worst 24.3ms (the search-mode transition that moves cards between grids). Full-page scroll of 10456px produced 0 long tasks over 50ms. No horizontal scroll at 375, 601, 768 or 1265.

- `2026-08-19 09:39` Archive is deliberately absent from search.js CATEGORIES, breaking the documented 1:1 pill/group rule. The rule exists to stop a pill filtering to zero; a group with no pill fails the safe way (still scored by name, just not offered by the constellation). A pill would advertise the one shelf on the page the catalog argues against.

- `2026-08-19 09:53` Diagnosed 'expanding a collapsed group reveals invisible cards' and wrote a revealCards() fix for it. The diagnosis was wrong: the preview tab reported visibilityState hidden, which froze all 76 of the page's animations at currentTime 0, so every card on the page measured opacity 0, not just the ones in collapsed groups. Retested with revealCards disabled: expanding creates a FRESH cardEnter animation at time 0 which finishes at opacity 1, because the browser restarts animations when a subtree becomes rendered again. revealCards was removed. Lesson: opacity read from a hidden tab is not evidence.

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


**Follow-up pass (the three items left after the first).**

| item | outcome |
|---|---|
| archived brief carried superseded numbers | supersede banner at the top of `brief-2026-08-13-search-icons.md`, so a top-to-bottom reader meets the correction before the wrong figure |
| `make hooks` undiscoverable in a fresh clone | documented in `README.md` (new Checks section) and `CLAUDE.md`; README's stale `8080` fixed, so all four files that name a port now say 8800 |
| brand marks as an unexplained exception | no change needed and none made: `.external-card` already draws a dashed border and an EXTERNAL badge, so the exception is signposted twice before the icon colour is noticed |

**Defect found while verifying the third.** `github` displayed 3 cards under "No tools match
your search." Fixed by counting external matches separately, mirroring the Soon-card fix the
file already contained. Verified across five queries: `github` -> "1 external",
`youtube` -> "1 of 43 tools · 1 external", `zzzznope` -> empty state with nothing on screen,
and no query now shows a card while denying it.

## Open

- **The archived brief `.forge/brief-2026-08-13-search-icons.md` still records 1816 -> 195.**
  Left as written: it is a closed record of what was believed at the time, and the correction
  plus its cause are stated here.
- **The four third-party brand marks remain deliberate exceptions** to "everything on a card
  takes the card's colour". Now enforced as an exception rather than assumed.
- **`make hooks` is opt-in and currently enabled in this working copy** (`core.hooksPath` is
  set). It is per-clone git config, not committed state, so nobody else gets it automatically.

_Closed 2026-08-14 09:31._

_Closed 2026-08-14 09:37._

---

## Run — 2026-08-15 21:56

**Problem.** The hub reads as a flat page, not a space console: search ranks a category blanket above the tool you named, the pill constellation unmounts exactly when it should be navigating, Recently shipped eats two screens, and the hero copy sells 'no paywall' instead of tailor-made

_Closed 2026-08-15 22:18._

_Closed 2026-08-15 22:29._

_Closed 2026-08-17 09:45._

---

## Run — 2026-08-18 17:03

**Problem.** Hero constellation pills drift erratically and rearrange on filter; both read wrong for a planetary chart

_Closed 2026-08-18 17:22._

_Closed 2026-08-18 17:38._

_Closed 2026-08-18 18:11._

---

## Run — 2026-08-19 09:35

**Problem.** Hub surfaces treat reference tools as news, superseded tools as current, and the terminal opens on a bare one-line greeting

**Approach.** Three surfaces, one shared idea: the hub currently has exactly one axis for a
card, `data-added`, and it uses it to answer two different questions ("is this new?" and
"should I lead with it?"). Split the axes.

1. `data-recent="off"` on a `.card-group` opts the whole group out of *both* recency surfaces,
   the Recently shipped rail and the self-expiring New badge. Applied to UI Lab, which is
   reference material: a visitor scanning for what changed should not be handed a wireframe
   glossary. Group-level, not per-card, so the next reference category needs no code change.
2. `data-collapsed="true"` on a `.card-group` makes it a collapsible section, toggle built by
   JS onto the existing `.group-label`, state persisted per group. Applied to a new Archive
   group at the foot of the catalog and, at the user's request, to Platforms.
3. `data-status="archived"` on a card is the third state next to `soon` and live: still
   reachable, deliberately not recommended. Skill Map moves to Archive with a line naming
   Pathfinder as what replaced it. Archived cards leave every count the way `soon` cards do
   (hero, search denominator, `stats`, `random`, `liveTools`) but stay searchable and get
   their own line in the search count, because a query that puts a card on screen must never
   report zero.
4. Terminal opens on an ASCII banner instead of one line of prose.

**Rejected.** Marking Skill Map in place under Planning, next to Pathfinder, with only a badge.
It is the smaller change and matches the `soon` precedent exactly, but the user asked for "a
section to archive ideas", and leaving a superseded tool adjacent to its replacement keeps
presenting a choice that has already been made.

Also rejected: a per-card `data-recent="off"` on each UI Lab card. Six attributes to write now
and one to remember forever on every future UI Lab addition, to buy a granularity nobody asked
for.

**Measured.**

- The UI Lab opt-out is not cosmetic: `sortie` and `neokeys` (both shipped 2026-08-14, 5 days
  old) held two of the six Recently shipped slots and carried `New` badges. Both are now out,
  and `stash`, `runbook` and `hiringpack` took the slots back. Rail before: boardwright,
  sortie, neokeys, proctor, stash, glassbox. After: boardwright, proctor, stash, glassbox,
  runbook, hiringpack.
- Hero count 47 to 46, matching `tools` in the terminal and the search denominator.
- Search `skill map` reports `1 archived` rather than falling into the empty state. `planning`
  reports `4 of 46 tools · 1 archived`, so the archived card is found, reported, and excluded
  from the denominator at the same time.

**Verification note.** The preview tab reported `visibilityState: hidden` for the whole
session, which freezes every CSS animation at `currentTime: 0`. Catalog content therefore
never painted, and screenshots of it are blank. The terminal banner was screenshotted (it is
a fixed overlay with no entrance animation); everything else was verified through computed
styles and the CSSOM, with `document.getAnimations().forEach(a => a.finish())` used to settle
the entrance animations before reading opacity. One consequence worth carrying: a stale
`css/style.css` was served from cache through a normal reload, and a specificity bug looked
like an unfixed bug until a forced reload proved the fix had landed.

_Closed 2026-08-19 10:01._

## Addendum, same day, closing the open items

Four of the five open items closed; the fifth was a false alarm about the
environment that turned out to have a precise cause.

- **The blank screenshots had a real explanation.** Not "the tab does not
  render": the Browser pane was collapsed on the user's side, so the page
  composited no frames, and the tool eventually said so outright ("the Browser
  pane is not displayed"). Fronting the tab does not open the pane, and the
  pane cannot be opened programmatically. Switched to the headless Playwright
  browser, which rendered everything first try. Worth remembering: a blank
  capture is a question about the surface, not about the page.
- **The rendered view immediately found a design bug the DOM could not.**
  `.group-chevron` had `margin-left: auto` inside a full-width toggle, which
  parked the glyph ~1100px from the word it belonged to, reading as an
  unrelated control floating in the gutter. Computed styles were all correct.
  Only the picture showed it. Now sits beside the count; the button still
  spans the row, so the click target is unchanged.
- **The dead dim is fixed rather than documented.** `.soon-card { opacity: .78 }`
  never rendered, because `cardEnter` fills `forwards` and its `to { opacity: 1 }`
  outranks a normal declaration on the same element. Moved to `.card-content`,
  which the animation does not target, keyed by `--card-rest-dim` (`.78` Soon,
  `.72` archived). Verified by hover: content `.72` to `1`, icon grayscale `.85`
  to `.4`, border `.12` to `.2`. This is a visible change to the two existing
  Soon cards, which are now genuinely dimmer than a live tool, as the CSS
  always intended.
- **The stale server was killed.** A `python3 -m http.server 8800` with the
  right cwd that answered 404 to its own `index.html`. Restarted from the
  project's own launch config and healthy.
- **Committed** on `main` as `LucianoAdonis`, matching every prior commit in
  this repo. Two commits: the recency opt-out separately, since it stands
  alone, and the archive plus collapse plus banner plus dim fix together,
  because their HTML, CSS and JS interlock and an intermediate commit would
  not have worked. Not pushed.
