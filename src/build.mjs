import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../anatomy-main/kit/iso-kit.mjs";
import * as G from "../anatomy-main/kit/lathe.mjs";
import { glCamera } from "../anatomy-main/kit/gl.mjs";
import { tubePieces, tubeSvg } from "../anatomy-main/kit/tube.mjs";
import * as A from "../anatomy-main/kit/audit.mjs";
import { kitScript, glScript } from "../anatomy-main/scripts/inline-kit.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "vision-projector.html");

const W = 760;
const H = 590;
const AZ = 50;
const EL = 27;

// world units: millimetres. x along the bench, y toward the viewer, z up.
const BENCH = { x: -240, y: -142, w: 500, d: 274, r: 10 };
const BENCH_H = 14;
const FOOT_H = 6;
const SCREEN = { x0: -150, x1: 230, y: -121, z0: 52, z1: 300 };
const POSTS = [SCREEN.x0 - 6, SCREEN.x1 + 6]; // the fabric's face
const OHP = { x: -54, y: -54, w: 108, d: 108, r: 4 };
const OHP_TOP = 44;
const STAGE = { x: -44, y: -44, w: 88, d: 88, r: 2 };
const DISH = { r: 34, outer: 35.2, z0: 47, floor: 48.5, water: 51.5, rim: 53.5 };
const RING = { rIn: 31, rOut: 39, z0: 45, z1: 47 };
const SHAKER = [-86, 0];
const POST = [64, 0];
const HEAD = { x0: -22, x1: 22, y0: -22, y1: 22, z0: 150, z1: 184 };
const LENS = { r: 12, z0: 134, z1: 150 };
const EXIT = [0, HEAD.y0, 167];
const IMG = { x: 40, z: 177, m: 2.75 }; // the stage's image on the screen: centre and magnification
const WHEEL = { c: [14, -26.3, 192], r: 46, face: -25.6, back: -27 };
const DECK = { x: -232, y: -8, w: 118, d: 126, r: 4 };
const DECK_TOP = 28;
const AMP = { x: 102, y: 30, w: 92, d: 80, r: 3 };
const AMP_TOP = 34;
const DIAL = [158, 66];
const STRIP = { x: -232, y: -124, w: 60, d: 18, r: 2 };

