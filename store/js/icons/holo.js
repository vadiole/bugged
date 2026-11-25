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
uniform float uTilt, uPeel, uPat, uCam;
uniform vec3 uSurf, uInk;
float vesica(vec2 p,float r,float d){p=abs(p);float b=sqrt(r*r-d*d);return ((p.y-b)*d>p.x*b)?length(p-vec2(0.,b)):length(p-vec2(-d,0.))-r;}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float tcap(vec2 p,vec2 a,vec2 b,float ra,float rb){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-mix(ra,rb,h);}
const vec2 O=vec2(.05,-.05);
float eye(vec2 p){return vesica((p-O).yx,.636,.336);}
float lashes(vec2 p){
    vec2 q=p-O;
    float d=1e5;
    for(int i=0;i<5;i++){
        float t=float(i)-2.;
        float a=1.5708+t*.33;
        vec2 dir=vec2(cos(a),sin(a));
        vec2 b=vec2(0.,-.336)+dir*.6;
        float len=.17-.025*abs(t);
        vec2 tip=b+dir*len+vec2(t*.03,0.);
        d=min(d,tcap(q,b,tip,.032,.012));
    }
    return d;
}
float cut(vec2 p){return smin(eye(p),lashes(p),.05)-.055;}
vec3 spectrum(float x){
    x=clamp(x,0.,1.);
    vec3 c=vec3(smoothstep(.45,.75,x)+.6*smoothstep(.15,0.,x)*smoothstep(-.1,.05,x),smoothstep(.15,.45,x)*smoothstep(.85,.55,x),smoothstep(.55,.25,x));
    return c*smoothstep(0.,.08,x)*smoothstep(1.,.9,x);
}
vec3 grating(vec2 g,vec2 p,float freq){
    vec2 h=vec2(uTilt*1.1,.25)+p*.7;
    float s=abs(dot(g,h))*freq;
    vec3 c=spectrum(fract(s))*1.25+spectrum(fract(s*.5+.31))*.45;
    return c;
}
vec3 foil(vec2 p,bool iris,vec2 ic){
    vec3 base=vec3(.16,.17,.2)+.5*vec3(.9,.95,1.)*smoothstep(.5,-.5,p.y-p.x*.4+uTilt*.3);
    vec3 c;
    if(uPat<.5){
        if(iris){vec2 r=normalize(p-ic+1e-4);c=grating(vec2(-r.y,r.x),p,2.4);}
        else c=grating(normalize(vec2(1.,.6)),p,2.);
    }else if(uPat<1.5){
        c=grating(normalize(vec2(.3,1.)),p,iris?3.2:2.2);
    }else{
        vec2 cell=floor(p*55.);
        float a=hash(cell)*6.2832;
        c=grating(vec2(cos(a),sin(a)),p,2.)*1.2;
        vec2 f=fract(p*55.)-.5-(vec2(hash(cell+1.3),hash(cell+2.7))-.5)*.3;
        c*=.4+.8*step(length(f),.22+.18*hash(cell+5.1));
    }
    vec2 cell2=floor(p*160.);
    float spark=step(.985,hash(cell2+7.))*smoothstep(.6,.0,abs(hash(cell2)-.5+uTilt*.4));
    float sheen=exp(-pow(dot(p,normalize(vec2(1.,-.8)))-uTilt*.7+.1,2.)/.03);
    return base*.6+c*c*1.1+vec3(1.)*(spark*1.5+sheen*.5);
}
vec3 front(vec2 p){
    float w=2.5/uS;
    float e=eye(p);
    vec3 col=vec3(.93,.93,.91);
    vec2 ic=O+vec2(-.03,.0);
    float r=length(p-ic);
    if(e<0.)col=foil(p,r<.26,ic);
    vec3 ink=lin(uInk);
    col=mix(col,ink,1.-smoothstep(.018-w,.018+w,abs(e)));
    col=mix(col,ink,1.-smoothstep(-w,w,lashes(p)));
    float inside=1.-smoothstep(-w,w,e);
    col=mix(col,ink,inside*(1.-smoothstep(-w,w,abs(r-.26)-.014)));
    col=mix(col,ink,inside*(1.-smoothstep(-w,w,r-.115)));
    col=mix(col,vec3(.97),inside*(1.-smoothstep(-w,w,length(p-ic-vec2(-.045,.05))-.035)));
    return col;
}
vec3 surface(vec2 p){
    vec3 s=lin(uSurf);
    float g=fbm(vec2(p.x*3.,p.y*220.))*.5+vnoise(vec2(p.x*900.,p.y*40.))*.5;
    s*=.88+.2*g;
    s*=1.15-.35*length(p-vec2(-.4,.5));
    vec2 lc=p-vec2(.49,-.03);
    float lr=length(lc);
    float w=2./uS;
    s=mix(s,vec3(.035),1.-smoothstep(.062-w,.062+w,lr));
    s=mix(s,vec3(.11,.11,.13),(1.-smoothstep(.05-w,.05+w,lr))*.6);
    vec3 glass=mix(vec3(.004,.004,.01),vec3(.08,.02,.16),smoothstep(.03,.0,length(lc-vec2(.01,-.012))));
    s=mix(s,glass,1.-smoothstep(.036-w,.036+w,lr));
    s+=vec3(.9)*(1.-smoothstep(.007-w,.007+w,length(lc-vec2(-.012,.013))));
    s+=vec3(.3,.15,.6)*exp(-pow((lr-.04)/.004,2.))*.4*smoothstep(-.02,.02,lc.x-lc.y);
    if(uCam>.5){
        float led=length(p-vec2(.6,-.03));
        s=mix(s,vec3(.3,2.4,.5),1.-smoothstep(.011-w,.011+w,led));
        s+=vec3(.05,.7,.15)*exp(-led*led/.0015)*.6;
    }
    return s;
}
const vec2 N=vec2(.8944,.4472);
float edgeL(){return .56-uPeel*.5;}
float R(){return .035+.035*uPeel;}
vec3 back(float shade){return vec3(.82,.82,.8)*shade;}
float flapAt(vec2 p,out vec3 col){
    float x=dot(p,N)-edgeL();
    float rr=R();
    float w=2.5/uS;
    if(x>rr)return 0.;
    float dd;
    float sh;
    if(x>=0.){
        float a=asin(clamp(x/rr,0.,1.));
        dd=rr*(3.14159-a);
        sh=.75+.3*cos(a);
    }else{
        dd=3.14159*rr-x;
        sh=1.02+.05*smoothstep(0.,-.2,x);
    }
    vec2 po=p-N*x+N*dd;
    float c=cut(po);
    if(c>w)return 0.;
    col=back(sh)*(.96+.04*vnoise(po*300.));
    return 1.-smoothstep(-w,w,c);
}
float flapSoft(vec2 p,float blur){
    float x=dot(p,N)-edgeL();
    float rr=R();
    if(x>rr)return 0.;
    float dd=x>=0.?rr*(3.14159-asin(clamp(x/rr,0.,1.))):3.14159*rr-x;
    return 1.-smoothstep(-blur,blur,cut(p-N*x+N*dd));
}
vec3 shade(vec2 uv){
    vec2 p=uv/1.1;
    float w=2.5/uS;
    float x=dot(p,N)-edgeL();
    vec3 col=surface(p);
    float c=cut(p);
    float ds=1.-smoothstep(-.03,.04,cut(p-vec2(.012,-.02)));
    col*=1.-.55*ds*step(x,0.);
    float fs=flapSoft(p-vec2(.03,-.05)*(.5+uPeel),.05);
    if(x>0.)col*=1.-.6*exp(-x/R())*(1.-smoothstep(-.02,.04,c));
    float on=(1.-smoothstep(-w,w,c))*step(x,0.);
    vec3 fc=front(p);
    float ed=1.-smoothstep(0.,.012,-c);
    vec2 gr=vec2(cut(p+vec2(.004,0.))-c,cut(p+vec2(0.,.004))-c);
    fc*=1.+ed*.35*clamp(dot(normalize(gr+1e-6),vec2(.6,-.8)),-1.,1.);
    fc*=1.-.25*smoothstep(-.12,0.,x)*on;
    col=mix(col,fc,on);
    col*=1.-.5*fs;
    vec3 bc;
    float f=flapAt(p,bc);
    col=mix(col,bc,f);
    return col;
}
vec3 finish(vec3 c,vec2 uv,vec2 px){
    c=c/(1.+c*.15);
    return pow(c,vec3(1./2.2))+(hash(px)-.5)/255.;
}
`

let frag = null

export default {
    id: 'holo',
    name: 'Holo sticker',
    note: 'A foil eye sticker over the webcam, peeled back. The light is on.',
    defaults: { tilt: 0.25, peel: 0.5, pattern: 'pinwheel', surface: '#c4c7cc', ink: '#0d0b14', live: true },
    schema: [
        { group: 'Foil' },
        { key: 'tilt', label: 'Tilt', type: 'range', min: -1, max: 1, step: 0.01 },
        { key: 'pattern', label: 'Pattern', type: 'select', options: [['pinwheel', 'Pinwheel'], ['rainbow', 'Rainbow'], ['glitter', 'Glitter']] },
        { key: 'ink', label: 'Ink', type: 'color' },
        { group: 'Sticker' },
        { key: 'peel', label: 'Peel', type: 'range', min: 0, max: 1, step: 0.01 },
        { key: 'surface', label: 'Surface', type: 'color' },
        { key: 'live', label: 'Camera light', type: 'toggle' },
    ],
    draw(c, S, k) {
        frag ??= fragment(GLSL, 3)
        const out = paint('holo', frag, S, {
            uTilt: k.tilt,
            uPeel: k.peel,
            uPat: { pinwheel: 0, rainbow: 1, glitter: 2 }[k.pattern] ?? 0,
            uSurf: rgb(k.surface),
            uInk: rgb(k.ink),
            uCam: k.live ? 1 : 0,
        })
        c.drawImage(out, 0, 0, S, S)
    },
}
