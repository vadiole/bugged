const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)
}
const hex = (h) => {
    const n = parseInt(h.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
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
function fbm(x, y, o = 4) {
    let s = 0, a = 0.5, n = 0
    for (let i = 0; i < o; i++) {
        s += a * vnoise(x, y)
        n += a
        x = x * 2.03 + 17.1
        y = y * 2.03 + 3.7
        a *= 0.5
    }
    return s / n
}
function rng(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function gouge(c, pts, w, r, { head = 0.25, tail = 0.12, wobble = 0.12 } = {}) {
    const n = pts.length
    const L = [], R = []
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1)
        const p = pts[i], q = pts[Math.min(n - 1, i + 1)], o = pts[Math.max(0, i - 1)]
        let tx = q[0] - o[0], ty = q[1] - o[1]
        const l = Math.hypot(tx, ty) || 1
        tx /= l
        ty /= l
        const prof = Math.pow(smooth(0, head, t), 0.7) * (t > 1 - tail ? Math.sqrt(clamp((1 - t) / tail)) : 1)
        const ww = w * 0.5 * prof * (1 + (r() - 0.5) * wobble)
        L.push([p[0] - ty * ww, p[1] + tx * ww])
        R.push([p[0] + ty * ww, p[1] - tx * ww])
    }
    c.beginPath()
    c.moveTo(L[0][0], L[0][1])
    for (const p of L) c.lineTo(p[0], p[1])
    for (let i = R.length - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1])
    c.closePath()
    c.fill()
}
const line = (a, b, n = 12, bend = 0) => {
    const out = []
    const nx = -(b[1] - a[1]), ny = b[0] - a[0]
    for (let i = 0; i <= n; i++) {
        const t = i / n
        const s = Math.sin(t * Math.PI) * bend
        out.push([a[0] + (b[0] - a[0]) * t + nx * s, a[1] + (b[1] - a[1]) * t + ny * s])
    }
    return out
}
const arc = (cx, cy, r, a0, a1, n = 24) => {
    const out = []
    for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n
        out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
    }
    return out
}

function handPath() {
    const p = new Path2D()
    p.moveTo(-0.12, -0.145)
    p.bezierCurveTo(0.0, -0.15, 0.14, -0.14, 0.235, -0.13)
    p.bezierCurveTo(0.3, -0.125, 0.315, -0.03, 0.245, -0.022)
    p.bezierCurveTo(0.15, -0.015, 0.05, -0.02, -0.01, -0.02)
    p.bezierCurveTo(0.02, 0.01, 0.02, 0.09, -0.04, 0.115)
    p.bezierCurveTo(-0.12, 0.16, -0.22, 0.2, -0.32, 0.2)
    p.bezierCurveTo(-0.45, 0.2, -0.6, 0.22, -1.3, 0.3)
    p.lineTo(-1.3, -0.06)
    p.bezierCurveTo(-0.7, -0.09, -0.5, -0.12, -0.4, -0.16)
    p.bezierCurveTo(-0.3, -0.2, -0.2, -0.15, -0.12, -0.145)
    p.closePath()
    return p
}
function thumbPath() {
    const p = new Path2D()
    p.moveTo(-0.3, 0.0)
    p.bezierCurveTo(-0.2, -0.01, -0.06, 0.0, 0.0, 0.015)
    p.bezierCurveTo(0.05, 0.03, 0.05, 0.085, 0.0, 0.085)
    p.bezierCurveTo(-0.08, 0.085, -0.2, 0.1, -0.27, 0.11)
    p.closePath()
    return p
}

const HAND = { x: -0.19, y: 0.34, rot: -0.62, sc: 1.32 }
const BUG = { x: 0.35, y: -0.33, rot: 2.5, s: 0.16 }

