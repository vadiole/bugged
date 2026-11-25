/**
 * Adds a squircle, a rectangle with smoothed corners, to a canvas or a Path2D.
 * Works like `roundRect`, plus `smoothing`. Pass `smoothing` 0 to get exactly what `roundRect` draws.
 *
 * ```js
 * ctx.beginPath();
 * squircle(ctx, 10, 10, 200, 120, 24);
 * ctx.fill();
 * ```
 *
 * @param {CanvasRenderingContext2D | Path2D} path
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number | DOMPointInit | (number | DOMPointInit)[]} [radii] 1–4 radii in the same order as `roundRect`. Corners are circular, so `{x, y}` uses `x`.
 * @param {number} [smoothing] Figma's corner smoothing, from 0 to 1. 0 is a plain rounded rectangle, 0.6 is close to iOS.
 * Smoothing needs room along the edges, so it's reduced on crowded corners and a pill stays a pill.
 */
export function squircle(path, x, y, width, height, radii = 0, smoothing = 0.6) {
    if (!(smoothing >= 0 && smoothing <= 1)) throw new RangeError("smoothing must be from 0 to 1");
    let [topLeft, topRight, bottomRight, bottomLeft] = expand(radii);
    if (![x, y, width, height].every(Number.isFinite) || width === 0 || height === 0) return;
    if (width < 0) {
        x += width;
        width = -width;
        [topLeft, topRight, bottomRight, bottomLeft] = [topRight, topLeft, bottomLeft, bottomRight];
    }
    if (height < 0) {
        y += height;
        height = -height;
        [topLeft, topRight, bottomRight, bottomLeft] = [bottomLeft, bottomRight, topRight, topLeft];
    }
    const scale = Math.min(1, fit(width, topLeft + topRight), fit(height, topRight + bottomRight), fit(width, bottomRight + bottomLeft), fit(height, bottomLeft + topLeft));
    const r0 = topLeft * scale;
    const r1 = topRight * scale;
    const r2 = bottomRight * scale;
    const r3 = bottomLeft * scale;
    const right = x + width;
    const bottom = y + height;
    corner(path, 0, x, y, r0, Math.min(share(height, r0, r3), share(width, r0, r1)), smoothing);
    corner(path, 1, right, y, r1, Math.min(share(width, r1, r0), share(height, r1, r2)), smoothing);
    corner(path, 2, right, bottom, r2, Math.min(share(height, r2, r1), share(width, r2, r3)), smoothing);
    corner(path, 3, x, bottom, r3, Math.min(share(width, r3, r2), share(height, r3, r0)), smoothing);
    path.closePath();
}

/**
 * Returns squircle path data for SVG or CSS `clip-path: path()`.
 *
 * ```js
 * pathElement.setAttribute("d", squirclePath(200, 120, 24));
 * ```
 *
 * @param {number} width
 * @param {number} height
 * @param {number | DOMPointInit | (number | DOMPointInit)[]} [radii]
 * @param {number} [smoothing]
 * @returns {string}
 */
export function squirclePath(width, height, radii = 0, smoothing = 0.6) {
    const svg = new SvgPath();
    squircle(svg, 0, 0, width, height, radii, smoothing);
    return svg.d;
}

/**
 * Clips an element to a squircle and keeps the clip in sync with its size.
 * Without `radii`, it reads the element's `border-radius`, so without JavaScript the element keeps its plain rounded corners.
 * Call it again to apply new options or a changed `border-radius`.
 *
 * The clip also cuts off `box-shadow`, `outline`, and the outer edge of a `border` near the corners.
 * Put those on a wrapper element, or draw the shape with `squirclePath` in an SVG.
 *
 * ```js
 * document.querySelectorAll(".card").forEach(card => squircleClip(card));
 * ```
 *
 * @param {Element} element
 * @param {{ radii?: number | DOMPointInit | (number | DOMPointInit)[], smoothing?: number }} [options]
 * @returns {() => void} removes the clip and restores the previous inline `clip-path`
 */
