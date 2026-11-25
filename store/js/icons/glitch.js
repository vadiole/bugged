const N = 256
const MB = 16

const SCHEMES = {
    acid: { bg0: '#4a1dff', bg1: '#07042a', glyph0: '#fff200', glyph1: '#ff0a5c', rim: '#00f0ff' },
    news: { bg0: '#e8e4da', bg1: '#8c8a84', glyph0: '#141414', glyph1: '#d0141e', rim: '#1450ff' },
    night: { bg0: '#0f3d2e', bg1: '#020806', glyph0: '#c9ff3b', glyph1: '#00b37a', rim: '#ff2bd6' },
}

const QL = [
    16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62,
    18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
]
const QC = [
    17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99,
    ...Array(32).fill(99),
]
const COS = new Float32Array(64)
for (let x = 0; x < 8; x++) for (let u = 0; u < 8; u++) COS[x * 8 + u] = Math.cos(((2 * x + 1) * u * Math.PI) / 16) * (u === 0 ? Math.SQRT1_2 : 1) * 0.5

function rng(seed) {
    let s = seed >>> 0
    return () => {
        s = (s + 0x6d2b79f5) >>> 0
        let t = s
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function source(scheme) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = N
    const c = canvas.getContext('2d')
    const bg = c.createRadialGradient(N * 0.45, N * 0.4, 0, N * 0.5, N * 0.5, N * 0.75)
    bg.addColorStop(0, scheme.bg0)
    bg.addColorStop(1, scheme.bg1)
    c.fillStyle = bg
    c.fillRect(0, 0, N, N)
    c.font = `900 ${Math.round(N * 0.8)}px "Helvetica Neue", Helvetica, Arial, sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'alphabetic'
    const x = N * 0.5, y = N * 0.79
    c.lineJoin = 'round'
    c.lineWidth = N * 0.035
    c.strokeStyle = scheme.rim
    c.strokeText('?', x + N * 0.012, y + N * 0.008)
    const g = c.createLinearGradient(0, N * 0.18, 0, N * 0.8)
    g.addColorStop(0, scheme.glyph0)
    g.addColorStop(1, scheme.glyph1)
    c.fillStyle = g
    c.fillText('?', x, y)
    const px = c.getImageData(0, 0, N, N).data
    const Y = new Float32Array(N * N), Cb = new Float32Array(N * N), Cr = new Float32Array(N * N)
    for (let i = 0; i < N * N; i++) {
        const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2]
        Y[i] = 0.299 * r + 0.587 * gg + 0.114 * b
        Cb[i] = -0.1687 * r - 0.3313 * gg + 0.5 * b
        Cr[i] = 0.5 * r - 0.4187 * gg - 0.0813 * b
    }
    return [Y, Cb, Cr]
}

function mosh(planes, amount, seed) {
    const r = rng(seed * 31 + 7)
    const M = N / MB
    const frames = Math.round(amount * 18)
    const field = []
    for (let by = 0; by < M; by++) for (let bx = 0; bx < M; bx++) {
        const cy = (by + 0.5) / M, cx = (bx + 0.5) / M
        const zone = Math.max(0, cy - 0.5 + 0.12 * Math.sin(cx * 7 + seed)) * 4 + (cy > 0.3 && r() < 0.1 ? 0.7 : 0)
        const active = r() < Math.min(0.95, zone)
        const vy = active ? Math.round(2 + r() * 4 + cy * 3) : 0
        const vx = active ? Math.round((r() - 0.5) * 4 + (cx - 0.5) * 3) : 0
        field.push([vx, vy, active, (r() - 0.5) * 9, (r() - 0.5) * 9])
    }
    let cur = planes.map((p) => Float32Array.from(p))
    const moshed = new Uint8Array(M * M)
    for (let f = 0; f < frames; f++) {
        const next = cur.map((p) => Float32Array.from(p))
        for (let by = 0; by < M; by++) for (let bx = 0; bx < M; bx++) {
            const [vx, vy, active, db, dr] = field[by * M + bx]
            if (!active) continue
            moshed[by * M + bx] = 1
            for (let y = 0; y < MB; y++) for (let x = 0; x < MB; x++) {
                const X = bx * MB + x, Y = by * MB + y
                const sx = Math.min(N - 1, Math.max(0, X - vx)), sy = Math.min(N - 1, Math.max(0, Y - vy))
                const s = sy * N + sx, d = Y * N + X
                next[0][d] = cur[0][s]
                next[1][d] = cur[1][s] + db * 0.5
                next[2][d] = cur[2][s] + dr * 0.5
            }
        }
        cur = next
    }
    return { planes: cur, moshed }
}

function quantize(plane, size, q, moshed, step) {
    const out = new Float32Array(plane.length)
    const blk = new Float32Array(64), tmp = new Float32Array(64), co = new Float32Array(64)
    const M = N / MB
    for (let by = 0; by < size; by += 8) for (let bx = 0; bx < size; bx += 8) {
        const mb = Math.floor((by * step) / MB) * M + Math.floor((bx * step) / MB)
        const qs = (q.scale * (moshed[mb] ? 3.2 : 1))
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) blk[y * 8 + x] = plane[(by + y) * size + bx + x] - (q.center ?? 0)
        for (let y = 0; y < 8; y++) for (let u = 0; u < 8; u++) {
            let s = 0
            for (let x = 0; x < 8; x++) s += blk[y * 8 + x] * COS[x * 8 + u]
            tmp[y * 8 + u] = s
        }
        for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
            let s = 0
            for (let y = 0; y < 8; y++) s += tmp[y * 8 + u] * COS[y * 8 + v]
            const qq = Math.max(1, q.table[v * 8 + u] * qs)
            co[v * 8 + u] = Math.round(s / qq) * qq
        }
        for (let y = 0; y < 8; y++) for (let u = 0; u < 8; u++) {
            let s = 0
            for (let v = 0; v < 8; v++) s += co[v * 8 + u] * COS[y * 8 + v]
            tmp[y * 8 + u] = s
        }
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            let s = 0
            for (let u = 0; u < 8; u++) s += tmp[y * 8 + u] * COS[x * 8 + u]
            out[(by + y) * size + bx + x] = s + (q.center ?? 0)
        }
    }
    return out
}

function encode(k) {
    const scheme = SCHEMES[k.scheme] ?? SCHEMES.acid
    const { planes, moshed } = mosh(source(scheme), k.mosh, k.seed)
    const [Y, Cb, Cr] = planes
    const H = N / 2
    const sub = (p) => {
        const o = new Float32Array(H * H)
        for (let y = 0; y < H; y++) for (let x = 0; x < H; x++) {
            const i = y * 2 * N + x * 2
            o[y * H + x] = (p[i] + p[i + 1] + p[i + N] + p[i + N + 1]) / 4
        }
        return o
    }
    const scale = 0.4 + (1 - k.quality) * 5
    const Yq = quantize(Y, N, { table: QL, scale, center: 128 }, moshed, 1)
    const Bq = quantize(sub(Cb), H, { table: QC, scale }, moshed, 2)
    const Rq = quantize(sub(Cr), H, { table: QC, scale }, moshed, 2)
    const rgb = new Float32Array(N * N * 3)
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const i = y * N + x, j = (y >> 1) * H + (x >> 1)
        const yy = Yq[i], cb = Bq[j], cr = Rq[j]
        rgb[i * 3] = yy + 1.402 * cr
        rgb[i * 3 + 1] = yy - 0.344136 * cb - 0.714136 * cr
        rgb[i * 3 + 2] = yy + 1.772 * cb
    }
    return rgb
}

function corrupt(rgb, k) {
    const r = rng(k.seed * 101 + 3)
    const out = Float32Array.from(rgb)
    const M = N / MB
    const rows = Math.round(k.slices * 7)
    for (let s = 0; s < rows; s++) {
        const row = Math.floor(r() * M)
        const h = MB * (r() < 0.3 ? 2 : 1) / (r() < 0.5 ? 2 : 1)
        const y0 = row * MB + (r() < 0.5 ? 0 : MB / 2)
        const shift = Math.round(((r() - 0.5) * N * (r() < 0.4 ? 0.7 : 0.25)) / 4) * 4
        for (let y = y0; y < Math.min(N, y0 + h); y++) {
            const line = rgb.slice(y * N * 3, (y + 1) * N * 3)
            for (let x = 0; x < N; x++) {
                const sx = (((x - shift) % N) + N) % N
                for (let c = 0; c < 3; c++) out[(y * N + x) * 3 + c] = line[sx * 3 + c]
            }
        }
    }
    if (k.slices > 0) {
        const lost = Math.round(k.slices * 2.4)
        for (let l = 0; l < lost; l++) {
            const by = Math.floor(N / MB * (0.55 + r() * 0.4)), bx0 = Math.floor(r() * M), len = 1 + Math.floor(r() * 4)
            const tone = r() < 0.6 ? [0, 135, 0] : [128, 128, 128]
            for (let bx = bx0; bx < Math.min(M, bx0 + len); bx++)
                for (let y = 0; y < MB; y++) for (let x = 0; x < MB; x++) {
                    const i = ((by * MB + y) * N + bx * MB + x) * 3
                    out[i] = tone[0]; out[i + 1] = tone[1]; out[i + 2] = tone[2]
                }
        }
    }
    const split = Math.round(k.split * 10)
    const fin = Float32Array.from(out)
    let y = 0
    while (y < N) {
        const h = 4 + Math.floor(r() * 40)
        const amt = r() < 0.4 ? split * 2 : r() < 0.7 ? split : Math.round(split / 3)
        for (let yy = y; yy < Math.min(N, y + h); yy++) for (let x = 0; x < N; x++) {
            const i = (yy * N + x) * 3
            const xr = Math.min(N - 1, Math.max(0, x - amt)), xb = Math.min(N - 1, Math.max(0, x + amt))
            fin[i] = out[(yy * N + xr) * 3]
            fin[i + 2] = out[(yy * N + xb) * 3 + 2]
        }
        y += h
    }
    return fin
}

const cache = new Map()
function remember(key, make) {
    if (cache.has(key)) return cache.get(key)
    const v = make()
    cache.set(key, v)
    if (cache.size > 6) cache.delete(cache.keys().next().value)
    return v
}

function frame(k) {
    const rgb = corrupt(encode(k), k)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = N
    const img = new ImageData(N, N)
    for (let i = 0; i < N * N; i++) {
        img.data[i * 4] = rgb[i * 3]
        img.data[i * 4 + 1] = rgb[i * 3 + 1]
        img.data[i * 4 + 2] = rgb[i * 3 + 2]
        img.data[i * 4 + 3] = 255
    }
    canvas.getContext('2d').putImageData(img, 0, 0)
    return canvas
}

export default {
    id: 'glitch',
    name: 'Datamosh',
    note: 'A question mark caught in a broken stream: P-frames smear it, slices slip, chroma tears.',
    defaults: { scheme: 'acid', mosh: 0.6, quality: 0.62, slices: 0.55, split: 0.4, seed: 4 },
    schema: [
        { group: 'Stream' },
        { key: 'scheme', label: 'Source', type: 'select', options: [['acid', 'Acid'], ['news', 'Broadcast'], ['night', 'Night vision']] },
        { key: 'mosh', label: 'Lost I-frames', type: 'range', min: 0, max: 1.5, step: 0.01 },
        { key: 'quality', label: 'Bitrate', type: 'range', min: 0, max: 1, step: 0.01 },
        { key: 'slices', label: 'Slice errors', type: 'range', min: 0, max: 1, step: 0.01 },
        { key: 'split', label: 'Channel split', type: 'range', min: 0, max: 1, step: 0.01 },
        { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 60, step: 1 },
    ],
    draw(c, S, k) {
        const img = remember([k.scheme, k.mosh, k.quality, k.slices, k.split, k.seed].join('|'), () => frame(k))
        c.save()
        c.imageSmoothingEnabled = false
        c.drawImage(img, 0, 0, S, S)
        c.restore()
    },
}
