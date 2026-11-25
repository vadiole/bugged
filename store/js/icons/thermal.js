const SHARED = '__buggedPhotorealGL'

function context() {
    let s = globalThis[SHARED]
    if (s && !s.gl.isContextLost()) return s
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false, depth: false, premultipliedAlpha: false })
    if (!gl) throw new Error('WebGL unavailable')
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    s = globalThis[SHARED] = { canvas, gl, buffer, programs: new Map() }
    return s
}

function shader(gl, type, source) {
    const sh = gl.createShader(type)
    gl.shaderSource(sh, source)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh)
        const listing = source.split('\n').map((l, i) => String(i + 1).padStart(4) + ' ' + l).join('\n')
        throw new Error('GLSL compile failed:\n' + log + '\n' + listing)
    }
    return sh
}

function program(gl, id, frag) {
    const p = gl.createProgram()
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'))
    gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, frag))
    gl.bindAttribLocation(p, 0, 'p')
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('GLSL link failed (' + id + '):\n' + gl.getProgramInfoLog(p))
    return { p, locs: new Map() }
}

function paint(id, frag, S, uniforms) {
    const { canvas, gl, buffer, programs } = context()
    let entry = programs.get(id)
    if (!entry || entry.frag !== frag) {
        entry = { ...program(gl, id, frag), frag }
        programs.set(id, entry)
    }
    const size = Math.max(1, Math.round(S))
    if (canvas.width !== size || canvas.height !== size) canvas.width = canvas.height = size
    gl.viewport(0, 0, size, size)
    gl.useProgram(entry.p)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    for (const [name, v] of Object.entries({ ...uniforms, uS: size })) {
        if (!entry.locs.has(name)) entry.locs.set(name, gl.getUniformLocation(entry.p, name))
        const loc = entry.locs.get(name)
        if (loc == null) continue
        if (typeof v === 'number') gl.uniform1f(loc, v)
        else if (v.length === 2) gl.uniform2fv(loc, v)
        else if (v.length === 3) gl.uniform3fv(loc, v)
        else gl.uniform4fv(loc, v)
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    return canvas
}

const rgb = (hex) => {
    const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const fragment = (body, aa) => `precision highp float;
uniform float uS;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vnoise(p);p=p*2.03+17.1;a*=.5;}return s;}
vec3 lin(vec3 c){return pow(c,vec3(2.2));}
${body}
void main(){
    vec3 acc=vec3(0.);
    for(int j=0;j<${aa};j++)for(int i=0;i<${aa};i++){
        vec2 o=(vec2(float(i),float(j))+.5)/${aa}.;
        acc+=shade((gl_FragCoord.xy-.5+o)/uS*2.-1.);
    }
    vec2 uv=gl_FragCoord.xy/uS*2.-1.;
    gl_FragColor=vec4(clamp(finish(acc/${aa * aa}.,uv,gl_FragCoord.xy),0.,1.),1.);
}`

const GLSL = `
uniform float uPal,uTrail,uGain,uNoise,uSize,uRot,uSep,uSoft,uLeg,uLegLen,uLegHeat,uAnt;
uniform float uBody,uCore,uSeam,uGlow,uGlowR,uContrast,uBg,uGrid,uVig,uPrint,uPrintHeat,uStride,uCurve;
uniform vec2 uPos;
uniform float uBleed;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float sdE(vec2 p,vec2 r){float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.)/k1;}
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
vec2 hip(float t){return vec2(.08,.08-.11*t);}
vec2 knee(float t){return hip(t)+vec2(.1,.04-.05*t)*uLegLen;}
vec2 foot(float t){return knee(t)+vec2(.03+.02*t,.08-.1*t-.03*t*t)*uLegLen;}
float legs(vec2 p){
    vec2 q=vec2(abs(p.x),p.y);
    float d=1e5;
    for(int i=0;i<3;i++){
        float t=float(i);
        d=min(d,min(seg(q,hip(t),knee(t)),seg(q,knee(t),foot(t))));
    }
    vec2 a0=vec2(.03,.27+.07*uSep),a1=a0+vec2(.05,.09)*uAnt,a2=a1+vec2(.04,.07)*uAnt;
    return min(d,min(seg(q,a0,a1),seg(q,a1,a2)));
}
float temp(vec2 uv){
    vec2 w=uv;
    float T=uBg+.06*(fbm(w*2.2+3.)-.5)+.025*(fbm(w*9.)-.5);
    vec2 g=abs(fract((rot(.12)*w)*2.2+.5)-.5);
    T+=.045*uGrid*exp(-min(g.x,g.y)*min(g.x,g.y)*1400.);
    T+=.05*(uv.y+uv.x)*.3;
    vec2 p=rot(uRot)*(uv-uPos)/(1.22*uSize);
    p.y+=.035*uSep;
    float body=min(sdE(p-vec2(0.,-.1),vec2(.13,.2)),sdE(p-vec2(0.,.12+.04*uSep),vec2(.11,.08)));
    body=min(body,sdE(p-vec2(0.,.22+.07*uSep),vec2(.07,.06)));
    vec2 tc=p-vec2(0.,.1+.04*uSep);
    float thor=exp(-dot(tc,tc)*60.);
    float hb=1.-smoothstep(-.02*uSoft,.035*uSoft,body);
    float Tb=uBody+uCore*thor+.08*smoothstep(.0,-.1,body)+.04*(fbm(p*14.)-.5);
    Tb-=uSeam*.25*exp(-p.x*p.x*5000.)*smoothstep(.05,-.02,p.y)*smoothstep(-.32,-.2,p.y);
    float lg=(1.-smoothstep(.005*uLeg,.024*uLeg,legs(p)))*smoothstep(.95,.3,length(p));
    T=max(T,mix(T,uLegHeat,lg*.9));
    T+=uGlow*exp(-max(body,0.)*8./uGlowR);
    T=mix(T,Tb,hb);
    float trail=0.;
    for(int n=1;n<=12;n++){
        float f=float(n);
        if(f/12.>uTrail)break;
        float a=f/(12.*uTrail+.001);
        float s=f*uStride;
        vec2 q=vec2(uCurve*s*s+.02*sin(s*9.),-s);
        float r=(.016+.012*a)*uPrint;
        for(int j=0;j<3;j++){
            float t=float(j);
            float sg=mod(f+t,2.)*2.-1.;
            vec2 ft=foot(t);
            vec2 fp=vec2(sg*ft.x,ft.y)+q+(vec2(hash(vec2(f,t)),hash(vec2(t,f+3.)))-.5)*.015;
            vec2 dv=p-fp;
            trail=max(trail,exp(-dot(dv,dv)/(r*r))*(.36*(1.-a)+.08)*uPrintHeat);
        }
    }
    T+=trail*smoothstep(-.01,.06,body)*(1.-lg);
    return T*uGain+(1.-uGain)*.3;
}
vec3 ramp(float t){
    t=clamp(t,0.,1.);
    if(uPal<.5){
        vec3 c=mix(vec3(.0,.0,.04),vec3(.22,.0,.42),smoothstep(.0,.25,t));
        c=mix(c,vec3(.75,.05,.42),smoothstep(.2,.45,t));
        c=mix(c,vec3(.98,.38,.02),smoothstep(.42,.65,t));
        c=mix(c,vec3(1.,.82,.12),smoothstep(.62,.82,t));
        return mix(c,vec3(1.,1.,.92),smoothstep(.8,1.,t));
    }
    if(uPal<1.5){
        vec3 c=mix(vec3(0.,0.,.06),vec3(.05,.1,.8),smoothstep(.0,.2,t));
        c=mix(c,vec3(0.,.8,.85),smoothstep(.2,.38,t));
        c=mix(c,vec3(.1,.85,.15),smoothstep(.36,.52,t));
        c=mix(c,vec3(1.,.95,0.),smoothstep(.5,.66,t));
        c=mix(c,vec3(1.,.15,0.),smoothstep(.64,.82,t));
        return mix(c,vec3(1.),smoothstep(.85,1.,t));
    }
    if(uPal<2.5)return vec3(pow(t,1.2));
    vec3 c=mix(vec3(.0,.02,.12),vec3(.1,.35,.85),smoothstep(.0,.35,t));
    c=mix(c,vec3(.8,.9,1.),smoothstep(.32,.55,t));
    c=mix(c,vec3(1.,.7,.15),smoothstep(.55,.8,t));
    return mix(c,vec3(1.,.95,.7),smoothstep(.85,1.,t));
}
vec3 shade(vec2 uv){
    uv*=uBleed;
    vec2 cell=floor((uv*.5+.5)*240.);
    float n=(vnoise((uv*.5+.5)*240.)-.5)*.05+(hash(cell)-.5)*.035;
    n+=(hash(vec2(cell.x,7.))-.5)*.02;
    float T=temp(uv)+n*uNoise;
    T+=.04*min(dot(uv,uv),2.4);
    return ramp(.3+(T-.3)*uContrast);
}
vec3 finish(vec3 c,vec2 uv,vec2 px){
    uv*=uBleed;
    return c*max(0.,1.-uVig*min(dot(uv,uv),2.4)*.5);
}
`

let frag = null

function hud(c, S, k) {
    c.save()
    const u = S / 100
    c.globalAlpha = k.hudOpacity
    c.strokeStyle = '#fff'
    c.fillStyle = '#fff'
    c.lineWidth = Math.max(1, k.hudStroke * u)
    c.lineCap = 'butt'
    const follow = k.hudCentre === 'bug'
    const text = S >= 160 && (k.hudLeft || k.hudRight)
    const lift = k.hudCentre === 'text' && text ? (2 + 0.72 * k.hudSize) * u * 0.5 : 0
    const cx = S * (0.5 + ((follow ? k.x : 0) + k.hudX) / 2), cy = S * (0.5 - ((follow ? k.y : 0) + k.hudY) / 2) + lift
    if (k.hudCross) {
        c.beginPath()
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            c.moveTo(cx + dx * 3.5 * u, cy + dy * 3.5 * u)
            c.lineTo(cx + dx * 8 * u, cy + dy * 8 * u)
        }
        c.stroke()
    }
    const b = k.hudFrame * u, l = k.hudCorner * u
    c.beginPath()
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        c.moveTo(cx + sx * b, cy + sy * (b - l))
        c.lineTo(cx + sx * b, cy + sy * b)
        c.lineTo(cx + sx * (b - l), cy + sy * b)
    }
    c.stroke()
    if (text) {
        c.font = `600 ${k.hudSize * u}px ui-monospace, Menlo, monospace`
        c.textBaseline = 'alphabetic'
        c.textAlign = 'right'
        c.fillText(k.hudRight, cx + b, cy - b - 2 * u)
        c.textAlign = 'left'
        c.fillText(k.hudLeft, cx - b, cy - b - 2 * u)
    }
    c.restore()
}

