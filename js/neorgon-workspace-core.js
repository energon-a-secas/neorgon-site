/**
 * Neorgon Workspace Kit: core
 * Canonical source: packages/neorgon-ui/workspace/workspace-core.js
 * Vendored as js/neorgon-workspace-core.js by packages/neorgon-ui/sync-workspace.sh
 *
 * The one module a tool, the Workspace page and the frame import. Pure: no
 * DOM, no storage, no network, so Node tests all of it
 * (packages/neorgon-ui/tests/workspace-*.test.mjs).
 *
 *   normalizeWorkspace(raw) -> { ws, issues }   the gate in front of every value
 *   previewMerge(ws, incoming) / previewPayload(ws, text)   what a save would do
 *   decodePayload(text), readFrameMessage(data, { id })      a link, the frame
 *
 * Everything in workspace-codec.js (values, settings, clocks, faces, cookies,
 * stamps) and workspace-wire.js (tools, origins, links, fragments, the frame
 * protocol, with workspace-inflate.js) is re-exported from here. The contract is docs/plans/2026-11-03-neorgon-workspace.md;
 * the README says how to use it. Issue messages quote what they reject:
 * escape them like any other value.
 *
 * Do not edit a vendored copy. Edit here and run sync-workspace.sh.
 */
import {
  str, visible, slug, foldName, isId, email, country, color, avatar, hours, days, zone, isoTime, isStamp, isMap, own, hashString,
} from './neorgon-workspace-codec.js'
import { unpackPayload, PROTOCOL, FRAME_STATUSES, ADOPTERS } from './neorgon-workspace-wire.js'

export * from './neorgon-workspace-codec.js'
export * from './neorgon-workspace-wire.js'