function drawBlock(S, k) {
    const cv = new OffscreenCanvas(S, S)
    const c = cv.getContext('2d')
    const r = rng(5)
    c.fillStyle = '#000'
    c.fillRect(0, 0, S, S)
    c.setTransform(S / 2, 0, 0, S / 2, S / 2, S / 2)
    const W = k.gouge
    const tip = (() => {
        const ca = Math.cos(HAND.rot), sa = Math.sin(HAND.rot)
        const lx = 0.3, ly = -0.075
        return [HAND.x + (lx * ca - ly * sa) * HAND.sc, HAND.y + (lx * sa + ly * ca) * HAND.sc]
    })()

    c.fillStyle = '#fff'
    for (let i = 0; i < 90; i++) {
        const a = r() * Math.PI * 2
        const rr = 0.2 + r() * 1.2
        const cx = Math.cos(a) * rr, cy = Math.sin(a) * rr
        if (Math.hypot(cx - BUG.x, cy - BUG.y) < 0.3) continue
        const len = 0.05 + r() * 0.12
        const da = a + Math.PI / 2 + (r() - 0.5) * 0.3
        const pts = line([cx, cy], [cx + Math.cos(da) * len, cy + Math.sin(da) * len], 10, (r() - 0.5) * 0.2)
        if (r() < k.chatter * 0.9) gouge(c, pts, W * (0.25 + r() * 0.35), r)
    }

    for (let i = 0; i < 7; i++) {
        const spread = (i / 6 - 0.5) * 1.6
        const dir = Math.atan2(BUG.y - tip[1], BUG.x - tip[0]) + spread
        const r0 = 0.055 + r() * 0.02, r1 = 0.13 + r() * 0.06 - Math.abs(spread) * 0.05
        const pts = line([tip[0] + Math.cos(dir) * r0, tip[1] + Math.sin(dir) * r0], [tip[0] + Math.cos(dir) * r1, tip[1] + Math.sin(dir) * r1], 10, (r() - 0.5) * 0.1)
        gouge(c, pts, W * (0.9 + r() * 0.5), r, { head: 0.15, tail: 0.5 })
    }

    for (let j = 0; j < 2; j++) {
        const rad = BUG.s * (1.45 + j * 0.42)
        let a = -0.3 + j * 0.9 + r()
        const end = a + Math.PI * 2
        while (a < end - 0.4) {
            const len = 0.5 + r() * 0.9
            const b = Math.min(end - 0.2, a + len)
            gouge(c, arc(BUG.x, BUG.y, rad + (r() - 0.5) * 0.01, a, b, 20), W * (0.7 - j * 0.12), r, { head: 0.3, tail: 0.3 })
            a = b + 0.25 + r() * 0.4
        }
    }

    c.save()
    c.translate(HAND.x, HAND.y)
    c.rotate(HAND.rot)
    c.scale(HAND.sc, HAND.sc)
    const hand = handPath()
    if (k.echo) {
        c.lineJoin = 'round'
        for (const o of [0.05, 0.095]) {
            c.strokeStyle = '#fff'
            c.lineWidth = 2 * o + W * 0.55
            c.stroke(hand)
            c.strokeStyle = '#000'
            c.lineWidth = 2 * o - W * 0.55
            c.stroke(hand)
        }
        c.fillStyle = '#000'
        for (let i = 0; i < 26; i++) {
            const x = -0.9 + r() * 1.3, y = -0.35 + r() * 0.7
            c.beginPath()
            c.ellipse(x, y, 0.012 + r() * 0.02, 0.05, r() * 3, 0, Math.PI * 2)
            c.fill()
        }
    }
    c.fillStyle = '#fff'
    c.fill(hand)
    c.fillStyle = '#000'
    for (let i = 0; i < 6; i++) {
        const y = -0.03 - i * 0.017
        const x0 = -0.08 + r() * 0.05, x1 = 0.17 + r() * 0.05
        gouge(c, line([x0, y + 0.002], [x1, y - 0.004], 12, 0.02), W * (0.55 - i * 0.07), r, { head: 0.35, tail: 0.4 })
    }
    for (let i = 0; i < 7; i++) {
        const x = -0.38 + i * 0.05
        gouge(c, line([x, 0.2], [x + 0.03, 0.06 + r() * 0.03], 8), W * 0.6, r, { head: 0.2, tail: 0.6 })
    }
    for (let i = 0; i < 5; i++) {
        const y = -0.05 + i * 0.05
        gouge(c, line([-1.0, y + 0.03 + i * 0.008], [-0.45 - r() * 0.05, y - 0.02], 12, 0.03), W * 0.5, r, { head: 0.1, tail: 0.5 })
    }
    c.lineCap = 'round'
    c.strokeStyle = '#000'
    c.lineWidth = W * 0.55
    c.beginPath()
    c.moveTo(-0.58, -0.14)
    c.bezierCurveTo(-0.55, -0.02, -0.56, 0.1, -0.6, 0.23)
    c.stroke()
    c.lineWidth = W * 0.35
    for (const [x, len] of [[0.02, 0.05], [0.14, 0.04]]) {
        c.beginPath()
        c.moveTo(x, -0.035)
        c.quadraticCurveTo(x + 0.012, -0.08, x - 0.002, -0.08 - len * 0.6)
        c.stroke()
    }
    c.lineWidth = W * 0.32
    c.beginPath()
    c.moveTo(0.19, -0.12)
    c.bezierCurveTo(0.27, -0.12, 0.285, -0.075, 0.27, -0.06)
    c.bezierCurveTo(0.24, -0.068, 0.2, -0.075, 0.19, -0.12)
    c.stroke()
    for (const [x0, y0, x1, y1] of [[-0.09, -0.02, -0.03, 0.11], [-0.16, -0.06, -0.12, 0.13], [-0.24, -0.1, -0.21, 0.16]]) {
        gouge(c, line([x0, y0], [x1, y1], 10, -0.05), W * 0.55, r, { head: 0.2, tail: 0.3 })
    }
    c.fillStyle = '#000'
    gouge(c, line([-0.3, -0.005], [0.03, 0.02], 14, -0.06), W * 0.7, r, { head: 0.15, tail: 0.25 })
    for (let i = 0; i < 4; i++) {
        gouge(c, line([-0.25, 0.1 - i * 0.012], [-0.03 - i * 0.02, 0.078 - i * 0.008], 10, -0.04), W * 0.4, r, { head: 0.3, tail: 0.5 })
    }
    c.restore()

    c.fillStyle = '#fff'
    c.save()
    c.translate(tip[0] + 0.035, tip[1] - 0.04)
    c.beginPath()
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2
        const rr = i % 2 ? 0.022 : 0.055 + (i % 4 === 0 ? 0.015 : 0)
        i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
    }
    c.closePath()
    c.fill()
    c.restore()

    c.save()
    c.translate(BUG.x, BUG.y)
    c.rotate(BUG.rot)
    c.scale(BUG.s, BUG.s)
    c.fillStyle = '#fff'
    c.strokeStyle = '#fff'
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.lineWidth = 0.11
    const legs = [
        [[0.45, -0.35], [0.85, -0.6], [0.95, -0.95]],
        [[0.55, 0.05], [1.0, -0.02], [1.2, -0.32]],
        [[0.45, 0.45], [0.85, 0.65], [0.92, 1.0]],
    ]
    for (const sg of [-1, 1]) {
        for (const leg of legs) {
            c.beginPath()
            c.moveTo(leg[0][0] * sg * 0.8, leg[0][1])
            c.lineTo(leg[1][0] * sg, leg[1][1])
            c.lineTo(leg[2][0] * sg, leg[2][1])
            c.stroke()
        }
        c.beginPath()
        c.moveTo(0.18 * sg, -0.95)
        c.quadraticCurveTo(0.5 * sg, -1.4, 0.75 * sg, -1.45)
        c.stroke()
    }
    c.beginPath()
    c.ellipse(0, 0.1, 0.62, 0.82, 0, 0, Math.PI * 2)
    c.fill()
    c.beginPath()
    c.ellipse(0, -0.82, 0.33, 0.25, 0, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#000'
    for (let i = 0; i < 4; i++) {
        const y = -0.25 + i * 0.28
        gouge(c, line([-0.5 + Math.abs(i - 1.5) * 0.06, y], [0.5 - Math.abs(i - 1.5) * 0.06, y + 0.02], 10, 0.08), 0.09, r, { head: 0.3, tail: 0.3 })
    }
    gouge(c, line([0, -0.62], [0.0, 0.85], 10), 0.07, r, { head: 0.2, tail: 0.3 })
    c.restore()

    c.fillStyle = '#fff'
    for (const [a, rr, l] of [[2.2, 0.21, 0.1], [2.75, 0.2, 0.08], [1.6, 0.22, 0.08]]) {
        const sx = BUG.x + Math.cos(a) * rr, sy = BUG.y + Math.sin(a) * rr
        gouge(c, line([sx, sy], [sx + Math.cos(a) * l, sy + Math.sin(a) * l], 6), W * 0.8, r, { head: 0.2, tail: 0.4 })
    }

    c.setTransform(1, 0, 0, 1, 0, 0)
    return c.getImageData(0, 0, S, S).data
}

