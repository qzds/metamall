import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const host = document.getElementById('store-canvas');
const dataEl = document.getElementById('store-scene');
if (host && dataEl) {
  const spec = JSON.parse(dataEl.textContent);
  const dims = spec.dimensions || { width: 12, depth: 10, height: 4 };
  const palette = spec.palette || {};
  const products = spec.products || [];

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141821);
  scene.fog = new THREE.Fog(0x141821, 12, 30);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 80);
  camera.position.set(0, 2.4, dims.depth * 0.78);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.style.display = 'block';
  host.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.45, -dims.depth * 0.2);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.04;
  controls.minDistance = 3;
  controls.maxDistance = 18;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3140, 1.25));
  const key = new THREE.DirectionalLight(0xfff1dd, 2.0);
  key.position.set(3, 7, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa8c8ff, 0.9);
  rim.position.set(-4, 3, 2);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.width, dims.depth),
    new THREE.MeshStandardMaterial({ color: palette.floor || '#B9A48C', roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: palette.wall || '#F3EEE7', roughness: 0.95 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(dims.width, dims.height), wallMat);
  back.position.set(0, dims.height / 2, -dims.depth / 2);
  scene.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(dims.depth, dims.height), wallMat);
  left.rotation.y = Math.PI / 2;
  left.position.set(-dims.width / 2, dims.height / 2, 0);
  scene.add(left);
  const right = left.clone();
  right.position.x = dims.width / 2;
  scene.add(right);

  function makeSign(text, accent) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 220;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1d2330';
    ctx.fillRect(0, 0, 1024, 220);
    ctx.fillStyle = accent;
    ctx.fillRect(34, 40, 14, 140);
    ctx.fillStyle = '#f4efe7';
    ctx.font = 'bold 76px "Microsoft YaHei", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 78, 112);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function build() {
    const accent = palette.accent || '#B23A48';
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(dims.width * 0.7, 7), 1.2),
      new THREE.MeshBasicMaterial({ map: makeSign(spec.store.name, accent) })
    );
    sign.position.set(0, dims.height - 0.95, -dims.depth / 2 + 0.03);
    scene.add(sign);

    products.forEach((product, index) => {
      const color = product.color || accent;
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.5, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x252a35, roughness: 0.5, metalness: 0.2 })
      );
      const poster = new THREE.Mesh(
        new THREE.PlaneGeometry(0.98, 1.36),
        new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
      );
      poster.position.z = 0.05;
      const group = new THREE.Group();
      group.add(frame, poster);
      const columns = Math.min(4, Math.max(1, Math.floor(dims.width / 2.6)));
      const row = Math.floor(index / columns);
      const col = index % columns;
      group.position.set(
        -((columns - 1) * 2.2) / 2 + col * 2.2,
        1.65 + row * 1.75,
        -dims.depth / 2 + 0.16
      );
      scene.add(group);
    });

    const rackMat = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.85 });
    for (let i = 0; i < 3; i += 1) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 2.2), rackMat);
      rack.position.set(-dims.width * 0.3 + i * dims.width * 0.3, 0.9, 0.4);
      scene.add(rack);
    }

    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(3.4, dims.width * 0.35), 2.2),
      new THREE.MeshStandardMaterial({ color: accent, roughness: 1, transparent: true, opacity: 0.55 })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.012, 1.2);
    scene.add(rug);

    const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.72, 1.1), rackMat);
    table.position.set(0, 0.36, 1.2);
    scene.add(table);

    const potMat = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f6b4f, roughness: 0.9 });
    [-1, 1].forEach((side) => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 12), potMat);
      pot.position.set(side * (dims.width / 2 - 0.7), 0.25, dims.depth / 2 - 0.8);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10), leafMat);
      leaves.position.set(pot.position.x, 0.78, pot.position.z);
      scene.add(pot, leaves);
    });

    const light = new THREE.PointLight(0xffd7a8, 8, 8);
    light.position.set(0, dims.height - 0.6, 1);
    scene.add(light);

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

    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      camera.position.x = Math.sin(t * 0.18) * 0.35;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  }

  document.fonts.ready.then(build).catch(build);
} else if (host) {
  host.innerHTML = '<p style="color:#bbb;padding:24px">场景数据缺失。</p>';
}