export const SCHEMA_VERSION = 1
export const LIMITS = Object.freeze({ people: 500, teams: 100, members: 500, tags: 20, issues: 100 })

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`
const show = (v) => (typeof v === 'string' || typeof v === 'number' ? `"${str(v, 60)}"` : `(a ${Array.isArray(v) ? 'list' : typeof v})`)
const given = (v) => v !== undefined && v !== null && v !== ''
/** The tools a workspace may name as its last save's source: the adopters, nothing else. */
const isTool = (v) => isId(v) && ADOPTERS.includes(v)
/** Folded name to id, or '?' when more than one person carries it. */
const nameIndex = (people) => { const m = new Map(); for (const p of people) { const f = foldName(p.name); if (f) m.set(f, m.has(f) ? '?' : p.id) } return m }
/** Text a slug keeps whole (ASCII), so "P_1" may name the person whose id was "P_1" but "Kevin 李明" never names "kevin". */
const ASCII = /^[\x20-\x7e]*$/
const load = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 ? v + 0 : null)

export const emptyWorkspace = () => ({ v: SCHEMA_VERSION, updated: '', source: {}, me: {}, people: [], teams: [] })

// ── Schema v1 ────────────────────────────────────────────────
/**
 * Any value to a valid workspace, and what was wrong with it. Never throws.
 * Fields are present only when known; ids are unique slugs (the ids a value
 * carried are claimed before the ones made from names); every manager, lead,
 * member and me.person names a person in this workspace; an email belongs to
 * one person; reporting loops are cut. Caps (LIMITS): past one, the first N
 * are kept and an issue says so.
 */
export const normalizeWorkspace = (raw) => normalize(raw, null)

/** `ext` is the merge's view: { stored: Set of stored ids, explicit: Set } (see previewMerge). */
function normalize(raw, ext) {
  const issues = []
  let hidden = 0
  const say = (level) => (msg) => { if (issues.length < LIMITS.issues) issues.push({ level, msg }); else hidden++ }
  const ctx = { warn: say('warn'), error: say('error') }
  let ws = emptyWorkspace()
  try {
    if (isMap(raw)) ws = build(raw, ctx, ext)
    else ctx.error('A workspace is a map with people and teams')
  } catch { ws = emptyWorkspace(); ctx.error('The workspace could not be read') }
  if (hidden) issues.push({ level: 'warn', msg: `${plural(hidden, 'more issue')} not shown` })
  return { ws, issues }
}

function build(raw, ctx, ext) {
  const ws = emptyWorkspace()
  const v = own(raw, 'v')
  if (typeof v === 'number' && v > SCHEMA_VERSION) ctx.warn(`Written for workspace schema ${str(v, 10)}; this page reads ${SCHEMA_VERSION}, so newer fields are left out`)
  ws.updated = isoTime(own(raw, 'updated'))
  const source = own(raw, 'source')
  if (isMap(source) && isTool(own(source, 'tool'))) {
    const at = isoTime(own(source, 'at'))
    ws.source = at ? { tool: own(source, 'tool'), at } : { tool: own(source, 'tool') }
  }

  const people = []
  each(own(raw, 'people'), LIMITS.people, 'people', ctx, (entry, i) => { const b = buildPerson(entry, i, ctx); if (b) people.push(b); return !!b })
  claimAll(people, 'people', ctx, ext)
  const owner = new Map()
  for (const { item: p } of people) {
    const mail = own(p, 'email')
    if (!mail) continue
    if (owner.has(mail)) { ctx.warn(`${p.name}: ${mail} is already ${owner.get(mail)}'s, so it was left out`); delete p.email } else owner.set(mail, p.name)
  }
  ws.people = people.map((b) => b.item)
  const ids = new Set(ws.people.map((p) => p.id)), names = nameIndex(ws.people)
  const stored = ext ? ext.stored : new Set(), storedNames = ext ? ext.names : new Map()
  // A reference (manager, lead, member, me) is an id, else a name one person carries, else (ASCII text only)
  // what its slug is; this side first, then, in a merge, the stored side, whose people come back as '@' + id.
  // '?' is a name more than one person carries: it names nobody.
  const ref = (value) => {
    if (typeof value !== 'string' && typeof value !== 'number') return ''
    const text = str(value, 480), f = foldName(text)
    if (ids.has(text)) return text
    if (stored.has(text)) return '@' + text
    if (names.has(f)) return names.get(f)
    if (storedNames.has(f)) return storedNames.get(f) === '?' ? '?' : '@' + storedNames.get(f)
    const r = ASCII.test(text) ? slug(text) : ''
    return !r ? '' : ids.has(r) ? r : stored.has(r) ? '@' + r : ''
  }
  const why = (id) => (id === '?' ? 'names more than one person' : 'is not in people')
  for (const { item: p, manager } of people) {
    if (!given(manager)) continue
    const id = ref(manager)
    if (!id || id === '?') ctx.warn(`${p.name}: manager ${show(manager)} ${why(id)}`)
    else if (id === p.id) ctx.warn(`${p.name} cannot manage themselves`)
    else p.manager = id
  }
  breakCycles(ws.people, ctx)

  const me = own(raw, 'me')
  if (isMap(me)) {
    const person = own(me, 'person'), id = ref(person)
    if (id && id !== '?') ws.me = { person: id }
    else if (given(person)) ctx.warn(`me: ${show(person)} ${why(id)}`)
  }

  const teams = []
  each(own(raw, 'teams'), LIMITS.teams, 'teams', ctx, (entry, i) => { const b = buildTeam(entry, i, ref, why, ctx); if (b) teams.push(b); return !!b })
  claimAll(teams, 'teams', ctx, ext)
  ws.teams = teams.map((b) => b.item)
  return ws
}

/** Walks a list, keeping up to `cap` entries `fn` accepts and reading at most twice that many. */
function each(list, cap, noun, ctx, fn, who = '') {
  if (list == null || list === '') return
  const lead = who ? `${who}: ` : ''
  if (!Array.isArray(list)) { ctx.error(`${lead}${noun} should be a list`); return }
  let kept = 0, i = 0
  for (const end = Math.min(list.length, cap * 2); i < end && kept < cap; i++) if (fn(list[i], i)) kept++
  if (i >= list.length) return
  const rest = list.length - i
  if (kept >= cap) ctx.warn(`${lead}${who ? 'the' : 'The'} limit is ${cap} ${noun}; ${rest} more were left out`)
  else ctx.warn(`${lead}${who ? 'only' : 'Only'} the first ${i} entries of ${noun} were read; ${rest} more were left out`)
}

