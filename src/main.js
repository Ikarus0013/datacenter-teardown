import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { data, esc } from './util.js';
import { buildSite, setGroupOpacity, GROUPS } from './model.js';
import { buildEffects } from './effects.js';
import { toggleSound, stopAllSound, setDistance, dbBelowRef, renderHumWav } from './sound.js';
import { buildTeardown } from './teardown.js';
import { buildCoolChains } from './coolchain.js';
import { TOPICS, LENSES, SCEN, TOUR, waterPerDay, detailsHTML, aboutHTML, sliderToDist } from './topics.js';
import { buildDalles } from './dalles.js';
import { DALLES_TOPICS, DALLES_TOUR, dallesDetails, DALLES } from './dallesTopics.js';
import { buildGlobe, toXYZ } from './globe.js';
import { buildIdeal } from './ideal.js';
import { IDEAL_TOPICS, IDEAL_TOUR, idealDetails, IDEAL } from './idealTopics.js';
const ALL = [...TOPICS, ...LENSES];
let siteId = null; // null = globe, 'raunheim', or a key of EXTRA
// sites other than Raunheim share one simple shape: a world (root, hotspots, labels, home, views, update, setCube)
// plus topics, a tour and a details renderer. Filled in below once the worlds are built.
const EXTRA = {};
const ex = () => EXTRA[siteId];
const topicsOf = () => ex()?.topics || ALL;
const find = (id) => topicsOf().find((x) => x.id === id);

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const G22 = data.sites['vantage-fra22'].facts;

// ---------- renderer, camera, light ----------
const host = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
host.appendChild(renderer.domElement);

const labels = new CSS2DRenderer();
Object.assign(labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
host.appendChild(labels.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9ece7);
scene.fog = new THREE.Fog(0xe9ece7, 380, 950);

const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 3000);
const HOME = { pos: new THREE.Vector3(185, 250, 400), target: new THREE.Vector3(-55, 22, 25) };
camera.position.copy(HOME.pos);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME.target);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.46;
controls.minDistance = 15;
controls.maxDistance = 650;

scene.add(new THREE.HemisphereLight(0xffffff, 0xb7bdb2, 1.2));
const sun = new THREE.DirectionalLight(0xfff6ea, 2.2);
sun.position.set(-140, 230, 120);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
Object.assign(sun.shadow.camera, { left: -220, right: 220, top: 220, bottom: -220, far: 700 });
scene.add(sun);

