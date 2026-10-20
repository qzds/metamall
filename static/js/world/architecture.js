import * as THREE from 'three';
import { PALETTES, mat, glow, part, block, tube, torus, panel, sign, foliage, batchStatic, noise } from './art.js';
import { createLook } from './garments.js';
import { disposeTree } from './resources.js';
const NAMES = {
  atelier: 'LUMIÈRE / THE ATELIER',
  gallery: 'ZERO / EXPERIMENTAL GALLERY',
  garden: 'QINGHE / THE CONSERVATORY'
};
function archGeometry(radius, spring, thickness = .16) {
  const shape = new THREE.Shape();
  shape.moveTo(-radius - thickness, 0);
  shape.lineTo(-radius - thickness, spring);
  shape.absarc(0, spring, radius + thickness, Math.PI, 0, true);
  shape.lineTo(radius + thickness, 0);
  shape.lineTo(radius, 0);
  shape.lineTo(radius, spring);
  shape.absarc(0, spring, radius, 0, Math.PI, false);
  shape.lineTo(-radius, 0);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth: .24,
    bevelEnabled: true,
    bevelThickness: .035,
    bevelSize: .035,
    bevelSegments: 2,
    curveSegments: 24
  });
}
function vault(w, d, h) {
  const p = [],
    uv = [],
    ix = [],
    n = 40;
  for (let row = 0; row < 2; row++) for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI;
    p.push(Math.cos(a) * w / 2, .65 + Math.sin(a) * h, (row - .5) * d);
    uv.push(i / n, row);
    if (!row && i < n) {
      ix.push(i, i + 1, i + n + 1, i + 1, i + n + 2, i + n + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  g.computeVertexNormals();
  return g;
}
export function productPosition(spec, index, total) {
  const w = spec.dimensions.width,
    d = spec.dimensions.depth;
  if (spec.layout === 'runway') return [(index % 2 ? 1 : -1) * w * .27, -d * .24 + Math.floor(index / 2) * Math.min(2.6, (d - 2) / Math.max(1, Math.ceil(total / 2) - 1))];
  if (spec.layout === 'island') {
    const cols = Math.min(3, Math.ceil(total / 2)),
      rows = Math.ceil(total / cols);
    return [(index % cols - (cols - 1) / 2) * Math.min(3, (w - 2) / cols), -d * .21 + Math.floor(index / cols) * Math.min(3, (d - 2) / Math.max(1, rows - 1))];
  }
  const cols = Math.min(4, total);
  return [(index % cols - (cols - 1) / 2) * Math.min(2.5, (w - 2) / cols), -d * .18 + Math.floor(index / cols) * 2.7];
}

/** Shared architecture and product generator: district, preview and formal showroom. */
export function buildPavilion(spec, {
  compact = false
} = {}) {
  const root = new THREE.Group(),
    structure = new THREE.Group();
  root.add(structure);
  const style = spec.style || 'atelier',
    theme = PALETTES[style],
    w = Number(spec.dimensions.width),
    d = Number(spec.dimensions.depth),
    h = Number(spec.dimensions.height) || 5;
  const metal = mat(theme.metal, {
      metalness: .82,
      roughness: .35
    }),
    ink = mat(theme.ink, {
      metalness: .25,
      roughness: .5
    });
  const wall = mat(new THREE.Color(spec.palette.wall).multiplyScalar(style === 'gallery' ? .4 : .72), {
    surface: 'stone',
    roughness: .62
  });
  const floor = mat(new THREE.Color(spec.palette.floor).multiplyScalar(.72), {
    surface: 'tile',
    roughness: .32,
    metalness: .34
  });
  const light = glow(theme.light),
    accentMats = [];
  const brand = (options = {}) => {
    const m = mat(spec.palette.accent, options);
    accentMats.push(m);
    return m;
  };
  const brandGlow = glow(spec.palette.accent, 1.8);
  accentMats.push(brandGlow);
  panel(structure, w + 1.2, d + 1.2, .28, ink, [0, -.32, 0], [-Math.PI / 2, 0, 0]);
  block(structure, [w + .65, .065, d + .65], floor, [0, -.005, 0]);
  block(structure, [w + .7, .027, .027], brandGlow, [0, .035, d / 2 + .33]);
  [-1, 1].forEach(s => block(structure, [.025, .027, d + .65], light, [s * (w / 2 + .33), .035, 0]));
  const backZ = -d / 2 + .06;
  block(structure, [w, h, .25], wall, [0, h / 2, backZ]);
  // Back-wall reveals give scale and a deliberate architectural rhythm.
  for (let i = 0; i < 9; i++) block(structure, [.018, h - .25, .03], metal, [-w / 2 + .35 + i * (w - .7) / 8, h / 2, backZ + .15]);
  const rand = noise(spec.seed);
  // Coprime winding pairs prevent repeated, overlapping surfaces for some seeds.
  const windings = [[2, 3], [2, 5], [3, 4], [3, 5]][Math.abs(Number(spec.seed) || 0) % 4];
  const artwork = part(structure, new THREE.TorusKnotGeometry(.47, .045, 72, 6, ...windings), metal, [0, h * .5, backZ + .45], [rand() * Math.PI, rand() * Math.PI, 0]);
  artwork.userData.dynamic = true;
  if (style === 'atelier') {
    const radius = (w - .7) / 6,
      spring = h - radius - .45;
    for (const z of [backZ + .42]) for (let i = 0; i < 3; i++) {
      part(structure, archGeometry(radius, spring, .13), metal, [(i - 1) * (w - .7) / 3, 0, z]);
    }
    const front = part(structure, archGeometry(w * .47, 1.1, .13), metal, [0, 0, d * .25]);
    front.scale.y = (h + .2) / (w * .47 + 1.1);
    [-1, 1].forEach(s => {
      for (let i = 0; i < 10; i++) block(structure, [.09, h * .63, .10], metal, [s * (w / 2 - .1), h * .315, -d * .37 + i * d * .069]);
      block(structure, [.2, .2, d + .2], metal, [s * (w / 2 - .06), h * .65, 0]);
    });
    const phase = rand() * Math.PI,
      amplitude = .3 + rand() * .5;
    const ribbon = [];
    for (let i = 0; i <= 20; i++) {
      const a = i / 20 * Math.PI * 2 + phase;
      ribbon.push([(i / 20 - .5) * w * .95, h + .3 + Math.sin(a) * amplitude, -.8 + Math.cos(a) * 1.3]);
    }
    tube(structure, ribbon, .1, metal);
    tube(structure, ribbon.map(p => [p[0], p[1] + .035, p[2]]), .015, brandGlow);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * w * .31;
      block(structure, [1.6, .04, .75], light, [x, h - .05, -d * .1]);
    }
  } else if (style === 'gallery') {
    const white = mat('#B7C6D3', {
      metalness: .45,
      roughness: .3
    });
    // Offset frames and cantilever, with a dark negative space behind the looks.
    for (let i = 0; i < 2; i++) {
      const z = i ? d * .23 : backZ + .3;
      [-1, 1].forEach(s => block(structure, [.22, h, .28], white, [s * (w / 2 - .15), h / 2, z]));
      block(structure, [w + .4, .26, .35], white, [0, h, z]);
      block(structure, [w - .2, .018, .02], brandGlow, [0, h - .18, z + .2]);
    }
    block(structure, [w + 1.2, .3, d * .44], white, [.5, h + .18, -d * .2], [0, 0, -.025]);
    for (let i = 0; i < 8; i++) block(structure, [.06, h * .7, .10], metal, [-w / 2 + .2, h * .35, backZ + .8 + i * d * .085]);
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#6CB7D9',
      metalness: .3,
      roughness: .12,
      transparent: true,
      opacity: .12,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    block(structure, [.035, h * .72, d * .55], glass, [w / 2 - .02, h * .36, -d * .08]);
    torus(structure, 1.05, .045, metal, [-w * .32, 2.2, backZ + .24], [0, 0, 0]);
    torus(structure, .99, .015, brandGlow, [-w * .32, 2.2, backZ + .26], [0, 0, 0]);
    block(structure, [1.65, .025, d - .3], mat('#9DAEBE', {
      roughness: .22,
      metalness: .6
    }), [0, .042, 0]);
  } else {
    const wood = mat('#79624C', {
      surface: 'wood',
      roughness: .62
    });
    const rib = archGeometry(w / 2 - .15, .55, .07);
    for (let i = 0; i < 6; i++) {
      const r = part(structure, rib, wood, [-0, .1, backZ + .1 + i * (d - .2) / 5]);
      r.scale.y = (h + .2) / (w / 2 + .5);
    }
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#90C5B4',
      metalness: .2,
      roughness: .12,
      transparent: true,
      opacity: .08,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    part(structure, vault(w - .4, d, h - .3), glass);
    [-1, 1].forEach(s => {
      block(structure, [.75, .37, d * .66], ink, [s * (w / 2 - .48), .18, -.2]);
      for (let i = 0; i < (compact ? 2 : 4); i++) foliage(structure, s * (w / 2 - .48), -d * .28 + i * d * .18, .95 + i * .035, i + 7);
    });
    // Suspended planter and radial pendant make the greenhouse a distinct silhouette.
    const hanging = new THREE.Group();
    structure.add(hanging);
    hanging.position.set(0, h + .15, -d * .15);
    torus(hanging, 1.7, .06, wood, [0, 0, 0]);
    torus(hanging, 1.65, .018, light, [0, -.04, 0]);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      block(hanging, [.018, .5, .018], metal, [Math.cos(a) * 1.6, .25, Math.sin(a) * 1.6]);
    }
  }
  // Service furniture is integrated at the sides, clear of the collection axis.
  const counterX = w / 2 - 1.05,
    counterZ = d / 2 - .5;
  panel(structure, 1.65, .88, .55, ink, [counterX, .48, counterZ]);
  block(structure, [1.75, .06, .7], metal, [counterX, .98, counterZ + .25]);
  block(structure, [.3, .22, .035], ink, [counterX, 1.14, counterZ + .23], [-.2, 0, 0]);
  block(structure, [1.5, .018, .018], brandGlow, [counterX, .75, counterZ + .57]);
  sign(structure, 'CHECKOUT', '收银服务', {
    width: 1.4,
    position: [counterX, .48, counterZ + .565],
    accent: spec.palette.accent
  });
  const fitX = -w / 2 + .8,
    fitZ = d / 2 - .55;
  [-1, 1].forEach(s => block(structure, [.045, 2.7, .05], metal, [fitX + s * .6, 1.35, fitZ]));
  block(structure, [1.25, .05, .05], metal, [fitX, 2.7, fitZ]);
  const curtain = brand({
    roughness: .9,
    side: THREE.DoubleSide
  });
  const verts = [],
    idx = [];
  for (let i = 0; i <= 30; i++) {
    const x = fitX - .55 + i / 30 * 1.1,
      z = fitZ - .04 + Math.sin(i / 30 * Math.PI * 10) * .045;
    verts.push(x, .08, z, x, 2.54, z);
    if (i < 30) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const curtainGeo = new THREE.BufferGeometry();
  curtainGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  curtainGeo.setIndex(idx);
  curtainGeo.computeVertexNormals();
  part(structure, curtainGeo, curtain);
  sign(structure, 'FITTING', '试衣空间', {
    width: 1.1,
    position: [fitX, 2.35, fitZ + .055],
    accent: spec.palette.accent
  });
  const signage = new THREE.Group();
  signage.userData.dynamic = true;
  root.add(signage);
  function branding(next) {
    [...signage.children].forEach(disposeTree);
    sign(signage, next.store.name, `${NAMES[style]} / ${next.store.tagline || ''}`, {
      width: Math.min(w * (style === 'atelier' ? .4 : .66), style === 'atelier' ? 4.6 : 7),
      position: [0, h - (style === 'atelier' ? 1.05 : .83), backZ + .23],
      accent: next.palette.accent
    });
    accentMats.forEach(m => {
      m.color.set(next.palette.accent);
      if (m.isMeshBasicMaterial) m.color.multiplyScalar(1.8);
    });
  }
  branding(spec);
  if (!compact) {
    const lamp = new THREE.PointLight(theme.light, 28, Math.max(w, d) * 1.5, 2);
    lamp.position.set(0, h - .5, .5);
    root.add(lamp);
  }
  const items = [],
    total = compact ? Math.min(2, spec.products.length) : spec.products.length;
  spec.products.slice(0, total).forEach((product, i) => {
    const g = new THREE.Group();
    g.userData.dynamic = true;
    g.userData.product = product;
    root.add(g);
    const [x, z] = compact ? [(i - (total - 1) / 2) * w * .36, -.2] : productPosition(spec, i, total);
    g.position.set(x, 0, z);
    part(g, new THREE.CylinderGeometry(.66, .72, .15, 32), metal, [0, .12, 0]);
    const halo = torus(g, .67, .012, brandGlow, [0, .202, 0]);
    const model = createLook(product, compact);
    model.position.y = .2;
    g.add(model);
    if (!compact) sign(g, product.name, `¥${Number(product.price).toFixed(0)} / ${product.stock} 件`, {
      width: 1.8,
      position: [0, .35, .74],
      dark: true,
      accent: spec.palette.accent
    });
    items.push({
      group: g,
      model,
      halo,
      product
    });
  });
  if (!total) sign(root, '你的空白画布', '选择来源商品，生成真实陈列', {
    width: 5,
    position: [0, 2, 0],
    accent: spec.palette.accent
  });
  batchStatic(structure);
  return {
    root,
    structure,
    items,
    branding,
    accentMats,
    width: w,
    depth: d,
    height: h
  };
}

/** Continuous architecture connects the stores: this is a place, not separate icons. */
export function buildAtrium(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const stone = mat('#202B3C', {
      surface: 'tile',
      roughness: .3,
      metalness: .42
    }),
    edge = mat('#0B101C', {
      metalness: .6,
      roughness: .25
    }),
    chrome = mat('#586778', {
      metalness: .88,
      roughness: .2
    }),
    white = glow('#C5E4F2', 2.4),
    cyan = glow('#7DBCCF', 1.6);
  panel(root, 58, 47, .7, edge, [0, -.8, -7], [-Math.PI / 2, 0, 0]);
  block(root, [57, .06, 46], stone, [0, -.045, -7]);
  for (const s of [-1, 1]) {
    block(root, [.055, .025, 43], white, [s * 27, .025, -7]);
    block(root, [.025, .025, 23], cyan, [s * 2.2, .03, 10]);
    for (let i = 0; i < 4; i++) {
      const z = 8 - i * 10;
      block(root, [.22, 9.5, .3], chrome, [s * 26, 4.7, z]);
      block(root, [.035, 8.8, .025], white, [s * 25.87, 4.8, z + .18]);
    }
  }
  // Orbital canopy: continuous structural bands establish a room-sized scale.
  for (let i = 0; i < 3; i++) {
    const band = torus(root, 27 - i * .65, .28, chrome, [0, 10.7 + i * .11, -11]);
    band.scale.y = .66;
    const strip = torus(root, 26.8 - i * .65, .014, white, [0, 10.64 + i * .11, -11]);
    strip.scale.y = .66;
  }
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2;
    block(root, [.06, .13, 2], chrome, [Math.cos(a) * 26, 10.6, Math.sin(a) * 17.2 - 11], [0, -a + Math.PI / 2, 0]);
  }
  // Raised rear promenade and finely spaced luminous fins.
  block(root, [54, .32, 3], edge, [0, .14, -31]);
  for (let i = 0; i < 55; i++) block(root, [.08, 8, .12], i % 5 === 0 ? white : chrome, [-27 + i, 4, -32]);
  sign(root, 'METAMALL', 'FASHION BEYOND THE PHYSICAL', {
    width: 11,
    position: [0, 8, -31.6],
    accent: '#AADCEB'
  });
  // Arrival runway and concentric inlays lead the visitor to the three brands.
  block(root, [4.2, .025, 20], mat('#4E5C6C', {
    metalness: .5,
    roughness: .28
  }), [0, .005, 14]);
  for (const radius of [5.8, 6.05, 6.2]) torus(root, radius, .013, cyan, [0, .025, 3.6]);
  for (let i = 0; i < 10; i++) block(root, [.8, .012, .05], white, [0, .04, 6 + i * 1.4]);
  [-1, 1].forEach(s => {
    for (let i = 0; i < 3; i++) {
      const z = 4 - i * 7;
      panel(root, 3, .28, .9, edge, [s * 22, .3, z]);
      foliage(root, s * 22, z - .1, 1.4, 90 + i);
    }
  });
  batchStatic(root);
  return root;
}
