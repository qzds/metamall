import * as THREE from 'three';
import { mat, part, block, texture, batchStatic } from './art.js';
function shell(levels, segments = 40, pleats = 0) {
  const points = [],
    uv = [],
    indices = [];
  levels.forEach(([y, rx, rz], i) => {
    for (let j = 0; j <= segments; j++) {
      const a = j / segments * Math.PI * 2,
        fold = 1 + pleats * Math.sin(a * 10) * (1 - i / (levels.length * 1.3));
      points.push(Math.cos(a) * rx * fold, y, Math.sin(a) * rz * fold);
      uv.push(j / segments, i / (levels.length - 1));
      if (i < levels.length - 1 && j < segments) {
        const k = i * (segments + 1) + j;
        indices.push(k, k + 1, k + segments + 1, k + 1, k + segments + 2, k + segments + 1);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function limb(g, from, to, r1, r2, m) {
  const a = new THREE.Vector3(...from),
    b = new THREE.Vector3(...to),
    d = b.clone().sub(a);
  const o = part(g, new THREE.CylinderGeometry(r2, r1, d.length(), 12), m, a.clone().add(b).multiplyScalar(.5).toArray());
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return o;
}
export function createLook(product = {}, simple = false) {
  const root = new THREE.Group(),
    skin = mat('#BCB8B1', {
      metalness: .25,
      roughness: .36
    }),
    shoe = mat('#121824', {
      roughness: .27
    });
  const color = product.color || '#E0C6AB',
    fabric = mat(color, {
      map: texture('fabric'),
      bumpMap: texture('fabric'),
      bumpScale: .008,
      roughness: .76,
      metalness: .04,
      side: THREE.DoubleSide
    });
  const name = product.name || '衬衫',
    dress = /连衣|茶歇/.test(name),
    skirt = /裙/.test(name),
    pants = /裤/.test(name),
    coat = /风衣|外套/.test(name);
  const head = part(root, new THREE.SphereGeometry(.116, 20, 16), skin, [0, 1.91, 0]);
  head.scale.set(.8, 1.28, .86);
  part(root, new THREE.CylinderGeometry(.047, .06, .15, 12), skin, [0, 1.74, 0]);
  part(root, shell([[1.12, .145, .075], [1.25, .14, .086], [1.48, .205, .1], [1.63, .18, .07]], 24), skin);
  [-1, 1].forEach(s => {
    limb(root, [s * .105, .99, 0], [s * .11, .56, .018], .065, .055, pants ? fabric : skin);
    limb(root, [s * .11, .56, .018], [s * .115, .14, .01], .05, .035, pants ? fabric : skin);
    const o = part(root, new THREE.SphereGeometry(.085, 12, 8), shoe, [s * .12, .095, .07]);
    o.scale.set(.72, .6, 1.7);
    limb(root, [s * .207, 1.59, 0], [s * .29, 1.24, .025], .055, .04, skin);
    limb(root, [s * .29, 1.24, .025], [s * .25, 1.0, .07], .038, .029, skin);
  });
  if (skirt) {
    const long = dress ? 1 : 0;
    part(root, shell([[.34 + long * .02, .4, .27], [.55, .34, .23], [.9, .23, .15], [1.12, .16, .095]], simple ? 24 : 48, .045), fabric);
  }
  if (pants) {
    part(root, shell([[.92, .17, .1], [1.14, .15, .085]], 24), fabric);
  } else {
    const bottom = coat ? .74 : skirt && !dress ? 1.14 : 1.1;
    part(root, shell([[bottom, coat ? .25 : .165, .12], [1.17, .15, .1], [1.39, .185, .115], [1.55, .22, .105], [1.62, .17, .08], [1.68, .075, .068]], simple ? 24 : 40, .018), fabric);
    [-1, 1].forEach(s => {
      const sleeve = part(root, shell([[0, .072, .075], [.17, .081, .08], [coat ? .43 : .27, .052, .054]], 24), fabric, [s * .2, 1.59, 0]);
      sleeve.rotation.z = s * 2.8;
    });
    if (/衬衫|风衣|外套|开衫/.test(name)) {
      const trim = mat(new THREE.Color(color).multiplyScalar(.72), {
        roughness: .7
      });
      [-1, 1].forEach(s => {
        const c = block(root, [.105, .15, .025], trim, [s * .05, 1.595, .095]);
        c.rotation.z = s * -.4;
      });
      block(root, [.015, coat ? .72 : .45, .012], trim, [0, coat ? 1.2 : 1.39, .122]);
      if (!simple) for (let i = 0; i < 5; i++) part(root, new THREE.SphereGeometry(.009, 6, 4), shoe, [.023, 1.54 - i * .085, .139]);
      if (coat) block(root, [.35, .045, .245], trim, [0, 1.14, 0]);
    }
  }
  batchStatic(root);
  return root;
}
