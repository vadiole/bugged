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
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

const R_OUT = 0.335
const R_IN = 0.284
const SEGMENTS = 14
const BUG_ROT = (-18 * Math.PI) / 180

const segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax
    const dy = by - ay
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
    return Math.hypot(px - ax - dx * t, py - ay - dy * t)
}

const LEGS = [
    [[-0.128, -0.06], [-0.19, -0.1], [-0.205, -0.158]],
    [[-0.148, 0.03], [-0.225, 0.036], [-0.255, 0.092]],
    [[-0.122, 0.125], [-0.185, 0.17], [-0.19, 0.232]],
    [[-0.028, -0.206], [-0.05, -0.252], [-0.095, -0.275]],
]
const LINES = []
for (const leg of LEGS) {
    for (const sgn of [1, -1]) {
        for (let i = 0; i < leg.length - 1; i++) LINES.push([leg[i][0] * sgn, leg[i][1], leg[i + 1][0] * sgn, leg[i + 1][1]])
    }
}

function spots(n) {
    const base = [[0.072, -0.03, 0.036], [0.092, 0.075, 0.033], [0.04, 0.142, 0.027]]
    if (n === 2) return [[0.075, 0.04, 0.052], [-0.075, 0.04, 0.052]]
    const out = [[0, -0.075, 0.034]]
    for (const [x, y, r] of base) out.push([x, y, r], [-x, y, r])
    return out
}

function region(u, v, k, seeds, sp) {
    const r = Math.hypot(u, v)
    if (r > R_OUT) return 0
    if (r > R_IN) {
        const a = Math.atan2(v, u) + Math.PI
        return 1 + (Math.floor((a / (Math.PI * 2)) * SEGMENTS + 0.5) % SEGMENTS)
    }
    const cr = Math.cos(BUG_ROT)
    const sr = Math.sin(BUG_ROT)
    const x = (u * cr + v * sr) / 1.1
    const y = (-u * sr + v * cr) / 1.1
    const ey = y - 0.04
    if ((x / 0.152) ** 2 + (ey / 0.168) ** 2 < 1) {
        return x < 0 ? 30 : 31
    }
    if ((x / 0.106) ** 2 + ((y + 0.112) / 0.066) ** 2 < 1) {
        if (Math.hypot(Math.abs(x) - 0.064, y + 0.118) < 0.026) return x < 0 ? 33 : 34
        return 32
    }
    if (Math.hypot(x, y + 0.172) < 0.052) return 35
    const la = (-38 * Math.PI) / 180
    const ax = (u + 0.015) * Math.cos(la) + (v - 0.04) * Math.sin(la)
    const bx = -(u + 0.015) * Math.sin(la) + (v - 0.04) * Math.cos(la)
    const L = 0.4
    if (Math.abs(ax) < L) {
        const w = 0.15 * Math.pow(Math.sin((Math.PI * (ax + L)) / (2 * L)), 0.8) * (1 - 0.25 * (ax / L))
        if (Math.abs(bx) < w) {
            const vein = Math.floor((ax + Math.abs(bx) * 1.1 + L) / 0.17)
            return 20 + vein * 2 + (bx < 0 ? 1 : 0)
        }
    }
    let best = 1e9
    let second = 1e9
    let id = 0
    for (let i = 0; i < seeds.length; i++) {
        const d = (u - seeds[i][0]) ** 2 + (v - seeds[i][1]) ** 2
        if (d < best) {
            second = best
            best = d
            id = i
        } else if (d < second) second = d
    }
    return 100 + id
}

