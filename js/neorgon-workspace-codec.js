/**
 * Neorgon Workspace Kit: codec (values, settings, clocks, faces, cookies, stamps)
 * Canonical source: packages/neorgon-ui/workspace/workspace-codec.js
 * Vendored as js/neorgon-workspace-codec.js by packages/neorgon-ui/sync-workspace.sh
 *
 * Import workspace-core.js, not this file: the core re-exports everything here.
 * This half has no imports, so the other kit modules can lean on it without a
 * cycle, and the split keeps each file under the fleet's 500-line rule.
 *
 * Pure: no DOM, no storage, no network. Every function takes untrusted input
 * (a link, a cookie any *.neorgon.com subdomain can write, a file, a frame
 * message) and never throws on it: garbage comes back as '' or null.
 * Written for every engine the fleet serves: no regex lookbehind, no
 * Object.hasOwn, no String.prototype.toWellFormed without a fallback.
 *
 * Do not edit a vendored copy. Edit here and run sync-workspace.sh.
 */

// ── Names ────────────────────────────────────────────────────
export const COOKIE_ME = 'neo_me'                 // the visitor's settings, every tool reads it
export const COOKIE_STAMP = 'neo_ws'              // the stamp of the last save, no data
export const STORAGE_KEY = 'neo-ws:workspace'     // neorgon.com's copy: Persist Kit envelope of { stamp, ws }
export const CACHE_KEY = 'neo-ws:cache'           // a tool's copy, same shape
export const STORE_VERSION = 1                    // the envelope version both keys use: createStore({ key, version: STORE_VERSION })
export const DEV_ORIGIN_KEY = 'neo-ws:dev-origin' // localhost only: where the Workspace page is served
export const MAX_PAYLOAD = 400000                 // characters a decoder reads at most
export const MAX_LINK = 32000                     // characters a writer puts in a link; past it, a file

