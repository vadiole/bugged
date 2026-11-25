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
        else gl.uniform3fv(loc, v)
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    return canvas
}

const rgb = (hex) => {
    const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const fragment = (aa) => `precision highp float;
uniform float uS,uLid,uGlance,uPrint,uLight,uMouth;
uniform vec3 uClay,uBack;
const vec3 BC=vec3(0.,.5,0.);
const float RE=.165;
vec3 lin(vec3 c){return pow(c,vec3(2.2));}
float h1(float n){return fract(sin(n)*43758.5453);}
float h2(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);float n=i.x+i.y*57.+i.z*113.;
return mix(mix(mix(h1(n),h1(n+1.),f.x),mix(h1(n+57.),h1(n+58.),f.x),f.y),mix(mix(h1(n+113.),h1(n+114.),f.x),mix(h1(n+170.),h1(n+171.),f.x),f.y),f.z);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float smax(float a,float b,float k){return -smin(-a,-b,k);}
float ell(vec3 p,vec3 r){float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.)/k1;}
vec3 eyeC(float s){return vec3(s*.205,.665,.405);}
float dent(float d,vec3 p,vec3 dir,float rad,float depth){
    dir=normalize(dir);
    float R=1./length(dir/vec3(.6,.52,.5));
    vec3 c=BC+dir*(R+rad-depth);
    return smax(d,-(length(p-c)-rad),.05);
}
float base(vec3 p){
    vec3 q=p-BC;
    q.xz*=1.+.2*q.y;
    q.x*=1.-.06*q.y;
    float d=ell(q,vec3(.6,.52,.5));
    d+=.02*(n3(p*2.7+3.)-.5)+.007*(n3(p*6.1)-.5);
    d=smax(d,-p.y,.09);
    d=dent(d,p,vec3(.95,.55,.35),.26,.035);
    d=dent(d,p,vec3(-.5,-.35,.8),.22,.028);
    d=dent(d,p,vec3(-.2,1.,-.1),.3,.03);
    d=dent(d,p,vec3(.6,-.2,-.8),.24,.03);
    vec3 sn=normalize(vec3(1.,.3,-.25));
    float pl=dot(q,sn)+.4;
    float run=smoothstep(.0,.25,q.y+.3)*smoothstep(.5,.25,q.y);
    d+=run*(.016*exp(-pl*pl/.00012)-.007*exp(-(pl-.022)*(pl-.022)/.0002));
    return d;
}
float lidS(vec3 p,float s,float l,float tilt){
    vec3 e=eyeC(s);
    vec3 n=normalize(vec3(-s*tilt,1.,.15));
    float sph=length(p-e)-(RE+.02)+.008*(n3(p*8.+s*3.)-.5);
    return smax(sph,-(dot(p-e,n)-l),.022);
}
float mouthLine(vec2 p){
    float x=clamp(p.x,-.13,.1);
    float y=.355+.012*x/.12-uMouth*(.07*x*x/.0144-.03);
    return length(vec2(p.x-x,(p.y-y)*1.))-.022;
}
vec2 map(vec3 p){
    float sw;
    float W=2.4,R=1.4;
    vec2 cq=vec2(p.z+W-R,p.y-R);
    if(p.z>-W+R&&p.y<R)sw=p.y;
    else if(p.y>R&&p.z<-W+R)sw=p.z+W;
    else if(cq.x<=0.&&cq.y<=0.)sw=R-length(cq);
    else sw=min(p.y,p.z+W);
    vec2 r=vec2(sw,0.);
    float bb=length(p-BC)-.95;
    if(bb>.15){if(bb<r.x)r=vec2(bb,9.);return r;}
    float b=base(p);
    float lp=mix(RE*.95,-RE*.55,uLid);
    float body=b;
    body=smin(body,lidS(p,-1.,lp-.012,.1),.025);
    body=smin(body,lidS(p,1.,lp+.008,-.04),.025);
    if(body<r.x)r=vec2(body,1.);
    for(int i=0;i<2;i++){
        float s=float(i)*2.-1.;
        vec3 e=eyeC(s);
        float ew=length(p-e)-RE+.005*(n3(p*9.+s*5.)-.5);
        if(ew<r.x)r=vec2(ew,2.);
        vec3 dir=normalize(vec3(uGlance*.82+s*.05,-.26,.55));
        vec3 pc=e+RE*dir;
        float pu=smax(length(p-e)-(RE+.011),length(p-pc)-.082,.008);
        if(pu<r.x)r=vec2(pu,3.);
    }
    if(uMouth<1.5){
        float m=smax(smax(b-.017,mouthLine(p.xy),.012),-p.z,.01);
        if(m<r.x)r=vec2(m,4.);
    }
    return r;
}
float scene(vec3 p){return map(p).x;}
vec3 frame(vec3 d,float a,out vec3 t2){
    vec3 up=abs(d.y)>.9?vec3(1,0,0):vec3(0,1,0);
    vec3 t1=normalize(cross(up,d));t2=cross(d,t1);
    float c=cos(a),s=sin(a);
    vec3 a1=c*t1+s*t2;t2=-s*t1+c*t2;
    return a1;
}
vec3 fprint(vec3 p,vec3 dir,float ang,float sz,float type,float seed){
    dir=normalize(dir);
    vec3 t2;vec3 t1=frame(dir,ang,t2);
    vec3 v=p-BC;
    vec2 q=vec2(dot(v,t1),dot(v,t2))/sz;
    float facing=dot(normalize(v),dir);
    float mask=smoothstep(1.,.86,length(q*vec2(1.05,.78)))*smoothstep(.55,.75,facing);
    if(mask<=0.)return vec3(0.);
    q+=.07*(vec2(n2(q*2.5+seed),n2(q*2.5+seed+9.))-.5);
    float f;
    if(type<.5){
        f=length(q*vec2(1.1,.85))+atan(q.y,q.x)/6.2832*.095;
    }else if(type<1.5){
        vec2 w=q;w.x+=.3*w.y*w.y-.1*w.y;
        f=length(w-vec2(0.,clamp(w.y,-.2,.28)));
        f=mix(f,-.35*w.y+.25,smoothstep(-.3,-.75,w.y));
    }else{
        f=q.y-.32*exp(-4.*q.x*q.x)+.1*q.x;
    }
    float ph=6.2832*f/.095+1.2*n2(q*7.+seed);
    float rid=.5+.5*cos(ph);
    float brk=smoothstep(.15,.35,n2(q*9.+seed*3.));
    rid=mix(.5,rid,brk);
    return vec3(mask,rid,smoothstep(1.,.3,length(q)));
}
float relief(vec3 p,out float cav){
    float h=0.;cav=0.;
    vec3 f;
    f=fprint(p,vec3(.95,.55,.35),.4,.2,0.,1.);h=mix(h,-f.y-.6*f.z,f.x);cav=mix(cav,f.y,f.x);
    f=fprint(p,vec3(-.55,-.4,.75),-.3,.16,1.,2.);h=mix(h,-f.y-.5*f.z,f.x);cav=mix(cav,f.y,f.x);
    f=fprint(p,vec3(-.2,1.,-.1),1.2,.2,0.,3.);h=mix(h,-f.y-.5*f.z,f.x);cav=mix(cav,f.y,f.x);
    f=fprint(p,vec3(.5,-.45,.75),2.2,.15,2.,4.);h=mix(h,-f.y,f.x*.8);cav=mix(cav,f.y,f.x*.8);
    f=fprint(p,vec3(.58,-.28,.76),.25,.19,0.,9.);h=mix(h,-f.y-.5*f.z,f.x);cav=mix(cav,f.y,f.x);
    f=fprint(p,vec3(-1.,.2,.0),-1.,.18,1.,5.);h=mix(h,-f.y-.4*f.z,f.x);cav=mix(cav,f.y,f.x);
    f=fprint(p,vec3(-.5,.85,.4),-.7,.14,2.,7.);h=mix(h,-f.y-.3*f.z,f.x*.85);cav=mix(cav,f.y,f.x*.85);
    vec3 sp=p*vec3(9.,26.,9.);
    float wipe=n3(vec3(sp.x+sp.z,sp.y+2.*sp.x,sp.z*.5))-.5;
    return h*.0032*uPrint+wipe*.0016;
}
vec3 normalAt(vec3 p,float mat){
    vec2 e=vec2(1.,-1.)*.0012;
    float c;
    float dm=mat>0.5&&mat<8.&&mat!=2.?1.:0.;
    vec3 a=p+e.xyy,b=p+e.yyx,cc=p+e.yxy,d=p+e.xxx;
    return normalize(e.xyy*(scene(a)+dm*relief(a,c))+e.yyx*(scene(b)+dm*relief(b,c))+e.yxy*(scene(cc)+dm*relief(cc,c))+e.xxx*(scene(d)+dm*relief(d,c)));
}
float shadow(vec3 ro,vec3 rd){
    float res=1.,t=.02;
    for(int i=0;i<48;i++){
        vec2 m=map(ro+rd*t);float h=m.x;
        if(m.y<8.)res=min(res,4.5*h/t);
        t+=clamp(h,.004,.15);
        if(res<.002||t>4.)break;
    }
    return clamp(res,0.,1.);
}
float occl(vec3 p,vec3 n){
    float o=0.,w=1.;
    for(int i=1;i<6;i++){
        float h=.025*float(i*i);
        o+=w*(h-scene(p+n*h));w*=.6;
    }
    return clamp(1.-1.6*o,0.,1.);
}
float lint(vec3 p,vec3 dir,float ang,float len,float seed){
    dir=normalize(dir);
    vec3 t2;vec3 t1=frame(dir,ang,t2);
    vec3 v=p-BC;
    if(dot(normalize(v),dir)<.9)return 0.;
    vec2 q=vec2(dot(v,t1),dot(v,t2));
    float x=clamp(q.x,-len,len);
    float y=.025*sin(x*38.+seed)+.012*sin(x*91.+seed*2.);
    float d=length(vec2(q.x-x,q.y-y));
    return smoothstep(.0045,.0015,d);
}
vec3 shade(vec2 uv){
    vec3 ro=vec3(0.,1.45,4.6);
    vec3 ta=vec3(0.,.5,0.);
    vec3 fw=normalize(ta-ro),rt=normalize(cross(fw,vec3(0,1,0))),up=cross(rt,fw);
    vec3 rd=normalize(uv.x*rt+uv.y*up+4.6*fw);
    float t=2.5;vec2 h;
    for(int i=0;i<140;i++){
        h=map(ro+rd*t);
        if(h.x<.0004*t||t>14.)break;
        t+=h.x*.9;
    }
    vec3 p=ro+rd*t;
    float mat=h.y;
    vec3 n=normalAt(p,mat);
    float la=radians(uLight);
    vec3 L=normalize(vec3(sin(la)*.9,1.7,cos(la)*.6+.45));
    vec3 V=-rd;
    float sh=shadow(p+n*.004,L);
    float ao=occl(p,n);
    float pool=exp(-dot(p.xz-vec2(-.2,.2),p.xz-vec2(-.2,.2))*.09)*(.75+.25*smoothstep(3.,0.,p.y));
    vec3 keyc=vec3(1.,.93,.82)*2.6*pool;
    vec3 back=lin(uBack);
    vec3 fillc=mix(vec3(.55,.62,.75),back,.5)*.5;
    float dif=max(dot(n,L),0.);
    vec3 col;
    if(mat<.5){
        float fib=n2(p.xz*vec2(60.,60.))*.5+n2(p.xz*vec2(170.,170.))*.5;
        vec3 alb=back*(.94+.08*fib);
        float lt=lint(p+vec3(0.,.5,0.),vec3(0.,1.,0.),.3,.05,4.);
        col=alb*(keyc*dif*sh+fillc*(.35+.65*ao)*ao);
        col*=mix(1.,.8,smoothstep(.0,-1.,p.z+.6)*0.);
    }else{
        float cav;
        float rel=mat<4.5&&mat!=2.?relief(p,cav):0.;
        vec3 alb;
        float spec=.18,pw=38.,sss=1.;
        if(mat<1.5){
            alb=lin(uClay);
            float mv=n3(p*vec3(3.,9.,3.)+n3(p*4.)*2.);
            alb*=.9+.18*mv;
            float sp=step(.988,h1(dot(floor(p*95.),vec3(1.,57.,113.))));
            float spd=smoothstep(.45,.2,length(fract(p*95.)-.5));
            alb=mix(alb,alb*.35,sp*spd*.8);
            float ln=max(lint(p,vec3(.55,.75,.45),.6,.07,1.),lint(p,vec3(-.6,.15,.8),2.,.05,7.));
            ln=max(ln,lint(p,vec3(.2,.95,.35),-.4,.035,3.));
            alb=mix(alb,vec3(.5,.52,.58),ln*.7);
        }else if(mat<2.5){
            alb=vec3(.88,.86,.8);sss=.4;
        }else if(mat<3.5){
            alb=vec3(.018,.016,.016);spec=.5;pw=70.;sss=0.;
        }else{
            alb=lin(uClay)*vec3(.22,.17,.16);spec=.25;sss=.3;
        }
        float cv=1.-.38*cav*uPrint;
        float wrap=clamp((dot(n,L)+.45)/1.45,0.,1.);
        float shs=mix(sh,1.,.25);
        col=alb*keyc*dif*sh;
        col+=alb*alb*keyc*(wrap-dif)*.9*sss*shs;
        col+=alb*(fillc*(.6+.4*n.y)+back*.35*max(-n.y,0.)+back*.12)*ao;
        col*=cv;
        vec3 hv=normalize(L+V);
        float s=pow(max(dot(n,hv),0.),pw)*spec*(pw+8.)/40.;
        col+=keyc*s*sh*cv;
        col+=fillc*.35*pow(1.-max(dot(n,V),0.),4.)*ao;
    }
    return col;
}
vec3 tone(vec3 c){c*=.95;return clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);}
void main(){
    vec3 acc=vec3(0.);
    for(int j=0;j<${aa};j++)for(int i=0;i<${aa};i++){
        vec2 o=(vec2(float(i),float(j))+.5)/${aa}.;
        acc+=tone(shade((gl_FragCoord.xy-.5+o)/uS*2.-1.));
    }
    vec3 c=acc/${aa * aa}.;
    vec2 uv=gl_FragCoord.xy/uS*2.-1.;
    c*=1.-.18*dot(uv,uv)*.5;
    c=pow(c,vec3(1./2.2));
    c+=(h2(gl_FragCoord.xy)-.5)*.018;
    gl_FragColor=vec4(clamp(c,0.,1.),1.);
}`

const frags = new Map()

export default {
    id: 'clay',
    name: 'Plasticine grump',
    note: 'A lump of clay that knows it is being watched, covered in the fingerprints of whoever made it.',
    defaults: { clay: '#e8743b', backdrop: '#5fa8a0', lids: 0.6, glance: -0.72, mouth: 'flat', prints: 0.7, light: -38 },
    schema: [
        { group: 'Character' },
        { key: 'lids', label: 'Lids', type: 'range', min: 0, max: 1, step: 0.01 },
        { key: 'glance', label: 'Glance', type: 'range', min: -1, max: 1, step: 0.01 },
        { key: 'mouth', label: 'Mouth', type: 'select', options: [['flat', 'Flat'], ['frown', 'Frown'], ['none', 'None']] },
        { key: 'prints', label: 'Fingerprints', type: 'range', min: 0, max: 1, step: 0.01 },
        { group: 'Set' },
        { key: 'clay', label: 'Clay', type: 'color' },
        { key: 'backdrop', label: 'Paper', type: 'color' },
        { key: 'light', label: 'Key light', type: 'range', min: -80, max: 80, step: 1, unit: '°' },
    ],
    draw(c, S, k) {
        const aa = S <= 160 ? 4 : S <= 640 ? 3 : 2
        if (!frags.has(aa)) frags.set(aa, fragment(aa))
        const out = paint('clay' + aa, frags.get(aa), S, {
            uClay: rgb(k.clay),
            uBack: rgb(k.backdrop),
            uLid: k.lids,
            uGlance: k.glance,
            uMouth: { flat: 0, frown: 1, none: 2 }[k.mouth] ?? 0,
            uPrint: k.prints,
            uLight: k.light,
        })
        c.drawImage(out, 0, 0, S, S)
    },
}
