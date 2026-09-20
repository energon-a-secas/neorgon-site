# Three priorities after the visual pass

Implemented in the requested order, following the approved Antenne/catalog
release. The original release reached `main` as `ba464ba` and `c0519dd`; GitHub
Pages completed its deployment, and the live feed rendered without uncaught
page errors. This report describes the subsequent refinements.

## 1. Mobile news on demand

Phones now have a 44px Antenne dock. Activating it opens the native news panel
and fetches the feed. There is no mobile feed request before activation and no
automatic popup. Loading, empty, and failure states are readable, with retry
available after an empty or failed response. A stalled request times out after
ten seconds. The full-news link stays available.

The panel respects safe areas, limits its height, and scrolls on short screens.
Close and Escape return focus to the dock. Tapping outside dismisses the panel
and preserves focus on the tapped control. Resizing an automatically opened
desktop bulletin down to mobile closes it without marking the edition seen.

![Mobile news panel](priority-refinements-img/mobile-news.png)

## 2. Keyboard, touch, and still previews

Enabling Card previews exposes explicit controls on catalog cards and shelf
echoes. Enter, Space, or a tap opens a preview and focuses its close control.
Escape returns focus; tabbing away closes the preview. Pointer hover keeps its
delay. Turning previews off removes the active layer immediately. Ordinary card
clicks still navigate, and preview controls do not initiate drag-to-reorder.

Reduced motion paints a canvas still decoded from the existing GIF off-DOM. The
animated image never enters the document in this mode. Closing discards the
image and layer. A failed asset shows an explanation while leaving the tool
link usable. Settings now remain usable if browser storage is unavailable.

The GIF is still downloaded to decode the still frame; this is motion support,
not a bandwidth optimization. Dedicated static assets could reduce that cost in
a later recorder change. Existing preview coverage gaps remain unchanged.

![Still preview with explicit close control](priority-refinements-img/still-preview.png)

## 3. Recognizable sources for multi-tool stories

A source line below each headline names every recognized linked catalog tool,
using its existing icon and accent. Duplicate destinations appear once; a
recognized primary site leads. Unknown links cannot claim another tool's icon,
including unrelated repositories sharing GitHub's hostname. Stories with no
recognized tool keep the satellite.

These labels live inside the story's single link. There are no nested links,
additional tab stops, remote favicon requests, or parallel icon registry.
Tools mentioned only in prose are not inferred as sources.

![Named tools beneath Antenne headlines](priority-refinements-img/antenne-tools.png)

## Evidence and reproduction

| Check | Result |
| --- | --- |
| Bulletin browser suite | 56 assertions pass in Chromium and WebKit |
| Preview browser suite | 28 assertions pass in Chromium and WebKit |
| Repository checks | Icon standard, preview map, and tool counts pass |
| Local integration | Real Antenne archive loads without interception |
| Visual review | Desktop bulletin, mobile dock/panel, card controls, canvas still |

Run `make serve`, then `node scripts/check-bulletin.cjs` and
`node scripts/check-previews.cjs`. Set `BROWSER=webkit` for the second browser.
The HTTP WebKit harness strips the production HTTPS-upgrade directive from its
served response only; production HTML keeps that directive.

`PATH="/opt/homebrew/bin:$PATH" make check` uses a Python version compatible with
the existing icon checker. It reports 64 live tools, 72 icons on standard, six
preview gaps, and fifteen single-frame GIFs. No preview files were re-recorded.

The tests use controlled feed and failure responses. They do not establish a
full accessibility audit, manual screen-reader coverage, or a speed benchmark.
Production verification should use the normal feed and production CSP after
Pages finishes deploying the final commit.

## Documentation and skills

The initial [debrief](neorgon-ui-debrief.pdf) remains a snapshot of the first
pass. The [follow-up deck](neorgon-priority-refinements.pdf) covers these changes.
The [model-review draft](../post/astra-ui-review/POST.md) now includes a follow-up
section and the current multi-tool screenshot; it remains a draft.

The same impeccable design guidance and existing site context governed all
three priorities. The debrief and writeup workflows supplied the evidence-led
reporting, with writing-clearly-and-concisely and humanizer guiding the prose.
Commit-work supplied scoped staging, staged-diff review, and separate commits
for each priority. No subagents were used.
