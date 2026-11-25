const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)
const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a))
    return t * t * (3 - 2 * t)
}
const hex = (h) => {
    const n = parseInt(h.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
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
function segDist(x, y, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay
    const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy))
    return Math.hypot(x - ax - vx * t, y - ay - vy * t)
}
const polyDist = (x, y, pts) => {
    let d = 1e9
    for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]))
    return d
}

const HOOP_IN = 0.63
const HOOP_OUT = 0.72
const FACE = { x: 0.06, y: 0.0, r: 0.47 }

function palette(k) {
    const base = hex(k.thread)
    const lum = (c) => (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255
    const light = mix(base, [255, 244, 214], 0.45)
    const dark = mix(base, [120, 40, 20], 0.38)
    const blush = mix(base, [214, 58, 52], 0.55)
    return {
        light, base, dark, blush,
        ink: hex(k.floss),
        white: [250, 248, 240],
        red: [206, 44, 44],
        lum: lum(base),
    }
}

function eyes() {
    return [-1, 1].map((sg) => ({ x: FACE.x + sg * 0.175, y: FACE.y - 0.03, sg }))
}

function cellColor(u, v, P) {
    const dx = u - FACE.x, dy = v - FACE.y
    const d = Math.hypot(dx, dy) - FACE.r
    if (d > 0) return null
    for (const e of eyes()) {
        const brow = [[e.x + e.sg * 0.13, e.y - 0.2], [e.x - e.sg * 0.11, e.y - 0.095]]
        if (segDist(u, v, brow[0][0], brow[0][1], brow[1][0], brow[1][1]) < 0.036) return P.ink
        const ex = (u - e.x) / 0.125, ey = (v - e.y) / 0.095
        const lid = e.y - 0.045 - (u - e.x) * e.sg * 0.38
        if (ex * ex + ey * ey < 1 && v > lid) {
            if (Math.hypot(u - (e.x - 0.07), v - (e.y + 0.03)) < 0.052) return P.ink
            return P.white
        }
    }
    const mouth = [[-0.17, 0.3], [-0.09, 0.245], [0.0, 0.232], [0.09, 0.245], [0.17, 0.3]].map(([a, b]) => [FACE.x + a, FACE.y + b])
    if (polyDist(u, v, mouth) < 0.03) return P.ink
    for (const sg of [-1, 1]) {
        if (Math.hypot(u - (FACE.x + sg * 0.29), v - (FACE.y + 0.15)) < 0.07) return P.blush
    }
    const nz = Math.sqrt(clamp(1 - (dx * dx + dy * dy) / (FACE.r * FACE.r)))
    const L = (-dx * 0.55 - dy * 0.6) / FACE.r + nz * 0.58
    if (L > 0.72) return P.light
    if (L < 0.08 || d > -0.035) return P.dark
    return P.base
}

function strand(c, ax, ay, bx, by, w, col, cs, r, alphaShadow = 0.28) {
    const dx = bx - ax, dy = by - ay
    const len = Math.hypot(dx, dy)
    const tx = dx / len, ty = dy / len
    const nx = -ty, ny = tx
    c.lineCap = 'round'
    c.strokeStyle = `rgba(40,25,10,${alphaShadow})`
    c.lineWidth = w * 1.25
    c.beginPath()
    c.moveTo(ax + cs * 0.05, ay + cs * 0.07)
    c.lineTo(bx + cs * 0.05, by + cs * 0.07)
    c.stroke()
    for (const s of [-1, 1]) {
        const ox = nx * s * w * 0.24, oy = ny * s * w * 0.24
        const sw = w * 0.56
        const jit = (r() - 0.5) * 0.08
        const dark = mix(col, [0, 0, 0], 0.2 + jit)
        const light = mix(col, [255, 255, 255], 0.35)
        c.strokeStyle = css(dark)
        c.lineWidth = sw
        c.beginPath()
        c.moveTo(ax + ox, ay + oy)
        c.lineTo(bx + ox, by + oy)
        c.stroke()
        c.strokeStyle = css(mix(col, [255, 255, 255], jit))
        c.lineWidth = sw * 0.62
        c.beginPath()
        c.moveTo(ax + ox - sw * 0.1, ay + oy - sw * 0.12)
        c.lineTo(bx + ox - sw * 0.1, by + oy - sw * 0.12)
        c.stroke()
        c.strokeStyle = css(light, 0.55)
        c.lineWidth = sw * 0.2
        c.beginPath()
        c.moveTo(ax + ox - sw * 0.2, ay + oy - sw * 0.22)
        c.lineTo(bx + ox - sw * 0.2, by + oy - sw * 0.22)
        c.stroke()
        const n = Math.max(2, Math.round(len / (sw * 0.9)))
        c.strokeStyle = css(mix(col, [0, 0, 0], 0.4), 0.3)
        c.lineWidth = Math.max(0.4, sw * 0.13)
        c.beginPath()
        const ph = r()
        for (let i = 0; i < n; i++) {
            const t = (i + ph) / n
            const px = ax + dx * t + ox, py = ay + dy * t + oy
            c.moveTo(px - nx * sw * 0.45 - tx * sw * 0.35, py - ny * sw * 0.45 - ty * sw * 0.35)
            c.lineTo(px + nx * sw * 0.45 + tx * sw * 0.35, py + ny * sw * 0.45 + ty * sw * 0.35)
        }
        c.stroke()
    }
}

function render(S, k) {
    const cv = new OffscreenCanvas(S, S)
    const c = cv.getContext('2d')
    const N = Math.round(k.count / 2) * 2
    const cs = S / N
    const fab = hex(k.fabric)
    const img = c.createImageData(S, S)
    const d = img.data
    const hoopIn = HOOP_IN * S * 0.5, hoopOut = HOOP_OUT * S * 0.5
    for (let j = 0; j < S; j++) {
        for (let i = 0; i < S; i++) {
            const x = i + 0.5, y = j + 0.5
            const rx = x - S / 2, ry = y - S / 2
            const rr = Math.hypot(rx, ry)
            const inside = rr < hoopIn + cs * 0.3
            let wx = x, wy = y
            let fold = 0
            if (!inside) {
                const a = Math.atan2(ry, rx)
                const w = Math.sin(a * 9 + vnoise(a * 3, 1) * 4) * smooth(hoopOut, S * 0.75, rr)
                fold = w
                wx += Math.cos(a) * w * cs * 0.25
                wy += Math.sin(a) * w * cs * 0.25
            }
            const fu = wx / cs, fv = wy / cs
            const cu = fu - Math.floor(fu), cv2 = fv - Math.floor(fv)
            const du = Math.min(cu, 1 - cu), dv = Math.min(cv2, 1 - cv2)
            const hole = smooth(0.17, 0.05, Math.hypot(du, dv))
            const gap = smooth(0.13, 0.0, Math.min(du, dv)) * 0.5
            const su = cu * 4, sv = cv2 * 4
            const iu = Math.floor(su), iv = Math.floor(sv)
            const top = (iu + iv) & 1
            const th = top ? Math.sin(Math.PI * (su - iu)) : Math.sin(Math.PI * (sv - iv))
            const bump = Math.sin(Math.PI * cu) * Math.sin(Math.PI * cv2)
            let lum = 0.88 + 0.08 * th + 0.05 * bump - 0.16 * gap - 0.32 * hole
            lum += (hash(i, j) - 0.5) * 0.05 + (vnoise(fu * 0.7, fv * 0.7) - 0.5) * 0.06
            if (!inside) {
                lum *= 0.9 + 0.1 * fold - 0.05
                lum -= 0.25 * smooth(hoopOut + cs * 1.2, hoopOut, rr)
            } else {
                lum -= 0.22 * smooth(hoopIn - cs * 1.2, hoopIn, rr)
            }
            const o = (j * S + i) * 4
            d[o] = clamp(fab[0] * lum, 0, 255)
            d[o + 1] = clamp(fab[1] * lum, 0, 255)
            d[o + 2] = clamp(fab[2] * lum * 0.98, 0, 255)
            d[o + 3] = 255
        }
    }
    c.putImageData(img, 0, 0)

    const P = palette(k)
    const r = rng(11)
    const irr = k.irregular
    const W = cs * 0.36
    const inset = cs * 0.08
    const jit = () => (r() - 0.5) * cs * 0.12 * irr
    const H = (v) => S / 2 + v * cs
    const cells = []
    for (let j = -N / 2; j < N / 2; j++) {
        for (let i = -N / 2; i < N / 2; i++) {
            const u = ((i + 0.5) * cs) / (S / 2), v = ((j + 0.5) * cs) / (S / 2)
            if (Math.hypot(u, v) > HOOP_IN - 0.05) continue
            const col = cellColor(u, v, P)
            if (col) cells.push({ i, j, col, u, v })
        }
    }
    const half = k.needle ? cells.filter((q) => q.v > FACE.y + 0.2 && q.u < FACE.x - 0.12 && Math.hypot(q.u - FACE.x, q.v - FACE.y) > FACE.r - 0.12).sort((a, b) => a.u - b.u).slice(0, 8) : []
    const halfSet = new Set(half.map((q) => q.i + ',' + q.j))
    for (const q of cells) {
        const col = mix(q.col, [255, 255, 255], (r() - 0.5) * 0.06 * irr)
        const x0 = H(q.i), y0 = H(q.j), x1 = H(q.i + 1), y1 = H(q.j + 1)
        const ww = W * (1 + (r() - 0.5) * 0.18 * irr)
        strand(c, x0 + inset + jit(), y1 - inset + jit(), x1 - inset + jit(), y0 + inset + jit(), ww, col, cs, r)
        if (!halfSet.has(q.i + ',' + q.j)) strand(c, x0 + inset + jit(), y0 + inset + jit(), x1 - inset + jit(), y1 - inset + jit(), ww, col, cs, r)
    }

    const snap = (v) => Math.round((v * S) / 2 / cs)
    const back = (pts, col, w) => {
        const hs = []
        for (const [a, b] of pts) {
            const h = [snap(a), snap(b)]
            const l = hs[hs.length - 1]
            if (!l || l[0] !== h[0] || l[1] !== h[1]) hs.push(h)
        }
        for (let i = 0; i < hs.length - 1; i++) {
            strand(c, H(hs[i][0]) + jit() * 0.5, H(hs[i][1]) + jit() * 0.5, H(hs[i + 1][0]) + jit() * 0.5, H(hs[i + 1][1]) + jit() * 0.5, w, col, cs, r, 0.22)
        }
    }
    const circ = []
    for (let a = 0; a <= 64; a++) {
        const t = (a / 64) * Math.PI * 2
        circ.push([FACE.x + Math.cos(t) * (FACE.r + 0.012), FACE.y + Math.sin(t) * (FACE.r + 0.012)])
    }
    back(circ, P.ink, W * 0.62)
    for (const e of eyes()) {
        const lid = []
        for (let a = -1; a <= 1.001; a += 0.25) lid.push([e.x + a * 0.13, e.y - 0.045 - a * 0.13 * e.sg * 0.38])
        back(lid, P.ink, W * 0.62)
    }
    const vx = FACE.x + 0.3, vy = FACE.y - 0.3, vs = 0.07
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        back([[vx + sx * vs * 0.35, vy + sy * vs * 1.1], [vx + sx * vs * 0.35, vy + sy * vs * 0.35], [vx + sx * vs * 1.1, vy + sy * vs * 0.35]], P.red, W * 0.75)
    }

    if (k.needle && half.length) {
        const last = half[half.length - 1]
        const tx = H(last.i) + inset, ty = H(last.j + 1) - inset
        const nx0 = S * 0.5 - S * 0.235, ny0 = S * 0.5 - S * 0.17
        const nx1 = S * 0.5 - S * 0.255, ny1 = S * 0.5 + S * 0.12
        const ang = Math.atan2(ny1 - ny0, nx1 - nx0)
        const eyeX = nx1 - Math.cos(ang) * S * 0.018, eyeY = ny1 - Math.sin(ang) * S * 0.018
        const pts = []
        for (let i = 0; i <= 14; i++) {
            const t = i / 14
            const mx = tx + (eyeX - tx) * t - Math.sin(t * Math.PI) * S * 0.01
            const my = ty + (eyeY - ty) * t + Math.sin(t * Math.PI) * S * 0.06
            pts.push([mx, my])
        }
        for (let i = 0; i < pts.length - 1; i++) strand(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], W * 0.9, P.base, cs, r, 0.18)
        c.lineCap = 'round'
        c.strokeStyle = 'rgba(30,20,10,0.3)'
        c.lineWidth = S * 0.017
        c.beginPath()
        c.moveTo(nx0 + S * 0.006, ny0 + S * 0.008)
        c.lineTo(nx1 + S * 0.006, ny1 + S * 0.008)
        c.stroke()
        const g = c.createLinearGradient(nx0 - Math.sin(ang) * S * 0.008, ny0 + Math.cos(ang) * S * 0.008, nx0 + Math.sin(ang) * S * 0.008, ny0 - Math.cos(ang) * S * 0.008)
        g.addColorStop(0, '#5d636b')
        g.addColorStop(0.45, '#eef1f4')
        g.addColorStop(0.7, '#a7adb5')
        g.addColorStop(1, '#4a4f56')
        c.strokeStyle = g
        c.lineWidth = S * 0.013
        c.beginPath()
        c.moveTo(nx0, ny0)
        c.lineTo(nx1, ny1)
        c.stroke()
        c.fillStyle = g
        c.beginPath()
        const tipX = nx0 - Math.cos(ang) * S * 0.04, tipY = ny0 - Math.sin(ang) * S * 0.04
        const pX = -Math.sin(ang) * S * 0.0065, pY = Math.cos(ang) * S * 0.0065
        c.moveTo(nx0 + pX, ny0 + pY)
        c.lineTo(tipX, tipY)
        c.lineTo(nx0 - pX, ny0 - pY)
        c.fill()
        c.save()
        c.translate(eyeX, eyeY)
        c.rotate(ang)
        c.fillStyle = css(mix(fab, [0, 0, 0], 0.15))
        c.beginPath()
        c.ellipse(-S * 0.004, 0, S * 0.012, S * 0.0028, 0, 0, Math.PI * 2)
        c.fill()
        c.restore()
    }

    if (k.hoop) {
        const hd = c.getImageData(0, 0, S, S)
        const p = hd.data
        const wood = hex('#c9925a')
        const lo = Math.floor(S / 2 - hoopOut - 2), hi = Math.ceil(S / 2 + hoopOut + 2)
        for (let j = Math.max(0, lo); j < Math.min(S, hi); j++) {
            for (let i = Math.max(0, lo); i < Math.min(S, hi); i++) {
                const rx = i + 0.5 - S / 2, ry = j + 0.5 - S / 2
                const rr = Math.hypot(rx, ry)
                const ringIn = hoopIn, ringMid = hoopIn + (hoopOut - hoopIn) * 0.3
                const cover = clamp(rr - ringIn + 0.5) * clamp(hoopOut - rr + 0.5)
                if (cover <= 0) continue
                const a = Math.atan2(ry, rx)
                const outer = rr > ringMid
                const t = outer ? (rr - ringMid) / (hoopOut - ringMid) : (rr - ringIn) / (ringMid - ringIn)
                const prof = Math.sin(Math.PI * clamp(t))
                const lit = 0.55 + 0.45 * prof - 0.25 * (outer ? 0 : 1) + 0.18 * (-Math.sin(a + 0.8)) * (1 - prof) * (t < 0.5 ? -1 : 1)
                const g = vnoise(a * 2.2 + (outer ? 7 : 3), rr * 0.02) * 6
                const grain = Math.sin(rr * 0.9 * (512 / S) + g * 3 + a * 8) * 0.5 + 0.5
                const fine = hash(Math.floor(a * S * 0.8), Math.floor(rr * 0.5)) * 0.08
                let l = lit * (0.82 + 0.18 * grain - fine)
                if (outer && Math.abs(rr - ringMid) < 1.2) l *= 0.55
                const o = (j * S + i) * 4
                for (let ch = 0; ch < 3; ch++) p[o + ch] = p[o + ch] + (clamp(wood[ch] * l, 0, 255) - p[o + ch]) * cover
            }
        }
        c.putImageData(hd, 0, 0)
        c.save()
        c.translate(S / 2, S / 2 - hoopOut + S * 0.005)
        const bw = S * 0.05, bh = S * 0.075
        const bg = c.createLinearGradient(-bw, 0, bw, 0)
        bg.addColorStop(0, '#6e5524')
        bg.addColorStop(0.35, '#e9cf86')
        bg.addColorStop(0.6, '#b9963f')
        bg.addColorStop(1, '#5f4618')
        c.fillStyle = 'rgba(40,25,10,0.35)'
        c.fillRect(-bw * 0.5 + S * 0.006, -bh + S * 0.008, bw, bh)
        c.fillStyle = bg
        c.fillRect(-bw * 0.5, -bh, bw * 0.42, bh)
        c.fillRect(bw * 0.08, -bh, bw * 0.42, bh)
        c.fillStyle = '#8a6a2a'
        c.fillRect(-bw * 0.85, -bh * 0.72, bw * 1.7, bh * 0.2)
        c.fillStyle = bg
        c.beginPath()
        c.arc(bw * 0.95, -bh * 0.62, S * 0.018, 0, Math.PI * 2)
        c.fill()
        c.restore()
    }
    return cv
}