const num = (v) => String(Math.round(v * 100) / 100)

function themed(k) {
    const K = 36 * 1.22 * k.size * k.monoScale
    const ox = 54 + 36 * k.x, oy = 54 - 36 * k.y
    const lift = 0.035 * k.sep
    const P = (x, y) => `${num(ox + K * x)},${num(oy - K * (y - lift))}`
    const oval = (cy, rx, ry) => `M${P(-rx, cy)}a${num(K * rx)},${num(K * ry)} 0,1 0,${num(2 * K * rx)} 0a${num(K * rx)},${num(K * ry)} 0,1 0,${num(-2 * K * rx)} 0z`
    const body = oval(-0.1, 0.13, 0.2) + oval(0.12 + 0.04 * k.sep, 0.11, 0.08) + oval(0.22 + 0.07 * k.sep, 0.07, 0.06)
    let limbs = ''
    for (const sg of [1, -1]) {
        for (let t = 0; t < 3; t++) {
            const hip = [0.08, 0.08 - 0.11 * t]
            const knee = [hip[0] + 0.1 * k.legLen, hip[1] + (0.04 - 0.05 * t) * k.legLen]
            const foot = [knee[0] + (0.03 + 0.02 * t) * k.legLen, knee[1] + (0.08 - 0.1 * t - 0.03 * t * t) * k.legLen]
            limbs += `M${P(sg * hip[0], hip[1])}L${P(sg * knee[0], knee[1])}L${P(sg * foot[0], foot[1])}`
        }
        if (k.ant > 0) {
            const a0 = [0.03, 0.27 + 0.07 * k.sep]
            const a1 = [a0[0] + 0.05 * k.ant, a0[1] + 0.09 * k.ant]
            const a2 = [a1[0] + 0.04 * k.ant, a1[1] + 0.07 * k.ant]
            limbs += `M${P(sg * a0[0], a0[1])}L${P(sg * a1[0], a1[1])}L${P(sg * a2[0], a2[1])}`
        }
    }
    const follow = k.hudCentre === 'bug'
    const fx = (follow ? ox : 54) + 36 * k.hudX, fy = (follow ? oy : 54) - 36 * k.hudY
    const u = 0.72
    let frame = ''
    if (k.monoFrame) {
        const b = k.hudFrame * u, l = k.hudCorner * u
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            frame += `M${num(fx + sx * b)},${num(fy + sy * (b - l))}L${num(fx + sx * b)},${num(fy + sy * b)}L${num(fx + sx * (b - l))},${num(fy + sy * b)}`
        }
    }
    const rotation = -k.rot
    const path = (data, attrs) => (data ? `        <path\n            android:pathData="${data}"\n${attrs.map((a) => `            android:${a}`).join('\n')} />\n` : '')
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <group
        android:pivotX="${num(ox)}"
        android:pivotY="${num(oy)}"
        android:rotation="${num(rotation)}">