export function squircleClip(element, { radii, smoothing = 0.6 } = {}) {
    if (!(smoothing >= 0 && smoothing <= 1)) throw new RangeError("smoothing must be from 0 to 1");
    if (typeof ResizeObserver === "undefined") return () => {};
    observer ??= new ResizeObserver(entries => {
        for (const entry of entries) {
            const clip = clips.get(entry.target);
            if (!clip) continue;
            clip.width = entry.borderBoxSize[0].inlineSize;
            clip.height = entry.borderBoxSize[0].blockSize;
            applyClip(entry.target, clip);
        }
    });
    const clip = clips.get(element);
    if (clip) {
        clip.radii = radii;
        clip.smoothing = smoothing;
        applyClip(element, clip);
    } else {
        clips.set(element, { radii, smoothing, width: 0, height: 0, previous: element.style.clipPath });
        observer.observe(element);
    }
    return () => {
        const clip = clips.get(element);
        if (!clip) return;
        clips.delete(element);
        observer.unobserve(element);
        element.style.clipPath = clip.previous;
    };
}

const clips = new WeakMap();
let observer;

function applyClip(element, clip) {
    if (!(clip.width > 0 && clip.height > 0)) return;
    const radii = clip.radii ?? borderRadii(element, Math.min(clip.width, clip.height));
    element.style.clipPath = `path("${squirclePath(clip.width, clip.height, radii, clip.smoothing)}")`;
}

const IN_X = [0, 1, 0, -1];
const IN_Y = [-1, 0, 1, 0];

function corner(path, index, cornerX, cornerY, radius, budget, smoothing) {
    const ix = IN_X[index];
    const iy = IN_Y[index];
    const r = Math.min(radius, budget);
    if (r <= 0) {
        index ? path.lineTo(cornerX, cornerY) : path.moveTo(cornerX, cornerY);
        return;
    }
    const s = Math.min(smoothing, budget / r - 1);
    const p = (1 + s) * r;
    const angle = Math.PI / 4 * s;
    const arc = Math.SQRT2 * r * Math.sin(Math.PI / 4 - angle);
    const tangent = r * Math.tan(angle / 2);
    const c = tangent * Math.cos(angle);
    const d = tangent * Math.sin(angle);
    const b = (p - arc - c - d) / 3;
    const a = 2 * b;
    const startX = cornerX - p * ix;
    const startY = cornerY - p * iy;
    const endX = cornerX - p * iy;
    const endY = cornerY + p * ix;
    index ? path.lineTo(startX, startY) : path.moveTo(startX, startY);
    if (s > 0) path.bezierCurveTo(startX + a * ix, startY + a * iy, startX + (a + b) * ix, startY + (a + b) * iy, startX + (a + b + c) * ix - d * iy, startY + (a + b + c) * iy + d * ix);
    if (s < 1) {
        const start = Math.PI * (1 + index / 2) + angle;
        path.arc(cornerX - r * ix - r * iy, cornerY - r * iy + r * ix, r, start, start + Math.PI / 2 - 2 * angle);
    }
    if (s > 0) path.bezierCurveTo(endX + (a + b) * iy, endY - (a + b) * ix, endX + a * iy, endY - a * ix, endX, endY);
}

function expand(radii) {
    const list = (Array.isArray(radii) ? radii : [radii]).map(r => typeof r === "object" && r !== null ? Number(r.x ?? 0) : Number(r));
    if (list.length < 1 || list.length > 4) throw new RangeError("radii must have 1 to 4 values");
    if (list.some(r => !(r >= 0))) throw new RangeError("radii must be non-negative numbers");
    const [a, b = a, c = a, d = b] = list;
    return [a, b, c, d];
}

function fit(side, sum) {
    return sum > 0 ? side / sum : 1;
}

function share(side, radius, other) {
    return radius > 0 ? side * radius / (radius + other) : 0;
}

function borderRadii(element, side) {
    const style = getComputedStyle(element);
    return [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius]
        .map(value => (value.split(" ")[0].endsWith("%") ? parseFloat(value) * side / 100 : parseFloat(value)) || 0);
}

class SvgPath {
    d = "";

    moveTo(x, y) {
        this.d += `M${n(x)} ${n(y)}`;
    }

    lineTo(x, y) {
        this.d += `L${n(x)} ${n(y)}`;
    }

    bezierCurveTo(x1, y1, x2, y2, x, y) {
        this.d += `C${n(x1)} ${n(y1)} ${n(x2)} ${n(y2)} ${n(x)} ${n(y)}`;
    }

    arc(cx, cy, r, start, end) {
        this.d += `A${n(r)} ${n(r)} 0 0 1 ${n(cx + r * Math.cos(end))} ${n(cy + r * Math.sin(end))}`;
    }

    closePath() {
        this.d += "Z";
    }
}

function n(v) {
    return Math.round(v * 1000) / 1000 || 0;
}
