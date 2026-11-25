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
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
const mixc = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t)

const WALLS = {
    brick: { brick: [118, 52, 38], mortar: [70, 62, 56], spread: 0.35 },
    painted: { brick: [34, 34, 38], mortar: [22, 22, 25], spread: 0.15 },
    white: { brick: [170, 165, 155], mortar: [120, 115, 108], spread: 0.12 },
}

const wallCache = new Map()
function wall(S, kind) {
    const key = S + kind
    if (wallCache.has(key)) return wallCache.get(key)
    const W = WALLS[kind] ?? WALLS.brick
    const cv = document.createElement('canvas')
    cv.width = cv.height = S
    const c = cv.getContext('2d')
    const img = c.createImageData(S, S)
    const d = img.data
    const bh = S / 13
    const bw = bh * 2.6
    const m = Math.max(0.6, bh * 0.13)
    for (let y = 0; y < S; y++) {
        const row = Math.floor((y + bh * 0.4) / bh)
        const fy = (y + bh * 0.4) - row * bh
        for (let x = 0; x < S; x++) {
            const off = (row % 2) * bw * 0.5 + bw * 0.13
            const col = Math.floor((x + off) / bw)
            const fx = x + off - col * bw
            const edge = Math.min(fx, bw - fx, fy, bh - fy)
            const mortar = 1 - Math.min(1, Math.max(0, (edge - m * 0.5) / Math.max(0.7, m * 0.6)))
            const tone = 0.75 + hash(col, row, 3) * W.spread * 1.4 - W.spread * 0.4
            const grain = vnoise(x / (S / 90), y / (S / 90), 5) * 0.35 + vnoise(x / (S / 300), y / (S / 300), 9) * 0.25
            const chip = vnoise(x / (S / 40) + col * 3.1, y / (S / 40), 11) > 0.78 ? 0.75 : 1
            const shade = fy < m * 1.6 ? 0.82 : 1
            const i = (y * S + x) * 4
            for (let ch = 0; ch < 3; ch++) {
                const b = W.brick[ch] * tone * (0.78 + grain) * chip * shade
                const mm = W.mortar[ch] * (0.8 + grain * 0.6)
                d[i + ch] = b + (mm - b) * mortar
            }
            d[i + 3] = 255
        }
    }
    c.putImageData(img, 0, 0)
    wallCache.set(key, cv)
    if (wallCache.size > 6) wallCache.delete(wallCache.keys().next().value)
    return cv
}

const TUBES = [
    { ellipse: [330, 525, 62, 66, 0, 0], tone: 'a' },
    { ellipse: [318, 510, 38, 44, 0.3, 1.2], tone: 'b' },
    { ellipse: [470, 505, 92, 80, 0, 3.6], tone: 'a' },
    { ellipse: [638, 562, 118, 80, 0.3, 3.3], tone: 'a' },
    { pts: [[640, 500], [668, 560], [652, 624]], tone: 'a' },
    { curve: [[470, 428], [450, 300, 520, 188, 588, 198], [645, 208, 595, 322, 508, 432]], tone: 'b', dim: true },
    { curve: [[502, 426], [522, 300, 640, 212, 700, 232], [748, 250, 702, 330, 544, 440]], tone: 'b' },
    { pts: [[425, 578], [372, 656], [316, 698]], tone: 'b' },
    { pts: [[478, 586], [488, 670], [446, 744]], tone: 'b' },
    { pts: [[532, 574], [606, 650], [638, 738]], tone: 'b' },
    { pts: [[310, 594], [298, 630], [316, 656]], tone: 'a' },
    { pts: [[298, 466], [272, 438], [284, 414]], tone: 'a' },
]
const CLIPS = [[266, 540], [470, 586], [662, 486], [614, 638], [751, 597], [700, 246], [590, 210], [372, 656], [488, 670], [606, 650]]

const arcSpan = (t) => {
    const g = t.ellipse[5]
    return [g + 0.16, g + Math.PI * 2 - 0.16]
}

