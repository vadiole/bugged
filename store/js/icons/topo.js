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
const fbm = (x, y, s, o) => {
    let sum = 0
    let amp = 0.5
    for (let i = 0; i < o; i++) {
        sum += amp * (vnoise(x, y, s + i * 17) - 0.5)
        x = x * 2.03 + 1.7
        y = y * 2.03 - 0.9
        amp *= 0.5
    }
    return sum
}
const mix = (a, b, t) => a + (b - a) * t
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

const PALETTES = {
    survey: {
        ramp: [[0, '#8fbf86'], [0.3, '#c6dba4'], [0.55, '#ecdcac'], [0.8, '#dcbf96'], [1, '#f7f2ea']],
        line: '#8a5a32', water: '#9cc6dc', waterLine: '#3f7fa8', grid: '#5b8fb8', trail: '#c8102e', halo: '#fffaf0', shade: 0.4,
    },
    paper: {
        ramp: [[0, '#e6d8b8'], [1, '#efe4c8']],
        line: '#7a4b26', water: '#cfd9c8', waterLine: '#5f7f86', grid: '#9a8a70', trail: '#1d1a17', halo: '#f6eed8', shade: 0.35,
    },
    night: {
        ramp: [[0, '#0f1e2a'], [0.6, '#16313c'], [1, '#22464c']],
        line: '#5fe0b8', water: '#0a1620', waterLine: '#2c6e8e', grid: '#24425a', trail: '#ffb340', halo: '#0b1620', shade: 0.6,
    },
}

const rampAt = (ramp, t) => {
    for (let i = 1; i < ramp.length; i++) {
        if (t <= ramp[i][0] || i === ramp.length - 1) {
            const [t0, c0] = ramp[i - 1]
            const [t1, c1] = ramp[i]
            const f = clamp((t - t0) / (t1 - t0))
            const a = hex(c0)
            const b = hex(c1)
            return [mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)]
        }
    }
}

const hcache = new Map()
function heights(S, seed) {
    const key = S + ':' + seed
    if (hcache.has(key)) return hcache.get(key)
    const N = S + 2
    const h = new Float32Array(N * N)
    const r = (i) => hash(i, seed, 911)
    const hills = [
        [0.0 + (r(1) - 0.5) * 0.04, -0.04 + (r(2) - 0.5) * 0.04, 0.95, 0.04],
        [0.3 + (r(3) - 0.5) * 0.1, 0.18 + (r(4) - 0.5) * 0.1, 0.45, 0.02],
        [-0.34, -0.3 + (r(5) - 0.5) * 0.1, 0.4, 0.03],
        [0.34, -0.38, 0.35 + r(6) * 0.2, 0.025],
    ]
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const u = (i - 1 + 0.5) / S - 0.5
            const v = (j - 1 + 0.5) / S - 0.5
            const wx = u + fbm(u * 3 + 5, v * 3, seed + 3, 3) * 0.09
            const wy = v + fbm(u * 3, v * 3 + 9, seed + 7, 3) * 0.09
            let z = 0.16
            for (const [x, y, a, s] of hills) z += a * Math.exp(-((wx - x) ** 2 + (wy - y) ** 2) / s)
            z += fbm(wx * 7, wy * 7, seed, 4) * 0.13
            const lake = Math.exp(-((wx + 0.3) ** 2 + (wy - 0.3) ** 2) / 0.016)
            z -= lake * 0.42
            h[j * N + i] = z
        }
    }
    hcache.set(key, h)
    if (hcache.size > 6) hcache.delete(hcache.keys().next().value)
    return h
}

const PATH = [[0.22, 0.66], [0.15, 0.48], [0.0, 0.42], [-0.08, 0.32], [0.0, 0.24], [0.12, 0.2], [0.13, 0.12], [0.07, 0.08], [0.035, 0.055], [0.0, 0.0]]