/** Hands out unique ids: a repeat becomes id-2, id-3, still at most 48 characters. */
function claimer(initial = []) {
  const taken = new Set(initial), next = new Map()
  return (id) => {
    if (!taken.has(id)) { taken.add(id); return id }
    let n = next.get(id) || 2, out
    do { const tail = `-${n++}`; out = id.slice(0, 48 - tail.length).replace(/-+$/, '') + tail } while (taken.has(out))
    next.set(id, n); taken.add(out)
    return out
  }
}

/**
 * Ids in three passes: each id a value carried, the first time; then its
 * repeats (id-2, with an issue); then the ones made from names, which never
 * push a carried id aside and need no issue. In a merge, an entry that kept
 * the id it carried is recorded as explicit: only those take part in the id pass.
 */
function claimAll(list, kind, ctx, ext) {
  const claim = claimer()
  const firsts = new Set()
  for (const b of list) if (b.explicit && !firsts.has(b.id)) { firsts.add(b.id); b.item.id = claim(b.id); b.done = true; if (ext) ext.explicit.add(b.item) }
  for (const b of list) {
    if (!b.explicit || b.done) continue
    b.item.id = claim(b.id)
    ctx.warn(`Two ${kind} share the id "${b.id}"; ${b.item.name} is now "${b.item.id}"`)
  }
  for (const b of list) if (!b.explicit) b.item.id = claim(b.id)
}

/** Sets p[key] from e[key] through a validator, or says why it was left out. */
function check(p, e, key, clean, ctx, who, why) {
  const v = own(e, key)
  if (!given(v)) return
  const out = clean(v)
  if (out === '' || out === null) ctx.warn(`${who}: ${key} ${show(v)} ${why}`)
  else p[key] = out
}

function buildPerson(e, i, ctx) {
  if (!isMap(e)) { ctx.error(`people[${i}] is not a person`); return null }
  const name = str(own(e, 'name'), 120)
  if (!visible(name)) { ctx.error(`people[${i}] has no name`); return null }
  const carried = slug(own(e, 'id'))
  const p = { id: '', name }
  const text = (key) => { const s = str(own(e, key), 120); if (visible(s)) p[key] = s }
  text('title')
  check(p, e, 'email', email, ctx, name, 'is not one email address')
  check(p, e, 'tz', zone, ctx, name, 'is not a time zone: use an IANA name (America/Santiago) or an offset (+2, -3:30)')
  check(p, e, 'country', country, ctx, name, 'is not an ISO country code (CL, US, DE)')
  text('location')
  check(p, e, 'hours', hours, ctx, name, 'should be [start, end] in minutes from 0 to 1440, start first')
  check(p, e, 'days', days, ctx, name, 'should be ISO weekday digits, like 12345')
  check(p, e, 'load', load, ctx, name, 'should be a number from 0 to 100')
  const tags = tagList(own(e, 'tags'), ctx, name)
  if (tags.length) p.tags = tags
  check(p, e, 'color', color, ctx, name, 'should be a colour like #3b82f6')
  check(p, e, 'avatar', avatar, ctx, name, 'should be a Pixeldoll code (neoav1:...) of at most 400 characters')
  // A name with no Latin letters still gets a stable id from its own text, never its position.
  return { item: p, id: carried || slug(name) || `p-${hashString(name).toString(36)}`, explicit: !!carried, manager: own(e, 'manager') }
}

function tagList(v, ctx, who) {
  if (!given(v)) return []
  if (!Array.isArray(v)) { ctx.warn(`${who}: tags should be a list`); return [] }
  const seen = new Set(), out = []
  for (const t of v.slice(0, LIMITS.tags * 4)) {
    const s = str(t, 40)
    if (visible(s) && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s) }
  }
  if (out.length > LIMITS.tags || v.length > LIMITS.tags * 4) ctx.warn(`${who}: only the first ${LIMITS.tags} tags are kept`)
  return out.slice(0, LIMITS.tags)
}

