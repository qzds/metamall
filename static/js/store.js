import { createStoreScene } from './store-core.js';
import { THEMES } from './scene-kit.js';

const host = document.getElementById('store-canvas');
if (host) {
  const spec = JSON.parse(document.getElementById('store-scene').textContent);
  try {
    const inspector = document.getElementById('product-inspector');
    const api = createStoreScene(host, spec, { onSelect(product) {
      inspector.hidden = false;
      document.getElementById('selected-name').textContent = product.name;
      document.getElementById('selected-description').textContent = product.description || '探索品牌精选系列，在虚拟空间中发现你的下一件日常。';
      document.getElementById('selected-price').textContent = `¥${Number(product.price).toFixed(2)}`;
      document.getElementById('selected-stock').textContent = `库存 ${product.stock} 件`;
      document.getElementById('selected-sizes').textContent = product.sizes?.length ? `在售尺码 · ${product.sizes.join(' / ')}` : '均码 / 商品信息见品牌说明';
      const image = document.getElementById('selected-image'); image.hidden = !product.image; if (product.image) image.src = product.image; else image.removeAttribute('src'); image.alt = product.name;
      const form = document.getElementById('selected-cart-form'); form.action = `/cart/add/${product.id}/`; form.querySelector('button').disabled = product.stock <= 0;
      document.getElementById('spin-model').textContent = '↻ 旋转立体陈列';
    } });
    window.__METAMALL__ = api;
    document.getElementById('style-label').textContent = `${THEMES[spec.style]?.title || '品牌展馆'} / ${spec.dimensions.width} × ${spec.dimensions.depth} m`;
    document.querySelectorAll('[data-product-id]').forEach(button => button.addEventListener('click', () => api.focusProduct(button.dataset.productId)));
    document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click', () => { api.view(button.dataset.camera); inspector.hidden = true; }));
    document.querySelector('.inspector-close').addEventListener('click', () => { inspector.hidden = true; });
    document.getElementById('spin-model').addEventListener('click', event => { event.currentTarget.textContent = api.spin() ? 'Ⅱ 暂停旋转' : '↻ 旋转立体陈列'; });
    document.querySelector('[data-action="store-reset"]').addEventListener('click', () => { api.reset(); inspector.hidden = true; });
    document.querySelector('[data-action="store-quality"]').addEventListener('click', event => { event.currentTarget.textContent = api.quality() ? '画质 · 流畅' : '画质 · 高清'; });
    document.querySelector('[data-action="fullscreen"]').addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
    requestAnimationFrame(() => document.body.classList.add('scene-ready'));
  } catch (error) { console.error(error); const note = document.createElement('p'); note.className = 'scene-error'; note.textContent = '三维场景暂未加载，请刷新页面或检查 WebGL 支持。'; host.appendChild(note); document.body.classList.add('scene-ready'); }
}
