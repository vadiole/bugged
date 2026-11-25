const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)
}
const hex = (h) => {
    const n = parseInt(h.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mixc = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`
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
        x = x * 2.07 + 11.3
        y = y * 2.07 + 5.1
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

const SW = 0.86, SH = 1.0
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif'

function stampPath(hole) {
    const p = new Path2D()
    p.rect(-SW / 2, -SH / 2, SW, SH)
    const nx = 13, ny = Math.round((nx * SH) / SW)
    for (let i = 0; i <= nx; i++) {
        const x = -SW / 2 + (SW * i) / nx
        for (const y of [-SH / 2, SH / 2]) {
            p.moveTo(x + hole, y)
            p.arc(x, y, hole, 0, Math.PI * 2)
        }
    }
    for (let j = 1; j < ny; j++) {
        const y = -SH / 2 + (SH * j) / ny
        for (const x of [-SW / 2, SW / 2]) {
            p.moveTo(x + hole, y)
            p.arc(x, y, hole, 0, Math.PI * 2)
        }
    }
    return p
}

function fitText(c, text, x, y, w, h, weight = 800) {
    c.font = `${weight} ${h}px ${FONT}`
    const m = c.measureText(text).width
    c.save()
    c.translate(x, y)
    c.scale(Math.min(1, w / m), 1)
    c.fillText(text, 0, 0)
    c.restore()
}

function beetle(c, accent) {
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.strokeStyle = '#141414'
    c.lineWidth = 0.016
    const legs = [
        [[0.07, -0.1], [0.15, -0.15], [0.17, -0.24]],
        [[0.1, -0.01], [0.2, 0.0], [0.25, -0.06]],
        [[0.09, 0.08], [0.18, 0.15], [0.2, 0.25]],
    ]
    for (const sg of [-1, 1]) {
        for (const l of legs) {
            c.beginPath()
            c.moveTo(l[0][0] * sg, l[0][1])
            c.lineTo(l[1][0] * sg, l[1][1])
            c.lineTo(l[2][0] * sg, l[2][1])
            c.stroke()
        }
        c.lineWidth = 0.011
        c.beginPath()
        c.moveTo(0.025 * sg, -0.2)
        c.quadraticCurveTo(0.06 * sg, -0.27, 0.11 * sg, -0.29)
        c.stroke()
        c.lineWidth = 0.016
    }
    const body = (fill, stroke = true) => {
        c.fillStyle = fill
        c.beginPath()
        c.ellipse(0, -0.19, 0.045, 0.035, 0, 0, Math.PI * 2)
        c.fill()
        if (stroke) c.stroke()
        c.beginPath()
        c.ellipse(0, -0.115, 0.095, 0.058, 0, 0, Math.PI * 2)
        c.fill()
        if (stroke) c.stroke()
        c.beginPath()
        c.moveTo(0, -0.07)
        c.bezierCurveTo(0.12, -0.075, 0.135, 0.03, 0.12, 0.1)
        c.bezierCurveTo(0.1, 0.2, 0.03, 0.24, 0, 0.245)
        c.bezierCurveTo(-0.03, 0.24, -0.1, 0.2, -0.12, 0.1)
        c.bezierCurveTo(-0.135, 0.03, -0.12, -0.075, 0, -0.07)
        c.fill()
        if (stroke) c.stroke()
    }
    const g = c.createLinearGradient(-0.12, -0.2, 0.14, 0.24)
    g.addColorStop(0, '#5fd08a')
    g.addColorStop(0.45, '#1c8a55')
    g.addColorStop(1, '#0b3a2a')
    c.lineWidth = 0.012
    body(g)
    c.save()
    c.globalAlpha = 0.85
    c.strokeStyle = rgb(accent)
    c.lineWidth = 0.014
    c.beginPath()
    c.moveTo(0.1, -0.03)
    c.bezierCurveTo(0.12, 0.05, 0.11, 0.14, 0.04, 0.215)
    c.stroke()
    c.beginPath()
    c.moveTo(-0.1, -0.03)
    c.bezierCurveTo(-0.12, 0.05, -0.11, 0.14, -0.04, 0.215)
    c.stroke()
    c.restore()
    c.strokeStyle = '#141414'
    c.lineWidth = 0.009
    c.beginPath()
    c.moveTo(0, -0.07)
    c.lineTo(0, 0.24)
    c.stroke()
    c.fillStyle = 'rgba(230,255,235,0.45)'
    for (const sg of [-1, 1]) {
        c.beginPath()
        c.ellipse(-0.055 * sg + (sg < 0 ? 0.0 : 0), 0.02, 0.016, 0.07, 0.12 * sg, 0, Math.PI * 2)
        c.fill()
    }
    c.beginPath()
    c.ellipse(-0.035, -0.125, 0.03, 0.013, -0.2, 0, Math.PI * 2)
    c.fill()
}

function design(c, k, r) {
    const bg = hex(k.stampColor)
    const iw = SW - 0.09, ih = SH - 0.09
    c.save()
    c.beginPath()
    c.rect(-iw / 2, -ih / 2, iw, ih)
    c.clip()
    c.fillStyle = rgb(bg)
    c.fillRect(-iw / 2, -ih / 2, iw, ih)
    c.fillStyle = rgb(mixc(bg, [255, 236, 190], 0.35))
    for (let i = 0; i < 24; i++) {
        const a0 = (i / 24) * Math.PI * 2, a1 = a0 + Math.PI / 24
        c.beginPath()
        c.moveTo(0, 0.02)
        c.lineTo(Math.cos(a0) * 0.8, 0.02 + Math.sin(a0) * 0.8)
        c.lineTo(Math.cos(a1) * 0.8, 0.02 + Math.sin(a1) * 0.8)
        c.fill()
    }
    const glow = c.createRadialGradient(0, 0.02, 0.02, 0, 0.02, 0.3)
    glow.addColorStop(0, 'rgba(255,245,215,0.65)')
    glow.addColorStop(1, 'rgba(255,245,215,0)')
    c.fillStyle = glow
    c.fillRect(-iw / 2, -ih / 2, iw, ih)
    const band = mixc(bg, [20, 20, 30], 0.55)
    c.fillStyle = rgb(band)
    c.fillRect(-iw / 2, -ih / 2, iw, 0.12)
    c.save()
    c.translate(0, 0.035)
    c.scale(1.18, 1.18)
    beetle(c, mixc(bg, [255, 120, 40], 0.5))
    c.restore()
    c.fillStyle = '#fbf6ea'
    c.textAlign = 'center'
    c.textBaseline = 'alphabetic'
    fitText(c, 'BUGGED', 0.04, -ih / 2 + 0.095, iw - 0.18, 0.085, 900)
    c.textAlign = 'left'
    c.font = `900 0.15px ${FONT}`
    c.fillStyle = '#fbf6ea'
    c.fillText('0', -iw / 2 + 0.03, -ih / 2 + 0.115)
    c.restore()
    c.strokeStyle = '#fbf6ea'
    c.lineWidth = 0.008
    c.strokeRect(-iw / 2 + 0.018, -ih / 2 + 0.018, iw - 0.036, ih - 0.036)
}

function pointingHand(c) {
    c.beginPath()
    c.roundRect(-0.07, -0.035, 0.07, 0.075, 0.018)
    c.fill()
    c.beginPath()
    c.roundRect(-0.01, -0.035, 0.1, 0.026, 0.013)
    c.fill()
    c.fillRect(-0.105, -0.03, 0.03, 0.065)
}

function inkMasks(S, k, tf) {
    const make = () => {
        const cv = new OffscreenCanvas(S, S)
        const c = cv.getContext('2d')
        c.setTransform(S / 2, 0, 0, S / 2, S / 2, S / 2)
        c.fillStyle = '#fff'
        c.strokeStyle = '#fff'
        return [cv, c]
    }
    const [pCv, p] = make()
    p.lineWidth = 0.022
    p.lineCap = 'butt'
    for (let i = 0; i < 6; i++) {
        const y0 = -0.58 + i * 0.07
        p.beginPath()
        for (let s = 0; s <= 80; s++) {
            const x = 0.08 + s * 0.012
            const y = y0 + Math.sin(x * 15 + 0.6) * 0.03 + x * 0.12
            s ? p.lineTo(x, y) : p.moveTo(x, y)
        }
        p.stroke()
    }
    const dx = -0.36, dy = -0.4, R = 0.23
    p.lineWidth = 0.02
    p.beginPath()
    p.arc(dx, dy, R, 0, Math.PI * 2)
    p.stroke()
    p.lineWidth = 0.011
    p.beginPath()
    p.arc(dx, dy, R * 0.64, 0, Math.PI * 2)
    p.stroke()
    p.font = `800 0.052px ${FONT}`
    p.textAlign = 'center'
    p.textBaseline = 'middle'
    const word = 'BUGGED · LINK OFFICE · '
    for (let i = 0; i < word.length; i++) {
        const a = -Math.PI * 0.95 + (i / word.length) * Math.PI * 2
        p.save()
        p.translate(dx + Math.cos(a) * R * 0.82, dy + Math.sin(a) * R * 0.82)
        p.rotate(a + Math.PI / 2)
        p.fillText(word[i], 0, 0)
        p.restore()
    }
    p.font = `800 0.06px ${FONT}`
    p.fillText('25 NOV', dx, dy - 0.03)
    p.font = `800 0.05px ${FONT}`
    p.fillText('2026', dx, dy + 0.04)

    const [rCv, rc] = make()
    rc.save()
    rc.translate(0.03, 0.29)
    rc.rotate(-k.rtsAngle * Math.PI / 180)
    const bw = 1.16, bh = 0.33
    rc.lineWidth = 0.03
    rc.strokeRect(-bw / 2, -bh / 2, bw, bh)
    rc.lineWidth = 0.012
    rc.strokeRect(-bw / 2 + 0.025, -bh / 2 + 0.025, bw - 0.05, bh - 0.05)
    rc.textAlign = 'left'
    rc.textBaseline = 'alphabetic'
    rc.save()
    rc.translate(-bw / 2 + 0.14, 0.0)
    rc.scale(1.5, 1.5)
    pointingHand(rc)
    rc.restore()
    fitText(rc, 'RETURN TO', -bw / 2 + 0.28, -0.012, bw - 0.33, 0.118, 900)
    fitText(rc, 'SENDER', -bw / 2 + 0.28, 0.105, bw - 0.33, 0.118, 900)
    rc.restore()

    const blur = (src, amt) => {
        const cv = new OffscreenCanvas(S, S)
        const c = cv.getContext('2d')
        c.filter = `blur(${Math.max(0.3, amt * S / 512)}px)`
        c.drawImage(src, 0, 0)
        return c.getImageData(0, 0, S, S).data
    }
    return [blur(pCv, 0.3 + k.bleed * 0.9), blur(rCv, 0.3 + k.bleed * 0.9)]
}

function render(S, k) {
    const cv = new OffscreenCanvas(S, S)
    const c = cv.getContext('2d')
    const r = rng(3)
    const kraft = hex(k.envelope)
    c.fillStyle = rgb(kraft)
    c.fillRect(0, 0, S, S)
    c.lineCap = 'round'
    for (let i = 0; i < 260; i++) {
        const dark = r() < 0.6
        c.strokeStyle = dark ? 'rgba(70,40,15,0.18)' : 'rgba(255,240,210,0.2)'
        c.lineWidth = Math.max(0.4, S * 0.0012 * (0.5 + r()))
        const x = r() * S, y = r() * S, a = r() * Math.PI, l = S * (0.01 + r() * 0.035)
        c.beginPath()
        c.moveTo(x, y)
        c.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l)
        c.stroke()
    }
    const tilt = (k.tilt * Math.PI) / 180
    const T = [0.0, -0.01]
    const hole = SW / 13 * 0.3
    c.save()
    c.setTransform(S / 2, 0, 0, S / 2, S / 2 + S * 0.008, S / 2 + S * 0.012)
    c.translate(T[0], T[1])
    c.rotate(tilt)
    c.filter = `blur(${S * 0.006}px)`
    c.fillStyle = 'rgba(40,20,5,0.4)'
    c.fill(stampPath(hole), 'evenodd')
    c.restore()
    c.filter = 'none'
    c.save()
    c.setTransform(S / 2, 0, 0, S / 2, S / 2, S / 2)
    c.translate(T[0], T[1])
    c.rotate(tilt)
    c.fillStyle = '#f6f1e4'
    c.fill(stampPath(hole), 'evenodd')
    design(c, k, r)
    c.restore()

    const img = c.getImageData(0, 0, S, S)
    const d = img.data
    const [PM, RM] = inkMasks(S, k)
    const black = hex(k.cancelInk), red = hex(k.rtsInk)
    const sc = 512 / S
    const ca = Math.cos(-tilt), sa = Math.sin(-tilt)
    const iw = SW - 0.09, ih = SH - 0.09
    for (let j = 0; j < S; j++) {
        for (let i = 0; i < S; i++) {
            const o = (j * S + i) * 4
            const px = i * sc, py = j * sc
            const x = ((i + 0.5) / S) * 2 - 1 - T[0], y = ((j + 0.5) / S) * 2 - 1 - T[1]
            const lx = x * ca - y * sa, ly = x * sa + y * ca
            const inStamp = Math.abs(lx) < SW / 2 && Math.abs(ly) < SH / 2
            const inDesign = Math.abs(lx) < iw / 2 && Math.abs(ly) < ih / 2
            let g = (fbm(px * 0.25, py * 0.25, 3) - 0.5) * (inStamp ? 0.05 : 0.1) + (vnoise(px * 0.02, py * 0.02) - 0.5) * 0.06
            let rr = d[o] * (1 + g), gg = d[o + 1] * (1 + g), bb = d[o + 2] * (1 + g)
            if (inDesign) {
                const su = (lx * 0.966 - ly * 0.259) * 140, sv = (lx * 0.259 + ly * 0.966) * 140
                const dot = 0.5 + 0.25 * (Math.cos(su * Math.PI * 2 * (S / 512) ** 0) + Math.cos(sv * Math.PI * 2))
                const f = 0.94 + 0.06 * dot
                rr *= f
                gg *= f
                bb *= f
            }
            const fib = fbm(px * 0.18 + 7, py * 0.9, 3)
            const fib2 = fbm(px * 0.9, py * 0.18 + 3, 3)
            const fiber = Math.max(fib, fib2)
            for (const [M, ink, seed] of [[PM, black, 1], [RM, red, 2]]) {
                const m = M[o + 3] / 255
                if (m < 0.02) continue
                const thr = 0.42 - k.bleed * 0.22 * (fiber - 0.3)
                let a = smooth(thr - 0.12, thr + 0.12, m)
                const rub = fbm(px * 0.05 + seed * 20, py * 0.05, 4)
                const speck = fbm(px * 0.4 + seed * 50, py * 0.4, 2)
                const wr = k.wear * (seed === 2 ? 0.6 : 1)
                a *= clamp(1.25 - smooth(0.35, 0.7, rub) * 0.85 * wr) * (1 - smooth(0.6, 0.72, speck) * 0.7 * wr)
                a *= 0.82 + 0.18 * smooth(0.45, 0.9, m)
                const edge = smooth(0.3, 0.55, m) * (1 - smooth(0.7, 1.0, m))
                a = clamp(a + edge * 0.15 * a)
                const op = seed === 2 ? 0.97 : 0.88
                rr *= 1 - a * op * (1 - ink[0] / 255)
                gg *= 1 - a * op * (1 - ink[1] / 255)
                bb *= 1 - a * op * (1 - ink[2] / 255)
            }
            d[o] = clamp(rr, 0, 255)
            d[o + 1] = clamp(gg, 0, 255)
            d[o + 2] = clamp(bb, 0, 255)
        }
    }
    c.putImageData(img, 0, 0)
    return cv
}

let cache = { key: '', canvas: null }

export default {
    id: 'stamp',
    name: 'Returned beetle',
    note: 'A zero-value beetle stamp on a kraft envelope, cancelled with wavy postmarks and bounced with a red RETURN TO SENDER, ink feathering into the fibres.',
    defaults: { stampColor: '#e0742f', envelope: '#c7a274', cancelInk: '#1d1c22', rtsInk: '#c8202b', bleed: 1, wear: 1, tilt: -6, rtsAngle: 14 },
    schema: [
        { group: 'Stamp' },
        { key: 'stampColor', label: 'Stamp ink', type: 'color' },
        { key: 'envelope', label: 'Envelope', type: 'color' },
        { key: 'tilt', label: 'Stamp tilt', type: 'range', min: -15, max: 15, step: 0.5, unit: '°' },
        { group: 'Rubber stamps' },
        { key: 'rtsInk', label: 'Return ink', type: 'color' },
        { key: 'cancelInk', label: 'Postmark ink', type: 'color' },
        { key: 'rtsAngle', label: 'Return angle', type: 'range', min: -30, max: 30, step: 0.5, unit: '°' },
        { key: 'bleed', label: 'Ink bleed', type: 'range', min: 0, max: 2.5, step: 0.01 },
        { key: 'wear', label: 'Worn rubber', type: 'range', min: 0, max: 2, step: 0.01 },
    ],
    draw(c, S, k) {
        const key = S + JSON.stringify(k)
        if (cache.key !== key) cache = { key, canvas: render(S, k) }
        c.drawImage(cache.canvas, 0, 0)
    },
}
