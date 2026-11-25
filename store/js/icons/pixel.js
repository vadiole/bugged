const HALF = [
    '..k.....',
    '...k....',
    '....k.kk',
    '.....kbb',
    '...kkbhh',
    '..kkkkbb',
    '.kwwwkkb',
    '.kwwppwb',
    '.kwwppwb',
    '..kwwwwk',
    'k..kmmkk',
    '.kkshhbk',
    'k.kshbbk',
    '.kksbbbk',
    'k.kssbbk',
    '...kkkkk',
]
const SPRITE = HALF.map((row) => row + [...row].reverse().join(''))

const PALETTES = {
    arcade: { bg: '#182570', star: '#5f7bff', k: '#13061d', b: '#ef3b6e', h: '#ffa9c2', s: '#8a1a4e', w: '#fff3da', p: '#13061d', m: '#ffd23d' },
    gameboy: { bg: '#9bbc0f', star: '#8bac0f', k: '#0f380f', b: '#306230', h: '#8bac0f', s: '#0f380f', w: '#9bbc0f', p: '#0f380f', m: '#8bac0f' },
    c64: { bg: '#352879', star: '#6c5eb5', k: '#000000', b: '#9ad284', h: '#ffffff', s: '#588d43', w: '#ffffff', p: '#000000', m: '#b86962' },
    vectrex: { bg: '#020203', star: '#262a33', k: '#020203', b: '#4dd6ff', h: '#e8fbff', s: '#1a5e8a', w: '#ffffff', p: '#020203', m: '#ff4b2b' },
}

const W = 26
const OFF = 5

const toLin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const hex = (h) => [1, 3, 5].map((i) => toLin(parseInt(h.slice(i, i + 2), 16) / 255))
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

function frame(palette) {
    const pal = Object.fromEntries(Object.entries(PALETTES[palette] ?? PALETTES.arcade).map(([k, v]) => [k, hex(v)]))
    const img = new Float32Array(W * W * 3)
    const put = (x, y, c, a = 1) => {
        const i = (y * W + x) * 3
        for (let j = 0; j < 3; j++) img[i + j] = img[i + j] * (1 - a) + c[j] * a
    }
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) put(x, y, pal.bg)
    const r = rng(7)
    for (let i = 0; i < 26; i++) {
        const x = Math.floor(r() * W)
        const y = Math.floor(r() * W)
        if (x >= OFF - 1 && x <= OFF + 16 && y >= OFF - 1 && y <= OFF + 16) continue
        put(x, y, pal.star, 0.35 + r() * 0.65)
    }
    for (let x = 0; x < W; x++) put(x, OFF + 17, pal.star, 0.55)
    for (let x = 0; x < W; x += 2) put(x, OFF + 18, pal.star, 0.25)
    SPRITE.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && put(x + OFF, y + OFF, pal[ch])))
    return { img, pal }
}

function blurred(img, F, sigma) {
    const N = W * F
    let a = new Float32Array(N * N * 3)
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const s = ((Math.floor(y / F) * W) + Math.floor(x / F)) * 3
        const d = (y * N + x) * 3
        a[d] = img[s]; a[d + 1] = img[s + 1]; a[d + 2] = img[s + 2]
    }
    const r = Math.ceil(sigma * 2.5)
    const ker = []
    let sum = 0
    for (let i = -r; i <= r; i++) { const w = Math.exp(-(i * i) / (2 * sigma * sigma)); ker.push(w); sum += w }
    for (let i = 0; i < ker.length; i++) ker[i] /= sum
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const b = new Float32Array(a.length)
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            let R = 0, G = 0, B = 0
            for (let i = -r; i <= r; i++) {
                const xx = Math.min(N - 1, Math.max(0, x + dx * i))
                const yy = Math.min(N - 1, Math.max(0, y + dy * i))
                const s = (yy * N + xx) * 3
                const w = ker[i + r]
                R += a[s] * w; G += a[s + 1] * w; B += a[s + 2] * w
            }
            const d = (y * N + x) * 3
            b[d] = R; b[d + 1] = G; b[d + 2] = B
        }
        a = b
    }
    return { data: a, N }
}

const frames = new Map()
const finals = new Map()

