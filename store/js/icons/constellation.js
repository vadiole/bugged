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
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

const STARS = {
    head: [0.004, -0.165, 1.9, 'γ'],
    thorax: [0, -0.085, 2.2, 'δ'],
    belly: [0.006, 0.03, 1.7, 'ε'],
    tail: [-0.004, 0.165, 2.6],
    antL1: [-0.055, -0.235, 3.8],
    antL2: [-0.115, -0.275, 3.1],
    antR1: [0.06, -0.24, 4],
    antR2: [0.12, -0.27, 3.3],
    fwL: [-0.305, -0.185, 2.4, 'ζ'],
    foL: [-0.3, -0.005, 3],
    hoL: [-0.225, 0.14, 2.9],
    htL: [-0.1, 0.215, 3.4],
    fwR: [0.31, -0.175, 2.3, 'η'],
    foR: [0.295, 0.005, 3.2],
    hoR: [0.215, 0.15, 2.8],
    htR: [0.105, 0.22, 3.6],
    eyeL: [-0.175, -0.065, 0.3, 'α', true],
    eyeR: [0.17, -0.06, 0.5, 'β', true],
}
const LINKS = [
    ['antL2', 'antL1'], ['antL1', 'head'], ['antR2', 'antR1'], ['antR1', 'head'], ['head', 'thorax'], ['thorax', 'belly'], ['belly', 'tail'],
    ['thorax', 'fwL'], ['fwL', 'foL'], ['foL', 'belly'], ['belly', 'hoL'], ['hoL', 'htL'], ['htL', 'tail'],
    ['thorax', 'fwR'], ['fwR', 'foR'], ['foR', 'belly'], ['belly', 'hoR'], ['hoR', 'htR'], ['htR', 'tail'],
]
const WING = [[0, -0.09], [-0.12, -0.17], [-0.33, -0.2], [-0.33, -0.1], [-0.3, 0.0], [-0.06, 0.03], [-0.25, 0.1], [-0.24, 0.17], [-0.12, 0.235], [-0.02, 0.17]]

const plates = new Map()
function plate(S, color, density) {
    const key = S + color + density
    if (plates.has(key)) return plates.get(key)
    const cv = document.createElement('canvas')
    cv.width = cv.height = S
    const c = cv.getContext('2d')
    const img = c.createImageData(S, S)
    const p = hex(color)
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const u = x / S
            const v = y / S
            const band = Math.exp(-(((u - v) * 0.7 + 0.12 + (vnoise(u * 3, v * 3, 4) - 0.5) * 0.25) ** 2) / 0.02)
            const cloud = vnoise(u * 9, v * 9, 1) * 0.6 + vnoise(u * 24, v * 24, 2) * 0.4
            const glow = band * (0.4 + cloud * 0.9) * 0.16
            const grain = vnoise(u * 400, v * 400, 3) * 0.05
            const r = Math.hypot(u - 0.5, v - 0.5)
            const vig = 1 - r * r * 0.9
            const o = (y * S + x) * 4
            img.data[o] = (p[0] * (0.95 + grain) + 210 * glow) * vig
            img.data[o + 1] = (p[1] * (0.95 + grain) + 200 * glow) * vig
            img.data[o + 2] = (p[2] * (0.95 + grain) + 180 * glow) * vig
            img.data[o + 3] = 255
        }
    }
    c.putImageData(img, 0, 0)
    const n = Math.round(420 * density)
    for (let i = 0; i < n; i++) {
        const x = hash(i, 1, 9)
        const y = hash(i, 2, 9)
        const band = Math.exp(-(((x - y) * 0.7 + 0.12) ** 2) / 0.02)
        if (hash(i, 5, 9) > 0.35 + band * 0.65) continue
        const m = Math.pow(hash(i, 3, 9), 3)
        const r = (0.35 + m * 1.6) * (S / 432)
        c.fillStyle = `rgba(240,232,210,${0.35 + m * 0.6})`
        c.beginPath()
        c.arc(x * S, y * S, Math.max(0.3, r), 0, Math.PI * 2)
        c.fill()
    }
    plates.set(key, cv)
    if (plates.size > 4) plates.delete(plates.keys().next().value)
    return cv
}

