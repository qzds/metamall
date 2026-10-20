import * as THREE from 'three';
import { WorldRuntime } from './runtime.js';
import { buildAtrium, buildPavilion } from './architecture.js';
import { createVisitor } from './visitor.js';
import { part, glow, mat, torus, sign, block, batchStatic, texture } from './art.js';
import { createLook } from './garments.js';
export function createDistrict(host, stores) {
  const runtime = new WorldRuntime(host),
    {
      renderer,
      scene,
      camera,
      controls
    } = runtime;
  const world = buildAtrium(scene),
    pavilions = [],
    pins = [],
    hits = [];
  const home = new THREE.Vector3(18, 10.8, 32),
    target = new THREE.Vector3(0, 3.2, -8);
  camera.position.copy(home);
  controls.target.copy(target);
  controls.minDistance = 7;
  controls.update();
  const mirror = runtime.reflectFloor(scene, 56, 44, .005, -7);
  const coat = part(scene, new THREE.PlaneGeometry(56, 44), mat('#485569', {
    map: texture('tile'),
    transparent: true,
    opacity: .68,
    metalness: .35,
    roughness: .42,
    depthWrite: false
  }), [0, .009, -7], [-Math.PI / 2, 0, 0]);
  coat.castShadow = false;
  stores.forEach((store, index) => {
    const spec = store.scene,
      p = buildPavilion(spec, {
        compact: true
      }),
      g = p.root;
    const positions = [[-15, .08, -8], [0, .08, -13], [15, .08, -8]];
    const pos = positions[index] || [[15, -15, 0][(index - 3) % 3], 7.2 + Math.floor((index - 3) / 3) * 7, -24];
    g.position.set(...pos);
    g.rotation.y = index === 0 ? .10 : index === 2 ? -.10 : 0;
    scene.add(g);
    p.store = store;
    p.group = g;
    pavilions.push(p);
    const hit = part(g, new THREE.BoxGeometry(p.width + .5, p.height, p.depth + .6), new THREE.MeshBasicMaterial({
      visible: false
    }), [0, p.height / 2, 0]);
    hit.userData.pavilion = p;
    hits.push(hit);
    const pin = document.createElement('a');
    pin.href = store.url;
    pin.className = 'world-pin';
    pin.style.setProperty('--brand-color', store.accent);
    const n = document.createElement('span');
    n.textContent = String(index + 1).padStart(2, '0');
    const title = document.createElement('strong');
    title.textContent = store.name;
    const arrow = document.createElement('span');
    arrow.textContent = '↗';
    pin.append(n, title, arrow);
    document.getElementById('world-labels').appendChild(pin);
    pins.push({
      pin,
      g,
      point: new THREE.Vector3(0, p.height + .65, 0)
    });
    runtime.listen(pin, 'click', e => {
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        enter(p);
      }
    });
    if (index >= 3) {
      const deck = new THREE.Group();
      scene.add(deck);
      block(deck, [p.width + 1, .4, p.depth + 1], mat('#1A2A3E'), [pos[0], pos[1] - .24, pos[2]]);
      [-1, 1].forEach(s => block(deck, [.11, pos[1], .12], mat('#485A6A', {
        metalness: .7
      }), [pos[0] + s * (p.width / 2 + .3), pos[1] / 2, pos[2] + p.depth / 2]));
      sign(deck, 'SKY GALLERY', '新增展馆 · 通过目的地传送', {
        width: 4,
        position: [pos[0], pos[1] - .7, pos[2] + p.depth / 2 + .6]
      });
      batchStatic(deck);
    }
  });
  const loom = new THREE.Group();
  loom.position.set(0, 8.8, -13);
  scene.add(loom);
  const silver = mat('#91A8C2', {
      metalness: .95,
      roughness: .15
    }),
    ice = glow('#A1D6E5', 3);
  part(loom, new THREE.TorusKnotGeometry(1.55, .26, 180, 16, 2, 3), silver);
  torus(loom, 2.1, .025, ice, [0, 0, 0], [.4, .2, 0]);
  torus(loom, 2.22, .014, ice, [0, 0, 0], [-.4, .7, .7]);
  runtime.updates.add((dt, t) => {
    loom.rotation.y += dt * .16;
    loom.position.y = 8.8 + Math.sin(t * .4) * .12;
  });
  [[-7, 7], [7, 4], [-21, -1]].forEach(([x, z], i) => {
    const npc = createLook({
      name: i ? '风衣' : '连衣裙',
      color: ['#8C9CA6', '#7C6673', '#7C8D80'][i]
    }, true);
    npc.position.set(x, .08, z);
    npc.rotation.y = i ? .5 : -.7;
    scene.add(npc);
  });
  let tour = false,
    tourTime = 0,
    travelling = false,
    pointerStart = null;
  function stopTour() {
    tour = false;
    document.body.classList.remove('is-touring');
    const b = document.querySelector('[data-action="tour"]');
    if (b) b.textContent = '影院导览';
  }
  const point = new THREE.Vector3(),
    raycaster = new THREE.Raycaster(),
    mouse = new THREE.Vector2();
  function nearest(position) {
    return pavilions.find(p => {
      const entrance = p.group.position.clone().add(new THREE.Vector3(0, 0, p.depth / 2 + 1));
      return Math.hypot(position.x - entrance.x, position.z - entrance.z) < 4;
    });
  }
  const visitor = createVisitor(runtime, {
    nearest,
    onEnter: enter,
    bounds: p => {
      if (p.x < -27 || p.x > 27 || p.z > 15 || p.z < -27) return false;
      // Keep avatars out of solid walls and display plinths; entrances remain reachable.
      return !pavilions.some(s => Math.abs(p.x - s.group.position.x) < s.width / 2 + .2 && p.z < s.group.position.z + s.depth / 2 - .4 && p.z > s.group.position.z - s.depth / 2 - .3);
    }
  });
  function reset() {
    visitor.toggle(false);
    stopTour();
    controls.maxDistance = 95;
    controls.minDistance = 7;
    runtime.moveTo(home, target);
  }
  function enter(p) {
    if (travelling) return;
    travelling = true;
    stopTour();
    sessionStorage.setItem('world:arrival', p.store.slug);
    document.body.classList.add('is-travelling');
    const status = document.getElementById('travel-destination');
    if (status) status.textContent = p.store.name;
    const front = p.group.position.clone().add(new THREE.Vector3(0, 2.2, p.depth / 2 + 2));
    runtime.moveTo(front, p.group.position.clone().add(new THREE.Vector3(0, 1.8, -1)));
    const id = setTimeout(() => location.assign(p.store.url), 850);
    runtime.cleanups.push(() => clearTimeout(id));
  }
  function hit(e) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(hits)[0]?.object?.userData.pavilion;
  }
  runtime.listen(renderer.domElement, 'pointerdown', e => {
    pointerStart = [e.clientX, e.clientY];
    stopTour();
    runtime.flight = null;
  });
  runtime.listen(renderer.domElement, 'pointermove', e => {
    const p = hit(e);
    renderer.domElement.style.cursor = p ? 'pointer' : 'grab';
    pins.forEach(({
      pin
    }, i) => pin.classList.toggle('is-hovered', pavilions[i] === p));
  });
  runtime.listen(renderer.domElement, 'pointerup', e => {
    const start = pointerStart;
    pointerStart = null;
    if (!start || Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 6) return;
    const p = hit(e);
    if (p) enter(p);
  });
  runtime.listen(document.querySelector('[data-action="walk"]'), 'click', () => {
    stopTour();
    if (visitor.walking) reset();else visitor.toggle(true);
  });
  runtime.listen(document.querySelector('[data-action="exit-walk"]'), 'click', reset);
  runtime.listen(document.querySelector('[data-action="reset"]'), 'click', reset);
  runtime.listen(document.getElementById('walk-enter'), 'click', () => {
    const p = nearest(visitor.root.position);
    if (p) enter(p);
  });
  runtime.listen(document.querySelector('[data-action="quality"]'), 'click', e => {
    e.currentTarget.textContent = runtime.quality() ? '画质 · 流畅' : '画质 · 高清';
  });
  runtime.listen(document.querySelector('[data-action="fullscreen"]'), 'click', () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
  const tourButton = document.querySelector('[data-action="tour"]');
  runtime.listen(tourButton, 'click', () => {
    visitor.toggle(false);
    tour = !tour;
    tourTime = 0;
    tourButton.textContent = tour ? '暂停影院导览 Ⅱ' : '影院导览';
    document.body.classList.toggle('is-touring', tour);
  });
  runtime.listen(window, 'pageshow', e => {
    if (e.persisted) {
      travelling = false;
      document.body.classList.remove('is-travelling');
      reset();
    }
  });
  document.querySelectorAll('.destination').forEach(link => runtime.listen(link, 'click', e => {
    const p = pavilions.find(p => p.store.url === link.getAttribute('href'));
    if (p && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      enter(p);
    }
  }));
  runtime.updates.add((dt, t) => {
    if (tour) {
      tourTime += dt;
      const i = Math.floor(tourTime / 7) % Math.min(3, pavilions.length),
        p = pavilions[i];
      const desired = p.group.position.clone().add(new THREE.Vector3(Math.sin(tourTime * .18) * 3, 2.9, p.depth / 2 + 10));
      camera.position.lerp(desired, 1 - Math.exp(-dt * .65));
      controls.target.lerp(p.group.position.clone().add(new THREE.Vector3(0, 2, 0)), 1 - Math.exp(-dt * .9));
      const caption = document.getElementById('tour-caption');
      if (caption) caption.textContent = `0${i + 1} / ${p.store.name} · ${['织光庭院', '零度艺廊', '森屿温室'][i]}`;
    }
    pins.forEach(({
      pin,
      g,
      point: p
    }) => {
      g.localToWorld(point.copy(p));
      point.project(camera);
      pin.hidden = point.z < -1 || point.z > 1 || Math.abs(point.x) > .97 || Math.abs(point.y) > .94;
      if (!pin.hidden) pin.style.transform = `translate(${(point.x + 1) * host.clientWidth / 2}px,${(1 - point.y) * host.clientHeight / 2}px) translate(-50%,-50%)`;
    });
  });
  runtime.cleanups.push(() => pins.forEach(({
    pin
  }) => pin.remove()));
  runtime.dirtyShadow();
  const api = {
    renderer,
    scene,
    camera,
    runtime,
    stores,
    pavilions,
    player: visitor.root,
    get walking() {
      return visitor.walking;
    },
    reset,
    dispose: () => runtime.dispose()
  };
  window.__METAMALL__ = api;
  requestAnimationFrame(() => document.body.classList.add('scene-ready'));
  return api;
}