// ---------- model ----------
const B21 = data.sites['vantage-fra21'].backup, MW21 = data.sites['vantage-fra21'].facts.itCapacity.value / 1000;
const JOBS = {
  build: Math.round(data.jobs.constructionPerMW.value * MW21),
  lo: Math.round(data.jobs.operationPerMWLow.value * MW21),
  hi: Math.round(data.jobs.operationPerMWHigh.value * MW21),
};
const site = buildSite(scene, {
  generatorCount: G22.generatorCount.value, stackHeight: G22.stackHeight.value,
  fra21: { stackCount: B21.stackCount.value, stackHeight: B21.stackHeight.value },
  constructionWorkers: JOBS.build,
  perFloor: 200,
  towerBands: [
    { low: data.jobs.itInfraPerMWLow.value * MW21, high: data.jobs.itInfraPerMWHigh.value * MW21, color: 0x5b88a8 },
    { low: data.jobs.itServicesPerMWLow.value * MW21, high: data.jobs.itServicesPerMWHigh.value * MW21, color: 0xc98a4b },
  ],
});
const fx = buildEffects(scene, site);
const dal = buildDalles(scene);
dal.root.visible = true;
EXTRA.thedalles = {
  world: dal, topics: DALLES_TOPICS, tour: DALLES_TOUR, details: dallesDetails,
  cubeM3: () => DALLES.facts.waterPerDayM3.value, cubeText: 'One day of water, to scale',
  fog: [2000, 3600], maxDist: 3200, far: 9000, near: 2, sun: 1500,
};
// the ideal datacenter: "proven today" or "with promises" (ghosts, promised values)
let vision = false;
const ideal = buildIdeal(scene);
EXTRA.ideal = {
  world: ideal, topics: IDEAL_TOPICS, tour: IDEAL_TOUR, details: idealDetails,
  cubeM3: () => IDEAL_TOPICS.find((x) => x.cube).cubeM3(vision), cubeText: 'One day of water at the best fleet average, to scale',
  fog: [1800, 4600], maxDist: 3400, far: 9000, near: 1, sun: 800,
};
const td = buildTeardown(scene);
const cc = buildCoolChains(scene);
const ccTags = {};
for (const [k, c] of Object.entries(cc.chains)) {
  ccTags[k] = c.labels.map(([text, pos]) => {
    const el = document.createElement('div');
    el.className = 'cube-label env chain-tag';
    el.textContent = text;
    const o = new CSS2DObject(el);
    o.center.set(0.5, 1);
    o.position.copy(pos);
    o.visible = false;
    scene.add(o);
    return o;
  });
}
let tdK = 0, tdTarget = 1;
const tdTags = td.layers.map((l) => {
  const el = document.createElement('div');
  el.className = 'cube-label env layer';
  el.textContent = l.label;
  const o = new CSS2DObject(el);
  o.center.set(0, 0.5);
  o.visible = false;
  scene.add(o);
  return o;
});
const envTags = [...fx.env.labels, fx.river.label].map(([text, pos]) => {
  const el = document.createElement('div');
  el.className = 'cube-label env';
  el.textContent = text;
  const o = new CSS2DObject(el);
  o.center.set(0.5, 1);
  o.position.copy(pos);
  o.visible = false;
  scene.add(o);
  return o;
});
const cubeLabel = document.createElement('div');
cubeLabel.className = 'cube-label';
const cubeTag = new CSS2DObject(cubeLabel);
cubeTag.center.set(0.5, 1);
scene.add(cubeTag);

// ---------- UI ----------
const app = document.body;
const card = document.getElementById('card');
const cardBody = card.querySelector('.card-body');
const dock = document.querySelector('.dock');
const pill = (t) => `<button type="button" data-topic="${t.id}" aria-pressed="false">${esc(t.name)}</button>`;
dock.innerHTML = TOPICS.map(pill).join('') + '<span class="sep" aria-hidden="true"></span>' + LENSES.map(pill).join('');

// labelled points in the scene (real buttons, so they work with the keyboard)
function hotspot(id, name, pos) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'hot';
  b.dataset.topic = id;
  b.innerHTML = `<i></i>${esc(name)}`;
  const o = new CSS2DObject(b);
  o.center.set(0, 0.5);
  o.position.copy(pos);
  scene.add(o);
  return o;
}
const rauTags = ALL.filter((x) => site.hotspots[x.id]).map((t) => hotspot(t.id, t.name, site.hotspots[t.id]));
for (const x of Object.values(EXTRA)) {
  const w = x.world;
  x.tags = x.topics.filter((t) => w.hotspots[t.id]).map((t) => hotspot(t.id, t.name, w.hotspots[t.id]));
  for (const [text, pos] of w.labels) {
    const el = document.createElement('div');
    el.className = 'cube-label env place';
    el.textContent = text;
    const o = new CSS2DObject(el);
    o.center.set(0.5, 1);
    o.position.copy(pos);
    scene.add(o);
    x.tags.push(o);
  }
  x.visionTags = (w.visionLabels || []).map(([text, pos]) => {
    const el = document.createElement('div');
    el.className = 'cube-label env place ghost';
    el.textContent = text;
    const o = new CSS2DObject(el);
    o.center.set(0.5, 1);
    o.position.copy(pos);
    o.visible = false;
    scene.add(o);
    return o;
  });
  if (w.setCube) {
    const el = document.createElement('div');
    el.className = 'cube-label';
    el.textContent = x.cubeText;
    x.cubeTag = new CSS2DObject(el);
    x.cubeTag.center.set(0.5, 1);
    x.cubeTag.visible = false;
    scene.add(x.cubeTag);
  }
}

