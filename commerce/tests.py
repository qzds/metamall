from datetime import timedelta
from decimal import Decimal

from django.test import Client, TestCase
from django.utils import timezone

from mall.models import Factory, Product, Store

from .models import Coupon, Order


class CommerceFlowTests(TestCase):
    def setUp(self):
        self.factory = Factory.objects.create(name="测试工厂", slug="test-factory")
        self.store = Store.objects.create(
            factory=self.factory,
            name="测试店铺",
            slug="test-store",
            template="boutique",
            config={},
        )
        self.product = Product.objects.create(
            store=self.store,
            name="测试商品",
            sku="T-001",
            price="199.00",
            stock=5,
        )
        self.coupon = Coupon.objects.create(
            code="TEST30",
            name="测试满减",
            kind="fixed",
            value=Decimal("30.00"),
            min_spend=Decimal("100.00"),
            valid_from=timezone.now() - timedelta(days=1),
            valid_to=timezone.now() + timedelta(days=1),
            usage_limit=2,
        )
        self.client = Client(SERVER_NAME="localhost")

    def _checkout(self, token="token-1", coupon="TEST30"):
        return self.client.post(
            "/checkout/",
            {
                "client_token": token,
                "customer_name": "测试用户",
                "phone": "13800000000",
                "address": "厦门大学",
                "coupon_code": coupon,
            },
        )

    def test_checkout_updates_stock_and_coupon(self):
        self.client.post(f"/cart/add/{self.product.id}/")
        response = self._checkout()
        self.assertEqual(response.status_code, 302)
        order = Order.objects.get(client_token="token-1")
        self.assertEqual(order.total, Decimal("169.00"))
        self.product.refresh_from_db()
        self.coupon.refresh_from_db()
        self.assertEqual(self.product.stock, 4)
        self.assertEqual(self.coupon.used_count, 1)

    def test_double_submit_is_idempotent(self):
        self.client.post(f"/cart/add/{self.product.id}/")
        self._checkout()
        self.client.post(f"/cart/add/{self.product.id}/")
        self._checkout()
        self.assertEqual(Order.objects.count(), 1)
        self.product.refresh_from_db()
        self.coupon.refresh_from_db()
        self.assertEqual(self.product.stock, 4)
        self.assertEqual(self.coupon.used_count, 1)

    def test_cancel_restores_stock_and_coupon_once(self):
        self.client.post(f"/cart/add/{self.product.id}/")
        self._checkout()
        order = Order.objects.get(client_token="token-1")
        self.client.post(f"/orders/{order.order_no}/cancel/")
        self.product.refresh_from_db()
        self.coupon.refresh_from_db()
        self.assertEqual(self.product.stock, 5)
        self.assertEqual(self.coupon.used_count, 0)
        self.client.post(f"/orders/{order.order_no}/cancel/")
        self.product.refresh_from_db()
        self.coupon.refresh_from_db()
        self.assertEqual(self.product.stock, 5)
        self.assertEqual(self.coupon.used_count, 0)

    def test_coupon_min_spend_is_enforced(self):
        self.product.price = Decimal("50.00")
        self.product.save(update_fields=["price"])
        self.client.post(f"/cart/add/{self.product.id}/")
        self._checkout()
        self.assertEqual(Order.objects.count(), 0)
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.used_count, 0)
