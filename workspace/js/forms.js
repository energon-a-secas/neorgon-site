/**
 * Workspace page: the person and team dialogs, and the confirm dialog.
 * Each field is checked with the kit's own validator before anything is
 * saved, and the result goes through normalizeWorkspace in store.commit.
 */
import { str, visible, email, zone, country, color, colorFor, foldName } from '../../js/neorgon-workspace-core.js'
import { state, commit } from './store.js'
import { peopleOptions } from './editor.js'
import { html, paint, $, $$, face, minutesOf, timeValue, plural } from './util.js'

let editing = { kind: '', id: '' }   // which person or team the open dialog edits ('' = new)
let opener = null                    // focus goes back here when a dialog closes

function err(form, id, msg) {
  const el = $('#' + id, form)
  if (!el) return
  el.textContent = msg
  const field = form.querySelector(`[aria-describedby~="${id}"]`)
  if (field) field.setAttribute('aria-invalid', msg ? 'true' : 'false')
}
function clearErrors(form) { for (const el of $$('.ws-error', form)) err(form, el.id, '') }

function show(dialog) {
  opener = document.activeElement
  dialog.showModal()
  const first = dialog.querySelector('input[name="name"]')
  if (first) first.focus()
}
export function restoreFocus() {
  if (opener && opener.isConnected) opener.focus()
  opener = null
}

function setColor(form, entity) {
  const own = color(entity && entity.color)
  form.elements.ownColor.checked = !!own
  form.elements.color.value = own || colorFor(entity && entity.id ? entity : 'new')
  form.elements.color.disabled = !own
}

// ── People ───────────────────────────────────────────────────
export function openPerson(id = '') {
  const form = $('#personForm')
  const p = id ? state.ws.people.find((x) => x.id === id) : null
  if (id && !p) return
  editing = { kind: 'person', id: p ? p.id : '' }
  form.reset()
  clearErrors(form)
  $('#personDialogTitle').textContent = p ? 'Edit person' : 'Add person'
  const f = form.elements
  f.name.value = p ? p.name : ''
  f.title.value = (p && p.title) || ''
  f.email.value = (p && p.email) || ''
  f.tz.value = (p && p.tz) || ''
  f.country.value = (p && p.country) || ''
  f.location.value = (p && p.location) || ''
  f.start.value = p && p.hours ? timeValue(p.hours[0]) : ''
  f.end.value = p && p.hours ? timeValue(p.hours[1]) : ''
  f.load.value = p && typeof p.load === 'number' ? String(p.load) : ''
  for (const box of $$('input[name="d"]', form)) box.checked = !!(p && p.days && p.days.includes(box.value))
  paint(f.manager, peopleOptions((p && p.manager) || '', { exclude: p ? p.id : '' }))
  f.tags.value = p && p.tags ? p.tags.join(', ') : ''
  setColor(form, p)
  paint($('#personFace'), face(p || { name: '' }, { size: 'lg' }))
  $('[data-act="person-remove"]', form).hidden = !p
  show($('#personDialog'))
}

/** Reads the person form. Returns the person, or null after marking each bad field. */
function readPerson(form) {
  clearErrors(form)
  const f = form.elements
  let ok = true
  const bad = (id, msg) => { err(form, id, msg); ok = false }
  const name = str(f.name.value, 120)
  if (!visible(name)) bad('pf-name', 'A name is needed.')
  const out = { name }
  if (editing.id) out.id = editing.id
  for (const k of ['title', 'location']) { const v = str(f[k].value, 120); if (v) out[k] = v }
  const mail = f.email.value.trim()
  if (mail) {
    const e = email(mail)
    if (!e) bad('pf-email', 'That is not an email address.')
    else {
      const other = state.ws.people.find((x) => x.email === e && x.id !== editing.id)
      if (other) bad('pf-email', `${other.name} already has this address.`)
      else out.email = e
    }
  }
  if (f.tz.value.trim()) { const z = zone(f.tz.value.trim()); if (z) out.tz = z; else bad('pf-tz', 'Pick a zone from the list, or an offset like +2 or -3:30.') }
  if (f.country.value.trim()) { const c = country(f.country.value.trim()); if (c) out.country = c; else bad('pf-country', 'Two letters, like CL or DE.') }
  const a = minutesOf(f.start.value), b = minutesOf(f.end.value)
  if (f.start.value || f.end.value) {
    const end = b === 1439 ? 1440 : b
    if (a === null || end === null || a >= end) bad('pf-hours', 'Both times, and the start before the end.')
    else out.hours = [a, end]
  }
  const days = $$('input[name="d"]:checked', form).map((x) => x.value).join('')
  if (days) out.days = days
  if (f.load.value !== '') {
    const n = Number(f.load.value)
    if (!Number.isFinite(n) || n < 0 || n > 100) bad('pf-load', 'From 0 to 100.')
    else out.load = n
  }
  if (f.manager.value) out.manager = f.manager.value
  const tags = f.tags.value.split(',').map((t) => str(t, 40)).filter(Boolean)
  if (tags.length) out.tags = [...new Set(tags)].slice(0, 20)
  if (f.ownColor.checked) { const c = color(f.color.value); if (c) out.color = c }
  const before = editing.id ? state.ws.people.find((x) => x.id === editing.id) : null
  if (before && before.avatar) out.avatar = before.avatar   // not editable here; kept as it came
  return ok ? out : null
}

/** true saved, false the browser would not keep it, null a field needs fixing. */
export function savePerson() {
  const form = $('#personForm')
  const person = readPerson(form)
  if (!person) { const first = form.querySelector('[aria-invalid="true"]'); if (first) first.focus(); return null }
  const ws = structuredClone(state.ws)
  if (editing.id) ws.people = ws.people.map((p) => (p.id === editing.id ? person : p))
  else ws.people.push(person)
  return commit(ws)
}