let cache = { key: '', canvas: null }

export default {
    id: 'cross-stitch',
    name: 'Grumpy sampler',
    note: 'A red-faced, side-eyeing face cross-stitched on aida in a wooden hoop, still unfinished, glaring at the needle that is stitching it.',
    defaults: { thread: '#f2b13c', floss: '#3a2216', fabric: '#f1ebdc', count: 44, irregular: 1, needle: true, hoop: true },
    schema: [
        { group: 'Thread' },
        { key: 'thread', label: 'Face floss', type: 'color' },
        { key: 'floss', label: 'Outline floss', type: 'color' },
        { key: 'fabric', label: 'Aida', type: 'color' },
        { group: 'Stitching' },
        { key: 'count', label: 'Stitch count', type: 'range', min: 26, max: 50, step: 2 },
        { key: 'irregular', label: 'Hand wobble', type: 'range', min: 0, max: 3, step: 0.05 },
        { key: 'needle', label: 'Unfinished, needle in', type: 'toggle' },
        { key: 'hoop', label: 'Hoop', type: 'toggle' },
    ],
    draw(c, S, k) {
        const key = S + JSON.stringify(k)
        if (cache.key !== key) cache = { key, canvas: render(S, k) }
        c.drawImage(cache.canvas, 0, 0)
    },
}