function edt(S, seedMask) {
    const INF = 1e4
    const dx = new Float32Array(S * S).fill(INF)
    const dy = new Float32Array(S * S).fill(INF)
    for (let i = 0; i < S * S; i++) if (seedMask[i]) dx[i] = dy[i] = 0
    const test = (i, j, ox, oy) => {
        const nx = dx[j] + ox
        const ny = dy[j] + oy
        if (nx * nx + ny * ny < dx[i] * dx[i] + dy[i] * dy[i]) {
            dx[i] = nx
            dy[i] = ny
        }
    }
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const i = y * S + x
            if (x > 0) test(i, i - 1, 1, 0)
            if (y > 0) {
                test(i, i - S, 0, 1)
                if (x > 0) test(i, i - S - 1, 1, 1)
                if (x < S - 1) test(i, i - S + 1, 1, 1)
            }
        }
        for (let x = S - 2; x >= 0; x--) test(y * S + x, y * S + x + 1, 1, 0)
    }
    for (let y = S - 1; y >= 0; y--) {
        for (let x = S - 1; x >= 0; x--) {
            const i = y * S + x
            if (x < S - 1) test(i, i + 1, 1, 0)
            if (y < S - 1) {
                test(i, i + S, 0, 1)
                if (x < S - 1) test(i, i + S + 1, 1, 1)
                if (x > 0) test(i, i + S - 1, 1, 1)
            }
        }
        for (let x = 1; x < S; x++) test(y * S + x, y * S + x - 1, 1, 0)
    }
    const out = new Float32Array(S * S)
    for (let i = 0; i < S * S; i++) out[i] = Math.hypot(dx[i], dy[i])
    return out
}

const cache = new Map()

