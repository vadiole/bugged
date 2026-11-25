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
function rng(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

const SOLID = 'rgb(255,0,0)'
const KNOCK = 'rgb(0,0,255)'
const tone = (a) => `rgba(0,255,0,${a})`

function layerCanvas(S) {
    const cv = new OffscreenCanvas(S, S)
    const c = cv.getContext('2d')
    c.fillStyle = '#000'
    c.fillRect(0, 0, S, S)
    c.setTransform(S / 2, 0, 0, S / 2, S / 2, S / 2)
    c.globalCompositeOperation = 'lighter'
    return [cv, c]
}

const PIVOT = [-0.07, -0.12]
const ROT = -0.8
const SC = 1.22
const OPEN = 0.46
const CUT = [0.1, 0.06]

function bladePath(sg) {
    const p = new Path2D()
    p.moveTo(-0.016 * sg, -0.03)
    p.lineTo(-0.006 * sg, 0.44)
    p.bezierCurveTo(0.1 * sg, 0.36, 0.14 * sg, 0.12, 0.1 * sg, -0.03)
    p.bezierCurveTo(0.085 * sg, -0.07, 0.04 * sg, -0.09, 0.0, -0.09)
    p.closePath()
    return p
}
function bladeShine(sg) {
    const p = new Path2D()
    p.moveTo(0.03 * sg, 0.05)
    p.lineTo(0.012 * sg, 0.33)
    p.lineTo(0.024 * sg, 0.29)
    p.lineTo(0.046 * sg, 0.05)
    p.closePath()
    return p
}
function handlePath(sg) {
    const p = new Path2D()
    p.moveTo(-0.012 * sg, -0.04)
    p.bezierCurveTo(0.02 * sg, -0.12, 0.05 * sg, -0.15, 0.06 * sg, -0.2)
    p.lineTo(0.14 * sg, -0.18)
    p.bezierCurveTo(0.1 * sg, -0.12, 0.07 * sg, -0.07, 0.055 * sg, -0.03)
    p.closePath()
    p.ellipse(0.12 * sg, -0.32, 0.125, 0.15, 0.2 * sg, 0, Math.PI * 2)
    return p
}
function handleHole(sg) {
    const p = new Path2D()
    p.ellipse(0.12 * sg, -0.32, 0.062, 0.088, 0.2 * sg, 0, Math.PI * 2)
    return p
}

function bez(p0, p1, p2, p3, n = 60) {
    const pts = []
    for (let i = 0; i <= n; i++) {
        const t = i / n, u = 1 - t
        pts.push([
            u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        ])
    }
    return pts
}
function tailPoints() {
    return bez([-0.16, 0.36], [0.0, 0.42], [-0.08, 0.14], [CUT[0] - 0.03, CUT[1] + 0.03])
}
function cutPoints() {
    const a = bez([CUT[0] + 0.045, CUT[1] - 0.035], [0.3, -0.06], [0.5, -0.02], [0.5, -0.22], 40)
    const b = bez([0.5, -0.22], [0.5, -0.42], [0.26, -0.44], [0.27, -0.28], 40)
    const c = bez([0.27, -0.28], [0.28, -0.18], [0.4, -0.2], [0.39, -0.28], 20)
    return [...a, ...b.slice(1), ...c.slice(1)]
}
function strokePts(c, pts, w) {
    c.lineWidth = w
    c.lineCap = 'butt'
    c.lineJoin = 'round'
    c.beginPath()
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
    c.stroke()
}

function textAlong(c, pts, text, size) {
    const seg = []
    let total = 0
    for (let i = 1; i < pts.length; i++) {
        const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
        seg.push(l)
        total += l
    }
    c.save()
    c.fillStyle = KNOCK
    c.font = `700 ${size}px "Courier New", Menlo, monospace`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    const adv = size * 0.62
    let s = size * 0.8, i = 0, acc = 0
    for (const ch of text) {
        while (i < seg.length && acc + seg[i] < s) acc += seg[i++]
        if (i >= seg.length || s > total - size * 0.5) break
        const t = (s - acc) / seg[i]
        const a = pts[i], b = pts[i + 1]
        c.save()
        c.translate(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        c.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]))
        c.fillText(ch, 0, 0)
        c.restore()
        s += adv
    }
    c.restore()
}

