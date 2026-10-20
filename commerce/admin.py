from django.contrib import admin, messages
from .models import Coupon, Order, OrderItem
from .services import cancel_order


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    readonly_fields = ('product', 'store', 'name_snapshot', 'price_snapshot', 'qty', 'size', 'color', 'line_total')

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_no', 'customer_name', 'status', 'total', 'coupon_code', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('order_no', 'customer_name', 'phone')
    inlines = [OrderItemInline]
    readonly_fields = ('order_no', 'client_token', 'created_at', 'status', 'subtotal', 'discount', 'total', 'coupon_code', 'customer_name', 'phone', 'address')
    actions = ['cancel_selected_orders']

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.action(description='取消所选订单并恢复库存/券名额')
    def cancel_selected_orders(self, request, queryset):
        count = sum(cancel_order(order) for order in queryset)
        self.message_user(request, f'已取消 {count} 笔订单并完成恢复。', messages.SUCCESS)


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'kind', 'value', 'min_spend', 'used_count', 'usage_limit', 'is_active')
    list_filter = ('kind', 'is_active', 'store')
    search_fields = ('code', 'name')
    readonly_fields = ('used_count',)
