// "Cooling, taken apart": one rack and the chain that carries its heat outside, laid out in a row.
// Three chains: older (compressor air conditioning), today (water loop, as at FRA21), future
// (warm water straight to the chips). Typical designs, schematic; not FRA21's real equipment.
import * as THREE from 'three';
import { orbMaterial } from './orb.js';

export const STAGE = new THREE.Vector3(420, 0, 260);
const V = (x, y, z) => new THREE.Vector3(STAGE.x + x, y, STAGE.z + z);
const HOT = new THREE.Color(0xd9483b), WARM = new THREE.Color(0xe8a040), COOL = new THREE.Color(0x3d8fd6);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.15, ...extra });
const add = (g, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.copy(V(x, y, z)); o.castShadow = o.receiveShadow = true; g.add(o); return o; };

function rack(g, { coldPlates = false } = {}) {
  add(g, new THREE.BoxGeometry(1.2, 2.4, 1.2), mat(0x3a4249), 0, 1.2, 0);
  for (let i = 0; i < 10; i++) add(g, new THREE.BoxGeometry(1.1, 0.12, 1.15), mat(0x56616a), 0, 0.4 + i * 0.2, 0.03);
  const chip = add(g, new THREE.BoxGeometry(0.35, 0.05, 0.35), mat(0xd9483b, { emissive: 0xd9483b, emissiveIntensity: 0.8 }), 0, 2.55, 0);
  if (coldPlates) add(g, new THREE.BoxGeometry(0.45, 0.06, 0.45), mat(0xb8c4cc, { metalness: 0.7 }), 0, 2.6, 0);
  return chip;
}
function unit(g, x, w, h, d, color, fans = 0) {
  add(g, new THREE.BoxGeometry(w, h, d), mat(color), x, h / 2, 0);
  for (let i = 0; i < fans; i++) {
    const f = add(g, new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20), mat(0x3e4549, { metalness: 0.5 }), x - (fans - 1) * 0.65 + i * 1.3, h + 0.06, 0);
    f.userData.fan = true;
  }
}
// straight runs with short rounded bends, like real pipework
function polyline(points, r = 0.6) {
  const path = new THREE.CurvePath();
  let prev = points[0];
  for (let i = 1; i < points.length; i++) {
    const p = points[i], next = points[i + 1];
    if (!next) { path.add(new THREE.LineCurve3(prev, p)); break; }
    const a = p.clone().addScaledVector(p.clone().sub(prev).normalize(), -Math.min(r, p.distanceTo(prev) / 2));
    const b = p.clone().addScaledVector(next.clone().sub(p).normalize(), Math.min(r, p.distanceTo(next) / 2));
    path.add(new THREE.LineCurve3(prev, a));
    path.add(new THREE.QuadraticBezierCurve3(a, p, b));
    prev = b;
  }
  return path;
}
function tube(g, pts, color, r = 0.12) {
  const curve = polyline(pts.map((p) => V(...p)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, r, 8, false), mat(color, { roughness: 0.35, metalness: 0.3 })));
  return curve;
}
function dashedBox(g, x, w, h, d) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineDashedMaterial({ color: 0x7a3a10, dashSize: 0.3, gapSize: 0.2 }));
  e.computeLineDistances();
  e.position.copy(V(x, h / 2, 0));
  g.add(e);
}

// heat particles that change colour along a path: hot → warm → cool
function heatFlow(g, curve, n, stops) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const pts = new THREE.Points(geo, orbMaterial({ size: 0.35, vertexColors: true, depthTest: false }));
  pts.renderOrder = 7;
  g.add(pts);
  const tmp = new THREE.Vector3(), c = new THREE.Color();
  return (t) => {
    const p = geo.attributes.position, col = geo.attributes.color;
    for (let i = 0; i < n; i++) {
      const k = ((i / n) + t) % 1;
      curve.getPointAt(k, tmp);
      p.setXYZ(i, tmp.x, tmp.y, tmp.z);
      const [a, b, f] = k < stops[0] ? [HOT, HOT, 0] : k < stops[1] ? [HOT, WARM, (k - stops[0]) / (stops[1] - stops[0])] : [WARM, COOL, Math.min(1, (k - stops[1]) / (1 - stops[1]))];
      c.copy(a).lerp(b, f);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    p.needsUpdate = col.needsUpdate = true;
  };
}

