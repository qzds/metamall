from django.db import transaction
from django.db.models import F

from mall.models import Product
from .models import Coupon, Order


@transaction.atomic
def cancel_order(order):
    """The customer page and Admin must use the same one-time restoration."""
    updated = Order.objects.filter(pk=order.pk, status__in=["pending", "paid"]).update(status="cancelled")
    if not updated:
        return False
    for item in order.items.all():
        Product.objects.filter(pk=item.product_id).update(stock=F("stock") + item.qty)
    if order.coupon_code:
        Coupon.objects.filter(code=order.coupon_code, used_count__gt=0).update(used_count=F("used_count") - 1)
    return True