/** The first reporting loop found, as the ids around it, or null. */
function findLoop(people, byId) {
  const done = new Set()
  for (const start of people) {
    const path = [], on = new Set()
    for (let p = start; p && !done.has(p.id); p = own(p, 'manager') ? byId.get(own(p, 'manager')) : null) {
      if (on.has(p.id)) return path.slice(path.indexOf(p.id))
      on.add(p.id); path.push(p.id)
    }
    for (const id of path) done.add(id)
  }
  return null
}

/** A reporting line that loops back is cut where the walk first meets it again (Rama's rule). */
function breakCycles(people, ctx) {
  const byId = new Map(people.map((p) => [p.id, p]))
  for (let loop = findLoop(people, byId); loop; loop = findLoop(people, byId)) {
    const p = byId.get(loop[0])
    ctx.warn(`Reporting loop through ${p.name}; their manager line was cut`)
    delete p.manager
  }
}

function buildTeam(t, i, ref, why, ctx) {
  if (!isMap(t)) { ctx.error(`teams[${i}] is not a team`); return null }
  const name = str(own(t, 'name'), 120)
  if (!visible(name)) { ctx.error(`teams[${i}] has no name`); return null }
  const carried = slug(own(t, 'id'))
  const team = { id: '', name }
  check(team, t, 'color', color, ctx, name, 'should be a colour like #3b82f6')
  const leadValue = own(t, 'lead'), lead = ref(leadValue)
  if (lead && lead !== '?') team.lead = lead
  else if (given(leadValue)) ctx.warn(`${name}: lead ${show(leadValue)} ${why(lead)}`)
  team.members = []
  const seen = new Set()
  let unknown = 0, shared = 0, twice = 0, adjusted = 0
  each(own(t, 'members'), LIMITS.members, 'members', ctx, (m) => {
    const r = ref(isMap(m) ? own(m, 'person') : m)
    if (!r) { unknown++; return false }
    if (r === '?') { shared++; return false }
    if (seen.has(r)) { twice++; return false }
    seen.add(r)
    let pct = isMap(m) ? own(m, 'pct') : undefined
    if (pct == null) pct = 100
    else if (typeof pct !== 'number' || !Number.isFinite(pct)) { adjusted++; pct = 100 }
    else { const n = Math.min(100, Math.max(1, Math.round(pct))); if (n !== pct) adjusted++; pct = n }
    team.members.push({ person: r, pct })
    return true
  }, name)
  if (unknown) ctx.warn(`${name}: ${plural(unknown, 'member')} not in people left out`)
  if (shared) ctx.warn(`${name}: ${plural(shared, 'member')} named by a name more than one person carries left out; use their ids`)
  if (twice) ctx.warn(`${name}: ${plural(twice, 'member')} listed twice; the first entry is kept`)
  if (adjusted) ctx.warn(`${name}: ${plural(adjusted, 'share')} set to a whole number from 1 to 100`)
  return { item: team, id: carried || slug(name) || `t-${hashString(name).toString(36)}`, explicit: !!carried }
}

// ── Merge ────────────────────────────────────────────────────
const PERSON_KEYS = ['name', 'title', 'email', 'tz', 'country', 'location', 'hours', 'days', 'load', 'manager', 'tags', 'color', 'avatar']
const TEAM_KEYS = ['name', 'color', 'lead', 'members']
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** Pairs each incoming entry with at most one existing one (-1 when none), one key at a time. A key two entries share on either side matches nothing. */
function matcher(existing, incoming) {
  const matchOf = incoming.map(() => -1), used = new Set()
  return (keyOld, keyNew = keyOld, agree = () => true) => {
    const index = new Map(), count = new Map()
    existing.forEach((x, i) => { const k = keyOld(x); if (k) index.set(k, index.has(k) ? -1 : i) })
    incoming.forEach((x) => { const k = keyNew(x); if (k) count.set(k, (count.get(k) || 0) + 1) })
    incoming.forEach((x, n) => {
      const k = keyNew(x), i = k ? index.get(k) : -1
      if (matchOf[n] < 0 && count.get(k) === 1 && i >= 0 && !used.has(i) && agree(existing[i], x)) { matchOf[n] = i; used.add(i) }
    })
    return matchOf
  }
}

