const COLS = 18
const ROWS = 13
const LINE = 4
const LEFT = 3
const URL = 'shop.io/p'
const QUERY = '?utm_source=ig&fbclid=IwAR3xq9Lk_gclid=Cj0KCQiA_ref=sh_mc_eid=7f3a'
const HISTORY = [[1, 2, '$ bugged --strip']]
const LADDER = ['%', '#', '=', '+', ':', '~', '-', '.', '`', '░', '▒', '▓', '/', '\\', '|', '^', '0', '1']

const PHOSPHORS = {
    amber: { base: [255, 168, 20], hot: [255, 236, 190], bg: [16, 8, 2] },
    green: { base: [60, 255, 110], hot: [215, 255, 220], bg: [3, 12, 6] },
    white: { base: [200, 215, 255], hot: [255, 255, 255], bg: [7, 8, 12] },
}

function rng(seed) {
    let s = seed >>> 0
    return () => {
        s = (s + 0x6d2b79f5) >>> 0
        let t = s
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function layout(decay, seed) {
    const r = rng(seed * 977 + 13)
    const cells = []
    for (const [col, row, text] of HISTORY) [...text].forEach((ch, i) => cells.push({ col: col + i, row, ch, i: 0.22 }))
    cells.push({ col: LEFT - 2, row: LINE, ch: '>', i: 0.5 })
    ;[...URL].forEach((ch, n) => cells.push({ col: LEFT + n, row: LINE, ch, i: 1, hot: true }))
    const cursor = { col: LEFT + URL.length, row: LINE }
    const q = [...QUERY]
    let n = 0
    const next = () => q[n++ % q.length]
    const onLine = Math.round((1 - decay) * 7)
    for (let j = 0; j < 7; j++) {
        const col = cursor.col + 1 + j
        if (col >= COLS) break
        const ch = next()
        if (j < onLine) cells.push({ col, row: LINE, ch, i: 0.75 })
        else if (r() < 0.6) cells.push({ col: col + (r() - 0.5) * 0.2, row: LINE + 0.15 + r() * 0.5, ch, i: 0.7, rot: (r() - 0.5) * 0.9, streak: 0.3 + r() * 0.4 })
    }
    const floorY = ROWS - 2.6
    const centre = LEFT + 5.2
    const heapN = Math.round(4 + decay * 20)
    const slots = []
    for (let row = 0; slots.length < heapN; row++) {
        const width = Math.max(1, 9 - row * 2.4)
        const count = Math.max(1, Math.round(width / 0.85))
        for (let j = 0; j < count && slots.length < heapN; j++) {
            const x = centre - width / 2 + (j + 0.5) * (width / count)
            const dx = (x - centre) / 6
            slots.push({ col: x + (r() - 0.5) * 0.4, row: floorY - row * 0.62 + dx * dx * 1.4 + (r() - 0.5) * 0.15 })
        }
    }
    slots.forEach((s, j) => cells.push({ ...s, ch: next(), i: 0.42 + 0.22 * r() - j * 0.004, rot: (r() - 0.5) * 3.4 }))
    const fallers = Math.round(3 + decay * 8)
    for (let j = 0; j < fallers; j++) {
        const col = LEFT - 0.5 + (j + r() * 0.8) * (12 / fallers)
        const span = floorY - LINE - 2.2
        const row = LINE + 1.6 + span * ((j * 0.618 + r() * 0.5) % 1)
        const v = (row - LINE) / (floorY - LINE)
        cells.push({ col, row, ch: next(), i: 1, hot: r() < 0.5, rot: (r() - 0.5) * 1.4 * v, streak: 0.8 + v * 3.2 })
    }
    return { cells, cursor }
}

const cache = new Map()
function remember(key, make) {
    if (cache.has(key)) return cache.get(key)
    const v = make()
    cache.set(key, v)
    if (cache.size > 6) cache.delete(cache.keys().next().value)
    return v
}

function render(S, k) {
    const ph = PHOSPHORS[k.phosphor] ?? PHOSPHORS.amber
    const { cells, cursor } = layout(k.decay, k.seed)
    const cw = S / COLS, chh = S / ROWS
    const ox = (S - cw * COLS) / 2
    const text = document.createElement('canvas')
    text.width = text.height = S
    const t = text.getContext('2d')
    t.font = `600 ${chh * 0.74}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`
    t.textAlign = 'center'
    t.textBaseline = 'middle'
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
    for (const cell of cells) {
        const x = ox + (cell.col + 0.5) * cw, y = (cell.row + 0.55) * chh
        const col = cell.hot ? ph.hot.map((v, i) => Math.round(v * 0.45 + ph.base[i] * 0.55)) : ph.base
        if (cell.streak) {
            const len = cell.streak * chh
            const steps = Math.max(4, Math.round(len / Math.max(0.5, S / 400)))
            for (let j = steps; j >= 1; j--) {
                const f = j / steps
                t.save()
                t.translate(x, y - len * f)
                t.rotate((cell.rot ?? 0) * (1 - f * 0.6))
                t.fillStyle = rgba(ph.base, Math.min(1, (cell.i * 2.6 / steps) * (1 - f) ** 1.5))
                t.fillText(cell.ch, 0, 0)
                t.restore()
            }
        }
        t.save()
        t.translate(x, y)
        if (cell.rot) t.rotate(cell.rot)
        t.fillStyle = rgba(col, Math.min(1, cell.i))
        t.fillText(cell.ch, 0, 0)
        t.restore()
    }
    const cx = ox + cursor.col * cw, cy = cursor.row * chh
    t.fillStyle = rgba(ph.hot.map((v, i) => Math.round(v * 0.6 + ph.base[i] * 0.4)), 1)
    t.fillRect(cx + cw * 0.06, cy + chh * 0.12, cw * 0.88, chh * 0.86)

    const lines = Math.round(chh / Math.max(1, S / 300))
    const pitch = chh / Math.max(6, Math.min(12, lines))
    const vis = Math.min(1, Math.max(0, (pitch - 1.6) / 2.4)) * k.scanlines
    if (vis > 0) {
        t.globalCompositeOperation = 'destination-out'
        t.fillStyle = `rgba(0,0,0,${0.55 * vis})`
        for (let y = pitch * 0.55; y < S; y += pitch) t.fillRect(0, y, S, pitch * 0.42)
        t.globalCompositeOperation = 'source-over'
    }

    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = S
    const c = canvas.getContext('2d')
    const bg = c.createRadialGradient(S * 0.5, S * 0.48, 0, S * 0.5, S * 0.5, S * 0.75)
    bg.addColorStop(0, rgba(ph.bg.map((v, i) => Math.round(v * 1.6 + ph.base[i] * 0.03)), 1))
    bg.addColorStop(1, rgba(ph.bg.map((v) => Math.round(v * 0.35)), 1))
    c.fillStyle = bg
    c.fillRect(0, 0, S, S)
    c.globalCompositeOperation = 'lighter'
    const g = k.glow
    for (const [blur, alpha] of [[0.05, 0.35], [0.016, 0.55], [0.005, 0.7]]) {
        c.filter = `blur(${Math.max(0.4, S * blur)}px)`
        c.globalAlpha = Math.min(1, alpha * g)
        c.drawImage(text, 0, 0)
    }
    c.filter = 'none'
    c.globalAlpha = 1
    c.drawImage(text, 0, 0)
    c.globalCompositeOperation = 'source-over'
    const vig = c.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.75)
    vig.addColorStop(0, 'rgba(0,0,0,0)')
    vig.addColorStop(1, 'rgba(0,0,0,0.55)')
    c.fillStyle = vig
    c.fillRect(0, 0, S, S)
    c.globalCompositeOperation = 'screen'
    const sheen = c.createLinearGradient(0, 0, S * 0.5, S * 0.6)
    sheen.addColorStop(0, 'rgba(255,240,220,0.07)')
    sheen.addColorStop(0.5, 'rgba(255,240,220,0)')
    c.fillStyle = sheen
    c.fillRect(0, 0, S, S)
    c.globalCompositeOperation = 'source-over'
    return canvas
}

export default {
    id: 'ascii',
    name: 'Amber terminal',
    note: 'The clean link stays lit; its tracking query crumbles off the line and piles up on the floor of the screen.',
    defaults: { phosphor: 'amber', decay: 0.8, glow: 1, scanlines: 0.8, seed: 5 },
    schema: [
        { group: 'Text' },
        { key: 'decay', label: 'Crumble', type: 'range', min: 0, max: 1, step: 0.01 },
        { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 60, step: 1 },
        { group: 'Tube' },
        { key: 'phosphor', label: 'Phosphor', type: 'select', options: [['amber', 'P3 amber'], ['green', 'P1 green'], ['white', 'P4 white']] },
        { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 2, step: 0.01 },
        { key: 'scanlines', label: 'Scanlines', type: 'range', min: 0, max: 1, step: 0.01 },
    ],
    draw(c, S, k) {
        c.drawImage(remember([S, k.phosphor, k.decay, k.glow, k.scanlines, k.seed].join('|'), () => render(S, k)), 0, 0)
    },
}
