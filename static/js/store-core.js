import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { addGlowFloor, addGlowSprite } from './glow.js';

THREE.Cache.enabled = true;

const DEFAULTS = {
  boutique: { width: 12, depth: 10, height: 4, wall: '#F3EEE7', floor: '#B9A48C', accent: '#B23A48', sign: '#1F2937' },
  minimal: { width: 10, depth: 8, height: 3.6, wall: '#ECECEC', floor: '#C9C4BA', accent: '#3D7068', sign: '#1A1A1A' },
};

function disposeGroup(scene, group) {
  if (!group) return;
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      });
    }
  });
  scene.remove(group);
}

function darken(hex, factor = 0.22) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(factor);
  return c;
}

function makeSignTexture(name, tagline, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 260;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#080c15';
  ctx.fillRect(0, 0, 1200, 260);
  ctx.fillStyle = accent;
  ctx.fillRect(34, 28, 14, 204);
  ctx.fillStyle = '#f4efe7';
  ctx.font = 'bold 82px "Microsoft YaHei", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 78, 112);
  if (tagline) {
    ctx.fillStyle = 'rgba(244,239,231,0.6)';
    ctx.font = '25px "Microsoft YaHei", sans-serif';
    ctx.fillText(tagline, 80, 202);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createStoreScene(host, initialSpec, options = {}) {
  const state = {
    spec: initialSpec,
    roomGroup: null,
    productGroup: null,
    propGroup: null,
    signGroup: null,
    accentMaterials: [],
    particles: null,
  };
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06080f);
  scene.fog = new THREE.Fog(0x06080f, 13, 34);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.pixelRatio || 1.35));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  host.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.02;
  controls.minDistance = 3;
  controls.maxDistance = 18;

  scene.add(new THREE.HemisphereLight(0x9fc7ff, 0x080a10, 0.7));
  const key = new THREE.DirectionalLight(0xbfd8ff, 1.8);
  key.position.set(4, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  key.shadow.camera.far = 28;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffd7b0, 0.65);
  fill.position.set(-5, 3, 2);
  scene.add(fill);

  const loader = new THREE.TextureLoader();

  function specDimensions(spec) {
    const t = DEFAULTS[spec.template] || DEFAULTS.boutique;
    const d = spec.dimensions || {};
    return {
      width: Number(d.width || t.width),
      depth: Number(d.depth || t.depth),
      height: Number(d.height || t.height),
      wall: (spec.palette && spec.palette.wall) || t.wall,
      floor: (spec.palette && spec.palette.floor) || t.floor,
      accent: (spec.palette && spec.palette.accent) || t.accent,
      sign: (spec.palette && spec.palette.sign) || t.sign,
    };
  }

  function buildRoom(spec) {
    const dims = specDimensions(spec);
    const group = new THREE.Group();

    // mirror floor
    const mirror = new Reflector(new THREE.PlaneGeometry(dims.width, dims.depth), {
      clipBias: 0.003,
      textureWidth: 512,
      textureHeight: 512,
      color: 0x080c14,
    });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = 0.002;
    group.add(mirror);
    const floorHaze = new THREE.Mesh(
      new THREE.PlaneGeometry(dims.width, dims.depth),
      new THREE.MeshBasicMaterial({
        color: 0x06080f,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      })
    );
    floorHaze.rotation.x = -Math.PI / 2;
    floorHaze.position.y = 0.012;
    group.add(floorHaze);

    const wallColor = darken(dims.wall, 0.24);
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.88 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(dims.width, dims.height), wallMat);
    back.position.set(0, dims.height / 2, -dims.depth / 2);
    back.receiveShadow = true;
    group.add(back);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(dims.depth, dims.height), wallMat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-dims.width / 2, dims.height / 2, 0);
    left.receiveShadow = true;
    group.add(left);
    const right = left.clone();
    right.rotation.y = -Math.PI / 2;
    right.position.x = dims.width / 2;
    group.add(right);

    // accent perimeter light at floor level
    const accent = new THREE.Color(dims.accent);
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(dims.width - 0.3, 0.035, 0.04),
      new THREE.MeshBasicMaterial({ color: accent, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8 })
    );
    trim.position.set(0, 0.09, -dims.depth / 2 + 0.03);
    group.add(trim);
    state.accentMaterials.push(trim.material);

    // dark ceiling + linear light bars
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(dims.width, dims.depth),
      new THREE.MeshStandardMaterial({ color: 0x070a12, roughness: 0.95, side: THREE.DoubleSide })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = dims.height;
    group.add(ceiling);
    const stripMat = new THREE.MeshBasicMaterial({
      color: 0xffe4b8,
      transparent: true,
      opacity: 0.9,
    });
    [-0.3, 0.02, 0.34].forEach((ratio) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(dims.width * 0.6, 0.03, 0.05), stripMat);
      strip.position.set(0, dims.height - 0.035, dims.depth * ratio);
      group.add(strip);
    });

    // backlit niche behind product wall
    const niche = new THREE.Mesh(
      new THREE.PlaneGeometry(dims.width * 0.72, dims.height * 0.56),
      new THREE.MeshStandardMaterial({
        color: 0x0b1019,
        roughness: 0.8,
        emissive: accent,
        emissiveIntensity: 0.06,
      })
    );
    niche.position.set(0, dims.height * 0.53, -dims.depth / 2 + 0.02);
    group.add(niche);
    state.accentMaterials.push(niche.material);

    scene.add(group);
    state.roomGroup = group;
  }

  function buildSign(spec) {
    disposeGroup(scene, state.signGroup);
    const dims = specDimensions(spec);
    const group = new THREE.Group();
    const width = Math.min(dims.width * 0.66, 7.2);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(width, width * 0.2),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(spec.store.name, spec.store.tagline || '', dims.accent) })
    );
    group.add(plane);
    addGlowSprite(group, { x: 0, y: 0, z: -0.02, scale: width * 0.75, color: dims.accent, opacity: 0.32 });
    group.position.set(0, dims.height - 0.62, -dims.depth / 2 + 0.05);
    scene.add(group);
    state.signGroup = group;
  }

  function buildProducts(spec) {
    disposeGroup(scene, state.productGroup);
    const dims = specDimensions(spec);
    const group = new THREE.Group();
    const products = (spec.products || []).slice(0, 4);
    const maxCols = Math.max(1, products.length);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x161b26,
      roughness: 0.32,
      metalness: 0.55,
      emissive: dims.accent,
      emissiveIntensity: 0.05,
    });
    state.accentMaterials.push(frameMat);
    products.forEach((product, index) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.09), frameMat);
      frame.castShadow = true;
      const posterMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(product.color || dims.accent) });
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.46), posterMat);
      poster.position.z = 0.06;
      if (product.image) {
        loader.load(product.image, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          posterMat.map = texture;
          posterMat.color.set(0xffffff);
          posterMat.needsUpdate = true;
        });
      }
      const item = new THREE.Group();
      item.add(frame, poster);
      addGlowSprite(item, { x: 0, y: 0, z: -0.02, scale: 1.9, color: product.color || dims.accent, opacity: 0.12 });
      const x = -((maxCols - 1) * 2.2) / 2 + index * 2.2;
      item.position.set(x, 1.6, -dims.depth / 2 + 0.16);
      group.add(item);
    });

    // two visible light shafts over the hero wall
    [-1.8, 1.8].forEach((x) => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.0, 2.8, 20, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xffd7a0,
          transparent: true,
          opacity: 0.035,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      cone.position.set(x, 2.4, -dims.depth / 2 + 1.1);
      group.add(cone);
      const spot = new THREE.PointLight(0xffd7a0, 5, 6);
      spot.position.set(x, 2.8, -dims.depth / 2 + 1.4);
      group.add(spot);
    });
    scene.add(group);
    state.productGroup = group;
  }

  function buildProps(spec) {
    disposeGroup(scene, state.propGroup);
    const dims = specDimensions(spec);
    const accent = new THREE.Color(dims.accent);
    const group = new THREE.Group();
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a303b, metalness: 0.55, roughness: 0.38 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x4c382a, roughness: 0.82 });

    // central display table + folded stacks
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 1.25), wood);
    table.position.set(0, 0.37, 1.1);
    table.castShadow = true;
    group.add(table);
    for (let i = 0; i < 3; i += 1) {
      const stack = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.18, 0.4),
        new THREE.MeshStandardMaterial({ color: i === 0 ? accent : i === 1 ? 0xe8dccb : 0x4f6b58, roughness: 0.9 })
      );
      stack.position.set(-0.65 + i * 0.65, 0.84, 1.05);
      stack.castShadow = true;
      group.add(stack);
    }
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(4.2, dims.width * 0.4), 2.6),
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.18, depthWrite: false })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.014, 1.1);
    group.add(rug);

    // racks
    [-1, 1].forEach((side) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.8), darkMetal);
      bar.position.set(side * dims.width * 0.3, 1.85, -0.7);
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 0.05), darkMetal);
      leg1.position.set(bar.position.x, 0.9, -2.0);
      const leg2 = leg1.clone();
      leg2.position.z = 0.6;
      group.add(bar, leg1, leg2);
      for (let i = 0; i < 4; i += 1) {
        const garment = new THREE.Mesh(
          new THREE.PlaneGeometry(0.44, 1.15),
          new THREE.MeshStandardMaterial({
            color: i === 0 ? accent : i === 1 ? 0xe8dccb : 0x3a3f4a,
            roughness: 0.9,
            side: THREE.DoubleSide,
          })
        );
        garment.position.set(bar.position.x, 1.28, -1.7 + i * 0.62);
        garment.rotation.y = Math.PI / 2;
        group.add(garment);
      }
    });

    // counter with a neon edge
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.95, 0.7), darkMetal);
    counter.position.set(dims.width / 2 - 1.45, 0.48, dims.depth / 2 - 0.9);
    counter.castShadow = true;
    group.add(counter);
    const counterEdge = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.03, 0.03),
      new THREE.MeshBasicMaterial({ color: accent, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8 })
    );
    counterEdge.position.set(counter.position.x, 0.98, counter.position.z + 0.36);
    group.add(counterEdge);

    // fitting-room curtain
    const curtain = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 2.2),
      new THREE.MeshStandardMaterial({ color: accent, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    curtain.position.set(-dims.width / 2 + 0.08, 1.1, dims.depth / 2 - 1.0);
    curtain.rotation.y = Math.PI / 2;
    group.add(curtain);
    state.accentMaterials.push(curtain.material);

    // mannequins
    const skin = new THREE.MeshStandardMaterial({ color: 0xc49b7d, roughness: 0.85 });
    const outfit = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.9 });
    state.accentMaterials.push(outfit);
    [-1, 1].forEach((side) => {
      const mannequin = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.72, 4, 10), outfit);
      body.position.y = 1.05;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), skin);
      head.position.y = 1.68;
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16), darkMetal);
      stand.position.y = 0.03;
      mannequin.add(body, head, stand);
      mannequin.position.set(side * dims.width * 0.27, 0, -0.1);
      mannequin.traverse((o) => { o.castShadow = true; });
      group.add(mannequin);
    });

    // plants
    const potMat = new THREE.MeshStandardMaterial({ color: 0x20262f, roughness: 0.8 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f6b4f, roughness: 0.9 });
    [-1, 1].forEach((side) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 12), potMat);
      pot.position.set(side * (dims.width / 2 - 0.55), 0.25, dims.depth / 2 - 0.7);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10), leafMat);
      leaves.position.set(pot.position.x, 0.8, pot.position.z);
      leaves.castShadow = true;
      group.add(pot, leaves);
    });

    // ceiling track fixtures
    for (let i = 0; i < 4; i += 1) {
      const fixture = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.12, 10),
        new THREE.MeshStandardMaterial({ color: 0x161b24, metalness: 0.6, roughness: 0.35 })
      );
      fixture.position.set(-1.8 + i * 1.2, dims.height - 0.1, -dims.depth * 0.18);
      group.add(fixture);
    }

    // floor glow at the product wall
    const glow = addGlowFloor(group, {
      x: 0,
      y: 0.018,
      z: -dims.depth / 2 + 0.9,
      width: dims.width * 0.62,
      height: 1.8,
      color: accent.getStyle(),
      opacity: 0.18,
    });
    state.accentMaterials.push(glow.material);

    // dust particles
    const count = 60;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * dims.width * 0.8;
      positions[i * 3 + 1] = 0.5 + Math.random() * (dims.height - 1);
      positions[i * 3 + 2] = (Math.random() - 0.5) * dims.depth * 0.8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    state.particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xffd7a0,
        size: 0.025,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    group.add(state.particles);

    scene.add(group);
    state.propGroup = group;
  }

  function rebuildAll(spec) {
    state.spec = spec;
    disposeGroup(scene, state.roomGroup);
    disposeGroup(scene, state.productGroup);
    disposeGroup(scene, state.propGroup);
    disposeGroup(scene, state.signGroup);
    state.accentMaterials = [];
    state.signGroup = null;
    buildRoom(spec);
    buildSign(spec);
    buildProducts(spec);
    buildProps(spec);
    const dims = specDimensions(spec);
    camera.position.set(dims.width * 0.4, dims.height * 0.5, dims.depth * 0.92);
    controls.target.set(0, 1.35, -dims.depth * 0.1);
    controls.update();
  }

  function refresh(spec) {
    const old = specDimensions(state.spec);
    const next = specDimensions(spec);
    const templateChanged = state.spec.template !== spec.template ||
      old.width !== next.width || old.depth !== next.depth || old.height !== next.height;
    if (templateChanged) {
      rebuildAll(spec);
      return;
    }
    state.spec = spec;
    buildSign(spec);
    state.accentMaterials.forEach((mat) => {
      mat.color.set(next.accent);
      if (mat.emissive) mat.emissive.set(next.accent);
    });
    buildProducts(spec);
  }

  function resize() {
    const width = host.clientWidth || 640;
    const height = host.clientHeight || 480;
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let raf = 0;
  const clock = new THREE.Clock();
  function animate() {
    raf = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    if (state.particles) state.particles.rotation.y = t * 0.03;
    controls.update();
    renderer.render(scene, camera);
  }

  const api = {
    refresh,
    rebuildAll,
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      disposeGroup(scene, state.roomGroup);
      disposeGroup(scene, state.productGroup);
      disposeGroup(scene, state.propGroup);
      disposeGroup(scene, state.signGroup);
      renderer.dispose();
      host.innerHTML = '';
    },
  };
  rebuildAll(initialSpec);
  animate();
  return api;
}
