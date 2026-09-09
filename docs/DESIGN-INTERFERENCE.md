# Interference: design

Queue item `#4`. An admin in the hub terminal forces the theme of every open hub tab. The
tab that fired it prints what it did; the others see a short burst of static and the theme
lands. No audio: autoplay is blocked without a gesture and a hub should not make noise.

## 1. Data: one row, one session table

`convex/schema.ts` gains two tables. Both are additive, so pushing them breaks nothing running.

| Table | Fields | Index |
|---|---|---|
| `interference` | `key: "hub"`, `theme: string \| null`, `seq: number`, `by: string`, `at: number` | `by_key` |
| `sessions` | `token: string`, `username: string`, `expiresAt: number` | `by_token` |

`interference` holds exactly one row, `key = "hub"`. `theme` is the forced theme id or `null`
when released. `seq` increments on every write, including a write of the same theme, so a
tab can tell a fresh order from a value it already holds. `by` and `at` are the audit trail
the `interfere` command reads back.

## 2. The gate: what auth.ts has, and what it needs

`auth.ts` `login` verifies bcrypt and returns `{ ok, username }`. There is no token: the
"session" is the string `authedUser` inside terminal.js's closure, which any script on the
page could imitate. A mutation cannot trust it. The gate therefore needs a server-side fact.

- `login` mints one: 32 random bytes from `node:crypto` as hex, stored through a new
  `internal.authDb.createSession({ username, token, expiresAt: now + 12h })`, and returned as
  `token` next to `username`. Old clients ignore the extra field. `createSession` deletes that
  user's expired rows on the way in, so the table cannot grow past the number of logins alive.
- `convex/interference.ts` `set({ token, theme })`, a public mutation, checks in this order:
  1. `sessions.by_token` lookup; missing or `expiresAt < Date.now()` throws `Not signed in.`
  2. `users.by_username` lookup on `session.username`; missing throws the same message, so a
     user removed with the CLI loses the power at once even with a live token.
  3. `theme` is `null` or matches `/^[a-z][a-z0-9-]{0,23}$/`; anything else throws `Bad theme.`
  Then it patches (or inserts) the `hub` row with `seq + 1`, `by = session.username`, `at = now`.
- `get()`, a public query, returns the `hub` row or `null`. Anyone may read it; it is what the
  page shows.
- `authDb.ts` grows a public `revokeSession({ token })`; holding the token is the right to end it.
  terminal.js `logout` calls it best-effort and drops the token from the closure.

The token lives in the closure only, never in storage, the same lifetime `authedUser` has now.

## 3. The subscription module

`js/interference.js`, an IIFE like every other hub script, loaded with `defer` after
`neorgon-header.js`. It never touches `js/terminal.js`'s `ConvexHttpClient`; it owns a second
client:

- On `requestIdleCallback` after load (fallback `setTimeout 1500`), `import('https://esm.sh/convex@1.21.0/browser')`
  and construct `new ConvexClient(CONVEX_URL)`. Same package the terminal lazy-loads, cached.
- `client.onUpdate('interference:get', {}, apply)`, the string form terminal.js already uses;
  `anyApi` from the same package is the fallback if the WebSocket client refuses a string.
- The page CSP must add `wss://quaint-cobra-151.convex.cloud` to `connect-src`. Without it the
  socket fails silently and the feature looks dead.
- Exposes `window._neoInterference = { play(theme), state() }` for the terminal and the proof.

`apply(row)` keeps one `lastSeq`, starting at `null`:

| Delivery | Action |
|---|---|
| first, `row` null or `theme` null | if `localStorage["neorgon-interference"]` holds a `prior`, restore it (section 5) |
| first, `theme` set | late tab: record prior if none, set theme, **no burst** (the whole late-tab rule), set `data-interference="armed"` on `<html>` |
| later, `seq > lastSeq`, `theme` set | burst, theme lands mid-burst |
| later, `seq > lastSeq`, `theme` null | burst, prior theme lands mid-burst, attribute removed |

## 4. Terminal surface

All in `authCommands`, so the existing "requires authentication" message covers a visitor.

| Command | Reply |
|---|---|
| `interfere` | `Interference: sakura, set by luciano 4m ago.` or `Interference: released.` |
| `interfere <theme>` | validates against `NeoHeader.themes`; on success `Interference set: sakura. Every open hub tab is switching.` |
| `interfere off` | `Interference released. Tabs return to their own theme.` |
| `interfere list` | delegates to the public `theme list` |
| errors | `Unknown theme: "x". Type "interfere list".` / `Not signed in.` / `Connection failed.` |

The mutation goes through terminal.js's existing HTTP client. The admin's own tab bursts too,
via its subscription, so the order is felt where it was given. `help` gains one line under
Authenticated commands: `interfere <theme>|off: force the theme on every open hub tab`. Tab
completion adds `interfere` to the theme-argument pool. terminal.js grows about 40 lines; it is
already 996 against the 500 rule, and this change does not take that debt on.