${path(body, ['fillColor="#FFFFFFFF"'])}${path(limbs, ['strokeColor="#FFFFFFFF"', 'strokeLineCap="round"', 'strokeLineJoin="round"', `strokeWidth="${num(k.monoLimb)}"`])}    </group>
${path(frame, ['strokeColor="#FFFFFFFF"', `strokeWidth="${num(k.monoStroke)}"`]).replace(/^ {4}/gm, '')}</vector>
`
    return { ox, oy, rotation, body, limbs, frame, limbWidth: k.monoLimb, frameWidth: k.monoStroke, xml }
}

const range = (key, label, min, max, step = 0.01) => ({ key, label, type: 'range', min, max, step })

export default {
    id: 'thermal',
    name: 'Thermal',
    note: 'Infrared frame: a warm bug on cold tile, its footprints still glowing.',
    defaults: {
        size: 1.36, x: 0, y: 0, rot: -24, sep: 0, soft: 1,
        leg: 0.97, legLen: 0.82, legHeat: 0.29, ant: 1.54,
        body: 0.66, core: 0.14, seam: 0, glow: 0.25, glowR: 1.17,
        palette: 'iron', gain: 1, contrast: 1.02, noise: 0.5,
        bg: 0.11, grid: 0.87, vig: 0.32,
        hud: true, hudCentre: 'frame', hudFrame: 33, hudCorner: 12.5, hudStroke: 1.85, hudOpacity: 0.95, hudCross: true, hudLeft: 'UTM', hudRight: '42', hudSize: 6.6, hudX: 0, hudY: 0,
        trail: 0.6, stride: 0.2, curve: -0.2, print: 0.79, printHeat: 0.67,
        monoScale: 1, monoLimb: 2.05, monoFrame: true, monoStroke: 2.05,
    },
    schema: [
        { group: 'Bug' },
        range('size', 'Size', 0.5, 2),
        range('x', 'Position X', -0.6, 0.6),
        range('y', 'Position Y', -0.6, 0.6),
        range('rot', 'Rotation', -180, 180, 1),
        range('sep', 'Segment separation', 0, 1.5),
        range('soft', 'Edge softness', 0.2, 3),
        { group: 'Limbs' },
        range('leg', 'Leg thickness', 0.4, 3),
        range('legLen', 'Leg length', 0.5, 1.8),
        range('legHeat', 'Leg heat', 0.2, 0.9),
        range('ant', 'Antenna length', 0, 2),
        { group: 'Heat' },
        range('body', 'Body temperature', 0.3, 0.9),
        range('core', 'Hot core', 0, 0.5),
        range('seam', 'Wing-case seam', 0, 1),
        range('glow', 'Halo strength', 0, 0.5),
        range('glowR', 'Halo radius', 0.3, 3),
        { group: 'Camera' },
        { key: 'palette', label: 'Palette', type: 'select', options: [['iron', 'Iron'], ['rainbow', 'Rainbow'], ['white', 'White hot'], ['arctic', 'Arctic']] },
        range('gain', 'Gain', 0.6, 1.4),
        range('contrast', 'Contrast', 0.6, 1.8),
        range('noise', 'Sensor noise', 0, 3, 0.1),
        { group: 'Background' },
        range('bg', 'Floor temperature', 0, 0.4),
        range('grid', 'Tile grid', 0, 4),
        range('vig', 'Vignette', 0, 1),
        { group: 'Reticle' },
        { key: 'hud', label: 'Reticle', type: 'toggle' },
        { key: 'hudCentre', label: 'Centre on', type: 'select', options: [['bug', 'The bug'], ['frame', 'Icon, brackets only'], ['text', 'Icon, brackets with text']] },
        range('hudFrame', 'Frame size', 8, 45, 0.5),
        range('hudCorner', 'Corner length', 1, 20, 0.5),
        range('hudStroke', 'Stroke width', 0.2, 4, 0.05),
        range('hudOpacity', 'Opacity', 0.1, 1),
        { key: 'hudCross', label: 'Crosshair', type: 'toggle' },
        { key: 'hudLeft', label: 'Left text', type: 'text' },
        { key: 'hudRight', label: 'Right text', type: 'text' },
        range('hudSize', 'Text size', 2, 10, 0.1),
        range('hudX', 'Offset X', -0.6, 0.6),
        range('hudY', 'Offset Y', -0.6, 0.6),
        { group: 'Footprints' },
        range('trail', 'Amount', 0, 1),
        range('stride', 'Stride', 0.05, 0.3),
        range('curve', 'Path curve', -1, 1),
        range('print', 'Print size', 0.4, 3),
        range('printHeat', 'Print heat', 0, 3),
        { group: 'Themed icon' },
        range('monoScale', 'Bug scale', 0.5, 2),
        range('monoLimb', 'Limb width', 0.5, 5, 0.05),
        { key: 'monoFrame', label: 'Brackets', type: 'toggle' },
        range('monoStroke', 'Bracket width', 0.5, 5, 0.05),
    ],
    themed,
    draw(c, S, k) {
        frag ??= fragment(GLSL, 3)
        const out = paint('thermal', frag, S, {
            uPal: { iron: 0, rainbow: 1, white: 2, arctic: 3 }[k.palette] ?? 0,
            uTrail: k.trail, uGain: k.gain, uNoise: k.noise,
            uSize: k.size, uPos: [k.x, k.y], uRot: (k.rot * Math.PI) / 180,
            uSep: k.sep, uSoft: k.soft, uLeg: k.leg, uLegLen: k.legLen, uLegHeat: k.legHeat, uAnt: k.ant,
            uBody: k.body, uCore: k.core, uSeam: k.seam, uGlow: k.glow, uGlowR: k.glowR,
            uContrast: k.contrast, uBg: k.bg, uGrid: k.grid, uVig: k.vig,
            uBleed: k.bleed ?? 1,
            uPrint: k.print, uPrintHeat: k.printHeat, uStride: k.stride, uCurve: k.curve,
        })
        c.drawImage(out, 0, 0, S, S)
        if (!k.hud) return
        const inner = S / (k.bleed ?? 1)
        c.save()
        c.translate((S - inner) / 2, (S - inner) / 2)
        hud(c, inner, k)
        c.restore()
    },
}
