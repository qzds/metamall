import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

function makeSignTexture(name, tagline, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1d2330';
  ctx.fillRect(0, 0, 1200, 220);
  ctx.fillStyle = accent;
  ctx.fillRect(34, 28, 14, 164);
  ctx.fillStyle = '#f4efe7';
  ctx.font = 'bold 76px "Microsoft YaHei", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 76, 92);
  if (tagline) {
    ctx.fillStyle = 'rgba(244,239,231,0.62)';
    ctx.font = '24px "Microsoft YaHei", sans-serif';
    ctx.fillText(tagline, 78, 164);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createStoreScene(host, initialSpec, options = {}) {
  const state = { spec: initialSpec, roomGroup: null, productGroup: null, propGroup: null, signMesh: null, accentMaterials: [] };
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x11141c);
  scene.fog = new THREE.Fog(0x11141c, 14, 34);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, options.pixelRatio || 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  host.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.04;
  controls.minDistance = 3;
  controls.maxDistance = 18;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x2b3244, 1.25));
  const key = new THREE.DirectionalLight(0xfff0dd, 2.35);
  key.position.set(4, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 9;
  key.shadow.camera.bottom = -9;
  key.shadow.camera.far = 28;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xa8c8ff, 0.75);
  fill.position.set(-5, 4, 2);
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
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(dims.width, dims.depth),
      new THREE.MeshStandardMaterial({ color: dims.floor, roughness: 0.88 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: dims.wall, roughness: 0.95 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(dims.width, dims.height), wallMat);
    back.position.set(0, dims.height / 2, -dims.depth / 2);
    back.receiveShadow = true;
    group.add(back);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(dims.depth, dims.height), wallMat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-dims.width / 2, dims.height / 2, 0);
    left.receiveShadow = true;
    group.add(left);
    const right = new THREE.Mesh(new THREE.PlaneGeometry(dims.depth, dims.height), wallMat);
    right.rotation.y = -Math.PI / 2;
    right.position.set(dims.width / 2, dims.height / 2, 0);
    right.receiveShadow = true;
    group.add(right);

    // ceiling trim / cove light
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(dims.width - 0.4, 0.08, 0.12),
      new THREE.MeshStandardMaterial({ color: dims.accent, emissive: dims.accent, emissiveIntensity: 0.45 })
    );
    trim.position.set(0, dims.height - 0.15, -dims.depth / 2 + 0.12);
    group.add(trim);
    state.accentMaterials.push(trim.material);

    scene.add(group);
    state.roomGroup = group;
  }

  function buildSign(spec) {
    if (state.signMesh) {
      scene.remove(state.signMesh);
      if (state.signMesh.material.map) state.signMesh.material.map.dispose();
      state.signMesh.material.dispose();
    }
    const dims = specDimensions(spec);
    const width = Math.min(dims.width * 0.66, 7.2);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, width * 0.18),
      new THREE.MeshBasicMaterial({
        map: makeSignTexture(spec.store.name, spec.store.tagline || '', dims.accent),
      })
    );
    mesh.position.set(0, dims.height - 0.65, -dims.depth / 2 + 0.04);
    scene.add(mesh);
    state.signMesh = mesh;
  }

  function buildProducts(spec) {
    disposeGroup(scene, state.productGroup);
    const dims = specDimensions(spec);
    const group = new THREE.Group();
    const products = (spec.products || []).slice(0, 4);
    const maxCols = Math.max(1, products.length);
    products.forEach((product, index) => {
      const col = index % maxCols;
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(1.16, 1.56, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x252a35, roughness: 0.45, metalness: 0.25 })
      );
      frame.castShadow = true;
      const posterMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(product.color || dims.accent) });
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 1.42), posterMat);
      poster.position.z = 0.05;
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
      const x = -((maxCols - 1) * 2.15) / 2 + col * 2.15;
      item.position.set(x, 1.55, -dims.depth / 2 + 0.15);
      group.add(item);
    });

    // spotlights in front of hero wall
    for (let i = 0; i < Math.min(2, maxCols); i += 1) {
      const spot = new THREE.PointLight(0xffd9b0, 4.5, 6);
      spot.position.set(-1.8 + i * 3.6, dims.height - 0.7, -dims.depth / 2 + 1.2);
      group.add(spot);
    }
    scene.add(group);
    state.productGroup = group;
  }

  function buildProps(spec) {
    disposeGroup(scene, state.propGroup);
    const dims = specDimensions(spec);
    const group = new THREE.Group();
    const accent = new THREE.Color(dims.accent);
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x272b33, roughness: 0.7 });

    // central table + folded stacks
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.75, 1.25), wood);
    table.position.set(0, 0.38, 1.1);
    table.castShadow = true;
    group.add(table);
    for (let i = 0; i < 3; i += 1) {
      const stack = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.18, 0.4),
        new THREE.MeshStandardMaterial({ color: [dims.accent, 0xe8dccb, 0x6b7f6b][i], roughness: 0.9 })
      );
      stack.position.set(-0.65 + i * 0.65, 0.85, 1.05);
      stack.castShadow = true;
      group.add(stack);
    }
    // rug
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(4.2, dims.width * 0.4), 2.6),
      new THREE.MeshStandardMaterial({ color: accent, roughness: 1, transparent: true, opacity: 0.42 })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.012, 1.1);
    group.add(rug);
    state.accentMaterials.push(rug.material);

    // racks left/right
    const rackPositions = [
      [-dims.width * 0.32, 0.9, -0.8],
      [dims.width * 0.32, 0.9, -0.8],
    ];
    rackPositions.forEach((pos) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.6), dark);
      bar.position.set(pos[0], 1.75, pos[2]);
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 0.06), dark);
      leg1.position.set(pos[0], 0.85, pos[2] - 1.25);
      const leg2 = leg1.clone();
      leg2.position.z = pos[2] + 1.25;
      group.add(bar, leg1, leg2);
      for (let i = 0; i < 3; i += 1) {
        const garment = new THREE.Mesh(
          new THREE.PlaneGeometry(0.42, 0.95),
          new THREE.MeshStandardMaterial({ color: i === 0 ? accent : [0xe8dccb, 0x4a4a4a][i - 1], roughness: 0.9, side: THREE.DoubleSide })
        );
        garment.position.set(pos[0], 1.25, pos[2] - 0.65 + i * 0.62);
        garment.rotation.y = Math.PI / 2;
        group.add(garment);
      }
    });

    // checkout counter
    const counter = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.95, 0.7), wood);
    counter.position.set(dims.width / 2 - 1.4, 0.48, dims.depth / 2 - 1.0);
    counter.castShadow = true;
    group.add(counter);
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.06, 0.76), dark);
    counterTop.position.set(counter.position.x, 0.98, counter.position.z);
    group.add(counterTop);

    // fitting room curtain
    const curtain = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 2.1),
      new THREE.MeshStandardMaterial({ color: accent, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    curtain.position.set(-dims.width / 2 + 0.08, 1.05, dims.depth / 2 - 1.2);
    curtain.rotation.y = Math.PI / 2;
    group.add(curtain);
    state.accentMaterials.push(curtain.material);

    // plants
    const potMat = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f6b4f, roughness: 0.9 });
    [[-1, -1], [1, 1]].forEach(([sx, sz]) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 12), potMat);
      pot.position.set(sx * (dims.width / 2 - 0.55), 0.25, sz * (dims.depth / 2 - 0.65));
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), leafMat);
      leaves.position.set(pot.position.x, 0.8, pot.position.z);
      leaves.castShadow = true;
      group.add(pot, leaves);
    });

    scene.add(group);
    state.propGroup = group;
  }

  function rebuildAll(spec) {
    state.spec = spec;
    disposeGroup(scene, state.roomGroup);
    disposeGroup(scene, state.productGroup);
    disposeGroup(scene, state.propGroup);
    state.accentMaterials = [];
    buildRoom(spec);
    buildSign(spec);
    buildProducts(spec);
    buildProps(spec);
    const dims = specDimensions(spec);
    camera.position.set(0, 2.45, dims.depth * 0.82);
    controls.target.set(0, 1.45, -dims.depth * 0.12);
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

  const clock = new THREE.Clock();
  let raf = 0;
  function animate() {
    raf = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.16) * 0.28;
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
      renderer.dispose();
      host.innerHTML = '';
    },
  };
  rebuildAll(initialSpec);
  animate();
  return api;
}
