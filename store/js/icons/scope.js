const WING = [
    [0.06, 0.44], [0.14, 0.46], [0.5, 0.56], [0.86, 0.64], [1.02, 0.6], [0.94, 0.36], [0.8, 0.1], [0.62, -0.03],
    [0.68, -0.2], [0.58, -0.42], [0.38, -0.52], [0.2, -0.42], [0.13, -0.3], [0.13, -0.52], [0.08, -0.76], [0, -0.86],
]
const EYE = [0.58, 0.33, 0.14]

const PHOSPHORS = {
    p31: { core: [0.2, 1, 0.36], hot: [0.82, 1, 0.84], halo: [0.02, 0.28, 0.09], glass: [0.004, 0.008, 0.007] },
    p7: { core: [0.3, 0.6, 1], hot: [0.9, 0.95, 1], halo: [0.2, 0.17, 0.02], glass: [0.004, 0.005, 0.008] },
    p4: { core: [0.85, 0.88, 0.95], hot: [1, 1, 1], halo: [0.12, 0.13, 0.17], glass: [0.005, 0.005, 0.006] },
}

const SRGB = new Uint8ClampedArray(4096)
for (let i = 0; i < 4096; i++) {
    const v = i / 4095
    SRGB[i] = Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055))
}

function spline(pts, n) {
    const out = []
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
        for (let j = 0; j < n; j++) {
            const t = j / n, t2 = t * t, t3 = t2 * t
            out.push([0, 1].map((a) => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3)))
        }
    }
    out.push(pts[pts.length - 1])
    return out
}

function circle(cx, cy, r, turns, inward, n) {
    const out = []
    const total = Math.round(n * turns)
    for (let i = 0; i <= total; i++) {
        const t = i / total
        const a = Math.PI / 2 + t * turns * Math.PI * 2
        const rr = r * (1 - inward * t)
        out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
    }
    return out
}

function antenna(n) {
    const base = [0.04, 0.5], tip = [0.42, 1.0]
    const dx = tip[0] - base[0], dy = tip[1] - base[1]
    const len = Math.hypot(dx, dy)
    const nx = -dy / len, ny = dx / len
    const out = [base]
    for (let i = 1; i <= n; i++) {
        const t = i / n
        const a = 0.075 * (1 - t * 0.8) * (i % 2 ? 1 : -1)
        out.push([base[0] + dx * t + nx * a, base[1] + dy * t + ny * a])
    }
    out.push(tip)
    return out.concat([[base[0] + dx * 0.5 + nx * 0.01, base[1] + dy * 0.5 + ny * 0.01], [0, 0.47]])
}

function program() {
    const right = antenna(13).concat(spline(WING, 12))
    const left = right.slice().reverse().map(([x, y]) => [-x, y])
    const outline = [[0, 0.47]].concat(right, left.slice(1))
    const body = []
    for (let i = 0; i <= 17; i++) {
        const y = -0.8 + (i / 17) * 1.25
        const w = 0.12 * Math.sin(Math.PI * (0.1 + 0.85 * (i / 17))) ** 0.5 + 0.015
        body.push([i % 2 ? w : -w, y])
    }
    const [ex, ey, er] = EYE
    const pieces = [
        { pts: outline, speed: 1 },
        { pts: [[0, 0.47], [0, -0.8]], speed: 7 },
        { pts: body, speed: 1.4 },
        { pts: [[body[body.length - 1][0], 0.4], [ex, ey + er]], speed: 7 },
        { pts: circle(ex, ey, er, 2.6, 0.7, 60), speed: 0.9 },
        { pts: circle(ex, ey, er * 0.12, 3, 0, 12), speed: 0.12 },
        { pts: [[ex, ey], [-ex, ey + er]], speed: 7 },
        { pts: circle(ex, ey, er, 2.6, 0.7, 60).map(([x, y]) => [-x, y]), speed: 0.9 },
        { pts: circle(-ex, ey, er * 0.12, 3, 0, 12), speed: 0.12 },
        { pts: [[-ex, ey], [0, 0.47]], speed: 7 },
    ]
    const samples = []
    let time = 0
    let prev = null
    for (const piece of pieces) {
        if (piece.pause) {
            samples.push([time, ...piece.pts[0]])
            time += piece.pause
            samples.push([time, ...piece.pts[0]])
            prev = piece.pts[0]
            continue
        }
        for (let i = 0; i < piece.pts.length; i++) {
            const p = piece.pts[i]
            if (prev) time += Math.hypot(p[0] - prev[0], p[1] - prev[1]) / piece.speed
            const q = piece.pts[i + 1]
            if (prev && q) {
                const a1 = Math.atan2(p[1] - prev[1], p[0] - prev[0]), a2 = Math.atan2(q[1] - p[1], q[0] - p[0])
                let turn = Math.abs(a2 - a1)
                if (turn > Math.PI) turn = 2 * Math.PI - turn
                time += turn * turn * 0.006
            }
            samples.push([time, p[0], p[1]])
            prev = p
        }
    }
    const first = samples[0]
    time += Math.hypot(first[1] - prev[0], first[2] - prev[1]) / 5
    return { samples, period: time }
}

