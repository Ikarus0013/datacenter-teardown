// "Take it apart": FRA21 as separate layers that can be pulled apart.
// Real: 4 storeys, 28 generators on the 1st and 2nd floor at the north-west wall (permit),
// 6 diesel tanks (permit). Not published, so schematic: which floors hold server halls,
// rack layout, cooling unit positions, tank size and position, roof layout.
import * as THREE from 'three';
import { FRA21 } from './model.js';

const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

export function buildTeardown(scene) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const storey = FRA21.h / FRA21.storeys;
  const x0 = FRA21.x - FRA21.w / 2, z0 = FRA21.z - FRA21.d / 2;
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xe9eae6, roughness: 0.9 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x8a9196 });
  const rackMat = new THREE.MeshStandardMaterial({ color: 0x56616a, roughness: 0.5 });
  const genMat = new THREE.MeshStandardMaterial({ color: 0x6f5a45, roughness: 0.8 });
  const crahMat = new THREE.MeshStandardMaterial({ color: 0xd6dadc, roughness: 0.6 });
  const coolMat = new THREE.MeshStandardMaterial({ color: 0xa3aaae, metalness: 0.35, roughness: 0.6 });
  const fanMat = new THREE.MeshStandardMaterial({ color: 0x3e4549, metalness: 0.5 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.7 });

  function shell(layer, h) {
    const plate = new THREE.Mesh(box(FRA21.w, 0.6, FRA21.d), plateMat);
    plate.position.set(FRA21.x, 0.3, FRA21.z);
    plate.receiveShadow = true;
    layer.add(plate);
    const walls = new THREE.LineSegments(new THREE.EdgesGeometry(box(FRA21.w, h, FRA21.d)), edgeMat);
    walls.position.set(FRA21.x, h / 2 + 0.6, FRA21.z);
    layer.add(walls);
  }
  function racks(layer) {
    const m = [];
    for (let zr = -26; zr <= 26; zr += 5) {
      for (let x = x0 + 18; x < x0 + FRA21.w - 6; x += 0.75) m.push(T(x, 1.7, zr - 1.1), T(x, 1.7, zr + 1.1));
    }
    const im = new THREE.InstancedMesh(box(0.7, 2.2, 1.1), rackMat, m.length);
    m.forEach((mx, i) => im.setMatrixAt(i, mx));
    layer.add(im);
    for (let x = x0 + 22; x < x0 + FRA21.w - 6; x += 10) { // cooling units along the south wall
      const u = new THREE.Mesh(box(3.2, 2.6, 1.6), crahMat);
      u.position.set(x, 1.9, z0 + FRA21.d - 2.5);
      layer.add(u);
    }
  }
  function generators(layer) {
    for (let g = 0; g < 7; g++) for (const dx of [-1.8, 1.8]) {
      const m = new THREE.Mesh(box(3, 3.4, 8), genMat);
      m.position.set(x0 + 6 + g * 7.5 + dx, 2.3, z0 + 6);
      m.castShadow = true;
      layer.add(m);
    }
  }

  const layers = [];
  const add = (label, baseY, build) => {
    const g = new THREE.Group();
    build(g);
    root.add(g);
    layers.push({ group: g, baseY, label });
  };
  add('Below ground: 6 diesel tanks (size and place not published)', -8, (g) => {
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 6, 16), tankMat);
      t.rotation.z = Math.PI / 2;
      t.position.set(x0 + 8 + i * 8, 2, z0 - 8);
      g.add(t);
    }
  });
  add('Ground floor: halls, cooling units, power rooms', 0, (g) => { shell(g, storey - 0.6); racks(g); });
  add('1st floor: 14 diesel generators at the north-west wall', storey, (g) => { shell(g, storey - 0.6); racks(g); generators(g); });
  add('2nd floor: 14 more generators', storey * 2, (g) => { shell(g, storey - 0.6); racks(g); generators(g); });
  add('3rd floor: halls', storey * 3, (g) => { shell(g, storey - 0.6); racks(g); });
  add('Roof: coolers and pipes', storey * 4, (g) => {
    const plate = new THREE.Mesh(box(FRA21.w, 0.6, FRA21.d), plateMat);
    plate.position.set(FRA21.x, 0.3, FRA21.z);
    g.add(plate);
    const body = [], fans = [];
    for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) {
      const x = x0 + (FRA21.w / 7) * (i + 0.5), z = z0 + (FRA21.d / 4) * (j + 0.5);
      body.push(T(x, 2.1, z));
      fans.push(T(x - 2.2, 3.75, z), T(x + 2.2, 3.75, z));
    }
    const b = new THREE.InstancedMesh(box(9, 3, 4.5), coolMat, body.length);
    body.forEach((mx, i) => b.setMatrixAt(i, mx));
    const f = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.7, 1.7, 0.35, 20), fanMat, fans.length);
    fans.forEach((mx, i) => f.setMatrixAt(i, mx));
    g.add(b, f);
  });

  layers.forEach((l, i) => { l.group.position.y = l.baseY; l.spread = (i - 1) * 16; });
  return {
    root,
    layers,
    // k = 0: stacked as built; k = 1: fully apart
    set(k) { layers.forEach((l) => { l.group.position.y = l.baseY + l.spread * k; }); },
    labelPos: (l, k) => new THREE.Vector3(FRA21.x + FRA21.w / 2 + 4, l.baseY + l.spread * k + 3, FRA21.z + FRA21.d / 2),
  };
}
