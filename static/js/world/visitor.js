import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createLook } from './garments.js';
import { disposeTree } from './resources.js';
export function createVisitor(runtime, {
  bounds = () => true,
  onEnter = () => {},
  nearest = () => null
} = {}) {
  const root = new THREE.Group();
  root.position.set(0, .075, 13);
  runtime.scene.add(root);
  let avatar = createLook({
    name: '外套',
    color: '#4F6B7D'
  }, true);
  root.add(avatar);
  let mixer,
    activeAction,
    actions = {},
    walking = false;
  const keys = new Set(),
    move = new THREE.Vector3(),
    forward = new THREE.Vector3(),
    right = new THREE.Vector3();
  const follow = new THREE.Vector3(0, 2.4, 5.2);
  new GLTFLoader().load('/static/models/RobotExpressive.glb', gltf => {
    if (runtime.disposed) {
      disposeTree(gltf.scene);
      return;
    }
    disposeTree(avatar);
    avatar = gltf.scene;
    const box = new THREE.Box3().setFromObject(avatar),
      height = box.max.y - box.min.y;
    avatar.scale.setScalar(1.85 / height);
    avatar.position.y = -box.min.y * avatar.scale.x;
    root.add(avatar);
    avatar.traverse(o => {
      if (o.isMesh) {
        o.castShadow = o.receiveShadow = true;
        o.material = o.material.clone();
        if (o.material.color) o.material.color.lerp(new THREE.Color('#76A4BF'), .58);
      }
    });
    mixer = new THREE.AnimationMixer(avatar);
    gltf.animations.forEach(c => actions[c.name] = mixer.clipAction(c));
    activeAction = actions.Idle;
    activeAction?.play();
    runtime.dirtyShadow();
  });
  function animation(name) {
    const action = actions[name];
    if (!action || action === activeAction) return;
    activeAction?.fadeOut(.2);
    action.reset().fadeIn(.2).play();
    activeAction = action;
  }
  function toggle(value) {
    walking = value;
    keys.clear();
    runtime.flight = null;
    if (value) {
      runtime.camera.position.copy(root.position).add(follow);
      runtime.controls.target.copy(root.position).add(new THREE.Vector3(0, 1.2, 0));
      runtime.controls.minDistance = 2.8;
      runtime.controls.maxDistance = 11;
    }
    document.body.classList.toggle('is-walking', value);
    document.querySelector('[data-action="walk"]')?.setAttribute('aria-pressed', String(value));
    const hud = document.querySelector('.walk-hud'),
      exit = document.querySelector('[data-action="exit-walk"]');
    if (hud) hud.hidden = !value;
    if (exit) exit.hidden = !value;
    runtime.controls.update();
  }
  runtime.listen(window, 'keydown', e => {
    if (!walking || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault();
      keys.add(k);
    }
    if (k === 'e') {
      const p = nearest(root.position);
      if (p) onEnter(p);
    }
    if (k === 'escape') {
      toggle(false);
      document.querySelector('[data-action="reset"]')?.click();
    }
  });
  runtime.listen(window, 'keyup', e => keys.delete(e.key.toLowerCase()));
  runtime.listen(window, 'blur', () => keys.clear());
  document.querySelectorAll('[data-walk-key]').forEach(button => {
    runtime.listen(button, 'pointerdown', e => {
      e.preventDefault();
      keys.add(button.dataset.walkKey);
      button.setPointerCapture(e.pointerId);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => runtime.listen(button, type, () => keys.delete(button.dataset.walkKey)));
  });
  const update = dt => {
    mixer?.update(dt);
    if (!walking) return;
    runtime.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
    move.set(0, 0, 0);
    if (keys.has('w') || keys.has('arrowup')) move.add(forward);
    if (keys.has('s') || keys.has('arrowdown')) move.sub(forward);
    if (keys.has('a') || keys.has('arrowleft')) move.sub(right);
    if (keys.has('d') || keys.has('arrowright')) move.add(right);
    if (move.lengthSq()) {
      move.normalize().multiplyScalar((keys.has('shift') ? 7.5 : 3.8) * dt);
      const next = root.position.clone().add(move);
      if (bounds(next)) {
        root.position.copy(next);
        runtime.camera.position.add(move);
        runtime.controls.target.add(move);
      }
      const a = Math.atan2(move.x, move.z),
        diff = Math.atan2(Math.sin(a - root.rotation.y), Math.cos(a - root.rotation.y));
      root.rotation.y += diff * Math.min(1, dt * 10);
      animation('Walking');
      if (runtime.frame % 4 === 0) runtime.dirtyShadow();
    } else animation('Idle');
    const p = nearest(root.position),
      button = document.getElementById('walk-enter');
    if (button) {
      button.hidden = !p;
      if (p) button.textContent = `E · 进入${p.store.name} ↗`;
    }
  };
  runtime.updates.add(update);
  runtime.cleanups.push(() => {
    mixer?.stopAllAction();
    if (mixer) mixer.uncacheRoot(avatar);
  });
  return {
    root,
    toggle,
    get walking() {
      return walking;
    }
  };
}
