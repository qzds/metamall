# METAMALL · 元宇宙商圈（重构版 v4）

Django 5.2.18 + SQLite + 原生 Three.js r186，无 Vue/React/Node 构建。浏览器运行真实 3D 场景，所有 Three.js 模块、商品图、访客模型均本地提供。

## 直接体验

- 新版：http://10.24.116.90:3002/
- 本地预览：http://127.0.0.1:8001/
- 校园网直连不可用时：`ssh -N -L 3002:127.0.0.1:3002 40`，打开 http://localhost:3002/
- 管理后台：`/admin/`。演示账号 `admin / admin12345`。

新版使用独立目录 `/home/sean/metamall-v4-20261020` 与独立 SQLite 副本，tmux 会话 `metamall-v4`，课程演示运行 `manage.py runserver 0.0.0.0:3002 --noreload`。旧 3000 / 3001 端口保留。这里没有使用 gunicorn/WhiteNoise，也不宣称是商业生产部署。

## 展示重点

- 未来商业中庭：连续地坪、轨道顶棚、悬浮金属雕塑、品牌旗舰展厅、上层新馆、反射、星空城市与可行走访客；WASD 行走、Shift 加速、E 进店、Esc 返回全景。
- 三种建筑风格：织光庭院、零度艺廊、森屿温室。空间结构、材质、陈列与灯光均有差异。
- 可点击的立体服装陈列：选中商品、查看真实商品图片/库存、旋转示意模型、异步加购。
- 自动建店：品牌、风格、布局、宽深、灯光、装置种子、来源商品。预览和发布使用同一后端场景规范。
- 动态追加全部已发布展馆，三个种子品牌位置稳定，不会被新增店铺挤掉。
- 礼遇券领取、作用域与门槛预览、购物车改数量、下单、模拟支付、取消恢复、会话订单归属、Admin 统一取消动作。
- 高清/流畅画质切换；低配模式关闭反射/阴影/辉光并降低渲染像素比。

服装立体模型用于类别和配色示意，不是精准数字服装、AR 试穿或尺寸拟合。访客为本机控制角色，没有实现多人实时联网。

## 新环境运行

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo --with-admin
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8001
```

`seed_demo` 用于全新演示库，会更新种子商品的库存；不要对已有订单的库反复运行。已有库缺少商品图片引用时只运行 `python manage.py repair_catalog`。可选 `--archive-legacy-test` 只将精确匹配 w/rrr、没有订单引用的历史测试店改为草稿，保留其商品数据。

## 验证

```powershell
.\.venv\Scripts\python.exe manage.py test
.\.venv\Scripts\python.exe scripts/verify_concurrency.py
```

23 项 Django 测试在独立测试库运行。并发脚本使用独立临时 SQLite 文件，验证 8 请求争抢 1 库存/1 券、4 请求取消只恢复一次、同 token 双提交仅生成一单，不读写演示数据库。浏览器性能数据与 UI 记录见 `docs/验证数据/`；性能只代表记录中的机器、画布和画质条件。

## 主要文件

- `mall/scene.py`：预览与正式场景的共同配置规范。
- `static/js/world/runtime.js`：统一渲染、相机、质量、反射/阴影、生命周期。
- `static/js/world/architecture.js`：商圈门面、实时预览、正式展厅共用的建筑生成器。
- `static/js/world/garments.js`、`art.js`、`resources.js`：曲面服装、材质/静态合批、资源释放。
- `static/js/world/district.js`、`visitor.js`：商圈、角色行走、影院导览、进入过渡。
- `static/js/world/showroom.js`：三种镜头、商品拾取、预览更新；`store-core.js` 为稳定入口。
- `static/js/postfx.js`：本地 Three.js 后处理与画质降级。
- `commerce/services.py`：前台/Admin 共用的取消恢复事务。
- `docs/`：12 页 PPT/PDF、最终报告、实机截图和原始验证数据。

## 设计参考与资源来源

设计组织参考 Decentraland MVFW 2025 的中央广场/品牌展馆，以及 BOSS 的虚拟展厅案例；项目建筑、空间组合和服装示意几何由本项目编程构建，没有嵌入他人场景截图冒充实机。

- https://decentraland.org/blog/announcements/the-ultimate-guide-to-metaverse-fashion-week-2025
- https://group.hugoboss.com/en/newsroom/news/news-detail/boss-enters-metaverse-fashion-week-with-an-immersive-ai-inspired-showroom-experience
- Three.js 与本地 addons：MIT，见 `static/vendor/three/LICENSE`。
- RobotExpressive：Tomás Laulhé / Don McCurdy，CC0 1.0，见 `static/models/README.txt` 与 https://threejs.org/examples/webgl_animation_skinning_morph.html 。

## v4 实测与重构记录

详见 [架构重构记录](docs/架构重构记录_v4.md)。Chrome 155 / Iris Xe，四个公开展馆：高清静止约54.3 FPS、移动导览约45.7 FPS、流畅约59 FPS；店内约60 FPS。商圈静止反射缓存100ms，移动立即刷新；统计条件见原始JSON。12次风格重建纹理稳定28、反射目标稳定1。
