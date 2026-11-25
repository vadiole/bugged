const PALETTES = {
    flesh: { deep: [0.07, 0.003, 0.01], ridge: [1, 0.3, 0.26], sheen: [1, 0.93, 0.88], amb: [0.02, 0.003, 0.006], glow: [0.7, 0.04, 0.05] },
    slug: { deep: [0.02, 0.03, 0.006], ridge: [0.42, 0.5, 0.14], sheen: [0.95, 1, 0.85], amb: [0.008, 0.012, 0.004], glow: [0.3, 0.4, 0.02] },
    ink: { deep: [0.004, 0.005, 0.008], ridge: [0.05, 0.06, 0.085], sheen: [0.9, 0.95, 1], amb: [0.003, 0.003, 0.005], glow: [0.02, 0.05, 0.12] },
    nacre: { deep: [0.2, 0.16, 0.26], ridge: [0.88, 0.84, 0.86], sheen: [1, 1, 1], amb: [0.06, 0.05, 0.07], glow: [0.4, 0.3, 0.5] },
}

const SRGB = new Uint8ClampedArray(4096)
for (let i = 0; i < 4096; i++) {
    const v = i / 4095
    SRGB[i] = Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055))
}

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

function noise2(seed) {
    const r = rng(seed)
    const waves = Array.from({ length: 6 }, (_, i) => {
        const a = r() * Math.PI * 2
        const f = 2 + i * 1.7 + r()
        return [Math.cos(a) * f, Math.sin(a) * f, r() * Math.PI * 2, 1 / (1 + i * 0.6)]
    })
    return (x, y) => {
        let s = 0
        for (const [fx, fy, p, w] of waves) s += Math.sin(x * fx + y * fy + p) * w
        return s / 3
    }
}

const edgeAt = (y, wipe) => wipe + 0.07 * Math.sin(y * 5.5 + 0.8) - 0.16 * (y - 0.5)

function simulate(density, wipe, seed) {
    const L = 10
    const G = Math.round(density * L)
    const A = new Float32Array(G * G).fill(1)
    const B = new Float32Array(G * G)
    const fixed = new Uint8Array(G * G)
    const feed = new Float32Array(G * G)
    const phaseAt = new Float32Array(G * G)
    const r = rng(seed * 7919 + 1)
    const warp = noise2(seed)
    const cx = 0.42, cy = 0.47
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
        const u = x / G, v = y / G
        const i = y * G + x
        if (u > edgeAt(v, wipe)) {
            fixed[i] = 1
            continue
        }
        const dx = u - cx + warp(u, v) * 0.045, dy = (v - cy) / 1.28 + warp(v + 3, u) * 0.045
        const rad = Math.hypot(dx, dy)
        const ang = Math.atan2(dy, dx)
        const phase = (rad * G) / L + ang / (Math.PI * 2) * 1.0
        const s = Math.cos(phase * Math.PI * 2)
        feed[i] = s
        phaseAt[i] = phase
        if (s > 0.4 || r() < 0.01) B[i] = 0.45 + r() * 0.1
    }
    const f = 0.034, kk = 0.0585, force = 0.011
    const ta = new Float32Array(G * G), tb = new Float32Array(G * G), tc = new Float32Array(G * G)
    const par = 0.16, perp = 0.035
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
        const i = y * G + x
        const xm = x ? i - 1 : i, xp = x < G - 1 ? i + 1 : i, ym = y ? i - G : i, yp = y < G - 1 ? i + G : i
        let gx = phaseAt[xp] - phaseAt[xm], gy = phaseAt[yp] - phaseAt[ym]
        const gl = Math.hypot(gx, gy) || 1
        const nx = gx / gl, ny = gy / gl
        ta[i] = par * ny * ny + perp * nx * nx
        tb[i] = par * nx * nx + perp * ny * ny
        tc[i] = (perp - par) * nx * ny
    }
    let A2 = new Float32Array(G * G), B2 = new Float32Array(G * G)
    let a = A, b = B
    for (let it = 0; it < 1800; it++) {
        for (let y = 0; y < G; y++) {
            const ym = (y === 0 ? 0 : y - 1) * G, y0 = y * G, yp = (y === G - 1 ? G - 1 : y + 1) * G
            for (let x = 0; x < G; x++) {
                const i = y0 + x
                if (fixed[i]) {
                    A2[i] = 1
                    B2[i] = 0
                    continue
                }
                const xm = x === 0 ? 0 : x - 1, xp = x === G - 1 ? G - 1 : x + 1
                const av = a[i], bv = b[i]
                const ca = ta[i], cb = tb[i], cc = tc[i] * 0.5
                const lapA = ca * (a[y0 + xm] + a[y0 + xp] - 2 * av) + cb * (a[ym + x] + a[yp + x] - 2 * av) + cc * (a[yp + xp] + a[ym + xm] - a[yp + xm] - a[ym + xp])
                const lapB = 0.5 * (ca * (b[y0 + xm] + b[y0 + xp] - 2 * bv) + cb * (b[ym + x] + b[yp + x] - 2 * bv) + cc * (b[yp + xp] + b[ym + xm] - b[yp + xm] - b[ym + xp]))
                const abb = av * bv * bv
                const fi = f + force * feed[i]
                A2[i] = av + lapA - abb + fi * (1 - av)
                B2[i] = bv + lapB + abb - (kk + fi) * bv
            }
        }
        ;[a, A2] = [A2, a]
        ;[b, B2] = [B2, b]
    }
    const H = new Float32Array(G * G)
    let max = 0
    for (let i = 0; i < G * G; i++) max = Math.max(max, b[i])
    for (let i = 0; i < G * G; i++) H[i] = b[i] / max
    const streak = noise2(seed + 11)
    for (let y = 0; y < G; y++) {
        const v = y / G
        const ex = edgeAt(v, wipe)
        const src = Math.max(0, Math.min(G - 1, Math.round(ex * G - 2.5)))
        const base = H[y * G + src]
        const st = Math.max(0, streak(v * 4, 1) * 1.4 + Math.sin(v * 70 + streak(v, 0) * 10) * 0.4 - 0.25)
        for (let x = 0; x < G; x++) {
            const u = x / G
            const d = u - ex
            if (d <= 0) continue
            const fall = Math.exp(-d / (0.02 + 0.1 * st))
            H[y * G + x] = (base * 0.5 + 0.1) * fall * st
        }
    }
    const S2 = new Float32Array(G * G)
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
        let s = 0, w = 0
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
            const xx = Math.min(G - 1, Math.max(0, x + i)), yy = Math.min(G - 1, Math.max(0, y + j))
            const ww = i === 0 && j === 0 ? 4 : i === 0 || j === 0 ? 2 : 1
            s += H[yy * G + xx] * ww
            w += ww
        }
        S2[y * G + x] = s / w
    }
    return { H: S2, G }
}

