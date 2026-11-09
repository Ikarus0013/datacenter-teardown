// Round, softly shaded particles ("orbs") for the heat, water, power and steam flows,
// instead of the square points three.js draws by default.
import * as THREE from 'three';

let tex = null;
function orbTexture() {
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  // light from the top left: bright highlight, full colour body, slightly darker rim, soft edge
  const grad = g.createRadialGradient(24, 22, 2, 32, 32, 31);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(235,235,235,1)');
  grad.addColorStop(0.85, 'rgba(185,185,185,1)');
  grad.addColorStop(1, 'rgba(185,185,185,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(32, 32, 31, 0, Math.PI * 2);
  g.fill();
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// a round dot covers less area than a square of the same size, so orbs are drawn 1.4× larger
export const orbMaterial = ({ size = 1, ...opts } = {}) =>
  new THREE.PointsMaterial({ map: orbTexture(), transparent: true, alphaTest: 0.05, depthWrite: false, ...opts, size: size * 1.4 });
