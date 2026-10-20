import { createDistrict } from './world/district.js';
const host = document.getElementById('mall-canvas');
if (host) {
  try { createDistrict(host, JSON.parse(document.getElementById('mall-data').textContent)); }
  catch (error) { console.error(error); document.body.classList.add('scene-ready'); const p = document.createElement('p'); p.className = 'scene-error'; p.textContent = '三维世界暂未加载，请刷新页面'; host.appendChild(p); }
}