function cubic(p0, p1, p2, p3, t) {
    return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)))
}

function upsample({ H, G }, S) {
    const out = new Float32Array(S * S)
    const at = (x, y) => H[Math.min(G - 1, Math.max(0, y)) * G + Math.min(G - 1, Math.max(0, x))]
    const col = new Float32Array(4)
    for (let y = 0; y < S; y++) {
        const gy = ((y + 0.5) / S) * G - 0.5
        const y0 = Math.floor(gy), ty = gy - y0
        for (let x = 0; x < S; x++) {
            const gx = ((x + 0.5) / S) * G - 0.5
            const x0 = Math.floor(gx), tx = gx - x0
            for (let j = 0; j < 4; j++) col[j] = cubic(at(x0 - 1, y0 + j - 1), at(x0, y0 + j - 1), at(x0 + 1, y0 + j - 1), at(x0 + 2, y0 + j - 1), tx)
            out[y * S + x] = cubic(col[0], col[1], col[2], col[3], ty)
        }
    }
    return out
}

const sims = new Map()
const heights = new Map()
const finals = new Map()
function remember(map, key, make, size = 4) {
    if (map.has(key)) return map.get(key)
    const v = make()
    map.set(key, v)
    if (map.size > size) map.delete(map.keys().next().value)
    return v
}

