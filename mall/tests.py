from django.test import Client, TestCase
from django.urls import reverse

from .models import Factory, Product, Store


class MallViewTests(TestCase):
    def setUp(self):
        self.factory = Factory.objects.create(name="测试工厂", slug="test-factory")
        self.store = Store.objects.create(
            factory=self.factory,
            name="测试店铺",
            slug="test-store",
            template="boutique",
            config={"tagline": "测试", "palette": {"accent": "#B23A48"}},
        )
        self.product = Product.objects.create(
            store=self.store,
            name="测试商品",
            sku="T-001",
            price="199.00",
            stock=5,
            colors=["#B23A48"],
        )
        self.client = Client(SERVER_NAME="localhost")

    def test_mall_and_store_pages(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        response = self.client.get(reverse("mall:store", args=[self.store.slug]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "测试店铺")
        self.assertContains(response, "测试商品")

    def test_store_scene_is_config_driven(self):
        spec = self.store.build_scene()
        self.assertEqual(spec["store"]["slug"], "test-store")
        self.assertEqual(spec["template"], "boutique")
        self.assertEqual(len(spec["products"]), 1)

    def test_builder_creates_store_and_copies_products(self):
        response = self.client.post(
            reverse("mall:builder"),
            {
                "factory": self.factory.id,
                "name": "新店",
                "template": "minimal",
                "accent": "#3D7068",
                "tagline": "新店标语",
                "source_store": self.store.id,
            },
        )
        self.assertEqual(response.status_code, 302)
        new_store = Store.objects.get(name="新店")
        self.assertEqual(new_store.template, "minimal")
        self.assertEqual(new_store.config["palette"]["accent"], "#3D7068")
        self.assertEqual(new_store.products.count(), 1)
