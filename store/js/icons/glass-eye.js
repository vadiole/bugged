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
uniform float uGaze, uPupil, uLight;
uniform vec3 uIris, uSurf;
const vec3 C=vec3(0.,1.,0.);
const float IR=.6;
vec3 L(){float a=-2.35+uLight;return normalize(vec3(cos(a)*.75,.66,sin(a)*.75));}
vec3 G(){float a=uGaze;return normalize(vec3(sin(a),.05,cos(a)));}
float sph(vec3 ro,vec3 rd,out float t2){vec3 oc=ro-C;float b=dot(oc,rd);float c=dot(oc,oc)-1.;float h=b*b-c;if(h<0.){t2=-1.;return -1.;}h=sqrt(h);t2=-b+h;return -b-h;}
vec3 win(vec3 d){
    vec3 l=L();
    float k=dot(d,l);
    if(k<=0.)return vec3(0.);
    vec3 u=normalize(cross(l,vec3(0.,1.,0.)));
    vec3 v=cross(u,l);
    vec2 q=vec2(dot(d,u),dot(d,v))/k;
    vec2 a=abs(q-vec2(0.,.05))-vec2(.3,.42);
    float pane=1.-smoothstep(-.012,.012,max(a.x,a.y));
    float bars=smoothstep(.012,.022,abs(q.x))*smoothstep(.012,.022,abs(q.y-.12));
    vec3 sky=mix(vec3(1.,.98,.94),vec3(.75,.85,1.),smoothstep(-.3,.45,q.y));
    float tree=smoothstep(.0,.04,q.y+.25+.06*sin(q.x*25.)+.04*sin(q.x*61.+1.));
    return sky*pane*bars*mix(.35,1.,tree)*7.;
}
vec3 env(vec3 d){
    vec3 c=mix(vec3(.05,.042,.035),vec3(.018,.016,.015),smoothstep(-.1,.6,d.y));
    c+=vec3(.06,.05,.04)*smoothstep(.3,-.2,abs(d.y-.05));
    return c+win(d);
}
vec3 velvet(vec3 p){
    vec3 s=lin(uSurf);
    float f=fbm(p.xz*7.)*.6+fbm(p.xz*40.+3.)*.4;
    s*=.7+.55*f;
    return s;
}
vec3 caustic(vec3 X){
    vec3 l=L();
    vec3 v=X-C;
    float b=dot(v,l);
    float c=dot(v,v)-1.;
    float h=b*b-c;
    float soft=smoothstep(-.05,.05,h)*step(0.,-b+sqrt(max(h,0.)));
    float a=-b;
    vec3 pv=v+l*a;
    float perp=length(pv);
    float f=2.7;
    float r=abs(1.-a/f)+.035;
    float u=clamp(perp/r,0.,1.2);
    vec3 dir=pv/max(perp,1e-4)*(a>f?-1.:1.);
    vec3 P=C+dir*u;
    vec3 g=G();
    vec3 Dc=C+g*.22;
    float tt=dot(Dc-P,g)/dot(-l,g);
    vec3 H=P-l*tt;
    float block=1.-smoothstep(IR-.04,IR+.04,length(H-Dc));
    float pup=1.-smoothstep(uPupil*IR-.03,uPupil*IR+.03,length(H-Dc));
    float ring=(1.-smoothstep(.85,1.,u))*(.45+.9*u*u*u);
    float I=min(1./(r*r),16.)*ring*1.1;
    vec3 tint=mix(vec3(1.,.97,.9),lin(uIris)*1.3,block);
    tint*=1.-pup*.9;
    return mix(vec3(1.),vec3(.16)+tint*I,soft);
}
vec3 floorShade(vec3 X){
    vec3 l=L();
    vec3 base=velvet(X);
    float lam=l.y*1.5;
    vec3 cs=caustic(X);
    vec3 light=lam*cs;
    float d=length(X.xz-C.xz);
    float ao=1.-.75*exp(-d*d*3.5);
    float fall=exp(-dot(X.xz+vec2(.6,.6),X.xz+vec2(.6,.6))*.035);
    return base*(light*fall+.16)*ao;
}
vec3 iris(vec3 H,vec3 g,bool frontSide){
    if(!frontSide)return vec3(.02,.015,.01);
    vec3 u=normalize(cross(g,vec3(0.,1.,0.)));
    vec3 v=cross(u,g);
    vec2 q=vec2(dot(H,u),dot(H,v))/IR;
    float r=length(q);
    float th=atan(q.y,q.x);
    vec3 base=lin(uIris);
    float fib=fbm(vec2(th*9.,r*2.5))*.9+fbm(vec2(th*30.,r*6.))*.5;
    vec3 c=base*(.45+.8*fib);
    c=mix(c,base*vec3(1.25,1.15,.9)+.08,smoothstep(.12,.0,abs(r-uPupil-.12))*.6);
    c*=mix(1.,.25,smoothstep(.78,1.,r));
    vec2 pq=q;
    float pd=length(pq)-uPupil;
    c=mix(c,vec3(.006,.005,.005),1.-smoothstep(-.025,.015,pd));
    c*=1.-.5*smoothstep(.04,.0,abs(pd+.01))*step(0.,pd);
    return c;
}
vec3 inside(vec3 p,vec3 rd){
    vec3 g=G();
    vec3 Dc=C+g*.22;
    float t2;
    sph(p+rd*.001,rd,t2);
    float dn=dot(rd,g);
    float ti=abs(dn)>1e-4?dot(Dc-p,g)/dn:-1.;
    if(ti>0.&&ti<t2){
        vec3 H=p+rd*ti;
        if(length(H-Dc)<IR){
            vec3 l=L();
            float lit=.55+.75*clamp(dot(g,normalize(-rd+l*.4)),0.,1.);
            return iris(H-Dc,g,dn<0.)*lit*1.4;
        }
    }
    vec3 q=p+rd*t2;
    vec3 n=normalize(q-C);
    vec3 ro=refract(rd,-n,1.5);
    if(dot(ro,ro)<.01)ro=reflect(rd,-n);
    vec3 col;
    if(ro.y<0.){
        float tf=-q.y/ro.y;
        col=floorShade(q+ro*tf);
    }else col=env(ro);
    return col*vec3(.9,.95,.88);
}
vec3 shade(vec2 uv){
    vec3 ro=vec3(0.,3.3,6.4);
    vec3 ta=vec3(.12,.72,0.);
    vec3 w=normalize(ta-ro),u=normalize(cross(w,vec3(0.,1.,0.))),v=cross(u,w);
    vec3 rd=normalize(uv.x*u+uv.y*v+2.6*w);
    float t2;
    float t=sph(ro,rd,t2);
    if(t<0.){
        float tf=-ro.y/rd.y;
        if(tf<0.)return env(rd);
        return floorShade(ro+rd*tf);
    }
    vec3 p=ro+rd*t;
    vec3 n=normalize(p-C);
    float cs=max(dot(n,-rd),0.);
    float F=.04+.96*pow(1.-cs,5.);
    vec3 r=reflect(rd,n);
    vec3 rc=r.y<0.?floorShade(p+r*(-p.y/r.y)):env(r);
    vec3 rin=refract(rd,n,1./1.5);
    vec3 tc=inside(p,rin);
    return mix(tc,rc,F)+win(r)*.04;
}
vec3 finish(vec3 c,vec2 uv,vec2 px){
    c*=1.-.25*dot(uv,uv)*.5;
    c=c*(2.51*c+.03)/(c*(2.43*c+.59)+.14);
    return pow(c,vec3(1./2.2))+(hash(px)-.5)/255.;
}
`

let frag = null

export default {
    id: 'glass-eye',
    name: 'Glass eye',
    note: 'A taxidermist’s glass eye on velvet, looking away from you. Mostly.',
    defaults: { iris: '#d8941c', pupil: 0.34, gaze: 0.75, light: 0, surface: '#27322f' },
    schema: [
        { group: 'Eye' },
        { key: 'iris', label: 'Iris', type: 'color' },
        { key: 'pupil', label: 'Pupil', type: 'range', min: 0.15, max: 0.65, step: 0.01 },
        { key: 'gaze', label: 'Glance', type: 'range', min: -1, max: 1, step: 0.01 },
        { group: 'Table' },
        { key: 'light', label: 'Window', type: 'range', min: -1, max: 1, step: 0.01 },
        { key: 'surface', label: 'Velvet', type: 'color' },
    ],
    draw(c, S, k) {
        frag ??= fragment(GLSL, 2)
        const out = paint('glass-eye', frag, S, {
            uGaze: k.gaze,
            uPupil: k.pupil,
            uLight: k.light,
            uIris: rgb(k.iris),
            uSurf: rgb(k.surface),
        })
        c.drawImage(out, 0, 0, S, S)
    },
}
