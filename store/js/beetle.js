export const BEETLE_SCHEMA = [
    { group: 'Scene' },
    { key: 'mode', label: 'Mode', type: 'select', options: [['plain', 'Plain'], ['amber', 'Amber'], ['pinned', 'Pinned']] },
    { key: 'species', label: 'Species', type: 'select', options: [['emerald', 'Emerald jewel'], ['stag', 'Black stag'], ['ladybird', 'Ladybird'], ['scarab', 'Gold scarab']] },
    { group: 'View' },
    { key: 'yaw', label: 'Yaw', type: 'range', min: -180, max: 180, step: 1, unit: '°' },
    { key: 'pitch', label: 'Pitch', type: 'range', min: 20, max: 90, step: 1, unit: '°' },
    { key: 'zoom', label: 'Zoom', type: 'range', min: 0.6, max: 1.6, step: 0.01, unit: '×' },
    { group: 'Shell' },
    { key: 'hue', label: 'Hue shift', type: 'range', min: -180, max: 180, step: 1, unit: '°' },
    { key: 'iridescence', label: 'Iridescence', type: 'range', min: 0, max: 1, step: 0.01 },
    { key: 'gloss', label: 'Gloss', type: 'range', min: 0, max: 1, step: 0.01 },
    { key: 'punctures', label: 'Puncture depth', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'Light' },
    { key: 'lightAngle', label: 'Direction', type: 'range', min: -180, max: 180, step: 1, unit: '°' },
    { key: 'lightHeight', label: 'Height', type: 'range', min: 15, max: 85, step: 1, unit: '°' },
    { key: 'shadow', label: 'Shadow', type: 'range', min: 0, max: 1, step: 0.01 },
    { group: 'Ground' },
    { key: 'ground', label: 'Ground', type: 'color' },
    { key: 'paper', label: 'Paper', type: 'color' },
    { group: 'Amber' },
    { key: 'amber', label: 'Amber colour', type: 'color' },
    { key: 'amberThickness', label: 'Thickness', type: 'range', min: 0, max: 1, step: 0.01 },
]

export const BEETLE_DEFAULTS = {
    mode: 'plain',
    species: 'emerald',
    yaw: -24,
    pitch: 58,
    zoom: 1,
    hue: 0,
    iridescence: 0.7,
    gloss: 0.8,
    punctures: 0.6,
    lightAngle: 130,
    lightHeight: 55,
    shadow: 0.7,
    ground: '#ece5d8',
    paper: '#f1ece1',
    amber: '#e8902c',
    amberThickness: 0.5,
}

const SPECIES = {
    emerald: { base: '#0f9440', alt: '#7a2140', front: '#14a24a', leg: '#0f5a34', jaw: '#0f5a34', metal: 1, shift: 110, round: 0, mand: 0, pattern: 2, rough: 0.2 },
    stag: { base: '#3c1d10', alt: '#3c1d10', front: '#120c0a', leg: '#110b08', jaw: '#5e2610', metal: 0.3, shift: 30, round: 0.2, mand: 1, pattern: 0, rough: 0.26 },
    ladybird: { base: '#d42619', alt: '#0a0909', front: '#0a0909', leg: '#0a0909', jaw: '#0a0909', metal: 0, shift: 12, round: 1, mand: 0, pattern: 1, rough: 0.22 },
    scarab: { base: '#e8b24a', alt: '#e8b24a', front: '#e8b24a', leg: '#9c6a26', jaw: '#9c6a26', metal: 1, shift: 40, round: 0.62, mand: 0, pattern: 0, rough: 0.14 },
}

const LEGS = [
    [[0.18, 0.13, 0.45], [0.56, 0.15, 0.66], [0.7, 0.03, 0.92], [0.78, 0.014, 1.1]],
    [[0.22, 0.12, 0.04], [0.76, 0.16, 0.1], [0.98, 0.03, -0.02], [1.13, 0.014, -0.08]],
    [[0.22, 0.12, -0.22], [0.72, 0.16, -0.5], [0.86, 0.03, -0.88], [0.92, 0.014, -1.06]],
]

const v3 = (a) => `vec3(${a.map((x) => x.toFixed(4)).join(',')})`
const legArr = (i) => `vec3[3](${LEGS.map((l) => v3(l[i])).join(',')})`
const legClaw = LEGS.map(([, , c, d]) => {
    const dir = sub(d, c)
    const l = Math.hypot(...dir)
    return [d[0] + (dir[0] / l) * 0.07, 0.006, d[2] + (dir[2] / l) * 0.07]
})

function sub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
function add(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
function mul(a, s) {
    return [a[0] * s, a[1] * s, a[2] * s]
}
function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
function norm(a) {
    return mul(a, 1 / Math.hypot(...a))
}

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform int uAA;
uniform int uMode;
uniform bool uTransparent;
uniform vec3 uCamPos, uCamFwd, uCamRight, uCamUp;
uniform vec2 uShiftUV;
uniform float uTan, uPix;
uniform vec3 uL, uLT, uLB, uR2, uR2T, uR2B, uFill;
uniform vec3 uBase, uAlt, uFront, uLeg, uJaw;
uniform float uMetal, uIrid, uShift, uRough, uCoatRough, uPunct, uPattern, uShadow, uLift;
uniform vec3 uGroundL, uPaperL, uAmberL;
uniform float uAmberDensity;
uniform vec3 uDrop;
uniform vec3 uBC;
uniform float uBR;
uniform vec3 uElyC, uElyR;
uniform float uElyTaper;
uniform vec3 uPrC, uPrR;
uniform float uPrTaper;
uniform vec3 uHdC, uHdR, uEyeC;
uniform float uEyeR;
uniform vec3 uM1, uM2, uM3, uMT, uMr;
uniform vec3 uA0, uA1, uA2, uAc;
uniform vec3 uScC;
uniform vec3 uPin;

const vec3 LA[3] = ${legArr(0)};
const vec3 LB[3] = ${legArr(1)};
const vec3 LC[3] = ${legArr(2)};
const vec3 LD[3] = ${legArr(3)};
const vec3 LE[3] = vec3[3](${legClaw.map(v3).join(',')});
const float PI = 3.14159265;
const vec3 KEY = vec3(1.0, 0.96, 0.9);

float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float cellPits(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float m = 1.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(x, y);
        vec2 o = vec2(hash12(i + g), hash12(i + g + 17.13));
        vec2 r = g + 0.15 + o * 0.7 - f;
        m = min(m, dot(r, r));
    }
    return 1.0 - smoothstep(0.03, 0.11, m);
}

