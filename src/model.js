// The 3D site. Real, published sizes are used where they exist (stack height, tank volume,
// generator count, storeys, water volume); everything else is schematic.
import * as THREE from 'three';

// Every material belongs to one group, so a group can be faded on its own.
const groupMats = {};
export function M(group, color, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...opts });
  m.userData.baseOpacity = opts.opacity ?? 1;
  (groupMats[group] ||= []).push(m);
  return m;
}
export function setGroupOpacity(group, o) {
  for (const m of groupMats[group] || []) {
    const op = m.userData.baseOpacity * o;
    m.transparent = op < 1;
    m.opacity = op;
    m.depthWrite = op >= 0.99;
    m.needsUpdate = true;
  }
}
export const GROUPS = () => Object.keys(groupMats);

// deterministic pseudo-random so the layout is identical on every load
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function mesh(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
function instanced(geo, mat, matrices, parent, shadow = true) {
  const im = new THREE.InstancedMesh(geo, mat, matrices.length);
  matrices.forEach((mx, i) => im.setMatrixAt(i, mx));
  im.castShadow = shadow;
  im.receiveShadow = true;
  parent.add(im);
  return im;
}
const T = (x, y, z, ry = 0, s = [1, 1, 1]) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(...s));

// Building footprints (metres)
export const FRA21 = { x: -55, z: 0, w: 110, d: 75, h: 24, storeys: 4 }; // 33,000 m² ÷ 4 storeys ≈ 8,250 m² footprint
export const FRA22 = { x: 55, z: -5, w: 80, d: 60, h: 14 };              // storeys not published: schematic
export const PLOT = { x0: -117, x1: 103, z0: -63, z1: 73 };              // ≈ 3 ha, shape schematic

