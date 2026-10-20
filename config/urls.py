from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView

admin.site.site_header = "METAMALL · 元宇宙商圈管理"
admin.site.site_title = "METAMALL 管理"
admin.site.index_title = "工厂、商品与交易运营"

urlpatterns = [
    path("favicon.ico", RedirectView.as_view(url="/static/img/favicon.svg", permanent=True)),
    path("admin/", admin.site.urls),
    path("", include("mall.urls")),
    path("", include("commerce.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