export async function removePerson() {
  const p = state.ws.people.find((x) => x.id === editing.id)
  if (!p) return false
  const teams = state.ws.teams.filter((t) => t.members.some((m) => m.person === p.id))
  const yes = await confirm({
    title: `Remove ${p.name}?`,
    body: `${p.name} leaves this browser's workspace${teams.length ? ` and ${plural(teams.length, 'team')} (${teams.map((t) => t.name).join(', ')})` : ''}. Tools keep the copies they already have.`,
    ok: 'Remove',
  })
  if (!yes) return false
  const ws = structuredClone(state.ws)
  ws.people = ws.people.filter((x) => x.id !== p.id)
  return commit(ws)
}

// ── Teams ────────────────────────────────────────────────────
let picked = new Map()   // person id -> pct, while the team dialog is open

export function openTeam(id = '') {
  const form = $('#teamForm')
  const t = id ? state.ws.teams.find((x) => x.id === id) : null
  if (id && !t) return
  editing = { kind: 'team', id: t ? t.id : '' }
  form.reset()
  clearErrors(form)
  $('#teamDialogTitle').textContent = t ? 'Edit team' : 'New team'
  form.elements.name.value = t ? t.name : ''
  paint(form.elements.lead, peopleOptions((t && t.lead) || ''))
  setColor(form, t)
  picked = new Map(t ? t.members.map((m) => [m.person, m.pct]) : [])
  $('#memberSearch').value = ''
  renderMembers()
  paint($('#teamFace'), face(t || { name: '' }, { size: 'lg' }))
  $('[data-act="team-remove"]', form).hidden = !t
  show($('#teamDialog'))
}

/** The member list: members first, then everyone else, filtered by the search box. */
export function renderMembers() {
  const q = foldName($('#memberSearch').value)
  const all = state.ws.people
  const order = [...all.filter((p) => picked.has(p.id)), ...all.filter((p) => !picked.has(p.id))]
  const list = q ? order.filter((p) => foldName(p.name + ' ' + (p.title || '')).includes(q)) : order
  $('#memberCount').textContent = `${picked.size} of ${all.length}`
  if (!all.length) { paint($('#memberPick'), html`<li class="ws-help">Add people first; a team is made of them.</li>`); return }
  paint($('#memberPick'), list.map((p) => {
    const on = picked.has(p.id)
    return html`<li class="ws-member${on ? ' is-on' : ''}">
      <label class="ws-check"><input type="checkbox" data-member="${p.id}"${on ? ' checked' : ''}>${face(p, { size: 'sm', title: false })}<span>${p.name}</span></label>
      <label class="ws-pct"><input class="ws-input ws-input--pct" type="number" min="1" max="100" step="1" data-pct="${p.id}" value="${on ? picked.get(p.id) : 100}"${on ? '' : ' disabled'} aria-label="${p.name}'s share"><span aria-hidden="true">%</span></label>
    </li>`
  }))
}

/** Keeps `picked` in step with a checkbox or share input in the member list. */
export function memberInput(target) {
  if (target.dataset.member) {
    const id = target.dataset.member
    if (target.checked) picked.set(id, 100); else picked.delete(id)
    const pct = target.closest('.ws-member').querySelector('[data-pct]')
    pct.disabled = !target.checked
    target.closest('.ws-member').classList.toggle('is-on', target.checked)
    $('#memberCount').textContent = `${picked.size} of ${state.ws.people.length}`
  } else if (target.dataset.pct && picked.has(target.dataset.pct)) {
    const n = Math.round(Number(target.value))
    picked.set(target.dataset.pct, Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 100)
  }
}

export function saveTeam() {
  const form = $('#teamForm')
  clearErrors(form)
  const name = str(form.elements.name.value, 120)
  if (!visible(name)) { err(form, 'tf-name', 'A name is needed.'); form.elements.name.focus(); return null }
  const clash = state.ws.teams.find((t) => t.id !== editing.id && foldName(t.name) === foldName(name))
  if (clash) { err(form, 'tf-name', 'Another team has this name.'); form.elements.name.focus(); return null }
  const team = { name, members: [...picked].map(([person, pct]) => ({ person, pct })) }
  if (editing.id) team.id = editing.id
  if (form.elements.lead.value) team.lead = form.elements.lead.value
  if (form.elements.ownColor.checked) { const c = color(form.elements.color.value); if (c) team.color = c }
  const ws = structuredClone(state.ws)
  if (editing.id) ws.teams = ws.teams.map((t) => (t.id === editing.id ? team : t))
  else ws.teams.push(team)
  return commit(ws)
}

export async function removeTeam() {
  const t = state.ws.teams.find((x) => x.id === editing.id)
  if (!t) return false
  const yes = await confirm({ title: `Delete ${t.name}?`, body: 'The team goes; its people stay in your workspace.', ok: 'Delete team' })
  if (!yes) return false
  const ws = structuredClone(state.ws)
  ws.teams = ws.teams.filter((x) => x.id !== t.id)
  return commit(ws)
}

// ── Confirm ──────────────────────────────────────────────────
/** A native modal question; resolves true only on the confirm button. */
export function confirm({ title, body, ok = 'Confirm' }) {
  const dialog = $('#confirmDialog')
  $('#confirmTitle').textContent = title
  $('#confirmBody').textContent = body
  $('#confirmOk').textContent = ok
  const back = document.activeElement
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ok')
      if (back && back.isConnected) back.focus()
    }, { once: true })
    dialog.returnValue = ''
    dialog.showModal()
    dialog.querySelector('button[value="cancel"]').focus()
  })
}
