from django.conf import settings
from django.db import models


TEMPLATE_DEFAULTS = {
    "boutique": {
        "width": 12.0,
        "depth": 10.0,
        "height": 4.0,
        "palette": {
            "wall": "#F3EEE7",
            "floor": "#B9A48C",
            "accent": "#B23A48",
            "sign": "#1F2937",
        },
        "lighting": "warm",
    },
    "minimal": {
        "width": 10.0,
        "depth": 8.0,
        "height": 3.6,
        "palette": {
            "wall": "#ECECEC",
            "floor": "#C9C4BA",
            "accent": "#3D7068",
            "sign": "#1A1A1A",
        },
        "lighting": "cool",
    },
}


class Factory(models.Model):
    name = models.CharField(max_length=80)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to="logos/", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Store(models.Model):
    TEMPLATE_CHOICES = [
        ("boutique", "精品店"),
        ("minimal", "极简店"),
    ]

    factory = models.ForeignKey(Factory, on_delete=models.CASCADE, related_name="stores")
    name = models.CharField(max_length=80)
    slug = models.SlugField(unique=True)
    template = models.CharField(max_length=20, choices=TEMPLATE_CHOICES, default="boutique")
    config = models.JSONField(default=dict, blank=True)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.factory.name} / {self.name}"

    @property
    def featured_image(self):
        product = self.products.first()
        return product.image_url if product else ""

    def build_scene(self):
        from .scene import build_scene_spec
        return build_scene_spec(self)


class Product(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=120)
    sku = models.CharField(max_length=60)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    image = models.ImageField(upload_to="products/", blank=True)
    image_name = models.CharField(max_length=120, blank=True)
    sizes = models.JSONField(default=list, blank=True)
    colors = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        unique_together = [("store", "sku")]

    def __str__(self):
        return f"{self.name} ({self.store.name})"

    @property
    def image_url(self):
        if self.image:
            return self.image.url
        return f"{settings.STATIC_URL}img/products/{self.image_name}" if self.image_name else ""