function render(S, k) {
    const simKey = [k.density, k.wipe, k.seed].join('|')
    const sim = remember(sims, simKey, () => simulate(k.density, k.wipe, k.seed))
    const H = remember(heights, simKey + '|' + S, () => upsample(sim, S))
    const pal = PALETTES[k.palette] ?? PALETTES.flesh
    const img = new ImageData(S, S)
    const d = img.data
    const depth = (k.relief * 0.03 * 17) / k.density
    const wet = k.wet
    let lx = -0.55, ly = -0.62, lz = 0.56
    const ll = Math.hypot(lx, ly, lz)
    lx /= ll; ly /= ll; lz /= ll
    let hx = lx, hy = ly, hz = lz + 1
    const hl = Math.hypot(hx, hy, hz)
    hx /= hl; hy /= hl; hz /= hl
    const col = [0, 0, 0]
    for (let y = 0; y < S; y++) {
        const v = (y + 0.5) / S - 0.5
        for (let x = 0; x < S; x++) {
            const u = (x + 0.5) / S - 0.5
            const i = y * S + x
            const xm = x > 0 ? i - 1 : i, xp = x < S - 1 ? i + 1 : i
            const ym = y > 0 ? i - S : i, yp = y < S - 1 ? i + S : i
            const h = H[i]
            let nx = -(H[xp] - H[xm]) * S * 0.5 * depth + u * 0.5
            let ny = -(H[yp] - H[ym]) * S * 0.5 * depth + v * 0.5
            let nz = 1
            const nl = Math.hypot(nx, ny, nz)
            nx /= nl; ny /= nl; nz /= nl
            const ndl = nx * lx + ny * ly + nz * lz
            const wrap = Math.max(0, (ndl + 0.35) / 1.35)
            const ndh = Math.max(0, nx * hx + ny * hy + nz * hz)
            const spec = ndh ** 160 * 3.2 * wet + ndh ** 24 * 0.18 * wet
            const rx = 2 * nz * nx, ry = 2 * nz * ny
            const bx = (rx + 0.42) / 0.3, by = (ry + 0.5) / 0.16
            const box = Math.max(0, 1 - Math.max(Math.abs(bx), Math.abs(by)) ** 6)
            const rim = Math.exp(-(((rx - 0.33) / 0.014) ** 2)) * Math.max(0, 1 - ((ry + 0.05) / 0.55) ** 8)
            const fres = 0.04 + 0.96 * (1 - nz) ** 5
            const t = Math.min(1, Math.max(0, h * 1.25))
            const sss = t * t * (3 - 2 * t)
            const cav = Math.max(0, 1 - (1 - t) * 0.55)
            const vig = Math.max(0, 1 - (u * u + v * v) * 1.3)
            for (let c = 0; c < 3; c++) {
                const alb = pal.deep[c] + (pal.ridge[c] - pal.deep[c]) * sss
                let val = alb * (wrap * 1.15 * cav + 0.06) + pal.amb[c] + pal.glow[c] * sss * (1 - wrap) * 0.45
                val += pal.sheen[c] * (spec + box * 0.9 * wet * (0.2 + fres * 2.5) + rim * 0.22 * wet * (0.3 + 0.7 * (1 - sss)))
                val *= 0.35 + 0.65 * vig
                val = val / (1 + val * 0.25)
                col[c] = val
            }
            const o = i * 4
            d[o] = SRGB[Math.min(4095, (col[0] * 4095) | 0)]
            d[o + 1] = SRGB[Math.min(4095, (col[1] * 4095) | 0)]
            d[o + 2] = SRGB[Math.min(4095, (col[2] * 4095) | 0)]
            d[o + 3] = 255
        }
    }
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = S
    canvas.getContext('2d').putImageData(img, 0, 0)
    return canvas
}

export default {
    id: 'turing',
    name: 'Wiped print',
    note: 'A Gray-Scott reaction grown along a fingerprint, half wiped off a wet membrane.',
    defaults: { palette: 'flesh', density: 12, wipe: 0.66, relief: 1, wet: 1, seed: 3 },
    schema: [
        { group: 'Growth' },
        { key: 'density', label: 'Ridges', type: 'range', min: 10, max: 26, step: 1 },
        { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 40, step: 1 },
        { key: 'wipe', label: 'Wipe edge', type: 'range', min: 0.35, max: 1.1, step: 0.01 },
        { group: 'Surface' },
        { key: 'palette', label: 'Tissue', type: 'select', options: [['flesh', 'Flesh'], ['slug', 'Slug'], ['ink', 'Ink'], ['nacre', 'Nacre']] },
        { key: 'relief', label: 'Relief', type: 'range', min: 0.2, max: 2.5, step: 0.01 },
        { key: 'wet', label: 'Wetness', type: 'range', min: 0, max: 1.5, step: 0.01 },
    ],
    draw(c, S, k) {
        c.drawImage(remember(finals, [S, k.palette, k.density, k.wipe, k.relief, k.wet, k.seed].join('|'), () => render(S, k), 6), 0, 0)
    },
}