let current = null;
let scenario = 'closed-loop';
let jobsMode = 'build';
let coolMode = 'today';
let coolView = 'building';
let openedAt = 0;

function renderCard() {
  if (current === 'about') { cardBody.innerHTML = aboutHTML(); return; }
  if (ex()) {
    const t = find(current);
    const det = ex().details(t);
    cardBody.innerHTML = `<h2 id="card-h">${esc(t.name)}</h2><p class="general">${esc(t.general)}</p>${t.card(vision)}
      ${det ? `<details><summary>Details and sources</summary>${det}</details>` : ''}`;
    return;
  }
  const t = find(current);
  const det = detailsHTML(t, scenario, coolMode);
  cardBody.innerHTML = `<h2 id="card-h">${esc(t.name)}</h2><p class="general">${esc(t.general)}</p>${t.card(t.jobs ? jobsMode : scenario, jobsMode, coolMode, coolView)}
    ${det ? `<details><summary>Details and sources</summary>${det}</details>` : ''}`;
}

function applyFocus() {
  const t = siteId === 'raunheim' ? find(current) : null;
  for (const [k, x] of Object.entries(EXTRA)) {
    if (k === siteId) x.world.focus?.(current);
    if (!x.cubeTag) continue;
    const on = k === siteId && find(current)?.cube;
    const m3 = on ? x.cubeM3(current) : 0;
    x.cubeTag.position.copy(x.world.setCube(m3));
    x.cubeTag.visible = m3 > 0;
  }
  const focusGroups = t && !t.lens ? t.groups : null;
  const tear = !!t?.teardown;
  for (const g of GROUPS()) {
    if (g === 'site') continue;
    let o = tear ? 0.05 : 1;
    if (focusGroups) {
      if (focusGroups.includes(g)) o = 1;
      else if (g === 'building') o = t.see ?? 1; // buildings stay solid unless we need to look inside
      else o = t.see ? 0.08 : 0.2;
    }
    setGroupOpacity(g, o);
  }
  site.racks.visible = !!t?.show?.racks;
  td.root.visible = tear;
  tdTags.forEach((o) => { o.visible = tear; });
  if (tear) { tdK = reduceMotion ? 1 : 0; tdTarget = 1; }
  // environment: see-through ground, groundwater, tanks, rain; open up the view to the river
  const env = !!t?.env;
  fx.env.group.visible = env;
  site.tower.group.visible = !env && !tear;
  envTags.forEach((o) => { o.visible = env; });
  for (const m of [site.land, site.plot]) {
    m.material.transparent = env;
    m.material.opacity = env ? 0.55 : 1;
    m.material.depthWrite = !env;
    m.material.needsUpdate = true;
  }
  scene.fog.far = ex() ? ex().fog[1] : env ? 2600 : 950;
  scene.fog.near = ex() ? ex().fog[0] : 380;
  controls.maxDistance = ex() ? ex().maxDist : env ? 1400 : 650;
  // the lot is always there; cars only appear in the Jobs view
  if (t?.jobs) site.lot.set(jobsMode, JOBS.lo, JOBS.hi); else site.lot.set('empty');
  const on = new Set(t?.fx || []);
  const water = !!t?.water;
  const apart = !!t?.cooling && coolView === 'apart';
  cc.show(apart ? coolMode : null);
  for (const [k, tags] of Object.entries(ccTags)) tags.forEach((o) => { o.visible = apart && k === coolMode; });
  const cool = t?.cooling && !apart ? coolMode : null;
  fx.loop.group.visible = on.has('loop') && !apart && cool !== 'legacy';
  fx.loop.setWarm(cool === 'future');
  fx.air.group.visible = cool === 'legacy';
  fx.chip.group.visible = cool === 'future';
  fx.power.group.visible = on.has('power');
  fx.heat.group.visible = on.has('heat');
  fx.noise.group.visible = on.has('noise');
  fx.vapor.group.visible = water && scenario === 'evaporative';
  fx.mains.group.visible = water && scenario === 'evaporative';
  const wue = SCEN[scenario].wue;
  fx.cube.target = water && wue ? Math.cbrt(waterPerDay(wue)) : 0;
  if (water && wue) cubeLabel.textContent = 'One day of water, to scale';
  if (reduceMotion) fx.cube.side = fx.cube.target;
}