function uniform(M) {
    const { samples, period } = program()
    const xs = new Float64Array(M), ys = new Float64Array(M)
    let j = 0
    for (let m = 0; m < M; m++) {
        const t = (m / M) * period
        while (j < samples.length - 2 && samples[j + 1][0] < t) j++
        const a = samples[j], b = samples[j + 1]
        const f = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0
        xs[m] = a[1] + (b[1] - a[1]) * f
        ys[m] = a[2] + (b[2] - a[2]) * f
    }
    return { xs, ys }
}

const traces = new Map()
function trace(bandwidth) {
    const N = Math.round(bandwidth)
    if (traces.has(N)) return traces.get(N)
    const M = 2048
    const { xs, ys } = uniform(M)
    const coef = []
    for (let f = -N; f <= N; f++) {
        let xr = 0, xi = 0, yr = 0, yi = 0
        for (let m = 0; m < M; m++) {
            const a = (-2 * Math.PI * f * m) / M
            const c = Math.cos(a), s = Math.sin(a)
            xr += xs[m] * c; xi += xs[m] * s
            yr += ys[m] * c; yi += ys[m] * s
        }
        const g = Math.exp(-((f / (N + 1)) ** 4) * 0.7)
        coef.push([f, (xr / M) * g, (xi / M) * g, (yr / M) * g, (yi / M) * g])
    }
    const R = 16384
    const px = new Float32Array(R), py = new Float32Array(R)
    for (const [f, xr, xi, yr, yi] of coef) {
        const step = (2 * Math.PI * f) / R
        const cs = Math.cos(step), sn = Math.sin(step)
        let c = 1, s = 0
        for (let r = 0; r < R; r++) {
            px[r] += xr * c - xi * s
            py[r] += yr * c - yi * s
            const nc = c * cs - s * sn
            s = s * cs + c * sn
            c = nc
        }
    }
    const result = { px, py, R }
    traces.set(N, result)
    return result
}

function boxBlur(src, S, r, passes) {
    let a = Float32Array.from(src)
    const b = new Float32Array(src.length)
    const w = 2 * r + 1
    for (let p = 0; p < passes; p++) {
        for (let y = 0; y < S; y++) {
            const row = y * S
            let acc = 0
            for (let i = -r; i <= r; i++) acc += a[row + Math.min(S - 1, Math.max(0, i))]
            for (let x = 0; x < S; x++) {
                b[row + x] = acc / w
                acc += a[row + Math.min(S - 1, x + r + 1)] - a[row + Math.max(0, x - r)]
            }
        }
        for (let x = 0; x < S; x++) {
            let acc = 0
            for (let i = -r; i <= r; i++) acc += b[Math.min(S - 1, Math.max(0, i)) * S + x]
            for (let y = 0; y < S; y++) {
                a[y * S + x] = acc / w
                acc += b[Math.min(S - 1, y + r + 1) * S + x] - b[Math.max(0, y - r) * S + x]
            }
        }
    }
    return a
}

function gaussBlur(src, S, sigma) {
    const r = Math.max(1, Math.ceil(sigma * 3))
    const ker = new Float32Array(2 * r + 1)
    let sum = 0
    for (let i = -r; i <= r; i++) sum += ker[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma))
    for (let i = 0; i < ker.length; i++) ker[i] /= sum
    const tmp = new Float32Array(src.length)
    const out = new Float32Array(src.length)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        let acc = 0
        for (let i = -r; i <= r; i++) {
            const xx = x + i
            if (xx >= 0 && xx < S) acc += src[y * S + xx] * ker[i + r]
        }
        tmp[y * S + x] = acc
    }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        let acc = 0
        for (let i = -r; i <= r; i++) {
            const yy = y + i
            if (yy >= 0 && yy < S) acc += tmp[yy * S + x] * ker[i + r]
        }
        out[y * S + x] = acc
    }
    return out
}

function roundRect(c, x, y, w, h, r) {
    c.moveTo(x + r, y)
    c.arcTo(x + w, y, x + w, y + h, r)
    c.arcTo(x + w, y + h, x, y + h, r)
    c.arcTo(x, y + h, x, y, r)
    c.arcTo(x, y, x + w, y, r)
    c.closePath()
}

