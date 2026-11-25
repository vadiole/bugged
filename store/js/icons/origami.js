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
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1
    return [a[0] / l, a[1] / l, a[2] / l]
}


const mirror = (pts) => pts.map(([x, y]) => [-x, y]).reverse()
const WING = [[-0.01, -0.145], [-0.315, -0.05], [-0.195, 0.335], [-0.035, 0.13]]
const LAYERS = [
    { pts: [[-0.2, -0.15], [0.2, -0.15], [0, 0.4]], n: [0, 0.05, 1], z: 0.006 },
    { pts: WING, n: [-0.32, 0.12, 0.94], z: 0.02, wing: true },
    { pts: mirror(WING), n: [0.32, 0.12, 0.94], z: 0.026, wing: true },
    { pts: [[-0.205, -0.15], [0.205, -0.15], [0, 0.085]], n: [0, 0.22, 0.97], z: 0.04, back: true },
    { pts: [[-0.15, -0.15], [0.15, -0.15], [0, 0.02]], n: [0, 0.3, 0.95], z: 0.048 },
    { pts: [[-0.23, -0.255], [0.23, -0.255], [0.205, -0.148], [-0.205, -0.148]], n: [0, -0.45, 0.89], z: 0.052 },
    { pts: [[-0.23, -0.255], [-0.17, -0.255], [-0.212, -0.19]], n: [-0.4, -0.4, 0.82], z: 0.058, back: true },
    { pts: [[0.23, -0.255], [0.212, -0.19], [0.17, -0.255]], n: [0.4, -0.4, 0.82], z: 0.058, back: true },
]

const tex = new Map()
function grain(S, paper) {
    const key = S + paper
    if (tex.has(key)) return tex.get(key)
    const cv = document.createElement('canvas')
    cv.width = cv.height = S
    const c = cv.getContext('2d')
    const img = c.createImageData(S, S)
    const sc = S / 432
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const n = vnoise(x / (1.4 * sc), y / (1.4 * sc), 1) * 0.5 + vnoise(x / (6 * sc), y / (6 * sc), 2) * 0.5
            const f = vnoise(x / (40 * sc), y / (1.6 * sc), 3)
            const v = 228 + n * 27 - (f > 0.8 ? (f - 0.8) * 70 : 0)
            const o = (y * S + x) * 4
            img.data[o] = img.data[o + 1] = img.data[o + 2] = v
            img.data[o + 3] = 255
        }
    }
    c.putImageData(img, 0, 0)
    c.globalAlpha = 0.18
    c.lineCap = 'round'
    for (let i = 0; i < 260; i++) {
        const x = hash(i, 1, 5) * S
        const y = hash(i, 2, 5) * S
        const a = hash(i, 3, 5) * Math.PI * 2
        const l = (4 + hash(i, 4, 5) * 14) * sc
        c.strokeStyle = hash(i, 6, 5) > 0.5 ? '#fff' : '#b8b0a0'
        c.lineWidth = 0.6 * sc
        c.beginPath()
        c.moveTo(x, y)
        c.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l)
        c.stroke()
    }
    tex.set(key, cv)
    if (tex.size > 4) tex.delete(tex.keys().next().value)
    return cv
}

const tables = new Map()
function table(S, color) {
    const key = S + color
    if (tables.has(key)) return tables.get(key)
    const cv = document.createElement('canvas')
    cv.width = cv.height = S
    const c = cv.getContext('2d')
    const img = c.createImageData(S, S)
    const t = hex(color)
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const u = x / S
            const v = y / S
            const n = vnoise(u * 300, v * 300, 7) * 0.5 + vnoise(u * 60, v * 60, 8) * 0.5
            const f = 0.96 + n * 0.08
            const o = (y * S + x) * 4
            for (let ch = 0; ch < 3; ch++) img.data[o + ch] = t[ch] * f
            img.data[o + 3] = 255
        }
    }
    c.putImageData(img, 0, 0)
    tables.set(key, cv)
    if (tables.size > 4) tables.delete(tables.keys().next().value)
    return cv
}


