// Google's datacenter campus in The Dalles, Oregon.
// Real (OpenStreetMap): building outlines and positions, site areas, substations, power lines,
// river, lakes, roads. Estimated: building heights. Schematic: cooling tower positions, roof units.
import * as THREE from 'three';
import { orbMaterial } from './orb.js';
import geo from '../data/thedalles-geo.json';

export const ORIGIN = new THREE.Vector3(6000, 0, 0); // far from Raunheim in the same scene
export const DALLES_HEIGHT = 14; // estimated: heights are not mapped
const P = (x, z, y = 0) => new THREE.Vector3(ORIGIN.x + x, y, ORIGIN.z + z);

function shapeFrom(ring) {
  const s = new THREE.Shape();
  ring.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  return s;
}
function flat(ring, color, y, opts = {}) {
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(ring)), new THREE.MeshLambertMaterial({ color, ...opts }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(ORIGIN.x, y, ORIGIN.z);
  m.receiveShadow = true;
  return m;
}
function line(points, color, y, dashed = false) {
  const g = new THREE.BufferGeometry().setFromPoints(points.map(([x, z]) => P(x, z, y)));
  const l = new THREE.Line(g, dashed ? new THREE.LineDashedMaterial({ color, dashSize: 8, gapSize: 6 }) : new THREE.LineBasicMaterial({ color }));
  if (dashed) l.computeLineDistances();
  return l;
}
const centroid = (ring) => ring.reduce((a, [x, z]) => [a[0] + x / ring.length, a[1] + z / ring.length], [0, 0]);
const area = (ring) => Math.abs(ring.reduce((s, [x, z], i) => { const [x2, z2] = ring[(i + 1) % ring.length]; return s + x * z2 - x2 * z; }, 0)) / 2;
function inside([x, z], ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

export function buildDalles(scene) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const out = { root, hotspots: {} };

  const land = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: 0xd9cfb4 }));
  land.rotation.x = -Math.PI / 2;
  land.position.copy(ORIGIN);
  land.receiveShadow = true;
  root.add(land);
  geo.water.forEach((w) => root.add(flat(w.ring, 0x6f9fc4, 1.2, { polygonOffset: true, polygonOffsetFactor: -2 })));
  geo.roads.forEach((r) => root.add(line(r.line, r.kind.startsWith('motorway') ? 0x7d7a72 : 0xa39d8c, 0.5)));
  geo.sites.forEach((s) => { root.add(flat(s.ring, 0xe4ddc9, 0.6, { polygonOffset: true, polygonOffsetFactor: -1 })); root.add(line([...s.ring, s.ring[0]], 0x8a6a3a, 0.6, true)); });

  // buildings: real outlines, estimated height
  const bMat = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.85 });
  const smallMat = new THREE.MeshStandardMaterial({ color: 0xcfcac0, roughness: 0.9 });
  const unitMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a5, metalness: 0.3, roughness: 0.6 });
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x8c949a, roughness: 0.7 });
  const towerTops = [];
  const big = [];
  geo.buildings.forEach((b) => {
    const a = area(b.ring);
    const google = b.operator === 'Google' || a > 8000;
    const h = google ? DALLES_HEIGHT : 6;
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeFrom(b.ring), { depth: h, bevelEnabled: false }), google ? bMat : smallMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(ORIGIN.x, 0, ORIGIN.z);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    if (google && a > 8000) big.push({ ...b, a });
  });
  // schematic roof units on the big buildings, and a row of cooling-tower cells along each
  big.forEach((b) => {
    const xs = b.ring.map((p) => p[0]), zs = b.ring.map((p) => p[1]);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    for (let x = x0 + 8; x < x1 - 4; x += 14) for (let z = z0 + 8; z < z1 - 4; z += 12) {
      if (!inside([x, z], b.ring)) continue;
      const u = new THREE.Mesh(new THREE.BoxGeometry(6, 2.2, 4), unitMat);
      u.position.copy(P(x, z, DALLES_HEIGHT + 1.1));
      root.add(u);
    }
    const n = Math.max(3, Math.round((x1 - x0) / 16));
    for (let i = 0; i < n; i++) {
      const x = x0 + ((x1 - x0) / n) * (i + 0.5), z = z1 + 12;
      const t = new THREE.Mesh(new THREE.BoxGeometry(10, 9, 10), towerMat);
      t.position.copy(P(x, z, 4.5));
      t.castShadow = true;
      root.add(t);
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 2.4, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x5b6266, side: THREE.DoubleSide }));
      fan.position.copy(P(x, z, 10.2));
      root.add(fan);
      towerTops.push(P(x, z, 11.5));
    }
  });

  // substations (real outlines) with a few schematic transformers
  const subMat = new THREE.MeshStandardMaterial({ color: 0x7d8a84, metalness: 0.4 });
  geo.substations.forEach((s) => {
    root.add(flat(s.ring, 0xcfc6ad, 0.4));
    const [cx, cz] = centroid(s.ring);
    for (let i = -1; i <= 1; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(5, 4.5, 4), subMat);
      t.position.copy(P(cx + i * 9, cz, 2.25));
      t.castShadow = true;
      root.add(t);
    }
  });
  // high-voltage lines with pylons at the mapped vertices
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x8b8f92, metalness: 0.5 });
  geo.powerlines.forEach((l) => {
    root.add(line(l.line, 0x6a6a6a, 24));
    l.line.forEach(([x, z], i) => {
      if (i % 2) return;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.2, 24, 4), pylonMat);
      p.position.copy(P(x, z, 12));
      root.add(p);
    });
  });

  // steam plumes over the cooling towers (Google: 'Plumes of steam rise above our cooling towers')
  const N = towerTops.length * 14;
  const steamGeo = new THREE.BufferGeometry();
  steamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const steam = new THREE.Points(steamGeo, orbMaterial({ color: 0xffffff, size: 7, transparent: true, opacity: 0.55, depthWrite: false }));
  root.add(steam);
  const seeds = Array.from({ length: N }, (_, i) => ({ b: towerTops[i % towerTops.length], ph: (i * 0.618) % 1, dx: ((i * 37) % 11) - 5, dz: ((i * 53) % 11) - 5 }));
  out.updateSteam = (t, strength = 1) => {
    const a = steamGeo.attributes.position;
    seeds.forEach((s, i) => { const k = (s.ph + t * 1.5) % 1; a.setXYZ(i, s.b.x + s.dx * (1 + 3 * k) + k * 25, s.b.y + k * 45 * strength, s.b.z + s.dz * (1 + 3 * k)); });
    a.needsUpdate = true;
  };

  out.update = (t) => out.updateSteam(t);

  // a true-scale cube of one day's consumed water
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x1876b8, transparent: true, opacity: 0.65, roughness: 0.2 }));
  cube.castShadow = true;
  cube.visible = false;
  root.add(cube);
  const south = big.reduce((m, b) => (centroid(b.ring)[1] > centroid(m.ring)[1] ? b : m), big[0]);
  const [sx, sz] = centroid(south.ring);
  out.setCube = (m3) => {
    const s = Math.cbrt(m3);
    cube.scale.set(s, s, s);
    cube.position.copy(P(sx - 160, sz + 40, s / 2));
    cube.visible = m3 > 0;
    return P(sx - 160, sz + 40, s + 2);
  };

  // anchors
  const site = (name) => geo.sites.find((s) => s.name && s.name.includes(name));
  const c1 = centroid(site('Oregon').ring), c2 = centroid(site('Taylor').ring), c3 = centroid(geo.sites.find((s) => s.name === 'Google The Dalles Data Center').ring);
  const sub = centroid(geo.substations[0].ring);
  out.hotspots = {
    'd-cooling': P(c1[0], c1[1], 40),
    'd-water': P(sx - 160, sz + 40, 30),
    'd-power': P(sub[0], sub[1], 30),
    'd-backup': P(c3[0] - 60, c3[1], 34),
    'd-jobs': P(c3[0] + 80, c3[1] + 60, 30),
    'd-climate': P(c2[0], c2[1] - 200, 30),
  };
  out.labels = [
    ['Taylor Lake campus', P(c2[0], c2[1], 22)],
    ['Original campus (2006)', P(c1[0], c1[1] + 80, 22)],
    ['Newest campus, former aluminium smelter site', P(c3[0], c3[1] + 120, 22)],
    ['Columbia River', P(1500, -600, 4)],
  ];
  // frame all three campuses: centre of their combined outline, seen from the south-east
  const all = geo.sites.flatMap((x) => x.ring);
  const mx = (Math.min(...all.map((p) => p[0])) + Math.max(...all.map((p) => p[0]))) / 2;
  const mz = (Math.min(...all.map((p) => p[1])) + Math.max(...all.map((p) => p[1]))) / 2;
  out.home = { pos: P(mx + 1000, mz + 1350, 1350), target: P(mx, mz, 0) };
  out.views = {
    'd-cooling': { pos: P(c1[0] + 260, c1[1] + 260, 180), target: P(c1[0], c1[1], 10) },
    'd-water': { pos: P(sx + 120, sz + 260, 140), target: P(sx - 120, sz + 20, 10) },
    'd-power': { pos: P(sub[0] + 260, sub[1] + 300, 220), target: P(sub[0], sub[1], 0) },
    'd-backup': { pos: P(c3[0] + 300, c3[1] + 320, 220), target: P(c3[0], c3[1], 0) },
    'd-jobs': { pos: P(c3[0] + 400, c3[1] + 400, 300), target: P(c3[0], c3[1], 0) },
    'd-climate': { pos: P(900, 900, 1100), target: P(-200, -500, 0) },
    'd-compare': null,
  };
  return out;
}
