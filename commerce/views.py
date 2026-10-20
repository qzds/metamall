import uuid
from decimal import Decimal

from django.contrib import messages
from django.db import IntegrityError, transaction
from django.db.models import F, Q
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST

from mall.models import Product

from .models import Coupon, Order, OrderItem


def _cart(request):
    return request.session.setdefault("cart", {})


def _cart_rows(request):
    cart = _cart(request)
    products = Product.objects.filter(
        id__in=[int(k) for k in cart.keys()], is_active=True
    ).select_related("store")
    rows = []
    subtotal = Decimal("0.00")
    for product in products:
        qty = int(cart.get(str(product.id), 0))
        if qty <= 0:
            continue
        line_total = product.price * qty
        subtotal += line_total
        rows.append({"product": product, "qty": qty, "line_total": line_total})
    return rows, subtotal


def cart_view(request):
    rows, subtotal = _cart_rows(request)
    token = request.session.get("checkout_token")
    if not token:
        token = uuid.uuid4().hex
        request.session["checkout_token"] = token
    return render(
        request,
        "commerce/cart.html",
        {"rows": rows, "subtotal": subtotal, "client_token": token},
    )


@require_POST
def cart_add(request, product_id):
    product = get_object_or_404(Product, pk=product_id, is_active=True)
    cart = _cart(request)
    qty = int(cart.get(str(product.id), 0)) + 1
    if qty > product.stock:
        messages.error(request, f"「{product.name}」库存不足，当前仅剩 {product.stock} 件。")
    else:
        cart[str(product.id)] = qty
        request.session["cart"] = cart
        messages.success(request, f"已加入购物车：{product.name}")
    next_url = request.POST.get("next") or reverse("mall:store", args=[product.store.slug])
    return redirect(next_url)


@require_POST
def cart_remove(request, product_id):
    cart = _cart(request)
    cart.pop(str(product_id), None)
    request.session["cart"] = cart
    return redirect("commerce:cart")


def checkout(request):
    if request.method != "POST":
        return redirect("commerce:cart")

    token = request.POST.get("client_token") or request.session.get("checkout_token")
    if not token:
        token = uuid.uuid4().hex
    existing = Order.objects.filter(client_token=token).first()
    if existing:
        return redirect("commerce:order", order_no=existing.order_no)

    rows, subtotal = _cart_rows(request)
    if not rows:
        messages.error(request, "购物车为空。")
        return redirect("commerce:cart")

    customer_name = request.POST.get("customer_name", "").strip()
    phone = request.POST.get("phone", "").strip()
    address = request.POST.get("address", "").strip()
    if not (customer_name and phone and address):
        messages.error(request, "请填写收货人、电话和地址。")
        return redirect("commerce:cart")

    coupon = None
    coupon_code = request.POST.get("coupon_code", "").strip().upper()
    discount = Decimal("0.00")
    if coupon_code:
        coupon = Coupon.objects.filter(code__iexact=coupon_code, is_active=True).first()
        if coupon is None:
            messages.error(request, "优惠券不存在。")
            return redirect("commerce:cart")
        if not coupon.is_valid_now():
            messages.error(request, "优惠券已过期或已用完。")
            return redirect("commerce:cart")
        if subtotal < coupon.min_spend:
            messages.error(request, f"优惠券需满 ¥{coupon.min_spend} 才可使用。")
            return redirect("commerce:cart")
        store_ids = {row["product"].store_id for row in rows}
        discount = coupon.calculate_discount(subtotal, store_ids)
        if discount <= 0:
            messages.error(request, "该优惠券不适用于当前商品。")
            return redirect("commerce:cart")

    try:
        with transaction.atomic():
            order = Order.objects.create(
                client_token=token,
                subtotal=subtotal,
                discount=discount,
                total=subtotal - discount,
                coupon_code=coupon.code if coupon else "",
                customer_name=customer_name,
                phone=phone,
                address=address,
            )
            for row in rows:
                product = row["product"]
                qty = row["qty"]
                updated = Product.objects.filter(
                    pk=product.pk, stock__gte=qty
                ).update(stock=F("stock") - qty)
                if updated != 1:
                    raise ValueError(f"「{product.name}」库存不足")
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    store=product.store,
                    name_snapshot=product.name,
                    price_snapshot=product.price,
                    qty=qty,
                )
            if coupon:
                coupon_qs = Coupon.objects.filter(pk=coupon.pk, is_active=True)
                if coupon.usage_limit:
                    coupon_qs = coupon_qs.filter(used_count__lt=F("usage_limit"))
                if coupon_qs.update(used_count=F("used_count") + 1) != 1:
                    raise ValueError("优惠券已用完")
            request.session["cart"] = {}
            request.session["checkout_token"] = uuid.uuid4().hex
    except IntegrityError:
        existing = Order.objects.filter(client_token=token).first()
        if existing:
            return redirect("commerce:order", order_no=existing.order_no)
        messages.error(request, "订单提交失败，请重试。")
        return redirect("commerce:cart")
    except ValueError as exc:
        messages.error(request, str(exc))
        return redirect("commerce:cart")

    messages.success(request, f"订单 {order.order_no} 已创建，请完成模拟支付。")
    return redirect("commerce:order", order_no=order.order_no)


def order_detail(request, order_no):
    order = get_object_or_404(Order.objects.prefetch_related("items"), order_no=order_no)
    return render(request, "commerce/order.html", {"order": order})


@require_POST
def order_pay(request, order_no):
    order = get_object_or_404(Order, order_no=order_no)
    if order.status == "pending":
        Order.objects.filter(pk=order.pk, status="pending").update(status="paid")
        messages.success(request, "模拟支付成功。")
    return redirect("commerce:order", order_no=order_no)


@require_POST
def order_cancel(request, order_no):
    order = get_object_or_404(Order, order_no=order_no)
    with transaction.atomic():
        updated = Order.objects.filter(
            pk=order.pk, status__in=["pending", "paid"]
        ).update(status="cancelled")
        if updated == 1:
            for item in order.items.all():
                Product.objects.filter(pk=item.product_id).update(
                    stock=F("stock") + item.qty
                )
            if order.coupon_code:
                Coupon.objects.filter(
                    code=order.coupon_code, used_count__gt=0
                ).update(used_count=F("used_count") - 1)
            messages.success(request, "订单已取消，库存/优惠券已回退。")
        else:
            messages.info(request, "订单当前状态不可取消。")
    return redirect("commerce:order", order_no=order_no)
