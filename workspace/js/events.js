/**
 * Workspace page: every listener. Buttons carry data-act and are handled by
 * one delegated click listener; forms and inputs are wired by id.
 */
import { cleanPrefs, deviceDefaults, zone, country, STORAGE_KEY, COOKIE_ME } from '../../js/neorgon-workspace-core.js'
import { showToast } from '../../js/neorgon-dom.js'
import { state, load, commit, clearAll, prefs, setPrefs, resetPrefs } from './store.js'
import { renderEditor, renderPrefs } from './editor.js'
import {
  openPerson, savePerson, removePerson, openTeam, saveTeam, removeTeam, renderMembers, memberInput, confirm, restoreFocus,
} from './forms.js'
import { route, leave, inFlow, startImport, saveFlow, replaceFlow, shareFlow, exportFile, banner } from './flow.js'
import { $, $$, minutesOf, plural } from './util.js'

const MAX_FILE = 5 * 1024 * 1024
const toast = (msg) => showToast(msg, { id: 'wsToast', className: 'ws-toast', visibleClass: 'is-on', duration: 2400 })
const refresh = () => renderEditor()

/** ok: true saved, false the browser refused it, null nothing was saved (a field needs fixing). */
function saved(ok, msg) {
  if (ok) { banner(''); refresh(); toast(msg) } else if (ok === false) banner('This browser would not keep the change (private browsing, or storage is full).')
  return ok
}

const ACTIONS = {
  'person-new': () => openPerson(),
  'person-edit': (el) => openPerson(el.dataset.id),
  'person-remove': async () => { if (await removePerson()) { $('#personDialog').close(); saved(true, 'Removed') } },
  'team-new': () => openTeam(),
  'team-edit': (el) => openTeam(el.dataset.id),
  'team-remove': async () => { if (await removeTeam()) { $('#teamDialog').close(); saved(true, 'Team deleted') } },
  'dialog-cancel': (el) => el.closest('dialog').close(),
  'prefs-device-tz': () => { const f = $('#prefsForm'); f.elements.tz.value = deviceDefaults().tz; writePrefs() },
  'prefs-reset': () => { resetPrefs(); renderPrefs({ force: true }); refresh(); toast('Settings follow this device') },
  export: () => exportFile(),
  import: () => $('#importFile').click(),
  clear: async () => {
    const { ws } = state
    const yes = await confirm({
      title: 'Clear your workspace?',
      body: `${plural(ws.people.length, 'person', 'people')} and ${plural(ws.teams.length, 'team')} are removed from this browser. Export a file first if you may want them back.`,
      ok: 'Clear workspace',
    })
    if (yes) saved(clearAll(), 'Workspace cleared')
  },
  'flow-save': () => saveFlow(),
  'flow-replace': () => replaceFlow(),
  'flow-share': () => shareFlow(),
  'flow-leave': () => leave(),
}

/** Reads the settings form, writes what is valid, and marks what is not. */
function writePrefs() {
  const f = $('#prefsForm').elements
  const { mine } = prefs()
  const next = { ...mine }
  const tzText = f.tz.value.trim()
  const tz = zone(tzText)
  $('#prefTzErr').textContent = tzText && !tz ? 'Pick a zone from the list, or an offset like +2.' : ''
  if (tz) next.tz = tz; else if (!tzText) delete next.tz
  const a = minutesOf(f.start.value), b = minutesOf(f.end.value)
  const end = b === 1439 ? 1440 : b
  const hoursOk = a !== null && end !== null && a < end
  $('#prefHoursErr').textContent = hoursOk ? '' : 'The start comes before the end.'
  if (hoursOk) next.h = [a, end]
  const d = $$('input[name="d"]:checked', $('#prefsForm')).map((x) => x.value).join('')
  if (d) next.d = d
  next.w = Number(f.w.value)
  next.c = f.c.value
  const ccText = f.cc.value.trim()
  const cc = country(ccText)
  $('#prefCcErr').textContent = ccText && !cc ? 'Two letters, like CL or DE.' : ''
  if (cc) next.cc = cc; else if (!ccText) delete next.cc
  // A value the visitor never chose and that equals this device's stays out of the
  // cookie, so a laptop that travels keeps following its own zone and week.
  const device = deviceDefaults()
  for (const k of Object.keys(next)) {
    if (!(k in mine) && JSON.stringify(next[k]) === JSON.stringify(device[k])) delete next[k]
  }
  if (setPrefs(cleanPrefs(next))) {
    $('#prefsSaved').textContent = 'Saved for every Neorgon tool'
    refresh()
  }
}

async function importFile(file) {
  if (!file) return
  if (file.size > MAX_FILE) return banner('That file is larger than a workspace can be (5 MB). Nothing was read.')
  let raw = null
  try { raw = JSON.parse(await file.text()) } catch { raw = null }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return banner('That file is not a workspace (neorgon-workspace.json). Nothing was read.')
  banner('')
  startImport(raw, String(file.name || 'file').slice(0, 80), refresh)
}

export function wire() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]')
    if (!el || !ACTIONS[el.dataset.act]) return
    e.preventDefault()
    ACTIONS[el.dataset.act](el)
  })

  // Settings: write on change (a typed zone is checked when the field is left, not on every key).
  $('#prefsForm').addEventListener('change', writePrefs)
  $('#prefsForm').addEventListener('submit', (e) => { e.preventDefault(); writePrefs() })

  $('#meSelect').addEventListener('change', (e) => {
    const ws = structuredClone(state.ws)
    ws.me = e.target.value ? { person: e.target.value } : {}
    saved(commit(ws), e.target.value ? 'Saved who you are' : 'Cleared who you are')
  })

  $('#peopleSearch').addEventListener('input', (e) => { state.filter = e.target.value; refresh() })

  $('#importFile').addEventListener('change', (e) => { importFile(e.target.files && e.target.files[0]); e.target.value = '' })

  // Dialogs: submit saves and closes only when the form was valid; focus goes back to the opener.
  $('#personForm').addEventListener('submit', (e) => {
    e.preventDefault()
    if (saved(savePerson(), 'Saved')) $('#personDialog').close()
  })
  $('#teamForm').addEventListener('submit', (e) => {
    e.preventDefault()
    if (saved(saveTeam(), 'Team saved')) $('#teamDialog').close()
  })
  for (const id of ['personDialog', 'teamDialog']) $('#' + id).addEventListener('close', restoreFocus)
  for (const form of [$('#personForm'), $('#teamForm')]) {
    form.addEventListener('change', (e) => {
      if (e.target.name === 'ownColor') form.elements.color.disabled = !e.target.checked
    })
  }
  $('#memberSearch').addEventListener('input', renderMembers)
  $('#memberPick').addEventListener('change', (e) => memberInput(e.target))
  $('#memberPick').addEventListener('input', (e) => { if (e.target.dataset.pct) memberInput(e.target) })

  // The address bar and other tabs.
  window.addEventListener('hashchange', () => { if (route(refresh)) return; if (!inFlow()) refresh() })
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY && e.key !== null) return
    load()
    if (!inFlow()) refresh()
  })
  // neo_me may be edited from a tool's Settings sheet in another tab: catch up on return.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && document.cookie.includes(COOKIE_ME)) renderPrefs()
  })
}
