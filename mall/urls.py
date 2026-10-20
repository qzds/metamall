from django.urls import path

from . import views

app_name = "mall"

urlpatterns = [
    path("", views.mall_index, name="index"),
    path("stores/<slug:slug>/", views.store_detail, name="store"),
    path("builder/", views.builder, name="builder"),
    path("builder/preview/", views.builder_preview, name="builder_preview"),
]