/**
 * What saving `incoming` (any value: a payload's JSON, a file, a workspace)
 * into `ws` would do. Saving never deletes. A person matches by an id the
 * payload carried (refused when both emails are present and differ, unless the
 * same name confirms it: one person on each side carries it, or the new address
 * is nobody's yet), then by email, then by a folded name one person on each
 * side carries (never when both emails differ). An id made from a name is no
 * identity. A match takes every field the incoming person carries, except an
 * email someone else keeps. Newcomers are appended (a stored id becomes id-2)
 * while there is room; past the cap they are left out with every reference to
 * them. A payload may name stored people it does not carry. A loop the merge
 * makes is cut on the incoming line. Teams match by a carried id, then a
 * folded name; a non-empty incoming member list replaces the stored one.
 * added and unchanged are person ids; updated is [{ id, fields }]; teams has
 * the same three; issues are the payload's, the merge's and the result's.
 */
export function previewMerge(ws, incoming) {
  const before = normalizeWorkspace(ws).ws
  const ext = { stored: new Set(before.people.map((p) => p.id)), names: nameIndex(before.people), explicit: new Set() }
  const read = normalize(incoming, ext)
  const inc = read.ws
  const next = JSON.parse(JSON.stringify(before))
  const notes = []
  const note = (msg) => notes.push({ level: 'warn', msg })
  const carried = (x) => (ext.explicit.has(x) ? x.id : '')
  const fold = (x) => foldName(x.name)

  const match = matcher(next.people, inc.people)
  // A carried id is the person unless the emails differ and the name does not confirm it. The same name
  // confirms when one person on each side carries it, or when the new address is nobody's yet (an address
  // that moved). Then email, then a name. No other key: a stored id-2 is a person of its own (Rama makes
  // them for homonyms), never taken as someone's earlier copy.
  const mail = (x) => own(x, 'email')
  const count = (list) => { const c = new Map(); for (const x of list) c.set(fold(x), (c.get(fold(x)) || 0) + 1); return c }
  const names = [count(next.people), count(inc.people)]
  const storedMails = new Set(next.people.map(mail).filter(Boolean))
  const confirms = (a, b) => fold(a) === fold(b) && ((names[0].get(fold(a)) === 1 && names[1].get(fold(b)) === 1) || !storedMails.has(mail(b)))
  const agree = (a, b) => !mail(a) || !mail(b) || mail(a) === mail(b)
  match((p) => p.id, carried, (a, b) => agree(a, b) || confirms(a, b))
  match(mail)
  const matchOf = match(fold, fold, agree)

  const idMap = new Map()
  inc.people.forEach((p, n) => { if (matchOf[n] >= 0) idMap.set(p.id, next.people[matchOf[n]].id) })
  const fresh = inc.people.filter((p, n) => matchOf[n] < 0)
  const fits = fresh.slice(0, Math.max(0, LIMITS.people - next.people.length))
  if (fits.length < fresh.length) note(`The limit is ${LIMITS.people} people; ${plural(fresh.length - fits.length, 'more was', 'more were')} left out, with their places in teams and reporting lines`)
  // A newcomer whose id is free keeps it; one whose id is stored gets the next -2, -3 that neither side uses,
  // so it can never take an id another incoming person carries and be matched as them on the next save.
  const claim = claimer([...ext.stored, ...inc.people.map((p) => p.id)])
  for (const p of fits) idMap.set(p.id, ext.stored.has(p.id) ? claim(p.id) : p.id)
  const resolve = (ref) => (!ref ? '' : ref[0] === '@' ? ref.slice(1) : idMap.get(ref) || '')

  // Emails are settled before anything is applied, so the payload's order never decides: a stored person keeps
  // an address unless the payload gives them another that nobody keeps, and an address someone keeps stays theirs.
  const target = (n) => (matchOf[n] >= 0 ? next.people[matchOf[n]] : null)
  const moving = new Set(inc.people.map((p, n) => (target(n) && mail(p) && mail(p) !== mail(target(n)) ? target(n) : null)).filter(Boolean))
  const keeps = new Map()
  for (let grew = true; grew;) {
    grew = false
    keeps.clear()
    for (const q of next.people) if (mail(q) && !moving.has(q)) keeps.set(mail(q), q)
    inc.people.forEach((p, n) => { if (moving.has(target(n)) && keeps.has(mail(p))) { moving.delete(target(n)); grew = true } })
  }
  const lines = new Map(), added = []
  inc.people.forEach((p, n) => {
    const id = idMap.get(p.id)
    if (!id) return
    const isNew = matchOf[n] < 0
    const q = isNew ? { id, name: p.name } : next.people[matchOf[n]]
    for (const k of PERSON_KEYS) {
      const v = own(p, k)
      if (v === undefined || k === 'manager') continue
      const other = k === 'email' && keeps.get(v)
      if (other && other !== q) { note(`${p.name}: ${v} is already ${other.name}'s, so it was ${isNew ? 'left out' : 'not changed'}`); continue }
      q[k] = v
    }
    const m = resolve(own(p, 'manager')), was = own(q, 'manager')
    if (m && m !== id && m !== was) { lines.set(id, { was, order: n }); q.manager = m }
    if (isNew) { next.people.push(q); added.push(id) }
  })
  settle(next.people, lines, note)
  if (!own(before.me, 'person')) { const m = resolve(own(inc.me, 'person')); if (m) next.me = { person: m } }

  const matchTeam = matcher(next.teams, inc.teams)
  matchTeam((t) => t.id, carried)
  const teamOf = matchTeam(fold, fold)
  const storedTeams = new Set(next.teams.map((t) => t.id))
  const claimTeam = claimer([...storedTeams, ...inc.teams.map((t) => t.id)])
  const teamsAdded = []
  let room = LIMITS.teams - next.teams.length, lost = 0
  inc.teams.forEach((t, n) => {
    const isNew = teamOf[n] < 0
    if (isNew && room-- <= 0) { lost++; return }
    const members = [], seen = new Set()
    for (const m of t.members) { const person = resolve(m.person); if (person && !seen.has(person)) { seen.add(person); members.push({ person, pct: m.pct }) } }
    const q = isNew ? { id: storedTeams.has(t.id) ? claimTeam(t.id) : t.id, name: t.name, members } : next.teams[teamOf[n]]
    q.name = t.name
    if (own(t, 'color')) q.color = own(t, 'color')
    const lead = resolve(own(t, 'lead'))
    if (lead) q.lead = lead
    if (members.length) q.members = members
    if (isNew) { next.teams.push(q); teamsAdded.push(q.id) }
  })
  if (lost) note(`The limit is ${LIMITS.teams} teams; ${plural(lost, 'more was', 'more were')} left out`)

  const { ws: out, issues: after } = normalizeWorkspace(next)
  const people = report(before.people, out.people, matchOf, PERSON_KEYS)
  const teams = report(before.teams, out.teams, teamOf, TEAM_KEYS)
  const kept = (list, ids) => { const have = new Set(list.map((x) => x.id)); return ids.filter((id) => have.has(id)) }
  const issues = [...read.issues, ...notes, ...after]
  if (issues.length > LIMITS.issues) issues.splice(LIMITS.issues, Infinity, { level: 'warn', msg: `${plural(issues.length - LIMITS.issues, 'more issue')} not shown` })
  return {
    next: out,
    added: kept(out.people, added), updated: people.updated, unchanged: people.unchanged,
    teams: { added: kept(out.teams, teamsAdded), updated: teams.updated, unchanged: teams.unchanged },
    issues,
  }
}

