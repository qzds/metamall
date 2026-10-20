import uuid
from decimal import Decimal

from django.contrib import messages
from django.db import IntegrityError, transaction
from django.db.models import F
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST

from mall.models import Product
from .models import Coupon, Order, OrderItem
from .services import cancel_order


def _cart(request):
    return request.session.setdefault('cart', {})


def _cart_rows(request):
    cart = _cart(request)
    products = Product.objects.filter(id__in=[int(k) for k in cart], is_active=True, store__is_published=True).select_related('store')
    rows = []
    subtotal = Decimal('0.00')
    for product in products:
        qty = int(cart.get(str(product.id), 0))
        if qty <= 0:
            continue
        total = product.price * qty
        subtotal += total
        rows.append({'product': product, 'qty': qty, 'line_total': total})
    return rows, subtotal


def _next(request, fallback):
    value = request.POST.get('next', '')
    return value if value and url_has_allowed_host_and_scheme(value, {request.get_host()}, require_https=request.is_secure()) else fallback


def _json(request):
    return 'application/json' in request.headers.get('Accept', '')


def _coupon(code, rows, subtotal):
    coupon = Coupon.objects.filter(code__iexact=code.strip(), is_active=True).first()
    if not coupon:
        raise ValueError('优惠券不存在。')
    if not coupon.is_valid_now():
        raise ValueError('优惠券已过期或已用完。')
    eligible = sum((r['line_total'] for r in rows if not coupon.store_id or r['product'].store_id == coupon.store_id), Decimal('0.00'))
    if not any(not coupon.store_id or r['product'].store_id == coupon.store_id for r in rows):
        raise ValueError('该优惠券不适用于当前店铺商品。')
    if eligible < coupon.min_spend:
        prefix = '本店商品' if coupon.store_id else '商品'
        raise ValueError(f'{prefix}需满 ¥{coupon.min_spend} 才可使用此券。')
    discount = coupon.calculate_discount(subtotal, {r['product'].store_id for r in rows}, eligible_subtotal=eligible)
    if discount <= 0:
        raise ValueError('该优惠券不适用于当前商品。')
    return coupon, discount, eligible


def cart_view(request):
    rows, subtotal = _cart_rows(request)
    token = request.session.get('checkout_token')
    if not token:
        token = uuid.uuid4().hex
        request.session['checkout_token'] = token
    draft = request.session.get('checkout_draft', {})
    codes = request.session.get('coupon_wallet', [])
    coupons = [c for c in Coupon.objects.filter(is_active=True) if c.is_valid_now()]
    return render(request, 'commerce/cart.html', {'rows': rows, 'subtotal': subtotal, 'client_token': token,
                  'draft': draft, 'coupons': coupons, 'wallet': codes})


@require_POST
def cart_add(request, product_id):
    product = get_object_or_404(Product, pk=product_id, is_active=True, store__is_published=True)
    cart = _cart(request)
    qty = int(cart.get(str(product.id), 0)) + 1
    if qty > product.stock:
        error = f'「{product.name}」库存不足，当前仅剩 {product.stock} 件。'
        if _json(request):
            return JsonResponse({'error': error}, status=400)
        messages.error(request, error)
    else:
        cart[str(product.id)] = qty
        request.session['cart'] = cart
        message = f'已加入购物车：{product.name}'
        if _json(request):
            return JsonResponse({'message': message, 'count': sum(cart.values())})
        messages.success(request, message)
    return redirect(_next(request, reverse('mall:store', args=[product.store.slug])))


@require_POST
def cart_update(request, product_id):
    product = get_object_or_404(Product, pk=product_id, is_active=True)
    cart = _cart(request)
    try:
        qty = int(request.POST.get('qty', ''))
        if qty < 1 or qty > min(product.stock, 999):
            raise ValueError
        if str(product_id) not in cart:
            raise ValueError
        cart[str(product_id)] = qty
        request.session['cart'] = cart
        messages.success(request, '商品数量已更新。')
    except (TypeError, ValueError):
        messages.error(request, f'数量需在 1 至 {min(product.stock, 999)} 件之间。')
    return redirect('commerce:cart')


@require_POST
def cart_remove(request, product_id):
    cart = _cart(request)
    cart.pop(str(product_id), None)
    request.session['cart'] = cart
    return redirect('commerce:cart')


@require_POST
def coupon_claim(request, code):
    coupon = get_object_or_404(Coupon, code__iexact=code, is_active=True)
    if not coupon.is_valid_now():
        if _json(request):
            return JsonResponse({'error': '优惠券已过期或已用完。'}, status=400)
        messages.error(request, '优惠券已过期或已用完。')
    else:
        wallet = request.session.get('coupon_wallet', [])
        if coupon.code not in wallet:
            wallet.append(coupon.code)
        request.session['coupon_wallet'] = wallet
        draft = request.session.get('checkout_draft', {})
        draft['coupon_code'] = coupon.code
        request.session['checkout_draft'] = draft
        message = f'已领取 {coupon.name}，结算时可使用。'
        if _json(request):
            return JsonResponse({'message': message})
        messages.success(request, message)
    return redirect(_next(request, reverse('commerce:cart')))


