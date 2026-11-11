/**
 * Workspace page: the round trips.
 *
 *   #save=<payload>&tool=<id>&return=<url>  review what a tool sends, save on a click, then "Back to <tool>"
 *   #pick&tool=<id>&return=<url>            show what a tool will get, "Share with <tool>" answers it
 *   (a file)                                the same review for an imported neorgon-workspace.json
 *
 * The fragment is read only through the kit's parseFragment, and a return URL
 * is followed only when it is in the kit's exact allowlist (safeReturnUrl);
 * anything else is shown as text. Nothing is saved before the visitor's click.
 */
import {
  parseFragment, previewPayload, decodePayload, previewMerge, normalizeWorkspace, encodePayload, answerLink, colorFor,
} from '../../js/neorgon-workspace-core.js'
import { downloadText } from '../../js/neorgon-dom.js'
import { state, load, commit, prefs } from './store.js'
import { renderDiff, headline, issueList } from './diff.js'
import { confirm } from './forms.js'
import { html, paint, $, plural, face, clock, dayList, byId, toolLabel } from './util.js'

let flow = null
const TRUST = html`<p class="ws-trust"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Kept in this browser. Nothing is sent anywhere.</p>`

const self = () => ({ selfHostname: location.hostname })
export const inFlow = () => !!flow

/** Reads the address bar. Returns true when a round trip took over the page. */
export function route(onLeave) {
  const hash = location.hash
  if (!/^#(save=|pick(&|$))/.test(hash)) return false
  const parsed = parseFragment(hash, self())
  if (!parsed) {
    leave(onLeave)
    banner('This link is damaged, or it was not made by a Neorgon tool, so nothing was read from it.')
    return false
  }
  flow = { kind: parsed.op, parsed, onLeave, done: false }
  if (parsed.op === 'save') renderSave(); else renderPick()
  return true
}

/** A file the visitor picked: the same review as a save, from no tool. */
export function startImport(raw, fileName, onLeave) {
  flow = { kind: 'import', raw, fileName, onLeave, done: false }
  renderSave()
}

export function banner(msg) {
  const el = $('#wsBanner')
  el.textContent = msg
  el.hidden = !msg
}

function showFlow(content) {
  $('#wsEditor').hidden = true
  const box = $('#wsFlow')
  box.hidden = false
  paint(box, content)
  const h = box.querySelector('h2')
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }) }
  window.scrollTo(0, 0)
}

