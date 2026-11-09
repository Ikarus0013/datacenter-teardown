// Procedural sound, generated in the browser (no recordings).
// It illustrates the KIND of sound; it is not calibrated to real loudness.
let ctx = null, master = null, distGain = null;
export const REF_M = 20; // loudest point on the slider
let distance = 800;
const gainFor = (d) => Math.min(1, REF_M / d); // pressure halves per doubling: -6 dB
const playing = {};

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.6;
    distGain = ctx.createGain();
    distGain.gain.value = gainFor(distance);
    master.connect(distGain).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseBuffer(c, seconds = 4) {
  const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { // brown-ish noise: smoother, more like air
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return b;
}

function fade(g, to, t = 1.2) {
  const now = ctx.currentTime;
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(g.gain.value, now);
  g.gain.linearRampToValueAtTime(to, now + t);
}

// Roof coolers at night: broadband air rush plus a low fan hum with slow beating.
// Built on any audio context, so the same sound can be rendered offline for the video.
function fanGraph(c, out) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 700;
  const air = c.createGain();
  air.gain.value = 0.5;
  src.connect(lp).connect(air).connect(out);
  const hums = [[98, 0.05], [101.5, 0.04], [196, 0.015]].map(([f, g]) => {
    const o = c.createOscillator();
    o.frequency.value = f;
    const gg = c.createGain();
    gg.gain.value = g;
    o.connect(gg).connect(out);
    o.start();
    return o;
  });
  src.start();
  return () => { src.stop(); hums.forEach((o) => o.stop()); };
}
function fans() {
  const c = audio();
  const out = c.createGain();
  out.gain.value = 0;
  out.connect(master);
  const stopAll = fanGraph(c, out);
  fade(out, 0.9, 2);
  return { out, stop: () => { fade(out, 0, 1.2); setTimeout(() => { stopAll(); out.disconnect(); }, 1400); } };
}

// The fan hum rendered offline, as a 16-bit mono WAV (base64), for the video.
export async function renderHumWav(seconds, rate = 44100) {
  const c = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
  const out = c.createGain();
  out.gain.value = 0.54; // master 0.6 × fan level 0.9, as in the page
  out.connect(c.destination);
  fanGraph(c, out);
  const pcm = (await c.startRendering()).getChannelData(0);
  const buf = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o, s) => [...s].forEach((ch, i) => buf.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF'); buf.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 1, true);
  buf.setUint32(24, rate, true); buf.setUint32(28, rate * 2, true); buf.setUint16(32, 2, true); buf.setUint16(34, 16, true);
  str(36, 'data'); buf.setUint32(40, pcm.length * 2, true);
  pcm.forEach((v, i) => buf.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  let bin = '';
  const bytes = new Uint8Array(buf.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// A diesel generator test run: starter, then a deep engine rumble at idle.
function generator() {
  const c = audio();
  const out = c.createGain();
  out.gain.value = 0;
  out.connect(master);
  const engine = c.createOscillator();
  engine.type = 'sawtooth';
  engine.frequency.setValueAtTime(8, c.currentTime);
  engine.frequency.linearRampToValueAtTime(25, c.currentTime + 3); // spin up to idle firing rate
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 180;
  const eg = c.createGain();
  eg.gain.value = 0.35;
  engine.connect(lp).connect(eg).connect(out);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 300;
  bp.Q.value = 0.8;
  const ng = c.createGain();
  ng.gain.value = 0.35;
  src.connect(bp).connect(ng).connect(out);
  const throb = c.createOscillator(); // cylinder throb on the exhaust noise
  throb.frequency.value = 12.5;
  const tg = c.createGain();
  tg.gain.value = 0.2;
  throb.connect(tg).connect(ng.gain);
  engine.start(); src.start(); throb.start();
  fade(out, 1, 3);
  return { out, stop: () => { fade(out, 0, 2.5); setTimeout(() => { engine.stop(); src.stop(); throb.stop(); out.disconnect(); }, 2700); } };
}

const MAKERS = { fans, generator };
export function toggleSound(kind) {
  if (playing[kind]) { playing[kind].stop(); delete playing[kind]; return false; }
  playing[kind] = MAKERS[kind]();
  return true;
}
export function stopAllSound() {
  for (const k of Object.keys(playing)) { playing[k].stop(); delete playing[k]; }
}
export const isPlaying = (kind) => !!playing[kind];

export function setDistance(d) {
  distance = d;
  if (distGain) distGain.gain.setTargetAtTime(gainFor(d), ctx.currentTime, 0.08);
}
export const dbBelowRef = (d) => 20 * Math.log10(d / REF_M);
