import json
import os
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from commerce.models import Coupon
from mall.models import Factory, Product, Store


class Command(BaseCommand):
    help = "Load the ERP demo dataset (3 factories / 3 stores / 12 products / 3 coupons)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--with-admin",
            action="store_true",
            help="Create demo superuser admin if it does not exist.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        path = Path(settings.BASE_DIR) / "dataset" / "seed.json"
        data = json.loads(path.read_text(encoding="utf-8"))

        factories = {}
        for item in data["factories"]:
            factory, _ = Factory.objects.update_or_create(
                slug=item["slug"],
                defaults={"name": item["name"], "description": item.get("description", "")},
            )
            factories[item["slug"]] = factory

        stores = {}
        for item in data["stores"]:
            store, _ = Store.objects.update_or_create(
                slug=item["slug"],
                defaults={
                    "factory": factories[item["factory"]],
                    "name": item["name"],
                    "template": item["template"],
                    "config": item.get("config", {}),
                    "is_published": item.get("is_published", True),
                },
            )
            stores[item["slug"]] = store

        for item in data["products"]:
            store = stores[item["store"]]
            Product.objects.update_or_create(
                store=store,
                sku=item["sku"],
                defaults={
                    "name": item["name"],
                    "price": Decimal(item["price"]),
                    "stock": item["stock"],
                    "image_name": f"{item['sku']}.png",
                    "sizes": item.get("sizes", []),
                    "colors": item.get("colors", []),
                    "is_active": True,
                },
            )

        for item in data["coupons"]:
            Coupon.objects.update_or_create(
                code=item["code"],
                defaults={
                    "name": item["name"],
                    "kind": item["kind"],
                    "value": Decimal(item["value"]),
                    "min_spend": Decimal(item["min_spend"]),
                    "valid_from": datetime.fromisoformat(item["valid_from"]),
                    "valid_to": datetime.fromisoformat(item["valid_to"]),
                    "usage_limit": item["usage_limit"],
                    "store": stores.get(item["store"]) if item.get("store") else None,
                    "is_active": item.get("is_active", True),
                },
            )

        if options["with_admin"]:
            User = get_user_model()
            username = os.environ.get("SEED_ADMIN_USERNAME", "admin")
            password = os.environ.get("SEED_ADMIN_PASSWORD", "admin12345")
            user, created = User.objects.get_or_create(
                username=username,
                defaults={"is_staff": True, "is_superuser": True, "email": "admin@example.com"},
            )
            if created:
                user.set_password(password)
                user.save()
                self.stdout.write(self.style.SUCCESS(f"created superuser {username}"))
            else:
                self.stdout.write(f"superuser {username} already exists")

        self.stdout.write(
            self.style.SUCCESS(
                f"seed done: {len(factories)} factories, {len(stores)} stores, "
                f"{len(data['products'])} products, {len(data['coupons'])} coupons"
            )
        )