/** Cuts each loop the merge made by putting back the stored line of the earliest incoming change in it, so the stored order never decides. */
function settle(people, lines, note) {
  const byId = new Map(people.map((p) => [p.id, p]))
  for (let loop = findLoop(people, byId); loop; loop = findLoop(people, byId)) {
    const mine = loop.filter((id) => lines.has(id))
    if (!mine.length) return // cannot happen: the stored lines had no loop; normalizing cuts it anyway
    const id = mine.reduce((a, b) => (lines.get(a).order <= lines.get(b).order ? a : b))
    const p = byId.get(id), { was } = lines.get(id)
    note(`${p.name}: reporting to ${byId.get(own(p, 'manager')).name} would make a loop, so the stored line was kept`)
    if (was) p.manager = was; else delete p.manager
    lines.delete(id)
  }
}

function report(before, after, matchOf, keys) {
  const now = new Map(after.map((x) => [x.id, x]))
  const matched = new Set(matchOf.filter((i) => i >= 0).map((i) => before[i].id))
  const updated = [], unchanged = []
  for (const x of before) {
    const y = now.get(x.id)
    const fields = y ? keys.filter((k) => !same(own(x, k), own(y, k))) : []
    if (fields.length) updated.push({ id: x.id, fields })
    else if (matched.has(x.id)) unchanged.push(x.id)
  }
  return { updated, unchanged }
}