/** Own properties only: a polluted Object.prototype never supplies a field. */
export const own = (o, k) => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined)
export const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// ── Values ───────────────────────────────────────────────────
/** Letters NFKD leaves whole: without these, "Łukasz" and "Søren" lose a letter in their ids. */
const FOLD = { ł: 'l', Ł: 'L', ø: 'o', Ø: 'O', đ: 'd', Đ: 'D', ß: 'ss', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE', þ: 'th', Þ: 'Th', ð: 'd', Ð: 'D', ħ: 'h', Ħ: 'H', ı: 'i' }
export const unfold = (s) => String(s).replace(/[łŁøØđĐßæÆœŒþÞðÐħĦı]/g, (c) => FOLD[c])

/** A lone surrogate becomes U+FFFD. The fallback pairs by matching, not by lookbehind. */
const wellFormed = (s) => (typeof s.toWellFormed === 'function' ? s.toWellFormed()
  : s.replace(/[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g, (m) => (m.length === 2 ? m : '\ufffd')))

// Control characters, bidi overrides, isolates and marks, zero-width spaces, word
// joiners, the soft hyphen, the BOM, interlinear annotation marks, and (as
// surrogate pairs, after wellFormed) the tag characters U+E0000 to U+E007F, the
// shorthand format controls and the musical format characters: none of them
// shows, and each can make two names look alike. A subdivision flag loses its
// tags and shows as a plain black flag. ZWJ and ZWNJ stay: emoji and several
// scripts need them.
const HIDDEN = /[\u0000-\u0008\u000e-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff\ufff9-\ufffb]|\udb40[\udc00-\udc7f]|\ud82f[\udca0-\udca3]|\ud834[\udd73-\udd7a]/g

/**
 * A one-line plain string, trimmed and capped (Rama's str(), single-line).
 * Hidden characters go, runs of whitespace (newlines too) become one space, a
 * lone surrogate becomes U+FFFD, and a cut never leaves half a pair. A value
 * far past its cap is cut before cleaning, so a 100 MB string costs no more
 * than a short one.
 */
export function str(v, max = 200) {
  let s
  if (typeof v === 'string') s = v
  else if ((typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean') s = String(v)
  else return ''
  if (s.length > max * 4 + 256) s = s.slice(0, max * 4 + 256)
  s = wellFormed(s).replace(HIDDEN, '').replace(/\s+/g, ' ').trim()
  if (s.length > max) s = s.slice(0, max).trimEnd()
  if (/[\ud800-\udbff]$/.test(s)) s = s.slice(0, -1)
  return s
}

/** Fillers that are letters or symbols to Unicode but draw nothing. */
const FILLER = '\u115f\u1160\u3164\uffa0\u2800'
const INK = new RegExp(`[^\\s\\p{C}\\p{M}\\p{Z}${FILLER}]`, 'u')
/** True when a string draws something: a name of only marks, format characters or fillers renders blank. */
export const visible = (s) => typeof s === 'string' && INK.test(s)

/** A stable id from a name: [a-z0-9-], max 48, the same rule as Rama's slug() so ids survive a handoff. */
export function slug(s) {
  return unfold(str(s, 480)).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 48).replace(/-+$/, '')
}

/** A name for matching: "Łukasz  Nowak." and "lukasz nowak" fold alike; non-Latin letters stay. */
export function foldName(s) {
  return unfold(str(s, 200)).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

const ID = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/
/** True for a well-formed id (a person's, a team's or a tool's). */
export const isId = (v) => typeof v === 'string' && ID.test(v)

/**
 * A plain address: dot-separated local words (no leading, trailing or doubled
 * dot) and a domain whose last label is letters or an IDN xn-- label. No ?, &,
 * = or % that could add a bcc or a body to a mailto: link.
 */
export const isEmail = (s) => typeof s === 'string' && s.length <= 254 && s.indexOf('@') <= 64 &&
  /^[A-Za-z0-9_+-]+(?:\.[A-Za-z0-9_+-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})$/.test(s)

/** One address, lowercased, or ''. The whole value is checked before anything is cut. */
export function email(v) {
  if (typeof v !== 'string' || v.length > 300) return ''
  const s = v.trim().toLowerCase()
  return isEmail(s) ? s : ''
}

/** ISO 3166-1 alpha-2, the 249 assigned codes, plus XK (Kosovo), which CLDR and holiday tables use. */
const COUNTRIES = new Set(('ADAEAFAGAIALAMAOAQARASATAUAWAXAZBABBBDBEBFBGBHBIBJBLBMBNBOBQBRBSBTBVBWBYBZCACCCDCFCGCHCICKCLCMCNCOCRCUCVCW' +
  'CXCYCZDEDJDKDMDODZECEEEGEHERESETFIFJFKFMFOFRGAGBGDGEGFGGGHGIGLGMGNGPGQGRGSGTGUGWGYHKHMHNHRHTHUIDIEILIMINIOIQIRISITJEJMJOJP' +
  'KEKGKHKIKMKNKPKRKWKYKZLALBLCLILKLRLSLTLULVLYMAMCMDMEMFMGMHMKMLMMMNMOMPMQMRMSMTMUMVMWMXMYMZNANCNENFNGNINLNONPNRNUNZOMPAPEPF' +
  'PGPHPKPLPMPNPRPSPTPWPYQARERORSRURWSASBSCSDSESGSHSISJSKSLSMSNSOSRSSSTSVSXSYSZTCTDTFTGTHTJTKTLTMTNTOTRTTTVTWTZUAUGUMUSUYUZVA' +
  'VCVEVGVIVNVUWFWSYEYTZAZMZWXK').match(/../g))

/** A country code, uppercased, or ''. "Chile" must not become CH, so the whole value is checked; UK is read as GB. */
export function country(v) {
  if (typeof v !== 'string' || v.length > 8) return ''
  const s = v.trim().toUpperCase()
  if (s === 'UK') return 'GB'
  return /^[A-Z]{2}$/.test(s) && COUNTRIES.has(s) ? s : ''
}

/** #rrggbb (from #rgb or #rrggbb), lowercased, or ''. Every colour that reaches a style passes here. */
export function color(v) {
  if (typeof v !== 'string' || v.length > 12) return ''
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim())
  if (!m) return ''
  const h = m[1].toLowerCase()
  return '#' + (h.length === 3 ? [...h].map((c) => c + c).join('') : h)
}

/** A Pixeldoll code (neoav1:...), at most 400 characters, or ''. The avatar kit decodes it. */
export function avatar(v) {
  return typeof v === 'string' && v.length <= 400 && /^neoav1:[A-Za-z0-9_-]+$/.test(v) ? v : ''
}

/** [startMin, endMin], whole minutes, 0 <= start < end <= 1440, or null. */
export function hours(v) {
  if (!Array.isArray(v) || v.length !== 2) return null
  const [a, b] = v
  return Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b <= 1440 && a < b ? [a, b] : null
}

/** ISO weekday digits, 1 Monday to 7 Sunday, de-duplicated and sorted ('51' -> '15'), or ''. */
export function days(v) {
  if (typeof v !== 'string' || !/^[1-7]{1,7}$/.test(v)) return ''
  return [...new Set(v)].sort().join('')
}

// ── Zones ────────────────────────────────────────────────────
const OFFSET = /^([+-])(\d{1,2})(?::(\d{2}))?$/
const PARTIAL = new Set(['-9:30', '-3:30', '-2:30', '+3:30', '+4:30', '+5:30', '+6:30', '+9:30', '+10:30', '+5:45', '+8:45', '+12:45', '+13:45'])
const UTC = /^(?:etc\/)?(?:utc|uct|gmt|gmt[+-]?0|universal|zulu|greenwich)$/i
const ETC = /^etc\/gmt([+-])(\d{1,2})$/i
const AREA = /^(?:africa|america|antarctica|arctic|asia|atlantic|australia|europe|indian|pacific)\/[a-z0-9_+-]+(?:\/[a-z0-9_+-]+)?$/i
/** Names Chromium still reports from CLDR, and the IANA names Firefox and WebKit use: always the second. */
const RENAMED = new Map([['africa/asmera', 'Africa/Asmara'], ['america/buenos_aires', 'America/Argentina/Buenos_Aires'],
  ['america/catamarca', 'America/Argentina/Catamarca'], ['america/coral_harbour', 'America/Atikokan'], ['america/cordoba', 'America/Argentina/Cordoba'],
  ['america/godthab', 'America/Nuuk'], ['america/indianapolis', 'America/Indiana/Indianapolis'], ['america/jujuy', 'America/Argentina/Jujuy'],
  ['america/louisville', 'America/Kentucky/Louisville'], ['america/mendoza', 'America/Argentina/Mendoza'], ['asia/calcutta', 'Asia/Kolkata'],
  ['asia/katmandu', 'Asia/Kathmandu'], ['asia/rangoon', 'Asia/Yangon'], ['asia/saigon', 'Asia/Ho_Chi_Minh'], ['atlantic/faeroe', 'Atlantic/Faroe'],
  ['europe/kiev', 'Europe/Kyiv'], ['pacific/enderbury', 'Pacific/Kanton'], ['pacific/ponape', 'Pacific/Pohnpei'], ['pacific/truk', 'Pacific/Chuuk']])
/** The CLDR name an older engine may know instead (clockAt tries it when the IANA one fails). */
const OLD_ZONE_NAME = new Map([...RENAMED].map(([old, now]) => [now, old.replace(/(^|[/_])([a-z])/g, (_, a, b) => a + b.toUpperCase())]))

/** An offset the world uses today: whole hours from -12 to +14, and the 13 half and three-quarter ones. */
function offset(sign, h, mm) {
  if (!mm) return (sign === '-' ? h <= 12 : h <= 14) ? `${h ? sign : '+'}${h}` : ''
  const out = `${sign}${h}:${String(mm).padStart(2, '0')}`
  return PARTIAL.has(out) ? out : ''
}

let zoneNames = null
/** Lowercase name to IANA spelling, from the engine's canonical list with the CLDR names renamed; empty without the list. */
function known() {
  if (zoneNames) return zoneNames
  zoneNames = new Map()
  let list = []
  try { list = Intl.supportedValuesOf('timeZone') } catch { /* an engine without the list asks Intl one name at a time */ }
  if (!Array.isArray(list) || !list.length) return zoneNames
  for (const z of list) if (AREA.test(z)) { const n = RENAMED.get(z.toLowerCase()) || z; zoneNames.set(n.toLowerCase(), n) }
  for (const n of RENAMED.values()) zoneNames.set(n.toLowerCase(), n)
  return zoneNames
}

const zoneMemo = new Map()
function askIntl(s) {
  if (zoneMemo.has(s)) return zoneMemo.get(s)
  let out = ''
  try {
    const r = new Intl.DateTimeFormat('en', { timeZone: s }).resolvedOptions().timeZone
    out = typeof r === 'string' && r.toLowerCase() === s.toLowerCase() ? r : s
  } catch { out = '' }
  if (zoneMemo.size < 2000) zoneMemo.set(s, out)
  return out
}

/**
 * A time zone, spelled the same in every engine, or ''. An IANA name in one of
 * the ten regions (any case) comes back in its IANA spelling, and the CLDR names
 * some engines report (Europe/Kiev) as their IANA ones (Europe/Kyiv); a name
 * only some engines know (a backward link such as US/Pacific) is refused.
 * Offsets come back canonical (+05:30 is +5:30, -0 is +0) and must be one the
 * world uses; UTC, GMT and Etc/UTC are UTC, and Etc/GMT+5 is the offset -5.
 */
export function zone(v) {
  if (typeof v !== 'string' || v.length > 64) return ''
  const s = v.trim()
  let m = OFFSET.exec(s)
  if (m) return offset(m[1], Number(m[2]), Number(m[3] || 0))
  if (UTC.test(s)) return 'UTC'
  if ((m = ETC.exec(s))) return offset(m[1] === '+' ? '-' : '+', Number(m[2]), 0)
  if (!AREA.test(s)) return ''
  const lower = s.toLowerCase()
  if (RENAMED.has(lower)) return RENAMED.get(lower)
  const names = known()
  return names.size ? names.get(lower) || '' : askIntl(s)
}

/**
 * An ISO time, as YYYY-MM-DDTHH:MM:SSZ, or ''. A day that does not exist (02-30) is refused, not rolled over,
 * and so is a time whose UTC year leaves 0000 to 9999, so every value this returns reads back as itself.
 */
export function isoTime(v) {
  if (typeof v !== 'string' || v.length > 40) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,9})?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.exec(v)
  const [y, mo, d] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : []
  if (!m || mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(2000 + (y % 400), mo, 0)).getUTCDate()) return ''
  const t = Date.parse(v)
  const out = Number.isNaN(t) ? '' : new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z')
  return /^\d{4}-/.test(out) ? out : ''
}

