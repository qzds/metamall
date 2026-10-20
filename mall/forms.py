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
