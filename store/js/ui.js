export function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue
        if (k === 'class') node.className = v
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v)
        else if (k.startsWith('on')) node.addEventListener(k.slice(2), v)
        else if (k === 'text') node.textContent = v
        else node.setAttribute(k, v === true ? '' : v)
    }
    for (const child of children.flat()) if (child != null) node.append(child)
    return node
}

export function store(name, defaults) {
    const key = 'bugged-lab:' + name
    let saved = {}
    try {
        saved = JSON.parse(localStorage.getItem(key) || '{}')
    } catch {}
    const values = { ...defaults }
    for (const k of Object.keys(defaults)) if (k in saved && typeof saved[k] === typeof defaults[k]) values[k] = saved[k]
    const listeners = new Set()
    const save = () => {
        try {
            localStorage.setItem(key, JSON.stringify(values))
        } catch {}
    }
    return {
        key,
        values,
        defaults,
        get: (k) => values[k],
        set(k, v) {
            if (values[k] === v) return
            values[k] = v
            save()
            for (const fn of listeners) fn(k, v)
        },
        reset() {
            Object.assign(values, defaults)
            save()
            for (const fn of listeners) fn(null, null)
        },
        changed: () => Object.keys(defaults).filter((k) => values[k] !== defaults[k]),
        onChange(fn) {
            listeners.add(fn)
            return () => listeners.delete(fn)
        },
    }
}

export function chips(options, value, onPick, { keys = false } = {}) {
    const row = el('div', { class: 'chips', role: 'radiogroup' })
    const buttons = new Map()
    let current = value
    options.forEach(([id, label], i) => {
        const b = el('button', { class: 'chip', type: 'button', role: 'radio', 'aria-checked': String(id === value), onclick: () => pick(id) }, keys ? el('kbd', { text: String(i + 1) }) : null, label)
        buttons.set(id, b)
        row.append(b)
    })
    function show(id) {
        current = id
        for (const [k, b] of buttons) b.setAttribute('aria-checked', String(k === id))
    }
    function pick(id) {
        if (id === current || !buttons.has(id)) return
        show(id)
        onPick(id)
    }
    return { node: row, set: show, pick, get: () => current, options }
}

export function button(label, onClick, attrs = {}) {
    return el('button', { class: 'chip action', type: 'button', onclick: onClick, ...attrs }, label)
}

const format = (v, step) => {
    const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3
    return Number(v).toFixed(digits)
}

export function knobs(schema, state, { title = 'Tuning' } = {}) {
    const panel = el('div', { class: 'knobs' })
    const syncs = []
    let group = null
    for (const k of schema) {
        if (k.group) {
            group = el('fieldset', { class: 'group' }, el('legend', { text: k.group }))
            panel.append(group)
            continue
        }
        const host = group ?? panel
        const id = 'k-' + Math.random().toString(36).slice(2, 8)
        if (k.type === 'range') {
            const out = el('output', { for: id })
            const input = el('input', {
                id, type: 'range', min: k.min, max: k.max, step: k.step ?? 0.01,
                oninput: () => {
                    state.set(k.key, Number(input.value))
                    out.textContent = format(input.value, k.step ?? 0.01) + (k.unit ?? '')
                },
                ondblclick: () => state.set(k.key, state.defaults[k.key]),
            })
            host.append(el('div', { class: 'knob' }, el('label', { for: id, text: k.label }), out, input))
            syncs.push(() => {
                input.value = state.get(k.key)
                out.textContent = format(state.get(k.key), k.step ?? 0.01) + (k.unit ?? '')
            })
        } else if (k.type === 'select') {
            const c = chips(k.options, state.get(k.key), (v) => state.set(k.key, v))
            host.append(el('div', { class: 'knob wide' }, el('span', { class: 'label', text: k.label }), c.node))
            syncs.push(() => c.set(state.get(k.key)))
        } else if (k.type === 'toggle') {
            const input = el('input', { id, type: 'checkbox', onchange: () => state.set(k.key, input.checked) })
            host.append(el('div', { class: 'knob toggle' }, el('label', { for: id, text: k.label }), input))
            syncs.push(() => (input.checked = !!state.get(k.key)))
        } else if (k.type === 'color') {
            const input = el('input', { id, type: 'color', oninput: () => state.set(k.key, input.value) })
            host.append(el('div', { class: 'knob toggle' }, el('label', { for: id, text: k.label }), input))
            syncs.push(() => (input.value = state.get(k.key)))
        } else if (k.type === 'text') {
            const input = el(k.rows ? 'textarea' : 'input', { id, rows: k.rows, spellcheck: 'false', onchange: () => state.set(k.key, input.value) })
            host.append(el('div', { class: 'knob wide' }, el('label', { for: id, text: k.label }), input))
            syncs.push(() => (input.value = state.get(k.key)))
        }
    }
    const count = el('span', { class: 'dim' })
    const sync = () => {
        for (const fn of syncs) fn()
        const n = state.changed().length
        count.textContent = n ? `${n} changed` : 'defaults'
    }
    state.onChange(sync)
    sync()
    const copy = button('Copy values', async () => {
        const diff = Object.fromEntries(state.changed().map((k) => [k, state.get(k)]))
        await navigator.clipboard.writeText(JSON.stringify(diff, null, 2))
        toast(state.changed().length ? 'Changed values copied' : 'Nothing changed from defaults')
    })
    let armed = 0
    const reset = button('Reset', () => {
        if (!state.changed().length) return
        if (Date.now() < armed) {
            armed = 0
            reset.textContent = 'Reset'
            state.reset()
            return
        }
        armed = Date.now() + 4000
        reset.textContent = 'Tap again to reset'
        setTimeout(() => {
            if (armed) reset.textContent = 'Reset'
            armed = 0
        }, 4000)
    })
    const head = el('div', { class: 'knobs-head' }, el('h2', { text: title }), count, copy, reset)
    const saved = el('div', { class: 'presets' })
    const slot = state.key + ':presets'
    const load = () => {
        try {
            return JSON.parse(localStorage.getItem(slot) || '[]')
        } catch {
            return []
        }
    }
    const list = () => {
        const presets = load()
        const put = (next) => {
            localStorage.setItem(slot, JSON.stringify(next))
            list()
        }
        saved.replaceChildren(
            button('Save', () => put([...presets, { ...state.values }])),
            ...presets.map((values, i) => {
                const chip = button(String(i + 1), (event) => {
                    if (event.shiftKey) return put(presets.filter((_, j) => j !== i))
                    for (const k of Object.keys(state.defaults)) if (k in values) state.set(k, values[k])
                    toast('Loaded save ' + (i + 1))
                })
                chip.title = 'Click to load, Shift-click to delete'
                return chip
            }),
        )
    }
    list()
    panel.prepend(head, saved)
    return panel
}

let toastNode = null
let toastTimer = 0
export function toast(text) {
    if (!toastNode) {
        toastNode = el('div', { class: 'toast', role: 'status' })
        document.body.append(toastNode)
    }
    toastNode.textContent = text
    toastNode.classList.add('on')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toastNode.classList.remove('on'), 2200)
}

export function download(canvas, name) {
    canvas.toBlob((blob) => {
        const a = el('a', { href: URL.createObjectURL(blob), download: name })
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    }, 'image/png')
}

export const hex = (h) => {
    const n = parseInt(h.slice(1), 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const smooth = (t) => {
    const x = clamp(t)
    return x * x * (3 - 2 * x)
}
export const ease = {
    linear: (t) => t,
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outQuint: (t) => 1 - Math.pow(1 - t, 5),
    hold: () => 0,
}
