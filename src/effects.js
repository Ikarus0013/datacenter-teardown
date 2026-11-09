// Animated overlays. Each is hidden until its topic is in focus.
import * as THREE from 'three';
import { orbMaterial } from './orb.js';
import { FRA21, PLOT } from './model.js';

const tmp = new THREE.Vector3();
function flow(path, n, color, size, scene) {
  const curve = new THREE.CurvePath();
  for (let i = 0; i < path.length - 1; i++) curve.add(new THREE.LineCurve3(path[i], path[i + 1]));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5, depthTest: false }));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const dots = new THREE.Points(g, orbMaterial({ color, size, depthTest: false }));
  line.renderOrder = dots.renderOrder = 5;
  const grp = new THREE.Group();
  grp.add(line, dots);
  grp.visible = false;
  scene.add(grp);
  return {
    group: grp,
    update(t) {
      const a = g.attributes.position;
      for (let i = 0; i < n; i++) { curve.getPointAt(((i / n) + t) % 1, tmp); a.setXYZ(i, tmp.x, tmp.y, tmp.z); }
      a.needsUpdate = true;
    },
  };
}

// Polyline with rounded corners (pipes bend, they don't kink).
function piped(points, r = 2) {
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

// Cooling water: cold supply from the roof coolers down a riser to cooling units along the
// hall wall, warm return back up beside it. Typical layout; FRA21's real routing is not public.
function coolantPipes(scene) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const roof = FRA21.h + 1.6, hall = 3.6;
  const xr = -103, zr = -6, zw = -33.5, xEnd = -14;
  const route = (dz, dy) => [
    V(xEnd, roof + dy, zr + dz), V(xr + dz, roof + dy, zr + dz),      // along the roof from the coolers
    V(xr + dz, hall + dy, zr + dz),                                    // down the riser
    V(xr + dz, hall + dy, zw + dz),                                    // to the hall's north wall
    V(xEnd, hall + dy, zw + dz),                                       // past the cooling units
  ];
  const supply = piped(route(0, 0)), ret = piped(route(1.4, 0.9));
  const grp = new THREE.Group();
  const tube = (curve, color) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.42, 10, false), mat));
    return mat;
  };
  const supplyMat = tube(supply, 0x2f7fc1);
  tube(ret, 0xd9774a);
  // branches at each floor off the riser
  const branchMat = new THREE.MeshStandardMaterial({ color: 0x8aa3b5, roughness: 0.5, metalness: 0.3 });
  for (let f = 1; f < FRA21.storeys; f++) {
    const y = (FRA21.h / FRA21.storeys) * f + 2.6;
    for (const dz of [0, 1.4]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 26, 8), branchMat);
      b.rotation.z = Math.PI / 2;
      b.position.set(xr + dz + 13, y, zr + dz);
      grp.add(b);
    }
  }
  // cooling units (CRAH) along the north wall, where water takes up the hall's heat
  const crahMat = new THREE.MeshStandardMaterial({ color: 0xd6dadc, roughness: 0.6 });
  const grille = new THREE.MeshStandardMaterial({ color: 0x5b6670, roughness: 0.7 });
  for (let x = -98; x <= -18; x += 8) {
    const u = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 1.6), crahMat);
    u.position.set(x, 1.3, zw + 1.6);
    const g = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 0.05), grille);
    g.position.set(x, 1.4, zw + 2.43);
    grp.add(u, g);
  }
  // water moving inside the pipes: blue going down, orange coming back
  const N = 90;
  const mk = (color) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const p = new THREE.Points(g, orbMaterial({ color, size: 1.6, depthTest: false }));
    p.renderOrder = 6;
    grp.add(p);
    return g;
  };
  const gs = mk(0x9fd3ff), gr = mk(0xffd0b0);
  grp.visible = false;
  scene.add(grp);
  return {
    group: grp,
    // warm-water design: the 'cold' side is already about 45 °C
    setWarm(w) { supplyMat.color.set(w ? 0xe0a040 : 0x2f7fc1); },
    update(t) {
      for (let i = 0; i < N; i++) {
        supply.getPointAt(((i / N) + t) % 1, tmp); gs.attributes.position.setXYZ(i, tmp.x, tmp.y, tmp.z);
        ret.getPointAt(1 - (((i / N) + t) % 1), tmp); gr.attributes.position.setXYZ(i, tmp.x, tmp.y, tmp.z);
      }
      gs.attributes.position.needsUpdate = gr.attributes.position.needsUpdate = true;
    },
  };
}