float sdEll(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-6); }
float sdRC(vec3 p, vec3 a, vec3 b, float r1, float r2) {
    vec3 ba = b - a; float l2 = dot(ba, ba); float rr = r1 - r2; float a2 = l2 - rr * rr; float il2 = 1.0 / l2;
    vec3 pa = p - a; float y = dot(pa, ba); float z = y - l2;
    vec3 xv = pa * l2 - ba * y; float x2 = dot(xv, xv); float y2 = y * y * l2; float z2 = z * z * l2;
    float k = sign(rr) * rr * rr * x2;
    if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
    if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
    return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
float elyTaper(vec3 q) { float ez = clamp(-(q.z - uElyC.z) / uElyR.z, 0.0, 1.2); return 1.0 + uElyTaper * ez * ez; }
vec3 elyLocal(vec3 q) { vec3 e = q - uElyC; e.x *= elyTaper(q); return e; }

float segBead(vec3 q, vec3 a, vec3 b, float n, float amp) {
    vec3 ba = b - a; float s = clamp(dot(q - a, ba) / dot(ba, ba), 0.0, 1.0);
    return amp * (1.0 - abs(sin(s * PI * n)));
}

vec2 mapM(vec3 p) {
    p.y -= uLift;
    vec3 q = vec3(abs(p.x), p.y, p.z);
    float bd = length(p - vec3(0.0, 0.3, 0.05)) - 1.62;
    if (bd > 0.25) return vec2(bd, 0.0);
    float etp = elyTaper(q);
    float de = sdEll(elyLocal(q), uElyR) / etp;
    de += 0.01 * exp(-q.x * q.x / 0.00012);
    de = max(de, 0.2 - q.y);
    vec3 sp = q - uScC; float tw = 1.0 + clamp(-sp.z, 0.0, 0.09) * 9.0; sp.x *= tw;
    float dsc = max(sdEll(sp, vec3(0.06, 0.016, 0.07)) / tw, abs(sp.y) - 0.016);
    vec3 pp = q - uPrC; float tp = 1.0 + uPrTaper * clamp(pp.z / uPrR.z, 0.0, 1.0); pp.x *= tp;
    float dp = max(sdEll(pp, uPrR) / tp, 0.17 - q.y);
    float dh = max(sdEll(q - uHdC, uHdR), abs(q.y - uHdC.y) - uHdR.y);
    float dey = length(q - uEyeC) - uEyeR;
    float dab = max(sdEll(q - vec3(0.0, 0.19, -0.28), vec3(0.36, 0.075, 0.6)), abs(q.y - 0.19) - 0.075);
    float dap = dab, djw = 1e9;
    if (q.z > 0.45) {
        djw = sdRC(q, uM1, uM2, uMr.x, uMr.y);
        djw = min(djw, sdRC(q, uM2, uM3, uMr.y, uMr.z));
        djw = min(djw, sdRC(q, uM2, uMT, uMr.y * 0.7, uMr.z));
        float da = sdRC(q, uA0, uA1, 0.022, 0.016);
        da = min(da, sdRC(q, uA1, uA2, 0.014, 0.012) - segBead(q, uA1, uA2, 6.0, 0.004));
        vec3 cl = q - uAc;
        da = min(da, sdEll(cl, vec3(0.034, 0.028, 0.05)));
        dap = min(dap, da);
    }
    if (q.y < 0.42) {
        float dl = 1e9;
        for (int i = 0; i < 3; i++) {
            dl = min(dl, length(q - LA[i]) - 0.06);
            dl = min(dl, sdRC(q, LA[i], LB[i], 0.064, 0.05));
            dl = min(dl, sdRC(q, LB[i], LC[i], 0.042, 0.034));
            dl = min(dl, sdRC(q, LC[i], LD[i], 0.026, 0.02) - segBead(q, LC[i], LD[i], 4.0, 0.0025));
            dl = min(dl, sdRC(q, LD[i], LE[i], 0.015, 0.004));
        }
        dap = min(dap, dl);
    }
    vec2 r = vec2(de, 1.0);
    if (dsc < r.x) r = vec2(dsc, 6.0);
    if (dp < r.x) r = vec2(dp, 2.0);
    if (dh < r.x) r = vec2(dh, 3.0);
    if (dey < r.x) r = vec2(dey, 4.0);
    if (dap < r.x) r = vec2(dap, 5.0);
    if (djw < r.x) r = vec2(djw, 7.0);
    return r;
}
float map(vec3 p) { return mapM(p).x; }

vec3 calcN(vec3 p) {
    const vec2 k = vec2(1.0, -1.0); const float h = 0.0006;
    return normalize(k.xyy * map(p + k.xyy * h) + k.yyx * map(p + k.yyx * h) + k.yxy * map(p + k.yxy * h) + k.xxx * map(p + k.xxx * h));
}

float march(vec3 ro, vec3 rd, float t, float tmax) {
    for (int i = 0; i < 200; i++) {
        float h = map(ro + rd * t);
        if (h < 0.00025 * t) return t;
        t += h * 0.85;
        if (t > tmax) break;
    }
    return -1.0;
}

vec2 iSph(vec3 ro, vec3 rd, float r) { float b = dot(ro, rd); float c = dot(ro, ro) - r * r; float h = b * b - c; if (h < 0.0) return vec2(-1.0); h = sqrt(h); return vec2(-b - h, -b + h); }
vec2 iEll(vec3 ro, vec3 rd, vec3 r) { vec3 o = ro / r, d = rd / r; float a = dot(d, d), b = dot(o, d), c = dot(o, o) - 1.0; float h = b * b - a * c; if (h < 0.0) return vec2(-1.0); h = sqrt(h); return vec2(-b - h, -b + h) / a; }

float softShadow(vec3 ro, vec3 rd, float k, float tmax) {
    vec2 bs = iSph(ro - uBC, rd, uBR);
    if (bs.y < 0.0) return 1.0;
    float res = 1.0, t = max(0.004, bs.x) + 0.01 * hash12(gl_FragCoord.xy + ro.xz * 91.0), ph = 1e10;
    tmax = min(tmax, bs.y);
    for (int i = 0; i < 96; i++) {
        float h = map(ro + rd * t);
        float y = h * h / (2.0 * ph); float d = sqrt(max(h * h - y * y, 0.0));
        res = min(res, k * h / t); ph = h;
        t += clamp(h, 0.004, 0.07);
        if (res < 0.001 || t > tmax) break;
    }
    res = clamp(res, 0.0, 1.0);
    return res * res * (3.0 - 2.0 * res);
}

float calcAO(vec3 p, vec3 n) {
    float occ = 0.0, sca = 1.0;
    for (int i = 0; i < 5; i++) { float h = 0.012 + 0.05 * float(i); occ += (h - map(p + n * h)) * sca; sca *= 0.8; }
    return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
}

float pinShadow(vec3 p) {
    if (uMode != 2) return 1.0;
    vec2 d = uL.xz; float dd = dot(d, d);
    float s = max(dot(uPin.xy - p.xz, d) / dd, 0.0);
    float dist = length(p.xz + d * s - uPin.xy);
    float y = p.y + s * uL.y;
    float w = 0.002 + s * 0.006;
    float occ = min(0.85, 1.7 * 0.011 / (0.011 + w)) * (1.0 - smoothstep(0.0, 0.011 + w, dist));
    float sh = 1.0 - occ * smoothstep(uPin.z + w, uPin.z - w, y) * step(0.0001, s);
    vec3 hc = vec3(uPin.x, uPin.z, uPin.y);
    float sh2 = max(dot(hc - p, uL), 0.0);
    float wd = 0.002 + sh2 * 0.006;
    sh *= mix(1.0, smoothstep(0.07 - wd, 0.07 + wd, length(p + uL * sh2 - hc)) * 0.15 + 0.85 * smoothstep(0.07 - wd * 0.5, 0.07 + wd, length(p + uL * sh2 - hc)), step(0.0001, sh2));
    return sh;
}

vec3 elyRows(vec3 q) {
    vec3 e = elyLocal(q);
    float a = atan(e.x / uElyR.x, e.y / uElyR.y);
    float v = e.z / uElyR.z;
    float ra = a / 1.62 * 10.0 - 0.35;
    float fr = fract(ra) - 0.5, ri = floor(ra);
    float fv = fract(v * 21.0 + hash12(vec2(ri, 3.0))) - 0.5;
    float ends = smoothstep(1.0, 0.82, abs(v)) * step(0.0, ra);
    float pit = (1.0 - smoothstep(0.14, 0.3, length(vec2(fr, fv * 0.85)))) * ends;
    float groove = (1.0 - smoothstep(0.0, 0.16, abs(fr))) * ends;
    return vec3(pit, groove, a);
}

float detailH(vec3 p, float id, float fp) {
    p.y -= uLift;
    vec3 q = vec3(abs(p.x), p.y, p.z);
    float fade = 1.0 - smoothstep(0.014, 0.03, fp);
    float fadeF = 1.0 - smoothstep(0.004, 0.012, fp);
    float h = 0.0;
    if (id < 1.5) {
        vec3 r = elyRows(q);
        h -= (0.65 * r.x + 0.3 * r.y) * fade;
        h += 0.06 * (noise3(q * vec3(260.0, 260.0, 90.0)) - 0.5) * fadeF;
        h -= 0.9 * exp(-q.x * q.x / 0.00006) * smoothstep(0.0, 0.03, fp + 0.01);
    } else if (id < 3.5) {
        h -= 0.45 * cellPits(q.xz * (id < 2.5 ? 42.0 : 55.0) + vec2(0.0, q.y * 30.0)) * fade;
        if (id < 2.5) h -= 0.5 * exp(-q.x * q.x / 0.00012) * smoothstep(-0.15, 0.1, q.z - uPrC.z);
    } else if (id < 4.5) {
        vec3 d = q - uEyeC;
        h -= 0.25 * cellPits(vec2(atan(d.z, d.x) * 9.0, d.y * 140.0)) * fadeF;
    } else if (id > 6.5) {
        h -= 0.2 * cellPits(q.xz * 70.0) * fadeF;
    }
    return h * 0.006 * uPunct;
}

vec3 bumpN(vec3 p, vec3 n, float id, float fp) {
    if (uPunct < 0.001 || id > 4.5 && id < 6.5) return n;
    const float e = 0.0012;
    vec3 g = vec3(detailH(p + vec3(e, 0, 0), id, fp) - detailH(p - vec3(e, 0, 0), id, fp),
                  detailH(p + vec3(0, e, 0), id, fp) - detailH(p - vec3(0, e, 0), id, fp),
                  detailH(p + vec3(0, 0, e), id, fp) - detailH(p - vec3(0, 0, e), id, fp)) / (2.0 * e);
    g -= n * dot(n, g);
    return normalize(n - g);
}

float gBox = 1.0;
float box(vec2 p, vec2 s, float b) {
    s *= gBox;
    vec2 a = abs(p) / (s + b * 0.5);
    a *= a;
    float d = sqrt(sqrt(dot(a * a, vec2(1.0))));
    float bb = b / min(s.x, s.y);
    return smoothstep(1.0 + bb, 1.0 - bb * 0.7 - 0.02, d) * (1.0 - 0.3 * d * d) * (s.x * s.y) / ((s.x + b) * (s.y + b));
}

void envSplit(vec3 r, float rough, out vec3 key, out vec3 rest) {
    float b = 0.02 + rough * 1.1;
    float y = r.y;
    rest = mix(uGroundL * 0.3, vec3(0.05, 0.052, 0.056), smoothstep(-0.3, 0.05, y));
    rest += vec3(0.5, 0.52, 0.55) * smoothstep(0.25 - b * 0.5, 1.0 + b * 0.2, y);
    rest += vec3(0.9, 0.92, 0.95) * smoothstep(0.9 - b * 0.4, 0.99, y);
    float c2 = dot(r, uR2);
    if (c2 > 0.0) rest += vec3(2.2, 2.25, 2.35) * box(vec2(dot(r, uR2T), dot(r, uR2B)) / c2, vec2(0.14, 0.75), b);
    float c3 = dot(r, uFill);
    rest += vec3(0.5) * smoothstep(0.55 - b, 0.95, c3);
    key = vec3(0.0);
    float c1 = dot(r, uL);
    if (c1 > 0.0) key = KEY * 9.0 * box(vec2(dot(r, uLT), dot(r, uLB)) / c1, vec2(0.34, 0.24), b);
}
vec3 envFull(vec3 r, float rough) { vec3 k, s; envSplit(r, rough, k, s); return k + s; }

vec3 irr(vec3 n) {
    vec3 sky = mix(uGroundL * 0.5 + 0.04, vec3(0.62, 0.64, 0.68), smoothstep(-0.8, 0.8, n.y));
    return sky + 0.35 * max(dot(n, uFill), 0.0);
}

vec3 hueRot(vec3 c, float a) { const vec3 k = vec3(0.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca); }

vec3 shadeBeetle(vec3 p, vec3 rd, float t, vec3 keyTint) {
    float id = mapM(p).y;
    vec3 n0 = calcN(p);
    float fp = t * uPix;
    vec3 n = bumpN(p, n0, id, fp);
    vec3 lp = p - vec3(0.0, uLift, 0.0);
    vec3 q = vec3(abs(lp.x), lp.y, lp.z);
    vec3 alb = uBase; float metal = uMetal; float rough = uRough; float coat = 1.0; float cav = 0.0; float irid = uIrid;
    float fade = 1.0 - smoothstep(0.014, 0.03, fp);
    if (id < 1.5) {
        vec3 r = elyRows(q);
        cav = (r.x * 0.8 + r.y * 0.3) * fade;
        if (uPattern > 0.5 && uPattern < 1.5) {
            float s = 1.0;
            s = min(s, length(q.xz - vec2(0.0, 0.16)) / 0.11);
            s = min(s, length(q.xz - vec2(0.36, 0.0)) / 0.085);
            s = min(s, length(q.xz - vec2(0.2, -0.3)) / 0.11);
            s = min(s, length(q.xz - vec2(0.33, -0.6)) / 0.08);
            float m = smoothstep(1.04, 0.96, s);
            alb = mix(alb, uAlt, m);
        } else if (uPattern > 1.5) {
            float s1 = smoothstep(0.075, 0.05, abs(r.z - 0.62)), s2 = smoothstep(0.07, 0.045, abs(r.z - 1.22));
            alb = mix(alb, uAlt, max(s1, s2) * smoothstep(1.0, 0.75, abs(elyLocal(q).z / uElyR.z)));
        }
        rough += 0.06 * (1.0 - fade) * uPunct;
    } else if (id < 2.5 || id > 5.5 && id < 6.5) {
        alb = id < 2.5 ? uFront : uBase;
        if (uPattern > 0.5 && uPattern < 1.5 && id < 2.5) {
            float w = smoothstep(0.12, 0.1, length((q.xz - vec2(uPrR.x * 0.62, uPrC.z + uPrR.z * 0.45)) * vec2(1.0, 1.4)));
            alb = mix(alb, vec3(0.85, 0.83, 0.78), w);
        }
        if (uPattern > 1.5 && id < 2.5) alb = mix(alb, uAlt, smoothstep(0.05, 0.03, abs(q.x - uPrR.x * 0.42)));
        cav = 0.4 * cellPits(q.xz * 42.0) * fade;
    } else if (id < 3.5) {
        alb = uFront * 0.9;
        if (uPattern > 0.5 && uPattern < 1.5) alb = mix(alb, vec3(0.85, 0.83, 0.78), smoothstep(0.04, 0.03, length(q.xz - vec2(0.09, uHdC.z + 0.06))));
        cav = 0.3 * cellPits(q.xz * 55.0) * fade;
    } else if (id < 4.5) {
        alb = vec3(0.012, 0.009, 0.007); metal = 0.0; rough = 0.25; irid = 0.0;
    } else if (id < 5.5) {
        alb = uLeg; rough = min(1.0, uRough + 0.12); metal *= 0.85; irid *= 0.5;
    } else {
        alb = uJaw; rough = min(1.0, uRough + 0.06); metal *= 0.8;
    }
    rough *= 0.85 + 0.3 * noise3(q * 40.0);
    cav *= smoothstep(0.08, 0.45, dot(n0, -rd));
    rough = clamp(rough + cav * 0.25, 0.04, 1.0);
    float ao = calcAO(p, n0) * (1.0 - cav * 0.45);
    if (uMode == 2) {
        float dpn = length(p.xz - uPin.xy);
        ao *= mix(0.25, 1.0, smoothstep(0.012, 0.05, dpn));
    }
    float sh = softShadow(p + n0 * 0.004, uL, 10.0, 4.0) * pinShadow(p);
    vec3 v = -rd;
    float NoV = clamp(dot(n, v), 1e-3, 1.0);
    vec3 F0 = mix(vec3(0.04), alb, metal);
    float ang = radians(uShift) * irid * (pow(1.0 - NoV, 1.3) + 0.25 * (noise3(q * 7.0) - 0.5));
    F0 = clamp(hueRot(F0, ang), 0.0, 1.0);
    vec3 F = F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(1.0 - NoV, 5.0);
    vec3 r = reflect(rd, n);
    vec3 ek, er;
    envSplit(r, rough, ek, er);
    float so = clamp(pow(NoV + ao, 2.0) - 1.0 + ao, 0.0, 1.0);
    vec3 spec = (ek * sh * keyTint + er * so) * F;
    float NoL = max(dot(n, uL), 0.0);
    vec3 kd = (1.0 - metal) * alb;
    vec3 diff = kd * (KEY * keyTint * 2.2 * NoL * sh + irr(n) * ao) * (1.0 - F * 0.5);
    vec3 col = diff + spec;
    float Fc = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);
    vec3 ck, cr;
    envSplit(r, uCoatRough + cav * 0.1, ck, cr);
    col = col * (1.0 - Fc * coat) + coat * Fc * (ck * sh * keyTint + cr * so);
    return col;
}