/** The workspace as the Workspace page saves it: normalized, with updated and source set. */
export function markSaved(ws, tool, now = new Date()) {
  const out = normalizeWorkspace(ws).ws
  let at = ''
  try { at = isoTime(now.toISOString()) } catch { at = isoTime(new Date().toISOString()) }
  out.updated = at
  out.source = isTool(tool) ? { tool, at } : {}
  return out
}

// ── Payloads, stored copies, the frame ───────────────────────
/** A j1. or z1. payload to { ws, issues }, or null when it is not a workspace. For a link that stands alone (a pick's answer). */
export function decodePayload(text) {
  const raw = unpackPayload(text)
  return isMap(raw) ? normalizeWorkspace(raw) : null
}

/**
 * previewMerge for a save link's payload, or null when the text is not one.
 * Use this on the review screen, not decodePayload: a payload may name stored
 * people it does not carry, and only the merge can see them.
 */
export function previewPayload(ws, text) {
  const raw = unpackPayload(text)
  return isMap(raw) ? previewMerge(ws, raw) : null
}

/** What STORAGE_KEY and CACHE_KEY hold (the Persist Kit envelope's data): { stamp, ws }, checked, or null. */
export function normalizeRecord(data) {
  if (!isMap(data) || !isMap(own(data, 'ws'))) return null
  const stamp = own(data, 'stamp')
  const { ws, issues } = normalizeWorkspace(own(data, 'ws'))
  return { stamp: isStamp(stamp) ? stamp : '', ws, issues }
}

/**
 * A message from the frame, read by the client, or null when it is not one:
 * { kind: 'reply' | 'refused' | 'changed', status, stamp, ws, issues }. A reply
 * must carry the id the client sent; ws is normalized, or null (a ping, or
 * nothing stored). Check event.origin and event.source before calling.
 */
export function readFrameMessage(data, { id } = {}) {
  if (!isMap(data) || own(data, 'ns') !== PROTOCOL) return null
  const changed = own(data, 'op') === 'changed'
  if (!changed && (id === undefined || own(data, 'id') !== id)) return null
  if (!changed && own(data, 'ok') === false) return { kind: 'refused', status: '', stamp: '', ws: null, issues: [] }
  const status = own(data, 'status')
  if ((!changed && own(data, 'ok') !== true) || !FRAME_STATUSES.includes(status)) return null
  const stamp = own(data, 'stamp'), raw = own(data, 'ws')
  const read = isMap(raw) ? normalizeWorkspace(raw) : null
  return { kind: changed ? 'changed' : 'reply', status, stamp: isStamp(stamp) ? stamp : '', ws: read ? read.ws : null, issues: read ? read.issues : [] }
}