function catmull(pts, steps) {
    const out = []
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)]
        const p1 = pts[i]
        const p2 = pts[i + 1]
        const p3 = pts[Math.min(pts.length - 1, i + 2)]
        for (let s = 0; s < steps; s++) {
            const t = s / steps
            const t2 = t * t
            const t3 = t2 * t
            const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
            out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
        }
    }
    out.push(pts[pts.length - 1])
    return out
}

function foot(c, x, y, ang, size, left) {
    c.save()
    c.translate(x, y)
    c.rotate(ang)
    if (left) c.scale(1, -1)
    const blob = (x, y, rx, ry, r = 0) => {
        c.beginPath()
        c.ellipse(x * size, y * size, rx * size, ry * size, r, 0, Math.PI * 2)
        c.fill()
    }
    blob(0.14, 0.02, 0.22, 0.2)
    blob(-0.36, 0.04, 0.17, 0.15)
    blob(-0.1, 0.1, 0.28, 0.1, 0.08)
    blob(0.44, -0.15, 0.08, 0.07)
    blob(0.47, -0.03, 0.06, 0.055)
    blob(0.45, 0.07, 0.05, 0.05)
    blob(0.41, 0.15, 0.045, 0.045)
    blob(0.35, 0.22, 0.04, 0.04)
    c.restore()
}

