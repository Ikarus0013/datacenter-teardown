// The ideal datacenter: a fictional campus near Luleå, Sweden.
// Everything here is schematic: the layout, building sizes and the landscape are made up for the model.
// What the model shows is *which* technology is used; the figures live in data/ideal.json.
// Solid = proven somewhere today. See-through blue "ghosts" = promised or research (shown with the switch).
import * as THREE from 'three';
import { orbMaterial } from './orb.js';

export const ORIGIN = new THREE.Vector3(-6000, 0, 0);
const P = (x, z, y = 0) => new THREE.Vector3(ORIGIN.x + x, y, ORIGIN.z + z);
const T = (x, z, y = 0, sy = 1, ry = 0) => new THREE.Matrix4().compose(P(x, z, y), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, sy, 1));

// a small seeded random, so the forest looks the same every time
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export const HALL = { w: 240, d: 64, h: 20, r: 7 };
export const HALLS = [-75, 75].flatMap((z) => [-280, 0, 280].map((x) => ({ x, z })));
const CUT = 2; // the hall that opens up to show the racks (x 280, z -75)

function hallGeometry() {
  const { w, d, h, r } = HALL;
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0);
  s.lineTo(d / 2, 0);
  s.lineTo(d / 2, h - r);
  s.quadraticCurveTo(d / 2, h, d / 2 - r, h);
  s.lineTo(-d / 2 + r, h);
  s.quadraticCurveTo(-d / 2, h, -d / 2, h - r);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -w / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

function tube(points, radius, mat) {
  const path = new THREE.CurvePath();
  for (let i = 0; i < points.length - 1; i++) path.add(new THREE.LineCurve3(points[i], points[i + 1]));
  const m = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(8, points.length * 24), radius, 10, false), mat);
  m.castShadow = true;
  return m;
}

