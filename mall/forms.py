import re

from django import forms

from .models import Factory, Store


HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


class StoreCreateForm(forms.Form):
    factory = forms.ModelChoiceField(queryset=Factory.objects.all(), label="所属工厂")
    name = forms.CharField(max_length=80, label="店铺名称")
    template = forms.ChoiceField(choices=Store.TEMPLATE_CHOICES, label="店铺模板")
    accent = forms.CharField(max_length=7, initial="#B23A48", label="品牌色")
    tagline = forms.CharField(max_length=120, required=False, label="品牌标语")
    style = forms.ChoiceField(choices=[("atelier", "织光庭院 · 暖金与拱廊"), ("gallery", "零度艺廊 · 冷银与悬浮"), ("garden", "森屿温室 · 木作与植物")], initial="atelier", required=False, label="空间风格")
    layout = forms.ChoiceField(choices=[("gallery", "画廊式 · 一字陈列"), ("island", "岛屿式 · 环绕展台"), ("runway", "秀场式 · 两侧陈列")], initial="gallery", required=False, label="陈列布局")
    width = forms.FloatField(min_value=9, max_value=18, initial=12, required=False, label="空间宽度（米）", widget=forms.NumberInput(attrs={"step": "0.5"}))
    depth = forms.FloatField(min_value=8, max_value=16, initial=10, required=False, label="空间进深（米）", widget=forms.NumberInput(attrs={"step": "0.5"}))
    lighting = forms.ChoiceField(choices=[("warm", "日落暖光"), ("cool", "极光冷光"), ("daylight", "自然天光")], initial="warm", required=False, label="灯光氛围")
    seed = forms.IntegerField(min_value=0, max_value=99999, initial=42, required=False, label="装置种子")
    source_store = forms.ModelChoiceField(
        queryset=Store.objects.filter(is_published=True),
        required=False,
        label="复制商品来源（可选）",
        help_text="选择一家已有店铺，把商品复制到新店作为起点。",
    )

    def clean_accent(self):
        value = self.cleaned_data["accent"].strip()
        if not HEX_COLOR.match(value):
            raise forms.ValidationError("请填写 #RRGGBB 格式的颜色。")
        return value.upper()
