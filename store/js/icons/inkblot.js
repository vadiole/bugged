const hash = (x, y, s) => {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const vnoise = (x, y, s) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const a = hash(xi, yi, s)
    const b = hash(xi + 1, yi, s)
    const c = hash(xi, yi + 1, s)
    const d = hash(xi + 1, yi + 1, s)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x0, y0, s, o) => {
    let x = x0 * 0.8 - y0 * 0.6
    let y = x0 * 0.6 + y0 * 0.8
    let sum = 0
    let amp = 0.5
    for (let i = 0; i < o; i++) {
        sum += amp * (vnoise(x, y, s + i * 31) - 0.5)
        x = x * 2.07 + 3.1
        y = y * 2.07 - 1.3
        amp *= 0.5
    }
    return sum
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)
}

const BLOBS = [
    [0, -0.01, 0.075, 0.21, 1.1],
    [0, -0.215, 0.058, 0.05, 0.9],
    [0.15, -0.04, 0.1, 0.12, 1],
    [0.215, -0.15, 0.07, 0.055, 0.85],
    [0.13, 0.15, 0.085, 0.08, 0.95],
    [0.06, 0.24, 0.05, 0.05, 0.7],
    [0.25, -0.2, 0.09, 0.024, 0.8, 0.7],
    [0.27, 0.03, 0.1, 0.022, 0.8, -0.25],
    [0.21, 0.24, 0.09, 0.024, 0.8, -0.8],
    [0.31, -0.27, 0.03, 0.03, 0.55],
    [0.36, 0.06, 0.025, 0.03, 0.5],
    [0.075, -0.3, 0.018, 0.045, 0.8, 0.5],
    [0.11, -0.345, 0.02, 0.02, 0.6],
]
const HOLES = [
    [0.075, -0.07, 0.032, 0.036, 1.3],
    [0.065, 0.11, 0.024, 0.05, 1.1],
    [0.0, 0.33, 0.04, 0.05, 0.8],
]
const RED = [
    [0.055, -0.25, 0.06, 0.04, 1],
    [0.0, 0.225, 0.045, 0.06, 1],
    [0.2, -0.1, 0.04, 0.03, 0.75],
]

function field(list, x, y, seed) {
    let d = 0
    for (let i = 0; i < list.length; i++) {
        const b = list[i]
        const jx = (hash(i, 1, seed) - 0.5) * 0.03
        const jy = (hash(i, 2, seed) - 0.5) * 0.03
        const js = 0.85 + hash(i, 3, seed) * 0.3
        let dx = x - b[0] - jx
        let dy = y - b[1] - jy
        if (b[5]) {
            const c = Math.cos(b[5])
            const s = Math.sin(b[5])
            const rx = dx * c + dy * s
            dy = -dx * s + dy * c
            dx = rx
        }
        d += b[4] * Math.exp(-((dx / (b[2] * js)) ** 2 + (dy / (b[3] * js)) ** 2))
    }
    return d
}

const cache = new Map()