function select(id) {
  if (id !== current) stopAllSound();
  current = id;
  app.classList.toggle('focused', !!id);
  dock.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.topic === id)));
  const home = ex()?.world.home || HOME;
  if (!id) {
    card.hidden = true;
    flyTo(home.pos, home.target);
  } else {
    openedAt = clock.elapsedTime;
    renderCard();
    card.hidden = false;
    const ds = card.querySelector('[data-distance]');
    if (ds) showDistance(ds.value);
    const t = find(id);
    card.classList.toggle('wide', !!t?.wide || id === 'about');
    if (ex()) { const v = ex().world.views[id] || home; flyTo(v.pos, v.target); }
    else if (t?.cooling && coolView === 'apart') flyTo(new THREE.Vector3(...cc.view.pos), new THREE.Vector3(...cc.view.target));
    else if (t?.view) flyTo(new THREE.Vector3(...t.view.pos), new THREE.Vector3(...t.view.target));
    else flyTo(home.pos, home.target);
  }
  applyFocus();
  history.replaceState(null, '', `#${id || siteId}${siteId === 'ideal' && vision ? '/promises' : ''}`);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-topic]');
  if (b) { select(b.dataset.topic === current ? null : b.dataset.topic); return; }
  const s = e.target.closest('[data-scenario]');
  if (s) { scenario = s.dataset.scenario; renderCard(); applyFocus(); }
  const j = e.target.closest('[data-jobs]');
  if (j) { jobsMode = j.dataset.jobs; renderCard(); applyFocus(); }
  if (e.target.matches('[data-spread], [data-distance]')) return;
  const snd = e.target.closest('[data-sound]');
  if (snd) {
    const on = toggleSound(snd.dataset.sound);
    snd.setAttribute('aria-pressed', String(on));
    snd.textContent = (on ? '■ ' : '▶ ') + snd.textContent.slice(2);
    return;
  }
  const k = e.target.closest('[data-cool]');
  if (k) { coolMode = k.dataset.cool; renderCard(); applyFocus(); }
  const cv = e.target.closest('[data-coolview]');
  if (cv) {
    coolView = cv.dataset.coolview;
    renderCard(); applyFocus();
    const t = find('cooling');
    if (coolView === 'apart') flyTo(new THREE.Vector3(...cc.view.pos), new THREE.Vector3(...cc.view.target));
    else flyTo(new THREE.Vector3(...t.view.pos), new THREE.Vector3(...t.view.target));
  }
});
card.querySelector('.close').addEventListener('click', () => select(null));
card.addEventListener('input', (e) => {
  if (e.target.matches('[data-spread]')) tdTarget = e.target.value / 100;
  if (e.target.matches('[data-distance]')) showDistance(e.target.value);
});
const NL = data.sites['vantage-fra21'].noiseLimits, SO = data.sound;
function showDistance(v) {
  const d = sliderToDist(Number(v));
  setDistance(d);
  const out = document.getElementById('dist-read');
  if (!out) return;
  const res = NL.totalCap.points.find((p) => p.zone.startsWith('residential'));
  const share = NL.plantShare.points.filter((p) => p.zone.startsWith('residential')).map((p) => p.night);
  const nearHomes = d >= SO.homesNear.value * 0.85 && d <= SO.homesFar.value * 1.15;
  out.innerHTML = `<b>${Math.round(d / (d < 100 ? 5 : 10)) * (d < 100 ? 5 : 10)} m away</b>: ${Math.round(dbBelowRef(d))} dB quieter than at 20 m.` +
    (nearHomes ? ` This is how far the nearest homes are (${SO.homesNear.value}–${SO.homesFar.value} m). At night the law allows at most ${res.night} dB(A) there from all equipment together, of which ${Math.min(...share)}–${Math.max(...share)} from the generators.` : '');
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) select(null); });

