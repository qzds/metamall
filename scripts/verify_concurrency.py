"""Run real SQLite file/parallel-request checks without touching the demo DB."""
import json
import os
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path
from threading import Barrier

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")


def main():
    from django.conf import settings
    temp_root = Path(tempfile.gettempdir()).resolve()
    with tempfile.TemporaryDirectory(prefix="metamall-concurrency-") as temporary:
        assert Path(temporary).resolve().is_relative_to(temp_root)
        settings.DATABASES["default"]["NAME"] = str(Path(temporary) / "isolated.sqlite3")
        settings.ALLOWED_HOSTS = ["testserver", "localhost"]
        import django
        django.setup()
        from django.core.management import call_command
        from django.db import connections
        from django.test import Client
        from django.utils import timezone
        from mall.models import Factory, Store, Product
        from commerce.models import Coupon, Order
        from commerce.services import cancel_order
        call_command("migrate", verbosity=0)
        factory = Factory.objects.create(name="Isolated concurrency factory", slug="concurrency")
        store = Store.objects.create(factory=factory, name="Isolated store", slug="isolated")
        product = Product.objects.create(store=store, name="Last unit", sku="LAST", price=299, stock=1)
        coupon = Coupon.objects.create(code="LAST30", name="Last coupon", kind="fixed", value=30, min_spend=199,
                   valid_from=timezone.now() - timedelta(days=1), valid_to=timezone.now() + timedelta(days=1), usage_limit=1)
        clients = []
        for _ in range(8):
            client = Client()
            client.post(f"/cart/add/{product.pk}/")
            client.get("/cart/")
            clients.append(client)
        barrier = Barrier(8)

        def submit(index):
            try:
                barrier.wait(timeout=15)
                response = clients[index].post("/checkout/", {"client_token": f"parallel-{index}", "customer_name": "Isolated test",
                       "phone": "000", "address": "No delivery", "coupon_code": "LAST30"})
                return response.status_code
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=8) as pool:
            responses = list(pool.map(submit, range(8)))
        product.refresh_from_db()
        coupon.refresh_from_db()
        oversell = {"requests": 8, "responses": responses, "orders": Order.objects.count(), "stock": product.stock, "coupon_used": coupon.used_count}
        assert oversell["orders"] == 1 and product.stock == 0 and coupon.used_count == 1
        order = Order.objects.get()
        barrier2 = Barrier(4)

        def cancel(_):
            try:
                barrier2.wait(timeout=15)
                return cancel_order(Order.objects.get(pk=order.pk))
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=4) as pool:
            cancellations = list(pool.map(cancel, range(4)))
        product.refresh_from_db()
        coupon.refresh_from_db()
        assert sum(cancellations) == 1 and product.stock == 1 and coupon.used_count == 0

        owner = Client()
        owner.post(f"/cart/add/{product.pk}/")
        owner.get("/cart/")
        token = owner.session["checkout_token"]
        clones = [Client(), Client()]
        for client in clones:
            client.cookies.update(owner.cookies)
        gate = Barrier(2)

        def same_token(i):
            try:
                gate.wait(timeout=15)
                response = clones[i].post("/checkout/", {"client_token": token, "customer_name": "Idempotent test", "phone": "000", "address": "No delivery"})
                return response.status_code
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            duplicate_responses = list(pool.map(same_token, range(2)))
        product.refresh_from_db()
        assert Order.objects.filter(client_token=token).count() == 1 and product.stock == 0
        result = {"database": "independent temporary SQLite file", "oversell": oversell,
                  "parallel_cancellation": {"requests": 4, "restorations": sum(cancellations), "restored_stock": 1, "coupon_used": 0},
                  "duplicate_submission": {"responses": duplicate_responses, "matching_orders": 1, "remaining_stock": 0}}
        output = ROOT / "output" / "playwright" / "v3-concurrency.json"
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False))
        connections.close_all()


if __name__ == "__main__":
    main()