function drawLayers(S) {
    const [aCv, a] = layerCanvas(S)
    const [bCv, b] = layerCanvas(S)

    const sun = b.createRadialGradient(0.12, -0.06, 0.0, 0.12, -0.06, 0.64)
    sun.addColorStop(0, tone(0.42))
    sun.addColorStop(0.8, tone(0.16))
    sun.addColorStop(1, tone(0.0))
    b.fillStyle = sun
    b.beginPath()
    b.arc(0.12, -0.06, 0.64, 0, Math.PI * 2)
    b.fill()
    a.fillStyle = tone(0.3)
    a.beginPath()
    a.arc(0.12, -0.06, 0.64, 0, Math.PI * 2)
    a.fill()

    const floor = b.createLinearGradient(0, 0.3, 0, 1)
    floor.addColorStop(0, tone(0))
    floor.addColorStop(1, tone(0.55))
    b.fillStyle = floor
    b.fillRect(-1, 0.3, 2, 0.8)

    b.strokeStyle = SOLID
    strokePts(b, tailPoints(), 0.052)
    strokePts(b, cutPoints(), 0.058)

    for (const L of [a, b]) textAlong(L, cutPoints(), '?utm_source=newsletter&utm_medium=email&fbclid=IwAR2xq', 0.036)

    b.save()
    b.translate(-0.33, 0.36)
    b.fillStyle = SOLID
    b.beginPath()
    b.ellipse(0.02, 0, 0.2, 0.15, -0.08, 0, Math.PI * 2)
    b.fill()
    b.beginPath()
    b.moveTo(-0.08, -0.1)
    b.bezierCurveTo(-0.2, -0.1, -0.3, -0.01, -0.33, 0.07)
    b.bezierCurveTo(-0.27, 0.12, -0.12, 0.14, -0.04, 0.1)
    b.fill()
    b.beginPath()
    b.ellipse(-0.1, -0.17, 0.095, 0.1, -0.3, 0, Math.PI * 2)
    b.fill()
    b.fillStyle = KNOCK
    b.beginPath()
    b.arc(-0.19, -0.015, 0.024, 0, Math.PI * 2)
    b.fill()
    b.restore()
    a.save()
    a.translate(-0.33, 0.36)
    a.fillStyle = SOLID
    a.beginPath()
    a.ellipse(-0.1, -0.17, 0.055, 0.062, -0.3, 0, Math.PI * 2)
    a.fill()
    a.beginPath()
    a.arc(-0.325, 0.07, 0.028, 0, Math.PI * 2)
    a.fill()
    a.fillStyle = tone(0.55)
    a.beginPath()
    a.ellipse(0.04, 0.03, 0.13, 0.08, -0.08, 0, Math.PI * 2)
    a.fill()
    a.restore()

    const scissor = (L, fn) => {
        for (const sg of [-1, 1]) {
            L.save()
            L.translate(PIVOT[0], PIVOT[1])
            L.rotate(ROT)
            L.scale(SC, SC)
            L.rotate(OPEN * sg * 0.5)
            fn(sg)
            L.restore()
        }
    }
    a.fillStyle = SOLID
    scissor(a, (sg) => {
        a.fillStyle = SOLID
        a.fill(handlePath(sg))
        a.fill(bladePath(sg))
        a.fillStyle = KNOCK
        a.fill(handleHole(sg))
        a.fill(bladeShine(sg))
    })
    scissor(b, (sg) => {
        b.fillStyle = KNOCK
        b.fill(handleHole(sg))
        b.fill(bladeShine(sg))
        const h = b.createLinearGradient(0.05 * sg, -0.2, 0.2 * sg, -0.46)
        h.addColorStop(0, tone(0.6))
        h.addColorStop(1, tone(0.0))
        b.fillStyle = h
        b.fill(handlePath(sg))
        b.fillStyle = KNOCK
        b.fill(handleHole(sg))
    })
    b.fillStyle = SOLID
    b.beginPath()
    b.arc(PIVOT[0], PIVOT[1], 0.03, 0, Math.PI * 2)
    b.fill()
    a.fillStyle = KNOCK
    b.fillStyle = KNOCK
    for (const L of [a, b]) {
        L.beginPath()
        L.arc(PIVOT[0], PIVOT[1], 0.011, 0, Math.PI * 2)
        L.fill()
    }

    a.strokeStyle = SOLID
    a.lineCap = 'round'
    a.lineWidth = 0.016
    for (const ang of [-2.1, -1.55, 0.35, 0.95, 2.5]) {
        a.beginPath()
        a.moveTo(CUT[0] + Math.cos(ang) * 0.075, CUT[1] + Math.sin(ang) * 0.075)
        a.lineTo(CUT[0] + Math.cos(ang) * 0.13, CUT[1] + Math.sin(ang) * 0.13)
        a.stroke()
    }
    return [aCv.getContext('2d').getImageData(0, 0, S, S).data, bCv.getContext('2d').getImageData(0, 0, S, S).data]
}

