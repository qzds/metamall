import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const host = document.getElementById('mall-canvas');
const dataEl = document.getElementById('mall-data');
if (host && dataEl) {
  const stores = JSON.parse(dataEl.textContent);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x11141c);
  scene.fog = new THREE.Fog(0x11141c, 14, 32);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
  camera.position.set(0, 3.0, 7.6);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.style.display = 'block';
  host.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.45, -2.2);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance = 4;
  controls.maxDistance = 13;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x283040, 1.35));
  const key = new THREE.DirectionalLight(0xfff0dd, 2.2);
  key.position.set(4, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc7ff, 1.2);
  rim.position.set(-6, 4, 2);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 18),
    new THREE.MeshStandardMaterial({ color: 0x1b2130, roughness: 0.9 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  scene.add(floor);

  const grid = new THREE.GridHelper(24, 24, 0x39445a, 0x252c3b);
  grid.position.y = 0.01;
  scene.add(grid);

  const clickable = [];

  function makeSign(text, accent) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1d2330';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = accent;
    ctx.fillRect(22, 24, 10, 80);
    ctx.fillStyle = '#f4efe7';
    ctx.font = 'bold 40px "Microsoft YaHei", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 54, 66);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function buildStorefront(store, index) {
    const group = new THREE.Group();
    const accent = new THREE.Color(store.accent || '#B23A48');
    group.position.set((index - 1) * 4.7, 0, -2.6);
    group.scale.set(1.05, 1.05, 1.05);
    group.userData.url = store.url;

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 3.3, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x2b3242, roughness: 0.75 })
    );
    back.position.y = 1.65;
    group.add(back);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.82),
      new THREE.MeshBasicMaterial({ map: makeSign(store.name, store.accent || '#B23A48') })
    );
    sign.position.set(0, 2.72, 0.11);
    group.add(sign);

    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(0.82, 1.55),
      new THREE.MeshStandardMaterial({ color: 0x151a24, roughness: 0.4, metalness: 0.2 })
    );
    door.position.set(0, 0.8, 0.12);
    group.add(door);

    const glow = new THREE.PointLight(accent, 2.2, 4.5);
    glow.position.set(0, 1.8, 0.5);
    group.add(glow);

    for (let i = 0; i < 4; i += 1) {
      const frame = new THREE.Mesh(
        new THREE.PlaneGeometry(0.52, 0.72),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.8 })
      );
      frame.position.set(-1.25 + i * 0.84, 1.65, 0.12);
      group.add(frame);
    }

    group.children.forEach((child) => {
      child.userData.url = store.url;
      clickable.push(child);
    });
    scene.add(group);
  }

  function build() {
    stores.forEach(buildStorefront);
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
      camera.position.y = 3.0 + Math.sin(t * 0.4) * 0.06;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  }

  document.fonts.ready.then(build).catch(build);
} else if (host) {
  host.innerHTML = '<p style="color:#bbb;padding:24px">场景数据缺失。</p>';
}