/** Back to the editor, with the fragment gone so a reload does not reopen the review. */
export function leave(onLeave = flow && flow.onLeave) {
  flow = null
  if (/^#(save=|pick)/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search)
  $('#wsFlow').hidden = true
  paint($('#wsFlow'), '')
  $('#wsEditor').hidden = false
  if (onLeave) onLeave()
}

function returnNote(p) {
  if (!p) return ''
  if (p.returnUrl) return html`<p class="ws-return">Afterwards you go back to <span class="ws-url">${p.returnUrl}</span></p>`
  if (p.returnText) return html`<p class="ws-return ws-return--bad">This link asks to go back to <span class="ws-url">${p.returnText}</span>, which is not a Neorgon tool, so the page will not open it.</p>`
  return ''
}

function preview() {
  if (flow.kind === 'import') return previewMerge(state.ws, flow.raw)
  return previewPayload(state.ws, flow.parsed.payload)
}

// ── Save and import: the review ──────────────────────────────
function renderSave() {
  const p = flow.parsed
  const who = flow.kind === 'import' ? `The file ${flow.fileName}` : toolLabel(p.tool)
  const pv = preview()
  if (!pv) {
    showFlow(html`<div class="ws-flow-card"><p class="ws-eyebrow">Review</p><h2>${who} sent nothing this page can read.</h2>
      <p class="ws-help">The link or file may be cut short. Nothing was saved.</p>${returnNote(p)}
      <div class="ws-flow-actions">${p && p.returnUrl ? html`<a class="ws-away ws-btn ws-btn--primary" href="${p.returnUrl}">Back to ${toolLabel(p.tool)}</a>` : ''}<button type="button" class="ws-btn" data-act="flow-leave">Open your workspace</button></div></div>`)
    return
  }
  flow.preview = pv
  const ta = byId(pv.next.teams)
  const teamNames = [...pv.teams.added, ...pv.teams.updated, ...pv.teams.unchanged].map((id) => ta.get(id)).filter(Boolean).map((t) => t.name)
  // A payload may also say who the visitor is; the merge fills an empty me from it, so the review says so.
  const meId = (pv.next.me && pv.next.me.person) || ''
  const meNew = meId && meId !== ((state.ws.me && state.ws.me.person) || '') ? byId(pv.next.people).get(meId) : null
  const nothing = !pv.added.length && !pv.updated.length && !pv.teams.added.length && !pv.teams.updated.length && !meNew
  const empty = !state.ws.people.length && !state.ws.teams.length
  showFlow(html`<div class="ws-flow-card">
    <p class="ws-eyebrow">${flow.kind === 'import' ? 'Import' : `From ${toolLabel(p.tool)}`} · review before saving</p>
    <h2>${headline(who, pv, teamNames)}</h2>
    <p class="ws-help">${nothing ? 'Saving would change nothing.' : 'Nothing is saved until you choose. Saving never removes anyone already here.'}</p>
    <div class="ws-legend" aria-hidden="true"><span class="ws-legend-added">added</span><span class="ws-legend-updated">updated</span><span class="ws-legend-unchanged">unchanged</span></div>
    ${meNew ? html`<p class="ws-help ws-flow-me">Saving also marks ${meNew.name} as you.</p>` : ''}
    ${renderDiff(state.ws, pv)}
    ${issueList(pv.issues)}
    <div class="ws-flow-actions">
      ${nothing ? '' : html`<button type="button" class="ws-btn ws-btn--primary" data-act="flow-save">Save to your workspace</button>`}
      ${!empty ? html`<button type="button" class="ws-btn ws-btn--quiet" data-act="flow-replace">Replace the whole workspace</button>` : ''}
      <span class="ws-spacer"></span>
      ${p && p.returnUrl
        ? html`<a class="ws-away ws-btn" href="${p.returnUrl}">${nothing ? 'Back to ' + toolLabel(p.tool) : 'Not now'}</a>`
        : html`<button type="button" class="ws-btn" data-act="flow-leave">${nothing ? 'Open your workspace' : 'Not now'}</button>`}
    </div>
    ${returnNote(p)}
    ${TRUST}
  </div>`)
}

function renderSaved(summary) {
  const p = flow.parsed
  flow.done = true
  if (/^#save=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search)
  showFlow(html`<div class="ws-flow-card ws-flow-card--done">
    <p class="ws-eyebrow">Saved</p>
    <h2>${summary}</h2>
    <p class="ws-help">Every planning tool on this browser now sees it.</p>
    <div class="ws-flow-actions">
      ${p && p.returnUrl ? html`<a class="ws-away ws-btn ws-btn--primary" href="${p.returnUrl}">Back to ${toolLabel(p.tool)}</a>` : ''}
      <button type="button" class="ws-btn${p && p.returnUrl ? '' : ' ws-btn--primary'}" data-act="flow-leave">Open your workspace</button>
    </div>
    ${returnNote(p)}
  </div>`)
}

export function saveFlow() {
  if (!flow || flow.done || flow.kind === 'pick') return
  load()                              // another tab may have saved since the review was drawn
  const pv = preview()
  if (!pv) return renderSave()
  const tool = flow.kind === 'save' ? flow.parsed.tool : null
  if (!commit(pv.next, { tool })) return banner('This browser would not keep the workspace (private browsing, or storage is full). Nothing was saved.')
  const bits = []
  if (pv.added.length) bits.push(`${plural(pv.added.length, 'person', 'people')} added`)
  if (pv.updated.length) bits.push(`${pv.updated.length} updated`)
  if (pv.teams.added.length) bits.push(plural(pv.teams.added.length, 'new team'))
  renderSaved(bits.length ? bits.join(', ') + '.' : 'Saved.')
}

export async function replaceFlow() {
  if (!flow || flow.done || flow.kind === 'pick') return
  const read = flow.kind === 'import' ? normalizeWorkspace(flow.raw) : decodePayload(flow.parsed.payload)
  if (!read) return
  const yes = await confirm({
    title: 'Replace the whole workspace?',
    body: `Your ${plural(state.ws.people.length, 'person', 'people')} and ${plural(state.ws.teams.length, 'team')} are removed from this browser and the ${plural(read.ws.people.length, 'person', 'people')} sent take their place. This cannot be undone here.`,
    ok: 'Replace',
  })
  if (!yes) return
  const tool = flow.kind === 'save' ? flow.parsed.tool : null
  if (!commit(read.ws, { tool })) return banner('This browser would not keep the workspace. Nothing was saved.')
  renderSaved(`Your workspace is now the ${plural(read.ws.people.length, 'person', 'people')} sent.`)
}

// ── Pick: share with a tool ──────────────────────────────────
function prefsLine() {
  const { all } = prefs()
  return [all.tz.replace(/_/g, ' '), `${clock(all.h[0], all.c)} to ${clock(all.h[1], all.c)}`, dayList(all.d), all.cc].filter(Boolean).join(' · ')
}

function renderPick() {
  const p = flow.parsed
  const name = toolLabel(p.tool)
  const { ws } = state
  const people = byId(ws.people)
  const me = ws.me && ws.me.person ? people.get(ws.me.person) : null
  const teams = ws.teams.length ? html`<ul class="ws-pick-teams">${ws.teams.map((t) => html`<li class="ws-pick-team" style="--team:${colorFor(t)}">
      <span class="ws-pick-team-name">${t.name}</span><span class="ws-count">${t.members.length}</span>
      <span class="ws-faces">${t.members.slice(0, 12).map((m) => people.get(m.person)).filter(Boolean).map((x) => face(x, { size: 'sm' }))}</span></li>`)}</ul>`
    : html`<p class="ws-help">${ws.people.length ? `No teams yet: ${name} gets your ${plural(ws.people.length, 'person', 'people')} on their own.` : `Your workspace is empty, so ${name} gets nobody yet.`}</p>`
  showFlow(html`<div class="ws-flow-card">
    <p class="ws-eyebrow">Share with ${name}</p>
    <h2>${name} asks for your team.</h2>
    <p class="ws-help">It gets your people and teams, and reads your settings. The answer travels in the address bar straight back to ${name}, in this browser.</p>
    <dl class="ws-pick">
      <div><dt>You</dt><dd>${me ? html`<span class="ws-diff-line">${face(me)}<span>${me.name}</span></span>` : html`<span class="ws-none">not set</span>`}</dd></div>
      <div><dt>Settings</dt><dd>${prefsLine()}</dd></div>
      <div><dt>People</dt><dd>${plural(ws.people.length, 'person', 'people')}</dd></div>
      <div><dt>Teams</dt><dd>${teams}</dd></div>
    </dl>
    <div class="ws-flow-actions" id="pickActions">
      ${p.returnUrl ? html`<button type="button" class="ws-btn ws-btn--primary" data-act="flow-share">Share with ${name}</button>` : ''}
      <span class="ws-spacer"></span>
      ${p.returnUrl ? html`<a class="ws-away ws-btn" href="${p.returnUrl}">Not now</a>` : ''}
      <button type="button" class="ws-btn ws-btn--quiet" data-act="flow-leave">Edit your workspace</button>
    </div>
    ${returnNote(p)}
    ${TRUST}
  </div>`)
}

export async function shareFlow() {
  if (!flow || flow.kind !== 'pick' || !flow.parsed.returnUrl) return
  load()
  const payload = await encodePayload(state.ws)
  const link = answerLink(flow.parsed.returnUrl, { payload, stamp: state.stamp }, self())
  if (link) { location.assign(link); return }
  const name = toolLabel(flow.parsed.tool)
  paint($('#pickActions'), html`<p class="ws-help">Your workspace is too large to travel in a link. Download it, then import the file in ${name}.</p>
    <button type="button" class="ws-btn ws-btn--primary" data-act="export">Download neorgon-workspace.json</button>
    <a class="ws-away ws-btn" href="${flow.parsed.returnUrl}">Back to ${name}</a>`)
}

export const exportFile = () => downloadText(JSON.stringify(state.ws, null, 2), 'neorgon-workspace.json', 'application/json')

/** Inside another page's frame: nothing is read from the fragment and nothing can be saved. */
export function refuseFramed() {
  paint($('#main'), html`<div class="ws-flow-card"><h2>Your workspace opens only as its own page.</h2>
    <p class="ws-help">This page was shown inside another site, so it reads nothing and saves nothing here.</p>
    <div class="ws-flow-actions"><a class="ws-btn ws-btn--primary" href="${location.pathname}" target="_top" rel="noopener">Open your workspace</a></div></div>`)
}