function trace(c, t) {
    c.beginPath()
    if (t.ellipse) {
        const [x, y, rx, ry, rot] = t.ellipse
        const [a0, a1] = arcSpan(t)
        c.ellipse(x, y, rx, ry, rot, a0, a1)
        return
    }
    if (t.curve) {
        const [m, ...cs] = t.curve
        c.moveTo(m[0], m[1])
        for (const q of cs) c.bezierCurveTo(...q)
        return
    }
    const p = t.pts
    c.moveTo(p[0][0], p[0][1])
    for (let i = 1; i < p.length - 1; i++) c.arcTo(p[i][0], p[i][1], p[i + 1][0], p[i + 1][1], 26)
    c.lineTo(p[p.length - 1][0], p[p.length - 1][1])
}

function ends(t) {
    if (t.ellipse) {
        const [x, y, rx, ry, rot] = t.ellipse
        const at = (a) => {
            const ex = Math.cos(a) * rx
            const ey = Math.sin(a) * ry
            return [x + ex * Math.cos(rot) - ey * Math.sin(rot), y + ex * Math.sin(rot) + ey * Math.cos(rot)]
        }
        return arcSpan(t).map(at)
    }
    if (t.curve) {
        const last = t.curve[t.curve.length - 1]
        return [t.curve[0], [last[4], last[5]]]
    }
    return [t.pts[0], t.pts[t.pts.length - 1]]
}