vec3 tonemap(vec3 x) { x *= 0.95; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

float groundAO(vec3 g) {
    float occ = 0.0, sca = 1.0;
    float ext = uMode == 2 ? 1.5 : 1.0;
    for (int i = 0; i < 5; i++) { float h = (0.02 + 0.07 * float(i)) * ext; occ += max(h - map(g + vec3(0.0, h, 0.0)), 0.0) * sca; sca *= 0.75; }
    return clamp(1.0 - 1.6 * occ / ext * smoothstep(uBR + 0.2, uBR - 0.5, length(g.xz - uBC.xz)), 0.0, 1.0);
}

float groundLight(vec3 g) {
    if (length(g.xz - uBC.xz) > uBR + 2.0) return 1.0;
    float s = softShadow(g, uL, uMode == 2 ? 9.0 : 8.0, 6.0);
    float ao = length(g.xz - uBC.xz) < uBR + 0.2 ? groundAO(g) : 1.0;
    float kw = 0.6;
    float f = (kw * s + (1.0 - kw) * mix(1.0, ao, 0.6)) * mix(1.0, ao, 0.75);
    return mix(1.0, f, uShadow) * mix(1.0, pinShadow(g), 0.4 + 0.5 * uShadow);
}

vec3 paper(vec3 g) {
    float n = noise3(vec3(g.x * 18.0, 0.0, g.z * 140.0)) * 0.5 + noise3(vec3(g.x * 150.0, 1.0, g.z * 25.0)) * 0.5;
    float f = noise3(vec3(g.xz * 300.0, 2.0));
    return uPaperL * (0.975 + 0.025 * n + 0.012 * f);
}

vec4 groundOut(vec3 g, vec3 m, vec3 baseCol) {
    if (uTransparent) return vec4(0.0, 0.0, 0.0, clamp(1.0 - dot(min(m, vec3(1.0)), vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0));
    return vec4(toSRGB(baseCol * m), 1.0);
}

vec3 sigmaA() { return -log(clamp(uAmberL, 0.03, 0.97)) * uAmberDensity; }

vec3 amberGroundMul(vec3 g) {
    vec3 m = vec3(1.0);
    vec3 o = g / uDrop, d = uL / uDrop;
    float a = dot(d, d), b = dot(o, d), c = dot(o, o) - 1.0;
    float h = b * b - a * c;
    if (h > 0.0 && b < 0.0) {
        float rr = sqrt(clamp(1.0 - h / a, 0.0, 1.0));
        float len = 2.0 * sqrt(h) / a;
        vec3 T = exp(-sigmaA() * len * 0.6);
        vec3 caustic = uAmberL * 2.4 * (1.0 - smoothstep(0.0, 0.55, rr));
        vec3 inner = T * mix(0.75, 0.25, smoothstep(0.4, 0.95, rr)) + caustic;
        m = mix(vec3(1.0), inner, smoothstep(1.0, 0.9, rr) * uShadow);
    }
    float e = length(g.xz / uDrop.xz) - 1.0;
    if (e > 0.0) m *= mix(1.0, 1.0 - 0.55 * exp(-e * 22.0), uShadow);
    if (length(g.xz - uBC.xz) < uBR + 2.0) m *= mix(1.0, softShadow(g, uL, 6.0, 6.0), uShadow * 0.6);
    return m;
}

vec4 renderAmber(vec3 ro, vec3 rd) {
    vec2 hit = iEll(ro, rd, uDrop);
    vec3 hp = ro + rd * hit.x;
    float tg = rd.y < 0.0 ? -ro.y / rd.y : -1.0;
    if (hit.x < 0.0 || hp.y < 0.0) {
        if (tg < 0.0) return uTransparent ? vec4(0.0) : vec4(toSRGB(uGroundL), 1.0);
        vec3 g = ro + rd * tg;
        return groundOut(g, amberGroundMul(g), uGroundL);
    }
    vec3 n = normalize(hp / (uDrop * uDrop));
    n = normalize(n + 0.004 * (vec3(noise3(hp * 3.0), noise3(hp * 3.0 + 7.0), noise3(hp * 3.0 + 13.0)) - 0.5));
    float NoV = max(dot(n, -rd), 0.0);
    float F = 0.045 + 0.955 * pow(1.0 - NoV, 5.0);
    gBox = 0.7;
    vec3 refl = envFull(reflect(rd, n), 0.0);
    gBox = 1.0;
    vec3 rd2 = refract(rd, n, 1.0 / 1.54);
    vec2 ex = iEll(hp, rd2, uDrop);
    float tEnd = ex.y;
    bool floorHit = false;
    if (rd2.y < 0.0) { float tf = -hp.y / rd2.y; if (tf < tEnd) { tEnd = tf; floorHit = true; } }
    vec3 sig = sigmaA();
    float tb = -1.0;
    vec2 bs = iSph(hp - uBC, rd2, uBR);
    if (bs.y > 0.0) tb = march(hp, rd2, max(bs.x, 0.0), min(bs.y, tEnd));
    vec3 inner; float len;
    vec3 warm = mix(vec3(1.0), uAmberL, 0.5);
    if (tb > 0.0) {
        len = tb;
        inner = shadeBeetle(hp + rd2 * tb, rd2, hit.x + tb, warm);
    } else if (floorHit) {
        len = tEnd;
        vec3 g = hp + rd2 * tEnd;
        float s = softShadow(g, uL, 6.0, 6.0);
        float ao = groundAO(g);
        float f = mix(1.0, (0.6 * s + 0.4) * ao, uShadow);
        inner = uTransparent ? uAmberL * 0.7 : mix(uGroundL * f, uAmberL * 0.7 * f, 0.45);
        vec2 cc = (g.xz + normalize(uL.xz) * 0.45 * uDrop.xz) / uDrop.xz;
        inner *= 0.45 + 0.5 * smoothstep(1.0, 0.2, length(g.xz / uDrop.xz)) + 0.9 * exp(-dot(cc, cc) * 4.0);
    } else {
        len = tEnd;
        inner = envFull(rd2, 0.1);
    }
    for (int i = 0; i < 7; i++) {
        float fi = float(i);
        vec3 bc = vec3(hash12(vec2(fi, 1.0)) - 0.5, 0.0, hash12(vec2(fi, 2.0)) - 0.5) * uDrop * vec3(1.3, 0.0, 1.3);
        bc.y = 0.12 + hash12(vec2(fi, 3.0)) * 0.6 * uDrop.y * (1.0 - length(bc.xz / uDrop.xz));
        float br = 0.012 + 0.022 * hash12(vec2(fi, 4.0));
        vec2 bh = iSph(hp - bc, rd2, br);
        if (bh.x > 0.0 && bh.x < len) {
            vec3 bn = normalize(hp + rd2 * bh.x - bc);
            float rim = pow(1.0 - abs(dot(bn, rd2)), 2.0);
            inner = mix(inner * 0.8, envFull(reflect(rd2, bn), 0.05) * 0.8 + uAmberL * 0.3, rim);
            inner += KEY * 2.0 * pow(max(dot(reflect(rd2, bn), uL), 0.0), 60.0);
        }
    }
    float cloud = 0.75 + 0.5 * noise3(hp * 2.5 + rd2 * len * 1.5);
    vec3 T = exp(-sig * len * cloud);
    float depth = 1.0 - exp(-len * 1.5);
    vec3 deep = uAmberL * uAmberL * uAmberL;
    vec3 glow = uAmberL * uAmberL * 0.16 * depth * (0.4 + 0.6 * max(dot(n, uL), 0.0));
    float rim = pow(1.0 - NoV, 1.1);
    vec3 body = (inner * T + glow) * mix(1.0, 0.2, rim) + deep * 0.35 * rim;
    body += uAmberL * 0.6 * pow(max(dot(refract(-uL, n, 1.0 / 1.54), rd2), 0.0), 6.0) * (1.0 - rim);
    vec3 col = refl * F + (1.0 - F) * body;
    vec3 rr = reflect(rd, n);
    col += KEY * (40.0 * pow(max(dot(rr, uL), 0.0), 3000.0) + 1.2 * pow(max(dot(rr, uR2), 0.0), 400.0));
    return vec4(toSRGB(tonemap(col)), 1.0);
}

vec4 renderScene(vec3 ro, vec3 rd) {
    float tg = rd.y < 0.0 ? -ro.y / rd.y : 1e4;
    float tb = -1.0;
    vec2 bs = iSph(ro - uBC, rd, uBR);
    if (bs.y > 0.0) tb = march(ro, rd, max(bs.x, 0.0), min(bs.y, tg));
    float tp = 1e9; vec3 pn = vec3(0.0); float pid = 0.0;
    if (uMode == 2) {
        vec3 hc = vec3(uPin.x, uPin.z, uPin.y);
        vec2 sh = iSph(ro - hc, rd, 0.07);
        if (sh.x > 0.0) { tp = sh.x; pn = normalize(ro + rd * sh.x - hc); pid = 1.0; }
        vec2 oc = ro.xz - uPin.xy; vec2 d = rd.xz; float a = dot(d, d), b = dot(oc, d), c = dot(oc, oc) - 0.011 * 0.011;
        float h = b * b - a * c;
        if (a > 1e-7 && h > 0.0) {
            float t = (-b - sqrt(h)) / a; float y = ro.y + rd.y * t;
            if (t > 0.0 && t < tp && y > 0.0 && y < uPin.z) { tp = t; vec2 hp = oc + d * t; pn = normalize(vec3(hp.x, 0.0, hp.y)); pid = 2.0; }
        }
    }
    if (tb > 0.0 && tb < tp) return vec4(toSRGB(tonemap(shadeBeetle(ro + rd * tb, rd, tb, vec3(1.0)))), 1.0);
    if (tp < tg) {
        vec3 p = ro + rd * tp;
        vec3 r = reflect(rd, pn);
        float NoV = max(dot(pn, -rd), 0.0);
        vec3 col;
        if (pid > 1.5) {
            float s = softShadow(p + pn * 0.003, uL, 10.0, 4.0);
            vec3 ek, er; envSplit(r, 0.08, ek, er);
            col = (ek * s + er) * vec3(0.78, 0.79, 0.81);
        } else {
            vec3 ek, er; envSplit(r, 0.05, ek, er);
            float Fc = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);
            col = vec3(0.012) * (irr(pn) + KEY * 2.0 * max(dot(pn, uL), 0.0)) + Fc * (ek + er) * 1.3;
        }
        return vec4(toSRGB(tonemap(col)), 1.0);
    }
    if (tg > 9e3) return uTransparent ? vec4(0.0) : vec4(toSRGB(uMode == 2 ? uPaperL : uGroundL), 1.0);
    vec3 g = ro + rd * tg;
    float f = groundLight(g);
    return groundOut(g, vec3(f), uMode == 2 ? paper(g) : uGroundL);
}

void main() {
    vec4 acc = vec4(0.0);
    float n = float(uAA);
    for (int j = 0; j < 8; j++) {
        if (j >= uAA) break;
        for (int i = 0; i < 8; i++) {
            if (i >= uAA) break;
            vec2 o = (vec2(float(i), float(j)) + 0.5) / n - 0.5;
            vec2 uv = ((gl_FragCoord.xy + o) / uRes) * 2.0 - 1.0;
            vec3 rd = normalize(uCamFwd + uCamRight * (uShiftUV.x + uv.x * uTan) + uCamUp * (uShiftUV.y + uv.y * uTan));
            acc += uMode == 1 ? renderAmber(uCamPos, rd) : renderScene(uCamPos, rd);
        }
    }
    acc /= n * n;
    acc.rgb += (hash12(gl_FragCoord.xy) - 0.5) / 255.0 * acc.a;
    outColor = vec4(clamp(acc.rgb, 0.0, acc.a), acc.a);
}`

function hexToLin(hex) {
    const h = hex.replace('#', '')
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
    return [0, 2, 4].map((i) => {
        const c = parseInt(full.slice(i, i + 2), 16) / 255
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
}

function hueRot(c, deg) {
    const a = (deg * Math.PI) / 180
    const k = 0.57735
    const ca = Math.cos(a)
    const s = Math.sin(a)
    const kd = k * (c[0] + c[1] + c[2]) * k * (1 - ca)
    const cr = [k * (c[2] - c[1]), k * (c[0] - c[2]), k * (c[1] - c[0])]
    return c.map((x, i) => Math.max(0, x * ca + cr[i] * s + kd))
}

function geometry(sp, mode) {
    const r = sp.round
    const m = sp.mand
    const L = (a, b) => a + (b - a) * r
    const V = (a, b) => a.map((x, i) => L(x, b[i]))
    const g = {}
    g.elyC = V([0, 0.2, -0.36], [0, 0.14, -0.22])
    g.elyR = V([0.52, 0.37, 0.84], [0.62, 0.55, 0.66])
    g.elyTaper = L(0.45, 0.05)
    g.prC = V([0, 0.23, 0.34], [0, 0.2, 0.4])
    g.prR = V([0.47, 0.28, 0.3], [0.44, 0.31, 0.22])
    g.prTaper = L(0.4, 0.3)
    g.hdC = add(V([0, 0.25, 0.7], [0, 0.2, 0.6]), [0, 0.02 * m, 0.06 * m])
    g.hdR = V([0.25, 0.14, 0.2], [0.22, 0.13, 0.13]).map((x, i) => x * (i === 1 ? 1 + 0.15 * m : 1 + 0.3 * m))
    g.eyeC = add(g.hdC, [g.hdR[0] * 0.86, 0.03, 0.01])
    g.eyeR = 0.072 + 0.012 * m
    const dh = sub(g.hdC, [0, 0.25, 0.7])
    g.m1 = add(g.hdC, [0.08, -0.04, g.hdR[2] * 0.8])
    g.m2 = add(g.m1, [0.05 + 0.09 * m, 0.03 * m, 0.1 + 0.24 * m])
    g.m3 = add(g.m2, [-0.07 - 0.05 * m, 0.03 * m, 0.06 + 0.17 * m])
    g.mt = m > 0 ? add(g.m2, [-0.07, 0.02, 0.02]) : g.m3
    g.mr = [0.034 + 0.04 * m, 0.024 + 0.034 * m, 0.008 + 0.01 * m]
    g.a0 = add([0.11, 0.3, 0.84], dh)
    g.a1 = add(g.a0, [0.1, 0.06, 0.12])
    g.a2 = add(g.a1, [0.12, 0.01, 0.13])
    g.ac = add(g.a2, [0.03, 0, 0.04])
    const scz = g.prC[2] - g.prR[2] - 0.03
    const ez = scz - g.elyC[2]
    const ey = Math.sqrt(Math.max(0, 1 - (ez / g.elyR[2]) ** 2))
    g.scC = [0, g.elyC[1] + g.elyR[1] * ey - 0.008, scz]
    g.lift = mode === 'pinned' ? 0.5 : mode === 'amber' ? 0.08 : 0
    g.drop = [1.48, 0.98, 1.72 + 0.12 * m]
    g.pin = [-0.22, -0.16, g.lift + 1.6]
    return g
}

function outlinePoints(g, mode) {
    const pts = []
    const push = (p, mirror = true) => {
        pts.push([p[0], p[1] + g.lift, p[2]])
        if (mirror) pts.push([-p[0], p[1] + g.lift, p[2]])
    }
    if (mode === 'amber') {
        for (let i = 0; i < 48; i++) {
            const a = (i / 48) * Math.PI * 2
            for (const e of [0, 0.35, 0.7, 1]) {
                const c = Math.cos(e * 1.45)
                pts.push([Math.cos(a) * g.drop[0] * c, Math.sin(e * 1.45) * g.drop[1], Math.sin(a) * g.drop[2] * c])
            }
        }
        return pts
    }
    for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2
        for (const e of [0, 0.4, 0.8, 1.2]) {
            const ezn = Math.sin(a) * Math.cos(e)
            const t = Math.min(1.2, Math.max(0, -ezn))
            const x = (Math.cos(a) * Math.cos(e) * g.elyR[0]) / (1 + g.elyTaper * t * t)
            const z = ezn * g.elyR[2] + g.elyC[2]
            const y = Math.max(0.2, Math.sin(e) * g.elyR[1] + g.elyC[1])
            if (x > -0.05) push([x, y, z])
        }
    }
    for (const l of LEGS) for (const p of l) push([p[0] + 0.03, p[1] + 0.03, p[2]])
    for (const p of legClaw) push(p)
    for (const p of [g.m2, g.m3, g.a1, g.a2, g.ac, g.eyeC]) push(add(p, [0.03, 0.03, 0.03]))
    push(add(g.hdC, [g.hdR[0], g.hdR[1], g.hdR[2]]))
    push(add(g.prC, [g.prR[0], g.prR[1], 0]))
    if (mode === 'pinned') {
        pts.push([g.pin[0] - 0.06, g.pin[2], g.pin[1]])
        pts.push([g.pin[0] + 0.06, g.pin[2], g.pin[1] + 0.06])
    }
    return pts
}

function camera(values, g, size) {
    const mode = values.mode
    const rad = Math.PI / 180
    const yaw = values.yaw * rad
    const pitch = (mode === 'pinned' ? 90 : values.pitch) * rad
    const up = [0, 1, 0]
    const fwdH = [Math.sin(yaw), 0, Math.cos(yaw)]
    const right = [-Math.cos(yaw), 0, Math.sin(yaw)]
    const fwd = add(mul(fwdH, Math.cos(pitch)), mul(up, -Math.sin(pitch)))
    const camUp = cross(right, fwd)
    const D = 16
    const target = [0, 0.28 + g.lift * 0.5, 0]
    const pos = sub(target, mul(fwd, D))
    const proj = outlinePoints(g, mode).map((p) => {
        const rel = sub(p, pos)
        const z = dot(rel, fwd)
        return [dot(rel, right) / z, dot(rel, camUp) / z]
    })
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (const [x, y] of proj) {
        x0 = Math.min(x0, x)
        x1 = Math.max(x1, x)
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y)
    }
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    let rmax = 0
    for (const [x, y] of proj) rmax = Math.max(rmax, Math.hypot(x - cx, y - cy))
    const tan = rmax / 0.59 / values.zoom
    const la = values.lightAngle * rad
    const le = values.lightHeight * rad
    const L = norm(add(mul(add(mul(right, Math.cos(la)), mul(fwdH, Math.sin(la))), Math.cos(le)), mul(up, Math.sin(le))))
    const LT = norm(cross(up, L))
    const LB = cross(L, LT)
    const R2 = norm(add(add(mul(fwdH, 0.75), mul(right, -0.65 * Math.sign(Math.cos(la) || 1))), [0, 0.45, 0]))
    const R2T = norm(cross(up, R2))
    const R2B = cross(R2, R2T)
    const fill = norm(add(add(mul(fwdH, -0.8), mul(right, -0.5 * Math.sign(Math.cos(la) || 1))), [0, 0.55, 0]))
    return { pos, fwd, right, camUp, shift: [cx, cy], tan, pix: (2 * tan) / size, L, LT, LB, R2, R2T, R2B, fill }
}

export function createBeetle() {
    let canvas = null
    let gl = null
    let program = null
    const locs = new Map()

    function init() {
        canvas = document.createElement('canvas')
        gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, depth: false, stencil: false })
        if (!gl) throw new Error('beetle: WebGL2 is not available')
        const compile = (type, src) => {
            const s = gl.createShader(type)
            gl.shaderSource(s, src)
            gl.compileShader(s)
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                const log = gl.getShaderInfoLog(s)
                gl.deleteShader(s)
                throw new Error('beetle: shader compile failed\n' + log)
            }
            return s
        }
        program = gl.createProgram()
        gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT))
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG))
        gl.bindAttribLocation(program, 0, 'aPos')
        gl.linkProgram(program)
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('beetle: program link failed\n' + gl.getProgramInfoLog(program))
        const buf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    }

    const loc = (name) => {
        if (!locs.has(name)) locs.set(name, gl.getUniformLocation(program, name))
        return locs.get(name)
    }
    const u1f = (n, v) => gl.uniform1f(loc(n), v)
    const u1i = (n, v) => gl.uniform1i(loc(n), v)
    const u2f = (n, v) => gl.uniform2f(loc(n), v[0], v[1])
    const u3f = (n, v) => gl.uniform3f(loc(n), v[0], v[1], v[2])

    function render(size, values = {}, { transparent = false } = {}) {
        if (!gl) init()
        const vals = { ...BEETLE_DEFAULTS, ...values }
        const mode = ['plain', 'amber', 'pinned'].includes(vals.mode) ? vals.mode : 'plain'
        vals.mode = mode
        const sp = SPECIES[vals.species] ?? SPECIES.emerald
        const g = geometry(sp, mode)
        const cam = camera(vals, g, size)
        size = Math.max(1, Math.round(size))
        if (canvas.width !== size || canvas.height !== size) {
            canvas.width = size
            canvas.height = size
        }
        gl.viewport(0, 0, size, size)
        gl.useProgram(program)
        gl.clearColor(0, 0, 0, 0)
        gl.disable(gl.SCISSOR_TEST)
        gl.clear(gl.COLOR_BUFFER_BIT)
        const tint = (hex) => hueRot(hexToLin(hex), vals.hue)
        const gloss = vals.gloss
        u2f('uRes', [size, size])
        u1i('uAA', size <= 128 ? 5 : 3)
        u1i('uMode', { plain: 0, amber: 1, pinned: 2 }[mode])
        u1i('uTransparent', transparent ? 1 : 0)
        u3f('uCamPos', cam.pos)
        u3f('uCamFwd', cam.fwd)
        u3f('uCamRight', cam.right)
        u3f('uCamUp', cam.camUp)
        u2f('uShiftUV', cam.shift)
        u1f('uTan', cam.tan)
        u1f('uPix', cam.pix)
        u3f('uL', cam.L)
        u3f('uLT', cam.LT)
        u3f('uLB', cam.LB)
        u3f('uR2', cam.R2)
        u3f('uR2T', cam.R2T)
        u3f('uR2B', cam.R2B)
        u3f('uFill', cam.fill)
        u3f('uBase', tint(sp.base))
        u3f('uAlt', tint(sp.alt))
        u3f('uFront', tint(sp.front))
        u3f('uLeg', tint(sp.leg))
        u3f('uJaw', tint(sp.jaw))
        u1f('uMetal', sp.metal)
        u1f('uIrid', vals.iridescence)
        u1f('uShift', sp.shift)
        u1f('uRough', Math.min(1, sp.rough * (1.8 - 1.3 * gloss) + 0.02))
        u1f('uCoatRough', 0.02 + (1 - gloss) * 0.4)
        u1f('uPunct', vals.punctures)
        u1f('uPattern', sp.pattern)
        u1f('uShadow', vals.shadow)
        u1f('uLift', g.lift)
        u3f('uGroundL', hexToLin(vals.ground))
        u3f('uPaperL', hexToLin(vals.paper))
        u3f('uAmberL', hexToLin(vals.amber))
        u1f('uAmberDensity', 0.35 + vals.amberThickness * 2.6)
        u3f('uDrop', g.drop)
        u3f('uBC', [0, 0.3 + g.lift, 0.05])
        u1f('uBR', 1.62)
        u3f('uElyC', g.elyC)
        u3f('uElyR', g.elyR)
        u1f('uElyTaper', g.elyTaper)
        u3f('uPrC', g.prC)
        u3f('uPrR', g.prR)
        u1f('uPrTaper', g.prTaper)
        u3f('uHdC', g.hdC)
        u3f('uHdR', g.hdR)
        u3f('uEyeC', g.eyeC)
        u1f('uEyeR', g.eyeR)
        u3f('uM1', g.m1)
        u3f('uM2', g.m2)
        u3f('uM3', g.m3)
        u3f('uMT', g.mt)
        u3f('uMr', g.mr)
        u3f('uA0', g.a0)
        u3f('uA1', g.a1)
        u3f('uA2', g.a2)
        u3f('uAc', g.ac)
        u3f('uScC', g.scC)
        u3f('uPin', g.pin)
        const strip = size > 600 ? 128 : size
        gl.enable(gl.SCISSOR_TEST)
        for (let y = 0; y < size; y += strip) {
            gl.scissor(0, y, size, Math.min(strip, size - y))
            gl.drawArrays(gl.TRIANGLES, 0, 3)
            if (strip < size) gl.flush()
        }
        gl.disable(gl.SCISSOR_TEST)
        return canvas
    }

    return { render }
}
