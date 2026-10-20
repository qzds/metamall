from django.urls import path

from . import views

app_name = "commerce"

urlpatterns = [
    path("cart/", views.cart_view, name="cart"),
    path("cart/add/<int:product_id>/", views.cart_add, name="cart_add"),
    path("cart/remove/<int:product_id>/", views.cart_remove, name="cart_remove"),
    path("cart/update/<int:product_id>/", views.cart_update, name="cart_update"),
    path("coupons/preview/", views.coupon_preview, name="coupon_preview"),
    path("coupons/claim/<str:code>/", views.coupon_claim, name="coupon_claim"),
    path("checkout/", views.checkout, name="checkout"),
    path("orders/<str:order_no>/", views.order_detail, name="order"),
    path("orders/", views.order_list, name="orders"),
    path("orders/<str:order_no>/pay/", views.order_pay, name="order_pay"),
    path("orders/<str:order_no>/cancel/", views.order_cancel, name="order_cancel"),
]