export default {
    id: 'neon',
    name: 'Neon fly',
    note: 'A bent-glass housefly buzzing on a back-alley wall. One wing is on its way out.',
    defaults: { body: '#ff2f7e', legs: '#38e8ff', flicker: 0.04, glow: 0.8, wall: 'brick' },
    schema: [
        { group: 'Glass' },
        { key: 'body', label: 'Body gas', type: 'color' },
        { key: 'legs', label: 'Wings gas', type: 'color' },
        { key: 'flicker', label: 'Dying wing', type: 'range', min: 0, max: 1, step: 0.01 },
        { key: 'glow', label: 'Bloom', type: 'range', min: 0, max: 1.5, step: 0.01 },
        { group: 'Wall' },
        { key: 'wall', label: 'Wall', type: 'select', options: [['brick', 'Brick'], ['painted', 'Black paint'], ['white', 'Whitewash']] },
    ],
    draw(c, S, k) {
        const A = hex(k.body)
        const B = hex(k.legs)
        const tone = (t) => (t.tone === 'a' ? A : B)
        const level = (t) => (t.dim ? k.flicker : 1)
        const u = S / 1000
        const off = () => {
            const cv = document.createElement('canvas')
            cv.width = cv.height = S
            const x = cv.getContext('2d')
            x.setTransform(u * 1.1, 0, 0, u * 1.1, -78 * u, -14 * u)
            x.lineCap = 'round'
            x.lineJoin = 'round'
            return [cv, x]
        }
        const albedo = wall(S, k.wall)
        c.save()
        c.setTransform(1, 0, 0, 1, 0, 0)
        c.globalCompositeOperation = 'source-over'
        c.drawImage(albedo, 0, 0)
        c.fillStyle = 'rgba(4,4,10,0.8)'
        c.fillRect(0, 0, S, S)
        const [lc, l] = off()
        l.fillStyle = '#000'
        l.fillRect(-200, -200, 1400, 1400)
        l.globalCompositeOperation = 'lighter'
        for (const [w, blur, a] of [[120, 150, 0.8], [40, 40, 0.9]]) {
            l.filter = `blur(${blur * u}px)`
            l.lineWidth = w
            for (const t of TUBES) {
                l.strokeStyle = rgba(tone(t), a * level(t))
                trace(l, t)
                l.stroke()
            }
        }
        l.filter = 'none'
        l.globalCompositeOperation = 'multiply'
        l.setTransform(1, 0, 0, 1, 0, 0)
        l.drawImage(albedo, 0, 0)
        c.globalCompositeOperation = 'lighter'
        c.globalAlpha = Math.min(1, 0.35 + k.glow * 0.55)
        c.drawImage(lc, 0, 0)
        c.globalAlpha = 1
        c.globalCompositeOperation = 'source-over'
        const g = c.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.75)
        g.addColorStop(0, 'rgba(0,0,0,0)')
        g.addColorStop(1, 'rgba(0,0,0,0.55)')
        c.fillStyle = g
        c.fillRect(0, 0, S, S)
        c.setTransform(u * 1.1, 0, 0, u * 1.1, -78 * u, -14 * u)
        c.lineCap = 'round'
        c.lineJoin = 'round'
        c.filter = `blur(${7 * u}px)`
        c.strokeStyle = 'rgba(0,0,0,0.7)'
        c.lineWidth = 20
        for (const t of TUBES) {
            c.save()
            c.translate(14, 20)
            trace(c, t)
            c.stroke()
            c.restore()
        }
        c.filter = 'none'
        for (const [x, y] of CLIPS) {
            c.fillStyle = 'rgba(0,0,0,0.55)'
            c.beginPath()
            c.ellipse(x + 12, y + 16, 9, 7, 0, 0, Math.PI * 2)
            c.fill()
            c.strokeStyle = '#3a3a3e'
            c.lineWidth = 7
            c.beginPath()
            c.moveTo(x + 10, y + 13)
            c.lineTo(x, y)
            c.stroke()
            c.fillStyle = '#55555a'
            c.beginPath()
            c.arc(x + 10, y + 13, 6, 0, Math.PI * 2)
            c.fill()
        }
        for (const t of TUBES) {
            const col = tone(t)
            const lv = level(t)
            const glass = mixc([46, 48, 54], col, t.dim ? 0.12 : 0.25)
            c.strokeStyle = rgba(glass, 0.95)
            c.lineWidth = 23
            trace(c, t)
            c.stroke()
            if (lv > 0) {
                c.strokeStyle = rgba(col, lv)
                c.lineWidth = 21
                trace(c, t)
                c.stroke()
                c.strokeStyle = rgba(mixc(col, [255, 255, 255], 0.55), lv)
                c.lineWidth = 11
                trace(c, t)
                c.stroke()
                c.strokeStyle = rgba(mixc(col, [255, 255, 255], 0.88), lv)
                c.lineWidth = 5
                trace(c, t)
                c.stroke()
            }
            c.save()
            c.translate(-3.5, -4)
            c.strokeStyle = `rgba(255,255,255,${0.12 + 0.18 * (1 - lv)})`
            c.lineWidth = 2.5
            trace(c, t)
            c.stroke()
            c.restore()
            for (const [x, y] of ends(t)) {
                c.fillStyle = '#0d0d10'
                c.beginPath()
                c.arc(x, y, 11, 0, Math.PI * 2)
                c.fill()
                c.fillStyle = 'rgba(255,255,255,0.25)'
                c.beginPath()
                c.arc(x - 3, y - 4, 3, 0, Math.PI * 2)
                c.fill()
            }
        }
        for (const [x, y] of CLIPS) {
            c.strokeStyle = '#8a8a90'
            c.lineWidth = 5
            c.beginPath()
            c.arc(x, y, 13, Math.PI * 0.15, Math.PI * 0.85)
            c.stroke()
            c.strokeStyle = 'rgba(255,255,255,0.5)'
            c.lineWidth = 1.5
            c.beginPath()
            c.arc(x, y, 13.5, Math.PI * 0.3, Math.PI * 0.6)
            c.stroke()
        }
        c.globalCompositeOperation = 'lighter'
        for (const [w, blur, a] of [[26, 18, 0.55], [60, 46, 0.35]]) {
            c.filter = `blur(${blur * u}px)`
            c.lineWidth = w
            for (const t of TUBES) {
                c.strokeStyle = rgba(tone(t), a * k.glow * level(t))
                trace(c, t)
                c.stroke()
            }
        }
        for (const t of TUBES) {
            if (!t.dim) continue
            const [x, y] = ends(t)[0]
            const [px, py] = [t.curve[1][0], t.curve[1][1]]
            const len = Math.hypot(x - px, y - py)
            const gx = x + ((px - x) / len) * 22
            const gy = y + ((py - y) / len) * 22
            c.filter = `blur(${10 * u}px)`
            c.fillStyle = rgba(tone(t), 0.7)
            c.beginPath()
            c.arc(gx, gy, 16, 0, Math.PI * 2)
            c.fill()
            c.filter = 'none'
            c.strokeStyle = rgba(mixc(tone(t), [255, 255, 255], 0.6), 0.85)
            c.lineWidth = 7
            c.beginPath()
            c.moveTo(x + ((px - x) / len) * 12, y + ((py - y) / len) * 12)
            c.lineTo(x + ((px - x) / len) * 30, y + ((py - y) / len) * 30)
            c.stroke()
        }
        c.filter = 'none'
        c.restore()
    },
}
