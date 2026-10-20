let toastTimer;
export function toast(message, error = false) {
  const el = document.getElementById('toast'); el.textContent = message; el.classList.toggle('error', error); el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3300);
}
document.querySelectorAll('.nav nav a').forEach(a => { if (new URL(a.href).pathname === location.pathname) a.setAttribute('aria-current', 'page'); });
if (document.querySelector('.messages')) setTimeout(() => document.querySelector('.messages')?.remove(), 6000);
document.addEventListener('submit', async event => {
  const form = event.target;
  if (!form.matches('.js-cart-form,.js-coupon-form')) return;
  event.preventDefault(); const button = form.querySelector('button[type="submit"]'); if (button.disabled) return; button.disabled = true;
  try {
    const response = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || '操作失败，请重试。');
    toast(data.message);
    if (data.count !== undefined) document.querySelectorAll('[data-cart-count]').forEach(el => { el.textContent = data.count; });
    if (form.matches('.js-coupon-form')) { button.textContent = '已领取 ✓'; button.dataset.claimed = 'true'; }
  } catch (error) { toast(error.message || '网络连接失败，请重试。', true); }
  finally { if (!button.dataset.claimed) button.disabled = false; }
});
