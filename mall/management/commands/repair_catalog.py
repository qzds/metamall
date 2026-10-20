"""Repair known missing demo image references without reseeding stock or orders."""
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from commerce.models import OrderItem
from mall.models import Product, Store


class Command(BaseCommand):
    help = "Restore missing image references for known demo SKUs; never reset prices, stock or orders."

    def add_arguments(self, parser):
        parser.add_argument("--archive-legacy-test", action="store_true", help="Unpublish the exact old w/rrr test fixture, preserving it in Admin.")

    @transaction.atomic
    def handle(self, *args, **options):
        repaired = 0
        for product in Product.objects.filter(image_name=""):
            if product.image:
                continue
            filename = f"{product.sku}.png"
            if Path(filename).name == filename and (settings.BASE_DIR / "static" / "img" / "products" / filename).is_file():
                product.image_name = filename
                product.save(update_fields=["image_name"])
                repaired += 1
        archived = 0
        if options["archive_legacy_test"]:
            for store in Store.objects.filter(slug="w", name="w", is_published=True):
                if store.config.get("tagline") == "rrr" and not OrderItem.objects.filter(store=store).exists():
                    store.is_published = False
                    store.save(update_fields=["is_published"])
                    archived += 1
        self.stdout.write(f"repaired image references: {repaired}; archived legacy test fixture: {archived}; stock/orders unchanged")
