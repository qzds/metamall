import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export const PALETTES = {
  atelier: {
    metal: '#B68C54',
    ink: '#221D24',
    stone: '#84715E',
    light: '#FFC789'
  },
  gallery: {
    metal: '#9DAEBE',
    ink: '#121C2A',
    stone: '#586579',
    light: '#9DEEFF'
  },
  garden: {
    metal: '#AD8E61',
    ink: '#182A24',
    stone: '#4D6855',
    light: '#D4FFAB'
  }
};
const textures = new Map();
export function noise(seed = 42) {
  let n = seed >>> 0;
  return () => {
    n += 0x6D2B79F5;
    let t = n;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function texture(kind = 'stone') {
  if (textures.has(kind)) return textures.get(kind);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d'),
    rand = noise(kind === 'wood' ? 812 : 471);
  const data = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const grain = kind === 'wood' ? Math.sin(x * .16 + Math.sin(y * .016) * 2) * 19 : kind === 'fabric' ? (Math.sin(x * Math.PI / 2) + Math.sin(y * Math.PI / 2)) * 7 : Math.sin(x * .019 + Math.sin(y * .012)) * 4;
    const c = 210 + rand() * 34 + grain;
    data.data.set([c, c, c, 255], (y * 512 + x) * 4);
  }
  ctx.putImageData(data, 0, 0);
  if (kind === 'tile') {
    ctx.strokeStyle = '#818890';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 512, 512);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(kind === 'fabric' ? 3 : 4, kind === 'fabric' ? 3 : 4);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  map.userData.shared = true;
  textures.set(kind, map);
  return map;
}
export function mat(color, options = {}) {
  const {
    surface,
    ...rest
  } = options;
  return new THREE.MeshStandardMaterial({
    color,
    roughness: .48,
    metalness: .12,
    ...(surface ? {
      map: texture(surface),
      bumpMap: texture(surface),
      bumpScale: .012
    } : {}),
    ...rest
  });
}
export function glow(color, power = 2.2) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(power),
    toneMapped: true
  });
}
export function part(root, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.castShadow = !material.isMeshBasicMaterial;
  m.receiveShadow = true;
  root.add(m);
  return m;
}
export function block(root, size, m, position, rotation) {
  return part(root, new THREE.BoxGeometry(...size), m, position, rotation);
}
export function tube(root, points, radius, m, closed = false) {
  return part(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed), 48, radius, 8, closed), m);
}
export function torus(root, radius, width, m, position, rotation = [Math.PI / 2, 0, 0], arc = Math.PI * 2) {
  return part(root, new THREE.TorusGeometry(radius, width, 8, 96, arc), m, position, rotation);
}
export function roundRect(w, h, r = .3) {
  const s = new THREE.Shape(),
    x = -w / 2,
    y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
export function panel(root, w, h, depth, m, position, rotation) {
  return part(root, new THREE.ExtrudeGeometry(roundRect(w, h, .16), {
    depth,
    bevelEnabled: true,
    bevelSize: .035,
    bevelThickness: .035,
    bevelSegments: 2,
    steps: 1
  }), m, position, rotation);
}
export function sign(root, title, subtitle, {
  width = 5,
  position = [0, 0, 0],
  color = '#F0E9DF',
  accent = '#B9E6F2',
  dark = false
} = {}) {
  const c = document.createElement('canvas');
  c.width = 1536;
  c.height = 384;
  const x = c.getContext('2d');
  if (dark) {
    x.fillStyle = '#09121c';
    x.fillRect(0, 0, c.width, c.height);
  }
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = color;
  let size = 128;
  x.font = `500 ${size}px "Microsoft YaHei",sans-serif`;
  while (x.measureText(title).width > 1400 && size > 50) {
    size -= 4;
    x.font = `500 ${size}px "Microsoft YaHei",sans-serif`;
  }
  x.fillText(title, 768, subtitle ? 146 : 192);
  if (subtitle) {
    x.font = '30px "Microsoft YaHei",sans-serif';
    x.fillStyle = accent;
    x.fillText(subtitle, 768, 286);
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    toneMapped: false
  });
  return part(root, new THREE.PlaneGeometry(width, width / 4), m, position);
}

/** Merge only owned static meshes. Dynamic products/signs remain independently selectable. */
export function batchStatic(root) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(),
    buckets = new Map(),
    remove = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.transparent || o.userData.dynamic) return;
    let n = o;
    while (n && n !== root) {
      if (n.userData.dynamic) return;
      n = n.parent;
    }
    const key = o.material.uuid;
    let b = buckets.get(key);
    if (!b) {
      b = {
        material: o.material,
        geos: []
      };
      buckets.set(key, b);
    }
    let g = o.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute('uv1');
    g.deleteAttribute('tangent');
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
    b.geos.push(g);
    remove.push(o);
  });
  buckets.forEach(b => {
    const geometry = mergeGeometries(b.geos, false);
    if (geometry) {
      const m = part(root, geometry, b.material);
      m.userData.batched = true;
    }
    b.geos.forEach(g => g.dispose());
  });
  const old = new Set();
  remove.forEach(o => {
    old.add(o.geometry);
    o.removeFromParent();
  });
  old.forEach(g => g.dispose());
}
export function foliage(root, x, z, size = 1, seed = 4) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(size);
  root.add(g);
  const pot = mat('#2D3D36', {
      metalness: .4
    }),
    bark = mat('#5C5544', {
      surface: 'wood'
    }),
    leaf = mat('#466C4B', {
      roughness: .7,
      side: THREE.DoubleSide
    });
  part(g, new THREE.CylinderGeometry(.28, .23, .45, 16), pot, [0, .22, 0]);
  const rng = noise(seed),
    leafGeo = new THREE.SphereGeometry(.4, 10, 6),
    leaves = new THREE.InstancedMesh(leafGeo, leaf, 18),
    dummy = new THREE.Object3D();
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4,
      y = .7 + i * .064,
      r = .35 + rng() * .32;
    dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    dummy.rotation.set(.45, a, Math.cos(a) * .6);
    dummy.scale.set(.65, .075, 1.1);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
  }
  leaves.castShadow = true;
  g.add(leaves);
  part(g, new THREE.CylinderGeometry(.025, .055, 1.4, 8), bark, [0, .9, 0]);
  return g;
}
