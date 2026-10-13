const D = __DATA__;
const P = D.P;
const stage = document.querySelector(".vp-stage");
const screenCanvas = stage.querySelector(".vp-screen-gl");
const stageCanvas = stage.querySelector(".vp-stage-gl");
const readout = document.querySelector("[data-readout]");
const status = stage.querySelector("[data-status]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (selector) => stage.querySelector(selector);
const TAU = Math.PI * 2;
const f1 = (v) => Math.round(v * 10) / 10;
const clampTo = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ------------------------------------------------------------ shaders: the water's standing waves, shared by both layers
const FIELD = `
uniform vec4 uWave;uniform vec2 uOrder;uniform float uTwist;uniform float uFocus;uniform float uBlur;uniform float uEdge;
uniform vec4 uDrop[4];uniform vec3 uDropK;uniform vec3 uGel;uniform float uLamp;uniform float uLevel;
uniform vec4 uStage;uniform float uStageZ;uniform vec4 uDish;uniform vec4 uDishZ;uniform vec2 uRingZ;uniform vec3 uArm;
float gH;vec2 gG;vec3 gX;
void plane(vec2 p,float th,float a){
  vec2 e=vec2(cos(th),sin(th));float ph=uWave.x*dot(p,e);float c=cos(ph);float s=sin(ph);
  gH+=a*c;gG-=a*uWave.x*s*e;gX-=a*uWave.x*uWave.x*c*vec3(e.x*e.x,e.x*e.y,e.y*e.y);
}
void planes(vec2 p,float n,float w){
  float a=w/sqrt(n);
  for(int j=0;j<7;j++){if(float(j)>=n)break;plane(p,3.14159265*float(j)/n+uWave.w,a);}
}
void drops(vec2 p){
  for(int i=0;i<4;i++){
    vec4 d=uDrop[i];
    if(d.w<.0005)continue;
    vec2 q=p-d.xy;float r=length(q)+.001;float w=uDropK.z;float kk=uDropK.y;
    float x=r-uDropK.x*d.z;float E=exp(-x*x/(w*w));float c=cos(kk*x);float s=sin(kk*x);
    float g1=E*(-2.*x/(w*w)*c-kk*s);
    float g2=E*((4.*x*x/(w*w*w*w)-2./(w*w)-kk*kk)*c+4.*kk*x/(w*w)*s);
    vec2 n=q/r;float t=g1/r;float a=d.w*(1.-smoothstep(uDish.x-6.,uDish.x,r));
    gH+=a*E*c;gG+=a*g1*n;gX+=a*vec3((g2-t)*n.x*n.x+t,(g2-t)*n.x*n.y,(g2-t)*n.y*n.y+t);
  }
}
void field(vec2 p){
  gH=0.;gG=vec2(0.);gX=vec3(0.);
  planes(p,uOrder.x,1.-uOrder.y);
  if(uOrder.y>.001)planes(p,uOrder.x+1.,uOrder.y);
  float wall=1.-smoothstep(uEdge,uDish.x-.5,length(p));
  float A=uWave.y*uWave.z*wall;
  gH*=A;gG*=A;gX*=A;
  drops(p);
}
float jacobian(float c){float J=(1.+c*gX.x)*(1.+c*gX.z)-c*c*gX.y*gX.y;return sqrt(1.+uBlur*uBlur)/sqrt(J*J+uBlur*uBlur);}
vec2 twisted(vec2 s){float a=uTwist*length(s);float c=cos(a);float n=sin(a);return vec2(c*s.x-n*s.y,n*s.x+c*s.y);}
vec3 causticOf(vec2 s){
  vec2 w=twisted(s);
  vec2 u=w;field(u);u=w-uFocus*gG;field(u);u=w-uFocus*gG;field(u);
  vec2 g=gG;float green=jacobian(uFocus);
  field(w-uFocus*.86*g);float red=jacobian(uFocus*.86);
  field(w-uFocus*1.14*g);float blue=jacobian(uFocus*1.14);
  return vec3(red,green,blue);
}
float sdRect(vec2 p,vec4 r,float rad){vec2 c=.5*(r.xy+r.zw);vec2 h=.5*(r.zw-r.xy)-rad;vec2 q=abs(p-c)-h;return length(max(q,0.))+min(max(q.x,q.y),0.)-rad;}
float inRect(vec2 p,vec4 r,float rad,float soft){return 1.-smoothstep(-soft,soft,sdRect(p,r,rad));}
vec3 finish(vec3 c){
  float m=max(c.r,max(c.g,c.b));
  float n=(hash12(gl_FragCoord.xy+fract(uTime*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(uTime*.37)*57.)-1.)/255.;
  return max(c+n*smoothstep(0.,1.5/255.,m),0.);
}
`;

// the screen: the image of the stage, magnified, with the dish's caustics in it, and the beam that carries it
const SCREEN_GLSL = `${FIELD}
uniform vec4 uScreen;uniform float uScreenY;uniform vec3 uImg;uniform vec3 uExit;uniform vec4 uWheel;uniform vec3 uGels[6];uniform float uWheelA;
vec3 gelAt(vec3 p){
  float s=(uExit.y-uWheel.z)/(uExit.y-p.y);
  vec2 q=mix(uExit.xz,p.xz,s);
  vec2 uw=vec2(q.x-uWheel.x,-(q.y-uWheel.y));
  float r=max(length(uw),1.);
  float a=atan(uw.y,uw.x)-uWheelA;
  float soft=clamp(2.6/r,.03,.4);
  vec3 sum=vec3(0.);float tot=0.;
  for(int j=0;j<6;j++){
    float c=(float(j)+.5)*1.0471976;
    float d=abs(mod(a-c+3.14159265,6.2831853)-3.14159265);
    float w=1.-smoothstep(.5236-soft,.5236+soft,d);
    sum+=uGels[j]*w;tot+=w;
  }
  float m=mod(a,1.0471976);
  float seam=1.-.45*(1.-smoothstep(0.,soft*.8,min(m,1.0471976-m)));
  float rim=1.-smoothstep(uWheel.w-4.,uWheel.w-1.,r);
  return mix(vec3(.9),sum/max(tot,1e-4)*seam,rim);
}
float passOf(vec2 st,float soft){
  float r=length(st);
  float sq=inRect(st,uStage,2.,soft);
  float ring=window(r,uDish.y,uDish.z,soft);
  float wall=window(r,uDish.x,uDish.y,soft*.7);
  float arm=window(st.x,uArm.z,uArm.x,soft)*window(st.y,-uArm.y,uArm.y,soft);
  float fres=1.-.05*(.5+.5*cos(r*3.3))*smoothstep(1.8,1.,soft);
  return sq*(1.-.95*ring)*(1.-.55*wall)*(1.-.95*arm)*fres;
}
vec3 beamOf(vec2 vb){
  vec3 V=towardViewer();
  vec3 p0=onWallY(vb,uScreenY);
  float span=(uExit.y-uScreenY)/V.y;
  vec3 tint=vec3(0.);
  float j=hash12(gl_FragCoord.xy+fract(uTime*.13)*31.);
  for(int i=0;i<12;i++){
    float t=(float(i)+j)/12.*span;
    vec3 p=p0+t*V;
    float s=(uExit.y-p.y)/(uExit.y-uScreenY);
    vec2 c=mix(uExit.xz,uImg.xy,s);
    float hw=mix(5.,(uStage.z-uStage.x)*.5*uImg.z,s);
    vec2 d=(p.xz-c)/hw;
    float inside=window(d.x,-1.,1.,.06)*window(d.y,-1.,1.,.06)*smoothstep(.02,.12,s)*(1.-smoothstep(.93,1.,s));
    if(inside<.001)continue;
    vec2 st=vec2(d.x,-d.y)*(uStage.z-uStage.x)*.5;
    float lit=passOf(st,1.5);
    float r=length(st);
    if(r<uDish.x){field(twisted(st));lit*=clamp(1.-uFocus*(gX.x+gX.z)*.55,.15,3.);}
    float dust=.55+.45*noise3(vec3(p.x*.045,p.z*.045,p.y*.03+uTime*.06));
    tint+=gelAt(p)*inside*lit*dust;
  }
  return tint*(span/12.)*.0105;
}
vec3 motesOf(vec2 vb){
  vec3 sum=vec3(0.);
  float px=pixelOf();
  for(int i=0;i<7;i++){
    float y=mix(uExit.y-10.,uScreenY+8.,(float(i)+.5)/7.);
    vec3 p=onWallY(vb,y);
    float s=(uExit.y-y)/(uExit.y-uScreenY);
    vec2 c=mix(uExit.xz,uImg.xy,s);
    float hw=mix(5.,(uStage.z-uStage.x)*.5*uImg.z,s);
    vec2 d=(p.xz-c)/hw;
    float inside=window(d.x,-1.,1.,.1)*window(d.y,-1.,1.,.1);
    if(inside<.001)continue;
    vec2 g=(p.xz+vec2(6.*sin(uTime*.05+float(i)*1.7),-uTime*(1.2+.25*float(i))))/5.;
    vec2 cell=floor(g);
    float h=hash12(cell+float(i)*19.17);
    float keep=smoothstep(.955,.975,h);
    if(keep<.001)continue;
    vec2 o=vec2(hash12(cell+3.1),hash12(cell+7.7))*.6+.2;
    float r=length((fract(g)-o)*5.)/max(px*1.1,.35);
    float tw=.55+.45*sin(uTime*1.7+h*61.);
    sum+=gelAt(p)*inside*keep*tw*exp(-r*r)*.75;
  }
  return sum;
}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  float px=pixelOf();
  vec3 q=onWallY(vb,uScreenY);
  float fab=window(q.x,uScreen.x,uScreen.z,.7*px/uCam.x)*window(q.z,uScreen.y,uScreen.w,.7*px/uCam.w);
  vec3 col=vec3(0.);
  if(fab>.001){
    vec2 st=vec2(q.x-uImg.x,-(q.z-uImg.y))/uImg.z;
    float soft=max(.9,.8*px/uImg.z);
    vec3 light=vec3(1.);
    float r=length(st);
    float inside=1.-smoothstep(uDish.x-.8,uDish.x+.2,r);
    if(inside>.001)light=mix(light,causticOf(st),inside);
    float vig=1.-.32*dot(st,st)/(60.*60.);
    vec3 img=light*passOf(st,soft)*vig;
    float away=max(sdRect(st,uStage,2.),0.);
    vec3 spill=vec3(.05*exp(-away/16.)+.012*exp(-away/60.))*(1.-inRect(st,uStage,2.,soft));
    col=(img*1.05+spill)*gelAt(q)*uLamp*fab;
  }
  col+=(beamOf(vb)+motesOf(vb))*uLamp;
  // the lit screen throws a little of its colour back onto the bench in front of it
  vec3 f=onFloor(vb,0.);
  float ahead=f.y-uScreenY;
  float across=window(f.x,uScreen.x+20.,uScreen.z-20.,60.);
  float bounce=smoothstep(0.,6.,ahead)*exp(-max(ahead,0.)/85.)*across*step(f.y,uScreenY+260.);
  col+=gelAt(vec3(uImg.x,uScreenY,uImg.y))*bounce*(.05+.07*uLevel)*uLamp;
  col=finish(tonemap(col,1.25));
  gl_FragColor=vec4(col,max(col.r,max(col.g,col.b)));
}`;

// the stage seen from above: the lit Fresnel glass, the water's lens over it, and the glow rising to the head's lens
const STAGE_GLSL = `${FIELD}
uniform vec2 uLens;
float segDist(vec2 a,vec2 b){vec2 ab=b-a;float t=clamp(dot(-a,ab)/max(dot(ab,ab),1e-6),0.,1.);return length(a+ab*t);}
float coneOf(vec2 vb){
  float sum=0.;
  float j=hash12(gl_FragCoord.xy+fract(uTime*.29)*17.);
  for(int i=0;i<10;i++){
    float z=mix(uDishZ.w+2.,uLens.y,(float(i)+j)/10.);
    vec3 p=onFloor(vb,z);
    float s=(z-uStageZ)/(uLens.y-uStageZ);
    float hw=mix((uStage.z-uStage.x)*.5,uLens.x*.8,s);
    vec2 d=p.xy/hw;
    float inside=window(d.x,-1.,1.,.12)*window(d.y,-1.,1.,.12);
    float dust=.6+.4*noise3(vec3(p.xy*.06,z*.05-uTime*.05));
    sum+=inside*dust*(.5+.8*s*s);
  }
  return sum/10.;
}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  float px=pixelOf()/uCam.z;
  float soft=.7*px;
  vec3 lamp=vec3(1.,.95,.86);
  vec3 s=onFloor(vb,uStageZ);
  float glass=inRect(s.xy,uStage,2.,soft);
  vec3 a1=onFloor(vb,uStageZ);vec3 a2=onFloor(vb,uRingZ.y);vec3 a3=onFloor(vb,uDishZ.w);
  float open=smoothstep(uDish.z-soft,uDish.z+soft,segDist(a1.xy,a2.xy))*smoothstep(uDish.y-soft,uDish.y+soft,segDist(a2.xy,a3.xy));
  vec3 b0=onFloor(vb,uRingZ.x);vec3 b1=onFloor(vb,uRingZ.y);
  float armOpen=1.-max(window(b0.x,uArm.z,uArm.x,soft)*window(b0.y,-uArm.y,uArm.y,soft),window(b1.x,uArm.z,uArm.x,soft)*window(b1.y,-uArm.y,uArm.y,soft));
  float r0=length(s.xy);
  float rings=.93+.07*cos(r0*4.2)*smoothstep(.9,.45,px*4.2/6.2832);
  float vig=1.-.28*dot(s.xy,s.xy)/(44.*44.*2.);
  vec3 col=lamp*glass*open*armOpen*rings*vig*1.5;
  vec3 w=onFloor(vb,uDishZ.z);
  float water=1.-smoothstep(uDish.x-soft,uDish.x+soft,length(w.xy));
  if(water>.001){
    field(twisted(w.xy));
    float lens=clamp(1.-uFocus*.32*(gX.x+gX.z),.2,3.2);
    vec3 n=normalize(vec3(-gG,1.));
    float glint=pow(max(dot(reflect(-towardViewer(),n),normalize(vec3(-.3,.2,1.))),0.),40.)*.6;
    vec3 tint=mix(lamp,vec3(.78,.95,1.),.35);
    col=mix(col,tint*lens*1.3*vig+glint,water);
  }
  col*=uLamp;
  col+=mix(lamp,uGel,.2)*coneOf(vb)*.24*uLamp;
  col=finish(tonemap(col,1.3));
  gl_FragColor=vec4(col,max(col.r,max(col.g,col.b)));
}`;

const FIXED = {
  uStage: D.stage,
  uStageZ: D.stageZ,
  uDish: D.dish,
  uDishZ: D.dishZ,
  uRingZ: D.ringZ,
  uArm: D.arm,
  uScreen: D.screen,
  uScreenY: D.screenY,
  uImg: D.img,
  uExit: D.exit,
  uLens: D.lens,
  uBlur: 0.1,
  uEdge: D.dish[0] - 7,
  uDropK: [26, 0.62, 3.2],
  uWheel: D.wheel,
  uGels: D.gels,
};
const NAMES = ["uWave", "uOrder", "uTwist", "uFocus", "uDrop", "uGel", "uLamp", "uLevel", "uWheelA"];
const screenLayer = glLayer({ canvas: screenCanvas, fragment: SCREEN_GLSL, view: [D.W, D.H], camera: D.camera, uniforms: NAMES, fixed: FIXED, maxRatio: 1.25 });
const stageLayer = screenLayer ? glLayer({ canvas: stageCanvas, fragment: STAGE_GLSL, view: [D.W, D.H], camera: D.camera, uniforms: NAMES, fixed: FIXED, maxRatio: 1.25 }) : null;
const lit = !!(screenLayer && stageLayer);
if (lit) stage.setAttribute("data-gl", "");

// ------------------------------------------------------------ SVG parts that move
const NS = "http://www.w3.org/2000/svg";
const wheel = $('[data-live="wheel"]');
const needle = $('[data-live="needle"]');
const dialHost = $('[data-live="dial"]');
dialHost.innerHTML = '<path class="iso-line" data-tone="lit" data-free="" d=""/><g class="iso-dots" data-tone="hi"><circle r=".9"/></g>';
const dialLine = dialHost.firstChild;
const dialDot = dialHost.querySelector("circle");
const reels = D.reels.map((reel, i) => {
  const host = $(`[data-live="reel${i}"]`);
  const path = document.createElementNS(NS, "path");
  path.setAttribute("class", "iso-line");
  path.setAttribute("data-tone", "mid");
  host.appendChild(path);
  return { ...reel, path };
});
const lamps = [...stage.querySelectorAll("[data-lamp]")];
function reelWindows(reel, angle) {
  const z = D.deckTop + 3.4 + 0.02;
  const out = [];
  for (let j = 0; j < 3; j++) {
    const a0 = angle + (j / 3) * TAU + 0.34;
    const a1 = a0 + TAU / 3 - 0.68;
    const pts = [];
    for (let i = 0; i <= 10; i++) { const a = a0 + ((a1 - a0) * i) / 10; pts.push([reel.c[0] + 16.5 * Math.cos(a), reel.c[1] + 16.5 * Math.sin(a)]); }
    for (let i = 10; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / 10; pts.push([reel.c[0] + 7.5 * Math.cos(a), reel.c[1] + 7.5 * Math.sin(a)]); }
    out.push(onTop(pts, z, P, true));
  }
  return out.join("");
}

// ------------------------------------------------------------ state
const state = {
  hours: 1.6,
  target: 1.6,
  touring: !still.matches,
  music: 0,
  held: null,
  k: { x: M.waveNumber(55), v: 0 },
  height: { x: M.heightOf(M.level(1.6)), v: 0 },
  order: { x: M.orderOf(M.level(1.6)), v: 0 },
  spin: 0,
  breath: 0,
  wheel: 0.6,
  reel: [0, 0],
  lamp: 0,
  lampClock: 0,
  vu: 0,
  drops: [],
  nextDrop: 4,
};
let frame = 0;
let last = 0;
let visible = false;
let idle = 0;
let dirty = true;
let drawnKey = "";

const foldName = (n) => (n < 1.5 ? "stripes" : n < 2.5 ? "squares" : n < 3.5 ? "hexagons" : `${Math.round(n) * 2}-fold`);
function noteNow() {
  const step = M.bassAt(state.music);
  const hz = state.held ?? step.hz;
  return { step, hz };
}
function drop(u, v, strength = 1) {
  state.drops.push({ u, v, born: state.music, strength });
  if (state.drops.length > 4) state.drops.shift();
  run();
}
function uniforms() {
  const lvl = M.level(state.hours);
  const n = Math.min(6, state.order.x);
  const base = Math.min(6, Math.floor(n));
  const blend = base >= 6 ? 0 : n - base;
  const k = state.k.x;
  const drops = new Float32Array(16);
  state.drops.forEach((d, i) => {
    const age = Math.max(0, state.music - d.born);
    const strength = d.strength * burst(age, 0.05, 1.3) * 0.9;
    drops.set([d.u, d.v, age, strength], i * 4);
  });
  return {
    uWave: [k, state.height.x, 0.62 + 0.38 * Math.cos(state.breath), state.spin],
    uOrder: [base, ease(blend)],
    uTwist: M.twistOf(lvl),
    uFocus: 3.4 / (k * k),
    uDrop: drops,
    uGel: M.gelOf(state.wheel),
    uLamp: state.lamp,
    uLevel: lvl,
    uWheelA: state.wheel,
  };
}
const ease = (t) => t * t * (3 - 2 * t);

function say() {
  const { hz } = noteNow();
  const text = `${M.clock(state.hours)} · ${M.noteName(hz)} ${hz} Hz · λ ${(TAU / state.k.x).toFixed(1)} mm · ${foldName(state.order.x)}`;
  if (readout.textContent !== text) readout.textContent = text;
}
function describe() {
  const hours = state.touring ? state.hours : state.target;
  stage.setAttribute("aria-valuenow", String(Math.round(M.wrapHours(hours) * 60)));
  stage.setAttribute("aria-valuetext", `${M.clock(hours)} after drinking, ${foldName(M.orderOf(M.level(hours)))}`);
}

function drawSvg(bassSwell) {
  wheel.setAttribute("transform", `rotate(${((state.wheel * 180) / Math.PI).toFixed(2)})`);
  const gel = M.gelOf(state.wheel).map((v) => Math.round(v * 255));
  stage.style.setProperty("--vp-gel", `rgb(${gel.join(",")})`);
  const a = (M.wrapHours(state.hours) / M.SESSION) * TAU;
  const [cx, cy] = D.dial;
  dialLine.setAttribute("d", lineOnTop([cx + Math.sin(a) * 2.5, cy - Math.cos(a) * 2.5], [cx + Math.sin(a) * 12.8, cy - Math.cos(a) * 12.8], D.dialZ, P));
  const [dx, dy] = iso([cx + Math.sin(a) * 12.8, cy - Math.cos(a) * 12.8, D.dialZ], P);
  dialDot.setAttribute("cx", f1(dx));
  dialDot.setAttribute("cy", f1(dy));
  reels.forEach((reel, i) => reel.path.setAttribute("d", reelWindows(reel, state.reel[i])));
  const t = -0.85 + 1.7 * clampTo(bassSwell, 0, 1);
  needle.setAttribute("d", `M15 16L${f1(15 + 13 * Math.sin(t))} ${f1(16 - 13 * Math.cos(t))}`);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (sound.on && sound.ctx) state.music = sound.ctx.currentTime - sound.base;
  else if (!calm) state.music += dt;
  if (state.touring && !calm) {
    state.hours = M.wrapHours(state.hours + dt * 0.2);
    state.target = state.hours;
    state.nextDrop -= dt;
    if (state.nextDrop <= 0) {
      state.nextDrop = 5 + Math.random() * 4;
      const a = Math.random() * TAU;
      const r = 6 + Math.random() * 20;
      drop(r * Math.cos(a), r * Math.sin(a), 0.7);
    }
  } else {
    state.hours = calm ? state.target : state.hours + (state.target - state.hours) * (1 - Math.exp(-dt / 0.3));
    if (Math.abs(state.hours - state.target) < 1e-4) state.hours = state.target;
  }
  const lvl = M.level(state.hours);
  const { step, hz } = noteNow();
  const moving = [
    settle(state.k, M.waveNumber(hz), dt, 0.45, calm),
    settle(state.height, M.heightOf(lvl), dt, 0.5, calm),
    settle(state.order, M.orderOf(lvl), dt, 0.7, calm),
  ].some(Boolean);
  if (!calm) {
    state.spin += dt * M.spinOf(lvl);
    state.breath += dt * (Math.PI / M.BEAT) * 0.5;
    state.wheel += dt * (0.1 + 0.25 * lvl);
    state.reel[0] += dt * (95 / D.reels[0].pack);
    state.reel[1] += dt * (95 / D.reels[1].pack);
  }
  state.lampClock += dt;
  state.lamp = calm ? 1 : ease(clampTo((state.lampClock - 0.2) / 1.2, 0, 1));
  state.drops = state.drops.filter((d) => state.music - d.born < 4.5);
  const swell = state.held !== null ? 0.8 : M.swellOf(step);
  state.vu += (swell * (0.5 + 0.5 * lvl) - state.vu) * (1 - Math.exp(-dt / 0.25));
  const values = uniforms();
  const key = calm ? JSON.stringify([values.uWave, values.uOrder, values.uGel, values.uLamp, values.uTwist, state.hours]) : "";
  if (!calm || key !== drawnKey || dirty) {
    drawnKey = key;
    drawSvg(state.vu);
    if (lit) {
      screenLayer.draw(values, calm ? 0.8 : state.lampClock);
      stageLayer.draw(values, calm ? 0.8 : state.lampClock);
    }
    say();
  }
  dirty = false;
  const settled = calm && !moving && state.hours === state.target && state.lamp === 1;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);
window.addEventListener("resize", () => {
  dirty = true;
  run();
});

// ------------------------------------------------------------ input
function hold() {
  state.touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => {
    if (still.matches) return;
    state.touring = true;
    state.held = null;
    run();
  }, 4500);
  run();
}
const viewBoxOf = (event) => {
  const box = stage.getBoundingClientRect();
  return [((event.clientX - box.left) / box.width) * D.W, ((event.clientY - box.top) / box.height) * D.H, box];
};
const cam = D.camera;
function onFloorJs([vx, vy], h) {
  const qx = (vx - cam.origin[0]) / cam.k;
  const qy = (vy - cam.origin[1]) / cam.k;
  const [sA, cA, sE, cE] = cam.cam;
  const b = (qy + h * cE) / sE;
  return [qx * sA + b * cA, -qx * cA + b * sA, h];
}
function onWallYJs([vx, vy], y) {
  const qx = (vx - cam.origin[0]) / cam.k;
  const qy = (vy - cam.origin[1]) / cam.k;
  const [sA, cA, sE, cE] = cam.cam;
  const x = (qx + y * cA) / sA;
  return [x, y, ((x * cA + y * sA) * sE - qy) / cE];
}
function aim(event) {
  const [vx, vy, box] = viewBoxOf(event);
  const fx = clampTo(((event.clientX - box.left) / box.width - 0.08) / 0.84, 0, 1);
  const fy = clampTo(((event.clientY - box.top) / box.height - 0.12) / 0.76, 0, 1);
  state.target = fx * (M.SESSION - 1 / 60);
  state.held = M.PITCHES[Math.round((1 - fy) * (M.PITCHES.length - 1))];
  void vx;
  void vy;
  hold();
}
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch" && !event.buttons) return;
  aim(event);
});
stage.addEventListener("pointerdown", (event) => {
  const [vx, vy] = viewBoxOf(event);
  const water = onFloorJs([vx, vy], D.dishZ[2]);
  if (Math.hypot(water[0], water[1]) < D.dish[0] - 2) return drop(water[0], water[1], 1.1), hold();
  const wall = onWallYJs([vx, vy], D.screenY);
  const u = (wall[0] - D.img[0]) / D.img[2];
  const v = -(wall[2] - D.img[1]) / D.img[2];
  if (Math.hypot(u, v) < D.dish[0] - 2) return drop(u, v, 1.1), hold();
  if (event.pointerType === "touch") aim(event);
});
stage.addEventListener("pointerleave", () => hold());
stage.addEventListener("keydown", (event) => {
  const big = event.shiftKey ? 1 : 0.25;
  const pitchIndex = M.PITCHES.indexOf(state.held ?? noteNow().hz);
  if (state.touring) state.target = state.hours;
  if (event.key === "ArrowRight") state.target = Math.min(M.SESSION - 1 / 60, state.target + big);
  else if (event.key === "ArrowLeft") state.target = Math.max(0, state.target - big);
  else if (event.key === "ArrowUp") state.held = M.PITCHES[Math.min(M.PITCHES.length - 1, Math.max(0, pitchIndex) + 1)];
  else if (event.key === "ArrowDown") state.held = M.PITCHES[Math.max(0, pitchIndex - 1)];
  else if (event.key === "Home") state.target = 0;
  else if (event.key === "End") state.target = M.SESSION - 1 / 60;
  else if (event.key === "Enter") drop((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 1.1);
  else if (event.key === " ") toggleSound();
  else if (event.key === "Escape") {
    state.held = null;
    state.touring = !still.matches;
    clearTimeout(idle);
    run();
    return event.preventDefault();
  } else return;
  event.preventDefault();
  hold();
  describe();
});
stage.addEventListener("focus", () => describe());

// ------------------------------------------------------------ sound: the tape's bass line, a whistled tune above it, a leaf rattle
const sound = { ctx: null, on: false, base: 0, master: null, dry: null, wet: null, noise: null, bassAt: -1, tuneAt: -1, beat: -1, pump: 0, tone: null };
function audioSetup() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0;
  const squeeze = ctx.createDynamicsCompressor();
  squeeze.threshold.value = -16;
  squeeze.ratio.value = 3;
  master.connect(squeeze).connect(ctx.destination);
  const dry = ctx.createGain();
  dry.gain.value = 0.8;
  dry.connect(master);
  const verb = ctx.createConvolver();
  const length = Math.floor(ctx.sampleRate * 3.2);
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
  }
  verb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.38;
  wet.connect(verb).connect(master);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 400;
  tone.Q.value = 2;
  tone.connect(dry);
  tone.connect(wet);
  Object.assign(sound, { ctx, master, dry, wet, noise, tone });
}
function bassNote(f, t0, dur) {
  const { ctx } = sound;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.18);
  gain.gain.setValueAtTime(0.22, Math.max(t0 + 0.2, t0 + dur - 0.3));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.25);
  gain.connect(sound.tone);
  for (const [mult, level, type] of [[1, 0.9, "triangle"], [2, 0.4, "sine"], [3, 0.18, "sine"], [1.003, 0.35, "sawtooth"]]) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = f * mult;
    const g = ctx.createGain();
    g.gain.value = level * (type === "sawtooth" ? 0.25 : 1);
    osc.connect(g).connect(gain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.4);
  }
}
function whistle(f, t0, dur) {
  const { ctx } = sound;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(f * 0.982, t0);
  osc.frequency.exponentialRampToValueAtTime(f, t0 + 0.07);
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.1;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, t0);
  depth.gain.linearRampToValueAtTime(f * 0.005, t0 + Math.min(0.4, dur));
  vib.connect(depth).connect(osc.frequency);
  const gain = ctx.createGain();
  const end = t0 + dur;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.11, t0 + 0.07);
  gain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.3);
  gain.gain.setValueAtTime(0.08, Math.max(t0 + 0.31, end - 0.12));
  gain.gain.exponentialRampToValueAtTime(0.0001, end + 0.06);
  osc.connect(gain);
  gain.connect(sound.dry);
  gain.connect(sound.wet);
  for (const node of [osc, vib]) {
    node.start(t0);
    node.stop(end + 0.2);
  }
}
function rattle(t0, strength) {
  const { ctx } = sound;
  const src = ctx.createBufferSource();
  src.buffer = sound.noise;
  const high = ctx.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 2600;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 5200;
  band.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.045 * strength, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  src.connect(high).connect(band).connect(gain);
  gain.connect(sound.dry);
  gain.connect(sound.wet);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + 0.2);
}
function scheduleList(list, total, at, lastKey, play) {
  const now = sound.ctx.currentTime - sound.base;
  const ahead = now + 0.3;
  const span = total * M.BEAT;
  const loop = Math.floor(now / span);
  let keyOut = lastKey;
  for (const offset of [0, 1]) {
    let start = (loop + offset) * span;
    for (let index = 0; index < list.length; index++) {
      const [hz, beats] = list[index];
      const key = (loop + offset) * list.length + index;
      if (start > now - 0.02 && start < ahead && key > keyOut) {
        play(hz, sound.base + start, beats * M.BEAT);
        keyOut = key;
      }
      start += beats * M.BEAT;
    }
  }
  return keyOut;
}
function schedule() {
  if (!sound.on) return;
  const { ctx } = sound;
  const lvl = M.level(state.hours);
  sound.tone.frequency.setTargetAtTime(260 + 2200 * lvl * lvl, ctx.currentTime, 0.4);
  sound.bassAt = scheduleList(M.BASS, M.BASS_BEATS, 0, sound.bassAt, (hz, t0, dur) => bassNote(state.held ?? hz, t0, dur - 0.05));
  sound.tuneAt = scheduleList(M.TUNE, M.TUNE_BEATS, 0, sound.tuneAt, (hz, t0, dur) => lvl > 0.08 && whistle(hz, t0, dur - 0.04));
  const now = ctx.currentTime - sound.base;
  let beat = Math.max(sound.beat, Math.ceil((now / M.BEAT) * 2) / 2);
  while (beat * M.BEAT < now + 0.3) {
    rattle(sound.base + beat * M.BEAT, Number.isInteger(beat) ? 1 : 0.55);
    beat += 0.5;
  }
  sound.beat = beat;
}
async function toggleSound() {
  if (!sound.ctx) audioSetup();
  const { ctx } = sound;
  if (!sound.on) {
    await ctx.resume();
    sound.base = ctx.currentTime - state.music;
    const keyNow = (list, total) => Math.floor((state.music + 1e-3) / (total * M.BEAT)) * list.length + (list === M.BASS ? M.bassAt(state.music).index : M.tuneAt(state.music).index) - 1;
    sound.bassAt = keyNow(M.BASS, M.BASS_BEATS);
    sound.tuneAt = keyNow(M.TUNE, M.TUNE_BEATS) + 1;
    sound.beat = Math.ceil((state.music / M.BEAT) * 2) / 2;
    sound.on = true;
    sound.master.gain.cancelScheduledValues(ctx.currentTime);
    sound.master.gain.setTargetAtTime(0.85, ctx.currentTime, 0.1);
    sound.pump = setInterval(schedule, 60);
    schedule();
  } else {
    sound.on = false;
    clearInterval(sound.pump);
    sound.master.gain.cancelScheduledValues(ctx.currentTime);
    sound.master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
  }
  const button = document.querySelector('[data-action="sound"]');
  if (button) button.setAttribute("aria-pressed", String(sound.on));
  for (const node of lamps) node.toggleAttribute("data-on", sound.on);
  run();
}
const soundButton = document.querySelector('[data-action="sound"]');
if (soundButton) soundButton.addEventListener("click", () => toggleSound());
const fullButton = document.querySelector('[data-action="full"]');
if (fullButton) fullButton.addEventListener("click", () => {
  const root = document.querySelector(".vp-wrap");
  if (document.fullscreenElement) document.exitFullscreen();
  else if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
});

if (still.matches) state.touring = false;
drawSvg(0.5);
say();
describe();