export function buildCoolChains(scene) {
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(46, 0.4, 14), mat(0xe4e6e2));
  plinth.position.copy(V(16, 0.2, 0));
  plinth.receiveShadow = true;
  plinth.visible = false;
  scene.add(plinth);
  const chains = {};

  { // OLDER: room air conditioner with compressor, refrigerant to roof condenser
    const g = new THREE.Group();
    rack(g);
    unit(g, 8, 2.4, 2.8, 1.6, 0xc9cdcf);                 // room air conditioner (CRAC)
    add(g, new THREE.CylinderGeometry(0.6, 0.6, 1.1, 18), mat(0x8a2f1c, { emissive: 0x8a2f1c, emissiveIntensity: 0.35 }), 12, 0.95, 0); // compressor
    tube(g, [[12, 1, 0.3], [16, 1, 0.3], [20, 1, 0.3], [20, 6, 0.3], [27, 6, 0.3]], 0x9a7fb8);   // refrigerant line
    unit(g, 30, 4, 1.6, 2.4, 0xa3aaae, 2);              // roof condenser
    const air = new THREE.CatmullRomCurve3([V(0, 2.4, -0.6), V(0, 2.4, -1.4), V(4, 2.8, -1.2), V(8, 2.5, -0.9), V(8, 0.5, -0.9), V(4, 0.3, -1), V(0.5, 0.6, -0.8)], true);
    const ref = polyline([V(12, 1, 0.3), V(20, 1, 0.3), V(20, 6, 0.3), V(30, 6, 0.3), V(30, 9, 0), V(34, 12, 0)]);
    chains.legacy = { group: g, flows: [heatFlow(g, air, 70, [0.35, 0.6]), heatFlow(g, ref, 50, [0.15, 0.75])],
      labels: [['1 Chips heat the air', V(0, 3.3, 0)], ['2 Air conditioner', V(8, 3.4, 0)], ['3 Compressor: most of the cooling power', V(12, 2.0, 1.2)], ['4 Refrigerant to the roof', V(20, 7, 0.3)], ['5 Condenser fans: heat outside', V(30, 2.4, 0)]] };
  }
  { // TODAY: cooling unit with water coil, water loop to roof cooler, chiller only on hot days
    const g = new THREE.Group();
    rack(g);
    unit(g, 8, 2.4, 2.8, 1.6, 0xd6dadc);                 // cooling unit (CRAH) with water coil
    add(g, new THREE.BoxGeometry(0.8, 0.8, 0.8), mat(0x5f7d93), 13, 0.4, 0); // pump
    tube(g, [[8.8, 1.6, 0.4], [13, 1.6, 0.4], [20, 1.6, 0.4], [20, 6, 0.4], [28, 6, 0.4]], 0xd9774a, 0.14); // warm water up
    tube(g, [[28, 5.4, -0.4], [20, 5.4, -0.4], [20, 1.0, -0.4], [8.8, 1.0, -0.4]], 0x2f7fc1, 0.14);         // cool water back
    unit(g, 30, 4, 1.6, 2.4, 0xa3aaae, 2);              // roof dry cooler
    dashedBox(g, 24, 2.4, 2, 2);                          // chiller: only on hot days
    const air = new THREE.CatmullRomCurve3([V(0, 2.4, -0.6), V(0, 2.4, -1.4), V(4, 2.8, -1.2), V(8, 2.5, -0.9), V(8, 0.5, -0.9), V(4, 0.3, -1), V(0.5, 0.6, -0.8)], true);
    const water = polyline([V(8.8, 1.6, 0.4), V(20, 1.6, 0.4), V(20, 6, 0.4), V(30, 6, 0.4), V(30, 9, 0), V(34, 12, 0)]);
    chains.today = { group: g, flows: [heatFlow(g, air, 70, [0.35, 0.6]), heatFlow(g, water, 60, [0.05, 0.8])],
      labels: [['1 Chips heat the air', V(0, 3.3, 0)], ['2 Cooling unit: air across a water coil', V(8, 3.4, 0)], ['3 Pumps move the water', V(13, 1.4, 0)], ['4 Roof cooler fans: heat outside', V(30, 2.4, 0)], ['Chiller: only on hot days', V(24, -0.3, 1.4)]] };
  }
  { // FUTURE: warm water straight to cold plates on the chips, heat exchanger, roof cooler, no chiller
    const g = new THREE.Group();
    rack(g, { coldPlates: true });
    tube(g, [[0, 2.65, 0.15], [0, 3.2, 0.15], [5, 3.2, 0.15], [9, 2.2, 0.15]], 0xd9483b, 0.1); // hot water from chips
    tube(g, [[9, 1.6, -0.15], [5, 2.9, -0.15], [0, 2.9, -0.15], [0, 2.65, -0.15]], 0xe8a040, 0.1); // ~45 °C back to chips
    unit(g, 10, 1.6, 2.2, 1.2, 0xbfc7cc);                // heat exchanger (CDU)
    tube(g, [[10.8, 1.6, 0.4], [20, 1.6, 0.4], [20, 6, 0.4], [28, 6, 0.4]], 0xd9774a, 0.14);
    tube(g, [[28, 5.4, -0.4], [20, 5.4, -0.4], [20, 1.0, -0.4], [10.8, 1.0, -0.4]], 0xe8a040, 0.14);
    unit(g, 30, 4, 1.6, 2.4, 0xa3aaae, 2);
    const loop = polyline([V(0, 2.65, 0.15), V(0, 3.2, 0.15), V(5, 3.2, 0.15), V(9, 2.2, 0.15), V(10.8, 1.6, 0.4), V(20, 1.6, 0.4), V(20, 6, 0.4), V(30, 6, 0.4), V(30, 9, 0), V(34, 12, 0)]);
    chains.future = { group: g, flows: [heatFlow(g, loop, 90, [0.12, 0.85])],
      labels: [['1 Water flows over plates on the chips', V(0, -0.4, 1.4)], ['2 Leaves at about 45 °C', V(5, 3.7, 0)], ['3 Heat exchanger', V(10, 2.9, 0)], ['4 Roof cooler: no chiller in a mild climate', V(30, 2.4, 0)]] };
  }
  for (const c of Object.values(chains)) { c.group.visible = false; scene.add(c.group); }
  return {
    chains, plinth,
    view: { pos: [STAGE.x + 13, 22, STAGE.z + 54], target: [STAGE.x + 11, 3, STAGE.z] },
    show(mode) { plinth.visible = !!mode; for (const [k, c] of Object.entries(chains)) c.group.visible = k === mode; },
    update(mode, t) {
      const c = chains[mode];
      if (!c) return;
      c.flows.forEach((f) => f(t * 3));
      c.group.children.forEach((o) => { if (o.userData.fan) o.rotation.y += 0.25; });
    },
  };
}