// click on empty ground returns to the overview (only a click, not a drag)
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5 && current) select(null);
});

// ---------- day / night, winter / summer ----------
const SE = data.seasons;
const dotHTML = (st) => `<span class="status"><i style="background: var(--s-${st})"></i></span>`;
let timeOfDay = 'day', season = 'summer';
const ambText = document.querySelector('.amb-text');
const hemi = scene.children.find((o) => o.isHemisphereLight);
function applyAmbience() {
  const night = timeOfDay === 'night', summer = season === 'summer';
  const sky = new THREE.Color(night ? 0x1c2330 : summer ? 0xe9ece7 : 0xe6eaee);
  scene.background = sky;
  scene.fog.color = sky;
  document.body.classList.toggle('night', night);
  hemi.intensity = night ? 0.35 : 1.2;
  sun.intensity = night ? 0.25 : summer ? 2.4 : 1.6;
  sun.color.set(night ? 0x9fb4d8 : summer ? 0xfff2df : 0xeef3ff);
  site.land.material.color.set(summer ? 0xd3d9cc : 0xdfe3e2);
  // offices empty at night: a few lit windows (security); halls never sleep
  site.glass.forEach((m, i) => { m.emissive.set(night && i % 3 === 0 ? 0xffd99a : 0x000000); m.emissiveIntensity = 0.6; });
  // roof coolers working hard on a summer day
  site.coolerMat.emissive.set(summer && !night ? 0x7a3a10 : 0x000000);
  site.coolerMat.emissiveIntensity = 0.35;
  const lines = [];
  if (!summer) lines.push(`Frankfurt averages ${SE.meanJan.value} °C in January: outside air alone cools the halls. Servers are fine with intake air of ${SE.inletRange.value} °C. ${dotHTML(SE.inletRange.status)}`);
  else if (!night) lines.push(`About ${Math.round(SE.summerDays.value)} days a year reach 25 °C here, ${Math.round(SE.hotDays.value)} reach 30 °C. Above about 22 °C outside, chillers have to help, for relatively few hours a year. ${dotHTML(SE.freeCooling.status)} Record: ${SE.record.value} °C in June 2026 (provisional). ${dotHTML(SE.record.status)}`);
  else lines.push(`Summer nights cool down: July averages ${SE.meanJul.value} °C, day and night together, so outside air takes over again. ${dotHTML(SE.meanJul.status)}`);
  if (night) lines.push(`The servers don’t sleep: large sites run at about ${SE.flatLoad.value} % of their peak around the clock. ${dotHTML(SE.flatLoad.status)}`);
  ambText.innerHTML = lines.join(' ');
}
document.querySelector('.ambience').addEventListener('click', (e) => {
  const b = e.target.closest('[data-time],[data-season]');
  if (!b) return;
  if (b.dataset.time) timeOfDay = b.dataset.time;
  if (b.dataset.season) season = b.dataset.season;
  document.querySelectorAll('.ambience [data-time]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.time === timeOfDay)));
  document.querySelectorAll('.ambience [data-season]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.season === season)));
  applyAmbience();
});
applyAmbience();

// ---------- guided tour ----------
const tourEl = document.getElementById('tour');
const tourText = tourEl.querySelector('.tour-text');
const tourDots = tourEl.querySelector('.tour-dots');
const tourList = () => ex()?.tour || TOUR;
const STEP_SECONDS = 9;
let tour = null; // { i, paused, t }
function tourShow(i) {
  const list = tourList();
  tour.i = (i + list.length) % list.length;
  tour.t = 0;
  const step = list[tour.i];
  touring = true;
  select(step.id);
  touring = false;
  tourText.textContent = step.text;
  tourDots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k === tour.i));
}
function tourStart() {
  if (!siteId) return;
  tour = { i: 0, paused: false, t: 0 };
  tourDots.innerHTML = tourList().map(() => '<i></i>').join('');
  tourEl.hidden = false;
  document.body.classList.add('touring');
  tourShow(0);
}
function tourStop() {
  if (!tour) return;
  tour = null;
  tourEl.hidden = true;
  document.body.classList.remove('touring');
}
let touring = false, idle = 0;
document.getElementById('tour-start').addEventListener('click', tourStart);
tourEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tour]');
  if (!b || !tour) return;
  const a = b.dataset.tour;
  if (a === 'exit') tourStop();
  else if (a === 'next') tourShow(tour.i + 1);
  else if (a === 'prev') tourShow(tour.i - 1);
  else if (a === 'pause') { tour.paused = !tour.paused; b.textContent = tour.paused ? '▶' : '❚❚'; b.setAttribute('aria-label', tour.paused ? 'Play' : 'Pause'); }
});
// any interaction outside the tour bar ends the tour and resets the idle timer
for (const ev of ['pointerdown', 'wheel', 'keydown']) {
  addEventListener(ev, (e) => {
    idle = 0;
    if (tour && !e.target.closest?.('#tour') && !e.target.closest?.('#tour-start')) tourStop();
  }, { capture: true });
}

