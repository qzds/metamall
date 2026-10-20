import { createStoreScene } from './store-core.js';
import { THEMES } from './scene-kit.js';
const host = document.getElementById('builder-canvas');
if (host) {
  const form = document.getElementById('builder-form'), status = document.getElementById('preview-status');
  const initial = JSON.parse(document.getElementById('builder-data').textContent);
  let preview, timer, controller, sequence = 0, step = 0, publishing = false;
  try { if (initial) preview = createStoreScene(host, initial, { pixelRatio: 1.2, interactive: false }); window.__METAMALL__ = preview; }
  catch (error) { console.error(error); status.textContent = '预览加载失败，请刷新'; status.dataset.state = 'error'; }
  function summary(spec) {
    document.getElementById('preview-style').textContent = THEMES[spec.style]?.english || 'YOUR NEW WORLD';
    document.getElementById('preview-name').textContent = spec.store.name;
    document.getElementById('publish-name').textContent = spec.store.name;
    document.getElementById('publish-summary').textContent = `${THEMES[spec.style]?.title} · ${spec.dimensions.width} × ${spec.dimensions.depth} m · ${spec.products.length} 件商品`;
    document.getElementById('preview-dimensions').textContent = `${spec.dimensions.width} × ${spec.dimensions.depth} m / ${spec.products.length} 件陈列 / ${spec.lighting === 'warm' ? '日落暖光' : spec.lighting === 'cool' ? '极光冷光' : '自然天光'}`;
  }
  if (initial) summary(initial);
  async function update() {
    clearTimeout(timer); controller?.abort(); const current = ++sequence;
    status.textContent = '正在生成…'; status.dataset.state = 'pending';
    timer = setTimeout(async () => {
      controller = new AbortController();
      try {
        const response = await fetch(form.dataset.previewUrl, { method: 'POST', body: new FormData(form), signal: controller.signal, credentials: 'same-origin' });
        const spec = await response.json(); if (current !== sequence) return;
        if (!response.ok) { const message = Object.values(spec.errors || {}).flat().join(' '); throw new Error(message || '请检查配置'); }
        if (preview) preview.refresh(spec); else { preview = createStoreScene(host, spec, { pixelRatio: 1.2, interactive: false }); window.__METAMALL__ = preview; }
        summary(spec); status.textContent = '已同步'; status.dataset.state = 'ready';
      } catch (error) { if (error.name !== 'AbortError' && current === sequence) { status.textContent = error.message; status.dataset.state = 'error'; } }
    }, 220);
  }
  form.addEventListener('input', update); form.addEventListener('change', update);
  const picker = document.getElementById('accent-picker'), accent = document.getElementById('id_accent'); picker.value = accent.value;
  picker.addEventListener('input', () => { accent.value = picker.value.toUpperCase(); update(); });
  accent.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(accent.value)) picker.value = accent.value; });
  function go(value) {
    step = Math.max(0, Math.min(2, value));
    document.querySelectorAll('[data-panel]').forEach(el => { el.hidden = Number(el.dataset.panel) !== step; });
    document.querySelectorAll('[data-step]').forEach(el => { el.setAttribute('aria-selected', String(Number(el.dataset.step) === step)); });
    document.getElementById('previous-step').hidden = step === 0;
    document.getElementById('next-step').hidden = step === 2;
    document.getElementById('next-step').textContent = step === 0 ? '继续：空间设计 →' : '继续：商品与发布 →';
  }
  document.querySelectorAll('[data-step]').forEach(el => el.addEventListener('click', () => go(Number(el.dataset.step))));
  document.getElementById('previous-step').addEventListener('click', () => go(step - 1));
  document.getElementById('next-step').addEventListener('click', () => go(step + 1));
  const presets = { atelier: { template: 'boutique', style: 'atelier', layout: 'gallery', width: 12, depth: 10, lighting: 'warm', accent: '#ED9276' }, gallery: { template: 'minimal', style: 'gallery', layout: 'runway', width: 10, depth: 8, lighting: 'cool', accent: '#8EDFF5' }, garden: { template: 'boutique', style: 'garden', layout: 'island', width: 14, depth: 10, lighting: 'daylight', accent: '#A6D895' } };
  function preset(name) { for (const [key, value] of Object.entries(presets[name])) document.getElementById(`id_${key}`).value = value; picker.value = accent.value; update(); }
  document.querySelectorAll('[data-preset]').forEach(el => el.addEventListener('click', () => preset(el.dataset.preset)));
  document.getElementById('id_template').addEventListener('change', event => preset(event.target.value === 'minimal' ? 'gallery' : 'atelier'));
  document.querySelector('[data-action="builder-reset"]').addEventListener('click', () => preview?.reset());
  document.querySelector('[data-action="builder-quality"]').addEventListener('click', event => { if (preview) event.currentTarget.textContent = preview.quality() ? '画质 · 流畅' : '画质 · 高清'; });
  form.addEventListener('submit', event => {
    if (publishing) { event.preventDefault(); return; }
    const invalid = form.querySelector(':invalid');
    if (invalid) { event.preventDefault(); go(Number(invalid.closest('[data-panel]').dataset.panel)); invalid.reportValidity(); return; }
    publishing = true; form.querySelector('.publish-button').textContent = '正在发布…';
  });
  const errorPanel = form.querySelector('.errorlist')?.closest('[data-panel]'); if (errorPanel) go(Number(errorPanel.dataset.panel));
}
