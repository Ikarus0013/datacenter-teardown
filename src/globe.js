// Start screen: a globe with a pin for each site. Land outlines: Natural Earth 1:110m (public domain).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import land from '../data/globe/ne_110m_land.geojson';

const R = 100;
export const toXYZ = (lat, lon, r = R) => {
  const phi = THREE.MathUtils.degToRad(90 - lat), th = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
};

export function buildGlobe(canvas, sites) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9ece7);
  const camera = new THREE.PerspectiveCamera(36, 1, 1, 2000);
  camera.position.copy(toXYZ(42, -50, 330));
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minDistance = 160;
  controls.maxDistance = 600;
  controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = 0.35;
  controls.enabled = false;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9cfc6, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(300, 200, 300);
  scene.add(sun);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.9 })));

  // land outlines
  const pts = [];
  for (const f of land.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) for (const ring of poly) {
      for (let i = 0; i < ring.length - 1; i++) pts.push(toXYZ(ring[i][1], ring[i][0], R + 0.2), toXYZ(ring[i + 1][1], ring[i + 1][0], R + 0.2));
    }
  }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x56606a })));
  // faint graticule every 30°
  const grid = [];
  for (let lat = -60; lat <= 60; lat += 30) for (let lon = -180; lon < 180; lon += 3) grid.push(toXYZ(lat, lon, R + 0.1), toXYZ(lat, lon + 3, R + 0.1));
  for (let lon = -180; lon < 180; lon += 30) for (let lat = -87; lat < 87; lat += 3) grid.push(toXYZ(lat, lon, R + 0.1), toXYZ(lat + 3, lon, R + 0.1));
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(grid), new THREE.LineBasicMaterial({ color: 0xc9d1d6 })));

  // pins
  const pinMat = new THREE.MeshStandardMaterial({ color: 0x1f262b });
  const pins = sites.map((s) => {
    const base = toXYZ(s.lat, s.lon, R), tip = toXYZ(s.lat, s.lon, R + 9);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 9, 8), pinMat);
    stick.position.copy(base.clone().add(tip).multiplyScalar(0.5));
    stick.lookAt(0, 0, 0);
    stick.rotateX(Math.PI / 2);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshStandardMaterial({ color: 0x1876b8 }));
    head.position.copy(tip);
    scene.add(stick, head);
    return { ...s, tip };
  });

  let flight = null;
  return {
    scene, camera, controls, pins,
    // fly towards a site; resolves when close
    flyTo(site, done) {
      controls.autoRotate = false;
      flight = { p0: camera.position.clone(), p1: toXYZ(site.lat, site.lon, 175), k: 0, done };
    },
    // zoom back out after visiting a site, then keep turning
    home() {
      flight = { p0: camera.position.clone(), p1: camera.position.clone().setLength(330), k: 0, out: true,
        done: () => { controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches; } };
    },
    update(dt) {
      if (flight) {
        flight.k = Math.min(1, flight.k + dt / 1.2);
        const e = 1 - (1 - flight.k) ** 3;
        camera.position.copy(flight.p0).lerp(flight.p1, e).setLength(THREE.MathUtils.lerp(flight.p0.length(), flight.p1.length(), e));
        camera.lookAt(0, 0, 0);
        if (flight.k >= 1) { const d = flight.done; flight = null; d?.(); }
      } else controls.update();
    },
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); },
  };
}