// ── The visitor's settings (neo_me) and clocks ───────────────
/**
 * The neo_me fields, each checked; anything else is dropped. Never a name or an email.
 * tz zone, h hours, d work days, w week start (1 Monday, 6 Saturday, 7 Sunday),
 * c time format ('h23', 'h12', or '' for the locale's), cc country.
 */
export function cleanPrefs(raw) {
  const out = {}
  if (!isMap(raw)) return out
  const tz = zone(own(raw, 'tz')); if (tz) out.tz = tz
  const h = hours(own(raw, 'h')); if (h) out.h = h
  const d = days(own(raw, 'd')); if (d) out.d = d
  const w = own(raw, 'w'); if (w === 1 || w === 6 || w === 7) out.w = w
  const c = own(raw, 'c'); if (c === 'h23' || c === 'h12' || c === '') out.c = c
  const cc = country(own(raw, 'cc')); if (cc) out.cc = cc
  return out
}

export const DEFAULT_HOURS = Object.freeze([540, 1020]) // 09:00 to 17:00: five of them is Loadout's 40 hours

/** What this device would choose: its zone, its locale's week start, weekend and region. Pass locale and tz to test. */
export function deviceDefaults({ locale, tz } = {}) {
  let resolved = {}
  try { resolved = new Intl.DateTimeFormat(locale || undefined).resolvedOptions() } catch { /* a bad locale */ }
  const out = { tz: zone(tz ?? resolved.timeZone) || 'UTC', h: [...DEFAULT_HOURS], d: '12345', w: 1, c: '', cc: '' }
  try {
    const loc = new Intl.Locale(locale || resolved.locale || 'en')
    const info = typeof loc.getWeekInfo === 'function' ? loc.getWeekInfo() : loc.weekInfo
    if ([1, 6, 7].includes(info?.firstDay)) out.w = info.firstDay
    if (Array.isArray(info?.weekend)) out.d = days([1, 2, 3, 4, 5, 6, 7].filter((n) => !info.weekend.includes(n)).join('')) || '12345'
    out.cc = country(loc.region)
  } catch { /* no Intl.Locale: keep Monday and 1 to 5 */ }
  return out
}

