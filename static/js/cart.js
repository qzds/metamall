const form = document.getElementById('checkout-form');
if (form) {
  const input = document.getElementById('coupon-code'), result = document.getElementById('coupon-result');
  let controller, timer;
  function update() {
    clearTimeout(timer); controller?.abort();
    if (!input.value.trim()) { result.hidden = true; return; }
    timer = setTimeout(async () => {
      controller = new AbortController(); result.hidden = false; result.textContent = '正在核对礼遇…';
      try {
        const response = await fetch(form.dataset.couponPreview, { method: 'POST', body: new FormData(form), signal: controller.signal, credentials: 'same-origin' });
        const data = await response.json(); result.textContent = response.ok ? `已享优惠 ¥${data.discount} · 应付 ¥${data.total}（适用商品小计 ¥${data.eligible}）` : data.error;
      } catch (error) { if (error.name !== 'AbortError') result.textContent = '暂时无法核对礼遇，请重试。'; }
    }, 250);
  }
  input.addEventListener('input', update);
  document.querySelectorAll('[data-coupon]').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.coupon; update(); }));
  if (input.value) update();
  form.addEventListener('submit', () => { form.querySelector('button[type="submit"]').disabled = true; });
}