// ---------- sites and the globe ----------
const SITE_INFO = {
  raunheim: { lat: 50.0132, lon: 8.4624, name: 'Vantage FRA21, Raunheim', place: 'near Frankfurt, Germany', subtitle: 'Built on real figures from one site near Frankfurt.' },
  ideal: { lat: IDEAL.site.lat, lon: IDEAL.site.lon, name: 'The ideal datacenter', place: 'fictional · Luleå, Sweden', subtitle: 'A fictional campus: each part is the best done somewhere today, or a labelled promise.' },
  thedalles: { lat: 45.632, lon: -121.201, name: 'Google, The Dalles', place: 'Oregon, USA', subtitle: 'Built on public figures from Google’s campus in The Dalles, Oregon.' },
};
const globeLabels = new CSS2DRenderer();
Object.assign(globeLabels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
host.appendChild(globeLabels.domElement);
const globe = buildGlobe(renderer.domElement, Object.entries(SITE_INFO).map(([id, v]) => ({ id, ...v })));
for (const p of globe.pins) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'hot pin';
  b.dataset.pin = p.id;
  b.innerHTML = `<i></i><span><b>${esc(p.name)}</b>${esc(p.place)}</span>`;
  const o = new CSS2DObject(b);
  o.center.set(0, 0.5);
  o.position.copy(p.tip);
  globe.scene.add(o);
}
function sunOver(center, span) {
  sun.target.position.copy(center);
  sun.position.copy(center).add(new THREE.Vector3(-140, 230, 120).multiplyScalar(span / 220));
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, far: span * 4 });
  sun.shadow.camera.updateProjectionMatrix();
}
scene.add(sun.target);
function setSite(id, { instant = false } = {}) {
  tourStop?.();
  stopAllSound();
  siteId = id;
  document.body.dataset.site = id || 'globe';
  const inSite = !!id;
  controls.enabled = inSite;
  globe.controls.enabled = !inSite;
  labels.domElement.style.display = inSite ? '' : 'none';
  globeLabels.domElement.style.display = inSite ? 'none' : '';
  rauTags.forEach((o) => { o.visible = id === 'raunheim'; });
  for (const [k, x] of Object.entries(EXTRA)) {
    x.tags.forEach((o) => { o.visible = id === k; });
    x.visionTags.forEach((o) => { o.visible = id === k && vision; });
  }
  const X = EXTRA[id];
  dock.innerHTML = X ? X.topics.map(pill).join('') : TOPICS.map(pill).join('') + '<span class="sep" aria-hidden="true"></span>' + LENSES.map(pill).join('');
  document.querySelector('.title p').textContent = id ? SITE_INFO[id].subtitle : 'Pick a datacenter on the globe.';
  if (X) sunOver(X.world.home.target, X.sun); else sunOver(new THREE.Vector3(-10, 0, 8), 220);
  camera.near = X ? X.near : 0.5;
  camera.far = X ? X.far : 3000;
  camera.updateProjectionMatrix();
  current = undefined;
  if (inSite) {
    const home = X?.world.home || HOME;
    // start high above this site (not wherever the camera last was), so arriving is a zoom-in, not a slide across the map
    controls.target.copy(home.target);
    camera.position.copy(home.target).add(home.pos.clone().sub(home.target).multiplyScalar(3));
    select(null);
    if (instant || reduceMotion) { camera.position.copy(home.pos); flight = null; }
  } else {
    globe.home();
    card.hidden = true;
    app.classList.remove('focused');
    history.replaceState(null, '', location.pathname);
  }
}
document.addEventListener('click', (e) => {
  const p = e.target.closest('[data-pin]');
  if (p) {
    const s = globe.pins.find((x) => x.id === p.dataset.pin);
    globe.flyTo(s, () => setSite(s.id));
  }
  if (e.target.closest('#to-globe')) setSite(null);
  const v = e.target.closest('[data-vision]');
  if (v) setVision(v.dataset.vision === 'on');
});