// Older design: room air conditioners blow cold air under a raised floor, up through the racks;
// hot air returns along the ceiling. Typical layout, schematic.
function airflow(scene) {
  const grp = new THREE.Group();
  const crac = new THREE.MeshStandardMaterial({ color: 0xc9cdcf, roughness: 0.6 });
  for (let x = -100; x <= -16; x += 12) {
    for (const z of [-34.5, 34.5]) {
      const u = new THREE.Mesh(new THREE.BoxGeometry(4, 3.2, 2.4), crac);
      u.position.set(x, 1.6, z);
      grp.add(u);
    }
  }
  const tiles = new THREE.Mesh(new THREE.PlaneGeometry(FRA21.w - 8, FRA21.d - 8), new THREE.MeshBasicMaterial({ color: 0x7fb3d9, transparent: true, opacity: 0.25, depthWrite: false }));
  tiles.rotation.x = -Math.PI / 2;
  tiles.position.set(FRA21.x, 0.3, FRA21.z);
  grp.add(tiles);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const loops = [];
  for (const x of [-90, -66, -42, -20]) {
    for (const [zw, zr] of [[-33, -12], [33, 12]]) {
      loops.push(flow([V(x, 0.4, zw), V(x, 0.4, zr), V(x, 2.6, zr)], 16, 0x7fc4f5, 1.8, grp));
      loops.push(flow([V(x, 2.6, zr), V(x, 5.2, zr * 0.6), V(x, 5.2, zw), V(x, 2.2, zw)], 16, 0xf0a070, 1.8, grp));
    }
  }
  loops.forEach((l) => { l.group.visible = true; l.group.children[0].material.opacity = 0.25; });
  grp.visible = false;
  scene.add(grp);
  return { group: grp, update(t) { loops.forEach((l) => l.update(t * 3)); } };
}

// Future design: warm-water pipes run to every rack row (direct-to-chip). Schematic.
function chipPipes(scene) {
  const grp = new THREE.Group();
  const warm = new THREE.MeshStandardMaterial({ color: 0xe0a040, roughness: 0.4, metalness: 0.3 });
  const hot = new THREE.MeshStandardMaterial({ color: 0xc8503a, roughness: 0.4, metalness: 0.3 });
  const x0 = FRA21.x - FRA21.w / 2 + 4, x1 = FRA21.x + FRA21.w / 2 - 4;
  for (const [mat, x, dy] of [[warm, -102, 0], [hot, -101, 0.5]]) {
    const header = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 64, 8), mat);
    header.rotation.x = Math.PI / 2;
    header.position.set(x, 2.8 + dy, 0);
    grp.add(header);
  }
  for (let zr = -30; zr <= 30; zr += 5) {
    for (const [mat, dz, dy] of [[warm, -0.3, 0], [hot, 0.3, 0.5]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, x1 - x0, 6), mat);
      p.rotation.z = Math.PI / 2;
      p.position.set((x0 + x1) / 2, 2.6 + dy, zr + dz);
      grp.add(p);
    }
  }
  grp.visible = false;
  scene.add(grp);
  return { group: grp };
}

// Environment view: river Main (real distance and bearing, schematic width), groundwater layer
// (depth not published: schematic), FRA21's six diesel tanks (size and position not published:
// schematic outlines) and rain running off the roof into the town sewer.
function environment(scene) {
  const grp = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const groundwater = new THREE.Mesh(new THREE.PlaneGeometry(700, 600), new THREE.MeshBasicMaterial({ color: 0x3f8fd0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
  groundwater.rotation.x = -Math.PI / 2;
  groundwater.position.set(-30, -9, 0);
  grp.add(groundwater);
  const tankMat = new THREE.MeshBasicMaterial({ color: 0x7a5a3a, wireframe: true, transparent: true, opacity: 0.5, depthTest: false });
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 6, 14, 1), tankMat);
    t.rotation.z = Math.PI / 2;
    t.position.set(-104 + i * 8, -3.2, -50);
    t.renderOrder = 2;
    grp.add(t);
  }
  const roofEdge = FRA21.x + FRA21.w / 2 - 2, zs = FRA21.z + FRA21.d / 2;
  const rains = [];
  for (const x of [-100, -70, -40, -10]) {
    rains.push(flow([V(x, FRA21.h, zs - 2), V(x, FRA21.h, zs + 0.5), V(x, 0.4, zs + 0.5), V(x, 0.4, PLOT.z1 + 8), V(-110, -1.5, PLOT.z1 + 8)], 26, 0x5aa8e6, 2, grp));
  }
  rains.forEach((r) => { r.group.visible = true; });
  const sewer = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 200, 10), new THREE.MeshBasicMaterial({ color: 0x5f6b73, transparent: true, opacity: 0.6, depthTest: false }));
  sewer.rotation.z = Math.PI / 2;
  sewer.position.set(-10, -1.5, PLOT.z1 + 8);
  sewer.renderOrder = 2;
  grp.add(sewer);
  grp.visible = false;
  scene.add(grp);
  return {
    group: grp,
    labels: [
      ['Groundwater (depth not published)', V(-200, -9, 60)],
      ['FRA21: 6 diesel tanks (size and place not published)', V(-84, 2, -54)],
      ['Town rainwater sewer: where it leads is not published', V(-110, 2, PLOT.z1 + 8)],
    ],
    update(t) { rains.forEach((r) => r.update(t * 2)); },
  };
}

