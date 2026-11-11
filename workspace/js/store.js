/**
 * Workspace page: neorgon.com's copy of the workspace and the visitor's settings.
 *
 * The copy is STORAGE_KEY, a Persist Kit envelope at STORE_VERSION holding
 * { stamp, ws }. Every write takes a new stamp and rewrites the neo_ws cookie,
 * so the frame and every tool can tell whether their copy is the latest.
 * Everything read back goes through normalizeRecord: another tab, an old
 * version or a hand edit may have put anything there.
 */
import { createStore, storageAvailable } from '../../js/neorgon-persist.js'
import {
  STORAGE_KEY, STORE_VERSION, normalizeRecord, normalizeWorkspace, emptyWorkspace, markSaved, isoTime,
  makeStamp, stampCookie, readMe, meCookie, clearCookie, cleanPrefs, withDefaults, COOKIE_ME,
} from '../../js/neorgon-workspace-core.js'

const store = createStore({ key: STORAGE_KEY, version: STORE_VERSION })

/** The page's shared state. `ws` is always a normalized workspace. */
export const state = {
  ws: emptyWorkspace(),
  stamp: '',
  issues: [],              // what was wrong with the stored copy when it was read
  canStore: true,
  filter: '',              // the people search
  shown: 50,               // people rows drawn before "Show more"; reset by a new search
  teamsAll: false,         // every team card, or the first few
}

export const where = () => ({ protocol: location.protocol, hostname: location.hostname })

/** Reads the stored copy into state. A missing or unreadable copy is an empty workspace. */
export function load() {
  state.canStore = storageAvailable()
  const rec = normalizeRecord(store.load(null))
  state.ws = rec ? rec.ws : emptyWorkspace()
  state.stamp = rec ? rec.stamp : ''
  state.issues = rec ? rec.issues : []
  return state
}

/**
 * Saves a workspace as the new copy. `tool` is set by a review (it becomes
 * source); an edit on this page keeps the last source and only moves `updated`.
 * Returns false when the browser would not keep it (then the cookie is untouched).
 */
export function commit(ws, { tool = null } = {}) {
  let next
  if (tool) next = markSaved(ws, tool)
  else {
    next = normalizeWorkspace(ws).ws
    next.updated = isoTime(new Date().toISOString())
  }
  const stamp = makeStamp()
  if (!store.save({ stamp, ws: next })) return false
  try { document.cookie = stampCookie(stamp, where()) } catch { /* cookies off: the copy is still saved */ }
  state.ws = next
  state.stamp = stamp
  state.issues = []
  return true
}

/** Empties the workspace (people, teams, who you are). A new stamp tells every tool. */
export const clearAll = () => commit(emptyWorkspace())

// ── Settings: the neo_me cookie ──────────────────────────────
/** The stored settings ({} when none) and the same filled from this device. */
export function prefs() {
  let mine = null
  try { mine = readMe(document.cookie) } catch { mine = null }
  return { mine: mine || {}, all: withDefaults(mine || {}) }
}

/** Writes neo_me. Only cleanPrefs' fields survive; never a name or an email. */
export function setPrefs(next) {
  const clean = cleanPrefs(next)
  try { document.cookie = meCookie(clean, where()) } catch { return false }
  return true
}

/** Forgets the settings, so every tool falls back to the device's. */
export function resetPrefs() {
  try { document.cookie = clearCookie(COOKIE_ME, where()) } catch { return false }
  return true
}

/** Safari keeps a script-written cookie about 7 days: rewrite neo_me with the same value on every visit. */
export function refreshPrefs() {
  const { mine } = prefs()
  if (Object.keys(mine).length) setPrefs(mine)
}
