# 数据集说明

`seed.json` 是 ERP 1.7 v2 的演示数据集，包含：

- 3 个服装工厂：云裳制衣、极简工坊、青禾服饰
- 3 家完整 3D 店铺（每家对应一个工厂）
- 12 个商品（每家 4 个，含价格、库存、尺码、颜色）
- 3 张优惠券：平台券 WELCOME30、极简工坊 MINT50、青禾服饰 QINGHE10

## 字段

- `factories[]`：`name` / `slug` / `description`
- `stores[]`：`factory` / `name` / `slug` / `template` / `config`
  - `config.palette`：墙、地板、品牌色、招牌色
  - `config.width/depth/height`、`lighting`、`tagline`、`seed`
- `products[]`：`store` / `name` / `sku` / `price` / `stock` / `sizes` / `colors`
- `coupons[]`：`code` / `kind`（fixed/percent）/ `value` / `min_spend` / 有效期 / `usage_limit` / `store`

## 导入

```bash
python manage.py seed_demo --with-admin
```

`--with-admin` 会创建演示管理员（默认 `admin` / `admin12345`，可用环境变量
`SEED_ADMIN_USERNAME`、`SEED_ADMIN_PASSWORD` 覆盖）。部署前请修改密码。

数据是虚构的，不含真实客户/订单信息。
