def cart_count(request):
    return {"cart_count": sum(int(qty) for qty in request.session.get("cart", {}).values())}