## 5. Precedence and the release path

The header kit's order is visitor > season > opt-out > skin > default. Interference sits **below
the visitor**. Two consequences the code enforces:

- `?theme=` in the URL: the kit's `currentTheme()` returns the param, so the module plays the
  burst and applies nothing. Interference is felt, not obeyed.
- The cookie: `NeoHeader.setTheme` is the only sanctioned way to set a theme and it writes
  `neo_theme`, which follows the visitor across neorgon.com. So before the first forced theme
  lands the module saves `{ seq, prior: NeoHeader.getTheme() }` to `localStorage["neorgon-interference"]`,
  and never overwrites an existing `prior` (a second forced theme keeps the original). On release
  it restores `prior` only if the cookie still equals the forced theme; a visitor who ran `theme`
  in between keeps their pick. Then the record is cleared. A browser that was closed during an
  interference restores on its next hub load through the first-delivery row of section 3.
 While armed, other neorgon.com sites show the forced theme through the shared cookie and do not burst; only the hub subscribes.

## 6. The burst

One `<div class="interference" aria-hidden="true">` appended on first use, `position: fixed;
inset: 0; pointer-events: none; z-index: 9990` (under the terminal at 10000, so the reply stays
readable). Four children, colours only from CDN `base.css` tokens, motion only `transform` and
`opacity`. Playing toggles `.is-playing`; a burst arriving mid-burst removes the class, forces a
reflow, and re-adds it.

| Layer | Paint | Motion (0 to 1400ms) |
|---|---|---|
| `.veil` | `var(--bg)` | opacity 0 to .55 by 140ms, hold, to 0 at 1400 |
| `.static` | inline SVG `feTurbulence` noise as `background-image`, `inset: -8%`, `mix-blend-mode: screen` | opacity 0 to .5 by 120, hold to 600, to 0 by 1100; `translate3d` jitter between (-2%, 1%) and (2%, -1%) with `steps(8)` |
| `.scanlines` | `repeating-linear-gradient(to bottom, transparent 0 2px, color-mix(in srgb, var(--text-primary) 10%, transparent) 2px 3px)` | opacity 0 to .35 by 100, to 0 by 1000; `translateY` 0 to 8px linear |
| `.wash` | `color-mix(in srgb, var(--accent) 18%, transparent)` | opacity 0 to .18 at 480, to 0 by 900 |

The theme lands at **520ms**, under the veil and behind the static peak, so the swap itself is
never seen as a hard cut. Easing is `var(--ease-snap)` on the veil and linear elsewhere.

Under `prefers-reduced-motion: reduce` (matchMedia in JS, media query in CSS) only `.veil` runs:
opacity 0 to .6 over 200ms, the theme lands at 200ms, opacity to 0 over 400ms. A plain cross-fade,
600ms total, nothing moves.

That block has to take its own duration back. `style.css` already stills the whole page under the
same media query with `*, *::before, *::after { animation-duration: 0.01ms !important }`, and an
important longhand outranks this rule's shorthand duration whatever the specificity, so the
cross-fade needs `animation-duration: 600ms !important` beside it. Without that line the veil is
over in 0.01ms, paints nothing, and the theme snaps at the 200ms land timer: a hard cut, which is
the single outcome the reduced path exists to prevent. A fade that moves nothing is the accessible
form of the burst, not an exception to the preference.

## 7. Strings

`Not signed in.` · `Bad theme.` · `Interference set: {theme}. Every open hub tab is switching.` ·
`Interference released. Tabs return to their own theme.` · `Interference: {theme}, set by {by} {ago}.` ·
`Interference: released.` · `Unknown theme: "{x}". Type "interfere list".` · `Connection failed.`

## 8. Proof

`.env.local` names `dev:quaint-cobra-151`, and terminal.js hardcodes that same URL: the hub's
live backend **is** the dev deployment. `npx convex dev --once` is allowed and is also the real
thing, so the push must be additive (it is, section 1) and the JS ships after review; never
`npx convex deploy`. Headless: Chromium from `projects/og-studio-site/node_modules/playwright`,
two pages on `make serve`; type `login` and `interfere sakura` in tab A; assert tab B gets
`data-theme="sakura"` and `data-interference="armed"` within 3s and `.interference.is-playing`
was observed; open tab C, assert the theme with no `.is-playing` ever; `interfere off`, assert
both restore. Run once more with reduced motion emulated and assert only `.veil` changed opacity,
by **sampling `getComputedStyle(veil).opacity` across the burst**, not by listening for
`animationstart`: the event fires with the right name even when the duration has been stilled to
0.01ms and nothing ever reaches the screen.