export function buildSite(scene, facts) {
  const root = new THREE.Group();
  scene.add(root);
  const out = { root, hotspots: {}, glass: [] };

  // ---------- land, roads, plot ----------
  const land = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), M('site', 0xd3d9cc));
  land.rotation.x = -Math.PI / 2;
  land.receiveShadow = true;
  root.add(land);
  const plot = new THREE.Mesh(new THREE.PlaneGeometry(PLOT.x1 - PLOT.x0, PLOT.z1 - PLOT.z0), M('site', 0xe2e3df));
  plot.rotation.x = -Math.PI / 2;
  plot.position.set((PLOT.x0 + PLOT.x1) / 2, 0.05, (PLOT.z0 + PLOT.z1) / 2);
  plot.receiveShadow = true;
  root.add(plot);
  out.land = land;
  out.plot = plot;
  const roadMat = M('site', 0x8f9493);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(900, 12), roadMat);
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.08, PLOT.z1 + 14); road.receiveShadow = true; root.add(road);
  const road2 = new THREE.Mesh(new THREE.PlaneGeometry(10, 600), roadMat);
  road2.rotation.x = -Math.PI / 2; road2.position.set(PLOT.x0 - 14, 0.08, 0); road2.receiveShadow = true; root.add(road2);
  // lane markings
  const dash = [];
  for (let x = -440; x < 440; x += 9) dash.push(T(x, 0.12, PLOT.z1 + 14));
  instanced(box(4, 0.02, 0.25), M('site', 0xf1f1ec), dash, root, false);

  // fence posts around the plot
  const posts = [];
  const edge = (ax, az, bx, bz) => {
    const n = Math.round(Math.hypot(bx - ax, bz - az) / 4);
    for (let i = 0; i <= n; i++) posts.push(T(ax + (bx - ax) * i / n, 1.25, az + (bz - az) * i / n));
  };
  edge(PLOT.x0, PLOT.z0, PLOT.x1, PLOT.z0); edge(PLOT.x1, PLOT.z0, PLOT.x1, PLOT.z1);
  edge(PLOT.x1, PLOT.z1, PLOT.x0, PLOT.z1); edge(PLOT.x0, PLOT.z1, PLOT.x0, PLOT.z0);
  instanced(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 5), M('site', 0x5f6669), posts, root, false);
  const fenceLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
    [[PLOT.x0, PLOT.z0], [PLOT.x1, PLOT.z0], [PLOT.x1, PLOT.z1], [PLOT.x0, PLOT.z1]].map(([x, z]) => new THREE.Vector3(x, 2.4, z))),
    new THREE.LineBasicMaterial({ color: 0x5f6669 }));
  root.add(fenceLine);

  // trees outside the fence
  const trunks = [], crowns = [];
  for (let i = 0; i < 140; i++) {
    let x, z;
    const side = i % 4;
    if (side === 0) { x = PLOT.x0 - 30 - rnd() * 60; z = PLOT.z0 + rnd() * (PLOT.z1 - PLOT.z0); }
    else if (side === 1) { x = PLOT.x1 + 10 + rnd() * 70; z = PLOT.z0 + rnd() * (PLOT.z1 - PLOT.z0 + 40); }
    else if (side === 2) { x = PLOT.x0 + rnd() * (PLOT.x1 - PLOT.x0); z = PLOT.z0 - 10 - rnd() * 60; }
    else { x = PLOT.x0 - 60 + rnd() * 300; z = PLOT.z1 + 26 + rnd() * 40; }
    const s = 0.8 + rnd() * 0.7;
    if (x > -122 && x < -18 && z > PLOT.z1 + 18) continue; // keep the parking lot clear
    if (x > -205 && x < -145 && z > -100 && z < -40) continue; // and the tower plot
    if (x > -45 && x < 15 && z < -70) continue; // keep the cooling view clear
    trunks.push(T(x, 1.5 * s, z, 0, [s, s, s]));
    crowns.push(T(x, 6 * s, z, rnd() * 3, [s, s * (0.9 + rnd() * 0.4), s]));
  }
  const trees = new THREE.Group();
  root.add(trees);
  instanced(new THREE.CylinderGeometry(0.35, 0.45, 3, 6), M('site', 0x6b5a48), trunks, trees);
  instanced(new THREE.IcosahedronGeometry(3.6, 0), M('site', 0x7d9473, { flatShading: true }), crowns, trees);

  // parking with cars
  const cars = [], carCols = [0x3b4652, 0xb8bcc0, 0x7c2f2f, 0xe6e6e1, 0x2f4f6b, 0x555b60];
  const carGeo = box(1.9, 1.4, 4.4);
  const carMats = carCols.map((c) => M('site', c, { metalness: 0.4, roughness: 0.4 }));
  const perColour = carCols.map(() => []);
  let k = 0;
  for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) {
    if (rnd() < 0.3) continue;
    perColour[k++ % carCols.length].push(T(-112 + i * 2.6, 0.7, 48 + r * 8));
  }
  perColour.forEach((list, i) => list.length && instanced(carGeo, carMats[i], list, root));
  const markings = [];
  for (let r = 0; r < 3; r++) for (let i = 0; i <= 9; i++) markings.push(T(-113.3 + i * 2.6, 0.1, 48 + r * 8));
  instanced(box(0.12, 0.02, 5), M('site', 0xf4f4ef), markings, root, false);

  // ---------- buildings ----------
  function hall(b, group, { stairs = true } = {}) {
    const g = new THREE.Group();
    root.add(g);
    const shell = M(group, 0xeeeeea);
    mesh(box(b.w, b.h, b.d), shell, b.x, b.h / 2, b.z, g);
    // parapet
    const par = M(group, 0xd5d7d2);
    mesh(box(b.w + 0.6, 1.2, 0.6), par, b.x, b.h + 0.6, b.z - b.d / 2, g);
    mesh(box(b.w + 0.6, 1.2, 0.6), par, b.x, b.h + 0.6, b.z + b.d / 2, g);
    mesh(box(0.6, 1.2, b.d), par, b.x - b.w / 2, b.h + 0.6, b.z, g);
    mesh(box(0.6, 1.2, b.d), par, b.x + b.w / 2, b.h + 0.6, b.z, g);
    // vertical facade panel seams
    const seams = [];
    for (let x = b.x - b.w / 2 + 6; x < b.x + b.w / 2; x += 6) {
      seams.push(T(x, b.h / 2, b.z - b.d / 2 - 0.1), T(x, b.h / 2, b.z + b.d / 2 + 0.1));
    }
    for (let z = b.z - b.d / 2 + 6; z < b.z + b.d / 2; z += 6) {
      seams.push(T(b.x - b.w / 2 - 0.1, b.h / 2, z, Math.PI / 2), T(b.x + b.w / 2 + 0.1, b.h / 2, z, Math.PI / 2));
    }
    instanced(box(0.25, b.h, 0.25), M(group, 0xc8cbc6), seams, g, false);
    // horizontal storey lines
    const floors = Math.round(b.h / 6);
    for (let i = 1; i < floors; i++) mesh(box(b.w + 0.3, 0.3, b.d + 0.3), M(group, 0xc8cbc6), b.x, (b.h / floors) * i, b.z, g);
    // stair towers with window slits at two corners
    if (stairs) {
      const st = M(group, 0xdcdedb);
      const win = M(group, 0x5d7385, { roughness: 0.15, metalness: 0.6 });
      out.glass.push(win);
      for (const [sx, sz] of [[b.x - b.w / 2 + 4, b.z + b.d / 2 + 2], [b.x + b.w / 2 - 4, b.z - b.d / 2 - 2]]) {
        mesh(box(6, b.h + 3, 4), st, sx, (b.h + 3) / 2, sz, g);
        const slits = [];
        for (let y = 2.5; y < b.h; y += 3) slits.push(T(sx, y, sz + Math.sign(sz - b.z) * 2.05));
        instanced(box(1.2, 1.8, 0.1), win, slits, g, false);
      }
    }
    // louvred intake panels along the long faces
    const louv = M(group, 0xa9aeac, { metalness: 0.3 });
    const slats = [];
    for (let x = b.x - b.w / 2 + 10; x < b.x + b.w / 2 - 10; x += 14)
      for (let y = 1.5; y < 5; y += 0.6) slats.push(T(x, y, b.z - b.d / 2 - 0.2));
    instanced(box(8, 0.12, 0.35), louv, slats, g, false);
    return g;
  }
  out.fra21 = hall(FRA21, 'building');
  out.fra22 = hall(FRA22, 'building');

  // office block with full glazing (where people work; data halls themselves are usually windowless)
  function office(x, z, w, d, h) {
    const o = new THREE.Group();
    root.add(o);
    mesh(box(w, h, d), M('building', 0xe8e9e6), x, h / 2, z, o);
    mesh(box(w + 1, 0.6, d + 1), M('building', 0xcfd2cd), x, h + 0.3, z, o);
    const glass = M('building', 0x6c8597, { roughness: 0.1, metalness: 0.7 });
    out.glass.push(glass);
    const panes = [];
    const floors = Math.floor(h / 3.6);
    for (let f = 0; f < floors; f++) {
      const y = 1.9 + f * 3.6;
      for (let px = x - w / 2 + 1.5; px <= x + w / 2 - 1.5; px += 2.2) {
        panes.push(T(px, y, z + d / 2 + 0.06), T(px, y, z - d / 2 - 0.06));
      }
      for (let pz = z - d / 2 + 1.5; pz <= z + d / 2 - 1.5; pz += 2.2) {
        panes.push(T(x + w / 2 + 0.06, y, pz, Math.PI / 2), T(x - w / 2 - 0.06, y, pz, Math.PI / 2));
      }
    }
    instanced(box(1.9, 2.5, 0.08), glass, panes, o, false);
    // entrance canopy
    mesh(box(8, 0.4, 4), M('building', 0x9aa0a2), x, 4, z + d / 2 + 2, o);
    return o;
  }
  office(-18, 46, 30, 16, 18);
  office(88, 30, 14, 10, 11);

  // ---------- server racks inside FRA21 (only shown when looking at the halls) ----------
  const racks = new THREE.Group();
  racks.visible = false;
  root.add(racks);
  const rackM = [], rackGeo = box(0.7, 2.2, 1.1);
  const coldStrips = [], hotStrips = [];
  for (let zr = -30; zr <= 30; zr += 5) {
    for (let x = FRA21.x - FRA21.w / 2 + 4; x < FRA21.x + FRA21.w / 2 - 4; x += 0.75) {
      rackM.push(T(x, 1.15, zr - 1.1), T(x, 1.15, zr + 1.1));
    }
    coldStrips.push(T(FRA21.x, 0.08, zr, 0, [FRA21.w - 8, 1, 1]));
    hotStrips.push(T(FRA21.x, 0.08, zr + 2.5, 0, [FRA21.w - 8, 1, 1]));
  }
  instanced(rackGeo, M('it', 0x56616a, { roughness: 0.5 }), rackM, racks, false);
  instanced(box(1, 0.02, 1.4), M('it', 0x7fb3d9), coldStrips, racks, false);
  instanced(box(1, 0.02, 1.4), M('it', 0xd99a7f), hotStrips, racks, false);
  mesh(box(FRA21.w - 2, 0.2, FRA21.d - 2), M('it', 0xbfc3c0), FRA21.x, 0.0, FRA21.z, racks);
  // little status lights
  const leds = [];
  for (let i = 0; i < rackM.length; i += 3) {
    const p = new THREE.Vector3().setFromMatrixPosition(rackM[i]);
    leds.push(T(p.x, 1.6 + rnd() * 0.4, p.z + (p.z % 5 > 0 ? 0.56 : -0.56)));
  }
  instanced(box(0.15, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: 0x5fe08a }), leds, racks, false);
  out.racks = racks;

  // ---------- cooling: roof coolers with fans + roof pipes ----------
  const coolers = new THREE.Group();
  root.add(coolers);
  const cBody = [], cFan = [], coolerTops = [];
  function coolerGrid(b, nx, nz) {
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = b.x - b.w / 2 + (b.w / nx) * (i + 0.5), z = b.z - b.d / 2 + (b.d / nz) * (j + 0.5);
      cBody.push(T(x, b.h + 1.6, z));
      cFan.push(T(x - 2.2, b.h + 3.25, z), T(x + 2.2, b.h + 3.25, z));
      coolerTops.push(new THREE.Vector3(x, b.h + 3.4, z));
    }
  }
  coolerGrid(FRA21, 7, 4);
  coolerGrid(FRA22, 4, 3); // FRA22 permit: 12 chillers on the roof
  out.coolerMat = M('cooling', 0xa3aaae, { metalness: 0.35 });
  instanced(box(9, 3, 4.5), out.coolerMat, cBody, coolers);
  instanced(new THREE.CylinderGeometry(1.7, 1.7, 0.35, 20), M('cooling', 0x3e4549, { metalness: 0.5 }), cFan, coolers, false);
  const pipeMat = M('cooling', 0x6d8ea6, { metalness: 0.5 });
  for (const dz of [-8, 8]) {
    const p = mesh(new THREE.CylinderGeometry(0.45, 0.45, FRA21.w - 6, 10), pipeMat, FRA21.x, FRA21.h + 0.8, FRA21.z + dz, coolers);
    p.rotation.z = Math.PI / 2;
  }
  out.coolers = coolers;
  out.coolerTops = coolerTops;

  // ---------- grid connection: transformer yard (schematic) ----------
  const power = new THREE.Group();
  root.add(power);
  const yard = { x: -66, z: 64 };
  mesh(box(46, 0.3, 14), M('power', 0xc9c6bd), yard.x, 0.15, yard.z, power);
  const tMat = M('power', 0x7d8a84, { metalness: 0.4 }), finMat = M('power', 0x66726d, { metalness: 0.4 });
  const fins = [];
  for (let i = 0; i < 3; i++) {
    const tx = yard.x - 14 + i * 12;
    mesh(box(5, 4.5, 4), tMat, tx, 2.55, yard.z, power);
    mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.2, 8), M('power', 0xb9a46b), tx - 1.5, 5.9, yard.z, power);
    mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.2, 8), M('power', 0xb9a46b), tx + 1.5, 5.9, yard.z, power);
    for (let f = -2; f <= 2; f++) fins.push(T(tx + f * 0.9, 2.4, yard.z - 2.4));
  }
  instanced(box(0.12, 3.6, 0.9), finMat, fins, power, false);
  mesh(box(10, 4, 7), M('power', 0xdedfda), yard.x + 18, 2, yard.z, power); // switch house
  out.power = power;

  // ---------- backup power ----------
  // FRA21 permit: 28 generators inside the building, 7 groups of 4 (2 on the 1st floor, 2 on the 2nd),
  // each group's exhaust bundled into one stack of at least 38.2 m. Position within the building: schematic.
  const backup = new THREE.Group();
  root.add(backup);
  const genBody = M('backup', 0x6f5a45), genRad = M('backup', 0x9b8a76);
  const stackMat = M('backup', 0x8d9396, { metalness: 0.45 });
  const exhaust = M('backup', 0x777d80, { metalness: 0.5 });
  const storeyH = FRA21.h / FRA21.storeys;
  // Permit: generators sit at the north-west outer wall, 1st and 2nd floor.
  const groups = facts.fra21.stackCount, zWall = FRA21.z - FRA21.d / 2;
  const gx0 = FRA21.x - FRA21.w / 2 + 6, gStep = 7.5;
  for (let gi = 0; gi < groups; gi++) {
    const x = gx0 + gi * gStep;
    for (const floor of [1, 2]) {
      for (const dx of [-1.8, 1.8]) {
        const y = storeyH * floor + 1.8;
        mesh(box(3, 3.4, 8), genBody, x + dx, y, zWall + 6, backup);
        mesh(box(3.1, 3.2, 1.6), genRad, x + dx, y - 0.1, zWall + 11, backup);
        const p = mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 8), exhaust, x + dx, y + 1.2, zWall + 1.2, backup);
        p.rotation.x = Math.PI / 2;
      }
    }
    // one stack per group of four, outside the wall, rising above the roof
    mesh(new THREE.CylinderGeometry(1.0, 1.15, facts.fra21.stackHeight, 16), stackMat, x, facts.fra21.stackHeight / 2, zWall - 1.6, backup);
    mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.6, 16), stackMat, x, facts.fra21.stackHeight - 0.3, zWall - 1.6, backup);
  }
  out.fra21StackTop = new THREE.Vector3(gx0 + 3 * gStep, facts.fra21.stackHeight, zWall - 1.6);
  // FRA22 permit: 11 generators inside FRA22; 5 shared stacks + 1 single, 42 m. Positions schematic.
  for (let i = 0; i < facts.generatorCount; i++) {
    mesh(box(4, 3.4, 8), genBody, 20 + i * 7, 1.8, 18, backup);
  }
  for (let i = 0; i < 6; i++) {
    const r = i < 5 ? 1.1 : 0.8;
    mesh(new THREE.CylinderGeometry(r, r * 1.15, facts.stackHeight, 16), stackMat, 23 + i * 11, facts.stackHeight / 2, 27, backup);
    mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.6, 16), stackMat, 23 + i * 11, facts.stackHeight - 0.3, 27, backup);
  }
  const tankMat = M('backup', 0x7a5a3a, { wireframe: true, transparent: true, opacity: 0.7, depthTest: false });
  for (let i = 0; i < 3; i++) { // 3 × 100 m³: r 2.5 m × 5.1 m ≈ 100 m³
    const t = mesh(new THREE.CylinderGeometry(2.5, 2.5, 5.1, 18, 1), tankMat, 28 + i * 9, -3.5, 63, backup);
    t.rotation.z = Math.PI / 2;
    t.renderOrder = 2;
  }
  out.backup = backup;

  // ---------- jobs: a parking lot with one space per worker (illustration) ----------
  const lot = new THREE.Group();
  root.add(lot);
  const nSpaces = facts.constructionWorkers;
  const perRow = 32, rowsPerModule = 2, moduleDepth = 16, sw = 2.5;
  const modules = Math.ceil(nSpaces / (perRow * rowsPerModule));
  const lotX0 = -110, lotZ0 = PLOT.z1 + 24;
  const lotW = perRow * sw, lotD = modules * moduleDepth;
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(lotW + 8, lotD + 8), new THREE.MeshLambertMaterial({ color: 0x9a9e9d }));
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(lotX0 + lotW / 2, 0.09, lotZ0 + lotD / 2);
  asphalt.receiveShadow = true;
  lot.add(asphalt);
  const spots = [], lines = [];
  for (let m = 0; m < modules; m++) for (let r = 0; r < rowsPerModule; r++) for (let i = 0; i < perRow; i++) {
    if (spots.length >= nSpaces) break;
    const x = lotX0 + sw * (i + 0.5);
    const z = lotZ0 + m * moduleDepth + (r === 0 ? 2.5 : moduleDepth - 2.5);
    spots.push(new THREE.Vector3(x, 0, z));
    lines.push(T(x - sw / 2, 0.12, z));
  }
  instanced(box(0.12, 0.02, 5), new THREE.MeshBasicMaterial({ color: 0xf4f4ef }), lines, lot, false);
  const carGeo2 = box(1.8, 1.4, 4.2);
  const builders = new THREE.InstancedMesh(carGeo2, new THREE.MeshStandardMaterial({ color: 0xd08a2c, roughness: 0.5 }), nSpaces);
  const staffSure = new THREE.InstancedMesh(carGeo2, new THREE.MeshStandardMaterial({ color: 0x2f7550, roughness: 0.5 }), nSpaces);
  const staffMaybe = new THREE.InstancedMesh(carGeo2, new THREE.MeshStandardMaterial({ color: 0x2f7550, roughness: 0.5, transparent: true, opacity: 0.35 }), nSpaces);
  [builders, staffSure, staffMaybe].forEach((im) => {
    spots.forEach((p, i) => im.setMatrixAt(i, T(p.x, 0.7, p.z)));
    im.castShadow = true;
    im.count = 0;
    lot.add(im);
  });
  out.lot = {
    group: lot,
    center: new THREE.Vector3(lotX0 + lotW / 2, 0, lotZ0 + lotD / 2),
    // mode 'build': one car per construction worker; 'run': permanent staff, low–high range
    set(mode, low = 0, high = 0) {
      builders.count = mode === 'build' ? nSpaces : 0;
      staffSure.count = mode === 'run' ? low : 0;
      // the uncertain part of the range sits right after the certain part
      if (mode === 'run') {
        for (let i = 0; i < high - low; i++) staffMaybe.setMatrixAt(i, T(spots[low + i].x, 0.7, spots[low + i].z));
        staffMaybe.instanceMatrix.needsUpdate = true;
      }
      staffMaybe.count = mode === 'run' ? high - low : 0;
    },
  };
  out.trees = trees;

  // ---------- "who uses it": one office tower, one floor = PER_FLOOR people (illustration) ----------
  // bands: [{ low, high, color }] from the BMWK study; solid floors = low estimate, see-through = up to high.
  const tower = new THREE.Group();
  root.add(tower);
  const TX = -175, TZ = -70, TW = 26, FH = 3.6;
  let floor = 0;
  const towerBands = [];
  for (const band of facts.towerBands) {
    const solid = Math.round(band.low / facts.perFloor), total = Math.ceil(band.high / facts.perFloor);
    const start = floor;
    for (let f = 0; f < total; f++, floor++) {
      const sure = f < Math.max(solid, 1);
      const m = new THREE.Mesh(box(TW, FH - 0.5, TW), new THREE.MeshStandardMaterial({
        color: band.color, roughness: 0.35, metalness: 0.2, transparent: !sure, opacity: sure ? 1 : 0.22, depthWrite: sure }));
      m.position.set(TX, floor * FH + FH / 2, TZ);
      m.castShadow = sure;
      tower.add(m);
      const slab = new THREE.Mesh(box(TW + 0.6, 0.5, TW + 0.6), new THREE.MeshStandardMaterial({ color: 0xd9dbd7, transparent: !sure, opacity: sure ? 1 : 0.35 }));
      slab.position.set(TX, floor * FH + 0.25, TZ);
      tower.add(slab);
    }
    towerBands.push({ ...band, from: start, to: floor });
  }
  // a thin frame so the whole height reads as one building
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(box(TW + 0.8, floor * FH, TW + 0.8)), new THREE.LineBasicMaterial({ color: 0x5a636b }));
  frame.position.set(TX, (floor * FH) / 2, TZ);
  tower.add(frame);
  out.tower = { group: tower, top: new THREE.Vector3(TX, floor * FH, TZ), base: new THREE.Vector3(TX, 0, TZ), bands: towerBands, floorH: FH };

  // ---------- hotspot anchors ----------
  out.hotspots = {
    it: new THREE.Vector3(FRA21.x - 20, FRA21.h + 8, FRA21.z - 10),
    power: new THREE.Vector3(yard.x - 22, 8, yard.z),
    cooling: new THREE.Vector3(FRA21.x + 25, FRA21.h + 8, FRA21.z + 15),
    water: new THREE.Vector3(-58, 5, 46),
    backup: out.fra21StackTop.clone().setY(facts.fra21.stackHeight + 3),
    heat: new THREE.Vector3(FRA22.x - 10, FRA22.h + 12, FRA22.z),
    noise: new THREE.Vector3(PLOT.x1 - 10, 6, PLOT.z1 - 8),
    jobs: out.lot.center.clone().setY(3),
    users: out.tower.top.clone().setY(out.tower.top.y + 4),
    environment: new THREE.Vector3(PLOT.x1 + 40, 8, -20),
  };
  return out;
}