function setVision(on) {
  vision = on;
  ideal.setVision(on);
  EXTRA.ideal.visionTags.forEach((o) => { o.visible = siteId === 'ideal' && on; });
  document.querySelectorAll('[data-vision]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.vision === 'on') === on)));
  if (siteId === 'ideal' && current) renderCard();
  applyFocus();
}

// ---------- camera flights ----------
let flight = null;
const clock = new THREE.Clock();
function flyTo(pos, target) {
  if (reduceMotion) { camera.position.copy(pos); controls.target.copy(target); return; }
  flight = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, k: 0 };
}

// ---------- loop ----------
function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h);
  labels.setSize(w, h);
  globeLabels.setSize(w, h);
  globe.resize(w, h);
  camera.aspect = w / h;
  // pull back on narrow screens so the whole site fits
  camera.fov = w < 700 ? 50 : 36;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);
resize();

let t = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (!siteId) {
    globe.update(dt);
    renderer.render(globe.scene, globe.camera);
    globeLabels.render(globe.scene, globe.camera);
    requestAnimationFrame(frame);
    return;
  }
  if (!reduceMotion) t += dt * 0.05;
  if (flight) {
    flight.k = Math.min(1, flight.k + dt / 1.3);
    const e = flight.k < 0.5 ? 4 * flight.k ** 3 : 1 - (-2 * flight.k + 2) ** 3 / 2;
    camera.position.lerpVectors(flight.p0, flight.p1, e);
    controls.target.lerpVectors(flight.t0, flight.t1, e);
    if (flight.k >= 1) flight = null;
  }
  animateScene(dt);
  if (tour && !tour.paused) { tour.t += dt; if (tour.t > STEP_SECONDS) tourShow(tour.i + 1); }
  if (!tour && !current && siteId === 'raunheim') { idle += dt; if (idle > 60) { idle = 0; tourStart(); } }
  find(current)?.tick?.(clock.elapsedTime - openedAt);
  controls.update();
  renderer.render(scene, camera);
  labels.render(scene, camera);
  requestAnimationFrame(frame);
}

