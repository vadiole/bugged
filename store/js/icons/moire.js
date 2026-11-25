const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
}

function eye(u, v, k) {
    const a = 0.34
    const gx = k.gaze * 0.07
    const t = Math.min(1, Math.abs(u) / a)
    const arch = Math.pow(1 - t * t, 0.85)
    const top = -0.2 * arch
    const bottom = 0.15 * arch
    const lid = 0.026
    const inside = t >= 1 ? -Math.hypot(Math.abs(u) - a, v) : Math.min(v - top, bottom - v)
    const iu = u - gx
    const iv = v - 0.005
    const r = Math.hypot(iu, iv)
    const ri = 0.148
    const rp = 0.0685
    let I
    if (inside < -lid) {
        const ro = Math.hypot(u, v * 1.45)
        I = 0.5 + 0.5 * Math.cos(Math.PI * 2 * (ro - 0.2) / 0.052)
        I = 0.5 + (I - 0.5) * (0.35 + 0.65 * Math.exp(-ro * ro * 3))
        I *= smooth(0.02, 0.09, -inside)
        I = 1 - (1 - I) * smooth(0.0, 0.04, -inside - lid)
    } else if (inside < 0) {
        I = 1
    } else {
        const shade = 0.42 * (1 - smooth(0, 0.07, inside))
        let s = shade
        if (r < ri + 0.006) {
            const fr = Math.PI * 2 * (r - rp) / 0.03
            const ring = 0.5 + 0.5 * Math.cos(fr)
            const spokes = 0.5 + 0.5 * Math.cos(Math.atan2(iv, iu) * 22 + r * 40)
            s = 0.25 + 0.55 * ring + 0.2 * spokes * smooth(rp, ri, r)
            s = Math.max(s, smooth(ri - 0.022, ri - 0.004, r))
            s = Math.max(s, 1 - smooth(rp - 0.004, rp + 0.002, r))
            const hl = Math.hypot(iu + 0.042, iv + 0.045)
            s *= smooth(0.016, 0.024, hl)
        }
        const m = smooth(ri - 0.002, ri + 0.006, r)
        I = s * (1 - m) + shade * m
        I = Math.max(I, 1 - smooth(0, 0.012, inside))
    }
    return I
}

const cache = new Map()

export default {
    id: 'moire',
    name: 'Moiré eye',
    note: 'Two line screens, slightly out of step. Neither holds an eye; the overlap does.',
    defaults: { lines: 92, weight: 0.46, twist: 0, gaze: 0.35, ink: '#111111', paper: '#f3f1ea' },
    schema: [
        { group: 'Screens' },
        { key: 'lines', label: 'Line count', type: 'range', min: 40, max: 160, step: 1 },
        { key: 'weight', label: 'Line weight', type: 'range', min: 0.25, max: 0.7, step: 0.01 },
        { key: 'twist', label: 'Screen twist', type: 'range', min: -1.5, max: 1.5, step: 0.05, unit: '°' },
        { group: 'Eye' },
        { key: 'gaze', label: 'Gaze', type: 'range', min: -1, max: 1, step: 0.01 },
        { group: 'Inks' },
        { key: 'ink', label: 'Ink', type: 'color' },
        { key: 'paper', label: 'Paper', type: 'color' },
    ],
    draw(c, S, k) {
        const key = JSON.stringify([S, k.lines, k.weight, k.twist, k.gaze, k.ink, k.paper])
        let img = cache.get(key)
        if (!img) {
            img = c.createImageData(S, S)
            const d = img.data
            const ink = hex(k.ink).map((x) => x / 255)
            const paper = hex(k.paper)
            const period = S / k.lines
            const n = Math.min(8, Math.max(3, Math.ceil(4 / period)))
            const tw = (k.twist * Math.PI) / 180
            const ct = Math.cos(tw)
            const st = Math.sin(tw)
            const w = k.weight
            for (let py = 0; py < S; py++) {
                for (let px = 0; px < S; px++) {
                    const u0 = (px + 0.5) / S - 0.5
                    const v0 = (py + 0.5) / S - 0.5
                    const I = eye(u0, v0, k)
                    let n1 = 0
                    let n2 = 0
                    for (let sy = 0; sy < n; sy++) {
                        for (let sx = 0; sx < n; sx++) {
                            const u = (px + (sx + 0.5) / n) / S - 0.5
                            const v = (py + (sy + 0.5) / n) / S - 0.5
                            const r2 = u * u + v * v
                            const bulge = v * (1 + 0.55 * Math.exp(-r2 / 0.05))
                            const ta = bulge * k.lines
                            const vb = -u * st + v * ct
                            const tb = (vb * (1 + 0.55 * Math.exp(-r2 / 0.05))) * k.lines + I * 0.5
                            const a = ta - Math.floor(ta) < w
                            const b = tb - Math.floor(tb) < w
                            if (a && b) n2++
                            else if (a || b) n1++
                        }
                    }
                    const nn = n * n
                    const i = (py * S + px) * 4
                    const n0 = nn - n1 - n2
                    for (let ch = 0; ch < 3; ch++) d[i + ch] = (paper[ch] * (n0 + n1 * ink[ch] + n2 * ink[ch] * ink[ch])) / nn
                    d[i + 3] = 255
                }
            }
            if (cache.size > 6) cache.delete(cache.keys().next().value)
            cache.set(key, img)
        }
        c.putImageData(img, 0, 0)
    },
}
