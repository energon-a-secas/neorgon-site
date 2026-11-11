/**
 * Neorgon Workspace Kit: the read-only frame
 * Canonical source: packages/neorgon-ui/workspace/vault.js
 * Placed by packages/neorgon-ui/sync-workspace.sh in neorgon-site only, as
 * workspace/vault.js, beside workspace/vault.html.
 *
 * A tool on an adopter's origin frames https://neorgon.com/workspace/vault.html
 * and asks for the workspace with { ns, id, op: 'ping' | 'get' }. This frame
 * answers only its parent, only an origin in the exact allowlist
 * (originAllowed: neorgon.com, www, the ADOPTERS; any local origin only while
 * the frame itself is served from localhost), and never writes: every other op
 * is refused as read-only, and anything that is not the protocol gets no
 * answer at all. What it sends is the stored record, normalized again here.
 *
 * Do not edit the placed copy. Edit here and run sync-workspace.sh.
 */
import { readRequest, originAllowed, frameReply, frameRefusal, frameChanged, frameStatus, readStamp, normalizeRecord, STORAGE_KEY, STORE_VERSION } from '../js/neorgon-workspace-core.js'
import { createStore } from '../js/neorgon-persist.js'

const store = createStore({ key: STORAGE_KEY, version: STORE_VERSION })
const parent = window.parent !== window ? window.parent : null
let parentOrigin = ''   // set by the first allowed request; where 'changed' is pushed

function cookies() {
  try { return document.cookie } catch { return '' }
}

/** The stored workspace as the frame reports it: { status, stamp, ws }. */
function snapshot() {
  const rec = normalizeRecord(store.load(null))
  const stamp = rec ? rec.stamp : ''
  return { status: frameStatus(stamp, readStamp(cookies())), stamp, ws: rec ? rec.ws : null }
}

if (parent) {
  window.addEventListener('message', (event) => {
    if (event.source !== parent) return
    const req = readRequest(event.data)
    if (!req || !originAllowed(event.origin, { selfHostname: location.hostname })) return
    parentOrigin = event.origin
    const answer = req.op === 'refused' ? frameRefusal(req) : frameReply(req, snapshot())
    try { parent.postMessage(answer, event.origin) } catch { /* the parent went away */ }
  })

  // Another neorgon.com tab saved: tell the parent, if it has asked before.
  window.addEventListener('storage', (event) => {
    if (!parentOrigin || (event.key !== null && event.key !== STORAGE_KEY)) return
    try { parent.postMessage(frameChanged(snapshot()), parentOrigin) } catch { /* the parent went away */ }
  })
}