// everything that moves in the scene, for one time step (used live and by the video mode)
function animateScene(dt) {
  ex()?.world.update?.(t, dt);
  const c = fx.cube;
  c.side += (c.target - c.side) * Math.min(1, dt * 3);
  c.mesh.visible = c.side > 0.05;
  const s = Math.max(c.side, 0.001);
  c.mesh.scale.set(s, s, s);
  c.mesh.position.set(c.at.x, s / 2, c.at.z);
  cubeTag.visible = c.mesh.visible;
  cubeTag.position.set(c.at.x, s + 0.8, c.at.z);
  for (const k of ['loop', 'mains', 'power']) if (fx[k].group.visible) fx[k].update(k === 'loop' ? t : t * 2);
  if (fx.vapor.group.visible) fx.vapor.update(t);
  if (fx.air.group.visible) fx.air.update(t);
  if (current === 'cooling' && coolView === 'apart') cc.update(coolMode, t);
  if (fx.env.group.visible) fx.env.update(t);
  if (fx.heat.group.visible) fx.heat.update(t);
  if (fx.noise.group.visible) fx.noise.update(t);
  if (td.root.visible) {
    tdK += (tdTarget - tdK) * Math.min(1, dt * 2.5);
    td.set(tdK);
    td.layers.forEach((l, i) => tdTags[i].position.copy(td.labelPos(l, tdK)));
  }
}

// ---------- video mode (?video): a script sets each shot and frame; see video/ ----------
const VIDEO = new URLSearchParams(location.search).has('video');
function setupVideo() {
  document.body.classList.add('video');
  const hideLabels = () => { labels.domElement.style.display = 'none'; globeLabels.domElement.style.display = 'none'; };
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
  const Y = new THREE.Vector3(0, 1, 0);
  let shot = null;
  window.__video = {
    // shot: { site, topic, vision, orbit (radians over the shot), dolly (end distance factor) }
    //    or { globe: [[lat, lon, dist], [lat, lon, dist]] }
    prepare(s) {
      tourStop();
      shot = s;
      if (s.globe) { setSite(null, { instant: true }); hideLabels(); return; }
      setVision(!!s.vision);
      setSite(s.site, { instant: true });
      if (s.topic) select(s.topic);
      if (flight) { camera.position.copy(flight.p1); controls.target.copy(flight.t1); flight = null; }
      card.hidden = true;
      hideLabels();
      const tg = controls.target.clone(), off = camera.position.clone().sub(tg);
      shot.cam = { tg, p0: camera.position.clone(), p1: tg.clone().add(off.applyAxisAngle(Y, s.orbit ?? 0.2).multiplyScalar(s.dolly ?? 0.9)) };
    },
    // k: 0..1 through the shot; time: seconds since the video started (drives the flowing orbs)
    render(k, time) {
      const e = ease(k);
      if (shot.globe) {
        const [a, b] = shot.globe;
        const p = toXYZ(a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e);
        globe.camera.position.copy(p);
        globe.camera.lookAt(0, 0, 0);
        renderer.render(globe.scene, globe.camera);
        return;
      }
      camera.position.lerpVectors(shot.cam.p0, shot.cam.p1, e);
      camera.lookAt(shot.cam.tg);
      t = time * 0.05;
      animateScene(1 / 30);
      renderer.render(scene, camera);
    },
    hum: (seconds) => renderHumWav(seconds),
    tour: { raunheim: TOUR, ideal: IDEAL_TOUR },
    sites: SITE_INFO,
  };
}

// open a part from the address, e.g. #water or #water/evaporative
const [h, sc] = decodeURIComponent(location.hash.slice(1)).split('/');
if (SCEN[sc]) scenario = sc;
const startSite = EXTRA[h] ? h : Object.keys(EXTRA).find((k) => EXTRA[k].topics.some((x) => x.id === h)) || (h ? 'raunheim' : null);
setSite(startSite, { instant: true });
applyFocus();
if (h && h !== 'raunheim' && !EXTRA[h] && (h === 'about' || find(h))) {
  if (h === 'jobs' && (sc === 'build' || sc === 'run')) jobsMode = sc;
  if (h === 'cooling' && ['legacy', 'today', 'future'].includes(sc)) coolMode = sc;
  if (h === 'cooling' && location.hash.includes('/apart')) coolView = 'apart';
  select(h);
  if (flight) { // opened from a link: jump straight there instead of flying
    camera.position.copy(flight.p1);
    controls.target.copy(flight.t1);
    flight = null;
  }
}
if (sc === 'promises' && startSite === 'ideal') setVision(true);
if (h === 'tour') tourStart();
if (VIDEO) setupVideo(); else frame();
