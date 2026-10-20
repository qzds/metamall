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
            image_name="YC-001.png",
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

    def test_district_and_formal_store_share_scene_contract(self):
        response = self.client.get("/")
        card = next(s for s in response.context["stores_data"] if s["slug"] == self.store.slug)
        self.assertEqual(card["scene"], self.store.build_scene())
        self.assertEqual(card["scene"]["products"][0]["image"], self.product.image_url)

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

    def test_preview_and_publication_have_identical_scene_contract(self):
        data = {"factory": self.factory.pk, "name": "新展馆", "template": "boutique", "accent": "#8EDFF5",
                "style": "garden", "layout": "island", "width": 14, "depth": 11, "lighting": "daylight",
                "seed": 777, "source_store": self.store.pk, "tagline": "同一配置，同一世界"}
        preview = self.client.post(reverse("mall:builder_preview"), data)
        self.assertEqual(preview.status_code, 200)
        self.client.post(reverse("mall:builder"), data)
        published = Store.objects.get(name="新展馆").build_scene()
        actual = preview.json()
        for key in ["template", "style", "layout", "dimensions", "lighting", "seed", "palette"]:
            self.assertEqual(actual[key], published[key], key)
        self.assertEqual(actual["store"]["name"], published["store"]["name"])
        for key in ["name", "image", "price", "stock", "colors", "sizes"]:
            self.assertEqual(actual["products"][0][key], published["products"][0][key], key)
        self.assertEqual(published["products"][0]["image"], "/static/img/products/YC-001.png")

    def test_no_source_means_empty_preview_and_empty_published_store(self):
        data = {"factory": self.factory.pk, "name": "空展馆", "template": "minimal", "accent": "#AABBCC"}
        response = self.client.post(reverse("mall:builder_preview"), data)
        self.assertEqual(response.json()["products"], [])
        self.client.post(reverse("mall:builder"), data)
        self.assertEqual(Store.objects.get(name="空展馆").products.count(), 0)

    def test_builder_rejects_out_of_range_dimensions(self):
        data = {"factory": self.factory.pk, "name": "错误展馆", "template": "minimal", "accent": "#AABBCC", "width": 999}
        response = self.client.post(reverse("mall:builder_preview"), data)
        self.assertEqual(response.status_code, 400)
        self.assertIn("width", response.json()["errors"])

    def test_all_published_stores_reach_the_district_and_seed_order_is_stable(self):
        for slug, name in [("qinghe-store", "青禾"), ("yunchang-store", "云裳"), ("jijian-store", "极简"), ("a-new-store", "A新店")]:
            Store.objects.create(factory=self.factory, slug=slug, name=name)
        response = self.client.get("/")
        slugs = [s.slug for s in response.context["stores"]]
        self.assertEqual(slugs[:3], ["yunchang-store", "jijian-store", "qinghe-store"])
        self.assertEqual(len(slugs), 5)
        self.assertContains(response, "/stores/a-new-store/")

    def test_uploaded_product_image_is_not_ignored(self):
        self.product.image = "products/uploaded.png"
        self.assertEqual(self.product.image_url, "/media/products/uploaded.png")
