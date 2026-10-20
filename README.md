# METAMALL · ERP 1.7 v2

基于 Django + 原生 Three.js 的元宇宙商圈 MVP：多个服装工厂、3D 虚拟店铺、
配置驱动的建店器、商品展示、购物车/下单、券码优惠券和 Django Admin。

## 当前状态

这是一个**可运行的 v2 基础版本**，已完成：

- 3 个工厂 / 3 家完整 3D 店铺（云裳制衣、极简工坊、青禾服饰）
- 商圈页：3 个可点击门面 + Three.js 场景
- 店铺页：按 `Store.config` 生成房间、招牌、商品画框、灯光
- 建店器：选择工厂/模板/品牌色，复制来源店铺商品，发布后进入商圈
- 访客购物车、结算、模拟支付、订单状态
- 券码校验/核销、库存条件扣减、取消恢复、幂等 token
- Django Admin 管理工厂/店铺/商品/订单/优惠券
- 7 个 Django 测试（下单、幂等、取消、券门槛、建店器）

下一轮迭代：建店器实时 3D 预览、商品位微调、性能优化、实机截图和 Word 报告。

## 技术栈

- Python 3.12 + Django 5.2.18
- SQLite（`transaction_mode=IMMEDIATE`，短事务 + 条件更新）
- 原生 Three.js 0.186.1（本地 vendor，无 Node/npm/Vite）
- 无 MySQL / Docker / Nginx 依赖

## 快速开始

```powershell
cd D:\Desktop\大四上\ERP\project\metamall
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo --with-admin
python manage.py runserver 127.0.0.1:8000
```

打开 <http://127.0.0.1:8000/>。

演示管理员：`admin` / `admin12345`（部署前请修改）。

## 页面

| 路径 | 说明 |
|---|---|
| `/` | 3D 商圈 + 店铺列表 |
| `/stores/yunchang-store/` | 云裳制衣 3D 店铺 |
| `/builder/` | 建店器 |
| `/cart/` | 购物车 / 结算 |
| `/admin/` | Django Admin |

## 测试

```powershell
python manage.py test
```

## 数据

`dataset/seed.json` 是演示数据集；`python manage.py seed_demo --with-admin`
可重复导入。详细字段见 `dataset/README.md`。

## 目录

```text
config/          Django 配置
mall/            Factory / Store / Product / 商圈 / 店铺 / 建店器
commerce/        Order / OrderItem / Coupon / 购物车 / 结算
templates/       Django 模板
static/js/       mall.js / store.js（Three.js ES Modules）
static/vendor/   Three.js build + OrbitControls
dataset/         seed.json
```

## 部署说明

当前版本面向本机演示。服务器部署时用用户级 venv + gunicorn + WhiteNoise +
tmux，不改共享服务器系统配置；具体见项目外层的《元宇宙商圈_方案审查与精简版MVP》。
