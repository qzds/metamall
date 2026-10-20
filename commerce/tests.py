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

    def _other_product(self):
        store = Store.objects.create(factory=self.factory, name="其他店", slug="other-store")
        return Product.objects.create(store=store, name="其他店商品", sku="O-1", price="900.00", stock=5)

    def test_mixed_cart_cannot_reach_store_coupon_threshold_with_other_store(self):
        other = self._other_product()
        self.coupon.store = self.store
        self.coupon.min_spend = Decimal("299")
        self.coupon.save()
        self.client.post(f"/cart/add/{self.product.id}/")
        self.client.post(f"/cart/add/{other.id}/")
        self._checkout()
        self.assertEqual(Order.objects.count(), 0)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 5)

    def test_store_percentage_coupon_only_discounts_eligible_store(self):
        other = self._other_product()
        self.coupon.store = self.store
        self.coupon.kind = "percent"
        self.coupon.value = Decimal("10")
        self.coupon.save()
        self.client.post(f"/cart/add/{self.product.id}/")
        self.client.post(f"/cart/add/{other.id}/")
        self._checkout()
        order = Order.objects.get()
        self.assertEqual(order.discount, Decimal("19.90"))
        self.assertEqual(order.total, Decimal("1079.10"))

    def test_invalid_expired_wrong_store_and_exhausted_coupons(self):
        self.client.post(f"/cart/add/{self.product.id}/")
        self._checkout(coupon="UNKNOWN")
        self.assertEqual(Order.objects.count(), 0)
        self.coupon.valid_to = timezone.now() - timedelta(seconds=1)
        self.coupon.save()
        self._checkout()
        self.assertEqual(Order.objects.count(), 0)
        self.coupon.valid_to = timezone.now() + timedelta(days=1)
        self.coupon.used_count = self.coupon.usage_limit
        self.coupon.save()
        self._checkout()
        self.assertEqual(Order.objects.count(), 0)
        other = self._other_product()
        self.coupon.used_count = 0
        self.coupon.store = other.store
        self.coupon.save()
        self._checkout()
        self.assertEqual(Order.objects.count(), 0)

    def test_stock_failure_rolls_back_the_whole_order_and_coupon(self):
        other = self._other_product()
        self.client.post(f"/cart/add/{other.id}/")
        self.client.post(f"/cart/add/{self.product.id}/")
        self.product.stock = 0
        self.product.save(update_fields=["stock"])
        self._checkout()
        other.refresh_from_db()
        self.coupon.refresh_from_db()
        self.assertEqual(other.stock, 5)
        self.assertEqual(self.coupon.used_count, 0)
        self.assertEqual(Order.objects.count(), 0)

    def test_quantity_update_validates_stock_and_positive_quantity(self):
        self.client.post(f"/cart/add/{self.product.id}/")
        self.client.post(f"/cart/update/{self.product.id}/", {"qty": 3})
        self.assertEqual(self.client.session["cart"][str(self.product.id)], 3)
        for qty in [0, -1, 6, "bad"]:
            self.client.post(f"/cart/update/{self.product.id}/", {"qty": qty})
            self.assertEqual(self.client.session["cart"][str(self.product.id)], 3)

    def test_another_session_cannot_read_pay_cancel_or_reuse_order_token(self):
        self.client.post(f"/cart/add/{self.product.id}/")
        self._checkout()
        order = Order.objects.get()
        other = Client(SERVER_NAME="localhost")
        for suffix in ["", "pay/", "cancel/"]:
            url = f"/orders/{order.order_no}/{suffix}"
            response = other.get(url) if not suffix else other.post(url)
            self.assertEqual(response.status_code, 404)
        response = other.post("/checkout/", {"client_token": order.client_token})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.client.get(f"/orders/{order.order_no}/").status_code, 200)

    def test_coupon_preview_does_not_consume_stock_or_coupon(self):
        self.client.post(f"/cart/add/{self.product.id}/")
        response = self.client.post("/coupons/preview/", {"coupon_code": "TEST30"})
        self.assertEqual(response.json()["discount"], "30.00")
        self.product.refresh_from_db()
        self.coupon.refresh_from_db()
        self.assertEqual(self.product.stock, 5)
        self.assertEqual(self.coupon.used_count, 0)
        self.assertEqual(Order.objects.count(), 0)

    def test_claim_is_session_scoped_and_does_not_redeem(self):
        self.client.post("/coupons/claim/TEST30/")
        self.client.post("/coupons/claim/TEST30/")
        self.assertEqual(self.client.session["coupon_wallet"], ["TEST30"])
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.used_count, 0)

    def test_cart_add_ajax_avoids_reloading_3d_scene(self):
        response = self.client.post(f"/cart/add/{self.product.id}/", HTTP_ACCEPT="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)

    def test_admin_cancellation_uses_same_one_time_restoration(self):
        from django.contrib import admin
        from .services import cancel_order
        from .admin import OrderAdmin
        self.client.post(f"/cart/add/{self.product.id}/")
        self._checkout()
        order = Order.objects.get()
        self.assertIn("status", OrderAdmin.readonly_fields)
        self.assertTrue(cancel_order(order))
        self.assertFalse(cancel_order(order))
        self.product.refresh_from_db()
        self.coupon.refresh_from_db()
        self.assertEqual(self.product.stock, 5)
        self.assertEqual(self.coupon.used_count, 0)
