import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { addGlowFloor, addGlowSprite } from './glow.js';

const host = document.getElementById('mall-canvas');
const dataEl = document.getElementById('mall-data');
const tooltip = document.getElementById('mall-tooltip');

if (host && dataEl) {
  const stores = JSON.parse(dataEl.textContent);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06080f);
  scene.fog = new THREE.Fog(0x06080f, 13, 36);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 90);
  camera.position.set(0, 3.4, 11.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  host.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.7, -5.0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.02;
  controls.minDistance = 3;
  controls.maxDistance = 18;

  scene.add(new THREE.HemisphereLight(0x9fc7ff, 0x0a0d14, 1.15));
  const key = new THREE.DirectionalLight(0xcfe0ff, 2.15);
  key.position.set(-3, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -4;
  key.shadow.camera.far = 34;
  scene.add(key);
  const warm = new THREE.DirectionalLight(0xffd7b0, 1.0);
  warm.position.set(5, 3, 2);
  scene.add(warm);

  const loader = new THREE.TextureLoader();
  const clickable = [];
  let particles = null;
  let portalRings = [];
  const npcs = [];

  // Mirror floor. The reflection is the single biggest "3D" cue in the scene.
  const mirror = new Reflector(new THREE.PlaneGeometry(14, 26), {
    clipBias: 0.003,
    textureWidth: 512,
    textureHeight: 512,
    color: 0x080c15,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.set(0, 0.001, -2.5);
  scene.add(mirror);

  // Dark runway + neon edges above the mirror.
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 21),
    new THREE.MeshBasicMaterial({
      color: 0x0b1820,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(0, 0.012, -2.8);
  scene.add(runway);
  const cyan = new THREE.MeshBasicMaterial({
    color: 0x64d8e8,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const gold = new THREE.MeshBasicMaterial({
    color: 0xd9a441,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  [-1.12, 1.12].forEach((x) => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 21), cyan);
    edge.position.set(x, 0.025, -2.8);
    scene.add(edge);
    addGlowFloor(scene, { x, y: 0.026, z: -2.8, width: 0.55, height: 18, color: '#64d8e8', opacity: 0.16 });
  });
  [-4.5, 4.5].forEach((x) => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 20), gold);
    edge.position.set(x, 0.024, -2.8);
    scene.add(edge);
    addGlowFloor(scene, { x, y: 0.025, z: -2.8, width: 0.5, height: 16, color: '#d9a441', opacity: 0.12 });
  });

  // Side walls + neon verticals.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x080c15, roughness: 0.88 });
  [-6.8, 6.8].forEach((x) => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 5.4), wallMat);
    wall.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    wall.position.set(x, 2.7, -2.5);
    wall.receiveShadow = true;
    scene.add(wall);
  });
  for (let z = 2; z >= -12; z -= 3.4) {
    [-6.72, 6.72].forEach((x) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 4.8, 0.035), cyan);
      strip.position.set(x, 2.5, z);
      scene.add(strip);
      addGlowSprite(scene, { x, y: 2.5, z, scale: 1.2, color: '#64d8e8', opacity: 0.18 });
    });
  }

  // Ceiling ribs + light bars.
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 26),
    new THREE.MeshStandardMaterial({ color: 0x070a11, roughness: 0.95, side: THREE.DoubleSide })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 5.35, -2.5);
  scene.add(ceiling);
  for (let z = 3; z >= -13; z -= 3.2) {
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(13.8, 0.16, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x1a202c, metalness: 0.45, roughness: 0.5 })
    );
    rib.position.set(0, 4.95, z);
    scene.add(rib);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.035, 0.045), gold);
    bar.position.set(0, 4.82, z);
    scene.add(bar);
    addGlowSprite(scene, { x: 0, y: 4.8, z, scale: 4.5, color: '#d9a441', opacity: 0.12 });
  }

  function makeSignTexture(name, tagline, accent) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 260;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, 1200, 260);
    ctx.fillStyle = accent;
    ctx.fillRect(34, 30, 14, 200);
    ctx.fillStyle = '#f4efe7';
    ctx.font = 'bold 78px "Microsoft YaHei", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 78, 118);
    ctx.fillStyle = 'rgba(244,239,231,0.62)';
    ctx.font = '24px "Microsoft YaHei", sans-serif';
    ctx.fillText(tagline || 'ENTER THE STORE', 80, 202);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function makeVerticalSignTexture(name, accent) {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, 300, 900);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, 276, 876);
    ctx.fillStyle = '#f4efe7';
    ctx.font = 'bold 72px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    const chars = Array.from(name).slice(0, 6);
    const startY = 450 - (chars.length - 1) * 42;
    chars.forEach((ch, i) => ctx.fillText(ch, 150, startY + i * 84));
    ctx.fillStyle = accent;
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText('ENTER', 150, 820);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function makeBillboardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 700;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 700, 900);
    gradient.addColorStop(0, '#0b1c24');
    gradient.addColorStop(0.55, '#15101b');
    gradient.addColorStop(1, '#2a1820');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 700, 900);
    ctx.strokeStyle = 'rgba(217,164,65,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, 644, 844);
    ctx.fillStyle = '#d9a441';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.fillText('METAMALL / 01', 58, 96);
    ctx.fillStyle = '#f4efe7';
    ctx.font = 'bold 76px "Microsoft YaHei", sans-serif';
    ctx.fillText('新季', 58, 240);
    ctx.fillText('首发', 58, 336);
    ctx.fillStyle = 'rgba(244,239,231,0.58)';
    ctx.font = '24px "Microsoft YaHei", sans-serif';
    ctx.fillText('3 FACTORIES', 60, 430);
    ctx.fillText('3 FLAGSHIP STORES', 60, 472);
    ctx.fillText('1 STORE BUILDER', 60, 514);
    ctx.fillStyle = '#64d8e8';
    ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
    ctx.fillText('SCROLL TO EXPLORE', 60, 770);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function buildStorefront(store, index, side, z, spot = {}) {
    const group = new THREE.Group();
    const accent = new THREE.Color(store.accent || '#B23A48');
    group.position.set(spot.x ?? side * 4.45, 0, z);
    group.rotation.y = spot.rotation ?? side * -0.34;
    group.userData.url = store.url;
    group.userData.storeName = store.name;

    const step = new THREE.Mesh(
      new THREE.BoxGeometry(4.7, 0.18, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x141a25, roughness: 0.55, metalness: 0.2 })
    );
    step.position.set(0, 0.09, 0.7);
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 3.55, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x111722, roughness: 0.58, metalness: 0.18 })
    );
    back.position.set(0, 1.8, 0);
    back.castShadow = true;
    back.receiveShadow = true;
    group.add(back);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.05, 0.88),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(store.name, store.tagline, store.accent || '#B23A48') })
    );
    sign.position.set(0, 3.02, 0.14);
    group.add(sign);

    // neon frame
    const neon = new THREE.Mesh(
      new THREE.BoxGeometry(4.15, 0.035, 0.035),
      new THREE.MeshBasicMaterial({ color: accent, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.85 })
    );
    neon.position.set(0, 2.52, 0.2);
    group.add(neon);
    [-2.02, 2.02].forEach((x) => {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 2.6, 0.035),
        new THREE.MeshBasicMaterial({ color: accent, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.7 })
      );
      strip.position.set(x, 1.55, 0.2);
      group.add(strip);
    });

    // backlit display window
    const interior = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 2.25),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    interior.position.set(0, 1.55, 0.13);
    group.add(interior);

    // product posters inside the window
    const featured = (store.featured_images && store.featured_images.length)
      ? store.featured_images.slice(0, 2)
      : (store.featured ? [store.featured] : []);
    featured.forEach((image, i) => {
      loader.load(image, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const poster = new THREE.Mesh(
          new THREE.PlaneGeometry(1.15, 1.55),
          new THREE.MeshBasicMaterial({ map: texture })
        );
        poster.position.set(-0.95 + i * 1.9, 1.55, 0.16);
        poster.userData.url = store.url;
        group.add(poster);
        clickable.push(poster);
      });
    });

    // mannequin silhouettes behind the glass
    const skin = new THREE.MeshStandardMaterial({ color: 0xb98d72, roughness: 0.85 });
    [-0.95, 0.95].forEach((x) => {
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.16, 0.68, 4, 10),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.82 })
      );
      body.position.set(x, 1.0, 0.28);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin);
      head.position.set(x, 1.63, 0.28);
      body.castShadow = true;
      group.add(body, head);
    });

    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 1.95),
      new THREE.MeshStandardMaterial({
        color: 0x080c12,
        roughness: 0.28,
        metalness: 0.45,
        emissive: accent,
        emissiveIntensity: 0.12,
      })
    );
    door.position.set(1.35, 0.98, 0.17);
    group.add(door);
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.3, 0.035),
      new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.85, roughness: 0.2 })
    );
    handle.position.set(1.68, 1.05, 0.21);
    group.add(handle);

    // awning + edge light
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(4.25, 0.12, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x0c111a, roughness: 0.5, metalness: 0.4 })
    );
    awning.position.set(0, 2.54, 0.48);
    awning.castShadow = true;
    group.add(awning);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.025, 0.025), gold);
    edge.position.set(0, 2.47, 0.9);
    group.add(edge);

    // light shaft from awning
    const shaft = new THREE.Mesh(
      new THREE.ConeGeometry(1.7, 3.1, 28, 1, true),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.045,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    shaft.position.set(0, 1.55, 0.8);
    group.add(shaft);

    const glow = new THREE.PointLight(accent, 8, 8);
    glow.position.set(0, 1.9, 0.9);
    group.add(glow);
    addGlowSprite(group, { x: 0, y: 3.02, z: 0.05, scale: 4.8, color: `#${accent.getHexString()}`, opacity: 0.65 });
    addGlowFloor(group, { x: 0, y: 0.028, z: 1.0, width: 5.2, height: 2.2, color: `#${accent.getHexString()}`, opacity: 0.34 });

    // store number
    const num = document.createElement('canvas');
    num.width = 180;
    num.height = 180;
    const nctx = num.getContext('2d');
    nctx.fillStyle = '#070a12';
    nctx.fillRect(0, 0, 180, 180);
    nctx.strokeStyle = store.accent || '#B23A48';
    nctx.lineWidth = 4;
    nctx.strokeRect(10, 10, 160, 160);
    nctx.fillStyle = '#f4efe7';
    nctx.font = 'bold 72px Georgia, serif';
    nctx.textAlign = 'center';
    nctx.textBaseline = 'middle';
    nctx.fillText(String(index + 1).padStart(2, '0'), 90, 94);
    const numTex = new THREE.CanvasTexture(num);
    numTex.colorSpace = THREE.SRGBColorSpace;
    const numPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: numTex }));
    numPlate.position.set(-2.05, 3.28, 0.18);
    group.add(numPlate);

    group.children.forEach((child) => {
      child.userData.url = store.url;
      child.userData.storeName = store.name;
      clickable.push(child);
    });
    scene.add(group);

    // vertical blade sign in the walkway, readable from the entrance
    const blade = new THREE.Group();
    blade.position.set(side * 3.55, 0, z + 0.8);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 1.35, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a202c, metalness: 0.6, roughness: 0.35 })
    );
    pole.position.y = 0.68;
    const bladeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 1.65),
      new THREE.MeshBasicMaterial({ map: makeVerticalSignTexture(store.name, store.accent || '#B23A48'), side: THREE.DoubleSide })
    );
    bladeMesh.position.y = 2.25;
    bladeMesh.userData.url = store.url;
    bladeMesh.userData.storeName = store.name;
    blade.add(pole, bladeMesh);
    addGlowSprite(blade, { x: 0, y: 2.25, z: -0.04, scale: 1.7, color: store.accent || '#B23A48', opacity: 0.3 });
    clickable.push(bladeMesh);
    scene.add(blade);
  }

  function buildPortal() {
    const group = new THREE.Group();
    group.position.set(0, 2.75, -11.2);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xd9a441,
      metalness: 0.75,
      roughness: 0.2,
      emissive: 0xd9a441,
      emissiveIntensity: 0.75,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.06, 16, 96), ringMat);
    group.add(ring);
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.45, 0.024, 12, 96),
      new THREE.MeshStandardMaterial({ color: 0x64d8e8, emissive: 0x64d8e8, emissiveIntensity: 0.85, metalness: 0.4, roughness: 0.3 })
    );
    ring2.position.z = 0.03;
    group.add(ring2);
    const ring3 = new THREE.Mesh(
      new THREE.TorusGeometry(3.05, 0.014, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0xe07a5f, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending })
    );
    ring3.position.z = -0.04;
    group.add(ring3);

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(512, 512, 20, 512, 512, 500);
    grad.addColorStop(0, 'rgba(100,216,232,0.24)');
    grad.addColorStop(0.55, 'rgba(20,30,45,0.35)');
    grad.addColorStop(1, 'rgba(6,8,15,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.fillStyle = '#f4efe7';
    ctx.textAlign = 'center';
    ctx.font = 'bold 92px Georgia, serif';
    ctx.fillText('METAMALL', 512, 478);
    ctx.fillStyle = 'rgba(244,239,231,0.55)';
    ctx.font = '28px "Microsoft YaHei", sans-serif';
    ctx.fillText('NEXT SEASON / ENTER THE DISTRICT', 512, 536);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.77, 64),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, side: THREE.DoubleSide })
    );
    disc.position.z = -0.01;
    group.add(disc);
    addGlowSprite(group, { x: 0, y: 0, z: -0.1, scale: 8.6, color: '#64d8e8', opacity: 0.22 });
    scene.add(group);
    portalRings = [ring, ring2, ring3];

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(3.45, 3.55, 0.16, 64),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.35 })
    );
    platform.position.set(0, 0.08, -11.2);
    platform.receiveShadow = true;
    scene.add(platform);
    addGlowFloor(scene, { x: 0, y: 0.19, z: -11.2, width: 7.2, height: 3.2, color: '#64d8e8', opacity: 0.22 });

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(3.0, 3.0, 5.3, 64, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x64d8e8,
        transparent: true,
        opacity: 0.022,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    beam.position.set(0, 2.65, -11.2);
    scene.add(beam);

    const light = new THREE.PointLight(0x64d8e8, 14, 14);
    light.position.set(0, 2.4, -10.8);
    scene.add(light);
  }

  function buildSideBillboard() {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 4.1),
      new THREE.MeshBasicMaterial({ map: makeBillboardTexture() })
    );
    mesh.rotation.y = -Math.PI / 2;
    mesh.position.set(6.68, 2.55, -7.8);
    scene.add(mesh);
    addGlowSprite(scene, { x: 6.4, y: 2.5, z: -7.8, scale: 3.5, color: '#d9a441', opacity: 0.12 });
  }

  function buildProps() {
    const potMat = new THREE.MeshStandardMaterial({ color: 0x202834, roughness: 0.7, metalness: 0.2 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f6b4f, roughness: 0.9 });
    [[-3.3, -1.0], [3.3, -6.0], [-3.3, -9.5]].forEach(([x, z]) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.55, 12), potMat);
      pot.position.set(x, 0.28, z);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10), leafMat);
      leaves.position.set(x, 0.78, z);
      leaves.castShadow = true;
      scene.add(pot, leaves);
    });

    // ambient shoppers: a mall with no people feels dead
    const shopperColors = [0xd9a441, 0x64d8e8, 0xe07a5f, 0xc9c4ba];
    const shopperSpots = [
      [-2.1, -1.8], [2.1, -3.6], [-2.0, -6.2], [2.1, -8.8],
    ];
    shopperSpots.forEach(([x, z], i) => {
      const shopper = new THREE.Group();
      const outfitMat = new THREE.MeshStandardMaterial({ color: shopperColors[i], roughness: 0.85 });
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xd0ad90, roughness: 0.9 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.58, 4, 10), outfitMat);
      body.position.y = 1.08;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skinMat);
      head.position.y = 1.62;
      [-1, 1].forEach((side) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.5, 8), outfitMat);
        leg.position.set(side * 0.09, 0.42, 0);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.52, 8), outfitMat);
        arm.position.set(side * 0.23, 1.0, 0);
        arm.rotation.z = side * 0.16;
        shopper.add(leg, arm);
      });
      body.castShadow = true;
      head.castShadow = true;
      shopper.add(body, head);
      shopper.position.set(x, 0, z);
      shopper.scale.setScalar(0.92);
      shopper.userData.baseZ = z;
      shopper.userData.phase = i * 1.7;
      scene.add(shopper);
      npcs.push(shopper);
    });

    // floating dust / fireflies
    const count = 180;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = 0.5 + Math.random() * 4.3;
      positions[i * 3 + 2] = -12 + Math.random() * 18;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0x9fe8ff,
        size: 0.028,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(particles);
  }

  function build() {
    const layout = [
      { index: 0, side: -1, z: -1.6, x: -4.8 },
      { index: 1, side: 1, z: -4.8, x: 4.45 },
      { index: 2, side: -1, z: -9.2, x: -4.2, rotation: 0.0 },
    ];
    layout.forEach((spot) => {
      const store = stores[spot.index % stores.length];
      if (store) buildStorefront(store, spot.index, spot.side, spot.z, spot);
    });
    buildPortal();
    buildSideBillboard();
    buildProps();

    const resize = () => {
      const width = host.clientWidth || 640;
      const height = host.clientHeight || 480;
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize);
    resize();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hitStore = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickable, false);
      return hits.find((hit) => hit.object.userData.url);
    };
    renderer.domElement.addEventListener('pointermove', (event) => {
      const hit = hitStore(event);
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
      if (tooltip) {
        if (hit) {
          const rect = host.getBoundingClientRect();
          tooltip.textContent = `进入 ${hit.object.userData.storeName} →`;
          tooltip.style.opacity = '1';
          tooltip.style.transform = `translate(${event.clientX - rect.left + 14}px, ${event.clientY - rect.top + 14}px)`;
        } else {
          tooltip.style.opacity = '0';
        }
      }
    });
    renderer.domElement.addEventListener('pointerleave', () => {
      if (tooltip) tooltip.style.opacity = '0';
    });
    renderer.domElement.addEventListener('click', (event) => {
      const hit = hitStore(event);
      if (hit) window.location.href = hit.object.userData.url;
    });

    const clock = new THREE.Clock();
    let introDone = false;
    const animate = () => {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      if (!introDone) {
        const k = Math.min(1, t / 2.6);
        const ease = 1 - Math.pow(1 - k, 3);
        camera.position.y = 3.4 - ease * 0.95;
        camera.position.z = 11.5 - ease * 3.2;
        if (k >= 1) introDone = true;
      }
      if (portalRings.length) {
        portalRings[0].rotation.z = t * 0.18;
        portalRings[1].rotation.z = -t * 0.28;
        if (portalRings[2]) portalRings[2].rotation.z = t * 0.42;
      }
      if (particles) particles.rotation.y = t * 0.012;
      npcs.forEach((shopper) => {
        shopper.position.z = shopper.userData.baseZ + Math.sin(t * 0.22 + shopper.userData.phase) * 1.25;
        shopper.position.y = Math.abs(Math.sin(t * 1.25 + shopper.userData.phase)) * 0.035;
      });
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  }

  document.fonts.ready.then(build).catch(build);
} else if (host) {
  host.innerHTML = '<p style="color:#bbb;padding:24px">场景数据缺失。</p>';
}
