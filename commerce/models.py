import uuid
from decimal import Decimal, ROUND_HALF_UP

from django.db import models
from django.utils import timezone


def new_order_no():
    return uuid.uuid4().hex[:12].upper()


class Coupon(models.Model):
    TYPE_CHOICES = [
        ("fixed", "满减"),
        ("percent", "折扣"),
    ]

    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=80)
    kind = models.CharField(max_length=10, choices=TYPE_CHOICES, default="fixed")
    value = models.DecimalField(max_digits=10, decimal_places=2)
    min_spend = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField()
    usage_limit = models.PositiveIntegerField(default=0, help_text="0 表示不限")
    used_count = models.PositiveIntegerField(default=0)
    store = models.ForeignKey(
        "mall.Store", on_delete=models.CASCADE, null=True, blank=True, related_name="coupons"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} / {self.name}"

    def is_valid_now(self):
        now = timezone.now()
        return (
            self.is_active
            and self.valid_from <= now <= self.valid_to
            and (self.usage_limit == 0 or self.used_count < self.usage_limit)
        )

    def calculate_discount(self, subtotal, store_ids=None):
        subtotal = Decimal(subtotal)
        if subtotal < self.min_spend:
            return Decimal("0.00")
        if self.store_id and store_ids is not None and self.store_id not in store_ids:
            return Decimal("0.00")
        if self.kind == "percent":
            discount = subtotal * (self.value / Decimal("100"))
        else:
            discount = self.value
        discount = min(discount, subtotal)
        return discount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class Order(models.Model):
    STATUS_CHOICES = [
        ("pending", "待支付"),
        ("paid", "已支付"),
        ("cancelled", "已取消"),
    ]

    order_no = models.CharField(max_length=20, unique=True, default=new_order_no)
    client_token = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="pending")
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    coupon_code = models.CharField(max_length=40, blank=True)
    customer_name = models.CharField(max_length=80)
    phone = models.CharField(max_length=30)
    address = models.CharField(max_length=240)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.order_no} / {self.get_status_display()}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("mall.Product", on_delete=models.PROTECT)
    store = models.ForeignKey("mall.Store", on_delete=models.PROTECT)
    name_snapshot = models.CharField(max_length=120)
    price_snapshot = models.DecimalField(max_digits=10, decimal_places=2)
    qty = models.PositiveIntegerField()
    size = models.CharField(max_length=30, blank=True)
    color = models.CharField(max_length=30, blank=True)

    def line_total(self):
        return self.price_snapshot * self.qty