function glassLayer(S, k) {
    const key = JSON.stringify([S, k.shell, k.sky, k.border, k.spots, k.lead])
    if (cache.has(key)) return cache.get(key)
    const seeds = []
    for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + hash(i, 1, 7) * 0.5
        const rr = 0.08 + hash(i, 2, 7) * 0.2
        seeds.push([Math.cos(a) * rr, Math.sin(a) * rr])
    }
    const sp = spots(k.spots)
    const ids = new Int16Array(S * S)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) ids[y * S + x] = region((x + 0.5) / S - 0.5, (y + 0.5) / S - 0.5, k, seeds, sp)
    const mask = new Uint8Array(S * S)
    for (let y = 0; y < S - 1; y++) {
        for (let x = 0; x < S - 1; x++) {
            const i = y * S + x
            if (ids[i] !== ids[i + 1] || ids[i] !== ids[i + S]) mask[i] = 1
        }
    }
    const dist = edt(S, mask)
    const shell = hex(k.shell)
    const sky = hex(k.sky)
    const border = hex(k.border)
    const greens = [[46, 120, 52], [88, 150, 40], [30, 96, 60], [120, 160, 48]]
    const colorOf = (id) => {
        const j = hash(id, 3, 11)
        if (id >= 1 && id <= SEGMENTS) return id % 2 ? border : mixc([38, 52, 140], [70, 40, 120], j)
        if (id >= 100) return mixc(sky, j > 0.5 ? [255, 255, 255] : [40, 60, 160], (j > 0.5 ? j - 0.5 : 0.5 - j) * 0.7)
        if (id >= 40) return [24, 14, 18]
        if (id === 30 || id === 31) return mixc(shell, [255, 255, 255], id === 30 ? 0.02 : 0.1)
        if (id === 32 || id === 35) return [22, 18, 24]
        if (id === 33 || id === 34) return [250, 240, 205]
        if (id >= 20) return greens[(id * 7) % greens.length]
        return [0, 0, 0]
    }
    const half = Math.max(0.9, S * k.lead * 0.5)
    const img = new ImageData(S, S)
    const d = img.data
    const lx = -0.07
    const ly = -0.11
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const i = y * S + x
            const u = (x + 0.5) / S - 0.5
            const v = (y + 0.5) / S - 0.5
            const id = ids[i]
            const o = i * 4
            let ld = dist[i]
            const cr = Math.cos(BUG_ROT)
            const sr = Math.sin(BUG_ROT)
            const bx = (u * cr + v * sr) / 1.1
            const by = (-u * sr + v * cr) / 1.1
            if (Math.hypot(u, v) < R_IN) {
                for (const [ax, ay, cx, cy] of LINES) ld = Math.min(ld, segDist(bx, by, ax, ay, cx, cy) * S * 1.1 - half * 1.1)
            }
            const r = Math.hypot(u, v)
            const frame = r > R_OUT - 0.004 ? 1.9 : 1
            const lw = half * frame
            if (id === 0 && ld > lw + 1) {
                d[o + 3] = 0
                continue
            }
            const base = colorOf(id)
            const ang = hash(id, 5, 3) * Math.PI
            const sx = (u * Math.cos(ang) + v * Math.sin(ang)) * S
            const sy = (-u * Math.sin(ang) + v * Math.cos(ang)) * S
            const sc = S / 432
            const tex = 0.74 + 0.3 * vnoise(sx / (46 * sc), sy / (5 * sc), id) + 0.18 * vnoise(u * 26, v * 26, id + 50) + 0.1 * vnoise(sx / (9 * sc), sy / (2.5 * sc), id + 9)
            const cs = 9 * sc
            const cx = Math.floor((u * S) / cs)
            const cy = Math.floor((v * S) / cs)
            let bub = 1
            if (hash(cx, cy, id) > 0.86) {
                const bxp = (cx + 0.2 + hash(cx, cy, id + 1) * 0.6) * cs
                const byp = (cy + 0.2 + hash(cx, cy, id + 2) * 0.6) * cs
                const br = (0.6 + hash(cx, cy, id + 3) * 1.1) * sc
                const e = Math.hypot(u * S - bxp, v * S - byp) / br
                if (e < 1) bub = 1.12 + 0.25 * (1 - e)
            }
            const light = 0.95 + 0.5 * Math.exp(-((u - lx) ** 2 + (v - ly) ** 2) / 0.05)
            const matte = 1 - 0.5 * Math.exp(-(ld - lw) / (S * 0.012))
            let dense = id === 32 || id === 35 ? 0.6 : 1
            if (id === 30 || id === 31) {
                let paint = 0
                for (const [qx, qy, rr] of sp) {
                    const e = Math.hypot(bx - qx, by - qy) / rr
                    paint = Math.max(paint, clamp((1.04 - e) / 0.1))
                }
                if (paint > 0) {
                    const brush = 0.75 + 0.25 * vnoise(u * 90, v * 90, 77)
                    dense = 1 - paint * 0.93 * brush
                }
            }
            let col = base.map((c) => clamp((c * tex * bub * light * matte * dense) / 255) * 255)
            const hot = Math.max(0, light - 1) * 0.6
            col = mixc(col, [255, 250, 235], hot * (dense < 0.9 ? 0.05 : 1))
            const t = clamp(lw + 0.5 - ld)
            if (t > 0) {
                const p = clamp(ld / lw)
                const h = Math.sqrt(Math.max(0, 1 - p * p))
                const lead = [9 + 30 * h ** 3, 9 + 28 * h ** 3, 11 + 26 * h ** 3]
                col = mixc(col, lead, t)
            }
            d[o] = col[0]
            d[o + 1] = col[1]
            d[o + 2] = col[2]
            d[o + 3] = id === 0 ? clamp(lw + 0.5 - ld) * 255 : 255
        }
    }
    const cv = document.createElement('canvas')
    cv.width = cv.height = S
    cv.getContext('2d').putImageData(img, 0, 0)
    const stone = document.createElement('canvas')
    stone.width = stone.height = S
    const sc = stone.getContext('2d')
    const si = sc.createImageData(S, S)
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const u = x / S
            const v = y / S
            const n = vnoise(u * 9, v * 9, 3) * 0.5 + vnoise(u * 40, v * 40, 4) * 0.3 + vnoise(u * 120, v * 120, 5) * 0.2
            const blockY = Math.floor(v * 5)
            const blockX = Math.floor(u * 3 + (blockY % 2) * 0.5)
            const fy = v * 5 - blockY
            const fx = u * 3 + (blockY % 2) * 0.5 - blockX
            const joint = Math.min(fy, 1 - fy, (Math.min(fx, 1 - fx) * 5) / 3) * S / 5
            const j = clamp(joint / (S * 0.006))
            const rr = Math.hypot(u - 0.5, v - 0.5)
            const reveal = rr < R_OUT + 0.075 ? 0.45 + 0.55 * clamp((rr - R_OUT) / 0.075) ** 0.7 : 1
            const tone = (0.7 + 0.3 * hash(blockX, blockY, 9)) * (0.55 + 0.6 * n) * (0.55 + 0.45 * (rr < R_OUT + 0.075 ? 1 : j)) * reveal * 0.75
            const o = (y * S + x) * 4
            si.data[o] = 52 * tone
            si.data[o + 1] = 46 * tone
            si.data[o + 2] = 44 * tone
            si.data[o + 3] = 255
        }
    }
    sc.putImageData(si, 0, 0)
    const out = { glass: cv, stone }
    cache.set(key, out)
    if (cache.size > 4) cache.delete(cache.keys().next().value)
    return out
}

