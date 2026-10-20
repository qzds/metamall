import uuid
from copy import deepcopy

from django.contrib import messages
from django.db import transaction
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils.text import slugify

from .forms import StoreCreateForm
from .models import Product, Store


def _store_card(store):
    palette = (store.config or {}).get("palette", {})
    default_accent = "#B23A48" if store.template == "boutique" else "#3D7068"
    return {
        "name": store.name,
        "factory": store.factory.name,
        "tagline": (store.config or {}).get("tagline", ""),
        "accent": palette.get("accent", default_accent),
        "featured": (store.products.first().image_url if store.products.first() else ""),
        "url": reverse("mall:store", args=[store.slug]),
    }


def mall_index(request):
    stores = Store.objects.filter(is_published=True).select_related("factory").prefetch_related("products")
    return render(
        request,
        "mall/index.html",
        {"stores": stores, "stores_data": [_store_card(s) for s in stores]},
    )


def store_detail(request, slug):
    store = get_object_or_404(
        Store.objects.select_related("factory"), slug=slug, is_published=True
    )
    products = store.products.filter(is_active=True)
    return render(
        request,
        "mall/store.html",
        {"store": store, "products": products, "scene": store.build_scene()},
    )


def builder(request):
    if request.method == "POST":
        form = StoreCreateForm(request.POST)
        if form.is_valid():
            with transaction.atomic():
                name = form.cleaned_data["name"].strip()
                factory = form.cleaned_data["factory"]
                base = slugify(name) or f"{factory.slug}-store-{uuid.uuid4().hex[:6]}"
                slug = base
                suffix = 2
                while Store.objects.filter(slug=slug).exists():
                    slug = f"{base}-{suffix}"
                    suffix += 1
                template = form.cleaned_data["template"]
                accent = form.cleaned_data["accent"]
                color = "warm" if template == "boutique" else "cool"
                store = Store.objects.create(
                    factory=form.cleaned_data["factory"],
                    name=name,
                    slug=slug,
                    template=template,
                    is_published=True,
                    config={
                        "tagline": form.cleaned_data.get("tagline", ""),
                        "width": 12 if template == "boutique" else 10,
                        "depth": 10 if template == "boutique" else 8,
                        "height": 4 if template == "boutique" else 3.6,
                        "lighting": color,
                        "seed": uuid.uuid4().int % 100000,
                        "palette": {
                            "wall": "#F3EEE7" if template == "boutique" else "#ECECEC",
                            "floor": "#B9A48C" if template == "boutique" else "#C9C4BA",
                            "accent": accent,
                            "sign": "#1F2937" if template == "boutique" else "#1A1A1A",
                        },
                    },
                )
                source = form.cleaned_data.get("source_store")
                if source:
                    for product in source.products.filter(is_active=True):
                        Product.objects.create(
                            store=store,
                            name=product.name,
                            sku=product.sku,
                            description=product.description,
                            price=product.price,
                            stock=max(product.stock, 10),
                            sizes=deepcopy(product.sizes),
                            colors=deepcopy(product.colors),
                            is_active=True,
                        )
            messages.success(request, f"店铺「{store.name}」已生成并发布到商圈。")
            return redirect("mall:store", slug=store.slug)
    else:
        first_store = Store.objects.filter(is_published=True).first()
        form = StoreCreateForm(initial={"source_store": first_store})

    stores = list(Store.objects.filter(is_published=True).prefetch_related("products"))
    preview_stores = {}
    for store in stores:
        palette = (store.config or {}).get("palette", {})
        preview_stores[str(store.id)] = {
            "name": store.name,
            "template": store.template,
            "accent": palette.get("accent", "#B23A48"),
            "tagline": (store.config or {}).get("tagline", ""),
            "products": [
                {
                    "name": product.name,
                    "image": product.image_url,
                    "color": product.colors[0] if product.colors else palette.get("accent", "#B23A48"),
                }
                for product in store.products.filter(is_active=True)[:4]
            ],
        }

    return render(
        request,
        "mall/builder.html",
        {"form": form, "stores": stores, "preview_stores": preview_stores},
    )
