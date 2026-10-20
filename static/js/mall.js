import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const host = document.getElementById('mall-canvas');
const dataEl = document.getElementById('mall-data');
if (host && dataEl) {
  const stores = JSON.parse(dataEl.textContent);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10141d);
  scene.fog = new THREE.Fog(0x10141d, 15, 34);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
  camera.position.set(0, 3.05, 8.4);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  host.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.55, -2.4);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.04;
  controls.minDistance = 4;
  controls.maxDistance = 14;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x273044, 1.25));
  const key = new THREE.DirectionalLight(0xfff1dd, 2.3);
  key.position.set(4, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -12;
  key.shadow.camera.right = 12;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -6;
  key.shadow.camera.far = 30;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc7ff, 1.0);
  rim.position.set(-7, 4, 2);
  scene.add(rim);

  const loader = new THREE.TextureLoader();
  const clickable = [];

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 20),
    new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.92 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.03;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(28, 28, 0x3c475d, 0x242c3c);
  grid.position.y = 0.005;
  scene.add(grid);

  // warm walkway strip
  const walkway = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x242838, roughness: 0.8 })
  );
  walkway.rotation.x = -Math.PI / 2;
  walkway.position.set(0, 0.01, 2.2);
  scene.add(walkway);

  function makeSign(text, accent) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 220;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1d2330';
    ctx.fillRect(0, 0, 1024, 220);
    ctx.fillStyle = accent;
    ctx.fillRect(34, 38, 14, 144);
    ctx.fillStyle = '#f4efe7';
    ctx.font = 'bold 72px "Microsoft YaHei", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 78, 108);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function makeHeaderSign() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#10141d';
    ctx.fillRect(0, 0, 1024, 160);
    ctx.fillStyle = '#d9a441';
    ctx.font = 'bold 42px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('METAMALL', 512, 72);
    ctx.fillStyle = 'rgba(244,239,231,0.55)';
    ctx.font = '22px "Microsoft YaHei", sans-serif';
    ctx.fillText('3 FACTORIES  /  3 STOREFRONTS  /  1 BUILDER', 512, 118);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const header = new THREE.Mesh(
    new THREE.PlaneGeometry(7.4, 1.15),
    new THREE.MeshBasicMaterial({ map: makeHeaderSign(), transparent: true })
  );
  header.position.set(0, 4.25, -4.6);
  scene.add(header);

  function buildStorefront(store, index) {
    const group = new THREE.Group();
    const accent = new THREE.Color(store.accent || '#B23A48');
    group.position.set((index - 1) * 5.0, 0, -2.8);
    group.userData.url = store.url;

    // base platform / steps
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.16, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x323a4a, roughness: 0.8 })
    );
    step.position.set(0, 0.08, 0.65);
    step.receiveShadow = true;
    group.add(step);

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(4.1, 3.4, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x293040, roughness: 0.72 })
    );
    back.position.set(0, 1.72, 0);
    back.castShadow = true;
    back.receiveShadow = true;
    group.add(back);

    // sign
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.75, 0.82),
      new THREE.MeshBasicMaterial({ map: makeSign(store.name, store.accent || '#B23A48') })
    );
    sign.position.set(0, 2.9, 0.13);
    group.add(sign);

    // awning with small accent stripes
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(4.0, 0.12, 0.75),
      new THREE.MeshStandardMaterial({ color: 0x1d2330, roughness: 0.8 })
    );
    awning.position.set(0, 2.38, 0.42);
    awning.castShadow = true;
    group.add(awning);
    for (let i = 0; i < 5; i += 1) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.05),
        new THREE.MeshBasicMaterial({ color: accent })
      );
      stripe.position.set(-1.6 + i * 0.8, 2.325, 0.8);
      group.add(stripe);
    }

    // window display with featured product
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x151a24,
      roughness: 0.35,
      metalness: 0.15,
    });
    const display = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.85), windowMat);
    display.position.set(-0.95, 1.15, 0.12);
    group.add(display);
    if (store.featured) {
      loader.load(store.featured, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const poster = new THREE.Mesh(
          new THREE.PlaneGeometry(1.35, 1.7),
          new THREE.MeshBasicMaterial({ map: texture })
        );
        poster.position.set(-0.95, 1.15, 0.14);
        poster.userData.url = store.url;
        group.add(poster);
        clickable.push(poster);
      });
    }

    // door with warm interior
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 1.72),
      new THREE.MeshStandardMaterial({ color: 0x2a2422, roughness: 0.5, emissive: 0x3a251d, emissiveIntensity: 0.35 })
    );
    door.position.set(1.15, 0.86, 0.12);
    group.add(door);
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.28, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.8, roughness: 0.25 })
    );
    handle.position.set(1.5, 0.95, 0.16);
    group.add(handle);

    // side trims
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 3.2, 0.1),
      new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.4 })
    );
    trim.position.set(-2.0, 1.65, 0.14);
    group.add(trim);
    const trim2 = trim.clone();
    trim2.position.x = 2.0;
    group.add(trim2);

    // products behind door/window
    for (let i = 0; i < 4; i += 1) {
      const frame = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.6),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.85 })
      );
      frame.position.set(1.0 + (i % 2) * 0.48, 1.65 - Math.floor(i / 2) * 0.7, 0.13);
      group.add(frame);
    }

    const glow = new THREE.PointLight(accent, 1.8, 4);
    glow.position.set(0, 1.8, 0.8);
    group.add(glow);

    group.children.forEach((child) => {
      child.userData.url = store.url;
      clickable.push(child);
    });
    scene.add(group);
  }

  function buildPlaza() {
    // planters
    const potMat = new THREE.MeshStandardMaterial({ color: 0x3a2d24, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f6b4f, roughness: 0.9 });
    [-6.4, 6.4].forEach((x) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.7, 14), potMat);
      pot.position.set(x, 0.35, 3.6);
      pot.castShadow = true;
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 12), leafMat);
      leaves.position.set(x, 1.05, 3.6);
      leaves.castShadow = true;
      scene.add(pot, leaves);
    });

    // bench
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.85 });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.7), wood);
    bench.position.set(0, 0.55, 4.6);
    bench.castShadow = true;
    scene.add(bench);
    [-1.3, 1.3].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.55), wood);
      leg.position.set(x, 0.27, 4.6);
      scene.add(leg);
    });

    // string lights
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffd58a, emissive: 0xffb84d, emissiveIntensity: 1.1 });
    for (let i = 0; i < 12; i += 1) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), bulbMat);
      bulb.position.set(-5.6 + i * 1.02, 3.45 + Math.sin(i * 0.9) * 0.18, -4.1);
      scene.add(bulb);
    }
  }

  function build() {
    stores.forEach(buildStorefront);
    buildPlaza();
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
    renderer.domElement.addEventListener('click', (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickable, false);
      if (hits.length && hits[0].object.userData.url) {
        window.location.href = hits[0].object.userData.url;
      }
    });

    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      camera.position.y = 3.05 + Math.sin(t * 0.35) * 0.05;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  }

  document.fonts.ready.then(build).catch(build);
} else if (host) {
  host.innerHTML = '<p style="color:#bbb;padding:24px">场景数据缺失。</p>';
}