// orbs travelling along a polyline
function orbFlow(root, points, n, color, size) {
  const curve = new THREE.CurvePath();
  for (let i = 0; i < points.length - 1; i++) curve.add(new THREE.LineCurve3(points[i], points[i + 1]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const pts = new THREE.Points(g, orbMaterial({ color, size }));
  root.add(pts);
  const tmp = new THREE.Vector3();
  return (t, speed = 1) => {
    const a = g.attributes.position;
    for (let i = 0; i < n; i++) { curve.getPointAt((i / n + t * speed) % 1, tmp); a.setXYZ(i, tmp.x, tmp.y, tmp.z); }
    a.needsUpdate = true;
  };
}

export function buildIdeal(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const out = { root, flows: [] };
  const add = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; root.add(m); return m; };

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
  const shellMat = mat(0xf4f3ef, { roughness: 0.6 });
  const cutMat = mat(0xf4f3ef, { roughness: 0.6, transparent: true });
  const timberMat = mat(0xc7a479, { roughness: 0.8 });
  const glassMat = mat(0x9dbccc, { roughness: 0.12, metalness: 0.25 });
  const roofMat = mat(0x9db68a, { roughness: 0.95 });
  const unitMat = mat(0xdfe2e2, { roughness: 0.5, metalness: 0.2 });
  const fanMat = mat(0x58616a, { metalness: 0.4 });
  const ghostMat = new THREE.MeshStandardMaterial({ color: 0x7fa8d8, transparent: true, opacity: 0.32, roughness: 0.2, depthWrite: false });
  const ghostEdge = new THREE.LineDashedMaterial({ color: 0x3f73b0, dashSize: 3, gapSize: 2 });
  const ghosts = [];
  const ghost = (geo, pos) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, ghostMat);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), ghostEdge);
    e.computeLineDistances();
    g.add(m, e);
    g.position.copy(pos);
    g.visible = false;
    root.add(g);
    ghosts.push(g);
    return g;
  };

  // ---- landscape (schematic) ----
  add(new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), mat(0xd5dfcc, { roughness: 1 })), false).rotation.x = -Math.PI / 2;
  root.children.at(-1).position.copy(ORIGIN);
  const sea = new THREE.Shape();
  [[700, -3500], [820, -1400], [640, -700], [760, -250], [700, 300], [860, 900], [760, 1600], [980, 3500], [3500, 3500], [3500, -3500]]
    .forEach(([x, z], i) => (i ? sea.lineTo(x, -z) : sea.moveTo(x, -z)));
  const seaMesh = add(new THREE.Mesh(new THREE.ShapeGeometry(sea, 24), mat(0xa9c5d2, { roughness: 0.3, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 })), false);
  seaMesh.rotation.x = -Math.PI / 2;
  seaMesh.position.set(ORIGIN.x, 0.3, ORIGIN.z);
  // a calm campus ground
  const pad = add(new THREE.Mesh(new THREE.PlaneGeometry(1260, 560), mat(0xe6e8e0, { roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 })), false);
  pad.rotation.x = -Math.PI / 2;
  pad.position.copy(P(-60, 0, 0.2));

  // ---- halls: rounded shells, timber fins, glass ribbon, green roofs ----
  const hg = hallGeometry();
  const { w, d, h, r } = HALL;
  const fins = [], units = [], fans = [];
  HALLS.forEach((H, i) => {
    const shell = add(new THREE.Mesh(hg, i === CUT ? cutMat : shellMat));
    shell.position.copy(P(H.x, H.z));
    const roof = add(new THREE.Mesh(new THREE.BoxGeometry(w - 6, 0.7, d - 2 * r), roofMat), false);
    roof.position.copy(P(H.x, H.z, h + 0.3));
    if (i === CUT) out.cutRoof = roof;
    for (const side of [-1, 1]) {
      const band = add(new THREE.Mesh(new THREE.BoxGeometry(w - 2, 3.2, 0.3), glassMat), false);
      band.position.copy(P(H.x, H.z + side * (d / 2 + 0.15), 1.8));
      for (let x = -w / 2 + 3; x <= w / 2 - 3; x += 2.4) fins.push(T(H.x + x, H.z + side * (d / 2 + 0.7), 4 + (h - 9) / 2));
    }
    for (const end of [-1, 1]) {
      const g = add(new THREE.Mesh(new THREE.BoxGeometry(0.4, h - 5, d - 14), glassMat), false);
      g.position.copy(P(H.x + end * (w / 2 + 0.2), H.z, (h - 5) / 2));
    }
    // dry coolers on the roof: no water sprayed, no cooling towers
    for (const zr of [-13, 13]) for (let x = -w / 2 + 14; x <= w / 2 - 14; x += 17) {
      units.push(T(H.x + x, H.z + zr, h + 1.9));
      fans.push(T(H.x + x - 3, H.z + zr, h + 3.25), T(H.x + x + 3, H.z + zr, h + 3.25));
    }
  });
  const inst = (geo, m, list, cast = true) => {
    const im = new THREE.InstancedMesh(geo, m, list.length);
    list.forEach((x, i) => im.setMatrixAt(i, x));
    im.castShadow = cast;
    im.receiveShadow = true;
    root.add(im);
    return im;
  };
  inst(new THREE.BoxGeometry(0.5, h - 9, 1.3), timberMat, fins, false);
  inst(new THREE.BoxGeometry(12, 2.6, 6), unitMat, units);
  inst(new THREE.CylinderGeometry(2.3, 2.3, 0.3, 18), fanMat, fans, false);

  // racks inside the open hall, with a coolant line above each row
  const C = HALLS[CUT], racks = [], lines = [];
  for (let z = -24; z <= 24; z += 4) {
    for (let x = -w / 2 + 12; x <= w / 2 - 12; x += 0.7) racks.push(T(C.x + x, C.z + z, 1.2));
    lines.push(z);
  }
  out.racks = inst(new THREE.BoxGeometry(0.6, 2.4, 1.2), mat(0x4f5a63, { roughness: 0.45 }), racks, false);
  const lineMat = mat(0xd9824a, { roughness: 0.4, emissive: 0x6a2a08, emissiveIntensity: 0.25 });
  out.rackLines = new THREE.Group();
  lines.forEach((z) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, w - 24, 8), lineMat);
    m.rotation.z = Math.PI / 2;
    m.position.copy(P(C.x, C.z + z, 3.2));
    out.rackLines.add(m);
  });
  root.add(out.rackLines);

  // ---- the spine: a glass canopy over the coolant pipes ----
  const spine = add(new THREE.Mesh(new THREE.BoxGeometry(880, 0.5, 26), mat(0xcfe0e6, { transparent: true, opacity: 0.45, roughness: 0.1 })), false);
  spine.position.copy(P(30, 0, 10));
  const colGeo = new THREE.CylinderGeometry(0.35, 0.35, 10, 8);
  const cols = [];
  for (let x = -410; x <= 470; x += 40) cols.push(T(x, -12, 5), T(x, 12, 5));
  inst(colGeo, mat(0xd8d8d2), cols, false);
  const warm = mat(0xd9824a, { roughness: 0.4 }), cool = mat(0x5f97c2, { roughness: 0.4 });
  const sup = [P(-400, -4, 3), P(470, -4, 3)], ret = [P(-400, 4, 3), P(470, 4, 3)];
  add(tube(sup, 1.3, cool));
  add(tube(ret, 1.3, warm));
  HALLS.forEach((H) => {
    const s = Math.sign(H.z);
    // warm water from the hall joins the return pipe (z +4); cool water comes from the supply pipe (z −4)
    add(tube([P(H.x - 6, 4, 3), P(H.x - 6, H.z - s * d / 2, 3)], 0.9, warm));
    add(tube([P(H.x + 6, -4, 3), P(H.x + 6, H.z - s * d / 2, 3)], 0.9, cool));
    out.flows.push(orbFlow(root, [P(H.x - 6, H.z - s * d / 2, 5.2), P(H.x - 6, 4, 5.2), P(500, 4, 5.2)], 26, 0xe0874c, 3));
  });

  // ---- heat pump station: lifts the warm water to district-heating temperature ----
  const hp = add(new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 16, 48), shellMat));
  hp.position.copy(P(510, 0, 8));
  add(new THREE.Mesh(new THREE.CylinderGeometry(30.3, 30.3, 3.5, 48, 1, true), glassMat), false).position.copy(P(510, 0, 2));
  add(new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 0.8, 48), roofMat), false).position.copy(P(510, 0, 16.4));
  // the district heating pipe to town (route schematic)
  const route = [[540, -10], [600, -220], [420, -620], [60, -1150], [-120, -1380]];
  const hotRoute = route.map(([x, z]) => P(x - 3, z, 1.6)), backRoute = route.map(([x, z]) => P(x + 3, z, 1.6));
  add(tube(hotRoute, 1.1, mat(0xc85a3c, { roughness: 0.5 })));
  add(tube(backRoute, 1.1, cool));
  out.flows.push(orbFlow(root, route.map(([x, z]) => P(x - 3, z, 4)), 70, 0xd2553a, 5));
  out.heatPipeEnd = P(-120, -1380, 0);

  // ---- the town (schematic houses) ----
  const houses = [], blocks = [];
  seed = 11;
  for (let i = 0; i < 260; i++) {
    const a = rnd() * Math.PI * 2, rr = 60 + Math.sqrt(rnd()) * 420;
    const x = -150 + Math.cos(a) * rr * 1.3, z = -1560 + Math.sin(a) * rr * 0.8;
    (rr < 170 && i % 3 === 0 ? blocks : houses).push(T(x, z, 0, 1, rnd() * Math.PI));
  }
  const houseGeo = new THREE.BoxGeometry(10, 7, 8); houseGeo.translate(0, 3.5, 0);
  const blockGeo = new THREE.BoxGeometry(22, 18, 16); blockGeo.translate(0, 9, 0);
  const hm = inst(houseGeo, mat(0xffffff), houses);
  const hcol = [0xa4473a, 0xe8e2d4, 0xd9b45c, 0xb9c3c8];
  houses.forEach((_, i) => hm.setColorAt(i, new THREE.Color(hcol[i % hcol.length])));
  inst(blockGeo, mat(0xe4e1da), blocks);

  // ---- power: lines from the grid, a substation ----
  const subPad = add(new THREE.Mesh(new THREE.BoxGeometry(100, 0.6, 80), mat(0xcfccc2)), false);
  subPad.position.copy(P(-560, 0, 0.3));
  const trafos = [];
  for (let i = 0; i < 4; i++) for (const zz of [-18, 18]) trafos.push(T(-590 + i * 20, zz, 3));
  inst(new THREE.BoxGeometry(8, 6, 6), mat(0x8c9993, { metalness: 0.4 }), trafos);
  const line = [[-610, 0], [-900, -60], [-1250, -130], [-1600, -200], [-1950, -270], [-2300, -340], [-2650, -410]];
  const pyl = [];
  line.forEach(([x, z]) => pyl.push(T(x, z, 15)));
  inst(new THREE.CylinderGeometry(0.5, 1.6, 30, 4), mat(0x9a9fa3, { metalness: 0.5 }), pyl);
  const arms = [];
  line.forEach(([x, z]) => arms.push(T(x, z, 28)));
  inst(new THREE.BoxGeometry(1, 0.8, 16), mat(0x9a9fa3, { metalness: 0.5 }), arms, false);
  for (const off of [-7, 7]) root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(line.map(([x, z]) => P(x, z + off, 27.5))), new THREE.LineBasicMaterial({ color: 0x6b6f72 })));
  add(tube([P(-560, 0, 8), P(-410, 0, 8)], 0.8, mat(0x8d9499, { metalness: 0.4 })));
  out.flows.push(orbFlow(root, [...line].reverse().map(([x, z]) => P(x, z, 28)).concat([P(-560, 0, 8), P(-410, 0, 8)]), 60, 0xf0bf45, 5));

  // ---- backup: batteries instead of diesel generators ----
  const cont = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 8; j++) cont.push(T(-520 + i * 16, 150 + j * 9, 1.4));
  inst(new THREE.BoxGeometry(12, 2.8, 2.6), mat(0xf1f2f0, { roughness: 0.5 }), cont);
  const vents = cont.map((m) => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 1.45, 0)));
  inst(new THREE.BoxGeometry(10, 0.15, 1.4), mat(0x6e777d), vents, false);

  // ---- promised / research ghosts (shown with the switch) ----
  // small modular reactor: promised by several companies, none runs a datacenter yet
  ghost(new THREE.CylinderGeometry(22, 22, 26, 40), P(-700, -250, 13));
  ghost(new THREE.SphereGeometry(22, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), P(-700, -250, 26));
  ghost(new THREE.BoxGeometry(60, 14, 34), P(-640, -250, 7));
  // hydrogen fuel cells: tested by Microsoft in 2022 (research)
  for (let i = 0; i < 3; i++) ghost(new THREE.BoxGeometry(12, 2.8, 2.6), P(-400, 160 + i * 9, 1.4));
  for (let i = 0; i < 2; i++) { const t = ghost(new THREE.CylinderGeometry(2.2, 2.2, 18, 20), P(-400, 196 + i * 6, 2.4)); t.rotation.z = Math.PI / 2; }
  out.setVision = (on) => ghosts.forEach((g) => { g.visible = on; });

  // ---- trees: birch and spruce, kept clear of the campus, sea, town and pipe ----
  seed = 3;
  const trunks = [], crowns = [], spruces = [];
  const nearRoute = (x, z) => route.some(([a, b], i) => {
    if (!route[i + 1]) return false;
    const [c, e] = route[i + 1], vx = c - a, vz = e - b, t = Math.max(0, Math.min(1, ((x - a) * vx + (z - b) * vz) / (vx * vx + vz * vz)));
    return Math.hypot(x - a - t * vx, z - b - t * vz) < 22;
  });
  for (let i = 0; i < 6500; i++) {
    const x = -2400 + rnd() * 3000, z = -2400 + rnd() * 4600;
    if (x > 600) continue;
    if (x > -760 && x < 610 && z > -330 && z < 300) continue;
    if (Math.hypot((x + 150) / 1.3, (z + 1560) / 0.8) < 520) continue;
    if (nearRoute(x, z)) continue;
    if (Math.abs(z - (-0.2 * (x + 600))) < 25 && x < -600) continue; // power line corridor
    const s = 0.8 + rnd() * 0.6;
    if (rnd() < 0.55) { trunks.push(T(x, z, 4.5 * s, s)); crowns.push(T(x, z, 10 * s, s)); } else spruces.push(T(x, z, 7 * s, s));
  }
  inst(new THREE.CylinderGeometry(0.25, 0.35, 9, 5), mat(0xece9e2), trunks, false);
  const crownGeo = new THREE.IcosahedronGeometry(3.2, 0); crownGeo.scale(1, 1.5, 1);
  inst(crownGeo, mat(0xb4c897, { flatShading: true }), crowns);
  inst(new THREE.ConeGeometry(3.4, 14, 6), mat(0x5f7d62, { flatShading: true }), spruces);

  // ---- the water block (to scale, one day) ----
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x1876b8, transparent: true, opacity: 0.65, roughness: 0.2 }));
  cube.castShadow = true;
  cube.visible = false;
  root.add(cube);
  out.setCube = (m3) => {
    const s = Math.cbrt(Math.max(m3, 0));
    cube.scale.set(s || 1, s || 1, s || 1);
    cube.position.copy(P(150, 165, s / 2));
    cube.visible = m3 > 0;
    return P(150, 165, s + 3);
  };

  // ---- focus: open one hall for cooling and chips ----
  out.focus = (id) => {
    const open = id === 'i-cooling' || id === 'i-chips';
    cutMat.opacity = open ? 0.12 : 1;
    cutMat.depthWrite = !open;
    cutMat.needsUpdate = true;
    out.cutRoof.visible = !open;
  };
  out.update = (t) => out.flows.forEach((f, i) => f(t, i < HALLS.length ? 3 : 1.2));

  // ---- anchors, labels and views ----
  out.hotspots = {
    'i-scale': P(0, -75, 40),
    'i-cooling': P(250, -100, 34),
    'i-chips': P(330, -60, 30),
    'i-water': P(150, 165, 34),
    'i-heat': P(510, 0, 34),
    'i-power': P(-570, 0, 34),
    'i-backup': P(-480, 190, 22),
    'i-building': P(-280, 110, 34),
    'i-flex': P(-900, -60, 40),
  };
  out.labels = [
    ['Town with district heating (schematic)', P(-150, -1560, 40)],
    ['Gulf of Bothnia', P(1400, 200, 4)],
    ['To the grid', P(-1600, -200, 40)],
  ];
  out.visionLabels = [
    ['Promised: small nuclear reactor', P(-700, -250, 52)],
    ['Research: hydrogen fuel cells', P(-400, 200, 14)],
  ];
  out.home = { pos: P(1050, 820, 760), target: P(-80, -260, 0) };
  out.views = {
    'i-scale': { pos: P(560, 460, 330), target: P(-20, -20, 0) },
    'i-cooling': { pos: P(420, 40, 95), target: P(270, -75, 6) },
    'i-chips': { pos: P(345, -40, 38), target: P(285, -75, 2) },
    'i-water': { pos: P(330, 380, 120), target: P(130, 140, 8) },
    'i-heat': { pos: P(1150, 300, 900), target: P(200, -700, 0) },
    'i-power': { pos: P(-260, 330, 230), target: P(-640, -60, 0) },
    'i-backup': { pos: P(-260, 380, 120), target: P(-450, 190, 0) },
    'i-building': { pos: P(-170, 230, 50), target: P(-290, 75, 10) },
    'i-flex': { pos: P(-500, 700, 700), target: P(-1100, -120, 0) },
  };
  return out;
}