/** The visitor's settings over the device's: every key present (cc and c may be ''), each one checked. */
export const withDefaults = (prefs, device = deviceDefaults()) =>
  ({ tz: 'UTC', h: [...DEFAULT_HOURS], d: '12345', w: 1, c: '', cc: '', ...cleanPrefs(device), ...cleanPrefs(prefs) })

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const clocks = new Map()
function formatter(z) {
  if (!clocks.has(z)) {
    let f = null
    for (const name of [z, OLD_ZONE_NAME.get(z)]) {
      if (f || !name) continue
      try { f = new Intl.DateTimeFormat('en-US', { timeZone: name, hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23' }) } catch { f = null }
    }
    clocks.set(z, f)
  }
  return clocks.get(z)
}

/** The time of day at a zone (minutes since midnight) and the ISO weekday (1 Monday, 7 Sunday), or null. */
export function clockAt(tz, now = new Date()) {
  const z = zone(tz)
  if (!z) return null
  const m = OFFSET.exec(z)
  if (m || z === 'UTC') {
    const shift = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : 0
    const t = new Date(now.getTime() + shift * 6e4)
    return { minutes: t.getUTCHours() * 60 + t.getUTCMinutes(), day: t.getUTCDay() || 7 }
  }
  try {
    const parts = formatter(z).formatToParts(now)
    const get = (type) => parts.find((x) => x.type === type)?.value
    return { minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')), day: WEEKDAYS.indexOf(get('weekday')) || 7 }
  } catch { return null }
}

// ── Faces: the same person looks the same everywhere ─────────
/** 32-bit FNV-1a, the hash Rama and the avatar kit use. */
export function hashString(s) {
  let h = 0x811c9dc5
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0 }
  return h >>> 0
}

/** Twelve hues, each dark enough for white initials at 4.5:1 or better. */
export const FACE_COLORS = Object.freeze(['#b91c1c', '#c2410c', '#a16207', '#4d7c0f', '#15803d', '#0f766e',
  '#0e7490', '#0369a1', '#1d4ed8', '#4338ca', '#7e22ce', '#be185d'])

/** A person's (or a team's) own colour, else one derived from the id, so every tool agrees. Takes the entity or an id. */
export function colorFor(entity) {
  if (isMap(entity)) {
    const mine = color(own(entity, 'color'))
    if (mine) return mine
  }
  const id = typeof entity === 'string' ? entity : isMap(entity) ? str(own(entity, 'id'), 60) || str(own(entity, 'name'), 120) : ''
  return FACE_COLORS[hashString(id) % FACE_COLORS.length]
}

/** White or near-black, whichever reads better on the colour (a person's own colour can be light). */
export function inkOn(hex) {
  const c = color(hex) || FACE_COLORS[0]
  const lin = (i) => { const v = parseInt(c.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const L = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5)
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0556 ? '#ffffff' : '#111111' // #111111 has luminance 0.0056
}

/** First letters of the first and last word, whole graphemes; an emoji counts, punctuation and blank fillers never do (Rama's rule). */
const MARK = /(?![\u115f\u1160\u3164\uffa0])[\p{L}\p{Extended_Pictographic}]/u
export function initials(name = '') {
  const words = str(name, 200).replace(/\(.*?\)/g, '').trim().split(/\s+/).filter((w) => MARK.test(w))
  if (!words.length) return '?'
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null
  const firstLetter = (w) => {
    const from = w.slice(w.search(MARK))
    const g = seg ? seg.segment(from)[Symbol.iterator]().next().value?.segment || '' : [...from][0] || ''
    const up = g.toUpperCase()
    return up.length > g.length ? g : up // ß stays ß rather than becoming SS
  }
  return firstLetter(words[0]) + (words.length > 1 ? firstLetter(words[words.length - 1]) : '')
}

// ── Bytes ────────────────────────────────────────────────────
export function toBase64Url(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Bytes, or null for anything that is not strict base64url. */
export function fromBase64Url(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null
  try { return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)) } catch { return null }
}

export const utf8 = (text) => new TextEncoder().encode(text)
/** Strict UTF-8: a malformed sequence is a refusal, never a replacement character. */
export function fromUtf8(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) } catch { return null }
}

// ── Cookies: pure strings, never document.cookie ─────────────
/** The settings as a neo_me value: 1. + base64url(JSON). Under 200 bytes for any input. */
export const encodeMe = (prefs) => '1.' + toBase64Url(utf8(JSON.stringify(cleanPrefs(prefs))))

/** A neo_me value back to settings, or null when it is garbage or holds no valid setting (both read as absent). */
export function decodeMe(value) {
  if (typeof value !== 'string' || value.length > 512 || !/^1\.[A-Za-z0-9_-]+$/.test(value)) return null
  const bytes = fromBase64Url(value.slice(2))
  const json = bytes && fromUtf8(bytes)
  if (json == null) return null
  let raw
  try { raw = JSON.parse(json) } catch { return null }
  const prefs = isMap(raw) ? cleanPrefs(raw) : null
  return prefs && Object.keys(prefs).length ? prefs : null
}

/** Every value a cookie string (document.cookie) holds for a name, first first; at most 8. */
export function cookieValues(cookieString, name) {
  if (typeof cookieString !== 'string' || typeof name !== 'string') return []
  const out = []
  for (const part of cookieString.slice(0, 32768).split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) out.push(part.slice(i + 1).trim())
    if (out.length >= 8) break
  }
  return out
}

