import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { postfx } from '../postfx.js';
import { disposeTree } from './resources.js';
import { part, block, mat, glow, noise, roundRect } from './art.js';

/** One owner for rendering, camera, resize, quality, animation and teardown. */
export class WorldRuntime {
  constructor(host, {
    showroom = false
  } = {}) {
    this.host = host;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#050B16');
    this.scene.fog = new THREE.FogExp2('#07101E', .007);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    host.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(showroom ? 43 : 47, 1, .1, 220);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .065;
    this.controls.minDistance = 3;
    this.controls.maxDistance = showroom ? 40 : 95;
    this.controls.minPolarAngle = .18;
    this.controls.maxPolarAngle = Math.PI / 2 - .025;
    this.effects = postfx(this.renderer, this.scene, this.camera, host);
    this.updates = new Set();
    this.cleanups = [];
    this.reflectors = [];
    this.low = false;
    this.disposed = false;
    this.env = this.environment();
    this.atmosphere(showroom);
    const resize = () => {
      const w = host.clientWidth || 800,
        h = host.clientHeight || 600;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    this.observer = new ResizeObserver(resize);
    this.observer.observe(host);
    resize();
    this.timer = new THREE.Timer();
    this.frame = 0;
    this.animate = t => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(this.animate);
      this.timer.update(t);
      const dt = Math.min(this.timer.getDelta(), .05),
        elapsed = this.timer.getElapsed();
      this.updates.forEach(fn => fn(dt, elapsed));
      this.controls.update();
      this.effects.render();
      this.frame++;
    };
    this.onHide = e => {
      if (!e.persisted) this.dispose();
    };
    window.addEventListener('pagehide', this.onHide);
    this.onShow = e => {
      if (e.persisted) this.resize();
    };
    window.addEventListener('pageshow', this.onShow);
    this.raf = requestAnimationFrame(this.animate);
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  environment() {
    const room = new THREE.Scene();
    room.background = new THREE.Color('#1A2333');
    block(room, [18, 1, 9], glow('#D6E8FF', 2), [0, 9, 0]);
    block(room, [1, 8, 12], glow('#DFC29A', 1.3), [-9, 3, 0]);
    block(room, [1, 8, 12], glow('#719DCD', 1.2), [9, 3, 0]);
    const p = new THREE.PMREMGenerator(this.renderer),
      env = p.fromScene(room, .04, .1, 40, {
        size: 128
      });
    this.scene.environment = env.texture;
    this.scene.environmentIntensity = .8;
    p.dispose();
    disposeTree(room);
    return env;
  }
  atmosphere(showroom) {
    const {
      scene
    } = this;
    scene.add(new THREE.HemisphereLight('#BBCDEF', '#151421', .85));
    const sun = new THREE.DirectionalLight('#F9E5CC', 3.2);
    sun.position.set(-13, 22, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.normalBias = .035;
    sun.shadow.bias = -.0001;
    this.keyLight = sun;
    Object.assign(sun.shadow.camera, {
      left: -38,
      right: 38,
      top: 32,
      bottom: -32,
      near: .5,
      far: 85
    });
    scene.add(sun);
    const blue = new THREE.DirectionalLight('#599BD9', 1.6);
    blue.position.set(12, 10, -16);
    scene.add(blue);
    this.fillLight = blue;
    const rand = noise(20261020),
      positions = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) {
      const a = rand() * Math.PI * 2,
        r = 85 + rand() * 35;
      positions.set([Math.cos(a) * r, 12 + rand() * 65, Math.sin(a) * r], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: '#A3CBE6',
      size: .10,
      transparent: true,
      opacity: .75,
      depthWrite: false
    })));
    if (!showroom) {
      const skyline = document.createElement('canvas');
      skyline.width = 64;
      skyline.height = 256;
      const cx = skyline.getContext('2d');
      cx.fillStyle = '#0A1423';
      cx.fillRect(0, 0, 64, 256);
      for (let y = 3; y < 256; y += 8) for (let x = 3; x < 64; x += 10) if (rand() > .52) {
        cx.fillStyle = rand() > .8 ? '#557C9D' : '#223E5E';
        cx.fillRect(x, y, 2, 4);
      }
      const facade = new THREE.CanvasTexture(skyline);
      facade.colorSpace = THREE.SRGBColorSpace;
      const city = new THREE.Group();
      scene.add(city);
      const geom = new THREE.BoxGeometry(1, 1, 1),
        m = mat('#3B4C67', {
          map: facade,
          emissiveMap: facade,
          emissive: '#6D96BB',
          emissiveIntensity: .45,
          roughness: .6
        }),
        buildings = new THREE.InstancedMesh(geom, m, 90),
        dummy = new THREE.Object3D();
      for (let i = 0; i < 90; i++) {
        const a = i / 90 * Math.PI * 2,
          r = 65 + rand() * 28,
          h = 4 + rand() * 27;
        dummy.position.set(Math.cos(a) * r, -7 + h / 2, Math.sin(a) * r - 20);
        dummy.scale.set(2 + rand() * 5, h, 2 + rand() * 4);
        dummy.updateMatrix();
        buildings.setMatrixAt(i, dummy.matrix);
      }
      city.add(buildings);
      const moon = part(scene, new THREE.SphereGeometry(9, 40, 24), mat('#69829D', {
        roughness: .9
      }), [-60, 30, -110]);
      const orbit = part(scene, new THREE.TorusGeometry(14, .035, 6, 144), glow('#8AAFC8', 1), moon.position.toArray(), [.7, .2, .3]);
      orbit.scale.y = .45;
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(155, 32, 20), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec3 p;void main(){vec3 n=normalize(p);float band=exp(-pow((n.y-.12)*5.,2.));float a=sin(n.x*3.+n.z*2.)*.5+.5;vec3 col=mix(vec3(.012,.022,.044),mix(vec3(.025,.09,.13),vec3(.075,.035,.115),a),band*.65);gl_FragColor=vec4(col,1.);\n#include <colorspace_fragment>\n}'
    }));
    scene.add(dome);
  }
  reflectFloor(root, w, d, y = .018, z = 0) {
    const size = w > 30 ? 1024 : 768;
    const floor = new Reflector(new THREE.ShapeGeometry(roundRect(w, d, .7)), {
      textureWidth: size,
      textureHeight: size,
      color: '#384452',
      multisample: 0
    });
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, y, z);
    root.add(floor);
    this.reflectors.push(floor);
    // Reuse a stationary camera's planar reflection for 100 ms. Camera motion
    // updates it immediately; the animated landmark remains smooth in the main view.
    if (w > 30) {
      const renderReflection = floor.onBeforeRender,
        lastPosition = new THREE.Vector3(Infinity, 0, 0),
        lastRotation = new THREE.Quaternion();
      let lastUpdate = -Infinity;
      floor.onBeforeRender = (...args) => {
        const camera = args[2],
          now = performance.now(),
          moving = lastPosition.distanceToSquared(camera.position) > .000001 || lastRotation.angleTo(camera.quaternion) > .0001;
        if (moving || now - lastUpdate >= 100) {
          renderReflection.apply(floor, args);
          lastUpdate = now;
          lastPosition.copy(camera.position);
          lastRotation.copy(camera.quaternion);
        }
      };
    }
    return floor;
  }
  dirtyShadow() {
    this.renderer.shadowMap.needsUpdate = true;
  }
  mood(value) {
    this.keyLight.color.set(value === 'warm' ? '#FFE0B0' : value === 'daylight' ? '#E9FFE0' : '#CBE8FF');
    this.fillLight.color.set(value === 'warm' ? '#789FC8' : value === 'daylight' ? '#6EA694' : '#758BD1');
    this.dirtyShadow();
  }
  quality() {
    this.low = !this.low;
    this.renderer.setPixelRatio(this.low ? .85 : Math.min(devicePixelRatio || 1, 1.25));
    this.renderer.shadowMap.enabled = !this.low;
    this.reflectors = this.reflectors.filter(r => r.parent);
    this.reflectors.forEach(r => r.visible = !this.low);
    this.effects.enable(!this.low);
    this.dirtyShadow();
    return this.low;
  }
  listen(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.cleanups.push(() => target.removeEventListener(type, fn, opts));
  }
  moveTo(position, target) {
    this.flight = {
      position: position.clone(),
      target: target.clone()
    };
    if (this.fly) return;
    this.fly = dt => {
      if (!this.flight) return;
      const k = 1 - Math.exp(-dt * 3.4);
      this.camera.position.lerp(this.flight.position, k);
      this.controls.target.lerp(this.flight.target, k);
      if (this.camera.position.distanceTo(this.flight.position) < .008) this.flight = null;
    };
    this.updates.add(this.fly);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    window.removeEventListener('pagehide', this.onHide);
    window.removeEventListener('pageshow', this.onShow);
    this.cleanups.forEach(fn => fn());
    this.controls.dispose();
    this.timer.dispose();
    this.effects.dispose();
    disposeTree(this.scene);
    this.env.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
