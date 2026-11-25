const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)
}
const hex = (h) => {
    const n = parseInt(h.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rng(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
function hash(x, y) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

function ellipse(cx, cy, rx, ry, rot = 0) {
    const ca = Math.cos(rot), sa = Math.sin(rot)
    return (x, y) => {
        const dx = x - cx, dy = y - cy
        const px = dx * ca + dy * sa, py = -dx * sa + dy * ca
        const lx = px / rx, ly = py / ry
        const k0 = Math.hypot(lx, ly)
        const k1 = Math.hypot(px / (rx * rx), py / (ry * ry)) || 1e-6
        return { d: (k0 * (k0 - 1)) / k1, lx, ly, r2: lx * lx + ly * ly }
    }
}
function segDist(x, y, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay
    const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy))
    return [Math.hypot(x - ax - vx * t, y - ay - vy * t), t]
}

const LIGHT = (() => {
    const v = [-0.55, -0.6, 0.58]
    const l = Math.hypot(...v)
    return v.map((c) => c / l)
})()

function shade(lx, ly, h, rim = 0.25) {
    const L = clamp(lx * LIGHT[0] + ly * LIGHT[1] + h * LIGHT[2])
    return clamp(0.12 + 0.78 * Math.pow(1 - L, 1.3) + rim * Math.pow(1 - h, 3))
}

function buildFly(sc) {
    const s = (v) => v * sc
    const head = ellipse(0, s(-0.335), s(0.165), s(0.11))
    const eyeL = ellipse(s(-0.088), s(-0.34), s(0.088), s(0.104), 0.28)
    const eyeR = ellipse(s(0.088), s(-0.34), s(0.088), s(0.104), -0.28)
    const thorax = ellipse(0, s(-0.12), s(0.158), s(0.145))
    const abdomen = ellipse(0, s(0.15), s(0.142), s(0.175))
    const wings = [-1, 1].map((sg) => {
        const bx = s(0.055) * sg, by = s(-0.13)
        const ang = 0.68 * sg
        const dx = Math.sin(ang), dy = Math.cos(ang)
        return { bx, by, dx, dy, len: s(0.5), w: s(0.125), sg }
    })
    const legs = []
    for (const sg of [-1, 1]) {
        legs.push([[0.09, -0.19], [0.22, -0.29], [0.27, -0.45], [0.31, -0.53]].map(([x, y]) => [s(x * sg), s(y)]))
        legs.push([[0.12, -0.1], [0.29, -0.05], [0.42, 0.04], [0.49, 0.06]].map(([x, y]) => [s(x * sg), s(y)]))
        legs.push([[0.09, -0.02], [0.2, 0.13], [0.26, 0.33], [0.3, 0.44]].map(([x, y]) => [s(x * sg), s(y)]))
    }
    return { head, eyes: [eyeL, eyeR], thorax, abdomen, wings, legs, sc }
}

function wingShape(t) {
    if (t <= 0 || t >= 1) return 0
    return 1.75 * Math.pow(t, 0.55) * Math.pow(1 - t, 0.42)
}

function lineCov(u, p, tone, px, blend) {
    const f = u / p - Math.floor(u / p)
    const d = Math.abs(f - 0.5) * p
    const w = tone * p * 0.5
    const c = clamp((w - d) / px + 0.5)
    return blend >= 1 ? c : c * blend + tone * (1 - blend)
}

function fieldAt(F, x, y, p, px, blend, swell) {
    const ow = 0.0058 * F.sc
    const outline = (d) => clamp((ow - Math.abs(d)) / px + 0.5)
    const T = (t) => clamp(Math.pow(t, 1 / swell))
    let ink = 0
    let covered = false
    let sil = 1e9

    for (const e of F.eyes) {
        const q = e(x, y)
        sil = Math.min(sil, q.d)
        if (covered) continue
        ink = Math.max(ink, outline(q.d))
        if (q.d < 0) {
            covered = true
            const h = Math.sqrt(clamp(1 - q.r2))
            let tone = shade(q.lx, q.ly, h, 0.3) * 0.85 + 0.2
            const hx = q.lx + 0.35, hy = q.ly + 0.4
            tone -= 0.75 * Math.exp(-(hx * hx + hy * hy) * 9)
            tone = T(clamp(tone))
            const cell = p * 0.8
            const gx = (q.lx * 0.088 * F.sc) / (0.55 + 0.45 * h) / cell
            const gy = (q.ly * 0.104 * F.sc) / (0.55 + 0.45 * h) / (cell * 0.866)
            const row = Math.floor(gy + 0.5)
            const ox = row & 1 ? 0.5 : 0
            const fx = gx + ox - Math.floor(gx + ox + 0.5), fy = gy - row
            const dd = Math.hypot(fx, fy * 0.866) * cell
            const rad = Math.sqrt(tone) * cell * 0.56
            const c = clamp((rad - dd) / px + 0.5)
            ink = Math.max(ink, blend >= 1 ? c : c * blend + tone * (1 - blend))
        }
    }

    {
        const q = F.head(x, y)
        sil = Math.min(sil, q.d)
        if (!covered) {
            ink = Math.max(ink, outline(q.d))
            if (q.d < 0) {
                covered = true
                const h = Math.sqrt(clamp(1 - q.r2))
                const tone = T(shade(q.lx, q.ly, h) * 0.8 + 0.12)
                ink = Math.max(ink, lineCov(x - 0.03 * h * Math.sign(x), p * 0.8, tone, px, blend))
            }
        }
    }

    {
        const q = F.thorax(x, y)
        sil = Math.min(sil, q.d)
        if (!covered) {
            ink = Math.max(ink, outline(q.d))
            if (q.d < 0) {
                covered = true
                const h = Math.sqrt(clamp(1 - q.r2))
                let tone = shade(q.lx, q.ly, h) * 0.75
                const ax = Math.abs(q.lx)
                tone += 0.42 * (Math.exp(-((ax - 0.16) ** 2) * 220) + Math.exp(-((ax - 0.55) ** 2) * 160)) * (0.4 + 0.6 * h)
                tone = T(clamp(tone))
                const u = y - 0.07 * F.sc * h
                ink = Math.max(ink, lineCov(u, p, tone, px, blend))
                if (tone > 0.55) ink = Math.max(ink, lineCov(x * 0.8 + y * 0.6, p, (tone - 0.55) * 1.6, px, blend))
            }
        }
    }

    let wingInk = 0
    let inWing = false
    for (const wg of F.wings) {
        const dx = x - wg.bx, dy = y - wg.by
        const a = dx * wg.dx + dy * wg.dy
        const b = (-dx * wg.dy + dy * wg.dx) * wg.sg
        const t = a / wg.len
        const half = wg.w * wingShape(t)
        const edge = Math.abs(b) - half
        if (t > -0.02 && t < 1.02) {
            const sd = t < 0 || t > 1 ? 1 : edge
            sil = Math.min(sil, sd)
            if (!covered && edge < ow * 1.5 && t >= 0 && t <= 1) {
                wingInk = Math.max(wingInk, clamp((ow * 0.8 - Math.abs(edge)) / px + 0.5))
                if (edge < 0) {
                    inWing = true
                    const rel = b / Math.max(half, 1e-6)
                    let tone = 0.12 + 0.3 * Math.pow(1 - t, 2) + 0.12 * (1 - Math.abs(rel))
                    tone = T(tone)
                    const f = Math.sin(t * 3.0) * 0.04
                    wingInk = Math.max(wingInk, lineCov(a * 0.3 + b + f * F.sc * 0.2, p * 0.75, tone, px, blend))
                    for (const vc of [-0.62, -0.18, 0.28, 0.66]) {
                        const vy = half * (vc + 0.12 * Math.sin(t * 4 + vc * 3))
                        const vd = Math.abs(b - vy)
                        const vw = ow * (0.75 - 0.35 * t)
                        if (t > 0.05) wingInk = Math.max(wingInk, clamp((vw - vd) / px + 0.5))
                    }
                    const cross = Math.abs(t - 0.42 - rel * 0.05) * wg.len
                    if (Math.abs(rel) < 0.55) wingInk = Math.max(wingInk, clamp((ow * 0.5 - cross) / px + 0.5))
                }
            }
        }
    }

    {
        const q = F.abdomen(x, y)
        sil = Math.min(sil, q.d)
        if (!covered) {
            let a = outline(q.d)
            if (q.d < 0) {
                const h = Math.sqrt(clamp(1 - q.r2))
                let tone = shade(q.lx, q.ly, h) * 0.7
                const seg = q.ly * 2.2 + 0.2
                tone += 0.3 * smooth(0.55, 0.95, seg - Math.floor(seg))
                tone += 0.35 * Math.exp(-q.lx * q.lx * 40) * smooth(-0.6, 0.2, q.ly)
                tone = T(clamp(tone))
                const th = Math.atan2(q.ly, q.lx)
                const rr = Math.sqrt(q.r2) * 0.15 * F.sc + 0.006 * F.sc * Math.sin(th * 14) * Math.sqrt(q.r2)
                a = Math.max(a, lineCov(rr, p * 0.85, tone, px, blend))
            }
            if (inWing) a *= 0.55
            ink = Math.max(ink, a)
            if (q.d < 0) covered = true
        }
    }
    if (inWing) covered = true
    ink = Math.max(ink, wingInk)

    for (const leg of F.legs) {
        let best = 1e9, bt = 0, bi = 0
        for (let i = 0; i < 3; i++) {
            const [d, t] = segDist(x, y, leg[i][0], leg[i][1], leg[i + 1][0], leg[i + 1][1])
            if (d < best) { best = d; bt = t; bi = i }
        }
        const pos = (bi + bt) / 3
        const r = F.sc * (0.02 - 0.01 * pos) * (1 + 0.25 * Math.sin(bt * Math.PI))
        const d = best - r
        sil = Math.min(sil, d)
        if (!covered) {
            const c = clamp((-d) / px + 0.5)
            if (c > 0) {
                const tone = T(0.82 - 0.35 * Math.exp(-((best / r + 0.3) ** 2) * 3))
                ink = Math.max(ink, Math.max(outline(d), c * lineCov(pos * 0.9 * F.sc, p * 0.5, tone, px, blend)))
            }
            if (bi > 0) {
                const sp = 0.06
                const k = Math.floor(pos / sp * 3)
                if (k % 2 === 0 && best < r * 2.2 && best > r * 0.8) {
                    const fx = (pos / sp * 3) - k
                    if (fx < 0.35) ink = Math.max(ink, clamp((r * 2.2 - best) / (r * 1.4)) * 0.85)
                }
            }
        }
    }

    return { ink, sil }
}

function guilloche(c, S, k, ink) {
    const cx = S / 2, cy = S / 2
    const R = (v) => v * S * 0.5
    c.strokeStyle = ink
    c.lineJoin = 'round'
    const N = 900
    const curve = (fn, lw, alpha = 1) => {
        c.globalAlpha = alpha
        c.lineWidth = lw
        c.beginPath()
        for (let i = 0; i <= N; i++) {
            const t = (i / N) * Math.PI * 2
            const r = R(fn(t))
            const x = cx + Math.cos(t) * r, y = cy + Math.sin(t) * r
            i ? c.lineTo(x, y) : c.moveTo(x, y)
        }
        c.closePath()
        c.stroke()
    }
    const n = Math.round(k.petals)
    const lw = Math.max(0.6, S * 0.0013)
    for (let j = 0; j < 7; j++) {
        const ph = (j / 7) * Math.PI * 2 / n
        curve((t) => 0.655 + 0.038 * Math.sin(n * t + ph * n) * (0.85 + 0.15 * Math.cos(t * 3)), lw)
    }
    for (let j = 0; j < 5; j++) {
        const ph = (j / 5) * Math.PI
        curve((t) => 0.655 + 0.022 * Math.sin(n * 2 * t + ph), lw * 0.8)
    }
    curve(() => 0.6, lw * 1.6)
    curve(() => 0.612, lw * 0.8)
    curve(() => 0.71, lw * 1.6)
    curve(() => 0.698, lw * 0.8)
    const m = n + 6
    for (let ring = 0; ring < 22; ring++) {
        const base = 0.74 + ring * 0.032
        for (let j = 0; j < 2; j++) {
            curve((t) => base + 0.018 * Math.sin(m * t + j * Math.PI + ring * 0.9) + 0.008 * Math.sin(3 * t + ring), lw * 0.75, 0.6)
        }
    }
    c.globalAlpha = 1
    const rose = (x0, y0, rr) => {
        c.lineWidth = lw * 0.7
        const Rb = 1, rb = 3 / 13, db = 0.62
        const M = 2600
        c.beginPath()
        for (let i = 0; i <= M; i++) {
            const t = (i / M) * Math.PI * 2 * 3
            const x = (Rb - rb) * Math.cos(t) + db * Math.cos(((Rb - rb) / rb) * t)
            const y = (Rb - rb) * Math.sin(t) - db * Math.sin(((Rb - rb) / rb) * t)
            const X = x0 + (x / (Rb - rb + db)) * rr, Y = y0 + (y / (Rb - rb + db)) * rr
            i ? c.lineTo(X, Y) : c.moveTo(X, Y)
        }
        c.stroke()
        c.beginPath()
        c.arc(x0, y0, rr * 1.04, 0, Math.PI * 2)
        c.stroke()
    }
    const rr = S * 0.11
    for (const [x, y] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) rose(x * S, y * S, rr)
    if (k.microtext) {
        c.fillStyle = ink
        const fs = S * 0.0165
        c.font = `600 ${fs}px "Helvetica Neue", Arial, sans-serif`
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        const word = 'BUGGED · NO TRACKERS · '
        const rr2 = R(0.578)
        const step = (fs * 0.6) / rr2
        const total = Math.floor((Math.PI * 2) / step / word.length) * word.length
        for (let i = 0; i < total; i++) {
            const a = i * ((Math.PI * 2) / total) - Math.PI / 2
            c.save()
            c.translate(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2)
            c.rotate(a + Math.PI / 2)
            c.fillText(word[i % word.length], 0, 0)
            c.restore()
        }
    }
}

let cache = { key: '', canvas: null }

function render(S, k) {
    const cv = new OffscreenCanvas(S, S)
    const c = cv.getContext('2d')
    const paper = hex(k.paper)
    const inkRGB = hex(k.ink)
    c.fillStyle = k.paper
    c.fillRect(0, 0, S, S)
    const r = rng(7)
    c.lineCap = 'round'
    for (let i = 0; i < 70; i++) {
        c.strokeStyle = i % 3 ? 'rgba(200,60,70,0.45)' : 'rgba(60,90,190,0.45)'
        c.lineWidth = Math.max(0.5, S * (0.0015 + r() * 0.0015))
        const x = r() * S, y = r() * S, a = r() * Math.PI * 2, l = S * (0.015 + r() * 0.03)
        c.beginPath()
        c.moveTo(x, y)
        c.quadraticCurveTo(x + Math.cos(a + 0.8) * l * 0.6, y + Math.sin(a + 0.8) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l)
        c.stroke()
    }
    const img = c.getImageData(0, 0, S, S)
    const d = img.data
    const F = buildFly(k.scale)
    const px = 2 / S
    const p = 2 / k.density
    const blend = smooth(1.6, 3.2, p / px)
    const med = 0.565
    for (let j = 0; j < S; j++) {
        const y = ((j + 0.5) / S) * 2 - 1
        for (let i = 0; i < S; i++) {
            const x = ((i + 0.5) / S) * 2 - 1
            const o = (j * S + i) * 4
            const g = (vnoise(i * 0.9 * 512 / S, j * 0.9 * 512 / S) - 0.5) * 6 + (vnoise(x * 6, y * 6) - 0.5) * 10
            d[o] = clamp(d[o] + g, 0, 255)
            d[o + 1] = clamp(d[o + 1] + g, 0, 255)
            d[o + 2] = clamp(d[o + 2] + g * 0.9, 0, 255)
            const rr = Math.hypot(x, y)
            if (rr > med + 0.01) continue
            const yy = y - 0.035
            let ink = 0
            let sil = 1
            if (Math.abs(x) < 0.6 && yy > -0.6 && yy < 0.6) {
                const f = fieldAt(F, x, yy, p, px, blend, k.swell)
                ink = f.ink
                sil = f.sil
            }
            const halo = smooth(0.012, 0.045, sil)
            const bgTone = (0.07 + 0.22 * smooth(0.3, med, rr)) * halo
            const wav = y + 0.004 * Math.sin(x * 40)
            const edge = clamp((med - rr) / px + 0.5)
            ink = Math.max(ink, lineCov(wav, p * 0.62, Math.pow(bgTone, 1 / k.swell), px, blend) * edge)
            if (ink <= 0) continue
            const n = hash(i, j)
            ink = clamp(ink * (0.9 + 0.1 * n) * 1.02)
            const a = ink * 0.96
            d[o] = d[o] + (inkRGB[0] - d[o]) * a
            d[o + 1] = d[o + 1] + (inkRGB[1] - d[o + 1]) * a
            d[o + 2] = d[o + 2] + (inkRGB[2] - d[o + 2]) * a
        }
    }
    c.putImageData(img, 0, 0)
    guilloche(c, S, k, k.ink)
    return cv
}

export default {
    id: 'engraving',
    name: 'Banknote fly',
    note: 'An intaglio housefly in swelling hatch lines, compound eyes as dot stipple, set in a guilloché medallion on fibred security paper.',
    defaults: { ink: '#1f3d34', paper: '#ebe7d3', density: 120, swell: 1.45, petals: 24, scale: 1, microtext: true },
    schema: [
        { group: 'Ink' },
        { key: 'ink', label: 'Ink', type: 'color' },
        { key: 'paper', label: 'Paper', type: 'color' },
        { group: 'Engraving' },
        { key: 'density', label: 'Line density', type: 'range', min: 70, max: 180, step: 1 },
        { key: 'swell', label: 'Line swell', type: 'range', min: 0.6, max: 1.6, step: 0.01 },
        { key: 'scale', label: 'Fly size', type: 'range', min: 0.8, max: 1.15, step: 0.01 },
        { group: 'Security' },
        { key: 'petals', label: 'Rosette petals', type: 'range', min: 12, max: 40, step: 1 },
        { key: 'microtext', label: 'Microprint', type: 'toggle' },
    ],
    draw(c, S, k) {
        const key = S + JSON.stringify(k)
        if (cache.key !== key) cache = { key, canvas: render(S, k) }
        c.drawImage(cache.canvas, 0, 0)
    },
}
