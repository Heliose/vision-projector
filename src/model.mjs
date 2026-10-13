// One model for the build and the page: the brew's curve, the bass line that shakes the dish,
// the Faraday-wave physics of the water and the colour wheel.

export const SESSION = 6; // hours after drinking, one turn of the dose dial
export const ease01 = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const wrapHours = (t) => ((t % SESSION) + SESSION) % SESSION;
// DMT level, 0..1 of peak: a 15 min lag, peak at 1.6 h, back to baseline by 4.5-6 h (Riba et al. 2003).
export function level(t) {
  const h = wrapHours(t);
  if (h <= 0.25) return 0;
  const x = (h - 0.25) / 1.35;
  return Math.pow(x, 2.5) * Math.exp(2.5 * (1 - x)) * (1 - ease01(4.6, 6, h));
}
export const clock = (t) => {
  const minutes = Math.round(wrapHours(t) * 60) % (SESSION * 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
};

// The dish is shaken a little harder as the level rises. Faraday waves appear only above a threshold drive;
// above it the pattern's height grows like the square root of the excess, smoothed through the onset.
export const drive = (lvl) => 0.55 + 0.95 * lvl; // drive over threshold
export function heightOf(lvl) {
  const excess = drive(lvl) - 1;
  const soft = 0.035;
  return Math.sqrt(Math.max(0, (excess + Math.sqrt(excess * excess + soft * soft)) / 2)) / Math.sqrt(0.5);
}
// How many wave directions lock together: 1 stripes, 2 squares, 3 hexagons, 4..6 eight- to twelve-fold quasi-patterns.
export const orderOf = (lvl) => 1 + 5 * ease01(0.42, 0.97, lvl);
export const twistOf = (lvl) => 0.018 * ease01(0.78, 1, lvl); // radians per mm: the spiral at the peak
export const spinOf = (lvl) => 0.07 * ease01(0.6, 1, lvl); // rad/s the pattern turns at the peak

// Capillary-gravity waves on 3 mm of water: omega^2 = (g k + sigma k^3 / rho) tanh(k h). Faraday waves answer at half the drive.
const G0 = 9.81;
const SIGMA = 0.072;
const RHO = 1000;
const DEPTH = 0.003;
export function waveNumber(driveHz) {
  const omega = Math.PI * driveHz; // 2 pi (f / 2)
  let k = Math.cbrt((omega * omega * RHO) / SIGMA);
  for (let i = 0; i < 30; i++) {
    const th = Math.tanh(k * DEPTH);
    const f = (G0 * k + (SIGMA * k ** 3) / RHO) * th - omega * omega;
    const df = (G0 + (3 * SIGMA * k * k) / RHO) * th + (G0 * k + (SIGMA * k ** 3) / RHO) * DEPTH * (1 - th * th);
    k -= f / df;
  }
  return k / 1000; // per mm
}

// The bass line on the tape: a slow ostinato under a whistled tune, both on the overtones of A1.
export const BEAT = 0.75;
export const BASS = [
  [55, 4], [73.42, 4], [61.74, 4], [82.41, 4], [69.3, 4], [92.5, 4], [55, 4], [110, 4],
];
export const BASS_BEATS = BASS.reduce((sum, [, beats]) => sum + beats, 0);
export const TUNE = [[550, 2], [495, 1], [440, 3], [550, 2], [715, 1], [550, 3], [495, 1], [440, 1], [275, 3], [440, 1], [495, 1], [550, 2], [715, 1], [880, 3], [715, 1], [550, 2], [495, 1], [440, 3]];
export const TUNE_BEATS = TUNE.reduce((sum, [, beats]) => sum + beats, 0);
function stepOf(list, total, seconds) {
  const beats = (((seconds / BEAT) % total) + total) % total;
  let at = 0;
  for (let index = 0; index < list.length; index++) {
    const [hz, length] = list[index];
    if (beats < at + length) return { index, hz, age: (beats - at) * BEAT, length: length * BEAT };
    at += length;
  }
  return { index: 0, hz: list[0][0], age: 0, length: list[0][1] * BEAT };
}
export const bassAt = (seconds) => stepOf(BASS, BASS_BEATS, seconds);
export const tuneAt = (seconds) => stepOf(TUNE, TUNE_BEATS, seconds);
export const swellOf = ({ age, length }) => ease01(0, 0.08, age) * (0.74 + 0.26 * Math.exp(-age / 0.3)) * (1 - 0.3 * ease01(length - 0.15, length, age));
export const PITCHES = [55, 61.74, 69.3, 73.42, 82.41, 92.5, 110];
export const noteName = (hz) => ({ 55: "A1", 61.74: "B1", 69.3: "C♯2", 73.42: "D2", 82.41: "E2", 92.5: "F♯2", 110: "A2" })[hz] ?? `${hz}`;

// Colour wheel: six gels. The beam crosses the wheel off centre; where a boundary passes through the beam the two gels mix.
export const GELS = [
  [1.0, 0.24, 0.62],
  [0.56, 0.3, 1.0],
  [0.12, 0.62, 1.0],
  [0.1, 0.92, 0.78],
  [0.98, 0.78, 0.2],
  [1.0, 0.42, 0.16],
];
export function gelOf(angle, beam = 0.32) {
  const n = GELS.length;
  const seg = (Math.PI * 2) / n;
  const out = [0, 0, 0];
  let total = 0;
  for (let j = 0; j < n; j++) {
    const centre = j * seg + seg / 2;
    let d = Math.abs(((angle - centre) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
    const w = 1 - ease01(seg / 2 - beam / 2, seg / 2 + beam / 2, d);
    for (let c = 0; c < 3; c++) out[c] += GELS[j][c] * w;
    total += w;
  }
  return out.map((v) => v / Math.max(total, 1e-6));
}
