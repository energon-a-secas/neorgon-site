/**
 * Neorgon Workspace Kit: raw inflate (RFC 1951)
 * Canonical source: packages/neorgon-ui/workspace/workspace-inflate.js
 * Vendored as js/neorgon-workspace-inflate.js by packages/neorgon-ui/sync-workspace.sh
 *
 * Import workspace-core.js, not this file: the core re-exports inflateRaw.
 *
 * Synchronous, so a z1. link opens in a browser without DecompressionStream
 * and decoding a link needs no await. Bounded: past `limit` output bytes it
 * stops, so a small link cannot inflate into a frozen tab. Pure, no imports;
 * every malformed stream throws, and the caller turns that into null.
 *
 * Do not edit a vendored copy. Edit here and run sync-workspace.sh.
 */
export const MAX_INFLATED = 4 * 1024 * 1024 // bytes a z1. payload may inflate to

const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]

function huffman(lengths) {
  const count = new Uint16Array(16), offs = new Uint16Array(16), symbol = new Uint16Array(lengths.length)
  for (const l of lengths) count[l]++
  count[0] = 0
  let left = 1
  for (let l = 1; l < 16; l++) { left = left * 2 - count[l]; if (left < 0) throw new Error('over-subscribed code') }
  for (let l = 1; l < 15; l++) offs[l + 1] = offs[l] + count[l]
  lengths.forEach((l, s) => { if (l) symbol[offs[l]++] = s })
  return { count, symbol }
}

/** The bytes a raw deflate stream holds; throws on a malformed stream or past `limit` bytes. */
export function inflateRaw(data, limit = MAX_INFLATED) {
  let pos = 0, buf = 0, cnt = 0, len = 0
  let out = new Uint8Array(Math.min(limit, Math.max(1024, data.length * 4)))
  const bits = (n) => {
    while (cnt < n) { if (pos >= data.length) throw new Error('truncated'); buf |= data[pos++] << cnt; cnt += 8 }
    const v = buf & ((1 << n) - 1); buf >>>= n; cnt -= n; return v
  }
  const room = (n) => {
    if (len + n > limit) throw new Error('too large')
    if (len + n > out.length) { const next = new Uint8Array(Math.min(limit, Math.max(out.length * 2, len + n))); next.set(out); out = next }
  }
  const decode = (h) => {
    let code = 0, first = 0, index = 0
    for (let l = 1; l < 16; l++) {
      code |= bits(1)
      const c = h.count[l]
      if (code - c < first) return h.symbol[index + code - first]
      index += c; first = (first + c) << 1; code <<= 1
    }
    throw new Error('bad code')
  }
  let fixed = null, last = 0
  do {
    last = bits(1)
    const type = bits(2)
    if (type === 0) {
      buf = 0; cnt = 0
      if (pos + 4 > data.length) throw new Error('truncated')
      const n = data[pos] | (data[pos + 1] << 8), nn = data[pos + 2] | (data[pos + 3] << 8)
      if (n !== (~nn & 0xffff) || pos + 4 + n > data.length) throw new Error('bad stored block')
      room(n); out.set(data.subarray(pos + 4, pos + 4 + n), len); len += n; pos += 4 + n
      continue
    }
    let lit, dist
    if (type === 1) {
      fixed ||= {
        lit: huffman(Array.from({ length: 288 }, (_, i) => (i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8))),
        dist: huffman(new Array(30).fill(5)),
      }
      ;({ lit, dist } = fixed)
    } else if (type === 2) {
      const nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4
      if (nlen > 286 || ndist > 30) throw new Error('bad counts')
      const cl = new Array(19).fill(0)
      for (let i = 0; i < ncode; i++) cl[ORDER[i]] = bits(3)
      const clh = huffman(cl), lengths = []
      while (lengths.length < nlen + ndist) {
        const sym = decode(clh)
        if (sym < 16) { lengths.push(sym); continue }
        let rep = 0, val = 0
        if (sym === 16) { if (!lengths.length) throw new Error('repeat with no length'); val = lengths[lengths.length - 1]; rep = 3 + bits(2) }
        else rep = sym === 17 ? 3 + bits(3) : 11 + bits(7)
        if (lengths.length + rep > nlen + ndist) throw new Error('too many lengths')
        for (let i = 0; i < rep; i++) lengths.push(val)
      }
      if (!lengths[256]) throw new Error('no end of block')
      lit = huffman(lengths.slice(0, nlen)); dist = huffman(lengths.slice(nlen))
    } else throw new Error('bad block type')
    for (;;) {
      let sym = decode(lit)
      if (sym < 256) { room(1); out[len++] = sym; continue }
      if (sym === 256) break
      sym -= 257
      if (sym >= 29) throw new Error('bad length')
      const n = LBASE[sym] + bits(LEXT[sym])
      const ds = decode(dist)
      if (ds >= 30) throw new Error('bad distance')
      const back = DBASE[ds] + bits(DEXT[ds])
      if (back > len) throw new Error('distance too far')
      room(n)
      for (let i = 0; i < n; i++, len++) out[len] = out[len - back]
    }
  } while (!last)
  return out.subarray(0, len)
}
