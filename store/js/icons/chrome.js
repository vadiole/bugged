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
uniform float uMelt, uBeetle, uDrops, uMetal;
uniform vec3 uBack;
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float ell(vec3 p,vec3 r){float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.)/k1;}
float cap(vec3 p,vec3 a,vec3 b,float ra,float rb){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-mix(ra,rb,h);}
float leg(vec3 p,vec3 a,vec3 b,vec3 c,float r,float k){return smin(cap(p,a,b,r,r*.8),cap(p,b,c,r*.8,r*.45),k);}
float tick(vec3 p){
    float k=uMelt;
    float d=ell(p-vec3(0.,.24,.18),vec3(.56,.3,.66));
    d=smin(d,ell(p-vec3(0.,.2,-.32),vec3(.36,.2,.36)),k);
    d=smin(d,ell(p-vec3(0.,.12,-.72),vec3(.12,.08,.16)),k*.5);
    vec3 q=vec3(abs(p.x),p.y,p.z);
    d=smin(d,cap(q,vec3(.05,.1,-.8),vec3(.07,.07,-.92),.04,.03),k*.3);
    float l=1e5;
    for(int i=0;i<4;i++){
        float t=float(i)/3.;
        float a=mix(-1.25,1.05,t);
        vec3 dir=vec3(cos(a),0.,sin(a));
        vec3 b=vec3(0.,.16,-.42+.3*t)+dir*.24;
        vec3 kn=b+dir*.32+vec3(0.,.16,0.);
        vec3 tip=b+dir*.66+vec3(0.,0.,(t-.5)*.3);
        tip.y=.04;
        l=min(l,leg(q,b,kn,tip,.085,k*.4));
    }
    return smin(d,l,k*.45);
}
float beetle(vec3 p){
    float k=uMelt;
    float d=ell(p-vec3(0.,.27,.22),vec3(.54,.3,.72));
    d+=.025*exp(-abs(p.x)*45.)*smoothstep(-.4,-.2,p.z);
    d=smin(d,ell(p-vec3(0.,.22,-.58),vec3(.42,.2,.26)),k*.6);
    d=smin(d,ell(p-vec3(0.,.15,-.88),vec3(.2,.12,.15)),k*.5);
    vec3 q=vec3(abs(p.x),p.y,p.z);
    float l=cap(q,vec3(.1,.17,-.98),vec3(.24,.25,-1.2),.03,.025);
    l=min(l,cap(q,vec3(.24,.25,-1.2),vec3(.42,.18,-1.38),.025,.03));
    for(int i=0;i<3;i++){
        float t=float(i)/2.;
        float a=mix(-.8,.75,t);
        vec3 dir=vec3(cos(a),0.,sin(a));
        vec3 b=vec3(0.,.15,-.5+.4*t)+dir*.3;
        vec3 kn=b+dir*.38+vec3(0.,.16,0.);
        vec3 tip=b+dir*.85+vec3(0.,0.,.2*(t-.3));
        tip.y=.035;
        l=min(l,leg(q,b,kn,tip,.065,k*.35));
    }
    return smin(d,l,k*.45);
}
float drops(vec3 p){
    float d=1e5;
    for(int i=0;i<5;i++){
        float f=float(i);
        float a=f*2.39+.7;
        float r=.95+.15*hash(vec2(f,3.1));
        float s=.05+.06*hash(vec2(f,7.7));
        vec3 c=vec3(cos(a)*r,s*.75,sin(a)*r*.85+.1);
        d=min(d,ell(p-c,vec3(s,s*.75,s)));
    }
    return d;
}
float map(vec3 p){
    float b=mix(tick(p),beetle(p),uBeetle);
    float pool=ell(p-vec3(0.,0.,.12),vec3(.44,.02,.5));
    b=smin(b,pool,.1+.3*uMelt);
    if(uDrops>.5)b=min(b,drops(p));
    return max(b,-p.y);
}
vec3 nrm(vec3 p){vec2 e=vec2(.0015,-.0015);return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));}
float march(vec3 ro,vec3 rd,float tmax){
    float t=0.;
    for(int i=0;i<110;i++){
        float h=map(ro+rd*t);
        if(h<.0007*t||t>tmax)break;
        t+=h*.9;
    }
    return t;
}
vec3 back(){return lin(uBack);}
vec3 sky(vec3 d){
    vec3 c=mix(back()*.5,vec3(.01),smoothstep(-.05,.3,d.y));
    c+=vec3(1.6)*exp(-pow((d.y-.08)/.06,2.));
    c=mix(c,vec3(.32,.33,.36),smoothstep(.35,1.,d.y));
    if(d.y>0.){
        vec2 q=d.xz/d.y;
        vec2 bx=abs(q-vec2(-.35,.2))-vec2(.4,.24);
        float box=1.-smoothstep(-.05,.05,max(bx.x,bx.y));
        c+=vec3(5.)*box;
    }
    float az=atan(d.x,-d.z);
    float strip=smoothstep(.09,.05,abs(az-1.35))*smoothstep(.0,.08,d.y)*smoothstep(.75,.6,d.y);
    float strip2=smoothstep(.06,.03,abs(az+1.75))*smoothstep(.05,.1,d.y)*smoothstep(.7,.55,d.y);
    c+=vec3(3.2,3.1,3.)*strip+vec3(1.8)*strip2;
    c+=vec3(2.2)*smoothstep(.035,.0,abs(d.y-.42-.12*sin(az*1.3)))*smoothstep(1.8,.6,abs(az-.4));
    float wall=smoothstep(-.2,-.5,d.z)*smoothstep(.22,.1,d.y);
    c=mix(c,back()*(.6+.8*smoothstep(.45,.1,d.y)),wall);
    return c;
}
float shadow(vec3 p,vec3 l){
    float s=1.,t=.05;
    for(int i=0;i<28;i++){
        float h=map(p+l*t);
        s=min(s,16.*h/t);
        t+=clamp(h,.02,.25);
        if(s<.001||t>4.)break;
    }
    return clamp(s,0.,1.);
}
vec3 floorCol(vec3 p){
    vec3 l=normalize(vec3(.2,1.,.45));
    float sh=mix(.45,1.,smoothstep(.0,.3,map(p+vec3(-.04,.12,-.1))));
    float ao=1.;
    for(int i=1;i<5;i++){float h=.06*float(i);ao-=(h-map(p+vec3(0.,h,0.)))*(.9/float(i));}
    ao=clamp(ao,0.,1.);
    float spot=exp(-dot(p.xz,p.xz)*.12);
    return back()*(.25+1.1*sh*spot)*mix(.35,1.,ao);
}
vec3 metal(){
    if(uMetal<.5)return vec3(.92,.93,.95);
    if(uMetal<1.5)return vec3(1.,.74,.36);
    return vec3(.36,.35,.38);
}
vec3 shade(vec2 uv){
    vec3 ro=vec3(0.,5.2,4.);
    vec3 ta=vec3(0.,.15,-.05);
    vec3 w=normalize(ta-ro),u=normalize(cross(w,vec3(0.,1.,0.))),v=cross(u,w);
    vec3 rd=normalize(uv.x*u+uv.y*v+4.6*w);
    float tf=-ro.y/rd.y;
    float t=march(ro,rd,tf+.1);
    if(t>=tf)return floorCol(ro+rd*tf);
    vec3 p=ro+rd*t;
    vec3 n=nrm(p);
    vec3 r=reflect(rd,n);
    vec3 f0=metal();
    float fr=pow(1.-max(dot(n,-rd),0.),5.);
    vec3 F=f0+(1.-f0)*fr;
    vec3 col;
    float t2=march(p+n*.01,r,3.);
    if(t2<3.){
        vec3 p2=p+n*.01+r*t2;
        vec3 n2=nrm(p2);
        vec3 r2=reflect(r,n2);
        vec3 c2=r2.y<0.?back()*.35:sky(r2);
        col=c2*f0*.9;
    }else if(r.y<0.){
        col=floorCol(p+r*(-p.y/r.y));
    }else col=sky(r);
    float cav=clamp(map(p+n*.08)/.08,0.,1.);
    return col*F*mix(.4,1.,cav);
}
vec3 finish(vec3 c,vec2 uv,vec2 px){
    c*=1.-.35*dot(uv,uv)*.5;
    c=c*(2.51*c+.03)/(c*(2.43*c+.59)+.14);
    c=pow(c,vec3(1./2.2));
    return c+(hash(px)-.5)/255.;
}
`

let frag = null

export default {
    id: 'chrome',
    name: 'Liquid chrome',
    note: 'A tracker that melted: a mercury tick pooled on studio paper.',
    defaults: { species: 'tick', melt: 0.16, metal: 'chrome', backdrop: '#ff5a1f', drops: true },
    schema: [
        { group: 'Subject' },
        { key: 'species', label: 'Species', type: 'select', options: [['tick', 'Tick'], ['beetle', 'Beetle']] },
        { key: 'melt', label: 'Melt', type: 'range', min: 0.02, max: 0.4, step: 0.01 },
        { key: 'drops', label: 'Droplets', type: 'toggle' },
        { group: 'Studio' },
        { key: 'metal', label: 'Metal', type: 'select', options: [['chrome', 'Chrome'], ['gold', 'Gold'], ['black', 'Black chrome']] },
        { key: 'backdrop', label: 'Backdrop', type: 'color' },
    ],
    draw(c, S, k) {
        frag ??= fragment(GLSL, 2)
        const out = paint('chrome', frag, S, {
            uMelt: k.melt,
            uBeetle: k.species === 'beetle' ? 1 : 0,
            uDrops: k.drops ? 1 : 0,
            uMetal: { chrome: 0, gold: 1, black: 2 }[k.metal] ?? 0,
            uBack: rgb(k.backdrop),
        })
        c.drawImage(out, 0, 0, S, S)
    },
}
