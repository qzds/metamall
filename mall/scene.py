"""One scene contract for the builder preview and published stores."""
from copy import deepcopy

from .models import TEMPLATE_DEFAULTS


STYLE_PRESETS = {
    "atelier": {"name": "织光庭院", "wall": "#E3C8B5", "floor": "#B99C85", "accent": "#ED9276", "lighting": "warm"},
    "gallery": {"name": "零度艺廊", "wall": "#B5C9DD", "floor": "#73899F", "accent": "#77D8F1", "lighting": "cool"},
    "garden": {"name": "森屿温室", "wall": "#C3D7B5", "floor": "#8B9D7C", "accent": "#A6D895", "lighting": "daylight"},
}
LAYOUTS = {"gallery", "island", "runway"}


def scene_config(template, config=None, factory_slug=""):
    cfg = deepcopy(config or {})
    defaults = TEMPLATE_DEFAULTS.get(template, TEMPLATE_DEFAULTS["boutique"])
    style = cfg.get("style") or ({"yunchang": "atelier", "jijian": "gallery", "qinghe": "garden"}.get(factory_slug))
    style = style if style in STYLE_PRESETS else ("gallery" if template == "minimal" else "atelier")
    preset = STYLE_PRESETS[style]
    dimensions = {}
    for key, lower, upper in [("width", 9, 18), ("depth", 8, 16), ("height", 4, 7)]:
        try:
            value = float(cfg.get(key, defaults[key]))
        except (TypeError, ValueError):
            value = defaults[key]
        dimensions[key] = max(lower, min(upper, value))
    palette = {"wall": preset["wall"], "floor": preset["floor"], "accent": preset["accent"], "sign": "#172334"}
    # Old v1 room colours were almost identical off-whites. Give legacy stores their
    # new architectural identity without rewriting their stored data.
    if cfg.get("style"):
        palette.update(cfg.get("palette") or {})
    lighting = cfg.get("lighting", preset["lighting"])
    if lighting not in {"warm", "cool", "daylight"}:
        lighting = preset["lighting"]
    layout = cfg.get("layout", {"atelier": "gallery", "gallery": "runway", "garden": "island"}[style])
    try:
        seed = int(cfg.get("seed", 42)) % 100000
    except (TypeError, ValueError):
        seed = 42
    return {"style": style, "layout": layout if layout in LAYOUTS else "gallery", "dimensions": dimensions,
            "palette": palette, "lighting": lighting, "seed": seed}


def product_spec(product):
    return {"id": product.id, "name": product.name, "description": product.description,
            "price": str(product.price), "stock": product.stock, "sizes": product.sizes,
            "colors": product.colors, "color": product.colors[0] if product.colors else "#D6B0A1",
            "image": product.image_url}


def build_scene_spec(store):
    return make_scene_spec(store.name, store.slug, store.factory, store.template, store.config,
                           store.products.filter(is_active=True)[:12])


def make_scene_spec(name, slug, factory, template, config, products):
    cfg = scene_config(template, config, factory.slug)
    return {"version": 2, "template": template, **cfg,
            "store": {"name": name, "slug": slug, "tagline": config.get("tagline", ""), "factory": factory.name},
            "products": [product_spec(p) for p in products]}