// The river Main: 0.9 km north-north-west of FRA21 (from map coordinates). Width schematic.
function river(scene) {
  const dir = new THREE.Vector3(-Math.sin((25 * Math.PI) / 180), 0, -Math.cos((25 * Math.PI) / 180)); // bearing 335°
  const centre = new THREE.Vector3(FRA21.x, 0, FRA21.z).addScaledVector(dir, 900);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 160), new THREE.MeshStandardMaterial({ color: 0x4f86b0, roughness: 0.25, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2;
  water.rotation.z = Math.atan2(dir.x, dir.z); // run across the bearing line
  water.position.set(centre.x, 0.2, centre.z);
  scene.add(water);
  // a pointer 160 m out from FRA21 along the bearing, still inside the overview
  const pointer = new THREE.Vector3(FRA21.x, 4, FRA21.z).addScaledVector(dir, 160);
  return { mesh: water, label: ['River Main, about 0.9 km away', centre.clone().setY(6)], pointer };
}

export function buildEffects(scene, site) {
  const fx = {};
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  fx.loop = coolantPipes(scene);
  fx.env = environment(scene);
  fx.river = river(scene);
  fx.air = airflow(scene);
  fx.chip = chipPipes(scene);
  // town water supply (only in the evaporative what-if)
  fx.mains = flow([V(PLOT.x0 - 14, 0.6, -15), V(FRA21.x - FRA21.w / 2, 0.6, -15)], 20, 0x1876b8, 3.4, scene);
  // power: transformer yard → halls
  fx.power = flow([V(-66, 3, 60), V(-66, 3, 40), V(-66, 8, 38)], 30, 0xd29b1c, 3.4, scene);

  // vapour rising from roof coolers
  const VAP = 220;
  const vapor = new THREE.Points(new THREE.BufferGeometry(), orbMaterial({ color: 0xa9cde6, size: 2.8, transparent: true, opacity: 0.75, depthWrite: false }));
  vapor.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(VAP * 3), 3));
  const seeds = Array.from({ length: VAP }, (_, i) => ({ b: site.coolerTops[i % site.coolerTops.length], ph: (i * 0.618) % 1, dx: ((i * 37) % 9) / 2 - 2, dz: ((i * 53) % 9) / 2 - 2 }));
  vapor.visible = false;
  scene.add(vapor);
  fx.vapor = { group: vapor, update(t) {
    const a = vapor.geometry.attributes.position;
    seeds.forEach((s, i) => { const k = (s.ph + t * 2.4) % 1; a.setXYZ(i, s.b.x + s.dx * (1 + 2 * k), s.b.y + k * 30, s.b.z + s.dz * (1 + 2 * k)); });
    a.needsUpdate = true;
  } };

  // heat: warm translucent plumes above every cooler
  const plumes = new THREE.Group();
  const plumeMat = new THREE.MeshBasicMaterial({ color: 0xe0703a, transparent: true, opacity: 0.18, depthWrite: false });
  const plumeGeo = new THREE.ConeGeometry(3.2, 16, 14, 1, true);
  site.coolerTops.forEach((p) => { const c = new THREE.Mesh(plumeGeo, plumeMat); c.position.set(p.x, p.y + 8, p.z); c.rotation.x = Math.PI; plumes.add(c); });
  plumes.visible = false;
  scene.add(plumes);
  fx.heat = { group: plumes, update(t) { plumeMat.opacity = 0.12 + 0.08 * Math.sin(t * 40); plumes.children.forEach((c, i) => { c.scale.y = 1 + 0.15 * Math.sin(t * 30 + i); }); } };

  // noise: rings spreading from the roof coolers (continuous) and the generator yard (rare)
  const rings = new THREE.Group();
  const ringMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const sources = [{ at: V(FRA21.x, 0.3, FRA21.z), c: 0x5a48a6 }, { at: V(55, 0.3, 42), c: 0x7a5a3a }];
  const ringObjs = [];
  sources.forEach((s) => {
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64), ringMat(s.c));
      r.rotation.x = -Math.PI / 2;
      r.position.copy(s.at);
      rings.add(r);
      ringObjs.push({ r, ph: i / 4 });
    }
  });
  rings.visible = false;
  scene.add(rings);
  fx.noise = { group: rings, update(t) {
    ringObjs.forEach(({ r, ph }) => { const k = (ph + t * 3) % 1; const s = 20 + k * 160; r.scale.set(s, s, s); r.material.opacity = 0.55 * (1 - k); });
  } };

  // true-scale cube of one day's water
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x1876b8, transparent: true, opacity: 0.6, roughness: 0.2 }));
  cube.castShadow = true;
  cube.visible = false;
  scene.add(cube);
  fx.cube = { mesh: cube, at: V(-62, 0, 47), side: 0, target: 0 };

  return fx;
}
