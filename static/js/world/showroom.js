import * as THREE from 'three';
import { WorldRuntime } from './runtime.js';
import { buildPavilion } from './architecture.js';
import { mat, part, block, torus, glow, sign } from './art.js';
import { disposeTree } from './resources.js';
export function createShowroom(host, initial, options = {}) {
  const runtime = new WorldRuntime(host, {
      showroom: true
    }),
    {
      scene,
      renderer,
      camera,
      controls
    } = runtime;
  let spec = initial,
    pavilion,
    reflection,
    selected,
    spinning = false,
    pointerStart = null;
  const home = new THREE.Vector3(),
    homeTarget = new THREE.Vector3(),
    raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  const backdrop = new THREE.Group();
  scene.add(backdrop);
  block(backdrop, [75, .3, 65], mat('#08111F', {
    roughness: .4,
    metalness: .3
  }), [0, -.62, 0]);
  for (let i = 0; i < 7; i++) torus(backdrop, 14 + i * 2.3, .009, glow('#233B53', 1), [0, -.43, 0]);
  function build(next) {
    if (pavilion) disposeTree(pavilion.root);
    if (reflection) {
      runtime.reflectors = runtime.reflectors.filter(r => r !== reflection);
      disposeTree(reflection);
    }
    spec = next;
    pavilion = buildPavilion(spec);
    scene.add(pavilion.root);
    selected = null;
    spinning = false;
    reflection = runtime.reflectFloor(scene, pavilion.width + .5, pavilion.depth + .5, .028);
    reflection.visible = !runtime.low;
    // Transparent tinted coating keeps reflections subordinate to the clothes.
    const coat = part(pavilion.root, new THREE.PlaneGeometry(pavilion.width + .45, pavilion.depth + .45), mat('#1B2938', {
      transparent: true,
      opacity: .28,
      roughness: .24,
      metalness: .6,
      depthWrite: false
    }), [0, .032, 0], [-Math.PI / 2, 0, 0]);
    coat.castShadow = false;
    runtime.mood(spec.lighting);
    home.set(pavilion.width * .25, 3.4, pavilion.depth * 1.15);
    homeTarget.set(0, 1.9, -.6);
    camera.position.copy(home);
    controls.target.copy(homeTarget);
    controls.update();
    runtime.dirtyShadow();
  }
  const key = s => JSON.stringify([s.style, s.template, s.layout, s.dimensions, s.palette.wall, s.palette.floor, s.lighting, s.seed, s.products]);
  function refresh(next) {
    if (runtime.disposed) return;
    if (key(next) !== key(spec)) build(next);else {
      spec = next;
      pavilion.branding(spec);
      runtime.dirtyShadow();
    }
  }
  function hit(event) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - r.left) / r.width * 2 - 1, -(event.clientY - r.top) / r.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    let node = raycaster.intersectObjects(pavilion.items.map(i => i.group), true)[0]?.object;
    while (node && !node.userData.product) node = node.parent;
    return pavilion.items.find(p => p.group === node);
  }
  function focusProduct(id) {
    const p = pavilion.items.find(p => p.product.id === Number(id));
    if (!p) return;
    selected = p;
    spinning = false;
    pavilion.items.forEach(i => i.halo.scale.setScalar(i === p ? 1.12 : 1));
    runtime.moveTo(p.group.position.clone().add(new THREE.Vector3(2.3, 2.4, 5.0)), p.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
    options.onSelect?.(p.product);
  }
  runtime.listen(renderer.domElement, 'pointerdown', e => {
    pointerStart = [e.clientX, e.clientY];
    runtime.flight = null;
  });
  runtime.listen(renderer.domElement, 'pointermove', e => {
    const hovered = hit(e);
    renderer.domElement.style.cursor = hovered && options.interactive !== false ? 'pointer' : 'grab';
    pavilion.items.forEach(p => {
      if (p !== selected) p.halo.scale.setScalar(p === hovered ? 1.12 : 1);
    });
  });
  runtime.listen(renderer.domElement, 'pointerup', e => {
    const start = pointerStart;
    pointerStart = null;
    if (!start || options.interactive === false || Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 6) return;
    const item = hit(e);
    if (item) focusProduct(item.product.id);
  });
  runtime.updates.add(dt => {
    if (selected && spinning) {
      selected.model.rotation.y += dt * .6;
      if (runtime.frame % 6 === 0) runtime.dirtyShadow();
    }
  });
  build(initial);
  const api = {
    renderer,
    scene,
    camera,
    runtime,
    refresh,
    focusProduct,
    get spec() {
      return spec;
    },
    get products() {
      return pavilion.items;
    },
    reset() {
      runtime.moveTo(home, homeTarget);
    },
    spin() {
      if (selected) spinning = !spinning;
      return spinning;
    },
    quality() {
      return runtime.quality();
    },
    view(name) {
      if (name === 'entry') runtime.moveTo(new THREE.Vector3(0, 1.85, pavilion.depth / 2 + 1.5), new THREE.Vector3(0, 1.8, -pavilion.depth / 2));else if (name === 'collection') runtime.moveTo(new THREE.Vector3(.5, 2.8, pavilion.depth * .5), new THREE.Vector3(0, 1.25, -pavilion.depth * .2));else api.reset();
    },
    dispose() {
      runtime.dispose();
    }
  };
  if (sessionStorage.getItem('world:arrival') === spec.store.slug) {
    sessionStorage.removeItem('world:arrival');
    camera.position.set(0, 1.9, pavilion.depth / 2 + 6);
    controls.target.set(0, 1.8, -pavilion.depth / 2);
    runtime.moveTo(home, homeTarget);
  }
  return api;
}