function deposit(E, S, px, py, R, sx, sy, weight) {
    const cx = S / 2, cy = S * 0.505
    let length = 0
    let x0 = cx + px[R - 1] * sx, y0 = cy - py[R - 1] * sy
    for (let r = 0; r < R; r++) {
        const x1 = cx + px[r] * sx, y1 = cy - py[r] * sy
        const len = Math.hypot(x1 - x0, y1 - y0)
        length += len
        const steps = Math.max(1, Math.ceil(len * 2))
        const e = weight / R / steps
        for (let s = 0; s < steps; s++) {
            const t = (s + 0.5) / steps
            const x = x0 + (x1 - x0) * t - 0.5, y = y0 + (y1 - y0) * t - 0.5
            const ix = Math.floor(x), iy = Math.floor(y)
            const fx = x - ix, fy = y - iy
            if (ix < 0 || iy < 0 || ix >= S - 1 || iy >= S - 1) continue
            const i = iy * S + ix
            E[i] += e * (1 - fx) * (1 - fy)
            E[i + 1] += e * fx * (1 - fy)
            E[i + S] += e * (1 - fx) * fy
            E[i + S + 1] += e * fx * fy
        }
        x0 = x1
        y0 = y1
    }
    return length
}

function beam(S, k) {
    const { px, py, R } = trace(k.bandwidth)
    const E = new Float32Array(S * S)
    const scale = S * 0.3
    if (k.persistence > 0) for (const [f, w] of [[0.78, 0.5], [0.56, 0.3]]) deposit(E, S, px, py, R, scale * f, scale * (0.97 + 0.03 * f), k.persistence * w)
    const length = deposit(E, S, px, py, R, scale, scale, 1)
    const sigma = Math.max(0.55, S * 0.0019 * k.focus)
    const core = gaussBlur(E, S, sigma)
    const halo = boxBlur(core, S, Math.max(1, Math.round(S * 0.012)), 3)
    const norm = length * Math.sqrt(2 * Math.PI) * sigma
    return { core, halo, norm }
}


const beams = new Map()
const finals = new Map()

function remember(map, key, make, size = 6) {
    if (map.has(key)) return map.get(key)
    const v = make()
    map.set(key, v)
    if (map.size > size) map.delete(map.keys().next().value)
    return v
}

