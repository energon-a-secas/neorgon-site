/**
 * Workspace page: the editor. The team is the hero (one card a team, every
 * member as a chip in their colour), people are a dense list beside your
 * settings. Pure rendering from `state`; events.js wires the controls.
 */
import { foldName, toolName, colorFor } from '../../js/neorgon-workspace-core.js'
import { state, prefs } from './store.js'
import { html, paint, $, $$, plural, face, clock, dayList, when, byId, timeValue } from './util.js'

const MAX_CHIPS = 14

export function renderEditor() {
  renderHero()
  renderPeople()
  renderMe()
  renderPrefs()
}

function heroMeta(ws) {
  const parts = [plural(ws.people.length, 'person', 'people'), plural(ws.teams.length, 'team')]
  const saved = when(ws.updated)
  const by = toolName(ws.source && ws.source.tool)
  if (saved) parts.push(by ? `last saved from ${by}, ${saved}` : `last changed ${saved}`)
  return parts.join(' · ')
}

function memberChips(team, people) {
  const shown = team.members.slice(0, MAX_CHIPS)
  const more = team.members.length - shown.length
  return html`<ul class="ws-chips" aria-label="${team.name} members">${shown.map((m) => {
    const p = people.get(m.person)
    if (!p) return ''
    const lead = team.lead === p.id
    return html`<li class="ws-chip${lead ? ' ws-chip--lead' : ''}" title="${p.name}${p.title ? ', ' + p.title : ''}${m.pct < 100 ? ` (${m.pct}%)` : ''}">${face(p, { title: false })}<span class="ws-chip-name">${p.name}</span>${m.pct < 100 ? html`<span class="ws-chip-pct">${m.pct}%</span>` : ''}${lead ? html`<span class="ws-visually-hidden">, lead</span>` : ''}</li>`
  })}${more > 0 ? html`<li class="ws-chip ws-chip--more">+${more}</li>` : ''}</ul>`
}

function renderHero() {
  const { ws } = state
  const people = byId(ws.people)
  const me = ws.me && ws.me.person ? people.get(ws.me.person) : null
  $('#heroMeta').textContent = heroMeta(ws)
  $('#heroTitle').textContent = ws.teams.length === 1 ? ws.teams[0].name : ws.teams.length ? 'Your teams' : 'Your team'
  const box = $('#wsTeams')
  if (!ws.teams.length) {
    paint(box, html`<div class="ws-empty">
      <p class="ws-empty-title">${ws.people.length ? 'Group your people into a team' : 'Nobody here yet'}</p>
      <p class="ws-help">${ws.people.length
        ? 'A team is who the planning tools offer you first: Floorplan seats it, Reparto plans its leave, Loadout spreads its work.'
        : 'Save your team from Rama or another planning tool, import a file, or add people by hand. They stay in this browser.'}</p>
      <div class="ws-inline">${ws.people.length
        ? html`<button type="button" class="ws-btn ws-btn--primary" data-act="team-new">New team</button>`
        : html`<button type="button" class="ws-btn ws-btn--primary" data-act="person-new">Add person</button><button type="button" class="ws-btn" data-act="import">Import a file</button>`}</div>
    </div>`)
    return
  }
  paint(box, ws.teams.map((t) => {
    const lead = t.lead ? people.get(t.lead) : null
    const mine = me && t.members.some((m) => m.person === me.id)
    return html`<article class="ws-team" style="--team:${colorFor(t)}">
      <header class="ws-team-head">
        ${face(t, { size: 'sm' })}
        <div class="ws-team-title">
          <h3>${t.name}${mine ? html` <span class="ws-tag">yours</span>` : ''}</h3>
          <p>${plural(t.members.length, 'member')}${lead ? html` · led by ${lead.name}` : ''}</p>
        </div>
        <button type="button" class="ws-btn ws-btn--quiet" data-act="team-edit" data-id="${t.id}" aria-label="Edit ${t.name}">Edit</button>
      </header>
      ${t.members.length ? memberChips(t, people) : html`<p class="ws-help">No members yet.</p>`}
    </article>`
  }))
}

