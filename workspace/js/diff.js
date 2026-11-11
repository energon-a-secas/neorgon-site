/**
 * Workspace page: what a save would change, drawn from previewMerge's report.
 * Three groups for people (added, updated, unchanged) and the same for teams;
 * an update lists each field it changes, from the stored value to the new one.
 */
import { prefs } from './store.js'
import { html, plural, face, clock, dayList, byId } from './util.js'

const LABELS = {
  name: 'Name', title: 'Title', email: 'Email', tz: 'Time zone', country: 'Country', location: 'Location',
  hours: 'Working hours', days: 'Work days', load: 'Plannable time', manager: 'Manager', tags: 'Tags',
  color: 'Colour', avatar: 'Avatar', lead: 'Lead', members: 'Members',
}
const label = (k) => LABELS[k] || k

function value(k, v, people, cycle) {
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return html`<span class="ws-none">none</span>`
  switch (k) {
    case 'hours': return `${clock(v[0], cycle)} to ${clock(v[1], cycle)}`
    case 'days': return dayList(v)
    case 'load': return `${v}%`
    case 'manager': case 'lead': { const p = people.get(v); return p ? p.name : v }
    case 'tags': return v.join(', ')
    case 'tz': return v.replace(/_/g, ' ')
    case 'color': return html`<span class="ws-swatch" style="--sw:${v}" aria-hidden="true"></span>${v}`
    case 'avatar': return 'a Pixeldoll'
    case 'members': return plural(v.length, 'member')
    default: return String(v)
  }
}

function changes(before, after, fields, peopleBefore, peopleAfter, cycle) {
  return html`<dl class="ws-changes">${fields.map((k) => html`<div class="ws-change">
    <dt>${label(k)}</dt>
    <dd><span class="ws-old">${value(k, before && before[k], peopleBefore, cycle)}</span><span class="ws-arrow" aria-label="becomes">&rarr;</span><span class="ws-new">${value(k, after && after[k], peopleAfter, cycle)}</span></dd>
  </div>`)}</dl>`
}

const sub = (p) => [p.title, p.email].filter(Boolean).join(' · ')

function group(kind, title, count, body, { open = true } = {}) {
  if (!count) return ''
  return html`<details class="ws-diff-group ws-diff--${kind}"${open ? ' open' : ''}>
    <summary><span class="ws-diff-dot" aria-hidden="true"></span><span class="ws-diff-kind">${title}</span><span class="ws-count">${count}</span></summary>
    ${body}
  </details>`
}

/** The whole diff for a preview against the workspace it was made from. */
export function renderDiff(before, preview) {
  const cycle = prefs().all.c
  const pb = byId(before.people), pa = byId(preview.next.people)
  const tb = byId(before.teams), ta = byId(preview.next.teams)
  const added = preview.added.map((id) => pa.get(id)).filter(Boolean)
  const unchanged = preview.unchanged.map((id) => pa.get(id)).filter(Boolean)
  const teamsAdded = preview.teams.added.map((id) => ta.get(id)).filter(Boolean)

  const people = html`
    ${group('added', 'Added', added.length, html`<ul class="ws-diff-list">${added.map((p) => html`<li class="ws-diff-row">${face(p)}<span class="ws-diff-who"><strong>${p.name}</strong><span>${sub(p)}</span></span></li>`)}</ul>`)}
    ${group('updated', 'Updated', preview.updated.length, html`<ul class="ws-diff-list">${preview.updated.map((u) => {
      const was = pb.get(u.id), now = pa.get(u.id)
      if (!now) return ''
      return html`<li class="ws-diff-row ws-diff-row--stack"><span class="ws-diff-line">${face(now)}<span class="ws-diff-who"><strong>${now.name}</strong><span>${sub(now)}</span></span></span>${changes(was, now, u.fields, pb, pa, cycle)}</li>`
    })}</ul>`)}
    ${group('unchanged', 'Already here, unchanged', unchanged.length, html`<ul class="ws-chips">${unchanged.map((p) => html`<li class="ws-chip">${face(p, { title: false })}<span class="ws-chip-name">${p.name}</span></li>`)}</ul>`, { open: unchanged.length <= 12 })}`

  const t = preview.teams
  const teamCount = t.added.length + t.updated.length + t.unchanged.length
  const teams = !teamCount ? '' : html`<h3 class="ws-flow-sub">Teams</h3>
    ${group('added', 'New teams', teamsAdded.length, html`<ul class="ws-diff-list">${teamsAdded.map((x) => html`<li class="ws-diff-row">${face(x)}<span class="ws-diff-who"><strong>${x.name}</strong><span>${plural(x.members.length, 'member')}</span></span></li>`)}</ul>`)}
    ${group('updated', 'Updated teams', t.updated.length, html`<ul class="ws-diff-list">${t.updated.map((u) => {
      const was = tb.get(u.id), now = ta.get(u.id)
      if (!now) return ''
      return html`<li class="ws-diff-row ws-diff-row--stack"><span class="ws-diff-line">${face(now)}<span class="ws-diff-who"><strong>${now.name}</strong><span>${plural(now.members.length, 'member')}</span></span></span>${changes(was, now, u.fields, pb, pa, cycle)}</li>`
    })}</ul>`)}
    ${group('unchanged', 'Teams unchanged', t.unchanged.length, html`<ul class="ws-chips">${t.unchanged.map((id) => ta.get(id)).filter(Boolean).map((x) => html`<li class="ws-chip">${face(x, { title: false })}<span class="ws-chip-name">${x.name}</span></li>`)}</ul>`)}`

  return html`<div class="ws-diff">${people}${teams}</div>`
}

/** "Rama wants to add 9 people and update 3, into the team Payments." */
export function headline(who, preview, incomingTeams) {
  const a = preview.added.length, u = preview.updated.length
  const ta = preview.teams.added.length, tu = preview.teams.updated.length
  if (!a && !u && !ta && !tu) return `Everything ${who} sent is already in your workspace.`
  const verbs = []
  if (a) verbs.push(`add ${plural(a, 'person', 'people')}`)
  if (u) verbs.push(`update ${a ? u : plural(u, 'person', 'people')}`)
  let s = `${who} wants to ${verbs.join(' and ') || 'change your teams'}`
  if (incomingTeams.length === 1) s += `${verbs.length ? ',' : ''} into the team ${incomingTeams[0]}`
  else if (incomingTeams.length > 1) s += `${verbs.length ? ',' : ''} across ${plural(incomingTeams.length, 'team')}`
  return s + '.'
}

/** Issues, quoted as the kit wrote them (escaped by html``), behind a disclosure. */
export function issueList(issues) {
  if (!issues || !issues.length) return ''
  return html`<details class="ws-issues"><summary>${plural(issues.length, 'note')} about what was sent</summary>
    <ul>${issues.map((i) => html`<li class="ws-issue ws-issue--${i.level === 'error' ? 'error' : 'warn'}">${i.msg}</li>`)}</ul></details>`
}