export default {
    id: 'stained-glass',
    name: 'Ladybird window',
    note: 'A leaded roundel in a dark stone wall, sun behind it, colour spilling into the room.',
    defaults: { shell: '#e0201a', sky: '#2f8ee0', border: '#e8a020', spots: 7, lead: 0.011, spill: 0.75 },
    schema: [
        { group: 'Glass' },
        { key: 'shell', label: 'Shell', type: 'color' },
        { key: 'sky', label: 'Sky', type: 'color' },
        { key: 'border', label: 'Border', type: 'color' },
        { key: 'spots', label: 'Spots', type: 'select', options: [[2, 'Two'], [7, 'Seven']] },
        { group: 'Light' },
        { key: 'lead', label: 'Lead came', type: 'range', min: 0.005, max: 0.02, step: 0.001 },
        { key: 'spill', label: 'Light spill', type: 'range', min: 0, max: 1.5, step: 0.01 },
    ],
    draw(c, S, k) {
        const { glass, stone } = glassLayer(S, { ...k, spots: Number(k.spots) })
        c.save()
        c.setTransform(1, 0, 0, 1, 0, 0)
        c.drawImage(stone, 0, 0)
        c.globalCompositeOperation = 'lighter'
        c.filter = `blur(${S * 0.07}px)`
        c.globalAlpha = 0.5 * k.spill
        const g1 = S * 1.35
        c.drawImage(glass, (S - g1) / 2, (S - g1) / 2, g1, g1)
        c.filter = `blur(${S * 0.025}px)`
        c.globalAlpha = 0.6 * k.spill
        const g2 = S * 1.08
        c.drawImage(glass, (S - g2) / 2, (S - g2) / 2, g2, g2)
        c.filter = 'none'
        c.globalAlpha = 1
        c.globalCompositeOperation = 'source-over'
        c.drawImage(glass, 0, 0)
        c.globalCompositeOperation = 'lighter'
        c.filter = `blur(${S * 0.012}px)`
        c.globalAlpha = 0.1 * k.spill
        c.drawImage(glass, 0, 0)
        c.filter = 'none'
        c.globalAlpha = 1
        const ray = document.createElement('canvas')
        ray.width = ray.height = S
        const rc = ray.getContext('2d')
        rc.filter = `blur(${S * 0.02}px)`
        const g3 = S * 2.2
        rc.drawImage(glass, (S - g3) / 2, (S - g3) / 2, g3, g3)
        rc.filter = 'none'
        const mask = document.createElement('canvas')
        mask.width = mask.height = S
        const mc = mask.getContext('2d')
        const grad = mc.createRadialGradient(S / 2, S / 2, S * R_OUT * 0.9, S / 2, S / 2, S * 0.75)
        grad.addColorStop(0, 'rgba(255,255,255,0)')
        grad.addColorStop(0.08, 'rgba(255,255,255,1)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        mc.fillStyle = grad
        for (let i = 0; i < 70; i++) {
            const a = hash(i, 9, 21) * Math.PI * 2
            const w = 0.01 + hash(i, 10, 21) * 0.05
            mc.globalAlpha = 0.15 + hash(i, 11, 21) * 0.5
            mc.beginPath()
            mc.moveTo(S / 2, S / 2)
            mc.arc(S / 2, S / 2, S, a, a + w)
            mc.closePath()
            mc.fill()
        }
        rc.globalCompositeOperation = 'destination-in'
        rc.drawImage(mask, 0, 0)
        c.globalAlpha = 0.9 * k.spill
        c.drawImage(ray, 0, 0)
        c.filter = 'none'
        c.globalAlpha = 1
        c.restore()
    },
}