export default {
    id: 'inkblot',
    name: 'Rorschach',
    note: 'Card II of a test you cannot fail. A beetle, a mask, a pelvis: what do you see?',
    defaults: { seed: 3, ink: 0.5, bleed: 0.6, red: true, inkColor: '#16131a', card: '#efe7d4' },
    schema: [
        { group: 'Blot' },
        { key: 'seed', label: 'Fold', type: 'range', min: 1, max: 40, step: 1 },
        { key: 'ink', label: 'Ink load', type: 'range', min: 0, max: 1, step: 0.01 },
        { key: 'bleed', label: 'Bleed', type: 'range', min: 0, max: 1, step: 0.01 },
        { key: 'red', label: 'Red ink', type: 'toggle' },
        { group: 'Card' },
        { key: 'inkColor', label: 'Ink', type: 'color' },
        { key: 'card', label: 'Card', type: 'color' },
    ],
    draw(c, S, k) {
        const key = JSON.stringify([S, k.seed, k.ink, k.bleed, k.red, k.inkColor, k.card])
        let img = cache.get(key)
        if (!img) {
            img = c.createImageData(S, S)
            const d = img.data
            const ink = hex(k.inkColor)
            const card = hex(k.card)
            const red = [196, 30, 38]
            const sd = k.seed
            const T = 0.62 - k.ink * 0.28
            const fib = 0.04 + k.bleed * 0.16
            for (let y = 0; y < S; y++) {
                for (let x = 0; x < S; x++) {
                    const u = (x + 0.5) / S - 0.5
                    const v = (y + 0.5) / S - 0.5
                    const au = Math.abs(u)
                    const wx = au + fbm(au * 4, v * 4, sd, 4) * 0.13 + fbm(u * 6, v * 6, sd + 99, 2) * 0.012
                    const wy = v + fbm(au * 4 + 7, v * 4, sd + 5, 4) * 0.13
                    let D = field(BLOBS, wx, wy, sd) - field(HOLES, wx, wy, sd) * 1.2
                    const hair = fbm(au * 22, v * 22, sd + 17, 3) * 1.6 + fbm(au * 70, v * 70, sd + 11, 4) * 1.4
                    const E = D + hair * fib
                    const a = smooth(T - 0.008, T + 0.008, E)
                    const halo = smooth(T - 0.12 - k.bleed * 0.1, T - 0.02, E + hair * fib * 1.5) * (0.1 + k.bleed * 0.18)
                    const inside = E - T
                    const rim = Math.exp(-Math.max(0, inside) / 0.025)
                    const pool = smooth(0.25, 0.9, D) * (0.5 + 0.5 * vnoise(au * 14, v * 14, sd + 21))
                    const wash = vnoise(au * 9, v * 9, sd + 31) * 0.5 + vnoise(au * 30, v * 30, sd + 41) * 0.25
                    const vein = smooth(0.04, 0.22, fbm(wx * 7 + 2, wy * 16, sd + 51, 4)) * smooth(0.02, 0.3, inside)
                    let dens = clamp(0.9 + 0.2 * rim + 0.2 * pool - 0.2 * wash * (1 - rim) - 0.22 * vein)
                    const cover = Math.max(a * dens, halo)
                    let col = [card[0], card[1], card[2]]
                    const tex = 0.97 + vnoise(u * 300 + v * 40, v * 300 - u * 40, 5) * 0.05
                    const fold = 1 - 0.04 * Math.exp(-((u * S) ** 2) / ((S * 0.006) ** 2)) + (u < 0 ? -0.015 : 0.01)
                    for (let ch = 0; ch < 3; ch++) col[ch] *= tex * fold
                    if (k.red) {
                        const R = field(RED, wx, wy, sd + 1)
                        const ra = smooth(0.44, 0.46, R + hair * fib * 0.9)
                        const rd = 0.55 + 0.45 * Math.exp(-Math.max(0, R + hair * fib * 0.9 - 0.45) / 0.04) - 0.2 * wash + 0.15 * pool
                        const rc = clamp(ra * rd)
                        for (let ch = 0; ch < 3; ch++) col[ch] *= 1 - rc * (1 - red[ch] / 255)
                    }
                    for (let ch = 0; ch < 3; ch++) col[ch] *= 1 - cover * (1 - ink[ch] / 255)
                    const o = (y * S + x) * 4
                    d[o] = col[0]
                    d[o + 1] = col[1]
                    d[o + 2] = col[2]
                    d[o + 3] = 255
                }
            }
            for (let i = 0; i < 16; i++) {
                const r0 = hash(i, 7, sd)
                const ang = hash(i, 8, sd) * Math.PI * 2
                const dist = 0.24 + r0 * 0.16
                const cx = Math.abs(Math.cos(ang) * dist)
                const cy = Math.sin(ang) * dist
                const rr = (0.002 + Math.pow(hash(i, 9, sd), 3) * 0.009) * S
                for (const sx of [1, -1]) {
                    const px = (0.5 + cx * sx) * S
                    const py = (0.5 + cy) * S
                    const x0 = Math.max(0, Math.floor(px - rr - 2))
                    const x1 = Math.min(S - 1, Math.ceil(px + rr + 2))
                    const y0 = Math.max(0, Math.floor(py - rr - 2))
                    const y1 = Math.min(S - 1, Math.ceil(py + rr + 2))
                    for (let y = y0; y <= y1; y++) {
                        for (let x = x0; x <= x1; x++) {
                            const e = Math.hypot(x + 0.5 - px, y + 0.5 - py)
                            const a = clamp(rr + 0.5 - e) * (0.75 + 0.2 * clamp(e / rr))
                            if (a <= 0) continue
                            const o = (y * S + x) * 4
                            for (let ch = 0; ch < 3; ch++) d[o + ch] *= 1 - a * (1 - ink[ch] / 255)
                        }
                    }
                }
            }
            cache.set(key, img)
            if (cache.size > 6) cache.delete(cache.keys().next().value)
        }
        c.putImageData(img, 0, 0)
    },
}
