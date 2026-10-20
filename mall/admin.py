from django.contrib import admin

from .models import Factory, Product, Store


@admin.register(Factory)
class FactoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ("name", "factory", "template", "is_published", "created_at")
    list_filter = ("template", "is_published", "factory")
    search_fields = ("name", "slug", "factory__name")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "store", "sku", "price", "stock", "is_active")
    list_filter = ("is_active", "store__factory", "store")
    search_fields = ("name", "sku", "store__name")