export default {
    id: 'constellation',
    name: 'Noctua Vigilans',
    note: 'A plate from a star atlas that never existed: the Watching Moth, two first-magnitude eyes on its wings.',
    defaults: { plate: '#101c38', ink: '#e9c977', grid: 12, figure: true, label: true, field: 1 },
    schema: [
        { group: 'Plate' },
        { key: 'plate', label: 'Plate', type: 'color' },
        { key: 'ink', label: 'Gilt', type: 'color' },
        { key: 'field', label: 'Faint stars', type: 'range', min: 0, max: 2, step: 0.05 },
        { key: 'grid', label: 'Sky turn', type: 'range', min: -30, max: 30, step: 1, unit: '°' },
        { group: 'Engraving' },
        { key: 'figure', label: 'Figure drawing', type: 'toggle' },
        { key: 'label', label: 'Name', type: 'toggle' },
    ],
    draw(c, S, k) {
        const ink = hex(k.ink)
        const cream = [236, 228, 206]
        c.save()
        c.setTransform(1, 0, 0, 1, 0, 0)
        c.drawImage(plate(S, k.plate, k.field), 0, 0)
        c.translate(S / 2, S / 2)
        c.scale(S, S)
        const px = 1 / S
        const hair = Math.max(0.0012, 0.6 * px)
        c.save()
        c.rotate((k.grid * Math.PI) / 180)
        const pole = [0.18, -1.35]
        c.strokeStyle = rgba(cream, 0.28)
        c.lineWidth = hair
        for (let i = 0; i < 14; i++) {
            const r = 0.95 + i * 0.12
            c.beginPath()
            c.arc(pole[0], pole[1], r, Math.PI * 0.2, Math.PI * 0.8)
            c.stroke()
        }
        for (let i = -8; i <= 8; i++) {
            const a = Math.PI / 2 + i * 0.075
            c.beginPath()
            c.moveTo(pole[0] + Math.cos(a) * 0.9, pole[1] + Math.sin(a) * 0.9)
            c.lineTo(pole[0] + Math.cos(a) * 2.8, pole[1] + Math.sin(a) * 2.8)
            c.stroke()
        }
        c.strokeStyle = rgba(cream, 0.4)
        c.setLineDash([0.012, 0.008])
        c.lineWidth = hair * 1.4
        c.beginPath()
        c.moveTo(-0.7, 0.3)
        c.bezierCurveTo(-0.2, 0.18, 0.2, 0.42, 0.7, 0.28)
        c.stroke()
        c.setLineDash([])
        c.fillStyle = rgba(cream, 0.5)
        c.font = `italic ${0.022}px Georgia, 'Times New Roman', serif`
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        const hours = ['XI', 'XII', 'XIII', 'XIV', 'XV']
        hours.forEach((h, i) => {
            const a = Math.PI / 2 + (i - 2) * 0.15
            const r = 1.35 + 0.06
            c.fillText(h + 'ʰ', pole[0] + Math.cos(a) * 1.81, pole[1] + Math.sin(a) * 1.81)
        })
        c.restore()
        if (k.figure) {
            c.save()
            c.lineJoin = 'round'
            const wings = new Path2D()
            for (const sx of [1, -1]) {
                const w = WING.map(([x, y]) => [x * sx, y])
                wings.moveTo(w[0][0], w[0][1])
                wings.bezierCurveTo(w[1][0], w[1][1], w[2][0], w[2][1], w[2][0], w[2][1])
                wings.quadraticCurveTo(w[3][0], w[3][1], w[4][0], w[4][1])
                wings.quadraticCurveTo(w[5][0] - 0.1 * sx, w[5][1] - 0.02, w[5][0], w[5][1])
                wings.quadraticCurveTo(w[6][0], w[6][1], w[7][0], w[7][1])
                wings.quadraticCurveTo(w[8][0], w[8][1], w[9][0], w[9][1])
                wings.closePath()
            }
            c.save()
            c.clip(wings)
            c.lineWidth = hair * 0.8
            c.strokeStyle = rgba(cream, 0.16)
            for (let i = -60; i < 60; i++) {
                const x = i * 0.007
                c.beginPath()
                c.moveTo(x - 0.25, -0.3)
                c.lineTo(x + 0.25, 0.3)
                c.stroke()
            }
            c.strokeStyle = rgba(cream, 0.3)
            c.lineWidth = hair
            for (const [x, y] of [[-0.175, -0.065], [0.17, -0.06]]) {
                for (const r of [0.04, 0.055]) {
                    c.beginPath()
                    c.arc(x, y, r, 0, Math.PI * 2)
                    c.stroke()
                }
            }
            c.restore()
            c.strokeStyle = rgba(cream, 0.5)
            c.lineWidth = hair * 1.6
            c.stroke(wings)
            c.beginPath()
            c.ellipse(0, 0.02, 0.026, 0.16, 0, 0, Math.PI * 2)
            c.stroke()
            c.restore()
        }
        const boost = Math.max(1, Math.min(1.8, 140 / S))
        const radius = (m) => (0.018 - m * 0.0033) * 1.15 * boost
        c.lineCap = 'round'
        c.strokeStyle = rgba(ink, 0.85)
        c.lineWidth = Math.max(0.0035, 1.1 * px) * boost
        for (const [a, b] of LINKS) {
            const [x1, y1, m1] = STARS[a]
            const [x2, y2, m2] = STARS[b]
            const dx = x2 - x1
            const dy = y2 - y1
            const l = Math.hypot(dx, dy)
            const g1 = radius(m1) + 0.012
            const g2 = radius(m2) + 0.012
            c.beginPath()
            c.moveTo(x1 + (dx / l) * g1, y1 + (dy / l) * g1)
            c.lineTo(x2 - (dx / l) * g2, y2 - (dy / l) * g2)
            c.stroke()
        }
        for (const [x, y, m, , eye] of Object.values(STARS)) {
            const r = radius(m)
            if (eye) {
                c.strokeStyle = rgba(ink, 0.9)
                c.lineWidth = Math.max(hair * 1.4, 0.9 * px)
                c.beginPath()
                c.arc(x, y, r * 2.3, 0, Math.PI * 2)
                c.stroke()
            }
            const g = c.createRadialGradient(x, y, 0, x, y, r * 3.2)
            g.addColorStop(0, rgba(ink, 0.35))
            g.addColorStop(1, rgba(ink, 0))
            c.fillStyle = g
            c.beginPath()
            c.arc(x, y, r * 3.2, 0, Math.PI * 2)
            c.fill()
            if (m < 2.7) {
                c.fillStyle = rgba(ink, 1)
                c.beginPath()
                const n = m < 1 ? 8 : 6
                for (let i = 0; i < n * 2; i++) {
                    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
                    const rr = i % 2 ? r * 0.75 : r * 1.65
                    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
                }
                c.closePath()
                c.fill()
            }
            c.fillStyle = rgba(ink, 1)
            c.beginPath()
            c.arc(x, y, r, 0, Math.PI * 2)
            c.fill()
            c.strokeStyle = rgba([20, 18, 30], 0.6)
            c.lineWidth = Math.max(0.0015, 0.5 * px)
            c.stroke()
            c.strokeStyle = rgba(ink, 0.6)
            c.lineWidth = hair
            c.beginPath()
            c.arc(x, y, r + 0.006, 0, Math.PI * 2)
            if (m < 2) c.stroke()
        }
        c.fillStyle = rgba(cream, 0.85)
        c.font = `italic ${0.028}px Georgia, 'Times New Roman', serif`
        c.textAlign = 'left'
        c.textBaseline = 'middle'
        for (const [x, y, m, l] of Object.values(STARS)) if (l) c.fillText(l, x + radius(m) + 0.014, y - radius(m) - 0.008)
        if (k.label) {
            const text = 'NOCTUA  VIGILANS'
            c.font = `${0.036}px 'Didot', 'Bodoni 72', Georgia, serif`
            c.fillStyle = rgba(cream, 0.9)
            const R = 0.392
            const spacing = 0.036
            const total = (text.length - 1) * spacing
            const a0 = Math.PI / 2 + total / R / 2
            for (let i = 0; i < text.length; i++) {
                const a = a0 - (i * spacing) / R
                c.save()
                c.translate(Math.cos(a) * R, Math.sin(a) * R)
                c.rotate(a - Math.PI / 2)
                c.textAlign = 'center'
                c.fillText(text[i], 0, 0)
                c.restore()
            }
        }
        c.strokeStyle = rgba(cream, 0.5)
        c.lineWidth = hair * 1.5
        c.beginPath()
        c.arc(0, 0, 0.455, 0, Math.PI * 2)
        c.stroke()
        c.beginPath()
        c.arc(0, 0, 0.475, 0, Math.PI * 2)
        c.stroke()
        for (let i = 0; i < 360; i += 2) {
            const a = (i * Math.PI) / 180
            const l = i % 10 === 0 ? 0.02 : 0.01
            c.beginPath()
            c.moveTo(Math.cos(a) * 0.455, Math.sin(a) * 0.455)
            c.lineTo(Math.cos(a) * (0.455 + l), Math.sin(a) * (0.455 + l))
            c.stroke()
        }
        c.restore()
    },
}