/** The first neo_me in a cookie string that decodes, or null. Two can coexist (host-only and .neorgon.com). */
export function readMe(cookieString) {
  for (const v of cookieValues(cookieString, COOKIE_ME)) { const p = decodeMe(v); if (p) return p }
  return null
}

/** The first valid stamp in a cookie string's neo_ws, or null. */
export function readStamp(cookieString) {
  for (const v of cookieValues(cookieString, COOKIE_STAMP)) { const s = decodeStamp(v); if (s) return s }
  return null
}

/** neorgon.com or one of its subdomains; evilneorgon.com is neither. */
export function isNeorgonHost(hostname) {
  const h = typeof hostname === 'string' ? hostname.toLowerCase().replace(/\.$/, '') : ''
  return h === 'neorgon.com' || (h.endsWith('.neorgon.com') && /^[a-z0-9.-]+$/.test(h))
}

/**
 * The attributes both cookies carry: Path=/, one year, SameSite=Lax, Secure on
 * https, Domain=.neorgon.com only on neorgon.com hosts (host-only on
 * localhost, where every port shares one jar). `where` is location-like.
 */
export function cookieAttributes(where = {}, maxAge = 31536000) {
  return `; Path=/; Max-Age=${Math.max(0, Math.floor(Number(maxAge)) || 0)}; SameSite=Lax` +
    (where.protocol === 'https:' ? '; Secure' : '') +
    (isNeorgonHost(where.hostname) ? '; Domain=.neorgon.com' : '')
}

