import { Vector2 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function postfx(renderer, scene, camera, host) {
  const composer = new EffectComposer(renderer);
  const render = new RenderPass(scene, camera), bloom = new UnrealBloomPass(new Vector2(640, 360), .3, .45, 1.05), output = new OutputPass();
  composer.addPass(render); composer.addPass(bloom); composer.addPass(output);
  let enabled = true;
  const resize = () => { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(host.clientWidth || 800, host.clientHeight || 600); };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  return { render() { renderer.info.autoReset = false; renderer.info.reset(); if (enabled) composer.render(); else renderer.render(scene, camera); },
    enable(value) { enabled = value; resize(); },
    dispose() { observer.disconnect(); bloom.dispose(); output.dispose(); render.dispose(); composer.dispose(); } };
}