function render(S, k) {
    if (!frames.has(k.palette)) {
        const f = frame(k.palette)
        frames.set(k.palette, { ...f, bloom: blurred(f.img, 6, 4) })
    }
    const { img, bloom, pal } = frames.get(k.palette)
    const out = new ImageData(S, S)
    const d = out.data
    const curv = k.curve
    const scan = k.scanlines
    const triad = S / (W * 2)
    const maskAmt = k.mask * Math.min(1, Math.max(0, (triad - 2) / 3))
    const scanAmt = scan * Math.min(1, Math.max(0, (S / W - 3) / 6))
    const bezel = [0.006, 0.006, 0.008]
    const px = (x, y, c) => {
        x = x < 0 ? 0 : x >= W ? W - 1 : x
        y = y < 0 ? 0 : y >= W ? W - 1 : y
        return (y * W + x) * 3 + c
    }
    const bl = bloom.data
    const BN = bloom.N
    const col = [0, 0, 0]
    for (let oy = 0; oy < S; oy++) {
        const v = ((oy + 0.5) / S) * 2 - 1
        for (let ox = 0; ox < S; ox++) {
            const u = ((ox + 0.5) / S) * 2 - 1
            const r2 = u * u + v * v
            const f = (1 + curv * r2) * 0.97
            const cu = u * f
            const cv = v * f
            const ax = Math.abs(cu), ay = Math.abs(cv)
            const q = 0.08
            const ex = Math.max(ax - (1 - q), 0), ey = Math.max(ay - (1 - q), 0)
            const edge = q - Math.hypot(ex, ey) - Math.min(Math.max(ax - (1 - q), ay - (1 - q)), 0)
            const o = (oy * S + ox) * 4
            const inside = Math.min(1, Math.max(0, edge * S * 0.5))
            if (inside <= 0) {
                const lip = Math.max(0, 1 - (-edge) * 14)
                const g = 0.004 + 0.02 * lip * lip * (0.5 - v * 0.5)
                d[o] = SRGB[Math.min(4095, (g * 4095) | 0)]
                d[o + 1] = SRGB[Math.min(4095, (g * 4095) | 0)]
                d[o + 2] = SRGB[Math.min(4095, (g * 1.15 * 4095) | 0)]
                d[o + 3] = 255
                continue
            }
            const gx = (cu * 0.5 + 0.5) * W
            const gy = (cv * 0.5 + 0.5) * W
            const fy = gy - 0.5
            const y0 = Math.floor(fy)
            const ty = fy - y0
            const fx = gx - 0.5
            const x0 = Math.floor(fx)
            let tx = fx - x0
            tx = Math.min(1, Math.max(0, (tx - 0.5) * 3.2 + 0.5))
            col[0] = col[1] = col[2] = 0
            for (let j = 0; j < 2; j++) {
                const yy = y0 + j
                const dist = j ? 1 - ty : ty
                let lum = 0
                const c0 = [0, 0, 0]
                for (let c = 0; c < 3; c++) {
                    const val = img[px(x0, yy, c)] * (1 - tx) + img[px(x0 + 1, yy, c)] * tx
                    c0[c] = val
                    lum += val * (c === 1 ? 0.6 : 0.2)
                }
                const wdt = 0.17 + 0.16 * Math.sqrt(Math.min(1, lum))
                const gauss = Math.exp(-(dist * dist) / (2 * wdt * wdt)) * (0.4 / wdt)
                const lin = 1 - dist
                const wgt = lin + (gauss - lin) * scanAmt
                col[0] += c0[0] * wgt; col[1] += c0[1] * wgt; col[2] += c0[2] * wgt
            }
            if (maskAmt > 0) {
                const ti = Math.floor(ox / triad)
                const ph = (ox / triad - ti) * 3
                const slot = ((oy / (triad * 2.4)) + (ti & 1) * 0.5) % 1
                const gap = 1 - 0.25 * Math.max(0, Math.cos(slot * Math.PI * 2)) ** 8
                for (let c = 0; c < 3; c++) {
                    let dd = Math.abs(ph - (c + 0.5))
                    dd = Math.min(dd, 3 - dd)
                    const m = Math.max(0, 1 - dd * 1.1) ** 0.6 * gap * 2.2
                    col[c] *= 1 + (m - 1) * maskAmt
                }
            }
            const bx = Math.min(BN - 1.001, Math.max(0, (gx / W) * BN - 0.5))
            const by = Math.min(BN - 1.001, Math.max(0, (gy / W) * BN - 0.5))
            const bx0 = bx | 0, by0 = by | 0
            const bfx = bx - bx0, bfy = by - by0
            const i00 = (by0 * BN + bx0) * 3, i10 = i00 + 3, i01 = i00 + BN * 3, i11 = i01 + 3
            const vig = Math.max(0, 1 - 0.32 * r2 * r2) * Math.min(1, inside)
            const hl = Math.exp(-(((u + 0.42) ** 2) / 0.09 + ((v + 0.55) ** 2) / 0.02)) * 0.05 + 0.006 * (1 - r2 * 0.4)
            for (let c = 0; c < 3; c++) {
                const b = (bl[i00 + c] * (1 - bfx) + bl[i10 + c] * bfx) * (1 - bfy) + (bl[i01 + c] * (1 - bfx) + bl[i11 + c] * bfx) * bfy
                let val = (col[c] + b * k.bloom * 0.5) * vig + hl
                val = val * 1.25 / (1 + val * 0.2)
                d[o + c] = SRGB[Math.min(4095, Math.max(0, (val * 4095) | 0))]
            }
            d[o + 3] = 255
        }
    }
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = S
    canvas.getContext('2d').putImageData(out, 0, 0)
    return canvas
}

export default {
    id: 'pixel',
    name: 'CRT sprite',
    note: 'The enemy sprite from a game that never shipped, angry on a curved shadow-mask tube.',
    defaults: { palette: 'arcade', curve: 0.1, scanlines: 0.8, mask: 0.6, bloom: 0.55 },
    schema: [
        { group: 'Cartridge' },
        { key: 'palette', label: 'Palette', type: 'select', options: [['arcade', 'Arcade'], ['gameboy', 'Handheld'], ['c64', 'Home computer'], ['vectrex', 'Cold']] },
        { group: 'Tube' },
        { key: 'curve', label: 'Curvature', type: 'range', min: 0, max: 0.3, step: 0.01 },
        { key: 'scanlines', label: 'Scanlines', type: 'range', min: 0, max: 1, step: 0.01 },
        { key: 'mask', label: 'Shadow mask', type: 'range', min: 0, max: 1, step: 0.01 },
        { key: 'bloom', label: 'Bloom', type: 'range', min: 0, max: 1.5, step: 0.01 },
    ],
    draw(c, S, k) {
        const key = [S, k.palette, k.curve, k.scanlines, k.mask, k.bloom].join('|')
        if (!finals.has(key)) {
            finals.set(key, render(S, k))
            if (finals.size > 6) finals.delete(finals.keys().next().value)
        }
        c.drawImage(finals.get(key), 0, 0)
    },
}
