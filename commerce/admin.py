from django.contrib import admin

from .models import Coupon, Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("line_total",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_no", "customer_name", "status", "total", "coupon_code", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("order_no", "customer_name", "phone", "client_token")
    inlines = [OrderItemInline]
    readonly_fields = ("order_no", "client_token", "created_at")


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "kind", "value", "min_spend", "used_count", "usage_limit", "is_active")
    list_filter = ("kind", "is_active", "store")
    search_fields = ("code", "name")