function render(S, k) {
    const { core, halo, norm } = remember(beams, [S, k.bandwidth, k.focus, k.persistence].join('|'), () => beam(S, k))
    const ph = PHOSPHORS[k.phosphor] ?? PHOSPHORS.p31
    const img = new ImageData(S, S)
    const d = img.data
    const gain = k.intensity * 0.8
    for (let y = 0; y < S; y++) {
        const v = (y + 0.5) / S - 0.5
        for (let x = 0; x < S; x++) {
            const u = (x + 0.5) / S - 0.5
            const i = y * S + x
            const I = core[i] * norm * gain
            const H = halo[i] * norm * gain
            const g = 1 - Math.exp(-I * 1.1)
            const w = I > 1.4 ? 1 - Math.exp(-(I - 1.4) * 0.5) : 0
            const r2 = u * u + v * v
            const lift = (1 + 1.6 * Math.exp(-r2 * 7)) * Math.max(0, 1 - r2 * 1.2)
            const o = i * 4
            for (let c = 0; c < 3; c++) {
                let val = ph.glass[c] * lift + ph.core[c] * g * (1 - w) + ph.hot[c] * w * g + ph.halo[c] * H * 3
                val = val / (1 + val * 0.15)
                d[o + c] = SRGB[Math.min(4095, (val * 4095) | 0)]
            }
            d[o + 3] = 255
        }
    }
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = S
    const c = canvas.getContext('2d')
    c.putImageData(img, 0, 0)

    const m = S * 0.07
    const div = (S - 2 * m) / 8
    const lw = Math.max(0.6, S / 520)
    c.save()
    c.beginPath()
    roundRect(c, m - S * 0.02, m - S * 0.02, S - 2 * m + S * 0.04, S - 2 * m + S * 0.04, S * 0.07)
    c.clip()
    const illum = k.graticule
    c.lineWidth = lw
    c.strokeStyle = `rgba(${Math.round(150 + 100 * illum)},${Math.round(150 + 60 * illum)},${Math.round(140 + 10 * illum)},${0.07 + 0.4 * illum})`
    c.beginPath()
    for (let i = 0; i <= 8; i++) {
        const p = m + i * div
        c.moveTo(p, m); c.lineTo(p, S - m)
        c.moveTo(m, p); c.lineTo(S - m, p)
    }
    const tick = div * 0.07
    for (let i = 0; i <= 40; i++) {
        const p = m + (i * div) / 5
        c.moveTo(p, S / 2 - tick); c.lineTo(p, S / 2 + tick)
        c.moveTo(S / 2 - tick, p); c.lineTo(S / 2 + tick, p)
    }
    c.stroke()
    if (illum > 0) {
        c.globalCompositeOperation = 'screen'
        c.filter = `blur(${Math.max(0.5, S * 0.004)}px)`
        c.globalAlpha = illum * 0.5
        c.stroke()
        c.filter = 'none'
        c.globalAlpha = 1
        const glow = c.createRadialGradient(S / 2, S * 0.08, 0, S / 2, S * 0.08, S * 0.7)
        glow.addColorStop(0, `rgba(255,200,140,${0.06 * illum})`)
        glow.addColorStop(1, 'rgba(255,200,140,0)')
        c.fillStyle = glow
        c.fillRect(0, 0, S, S)
    }
    c.globalCompositeOperation = 'screen'
    const sheen = c.createLinearGradient(S * 0.05, S * 0.05, S * 0.6, S * 0.7)
    sheen.addColorStop(0, 'rgba(210,230,255,0.09)')
    sheen.addColorStop(0.32, 'rgba(210,230,255,0.04)')
    sheen.addColorStop(0.33, 'rgba(210,230,255,0.0)')
    sheen.addColorStop(1, 'rgba(210,230,255,0)')
    c.fillStyle = sheen
    c.fillRect(0, 0, S, S)
    const band = c.createLinearGradient(S, 0, S * 0.35, S * 0.9)
    band.addColorStop(0.38, 'rgba(220,235,255,0)')
    band.addColorStop(0.45, 'rgba(220,235,255,0.05)')
    band.addColorStop(0.5, 'rgba(220,235,255,0)')
    c.fillStyle = band
    c.fillRect(0, 0, S, S)
    c.restore()

    c.save()
    c.beginPath()
    c.rect(0, 0, S, S)
    roundRect(c, m - S * 0.02, m - S * 0.02, S - 2 * m + S * 0.04, S - 2 * m + S * 0.04, S * 0.07)
    const bez = c.createLinearGradient(0, 0, 0, S)
    bez.addColorStop(0, '#2a2d31')
    bez.addColorStop(1, '#141517')
    c.fillStyle = bez
    c.fill('evenodd')
    c.clip('evenodd')
    c.shadowColor = 'rgba(0,0,0,0.9)'
    c.shadowBlur = S * 0.03
    c.lineWidth = S * 0.012
    c.strokeStyle = '#000'
    c.beginPath()
    roundRect(c, m - S * 0.026, m - S * 0.026, S - 2 * m + S * 0.052, S - 2 * m + S * 0.052, S * 0.075)
    c.stroke()
    c.restore()
    c.save()
    c.lineWidth = Math.max(1, S * 0.004)
    c.strokeStyle = 'rgba(255,255,255,0.07)'
    c.beginPath()
    roundRect(c, m - S * 0.032, m - S * 0.032, S - 2 * m + S * 0.064, S - 2 * m + S * 0.064, S * 0.08)
    c.stroke()
    c.restore()
    return canvas
}

export default {
    id: 'scope',
    name: 'XY moth',
    note: 'An oscilloscope in XY mode tracing a moth whose wing eyes watch back; slow beam burns brighter.',
    defaults: { bandwidth: 100, persistence: 0.35, focus: 1, intensity: 1, graticule: 0.35, phosphor: 'p31' },
    schema: [
        { group: 'Signal' },
        { key: 'bandwidth', label: 'Bandwidth', type: 'range', min: 6, max: 140, step: 1, unit: ' harm' },
        { group: 'Tube' },
        { key: 'phosphor', label: 'Phosphor', type: 'select', options: [['p31', 'P31 green'], ['p7', 'P7 blue'], ['p4', 'P4 white']] },
        { key: 'intensity', label: 'Intensity', type: 'range', min: 0.2, max: 3, step: 0.01 },
        { key: 'persistence', label: 'Wingbeat ghost', type: 'range', min: 0, max: 1, step: 0.01 },
        { key: 'focus', label: 'Focus', type: 'range', min: 0.4, max: 4, step: 0.01 },
        { key: 'graticule', label: 'Scale illum', type: 'range', min: 0, max: 1, step: 0.01 },
    ],
    draw(c, S, k) {
        c.drawImage(remember(finals, [S, k.bandwidth, k.focus, k.persistence, k.intensity, k.graticule, k.phosphor].join('|'), () => render(S, k)), 0, 0)
    },
}