function render(S, k) {
    const cv = new OffscreenCanvas(S, S)
    const c = cv.getContext('2d')
    const M = drawBlock(S, k)
    const paper = hex(k.paper)
    const ink = hex(k.ink)
    const img = c.createImageData(S, S)
    const d = img.data
    const sc = 512 / S
    const sample = (x, y) => {
        x = clamp(x, 0, S - 1.001)
        y = clamp(y, 0, S - 1.001)
        const i = x | 0, j = y | 0, fx = x - i, fy = y - j
        const o = (j * S + i) * 4
        const a = M[o], b = M[o + 4], cc = M[o + S * 4], dd = M[o + S * 4 + 4]
        return 1 - (a + (b - a) * fx + (cc - a) * fy + (a - b - cc + dd) * fx * fy) / 255
    }
    const un = k.uneven
    for (let j = 0; j < S; j++) {
        for (let i = 0; i < S; i++) {
            const px = i * sc, py = j * sc
            const wx = (vnoise(px * 0.08, py * 0.08) - 0.5) * 2.4 + (hash(i, j) - 0.5) * 0.6
            const wy = (vnoise(px * 0.08 + 40, py * 0.08) - 0.5) * 2.4
            let m = sample(i + wx / sc, j + wy / sc)
            m = smooth(0.35, 0.65, m)
            const grain = fbm(px * 0.35, py * 0.35, 3)
            const press = fbm(px * 0.012 + 3, py * 0.012, 3)
            const starve = smooth(0.72 - un * 0.06, 0.86, grain + (0.5 - press) * 0.4 * un)
            const pin = hash(i * 7 + 3, j * 13 + 1) > 1 - 0.006 * un ? 0.7 : 0
            const dens = clamp(1 - starve * 0.85 - pin) * (0.9 + 0.1 * press)
            const a = m * dens
            const pg = (fbm(px * 0.6, py * 0.6, 2) - 0.5) * 0.08 + (vnoise(px * 0.03, py * 0.03) - 0.5) * 0.05
            const o = (j * S + i) * 4
            for (let ch = 0; ch < 3; ch++) {
                const pv = paper[ch] * (1 + pg)
                d[o + ch] = clamp(pv + (ink[ch] - pv) * a, 0, 255)
            }
            d[o + 3] = 255
        }
    }
    c.putImageData(img, 0, 0)
    return cv
}

let cache = { key: '', canvas: null }

export default {
    id: 'linocut',
    name: 'Flick linocut',
    note: 'A hand-cut block print: a finger flicks a beetle off into the dark, the cut lines fanning out with the force of it.',
    defaults: { ink: '#191613', paper: '#efe5cf', gouge: 0.03, uneven: 1, chatter: 0.6, echo: true },
    schema: [
        { group: 'Print' },
        { key: 'ink', label: 'Ink', type: 'color' },
        { key: 'paper', label: 'Paper', type: 'color' },
        { key: 'uneven', label: 'Uneven ink', type: 'range', min: 0, max: 2, step: 0.01 },
        { group: 'Carving' },
        { key: 'gouge', label: 'Gouge width', type: 'range', min: 0.015, max: 0.05, step: 0.001 },
        { key: 'chatter', label: 'Chatter', type: 'range', min: 0, max: 1, step: 0.01 },
        { key: 'echo', label: 'Echo cuts', type: 'toggle' },
    ],
    draw(c, S, k) {
        const key = S + JSON.stringify(k)
        if (cache.key !== key) cache = { key, canvas: render(S, k) }
        c.drawImage(cache.canvas, 0, 0)
    },
}