function personLine(p, prefsAll) {
  const bits = []
  if (p.tz) bits.push(p.tz.replace(/_/g, ' '))
  if (p.country) bits.push(p.country)
  if (p.hours) bits.push(`${clock(p.hours[0], prefsAll.c)} to ${clock(p.hours[1], prefsAll.c)}`)
  if (p.days && p.days !== '12345') bits.push(dayList(p.days))
  if (typeof p.load === 'number' && p.load !== 100) bits.push(`${p.load}% plannable`)
  return bits.join(' · ')
}

function renderPeople() {
  const { ws } = state
  const q = foldName(state.filter)
  const people = byId(ws.people)
  const teamsOf = new Map()
  for (const t of ws.teams) for (const m of t.members) teamsOf.set(m.person, [...(teamsOf.get(m.person) || []), t.name])
  const list = q ? ws.people.filter((p) => foldName([p.name, p.title, p.email, p.location, ...(p.tags || [])].filter(Boolean).join(' ')).includes(q)) : ws.people
  $('#peopleCount').textContent = q ? `${list.length} of ${ws.people.length}` : String(ws.people.length)
  const { all } = prefs()
  if (!list.length) {
    paint($('#peopleList'), html`<li class="ws-people-empty">${ws.people.length ? 'Nobody matches that.' : 'No people yet.'}</li>`)
    return
  }
  paint($('#peopleList'), list.map((p) => {
    const mgr = p.manager ? people.get(p.manager) : null
    const isMe = ws.me && ws.me.person === p.id
    const line = personLine(p, all)
    const teams = teamsOf.get(p.id) || []
    return html`<li class="ws-person">
      <button type="button" class="ws-person-open" data-act="person-edit" data-id="${p.id}">
        ${face(p, { title: false })}
        <span class="ws-person-main">
          <span class="ws-person-name">${p.name}${isMe ? html` <span class="ws-tag">you</span>` : ''}</span>
          <span class="ws-person-sub">${[p.title, mgr ? `reports to ${mgr.name}` : '', p.email].filter(Boolean).join(' · ')}</span>
        </span>
        <span class="ws-person-meta">
          ${line ? html`<span>${line}</span>` : ''}
          ${teams.length ? html`<span class="ws-person-teams">${teams.join(', ')}</span>` : ''}
        </span>
      </button>
    </li>`
  }))
}

/** A <select>'s options: "Nobody" plus every person, the current one selected. */
export function peopleOptions(selected, { none = 'Nobody', exclude = '' } = {}) {
  return html`<option value="">${none}</option>${state.ws.people.filter((p) => p.id !== exclude).map((p) =>
    html`<option value="${p.id}"${p.id === selected ? ' selected' : ''}>${p.name}${p.title ? ` (${p.title})` : ''}</option>`)}`
}

function renderMe() {
  const me = state.ws.me && state.ws.me.person
  const sel = $('#meSelect')
  if (document.activeElement !== sel) paint(sel, peopleOptions(me || '', { none: 'Not set' }))
  sel.disabled = !state.ws.people.length
  const p = me ? state.ws.people.find((x) => x.id === me) : null
  paint($('#meFace'), p ? face(p) : html`<span class="ws-face ws-face--empty" aria-hidden="true">?</span>`)
}

/** Fills the settings form from neo_me (or the device), unless the visitor is typing in it. */
export function renderPrefs({ force = false } = {}) {
  const form = $('#prefsForm')
  if (!force && form.contains(document.activeElement)) return
  const { mine, all } = prefs()
  form.elements.tz.value = all.tz
  form.elements.start.value = timeValue(all.h[0])
  form.elements.end.value = timeValue(all.h[1])
  for (const box of $$('input[name="d"]', form)) box.checked = all.d.includes(box.value)
  form.elements.w.value = String(all.w)
  form.elements.c.value = all.c
  form.elements.cc.value = all.cc
  form.dataset.stored = Object.keys(mine).length ? 'yes' : 'no'
  $('#prefsSaved').textContent = Object.keys(mine).length ? '' : 'From this device'
}

/** The zone list for both zone fields, once. */
export function fillZones() {
  let zones = []
  try { zones = Intl.supportedValuesOf('timeZone') } catch { zones = [] }
  paint($('#zoneList'), zones.map((z) => html`<option value="${z}"></option>`))
}