const P = k.fitProjection(
  [...k.boxCorners(BENCH, -BENCH_H - FOOT_H, 0), [POSTS[0] - 6, SCREEN.y, SCREEN.z1 + 12], [POSTS[1] + 6, SCREEN.y, SCREEN.z1 + 12], [WHEEL.c[0] + WHEEL.r, WHEEL.face, WHEEL.c[2] + WHEEL.r]],
  W,
  H,
  { pad: 22, azimuth: AZ, elevation: EL },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const Faded = (list, style) => k.fadedSvg(list, style);
const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
const f2 = (v) => Math.round(v * 100) / 100;
const UP = [0, 0, 1];
const zFrame = (x, y) => G.frameOf([x, y, 0], UP, [1, 0, 0], [0, 1, 0]);
const screws = (points, size = 0.45) => Dots(points.map(at), { size });

// ---------------------------------------------------------------- recorder: every drawn item, with its true shape and its layer
// back: behind the screen's light; mid: covers the screen's light; front: covers the stage's light.
const R = A.recorder(P);
const record = R.solid;
let LAYER = "mid";
function put(name, ref, svg, shapes = [], { bias = 0, layer = LAYER, ...rest } = {}) {
  return R.put({ name, at: ref, bias, svg, shapes, piece: "rig", layer, ...rest });
}
function box(name, [x0, y0, z0], [x1, y1, z1], style = {}, { r = 0.4, steps = 2, bevel = 0, extra = "", inner = "", bias = 0, attrs, layer, owner } = {}) {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r };
  const shape = record(A.slab(plan, z0, z1 - z0, { name, owner }, steps));
  put(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias, attrs, layer });
  return shape;
}
function turned(name, F, profile, style = {}, { extra = "", inner = "", bias = 0, steps, bevel = 0, owner, attrs, layer, live } = {}) {
  const paths = G.solidOf(profile, F, P, { bevel, ...(steps ? { steps } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const shape = record(A.solid(F, profile, { name, owner }));
  const body = S(paths, { tone: "mid", ...style, inner }) + extra;
  put(name, G.add3(F.o, G.mul3(F.a, mid)), live ? `<g data-live="${live}">${body}</g>` : body, [shape], { bias, attrs, layer });
  return shape;
}
const disc = (name, F, s0, s1, r, style = {}, options = {}) => turned(name, F, [[s0, r], [s1, r]], style, options);
function planeMatrix(o, ex, ey) {
  const p0 = at(o);
  const px = at(G.add3(o, ex));
  const py = at(G.add3(o, ey));
  const v = (x) => x.toFixed(4);
  return `matrix(${v(px[0] - p0[0])} ${v(px[1] - p0[1])} ${v(py[0] - p0[0])} ${v(py[1] - p0[1])} ${p0[0].toFixed(2)} ${p0[1].toFixed(2)})`;
}
const CABLES = [];
function cable(name, points, r = 1, { tone = "mid", bend = 3, shells = [true, true], maxLength = 14, bias = 0.05, layer } = {}) {
  const route = G.fillet(points, Math.max(bend, r * 2.6), 10, { P, tube: r });
  const total = G.pathLength(route);
  const SHELL = Math.max(2.4, r * 2.6);
  const gaps = [...(shells[0] ? [[0, SHELL]] : []), ...(shells[1] ? [[total - SHELL, total]] : [])];
  R.route(name, route, r, { gaps, limp: true, touch: ["stand.bench"], rims: shells.map((on) => (on ? r * 1.9 : r)), piece: "rig" });
  CABLES.push(name);
  tubePieces(route, r, P, { maxLength, spacing: Math.max(0.6, Math.min(1.6, r)), gaps }).forEach((piece, index) =>
    put(`${name}:${index}`, piece.mid, tubeSvg(piece, { tone }), [A.tube(piece.points, piece.radii)], { bias, route: name, chunk: index, layer }),
  );
  [0, 1].forEach((index) => {
    if (!shells[index]) return;
    const end = index ? route[route.length - 1] : route[0];
    const tangent = G.tangentAlong(route, index ? total : 0);
    const F = G.frameAlong(end, tangent);
    const [s0, s1] = index ? [-SHELL, 0] : [0, SHELL];
    const shape = record(A.disc(F, s0, s1, r * 1.9, { name: `${name}.shell${index}`, owner: name }));
    const strain = G.arcOf(F, index ? s0 + 0.9 : s1 - 0.9, r * 1.9, P);
    put(`${name}.shell${index}`, G.add3(end, G.mul3(tangent, (s0 + s1) / 2)), S(G.disc(s0, s1, r * 1.9, F, P, { steps: 24, bevel: 0.2 }), { tone: "mid", inner: Ln(strain, { tone: "faint" }) }), [shape], { bias: bias + 0.1, layer });
  });
  return route;
}

// ---------------------------------------------------------------- bench (unsorted, first)
const bench = [];
bench.push(`<path class="iso-halo" d="${k.haloOf(BENCH, -BENCH_H - FOOT_H, BENCH_H, P)}"/>`);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
for (const [x, y] of byDepth(k.corners(BENCH, 24))) {
  bench.push(S(k.cylinder(x, y, 8, -BENCH_H - FOOT_H, 1.8, P, 28), { tone: "lo" }));
  bench.push(S(k.cylinder(x, y, 6, -BENCH_H - FOOT_H + 1.8, FOOT_H - 1.8, P, 28), { tone: "mid" }));
}
bench.push(S(k.slabOf(BENCH, -BENCH_H, BENCH_H, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(BENCH, -5, P, 8), { tone: "faint" }) }));
bench.push(Ln(k.planOutline(k.insetPlan(BENCH, 5), 0, P), { tone: "lo" }));
const benchScrews = k.corners(BENCH, 11);
bench.push(Ln(benchScrews.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
bench.push(Dots(benchScrews.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));
record(A.slab(BENCH, -BENCH_H, BENCH_H, { name: "stand.bench", ground: true }, 8));
const LABEL = { x: -40, y: 94, w: 46, d: 16, r: 1.4 };
bench.push(S(k.slabOf(LABEL, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
bench.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.5), 0.8, P, 3), { tone: "faint" }));
bench.push(Ln([30, 22, 26].map((w, i) => k.lineOnTop([LABEL.x + 4.5, LABEL.y + 4 + i * 3.8], [LABEL.x + 4.5 + w, LABEL.y + 4 + i * 3.8], 0.8, P)).join(""), { tone: "lo", free: true }));
bench.push(Dots([at([LABEL.x + LABEL.w - 3, LABEL.y + 3, 0.8]), at([LABEL.x + LABEL.w - 3, LABEL.y + LABEL.d - 3, 0.8])], { size: 0.45 }));
bench.push(`<path class="iso-halo vp-halo" d="${k.haloOf(k.insetPlan(OHP, 3), 0, 2, P)}"/>`);
bench.push(`<path class="iso-halo vp-halo" d="${k.haloOf(k.insetPlan(DECK, 3), 0, 2, P)}"/>`);
bench.push(`<path class="iso-halo vp-halo" d="${k.haloOf(k.insetPlan(AMP, 3), 0, 2, P)}"/>`);

// ---------------------------------------------------------------- the screen: the vision lands here
LAYER = "back";
for (const sx of POSTS) {
  box("screen.foot", [sx - 5, -138, 0], [sx + 5, -104, 6], { tone: "lo" }, { r: 1.2, steps: 3, bevel: 0.4, extra: screws([[sx, -134, 6], [sx, -108, 6]], 0.5) });
  disc("screen.collar", zFrame(sx, -121), 6, 12, 6, { tone: "mid" }, { bevel: 0.3 });
  disc("screen.upright", zFrame(sx, -121), 12, SCREEN.z1 + 8, 4, { tone: "mid" }, { inner: Ln(G.arcOf(zFrame(sx, -121), SCREEN.z0 - 8, 4, P) + G.arcOf(zFrame(sx, -121), SCREEN.z1 + 6, 4, P), { tone: "faint" }) });
  disc("screen.cap", zFrame(sx, -121), SCREEN.z1 + 8, SCREEN.z1 + 11, 5, { tone: "mid" }, { bevel: 0.3 });
}
box("screen.top", [POSTS[0] + 4, -125, SCREEN.z1], [POSTS[1] - 4, -117, SCREEN.z1 + 6], { tone: "mid" }, { r: 1, bevel: 0.4 });
box("screen.bottom", [POSTS[0] + 4, -125, SCREEN.z0 - 6], [POSTS[1] - 4, -117, SCREEN.z0], { tone: "mid" }, { r: 1, bevel: 0.4 });
{
  // the fabric, a dark matte sheet laced into the frame; grommets along its edges
  const F = { x: SCREEN.x0, y: -123, w: SCREEN.x1 - SCREEN.x0, d: 2, r: 0 };
  const shape = record(A.slab(F, SCREEN.z0, SCREEN.z1 - SCREEN.z0, { name: "screen.fabric" }, 1));
  const face = [[SCREEN.x0, SCREEN.y, SCREEN.z0], [SCREEN.x1, SCREEN.y, SCREEN.z0], [SCREEN.x1, SCREEN.y, SCREEN.z1], [SCREEN.x0, SCREEN.y, SCREEN.z1]];
  const grommets = [];
  for (let x = SCREEN.x0 + 10; x <= SCREEN.x1 - 9; x += 18) grommets.push([x, SCREEN.y, SCREEN.z0 + 3], [x, SCREEN.y, SCREEN.z1 - 3]);
  for (let z = SCREEN.z0 + 16; z <= SCREEN.z1 - 15; z += 18) grommets.push([SCREEN.x0 + 3, SCREEN.y, z], [SCREEN.x1 - 3, SCREEN.y, z]);
  const fallback = (() => {
    // no-WebGL: the stage's square of light, the ring's shadow and a still twelve-fold figure, on the fabric
    const img = (u, v) => [IMG.x + u * IMG.m, SCREEN.y + 0.05, IMG.z - v * IMG.m];
    const sq = path3([img(-44, -44), img(44, -44), img(44, 44), img(-44, 44)], true);
    const circle = (r) => path3(Array.from({ length: 97 }, (_, i) => img(r * Math.cos((i / 96) * Math.PI * 2), r * Math.sin((i / 96) * Math.PI * 2))), true);
    const lines = [];
    for (let j = 0; j < 12; j++) {
      const a = (j / 12) * Math.PI;
      for (const o of [-18, -9, 0, 9, 18]) {
        const half = Math.sqrt(Math.max(0, 33 * 33 - o * o));
        const e = [Math.cos(a), Math.sin(a)];
        const n = [-e[1], e[0]];
        lines.push(path3([img(n[0] * o - e[0] * half, n[1] * o - e[1] * half), img(n[0] * o + e[0] * half, n[1] * o + e[1] * half)]));
      }
    }
    return `<g class="vp-fallback"><path class="vp-fb-light" d="${sq}"/><path class="vp-fb-ring" d="${circle(39)}${circle(35.2)}"/><path class="vp-fb-dish" d="${circle(34)}"/><path class="vp-fb-lines" d="${lines.join("")}"/></g>`;
  })();
  put("screen.fabric", [0, -122, (SCREEN.z0 + SCREEN.z1) / 2], `<path class="vp-fabric" d="${path3(face, true)}"/>${Dots(grommets.map(at), { size: 0.7, tone: "mid" })}${fallback}`, [shape], { bias: -0.2 });
}

// ---------------------------------------------------------------- power strip at the back
LAYER = "mid";
box("strip", [STRIP.x, STRIP.y, 0], [STRIP.x + STRIP.w, STRIP.y + STRIP.d, 9], { tone: "mid" }, {
  r: 2,
  steps: 3,
  bevel: 0.4,
  extra:
    Ln([0, 1, 2].map((i) => k.planOutline({ x: STRIP.x + 6 + i * 15, y: STRIP.y + 4, w: 10, d: 10, r: 2 }, 9, P, 3)).join(""), { tone: "lo" }) +
    Dots([0, 1, 2].flatMap((i) => [at([STRIP.x + 9 + i * 15, STRIP.y + 9, 9]), at([STRIP.x + 13 + i * 15, STRIP.y + 9, 9])]), { size: 0.55, tone: "lo" }),
});
box("strip.switch", [STRIP.x + 50, STRIP.y + 5, 9], [STRIP.x + 56, STRIP.y + 13, 11], { tone: "hi" }, { r: 1 });

// ---------------------------------------------------------------- the overhead projector
for (const [x, y] of k.corners(OHP, 10)) disc("ohp.foot", zFrame(x, y), 0, 6, 4.5, { tone: "lo" });
{
  const vents = Array.from({ length: 9 }, (_, i) => path3([[-40 + i * 8, OHP.y + OHP.d, 14], [-36 + i * 8, OHP.y + OHP.d, 14], [-36 + i * 8, OHP.y + OHP.d, 30], [-40 + i * 8, OHP.y + OHP.d, 30]], true)).join("");
  const side = Array.from({ length: 7 }, (_, i) => path3([[OHP.x, -36 + i * 9, 14], [OHP.x, -32 + i * 9, 14], [OHP.x, -32 + i * 9, 32], [OHP.x, -36 + i * 9, 32]], true)).join("");
  box("ohp.body", [OHP.x, OHP.y, 6], [OHP.x + OHP.w, OHP.y + OHP.d, OHP_TOP], { tone: "mid" }, {
    r: OHP.r,
    steps: 4,
    bevel: 0.6,
    inner: Ln(k.sideSeam(OHP, 10, P, 4), { tone: "faint" }),
    extra:
      `<path class="vp-glass" d="${k.planOutline(STAGE, OHP_TOP + 0.02, P, 3)}"/>` +
      Ln(k.planOutline(k.insetPlan(STAGE, -3), OHP_TOP, P, 3), { tone: "lo" }) +
      Ln(k.planOutline(STAGE, OHP_TOP, P, 3), { tone: "mid" }) +
      screws(k.corners(OHP, 5).map(([x, y]) => [x, y, OHP_TOP]), 0.55) +
      Ln(vents, { tone: "faint" }) +
      Ln(side, { tone: "faint" }),
  });
}
box("ohp.switch.plate", [24, OHP.y + OHP.d, 14], [44, OHP.y + OHP.d + 1, 28], { tone: "lo" }, { r: 1 });
box("ohp.switch", [30, OHP.y + OHP.d + 1, 17], [38, OHP.y + OHP.d + 3.2, 25], { tone: "hi" }, { r: 0.8 });
disc("ohp.grommet", G.frameAlong([-30, OHP.y, 14], [0, -1, 0]), 0, 2, 3.4, { tone: "lo" });
box("ohp.bracket", [OHP.x + OHP.w, -8, 22], [70, 8, 38], { tone: "mid" }, { r: 1, bevel: 0.4, extra: screws([[60, 8, 26], [60, 8, 34]], 0.4) });

// the dish, its holder ring and the shaker that drives it
const DF = zFrame(0, 0);
LAYER = "mid";
disc("dish.ring", DF, RING.z0, RING.z1, RING.rOut, { tone: "mid" }, { layer: "mid", extra: Ln(G.circleOf(DF, RING.z1, RING.rIn + 1.6, P), { tone: "faint" }) + Dots(G.dotsOf(DF, RING.z1, 37.3, 12, P, { all: true, phase: 0.26 }), { size: 0.45 }) });
const SH = zFrame(...SHAKER);
disc("shaker.flange", SH, 0, 3, 20, { tone: "lo" }, { extra: Dots(G.dotsOf(SH, 3, 17.6, 6, P, { all: true, phase: 0.5 }), { size: 0.5 }) });
turned("shaker.body", SH, [[3, 15], [36, 15]], { tone: "mid" }, { extra: Faded(G.ribsOf(SH, 8, 31, 15, 52, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) });
disc("shaker.cap", SH, 36, 40, 11, { tone: "mid" }, { bevel: 0.3 });
disc("shaker.armature", SH, 40, 43, 3.2, { tone: "hi" });
box("shaker.mount", [SHAKER[0] - 6, -5, 43], [SHAKER[0] + 6, 5, 47], { tone: "mid" }, { r: 0.8, extra: screws([[SHAKER[0] - 3, 0, 47], [SHAKER[0] + 3, 0, 47]], 0.45) });
const ARM_END = -Math.sqrt(RING.rOut * RING.rOut - 16);
box("shaker.arm", [SHAKER[0] + 6, -4, RING.z0], [ARM_END, 4, RING.z1], { tone: "mid" }, { r: 0.5, layer: "mid" });
const SBOSS = G.frameAlong([SHAKER[0], Math.sqrt(15 * 15 - 3.4 * 3.4), 14], [0, 1, 0]);
disc("shaker.boss", SBOSS, 0, 3.4, 3.4, { tone: "mid" });
disc("shaker.socket", SBOSS, 3.4, 5, 2.8, { tone: "mid" });
const SHAKER_IN = G.pointOf(SBOSS, 5, 0, 0);

// the dish: glass, drawn as its far wall (under the water's light) and its near wall and rim (over it)
{
  const ring3 = (r, z, from = 0, to = Math.PI * 2, n = 96) => Array.from({ length: n + 1 }, (_, i) => { const a = from + ((to - from) * i) / n; return [r * Math.cos(a), r * Math.sin(a), z]; });
  // which half of a circle faces the viewer: angle of the viewer's floor direction
  const face = Math.atan2(V[1], V[0]);
  const near0 = face - Math.PI / 2;
  const near1 = face + Math.PI / 2;
  const far0 = near1;
  const far1 = near0 + Math.PI * 2;
  const backWall = path3([...ring3(DISH.r, DISH.rim, far0, far1, 64), ...ring3(DISH.r, DISH.water, far1, far0, 64)], true);
  const meniscus = path3(ring3(DISH.r, DISH.water, far0, far1, 64));
  const backShape = record(A.ring(DF, DISH.z0, DISH.rim, DISH.r, DISH.outer, { name: "dish.wall", owner: "dish" }));
  put("dish.far", [0, -20, DISH.rim - 2], `<path class="vp-glass-wall" d="${backWall}"/>${Ln(meniscus, { tone: "mid" })}`, [backShape], { bias: -1, layer: "mid" });
  const outerFront = [...ring3(DISH.outer, DISH.rim, near0, near1, 64), ...ring3(DISH.outer, DISH.z0, near1, near0, 64)];
  const rimTop = path3([...ring3(DISH.outer, DISH.rim, 0, Math.PI * 2, 128)], true) + path3([...ring3(DISH.r, DISH.rim, 0, Math.PI * 2, 128)], true);
  const silhouette = path3([...ring3(DISH.outer, DISH.rim, near1, near0 + Math.PI * 2, 64)]) + path3([ring3(DISH.outer, DISH.rim, near0, near0, 1)[0], ring3(DISH.outer, DISH.z0, near0, near0, 1)[0], ...ring3(DISH.outer, DISH.z0, near0, near1, 64), ring3(DISH.outer, DISH.rim, near1, near1, 1)[0]]);
  const glint = path3(ring3(DISH.outer - 0.2, (DISH.rim + DISH.z0) / 2 + 1.5, face - 0.9, face - 0.35, 12));
  const frontShape = record(A.disc(DF, DISH.z0, DISH.floor, DISH.outer, { name: "dish.floor", owner: "dish" }));
  put("dish.near", [0, 24, DISH.z0 + 2], `<path class="vp-glass-wall vp-glass-near" d="${path3(outerFront, true)}"/><path class="vp-glass-rim" fill-rule="evenodd" d="${rimTop}"/>${Ln(silhouette, { tone: "hi" })}${Ln(path3(ring3(DISH.r, DISH.rim, 0, Math.PI * 2, 128), true), { tone: "mid" })}${Ln(glint, { tone: "lit", free: true })}`, [frontShape], { bias: 2, layer: "front" });
}

// post, carriage, arm and head
const PF = zFrame(...POST);
disc("ohp.post", PF, 38, 120, 3.4, { tone: "hi" }, { layer: "front", inner: Ln(G.arcOf(PF, 60, 3.4, P) + G.arcOf(PF, 100, 3.4, P), { tone: "faint" }) });
box("ohp.carriage", [POST[0] - 6, -6, 120], [POST[0] + 6, 6, 132], { tone: "mid" }, { r: 1, bevel: 0.4, layer: "front" });
const FK = G.frameOf([POST[0], 6, 126], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
disc("ohp.focus", FK, 0, 5, 4.2, { tone: "mid" }, { layer: "front", extra: Faded(G.ribsOf(FK, 0.6, 5, 4.2, 24, P, { fade: [0.1, 0.55], seams: "last" }), { tone: "lo" }) });
disc("ohp.post.top", PF, 132, 174, 3.4, { tone: "hi" }, { layer: "front" });
box("ohp.arm", [HEAD.x1, -6, 174], [POST[0] + 4, 6, 182], { tone: "mid" }, { r: 1, bevel: 0.4, layer: "front", extra: screws([[POST[0], -3, 182], [POST[0], 3, 182]], 0.45) });
{
  const vents = Array.from({ length: 5 }, (_, i) => k.planOutline({ x: -14 + i * 6.4, y: -12, w: 3, d: 24, r: 1.5 }, HEAD.z1, P, 3)).join("");
  box("ohp.head", [HEAD.x0, HEAD.y0, HEAD.z0], [HEAD.x1, HEAD.y1, HEAD.z1], { tone: "mid" }, {
    r: 3,
    steps: 4,
    bevel: 0.6,
    layer: "front",
    inner: Ln(k.sideSeam({ x: HEAD.x0, y: HEAD.y0, w: 44, d: 44, r: 3 }, 158, P, 4), { tone: "faint" }),
    extra: Ln(vents, { tone: "faint" }) + screws(k.corners({ x: HEAD.x0, y: HEAD.y0, w: 44, d: 44 }, 4).map(([x, y]) => [x, y, HEAD.z1]), 0.45),
  });
}
const LF = zFrame(0, 0);
disc("ohp.lens.glass", LF, LENS.z0 - 1.6, LENS.z0, 10, { tone: "hi" }, { layer: "front" });
disc("ohp.lens", LF, LENS.z0, LENS.z1, LENS.r, { tone: "mid" }, { layer: "front", extra: Faded(G.ribsOf(LF, LENS.z0 + 2, LENS.z0 + 8, LENS.r, 56, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) });

// colour wheel: six gels on a disc turned by a small motor behind the head, across the beam
const WF = G.frameOf(WHEEL.c, [0, 1, 0], [1, 0, 0], [0, 0, 1]);
box("wheel.bracket", [WHEEL.c[0] - 4, HEAD.y0, HEAD.z1], [WHEEL.c[0] + 4, HEAD.y0 + 3, WHEEL.c[2]], { tone: "mid" }, { r: 0.6, layer: "front" });
disc("wheel.motor", G.frameOf([WHEEL.c[0], HEAD.y0, WHEEL.c[2]], [0, -1, 0], [1, 0, 0], [0, 0, 1]), 0, HEAD.y0 - WHEEL.face, 7, { tone: "mid" }, { layer: "front" });
{
  const n = M.GELS.length;
  const matrix = planeMatrix([WHEEL.c[0], WHEEL.face + 0.02, WHEEL.c[2]], [1, 0, 0], [0, 0, -1]);
  const sector = (j) => {
    const a0 = (j / n) * Math.PI * 2 + 0.04;
    const a1 = ((j + 1) / n) * Math.PI * 2 - 0.04;
    const pts = [];
    for (let i = 0; i <= 16; i++) { const a = a0 + ((a1 - a0) * i) / 16; pts.push([43 * Math.cos(a), 43 * Math.sin(a)]); }
    for (let i = 16; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / 16; pts.push([9 * Math.cos(a), 9 * Math.sin(a)]); }
    return `M${pts.map(([x, y]) => `${f2(x)} ${f2(y)}`).join("L")}Z`;
  };
  const gels = M.GELS.map((c, j) => `<path class="vp-gel" style="--gel:rgb(${c.map((v) => Math.round(v * 255)).join(",")})" d="${sector(j)}"/>`).join("");
  const spokes = Array.from({ length: n }, (_, j) => { const a = (j / n) * Math.PI * 2; return `M${f2(9 * Math.cos(a))} ${f2(9 * Math.sin(a))}L${f2(44.4 * Math.cos(a))} ${f2(44.4 * Math.sin(a))}`; }).join("");
  // the beam crosses the wheel here (in the wheel's face coordinates); a soft lit spot follows the gel under it
  const share = (EXIT[1] - WHEEL.face) / (EXIT[1] - SCREEN.y);
  const bx = EXIT[0] + (IMG.x - EXIT[0]) * share - WHEEL.c[0];
  const bz = -(EXIT[2] + (IMG.z - EXIT[2]) * share - WHEEL.c[2]);
  const art = `<defs><radialGradient id="vp-spot"><stop offset="0" stop-color="#fff6e8" stop-opacity=".7"/><stop offset=".5" stop-color="#fff6e8" stop-opacity=".22"/><stop offset="1" stop-color="#fff6e8" stop-opacity="0"/></radialGradient></defs><g transform="${matrix}"><g data-live="wheel">${gels}<path class="iso-line" data-tone="mid" d="${spokes}"/><circle class="vp-wheel-rim" r="44.4"/><circle class="vp-wheel-rim" r="9"/></g><circle class="vp-beam-spot" cx="${f2(bx)}" cy="${f2(bz)}" r="17"/><circle class="vp-hub" r="5"/></g>`;
  const shape = record(A.disc(WF, WHEEL.back - WHEEL.c[1], WHEEL.face - WHEEL.c[1], WHEEL.r, { name: "wheel" }));
  const solid = S(G.disc(WHEEL.back - WHEEL.c[1], WHEEL.face - WHEEL.c[1], WHEEL.r, WF, P), { tone: "mid", className: "vp-wheel-disc" });
  put("wheel", WHEEL.c, solid + art, [shape], { layer: "front", bias: -3 });
}

// ---------------------------------------------------------------- the tape deck: the music
LAYER = "mid";
for (const [x, y] of k.corners(DECK, 9)) disc("deck.foot", zFrame(x, y), 0, 4, 4, { tone: "lo" });
box("deck.case", [DECK.x, DECK.y, 4], [DECK.x + DECK.w, DECK.y + DECK.d, DECK_TOP], { tone: "mid" }, {
  r: DECK.r,
  steps: 4,
  bevel: 0.6,
  inner: Ln(k.sideSeam(DECK, 9, P, 4), { tone: "faint" }),
  extra: Ln(k.planOutline(k.insetPlan(DECK, 3.5), DECK_TOP, P, 4), { tone: "faint" }) + screws(k.corners(DECK, 6).map(([x, y]) => [x, y, DECK_TOP]), 0.5),
});
const REELS = [
  { c: [-203, 26], pack: 19.5 },
  { c: [-143, 26], pack: 12.5 },
];
for (const [i, reel] of REELS.entries()) {
  const F = zFrame(...reel.c);
  disc("deck.spindle", F, DECK_TOP, DECK_TOP + 1.6, 7, { tone: "lo" });
  disc("deck.reel", F, DECK_TOP + 1.6, DECK_TOP + 3.4, 25, { tone: "lo" }, {
    live: `reel${i}`,
    extra: Ln(k.ring(reel.c[0], reel.c[1], reel.pack, DECK_TOP + 3.4, P, 72), { tone: "mid" }),
  });
  disc("deck.hub", F, DECK_TOP + 3.4, DECK_TOP + 6, 4.4, { tone: "hi" });
}
const GUIDES = [[-217, 76], [-127, 76]];
for (const g of GUIDES) disc("deck.guide", zFrame(...g), DECK_TOP, DECK_TOP + 8, 1.7, { tone: "hi" });
box("deck.heads", [-190, 80, DECK_TOP], [-160, 92, DECK_TOP + 9], { tone: "mid" }, { r: 1.2, steps: 3, bevel: 0.4, extra: Ln(k.planOutline({ x: -186, y: 83, w: 22, d: 6, r: 1 }, DECK_TOP + 9, P, 3), { tone: "faint" }) });
const CAPSTAN = [-150, 95];
disc("deck.capstan", zFrame(...CAPSTAN), DECK_TOP, DECK_TOP + 9, 1.4, { tone: "hi" });
const ROLLER = [-150, 100.6];
disc("deck.roller", zFrame(...ROLLER), DECK_TOP + 1, DECK_TOP + 8, 4.2, { tone: "lo" }, { live: "roller" });
{
  // the tape: off the left pack, round the guide, across the heads, between capstan and roller, round the right guide, onto the right pack
  const tz = DECK_TOP + 3.42;
  const tangent = (c, r, p, side) => {
    const dx = p[0] - c[0];
    const dy = p[1] - c[1];
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx) + side * Math.acos(r / d);
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  };
  const l = REELS[0];
  const r = REELS[1];
  const GR = 1.75;
  const around = (g, a0, a1) => Array.from({ length: 7 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / 6; return [g[0] + GR * Math.cos(a), g[1] + GR * Math.sin(a), tz]; });
  const t0 = tangent(l.c, l.pack, [GUIDES[0][0] - GR, GUIDES[0][1]], 1);
  const t1 = tangent(r.c, r.pack, [GUIDES[1][0] + GR, GUIDES[1][1]], -1);
  // three runs: pack to the left guide, round the front of both guides past the heads and capstan, right guide to pack
  const runs = [
    ["deck.tape.in", [[...t0, tz], [GUIDES[0][0] - GR, GUIDES[0][1], tz]]],
    ["deck.tape", [...around(GUIDES[0], Math.PI, Math.PI / 2), [-190, 92, tz], [-160, 92, tz], [CAPSTAN[0], CAPSTAN[1] + 1.4, tz], ...around(GUIDES[1], Math.PI / 2, 0)]],
    ["deck.tape.out", [[GUIDES[1][0] + GR, GUIDES[1][1], tz], [...t1, tz]]],
  ];
  for (const [name, points] of runs) {
    const mid = points[Math.floor(points.length / 2)];
    put(name, mid, Ln(path3(points), { tone: "mid" }), [record(A.tube(points, 0.3, { name, owner: "deck" }))], { bias: 0.2 });
  }
}
for (let i = 0; i < 5; i++) {
  const x0 = DECK.x + 10 + i * 13;
  box(i === 1 ? "deck.key.play" : "deck.key", [x0, 104, DECK_TOP], [x0 + 10, 114, DECK_TOP + (i === 1 ? 0.8 : 2)], { tone: i === 1 ? "hi" : "mid" }, { r: 1 });
}
for (const [i, x] of [-160, -144, -128].entries()) {
  const F = G.frameOf([x, DECK.y + DECK.d, 15], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  disc("deck.knob", F, 0, 4.4, 4, { tone: "mid" }, { extra: Faded(G.ribsOf(F, 0.6, 4.4, 4, 26, P, { fade: [0.1, 0.55], seams: "last" }), { tone: "lo" }) + Ln(path3([G.pointOf(F, 4.4, 1, [1.9, 1.2, 2.4][i]), G.pointOf(F, 4.4, 3.7, [1.9, 1.2, 2.4][i])]), { tone: "hi", free: "start" }) });
}
{
  const F = G.frameOf([-212, DECK.y + DECK.d, 15], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  disc("deck.lamp", F, 0, 1.6, 2.2, { tone: "hi" }, { attrs: ' data-lamp=""' });
}
const DECK_JACK = G.frameAlong([DECK.x + DECK.w, 96, 12], [1, 0, 0]);
disc("deck.jack", DECK_JACK, 0, 2.4, 2.8, { tone: "mid" });

// ---------------------------------------------------------------- amplifier with the dose dial
for (const [x, y] of k.corners(AMP, 8)) disc("amp.foot", zFrame(x, y), 0, 4, 3.6, { tone: "lo" });
{
  const vents = Array.from({ length: 5 }, (_, i) => k.planOutline({ x: 110 + i * 7, y: 40, w: 3.4, d: 26, r: 1.7 }, AMP_TOP, P, 3)).join("");
  // the dose dial's hour scale: a ring on the amp's top with a tick every quarter hour, rooted on the ring
  const scale = [];
  const hours = [];
  for (let q = 0; q < 24; q++) {
    const a = (q / 24) * Math.PI * 2;
    const r0 = 20.6;
    const r1 = q % 4 === 0 ? 24.4 : 22.4;
    (q % 4 === 0 ? hours : scale).push(k.lineOnTop([DIAL[0] + r0 * Math.sin(a), DIAL[1] - r0 * Math.cos(a)], [DIAL[0] + r1 * Math.sin(a), DIAL[1] - r1 * Math.cos(a)], AMP_TOP, P));
  }
  box("amp.case", [AMP.x, AMP.y, 4], [AMP.x + AMP.w, AMP.y + AMP.d, AMP_TOP], { tone: "mid" }, {
    r: AMP.r,
    steps: 4,
    bevel: 0.6,
    inner: Ln(k.sideSeam(AMP, 9, P, 4), { tone: "faint" }),
    extra:
      Ln(vents, { tone: "faint" }) +
      Ln(k.ring(DIAL[0], DIAL[1], 20.6, AMP_TOP, P, 96), { tone: "lo" }) +
      Ln(scale.join(""), { tone: "lo" }) +
      Ln(hours.join(""), { tone: "mid" }) +
      screws(k.corners(AMP, 5).map(([x, y]) => [x, y, AMP_TOP]), 0.5),
  });
}
const DF2 = zFrame(...DIAL);
disc("amp.dial.skirt", DF2, AMP_TOP, AMP_TOP + 1.6, 18, { tone: "lo" });
disc("amp.dial", DF2, AMP_TOP + 1.6, AMP_TOP + 9, 15, { tone: "hi" }, {
  bevel: 0.5,
  extra: Ln(k.knurl(DIAL[0], DIAL[1], 15, AMP_TOP + 1.6, AMP_TOP + 9, 72, P), { tone: "lo" }) + `<g data-live="dial"></g>`,
});
{
  const FY = AMP.y + AMP.d;
  const METER = { x: 112, z: 28, w: 30, h: 14 };
  const m = planeMatrix([METER.x, FY + 0.02, METER.z], [1, 0, 0], [0, 0, -1]);
  const cx = METER.w / 2;
  const cy = 16;
  const arc = Array.from({ length: 41 }, (_, i) => { const t = -0.85 + (i / 40) * 1.7; return `${i ? "L" : "M"}${f2(cx + 11.6 * Math.sin(t))} ${f2(cy - 11.6 * Math.cos(t))}`; }).join("");
  const ticks = Array.from({ length: 11 }, (_, i) => { const t = -0.85 + (i / 10) * 1.7; const r1 = i % 5 === 0 ? 13.6 : 12.8; return `M${f2(cx + 11.6 * Math.sin(t))} ${f2(cy - 11.6 * Math.cos(t))}L${f2(cx + r1 * Math.sin(t))} ${f2(cy - r1 * Math.cos(t))}`; }).join("");
  box("amp.bezel", [METER.x - 2, FY, METER.z - METER.h - 2], [METER.x + METER.w + 2, FY + 1, METER.z + 2], { tone: "mid" }, { r: 0.4 });
  const face = `<clipPath id="vp-meter"><rect width="${METER.w}" height="${METER.h}" rx="1"/></clipPath><g transform="${planeMatrix([METER.x, FY + 1.02, METER.z], [1, 0, 0], [0, 0, -1])}"><rect class="vp-window" width="${METER.w}" height="${METER.h}" rx="1"/><g clip-path="url(#vp-meter)"><rect class="vp-dial-face" x=".8" y=".8" width="${METER.w - 1.6}" height="${METER.h - 1.6}" rx=".6"/><path class="iso-line" data-tone="lo" d="${arc}"/><path class="iso-line" data-tone="mid" d="${ticks}"/><path class="iso-line" data-tone="hi" data-free="" data-live="needle" d="M${cx} ${cy}L${cx} 3"/></g></g>`;
  void m;
  put("amp.meter", [METER.x + METER.w / 2, FY + 1.1, METER.z - METER.h / 2], face, [record(A.box([METER.x, FY + 1, METER.z - METER.h], [METER.x + METER.w, FY + 1.4, METER.z], { name: "amp.meter" }))], { bias: 0.5 });
  for (const [i, x] of [158, 176].entries()) {
    const F = G.frameOf([x, FY, 18], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    disc("amp.knob", F, 0, 5, 4.6, { tone: "hi" }, { extra: Faded(G.ribsOf(F, 0.6, 5, 4.6, 28, P, { fade: [0.1, 0.55], seams: "last" }), { tone: "lo" }) + Ln(path3([G.pointOf(F, 5, 1, [2.1, 1.3][i]), G.pointOf(F, 5, 4, [2.1, 1.3][i])]), { tone: "mid", free: "start" }) });
  }
  const LFr = G.frameOf([186, FY, 28], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  disc("amp.lamp", LFr, 0, 1.6, 2, { tone: "hi" }, { attrs: ' data-lamp=""' });
}
const AMP_IN = G.frameAlong([AMP.x, 96, 12], [-1, 0, 0]);
disc("amp.in", AMP_IN, 0, 2.4, 2.8, { tone: "mid" });
const AMP_OUT = G.frameAlong([AMP.x, 50, 12], [-1, 0, 0]);
disc("amp.out.nut", AMP_OUT, 0, 1, 4.2, { tone: "lo" }, { steps: 6 });
disc("amp.out", AMP_OUT, 1, 2.6, 3.2, { tone: "mid" });

// ---------------------------------------------------------------- the cup: what was drunk
{
  const CUP = zFrame(228, 86);
  turned("cup", CUP, [[0, 6.2], [1.4, 7.6], [11.6, 10.4], [13, 10.6]], { tone: "mid" }, {
    bevel: 0.4,
    inner: Ln(G.arcOf(CUP, 3.2, 8.2, P, { slope: 0.28 }) + G.arcOf(CUP, 9.4, 9.8, P, { slope: 0.28 }), { tone: "faint" }),
    extra: `<path class="vp-brew" d="${k.ring(228, 86, 8.9, 13, P, 64)}"/>` + Ln(k.ring(228, 86, 8.9, 13, P, 64), { tone: "lo" }) + Dots([at([228 - 3.5, 86 - 2, 13.02])], { size: 0.7, tone: "hi" }),
  });
}

// ---------------------------------------------------------------- cables
cable("lead.tape", [G.pointOf(DECK_JACK, 2.4, 0, 0), [-106, 96, 12], [-106, 96, 1.1], [-106, 122, 1.1], [92, 122, 1.1], [92, 96, 1.1], [92, 96, 12], G.pointOf(AMP_IN, 2.4, 0, 0)], 1.1, { bend: 3.6 });
cable("lead.drive", [G.pointOf(AMP_OUT, 2.6, 0, 0), [94, 50, 12], [94, 50, 1.3], [94, 72, 1.3], [SHAKER[0], 72, 1.3], [SHAKER[0], 30, 1.3], [SHAKER[0], 30, 14], SHAKER_IN], 1.3, { bend: 4 });
cable("lead.mains", [G.pointOf(G.frameAlong([-30, OHP.y, 14], [0, -1, 0]), 2, 0, 0), [-30, -66, 14], [-30, -66, 1.2], [-200, -66, 1.2], [-200, -96, 1.2], [-200, -96, 5], [-200, STRIP.y + STRIP.d, 5]], 1.2, { bend: 4, shells: [false, true] });

// ---------------------------------------------------------------- order and layers
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const layerOf = { back: [], mid: [], front: [] };
for (const item of R.items) layerOf[item.layer ?? "mid"].push(`<g class="it" data-name="${item.name}"${item.attrs ?? ""}>${item.svg}</g>`);

const LABEL_TEXT =
  "A cymatic light show on a bench in a dark room. A reel-to-reel tape deck plays a bass line through an amplifier into a shaker that vibrates a glass dish of water on the stage of an overhead projector. The projector's light passes up through the rippling water, through a turning wheel of coloured gels, and throws a large glowing mandala onto a screen behind. A dose dial on the amplifier follows ayahuasca's six-hour curve: as it rises the water's standing waves grow from stripes to squares, hexagons and twelve-fold patterns, and at the peak they turn into spirals.";
const svgOf = (cls, body, label) =>
  label
    ? k.figureSvg({ width: W, height: H, label, body, className: cls })
    : `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg vp-layer ${cls}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${body.join("")}</svg>`;
const stage = [
  `<div class="vp-stage" tabindex="0" role="slider" aria-label="Vision projector. Move across to change the hour after drinking and up or down to change the pitch; click the water or the screen to drop a droplet; left and right arrows change the hour, up and down the pitch, Space plays the sound, Escape resumes." aria-valuemin="0" aria-valuemax="360" aria-valuenow="96" aria-valuetext="1:36 after drinking">`,
  `<span class="vp-sr" aria-live="polite" data-status></span>`,
  svgOf("vp-back", [...bench, ...layerOf.back], LABEL_TEXT),
  `<canvas class="vp-layer vp-gl vp-screen-gl" aria-hidden="true"></canvas>`,
  svgOf("vp-mid", layerOf.mid),
  `<canvas class="vp-layer vp-gl vp-stage-gl" aria-hidden="true"></canvas>`,
  svgOf("vp-front", layerOf.front),
  `</div>`,
].join("");

const DATA = {
  W,
  H,
  P,
  camera: glCamera(P),
  screen: [SCREEN.x0, SCREEN.z0, SCREEN.x1, SCREEN.z1],
  screenY: SCREEN.y,
  img: [IMG.x, IMG.z, IMG.m],
  stage: [STAGE.x, STAGE.y, STAGE.x + STAGE.w, STAGE.y + STAGE.d],
  stageZ: OHP_TOP,
  dish: [DISH.r, DISH.outer, RING.rOut, RING.rIn],
  dishZ: [DISH.z0, DISH.floor, DISH.water, DISH.rim],
  ringZ: [RING.z0, RING.z1],
  arm: [ARM_END, 4, SHAKER[0] + 6],
  exit: EXIT,
  lens: [LENS.r, LENS.z0],
  wheel: [WHEEL.c[0], WHEEL.c[2], WHEEL.face, WHEEL.r],
  gels: M.GELS.flat(),
  reels: REELS,
  dial: DIAL,
  dialZ: AMP_TOP + 9,
  deckTop: DECK_TOP,
  roller: ROLLER,
};

const strip = (source) => source.replace(/^import .*$/gm, "").replace(/^export /gm, "");
const modelScript = `const M = (() => {${strip(readFileSync(join(HERE, "model.mjs"), "utf8"))}\nreturn { SESSION, level, clock, wrapHours, ease01, drive, heightOf, orderOf, twistOf, spinOf, waveNumber, BEAT, BASS, BASS_BEATS, TUNE, TUNE_BEATS, bassAt, tuneAt, swellOf, PITCHES, noteName, GELS, gelOf };})();\n`;
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const CSS = readFileSync(join(HERE, "vision.css"), "utf8");
const card = k.plateHtml({ fig: "Fig 2", title: "Vision projector", hint: "↔ hours · ↕ pitch · click water · space ♪", readout: "1:36 · A1 55 Hz · λ 9.1 mm", body: stage });
const controls = `<div class="vp-controls"><button type="button" class="vp-btn" data-action="sound" aria-pressed="false" aria-label="Sound"><span class="vp-dot"></span>♪</button><button type="button" class="vp-btn" data-action="full" aria-label="Full screen">⤢</button></div>`;
const page = `<!doctype html><html lang="en" class="iso" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Vision projector</title><style>${k.ISO_CSS}${CSS}</style></head><body><main class="vp-wrap">${card}${controls}</main><script type="module">${(kitScript() + glScript() + modelScript + LIVE).replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
writeFileSync(OUT, page);
console.log("wrote", OUT, `${(page.length / 1024).toFixed(0)} KB`, `${R.items.length} items`, `${R.solids.length} solids`, `scale ${KS.toFixed(3)}`, `${CABLES.length} cables`, `layers ${layerOf.back.length}/${layerOf.mid.length}/${layerOf.front.length}`);
// the dish is one glass split on purpose: its far wall under the water's light, its near wall and rim over it
A.auditOrExit(R, P, { allow: [["dish.far", "dish.near"]] });
