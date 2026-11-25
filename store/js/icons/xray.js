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
uniform float uPal, uPen, uAng, uArt, uDev;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
float rod(float d,float r){return 2.*sqrt(max(r*r-d*d,0.));}
float blob(vec2 p,vec2 r,float h){vec2 q=p/r;return 2.*h*sqrt(max(1.-dot(q,q),0.));}
const float LA=.24,RC=.26,RT=.085;
float faceLink(vec2 q){float dc=abs(length(q-vec2(clamp(q.x,-LA,LA),0.))-RC);return rod(dc,RT);}
float edgeLink(vec2 q){
    float rho=sqrt(max(RT*RT-q.y*q.y,0.));
    if(rho<=0.)return 0.;
    float h=max(abs(q.x)-LA,0.);
    return 2.*sqrt(max((RC+rho)*(RC+rho)-h*h,0.))-2.*sqrt(max((RC-rho)*(RC-rho)-h*h,0.));
}
vec2 bugFrame(vec2 q){return rot(.18)*(q-vec2(-.09,.01))/1.12;}
float organic(vec2 q){
    vec2 p=bugFrame(q);
    float d=0.;
    float ab=blob(p-vec2(.07,0.),vec2(.17,.105),.07);
    ab*=.75+.3*fbm(p*30.)+.12*smoothstep(.3,.9,sin(p.x*95.));
    ab+=.03*exp(-pow(p.y/.018,2.))*step(.001,ab);
    ab+=.012*smoothstep(.01,.0,abs(p.y))*step(0.,ab-.001);
    d+=ab;
    d+=blob(p-vec2(-.13,0.),vec2(.065,.08),.06);
    d+=blob(p-vec2(-.22,0.),vec2(.045,.05),.05)*1.1;
    vec2 m=vec2(p.x,abs(p.y));
    float l=0.;
    for(int i=0;i<3;i++){
        float t=float(i);
        vec2 b=vec2(-.15+.08*t,.04);
        vec2 kn=b+vec2(-.04+.06*t,.1);
        vec2 tip=kn+vec2(-.08+.12*t,.09-.02*t);
        l+=rod(seg(m,b,kn),.013)+rod(seg(m,kn,tip),.009);
    }
    l+=rod(seg(m,vec2(-.26,.02),vec2(-.33,.07)),.006)+rod(seg(m,vec2(-.33,.07),vec2(-.4,.06)),.005);
    d+=l*1.6;
    return d;
}
float device(vec2 q){
    if(uDev<.5)return 0.;
    vec2 p=bugFrame(q);
    vec2 b=abs(p-vec2(.08,.0))-vec2(.05,.025);
    float cell=(1.-smoothstep(-.004,.004,max(b.x,b.y)))*(.1+.04*step(abs(p.x-.08),.035));
    cell+=(1.-smoothstep(.009,.014,length(p-vec2(-.01,0.))))*.08;
    float w=0.;
    vec2 s=p-vec2(.13,.0);
    float coil=abs(length(s)-.03-.004*sin(atan(s.y,s.x)*12.));
    w+=rod(coil,.0025)*.6;
    float tail=seg(p,vec2(.16,.0),vec2(.3,.03));
    w+=rod(tail,.002);
    return cell+w;
}
float metal(vec2 q){
    float m=faceLink(q)*(.94+.12*fbm(q*18.));
    m+=edgeLink(q-vec2(2.*(LA+RC)-2.*RT,0.));
    m+=edgeLink(q+vec2(2.*(LA+RC)-2.*RT,0.));
    return m;
}
float tray(vec2 uv){
    float e=abs(dot(uv,normalize(vec2(1.,.7)))-1.08);
    return .015+.1*smoothstep(.015,.0,e)+.02*fbm(uv*3.);
}
vec4 absorb(vec2 uv){
    vec2 q=rot(uAng)*uv;
    float m=metal(q)+device(q);
    float o=organic(q)+tray(uv)*.25;
    float mu=uPen;
    float am=m*4.2*mu, ao=o*4.2*mu;
    float I=exp(-(am+ao));
    return vec4(I,am,ao,0.);
}
vec3 colorize(vec4 a){
    float I=a.x;
    float A=1.-I;
    float z=a.y/(a.y+a.z+1e-5);
    vec3 bg=vec3(.92,.95,.97);
    if(uPal<.5){
        vec3 hue=mix(vec3(1.,.55,.12),vec3(.38,.72,.22),smoothstep(.25,.55,z));
        hue=mix(hue,vec3(.12,.36,.9),smoothstep(.6,.85,z));
        vec3 c=mix(bg,hue,smoothstep(.0,.22,A));
        c*=mix(1.,.08,smoothstep(.2,.95,A));
        return c;
    }
    if(uPal<1.5){
        float org=a.z/(a.y+a.z+1e-5);
        vec3 hue=vec3(1.,.55,.12);
        vec3 g=mix(bg,vec3(.35),smoothstep(.0,.6,A));
        g=mix(g,mix(bg,hue,smoothstep(.0,.25,A)),smoothstep(.5,.8,org));
        return g*mix(1.,.1,smoothstep(.6,.98,A));
    }
    if(uPal<2.5)return bg*pow(I,.8);
    return vec3(.95,.97,1.)*pow(A,.7);
}
vec3 shade(vec2 uv){
    vec4 a=absorb(uv);
    float e=1.6/uS;
    float l=(absorb(uv+vec2(e,0.)).x+absorb(uv-vec2(e,0.)).x+absorb(uv+vec2(0.,e)).x+absorb(uv-vec2(0.,e)).x)*.25-a.x;
    a.x=clamp(a.x-l*1.*uArt,0.,1.);
    return colorize(a);
}
vec3 finish(vec3 c,vec2 uv,vec2 px){
    vec2 f=uv*.5+.5;
    float row=floor(f.y*320.);
    float lum=dot(c,vec3(.3,.5,.2));
    float n=(hash(vec2(row,3.))-.5)*.025+(hash(px)-.5)*.06*(1.3-lum);
    n+=(vnoise(vec2(f.x*40.,row))-.5)*.02;
    n*=uArt;
    c+=n;
    c*=1.-.12*smoothstep(.7,1.4,length(uv));
    return pow(clamp(c,0.,1.),vec3(1./1.15));
}
`

let frag = null

export default {
    id: 'xray',
    name: 'X-ray',
    note: 'Baggage scan of a chain. Something organic is caught in a link, and it’s wired.',
    defaults: { palette: 'airport', penetration: 1, angle: -0.6, artefacts: 1, device: true },
    schema: [
        { group: 'Scanner' },
        { key: 'palette', label: 'Mode', type: 'select', options: [['airport', 'Colour'], ['organic', 'Organic'], ['mono', 'Mono'], ['negative', 'Negative']] },
        { key: 'penetration', label: 'Density', type: 'range', min: 0.5, max: 2, step: 0.01 },
        { key: 'artefacts', label: 'Artefacts', type: 'range', min: 0, max: 2, step: 0.05 },
        { group: 'Bag' },
        { key: 'angle', label: 'Angle', type: 'range', min: -1.57, max: 1.57, step: 0.01, unit: ' rad' },
        { key: 'device', label: 'Wiretap', type: 'toggle' },
    ],
    draw(c, S, k) {
        frag ??= fragment(GLSL, 2)
        const out = paint('xray', frag, S, {
            uPal: { airport: 0, organic: 1, mono: 2, negative: 3 }[k.palette] ?? 0,
            uPen: k.penetration,
            uAng: k.angle,
            uArt: k.artefacts,
            uDev: k.device ? 1 : 0,
        })
        c.drawImage(out, 0, 0, S, S)
    },
}
