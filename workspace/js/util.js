/**
 * Workspace page: small helpers. Every value that reaches HTML goes through
 * html`...`, which escapes each interpolation unless it is already html.
 * Workspace data is untrusted (a link, a file, another tab), so there is no
 * other way into innerHTML on this page.
 */
import { escHtml } from '../../js/neorgon-dom.js'
import { colorFor, inkOn, initials, toolName, country } from '../../js/neorgon-workspace-core.js'

class Html { constructor(s) { this.s = s } toString() { return this.s } }

function part(v) {
  if (v instanceof Html) return v.s
  if (Array.isArray(v)) return v.map(part).join('')
  if (v === null || v === undefined || v === false) return ''
  return escHtml(String(v))
}

/** Tagged template: every ${value} is escaped; nested html`` and arrays of it pass through. */
export function html(strings, ...values) {
  let out = strings[0]
  for (let i = 0; i < values.length; i++) out += part(values[i]) + strings[i + 1]
  return new Html(out)
}

/** Puts html`` into an element. The only innerHTML write on the page. */
export function paint(el, content) { if (el) el.innerHTML = part(content) }

export const $ = (sel, root = document) => root.querySelector(sel)
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))

export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`

/** "Rama", or "a Neorgon tool" for anything the kit does not list. */
export const toolLabel = (id) => toolName(id) || 'a Neorgon tool'

/** Minutes since midnight as the visitor reads time: "09:00" or "9:00 AM". */
export function clock(min, cycle = '') {
  if (!Number.isInteger(min)) return ''
  const h = Math.floor(min / 60) % 24, m = String(min % 60).padStart(2, '0')
  if (min === 1440) return cycle === 'h12' ? '12:00 AM' : '24:00'
  if (cycle === 'h12') return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`
  return `${String(h).padStart(2, '0')}:${m}`
}

/** "09:00" from an <input type=time> to minutes, or null. "24:00" is not a time input value, so the end of day is 23:59 there. */
export function minutesOf(value) {
  const m = /^(\d{2}):(\d{2})$/.exec(value || '')
  if (!m) return null
  const n = Number(m[1]) * 60 + Number(m[2])
  return n >= 0 && n < 1440 ? n : null
}
export const timeValue = (min) => (Number.isInteger(min) ? clock(Math.min(min, 1439), 'h23') : '')

export const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
/** '12345' as "Mon to Fri", '135' as "Mon, Wed, Fri". */
export function dayList(d) {
  if (!d) return ''
  const n = d.split('').map(Number)
  const run = n.every((x, i) => i === 0 || x === n[i - 1] + 1)
  if (run && n.length > 2) return `${DAY_NAMES[n[0]]} to ${DAY_NAMES[n[n.length - 1]]}`
  return n.map((x) => DAY_NAMES[x]).join(', ')
}

/** "11 Nov, 14:05" in the visitor's locale, or '' for an empty or bad time. */
export function when(iso) {
  const t = Date.parse(iso || '')
  if (!Number.isFinite(t)) return ''
  try { return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(t) } catch { return iso }
}

/** A person's (or team's) face: their colour, initials in a readable ink. `size` is a class suffix. */
export function face(entity, { size = '', title = true } = {}) {
  const bg = colorFor(entity)
  const name = entity && typeof entity.name === 'string' ? entity.name : ''
  return html`<span class="ws-face${size ? ' ws-face--' + size : ''}" style="--face:${bg};--face-ink:${inkOn(bg)}"${title ? html` title="${name}"` : ''} aria-hidden="true">${initials(name)}</span>`
}

/** Index a workspace's people by id. A Map, never an object: "constructor" is a valid id. */
export const byId = (list) => new Map(list.map((x) => [x.id, x]))

// The same words and lists as the kit's Settings sheet, so a setting reads alike in both places.
export const ZONE_ERROR = 'Not a time zone. Try a city, like America/Santiago, or an offset, like +2.'
export const HOURS_ERROR = 'The day must end after it starts.'
export const DAY_FULL = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

let countries = null
/** Every country the kit accepts, by English name: [[code, name]]. */
function countryList() {
  if (countries) return countries
  let names = null
  try { names = new Intl.DisplayNames(['en'], { type: 'region' }) } catch { names = null }
  countries = []
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b)
    if (country(code) !== code) continue
    let name = code
    try { name = (names && names.of(code)) || code } catch { name = code }
    countries.push([code, name])
  }
  countries.sort((x, y) => x[1].localeCompare(y[1]))
  return countries
}
/** A country <select>'s options, as the sheet has them: "Not set", then "Chile (CL)". */
export const countryOptions = (selected) => html`<option value="">Not set</option>${countryList().map(([c, n]) =>
  html`<option value="${c}"${c === selected ? ' selected' : ''}>${n} (${c})</option>`)}`
