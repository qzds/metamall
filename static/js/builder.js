import { createStoreScene } from './store-core.js';

const host = document.getElementById('builder-canvas');
const dataEl = document.getElementById('builder-data');
if (host && dataEl) {
  const stores = JSON.parse(dataEl.textContent);
  const form = host.closest('.builder-layout')?.querySelector('form');
  const nameInput = document.getElementById('id_name');
  const taglineInput = document.getElementById('id_tagline');
  const templateInput = document.getElementById('id_template');
  const accentInput = document.getElementById('id_accent');
  const sourceInput = document.getElementById('id_source_store');

  const FALLBACK = [
    { name: '立领亚麻衬衫', color: '#C98E86', image: '' },
    { name: '廓形风衣', color: '#8C5A4A', image: '' },
    { name: '高腰阔腿裤', color: '#2B2B2B', image: '' },
    { name: '真丝方领连衣裙', color: '#B23A48', image: '' },
  ];

  function firstStore() {
    return Object.values(stores)[0] || null;
  }

  function currentSpec() {
    const template = templateInput?.value || 'boutique';
    const accent = accentInput?.value || '#B23A48';
    const source = stores[sourceInput?.value] || firstStore();
    const products = source?.products?.length ? source.products : FALLBACK;
    const minimal = template === 'minimal';
    return {
      version: 1,
      store: {
        name: (nameInput?.value || '新店预览').trim() || '新店预览',
        tagline: (taglineInput?.value || '你的品牌标语').trim() || '你的品牌标语',
        slug: 'preview',
        factory: source?.name || '',
      },
      template,
      dimensions: minimal ? { width: 10, depth: 8, height: 3.6 } : { width: 12, depth: 10, height: 4 },
      palette: {
        wall: minimal ? '#ECECEC' : '#F3EEE7',
        floor: minimal ? '#C9C4BA' : '#B9A48C',
        accent,
        sign: minimal ? '#1A1A1A' : '#1F2937',
      },
      lighting: minimal ? 'cool' : 'warm',
      products: products.map((product, index) => ({
        id: index + 1,
        name: product.name,
        image: product.image || '',
        color: product.color || accent,
      })),
    };
  }

  document.fonts.ready.then(() => {
    const preview = createStoreScene(host, currentSpec(), { pixelRatio: 1.2 });
    let timer = null;
    const update = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => preview.refresh(currentSpec()), 160);
    };
    [nameInput, taglineInput, accentInput, templateInput, sourceInput].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', update);
      el.addEventListener('change', update);
    });
  }).catch(() => {
    host.innerHTML = '<p style="color:#bbb;padding:24px">预览初始化失败。</p>';
  });
} else if (host) {
  host.innerHTML = '<p style="color:#bbb;padding:24px">预览数据缺失。</p>';
}