export default {
    id: 'topo',
    name: 'Lost trail',
    note: 'A survey map. Your footprints climb the hill and stop; whoever followed has nothing after that.',
    defaults: { palette: 'survey', seed: 4, contours: 22, light: 315, trail: 0.97, ring: true },
    schema: [
        { group: 'Terrain' },
        { key: 'palette', label: 'Map', type: 'select', options: [['survey', 'Survey'], ['paper', 'Old paper'], ['night', 'Night GPS']] },
        { key: 'seed', label: 'Terrain', type: 'range', min: 1, max: 40, step: 1 },
        { key: 'contours', label: 'Contours', type: 'range', min: 8, max: 40, step: 1 },
        { key: 'light', label: 'Sun', type: 'range', min: 0, max: 360, step: 1, unit: '°' },
        { group: 'Trail' },
        { key: 'trail', label: 'Trail ends', type: 'range', min: 0.3, max: 1, step: 0.01 },
        { key: 'ring', label: 'Search ring', type: 'toggle' },
    ],
    draw(c, S, k) {
        const P = PALETTES[k.palette] ?? PALETTES.survey
        const h = heights(S, k.seed)
        const N = S + 2
        const img = c.createImageData(S, S)
        const d = img.data
        const L = k.contours
        const az = (k.light * Math.PI) / 180
        const lx = Math.sin(az)
        const ly = -Math.cos(az)
        const lz = 0.9
        const ll = Math.hypot(lx, ly, lz)
        const line = hex(P.line)
        const water = hex(P.water)
        const wline = hex(P.waterLine)
        const grid = hex(P.grid)
        const lw = Math.max(0.55, S / 620)
        const sea = 0.02
        for (let y = 0; y < S; y++) {
            for (let x = 0; x < S; x++) {
                const j = (y + 1) * N + x + 1
                const z = h[j]
                const gx = (h[j + 1] - h[j - 1]) * 0.5
                const gy = (h[j + N] - h[j - N]) * 0.5
                const rel = S * 0.7
                const nx = -gx * rel
                const ny = -gy * rel
                const sh = clamp((nx * lx + ny * ly + lz) / (Math.hypot(nx, ny, 1) * ll))
                let col
                const wet = z < sea
                if (wet) {
                    col = water.slice()
                    const depth = (sea - z) * 30
                    const f = depth - Math.floor(depth)
                    const g = Math.hypot(gx, gy) * 30 + 1e-6
                    const dd = Math.min(f, 1 - f) / g
                    const a = clamp(lw * 0.6 + 0.5 - dd) * 0.6
                    for (let ch = 0; ch < 3; ch++) col[ch] = mix(col[ch], wline[ch], a)
                } else {
                    col = rampAt(P.ramp, clamp(z / 1.05))
                    const s = 1 - P.shade + P.shade * (sh * 1.25)
                    for (let ch = 0; ch < 3; ch++) col[ch] *= s
                }
                const f = z * L
                const g = Math.hypot(gx, gy) * L + 1e-6
                const fr = f - Math.floor(f)
                const dist = Math.min(fr, 1 - fr) / g
                const idx = Math.round(f)
                const major = idx % 5 === 0
                const w = major ? lw * 2.1 : lw
                let a = clamp(w * 0.5 + 0.5 - dist) * (major ? 0.95 : 0.7)
                if (wet) a *= z > sea - 0.02 ? 1 : 0
                for (let ch = 0; ch < 3; ch++) col[ch] = mix(col[ch], line[ch], a)
                const gs = S / 4
                const gdx = Math.abs(((x + 0.5 + gs * 0.37) % gs) - gs / 2)
                const gdy = Math.abs(((y + 0.5 + gs * 0.21) % gs) - gs / 2)
                const gd = Math.min(gs / 2 - gdx, gs / 2 - gdy)
                const ga = clamp(lw * 0.5 + 0.5 - gd) * 0.35
                for (let ch = 0; ch < 3; ch++) col[ch] = mix(col[ch], grid[ch], ga)
                const i = (y * S + x) * 4
                d[i] = col[0]
                d[i + 1] = col[1]
                d[i + 2] = col[2]
                d[i + 3] = 255
            }
        }
        c.putImageData(img, 0, 0)
        c.save()
        c.translate(S / 2, S / 2)
        c.scale(S, S)
        const path = catmull(PATH, 24)
        const lens = [0]
        for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]))
        const total = lens[lens.length - 1]
        const stop = total * k.trail
        const boost = Math.max(1, Math.min(2, 150 / S))
        const step = 0.042 * boost
        const size = 0.034 * boost
        const at = (s) => {
            let i = 1
            while (i < lens.length - 1 && lens[i] < s) i++
            const t = (s - lens[i - 1]) / (lens[i] - lens[i - 1] || 1)
            const a = path[i - 1]
            const b = path[i]
            return [mix(a[0], b[0], t), mix(a[1], b[1], t), Math.atan2(b[1] - a[1], b[0] - a[0])]
        }
        const prints = []
        for (let s = 0.02, n = 0; s <= stop; s += step, n++) prints.push([...at(s), n % 2 === 0])
        c.beginPath()
        for (let i = 0; i < path.length && lens[i] <= stop; i++) c.lineTo(path[i][0], path[i][1])
        c.strokeStyle = P.halo
        c.globalAlpha = 0.24
        c.lineWidth = size * 1.5
        c.lineCap = 'round'
        c.lineJoin = 'round'
        c.stroke()
        c.globalAlpha = 1
        c.fillStyle = P.trail
        for (const [x, y, ang, left] of prints) {
            const ox = Math.cos(ang + Math.PI / 2) * size * 0.32 * (left ? -1 : 1)
            const oy = Math.sin(ang + Math.PI / 2) * size * 0.32 * (left ? -1 : 1)
            foot(c, x + ox, y + oy, ang, size, left)
        }
        if (k.ring && prints.length) {
            const [ex, ey, ang] = prints[prints.length - 1]
            const cx = ex + Math.cos(ang) * 0.085
            const cy = ey + Math.sin(ang) * 0.085
            c.strokeStyle = P.halo
            c.globalAlpha = 0.7
            c.lineWidth = 0.016 * boost
            c.beginPath()
            c.arc(cx, cy, 0.085, 0, Math.PI * 2)
            c.stroke()
            c.globalAlpha = 1
            c.strokeStyle = P.trail
            c.lineWidth = 0.008 * boost
            c.setLineDash([0.018 * boost, 0.012 * boost])
            c.beginPath()
            c.arc(cx, cy, 0.085, 0, Math.PI * 2)
            c.stroke()
            c.setLineDash([])
            c.fillStyle = P.trail
            c.font = `italic 600 ${0.08}px Georgia, 'Times New Roman', serif`
            c.textAlign = 'center'
            c.textBaseline = 'middle'
            c.fillText('?', cx, cy + 0.004)
        }
        c.restore()
    },
}