export default {
    id: 'origami',
    name: 'Paper cicada',
    note: 'The first thing everyone folds, left on the table: a kami cicada, coloured side up, white showing at the folds.',
    defaults: { paper: '#2d5fbf', table: '#d9d2c3', light: 300, height: 42, back: '#f7f3ea' },
    schema: [
        { group: 'Paper' },
        { key: 'paper', label: 'Kami', type: 'color' },
        { key: 'back', label: 'Reverse', type: 'color' },
        { key: 'table', label: 'Table', type: 'color' },
        { group: 'Light' },
        { key: 'light', label: 'Window', type: 'range', min: 0, max: 360, step: 1, unit: '°' },
        { key: 'height', label: 'Sun height', type: 'range', min: 15, max: 80, step: 1, unit: '°' },
    ],
    draw(c, S, k) {
        const az = (k.light * Math.PI) / 180
        const el = (k.height * Math.PI) / 180
        const L = [Math.sin(az) * Math.cos(el), -Math.cos(az) * Math.cos(el), Math.sin(el)]
        const scale = 1.0
        const P = ([x, y]) => [S / 2 + x * S * scale, S / 2 + (y - 0.07) * S * scale]
        const front = hex(k.paper)
        const back = hex(k.back)
        const layer = () => {
            const cv = document.createElement('canvas')
            cv.width = cv.height = S
            return [cv, cv.getContext('2d')]
        }
        const poly = (x, pts, dx = 0, dy = 0) => {
            x.beginPath()
            pts.forEach((p, i) => {
                const [px, py] = P(p)
                if (i) x.lineTo(px + dx, py + dy)
                else x.moveTo(px + dx, py + dy)
            })
            x.closePath()
        }
        const cast = (z) => [(-L[0] / L[2]) * z * S * scale, (-L[1] / L[2]) * z * S * scale]
        c.save()
        c.setTransform(1, 0, 0, 1, 0, 0)
        c.drawImage(table(S, k.table), 0, 0)
        const lg = c.createLinearGradient(S / 2 + L[0] * S * 0.7, S / 2 + L[1] * S * 0.7, S / 2 - L[0] * S * 0.7, S / 2 - L[1] * S * 0.7)
        lg.addColorStop(0, 'rgba(255,250,240,0.25)')
        lg.addColorStop(0.55, 'rgba(255,250,240,0)')
        lg.addColorStop(1, 'rgba(40,30,20,0.28)')
        c.fillStyle = lg
        c.fillRect(0, 0, S, S)
        const [sh, sx] = layer()
        sx.fillStyle = '#000'
        for (const l of LAYERS) {
            const [dx, dy] = cast(l.z + 0.012)
            poly(sx, l.pts, dx, dy)
            sx.fill()
        }
        const [ao, ax] = layer()
        ax.fillStyle = '#000'
        for (const l of LAYERS) {
            poly(ax, l.pts)
            ax.fill()
        }
        c.globalAlpha = 0.22
        c.filter = `blur(${S * 0.035}px)`
        c.drawImage(ao, 0, 0)
        c.globalAlpha = 0.38
        c.filter = `blur(${S * 0.012}px)`
        c.drawImage(sh, 0, 0)
        c.globalAlpha = 0.45
        c.filter = `blur(${S * 0.0025}px)`
        c.drawImage(ao, 0, 0)
        c.filter = 'none'
        c.globalAlpha = 1
        const [ob, ox] = layer()
        ox.lineJoin = 'round'
        const hair = Math.max(0.6, S / 520)
        LAYERS.forEach((l, i) => {
            if (i > 0) {
                const [dx, dy] = cast(l.z - LAYERS[0].z)
                ox.save()
                ox.globalCompositeOperation = 'source-atop'
                ox.filter = `blur(${S * 0.006}px)`
                ox.fillStyle = 'rgba(20,10,0,0.36)'
                poly(ox, l.pts, dx * 0.7, dy * 0.7)
                ox.fill()
                ox.restore()
            }
            const n = norm(l.n)
            const lit = Math.max(0, dot(n, L))
            const b = (l.back ? 0.62 : 0.42) + 0.62 * lit
            const base = l.back ? back : front
            const warm = [0.85, 1, 1.25]
            const col = base.map((ch, j) => clamp((ch * Math.pow(Math.min(1.15, b), warm[j])) / 255) * 255)
            const [x0, y0] = P(l.pts[0])
            const [x1, y1] = P(l.pts[Math.floor(l.pts.length / 2)])
            const g = ox.createLinearGradient(x0, y0, x1, y1)
            const lift = (f) => `rgb(${Math.min(255, col[0] * f) | 0},${Math.min(255, col[1] * f) | 0},${Math.min(255, col[2] * f) | 0})`
            g.addColorStop(0, lift(l.wing ? 1.06 : 1.03))
            g.addColorStop(1, lift(l.wing ? 0.9 : 0.96))
            ox.fillStyle = g
            poly(ox, l.pts)
            ox.fill()
            const m = l.pts.length
            for (let e = 0; e < m; e++) {
                const a = l.pts[e]
                const bb = l.pts[(e + 1) % m]
                const ex = bb[0] - a[0]
                const ey = bb[1] - a[1]
                const len = Math.hypot(ex, ey)
                const nx = ey / len
                const ny = -ex / len
                const cx = l.pts.reduce((s2, p) => s2 + p[0], 0) / m
                const cy = l.pts.reduce((s2, p) => s2 + p[1], 0) / m
                const out = (a[0] + bb[0]) / 2 - cx
                const outy = (a[1] + bb[1]) / 2 - cy
                const sgn = out * nx + outy * ny > 0 ? 1 : -1
                const facing = (nx * sgn * L[0] + ny * sgn * L[1]) / Math.hypot(L[0], L[1])
                const [pa, pb] = [P(a), P(bb)]
                ox.lineWidth = hair
                ox.strokeStyle = facing > 0 ? `rgba(255,252,244,${0.35 + 0.45 * facing})` : `rgba(40,12,0,${0.2 - 0.25 * facing})`
                ox.beginPath()
                ox.moveTo(pa[0], pa[1])
                ox.lineTo(pb[0], pb[1])
                ox.stroke()
            }
        })
        const crease = (a, b2, light) => {
            const [pa, pb] = [P(a), P(b2)]
            ox.lineWidth = hair * 0.8
            ox.strokeStyle = light ? 'rgba(255,255,255,0.28)' : 'rgba(50,15,0,0.18)'
            ox.beginPath()
            ox.moveTo(pa[0], pa[1])
            ox.lineTo(pb[0], pb[1])
            ox.stroke()
        }
        crease([-0.2, -0.15], [0, 0.4], true)
        crease([0.2, -0.15], [0, 0.4], false)
        crease([0, -0.255], [0, 0.4], true)
        crease([-0.25, 0.03], [-0.035, 0.13], false)
        crease([0.25, 0.03], [0.035, 0.13], true)
        crease([-0.205, -0.15], [0.205, -0.15], true)
        ox.globalCompositeOperation = 'multiply'
        ox.drawImage(grain(S, k.paper), 0, 0)
        ox.globalCompositeOperation = 'destination-in'
        ox.drawImage(ao, 0, 0)
        ox.globalCompositeOperation = 'source-over'
        c.drawImage(ob, 0, 0)
        const vg = c.createRadialGradient(S / 2, S / 2, S * 0.32, S / 2, S / 2, S * 0.8)
        vg.addColorStop(0, 'rgba(0,0,0,0)')
        vg.addColorStop(1, 'rgba(30,20,10,0.32)')
        c.fillStyle = vg
        c.fillRect(0, 0, S, S)
        c.restore()
    },
}
