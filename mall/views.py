import uuid
from copy import deepcopy

from django.contrib import messages
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils.text import slugify
from django.views.decorators.http import require_POST

from commerce.models import Coupon
from .forms import StoreCreateForm
from .models import Factory, Product, Store
from .scene import STYLE_PRESETS, make_scene_spec, scene_config

SEED_SLUGS = ['yunchang-store', 'jijian-store', 'qinghe-store']


def published_stores():
    stores = Store.objects.filter(is_published=True).select_related('factory').prefetch_related('products')
    return sorted(stores, key=lambda s: (SEED_SLUGS.index(s.slug) if s.slug in SEED_SLUGS else 3, s.pk))


def _store_card(store):
    cfg = scene_config(store.template, store.config, store.factory.slug)
    products = [p for p in store.products.all() if p.is_active]
    return {'name': store.name, 'factory': store.factory.name, 'slug': store.slug,
            'tagline': (store.config or {}).get('tagline', ''), 'style': cfg['style'],
            'accent': cfg['palette']['accent'], 'product_count': len(products),
            'featured_images': [p.image_url for p in products[:2] if p.image_url],
            'scene': make_scene_spec(store.name, store.slug, store.factory, store.template,
                                     store.config, products[:12]),
            'url': reverse('mall:store', args=[store.slug])}


def mall_index(request):
    stores = published_stores()
    return render(request, 'mall/index.html', {'stores': stores, 'stores_data': [_store_card(s) for s in stores],
                  'factory_count': len({s.factory_id for s in stores}),
                  'product_count': sum(sum(p.is_active for p in s.products.all()) for s in stores)})


def store_detail(request, slug):
    store = get_object_or_404(Store.objects.select_related('factory'), slug=slug, is_published=True)
    products = store.products.filter(is_active=True)
    coupons = [c for c in Coupon.objects.filter(Q(store=store) | Q(store__isnull=True), is_active=True) if c.is_valid_now()]
    return render(request, 'mall/store.html', {'store': store, 'products': products,
                  'scene': store.build_scene(), 'coupons': coupons})


def config_from_form(form):
    data = form.cleaned_data
    style = data.get('style') or ('gallery' if data['template'] == 'minimal' else 'atelier')
    preset = STYLE_PRESETS[style]
    return {'tagline': data.get('tagline', ''), 'style': style, 'layout': data.get('layout') or 'gallery',
            'width': data.get('width') or (10 if data['template'] == 'minimal' else 12),
            'depth': data.get('depth') or (8 if data['template'] == 'minimal' else 10), 'height': 5,
            'lighting': data.get('lighting') or preset['lighting'], 'seed': data.get('seed') if data.get('seed') is not None else 42,
            'palette': {'wall': preset['wall'], 'floor': preset['floor'], 'accent': data['accent'], 'sign': '#172334'}}


@require_POST
def builder_preview(request):
    data = request.POST.copy()
    data['name'] = data.get('name', '').strip() or '你的新展馆'
    form = StoreCreateForm(data)
    if not form.is_valid():
        return JsonResponse({'errors': form.errors}, status=400)
    values = form.cleaned_data
    source = values.get('source_store')
    products = source.products.filter(is_active=True)[:12] if source else []
    spec = make_scene_spec(values['name'], 'preview', values['factory'], values['template'], config_from_form(form), products)
    return JsonResponse(spec)


def builder(request):
    stores = published_stores()
    if request.method == 'POST':
        form = StoreCreateForm(request.POST)
        if form.is_valid():
            with transaction.atomic():
                data = form.cleaned_data
                name, factory = data['name'].strip(), data['factory']
                base = slugify(name) or f'{factory.slug}-store-{uuid.uuid4().hex[:6]}'
                slug, suffix = base, 2
                while Store.objects.filter(slug=slug).exists():
                    slug, suffix = f'{base}-{suffix}', suffix + 1
                store = Store.objects.create(factory=factory, name=name, slug=slug, template=data['template'],
                                             config=config_from_form(form), is_published=True)
                source = data.get('source_store')
                if source:
                    for p in source.products.filter(is_active=True)[:12]:
                        Product.objects.create(store=store, name=p.name, sku=p.sku, description=p.description,
                            price=p.price, stock=p.stock, image=p.image.name, image_name=p.image_name,
                            sizes=deepcopy(p.sizes), colors=deepcopy(p.colors), is_active=True)
            messages.success(request, f'「{store.name}」已落成，返回商圈即可看到新展馆。')
            return redirect('mall:store', slug=store.slug)
    else:
        source = next((s for s in stores if s.featured_image), stores[0] if stores else None)
        form = StoreCreateForm(initial={'factory': source.factory if source else Factory.objects.first(), 'source_store': source, 'template': 'boutique',
                     'name': '星际新展馆', 'accent': '#ED9276', 'tagline': '让想象，在此发生'})
    initial_data = {f: form[f].value() for f in form.fields}
    initial_data['name'] = initial_data.get('name') or '你的新展馆'
    initial_form = StoreCreateForm(initial_data)
    if initial_form.is_valid():
        data = initial_form.cleaned_data
        source = data.get('source_store')
        scene = make_scene_spec(data['name'], 'preview', data['factory'], data['template'], config_from_form(initial_form),
                               source.products.filter(is_active=True)[:12] if source else [])
    else:
        scene = stores[0].build_scene() if stores else None
    return render(request, 'mall/builder.html', {'form': form, 'scene': scene})