function render(S, k) {
    const cv = new OffscreenCanvas(S, S)
    const c = cv.getContext('2d')
    const [A, B] = drawLayers(S)
    const paper = hex(k.paper)
    const inks = [hex(k.inkA), hex(k.inkB)].map((v) => v.map((x) => x / 255))
    const img = c.createImageData(S, S)
    const d = img.data
    const cell = S / k.screen
    const blend = smooth(2.2, 4.5, cell)
    const sc = 512 / S
    const mis = k.misreg * S
    const layers = [
        { data: A, ang: (15 * Math.PI) / 180, dx: 0, dy: 0, rot: 0, seed: 1 },
        { data: B, ang: (75 * Math.PI) / 180, dx: mis * 0.8, dy: -mis * 0.6, rot: k.misreg * 0.5, seed: 9 },
    ]
    for (const L of layers) {
        L.ca = Math.cos(L.ang)
        L.sa = Math.sin(L.ang)
        L.cr = Math.cos(L.rot)
        L.sr = Math.sin(L.rot)
    }
    const sample = (D, x, y) => {
        const i = x | 0, j = y | 0
        if (i < 0 || j < 0 || i >= S || j >= S) return [0, 0, 0]
        const o = (j * S + i) * 4
        return [D[o] / 255, D[o + 1] / 255, D[o + 2] / 255]
    }
    const g = k.grain
    for (let j = 0; j < S; j++) {
        for (let i = 0; i < S; i++) {
            const o = (j * S + i) * 4
            const px = i * sc, py = j * sc
            const pg = (hash(i * 3 + 1, j * 7 + 2) - 0.5) * 0.05 + (vnoise(px * 0.5, py * 0.08) - 0.5) * 0.03
            let r = (paper[0] / 255) * (1 + pg), gg = (paper[1] / 255) * (1 + pg), bb = (paper[2] / 255) * (1 + pg)
            for (const L of layers) {
                const cx = i + 0.5 - S / 2, cy = j + 0.5 - S / 2
                const sx = cx * L.cr - cy * L.sr + S / 2 - L.dx, sy = cx * L.sr + cy * L.cr + S / 2 - L.dy
                const [solid, dens, knock] = sample(L.data, sx, sy)
                if (solid <= 0 && dens <= 0) continue
                let ink = solid
                if (dens > 0) {
                    const u = (sx * L.ca + sy * L.sa) / cell, v = (-sx * L.sa + sy * L.ca) / cell
                    const f = 0.5 + 0.25 * (Math.cos(u * Math.PI * 2) + Math.cos(v * Math.PI * 2))
                    const t = dens > 0.97 ? 1 : clamp((f - (1 - dens)) * cell * 0.9 + 0.5)
                    ink = Math.max(ink, t * blend + dens * (1 - blend))
                }
                ink *= 1 - knock
                if (ink <= 0) continue
                const mott = 0.8 + 0.2 * vnoise(px * 0.04 + L.seed * 13, py * 0.04)
                const streak = 1 - 0.14 * g * smooth(0.55, 0.85, vnoise(px * 0.012 + L.seed * 5, py * 0.7 + L.seed))
                const speck = smooth(0.66, 0.8, vnoise(px * 0.55 + L.seed * 31, py * 0.55)) * 0.75 + (hash(i + L.seed * 999, j) > 0.985 ? 0.6 : 0)
                ink *= clamp(1 - g * (1 - mott) - g * speck * 0.6) * streak
                const ic = L === layers[0] ? inks[0] : inks[1]
                r *= 1 - ink * (1 - ic[0])
                gg *= 1 - ink * (1 - ic[1])
                bb *= 1 - ink * (1 - ic[2])
            }
            d[o] = clamp(r * 255, 0, 255)
            d[o + 1] = clamp(gg * 255, 0, 255)
            d[o + 2] = clamp(bb * 255, 0, 255)
            d[o + 3] = 255
        }
    }
    c.putImageData(img, 0, 0)
    return cv
}

let cache = { key: '', canvas: null }

export default {
    id: 'riso',
    name: 'Snip riso',
    note: 'Two-drum risograph: pink shears clip a mouse’s ridiculous tail, which curls off as a question mark, with drifting registration and starved ink.',
    defaults: { inkA: '#ff48b0', inkB: '#0078bf', paper: '#f3eee2', misreg: 0.014, screen: 64, grain: 0.7 },
    schema: [
        { group: 'Drums' },
        { key: 'inkA', label: 'Drum 1', type: 'color' },
        { key: 'inkB', label: 'Drum 2', type: 'color' },
        { key: 'paper', label: 'Paper', type: 'color' },
        { group: 'Press' },
        { key: 'misreg', label: 'Misregistration', type: 'range', min: 0, max: 0.04, step: 0.001 },
        { key: 'screen', label: 'Halftone lines', type: 'range', min: 30, max: 110, step: 1 },
        { key: 'grain', label: 'Ink starve', type: 'range', min: 0, max: 1.5, step: 0.01 },
    ],
    draw(c, S, k) {
        const key = S + JSON.stringify(k)
        if (cache.key !== key) cache = { key, canvas: render(S, k) }
        c.drawImage(cache.canvas, 0, 0)
    },
}