/** A whole string to assign to document.cookie for the settings. */
export const meCookie = (prefs, where) => `${COOKIE_ME}=${encodeMe(prefs)}${cookieAttributes(where)}`

/** A whole string to assign to document.cookie for a save's stamp, or '' for a bad stamp. */
export const stampCookie = (stamp, where) => (isStamp(stamp) ? `${COOKIE_STAMP}=${encodeStamp(stamp)}${cookieAttributes(where)}` : '')

/** Expires one of the kit's two cookies, or '' for any other name. */
export const clearCookie = (name, where) => ([COOKIE_ME, COOKIE_STAMP].includes(name) ? `${name}=${cookieAttributes(where, 0)}` : '')

// ── Stamps ───────────────────────────────────────────────────
const STAMP = /^[0-9a-z]{1,11}-[0-9a-z]{6,16}$/
export const isStamp = (s) => typeof s === 'string' && STAMP.test(s)

/** base36 time, a hyphen, base36 random: tells a copy from the latest without carrying data. */
export function makeStamp(now = Date.now(), random = null) {
  let tail = ''
  if (random) tail = Math.floor(random() * 36 ** 8).toString(36)
  else if (globalThis.crypto?.getRandomValues) tail = [...globalThis.crypto.getRandomValues(new Uint32Array(2))].map((n) => n.toString(36)).join('')
  else tail = Math.floor(Math.random() * 36 ** 8).toString(36) + Math.floor(Math.random() * 36 ** 8).toString(36)
  const t = Number.isFinite(now) && now >= 0 ? Math.floor(now) : Date.now()
  return `${t.toString(36)}-${tail.padStart(6, '0').slice(0, 16)}`
}

/** When a stamp was made (ms), or NaN. */
export const stampTime = (s) => (isStamp(s) ? parseInt(s.split('-')[0], 36) : NaN)
export const encodeStamp = (s) => (isStamp(s) ? '1.' + s : '')
export const decodeStamp = (v) => (typeof v === 'string' && v.startsWith('1.') && isStamp(v.slice(2)) ? v.slice(2) : null)

/** The frame's status: shared when its copy carries the cookie's stamp, stale when they differ, empty with no cookie. */
export function frameStatus(storedStamp, cookieStamp) {
  if (!isStamp(cookieStamp)) return 'empty'
  return storedStamp === cookieStamp ? 'shared' : 'stale'
}
