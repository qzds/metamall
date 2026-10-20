import { createStoreScene } from './store-core.js';

const host = document.getElementById('store-canvas');
const dataEl = document.getElementById('store-scene');
if (host && dataEl) {
  const spec = JSON.parse(dataEl.textContent);
  document.fonts.ready.then(() => createStoreScene(host, spec)).catch(() => createStoreScene(host, spec));
} else if (host) {
  host.innerHTML = '<p style="color:#bbb;padding:24px">场景数据缺失。</p>';
}