@require_POST
def coupon_preview(request):
    rows, subtotal = _cart_rows(request)
    try:
        coupon, discount, eligible = _coupon(request.POST.get('coupon_code', ''), rows, subtotal)
    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    return JsonResponse({'code': coupon.code, 'discount': str(discount), 'eligible': str(eligible), 'total': str(subtotal - discount)})


def _owns(request, order):
    return request.user.is_staff or order.client_token in request.session.get('order_tokens', []) or order.client_token == request.session.get('checkout_token')


def _owned_order(request, order_no):
    order = get_object_or_404(Order.objects.prefetch_related('items'), order_no=order_no)
    if not _owns(request, order):
        raise Http404('订单不存在')
    return order


def checkout(request):
    if request.method != 'POST':
        return redirect('commerce:cart')
    token = request.POST.get('client_token') or request.session.get('checkout_token') or uuid.uuid4().hex
    if len(token) > 64:
        messages.error(request, '订单凭据无效，请刷新后重试。')
        return redirect('commerce:cart')
    existing = Order.objects.filter(client_token=token).first()
    if existing:
        if not _owns(request, existing):
            raise Http404('订单不存在')
        return redirect('commerce:order', order_no=existing.order_no)
    draft = {key: request.POST.get(key, '').strip() for key in ['customer_name', 'phone', 'address', 'coupon_code']}
    request.session['checkout_draft'] = draft
    if not all(draft[k] for k in ['customer_name', 'phone', 'address']):
        messages.error(request, '请填写收货人、电话和地址。')
        return redirect('commerce:cart')
    if any(len(draft[k]) > limit for k, limit in [('customer_name', 80), ('phone', 30), ('address', 240), ('coupon_code', 40)]):
        messages.error(request, '填写内容过长，请检查。')
        return redirect('commerce:cart')
    try:
        with transaction.atomic():
            # IMMEDIATE opens before these reads: prices, scope and stock share one snapshot.
            rows, subtotal = _cart_rows(request)
            if not rows:
                raise ValueError('购物车为空。')
            coupon, discount = None, Decimal('0.00')
            if draft['coupon_code']:
                coupon, discount, _ = _coupon(draft['coupon_code'], rows, subtotal)
            order = Order.objects.create(client_token=token, subtotal=subtotal, discount=discount, total=subtotal - discount,
                coupon_code=coupon.code if coupon else '', customer_name=draft['customer_name'], phone=draft['phone'], address=draft['address'])
            for row in rows:
                product, qty = row['product'], row['qty']
                if Product.objects.filter(pk=product.pk, stock__gte=qty, is_active=True).update(stock=F('stock') - qty) != 1:
                    raise ValueError(f'「{product.name}」库存不足')
                OrderItem.objects.create(order=order, product=product, store=product.store, name_snapshot=product.name, price_snapshot=product.price, qty=qty)
            if coupon:
                now = timezone.now()
                qs = Coupon.objects.filter(pk=coupon.pk, is_active=True, valid_from__lte=now, valid_to__gte=now)
                if coupon.usage_limit:
                    qs = qs.filter(used_count__lt=F('usage_limit'))
                if qs.update(used_count=F('used_count') + 1) != 1:
                    raise ValueError('优惠券已过期或已用完')
    except IntegrityError:
        existing = Order.objects.filter(client_token=token).first()
        if existing and _owns(request, existing):
            return redirect('commerce:order', order_no=existing.order_no)
        messages.error(request, '订单提交失败，请重试。')
        return redirect('commerce:cart')
    except ValueError as exc:
        messages.error(request, str(exc))
        return redirect('commerce:cart')
    tokens = request.session.get('order_tokens', [])
    if token not in tokens:
        tokens.append(token)
    request.session['order_tokens'] = tokens
    request.session['cart'] = {}
    request.session['checkout_token'] = uuid.uuid4().hex
    request.session.pop('checkout_draft', None)
    messages.success(request, '订单已创建，请完成模拟支付。')
    return redirect('commerce:order', order_no=order.order_no)


def order_list(request):
    orders = Order.objects.filter(client_token__in=request.session.get('order_tokens', [])).prefetch_related('items')
    return render(request, 'commerce/orders.html', {'orders': orders})


def order_detail(request, order_no):
    return render(request, 'commerce/order.html', {'order': _owned_order(request, order_no)})


@require_POST
def order_pay(request, order_no):
    order = _owned_order(request, order_no)
    if Order.objects.filter(pk=order.pk, status='pending').update(status='paid'):
        messages.success(request, '模拟支付成功。')
    return redirect('commerce:order', order_no=order_no)


@require_POST
def order_cancel(request, order_no):
    order = _owned_order(request, order_no)
    if cancel_order(order):
        messages.success(request, '订单已取消，库存和优惠券名额已恢复。')
    else:
        messages.info(request, '订单当前状态不可取消。')
    return redirect('commerce:order', order_no=order_no)
