# 元宇宙商圈方案审查与精简版 MVP

**ERP 课程大作业 · 题目 1.7：元宇宙商圈的设计与实现**

**阶段：方案优化（v2 修订）**

**日期：2026 年 10 月 20 日**

---

## 摘要

v1 的技术方向（Django + 原生 Three.js、程序化低模、模板化建店）基本正确，但 **MVP 范围明显过大、工作量被低估**。按 v1 分项相加约 **34–43 人天**（8 小时/人天），而两人 4 周、每周 8–10 小时实际只有 **64–80 人时，即 8–10 人天**，差 3–4 倍。必须砍功能，而不是靠“AI 加速”硬扛。

**v2 结论：**

1. **保留 3 个完整、可进入的 3D 店铺 + 3 个真实门面，支持动态创建第 4 家店。** 不再做“6 个门面、3 个完整店铺”的半成品。
2. **只做 2 个模板，但必须真正按配置生成不同场景**：尺寸、墙/地/品牌色、招牌、货架布局变体、商品位、道具种子、灯光预设都参与生成；不能只是换一张固定模板。
3. **删掉非评分核心功能**：NPC、自动导览、2D 店铺页、顾客账号、优惠券钱包/领取、商家 Django Admin、统计大屏、6 门面、3 模板、360/AR、多人、真实支付。
4. **下单/优惠券保留，但简化**：访客会话购物车、访客结算、模拟支付、订单状态、库存扣减/恢复、券码校验/核销；不做用户体系/领券钱包。
5. **SQLite 不能用 select_for_update()**（Django 官方文档确认在 SQLite 上无效）。改用 `transaction_mode=IMMEDIATE` + 条件 `UPDATE ... WHERE stock >= qty` + 行数检查 + 幂等键/唯一约束。
6. **商家权限不做“假隔离”**：MVP 只给平台管理员 Django Admin；不把 Django Admin 开放给工厂账号。若老师明确要求商家登录，再做独立商家页（按 factory 过滤）或完整实现 Admin 的 `get_queryset`/`has_*_permission`，不要默认 Admin 会隔离。
7. **实时预览不每次请求后端/重建全场景**：场景只建一次，品牌色/招牌/商品/灯光做增量更新；只有模板/尺寸变化才重建房间组；防抖 200ms。
8. **部署优先“不改共享服务器”**：venv + gunicorn + WhiteNoise + tmux + SQLite + 3000 端口；不用 root、不装 Nginx/systemd、不动系统 Python。如果 3000 不可达，用 SSH 隧道。
9. **真实工作量的现实估计：v2 约 10–13 人天。** 如果两人只能投入 8–10 人天，必须再加 1 周缓冲、提高到每周 12–15 小时，或继续砍（例如只保留 1 个模板 + 3 个配色变体）。不要承诺“4 周 8–10 小时做完 v1”。

**实际核查（不是推测）：**

- 本机 Chrome 可见窗口、ANGLE Intel Iris Xe D3D11 下，一个店铺式场景（20 个商品画框、6 个货架、80 个 instanced 衣架、3 个灯、1024 阴影、1920×1080、像素比 1.5）实测 **55.8 FPS、80 draw calls、2,616 三角形**。这是积极信号，但还不是完整商圈。
- Django 官方文档确认：SQLite 上 `select_for_update()` **无效**，不会加 `FOR UPDATE`，也不会报错；必须换方案。
- 服务器 3000 端口**尚未验证入站可达**：我尝试临时起一个 listener 时被运行环境拒绝（不允许在共享主机上暴露临时服务）。8088/8042/8000 从本机可达、UFW 关闭、3000 空闲；正式部署后必须用浏览器/curl 或 SSH 隧道验证。
- 未安装任何软件、未修改服务器；临时 WebGL 基准文件和 Chrome profile 已删除。

**工作说明：** 本阶段审查、技术核查、报告撰写与 Word 排版由 Claude（AI 助手）完成；用户提供了题目、服务器访问方式、约束和评审意见。未安装依赖、未修改服务器、未创建项目代码。

<!-- body -->

## 目录

- 1. v1 问题审查
- 2. 功能取舍与评分价值
- 3. 精简版 MVP
- 4. 系统架构与模块
- 5. 工作量与排期
- 6. 技术验证清单
- 7. 最终建议
- 8. 参考资料
- 附录 A：v1 与 v2 范围对比
- 附录 B：SQLite 事务/幂等伪代码

---

## 1. v1 问题审查

### 1.1 范围过大、工作量低估

| 项目 | v1 估算 | v2 现实估算 | 差距 |
|---|---|---|---|
| 商圈广场 + 门面 | 4–5 人天 | 2–3 人天 | 砍 NPC/导览，3 个真实门面 |
| 店铺生成器 + 3 模板 | 7–9 人天 | 3–4 人天 | 2 模板 + 配置变体，不做自由编辑器 |
| 商品画框 + 详情 | 3–4 人天 | 1.5–2 人天 | 复用同一套；不做 360/AR |
| 建站向导 + 实时预览 | 5–6 人天 | 2–3 人天 | 场景只建一次，增量更新 |
| 购物车/订单/库存 | 5–6 人天 | 2–3 人天 | 访客结算、简化状态 |
| 优惠券 | 5–6 人天 | 1.5–2 人天 | 券码校验/核销，不做领取/钱包 |
| Admin/统计 | 3–4 人天 | 1–1.5 人天 | 平台 Admin，不做统计大屏 |
| NPC/导览 | 2–3 人天 | 0 | 删除 |
| 合计 | **34–43 人天** | **10–13 人天** | 砍掉约 2/3 的工作量 |

- 两人 4 周 × 8–10 小时/周 = 64–80 人时 = **8–10 人天**（按 8 小时/人天）。
- v1 的 34–43 人天需要约 17–21 周 × 8–10 小时/周，或 4 周 × 约 34–43 小时/周/两人；不现实。
- AI 辅助能减少样板代码时间约 20–30%，但 3D 视觉迭代、测试、部署、报告、答辩准备不会同比减少；不能把 34 人天压到 8 人天。
- **影响：** 如果按 v1 做，最可能的结果是“广场有了、店铺没做完、下单/优惠券半成品”，演示和报告都吃亏。
- **修改：** 采用 v2 的 3 店/2 模板/访客结算/平台 Admin 方案；把省下的时间投入“店铺生成器真实差异化”和“端到端演示”。

### 1.2 与课程原题偏差

| v1 问题 | 影响 | v2 修改 |
|---|---|---|
| 6 个门面、只有 3 个完整店铺 | 老师看到“多个工厂”，但一半门面进不去，像半成品 | **3 个工厂、3 个完整店铺、3 个真实门面**；动态创建第 4 家店 |
| 模板可能只是固定场景切换 | 不能证明“自动建站”能力 | 生成参数化：尺寸/墙地色/品牌色/招牌/布局变体/商品位/道具种子/灯光；每店实际不同 |
| 2D 店铺页、商家中心、统计大屏 | 分散时间，不是原题核心 | 删除 2D 店铺页/统计大屏；建站器面向平台管理员演示 |
| 顾客账号/领券钱包 | 增加认证/权限/UI 工作 | 访客结算 + 券码；不做账号/钱包 |

**v2 的“多工厂”定义：** 3 个种子工厂各 1 家完整店铺；演示时用建站器创建第 4 个工厂/店铺，商圈出现第 4 个门面。满足“多个服装工厂，每个工厂一个 3D 虚拟店铺”，且所有门面都能进。

### 1.3 技术实现问题

#### 1.3.1 SQLite 的 select_for_update()

**核查结果（Django 5.2 官方文档）：**

> “Using `select_for_update()` on backends which do not support `SELECT ... FOR UPDATE` (such as SQLite) will have no effect. `SELECT ... FOR UPDATE` will not be added to the query, and an error isn’t raised if `select_for_update()` is used in autocommit mode.”

**影响：** v1 写的“SQLite 下退化为库锁”是错误表述；它不是“退化为库锁”，而是**完全无效**。高并发下可能超卖/重复核销。

**v2 方案：**

- `DATABASES['default']['OPTIONS'] = {"timeout": 20, "transaction_mode": "IMMEDIATE"}`；短事务；WAL（可选）。
- 库存扣减用条件更新 + 行数检查：
```python
updated = Product.objects.filter(pk=pid, stock__gte=qty).update(stock=F("stock") - qty)
if updated != 1:
    raise OutOfStock(...)
```
- 优惠券核销用条件更新：
```python
updated = Coupon.objects.filter(pk=cid, used_count__lt=F("usage_limit")).update(used_count=F("used_count") + 1)
if updated != 1:
    raise CouponExhausted(...)
```
- 订单幂等：`Order.client_token` 唯一；重复提交返回已有订单；订单号用 UUID。
- 取消订单：状态机只允许 `pending/paid -> cancelled`；恢复库存、回退 `used_count`；重复取消不重复恢复。
- 不设置 `ATOMIC_REQUESTS=True`（Django 文档明确：IMMEDIATE 模式下不建议，因为事务可能过长）。
- 事务内不做 LLM/HTTP 调用；只做数据库操作。
- 测试：双提交、超卖、券超限、取消恢复、重复取消。

#### 1.3.2 Django Admin 商家权限

**核查结果：** Django Admin 默认是全局的；`staff` + model 权限只能控制“能不能改某类模型”，不会自动按 factory 过滤数据。只给商家 `is_staff=True` 而不做对象级过滤，商家能看到/改到别家数据。

**v2 决策（按工作量排序）：**

| 方案 | 工作量 | 风险 | 建议 |
|---|---|---|---|
| A. 只给平台管理员 Admin，不做商家登录 | 0 | 低 | **MVP 推荐** |
| B. 独立商家页，查询按 `request.user.factory` 过滤 | +1–2 人天 | 中 | 老师要求商家登录时再做 |
| C. 商家用 Django Admin，完整实现 `get_queryset`/`has_*`/`formfield_for_foreignkey`/`save_model` + 测试 | +1–2 人天 | 高（容易漏） | 不推荐，除非明确要求 |

**如果做 C，必须：**

- `get_queryset(request)`：superuser 全量；否则 `Store.objects.filter(factory=request.user.factory)` / `Product.objects.filter(store__factory=...)` / `Order.objects.filter(items__store__factory=...).distinct()`。
- `has_view/change/delete/add_permission(obj)`：对象所属 factory 必须等于当前用户 factory；新增时强制 factory。
- `formfield_for_foreignkey`：Store/Product/Factory 下拉只给自家。
- `save_model`：强制 `factory=request.user.factory`，不信任表单隐藏字段。
- 订单明细/优惠券同样过滤；平台券只读。
- 测试：A 商家直接访问 B 的 store/product/order 的 change URL 必须 404/403。

#### 1.3.3 实时预览每次重建整个场景

**v1 问题：** 表单每变一次就 POST 后端、返回整份 JSON、`buildStore(spec)` 全量重建；输入品牌名/颜色都会重新编译材质、重建纹理、GC 抖动，体验差且浪费时间。

**v2 方案：**

- 场景只初始化一次；保存对房间、材质、招牌 CanvasTexture、商品画框、灯光的引用。
- 品牌色变化：改 `material.color/emissive`，重绘招牌 CanvasTexture；不重建场景。
- Logo/店名：只重绘招牌纹理。
- 商品勾选：增量添加/移除商品画框，更新贴图；不重建房间。
- 灯光预设：改 light.color/intensity/position。
- 模板/尺寸变化：只 dispose 并重建“房间组”，保留商品/灯光/控制器。
- 表单 `input` 防抖 200ms；不需要每次请求后端。
- 预览接口只在“切换模板”或“点击生成预览”时调用；发布时再 POST 最终配置。
- **单一几何来源：** 模板 JSON + 前端 `buildStore(config)` 作为几何生成唯一实现；Python 负责校验/存储配置；发布后前端用同一函数重新生成。这样不会出现“预览一套、正式一套”的漂移。

#### 1.3.4 场景切换/资源释放

- **优先多页导航**：商圈页 `/mall/`、店铺页 `/stores/{slug}/`；页面跳转由浏览器回收 WebGL 上下文，最简单、最稳。
- 预览重建时：遍历旧 group，dispose geometry/material/texture/renderTarget；取消 `requestAnimationFrame`、移除 resize/pointer/keydown 监听；清空计时器；PMREM render target 也要 dispose。
- 不做“每个店铺缓存一个场景”；只保留当前场景，避免显存/内存累积。
- 测试：商圈→店铺→商圈 10 次，`renderer.info.memory` 和 Chrome 任务管理器不持续增长。

#### 1.3.5 重复订单/优惠券核销

- 订单：`client_token` 唯一 + 事务；重复点击/刷新返回同一订单，不重复扣库存。
- 订单号：UUID/ULID，避免日期+随机数碰撞。
- 优惠券：`code` 唯一；`used_count` 条件更新；订单保存券码/折扣快照；取消订单回退。
- 订单状态机：只允许合法转换；取消/支付重复请求幂等。
- 测试用例：双击提交、网络重试、券最后一张并发、取消后再取消。

#### 1.3.6 其他过度设计

| 过度设计 | 处理 |
|---|---|
| 6 个门面/3 个完整店铺 | 3 个真实门面/3 个完整店铺 + 动态第 4 家 |
| 3 个模板 | 2 个模板 + 尺寸/配色/布局变体 |
| NPC/自动导览 | 删除；用静态道具/灯光营造氛围 |
| 2D 店铺页 | 删除；商品详情用 HTML 面板 |
| 顾客账号/领券钱包/批量发券 | 删除；券码校验/核销 |
| 商家 Django Admin/商家中心 | MVP 只做平台 Admin；商家登录为 stretch |
| Chart.js 统计大屏 | 删除；Admin 列表/订单总额足够 |
| Nginx/systemd/root 部署 | 改用户级 venv + gunicorn + tmux + 3000 |
| 360/AR/多人/真实支付 | 不做 |
| 自由拖拽 3D 编辑器 | 不做；模板向导 + 自动布局 |

### 1.4 机器与部署可行性

**已实测：**

- WebGL 场景（店铺式）：**55.8 FPS、80 draw calls、2,616 三角形**；1920×1080、像素比 1.5、1024 阴影、3 个灯、20 个商品画框、6 个货架、80 个 instanced 衣架。
- 渲染器：`ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A0) Direct3D11 vs_5_0 ps_5_0, D3D11)`。
- 结论：Iris Xe 跑“低模店铺”没问题；但这不是完整商圈（3 门面 + 多店铺 + glTF 道具），仍需在原型阶段测完整场景。

**未验证：**

- 服务器 3000 端口入站可达性：尝试临时 listener 被运行环境拒绝（不允许在共享主机上暴露临时服务）；8088/8042/8000 可达、UFW 关闭、3000 空闲。**正式部署后必须实测**，否则用 SSH 隧道。
- 完整商圈 + 3 店铺 + 商品交互的 FPS/内存。
- SQLite 并发下的 `database is locked` 频率；课程规模预计没问题，但要测试。
- 本地内存：检测时可用 0.54 GB；开发/演示前关闭 Word/微信/多余标签。

### 1.5 其他风险

- **SQLite 并发**：写入串行；用 `IMMEDIATE`、短事务、timeout；不要做高并发演示。
- **媒体文件**：生产环境 WhiteNoise 不服务 `media/`；用 Django 小视图或把种子图片放 `static/`。
- **中文字体**：CanvasTexture 招牌要在 `document.fonts.ready` 后绘制；否则中文可能变方块。
- **离线演示**：Three.js/Bootstrap 本地 vendor，不依赖 CDN。
- **资产许可证**：CC0/MIT/Apache；保留 `THIRD_PARTY_NOTICES.md`。
- **共享服务器**：不装 Nginx/systemd/apt；只跑用户级进程；提前确认政策。
- **评分风险**：3D 视觉是主观项；v2 用“真实配置生成 + 3 个完整店铺 + 稳定演示”换分数，不靠 NPC/大屏堆料。

---

## 2. 功能取舍与评分价值

| 功能 | 课程要求 | 评分价值 | 工作量 | v2 |
|---|---|---|---|---|
| 3 个完整 3D 店铺（3 工厂） | 必须 | 高 | 中 | **保留** |
| 商圈广场 + 3 个真实门面 | 必须 | 高 | 中 | **保留** |
| 配置驱动的店铺生成（真差异化） | 题目核心 | **最高** | 中 | **保留，重点投入** |
| 动态创建第 4 家店 | 加分/证明建站器 | 高 | 中 | **保留** |
| 商品展示 + HTML 详情 | 必须 | 高 | 低 | **保留** |
| 购物车/下单/库存 | 加分 | 高 | 中 | **保留（访客）** |
| 优惠券（券码） | 加分 | 中高 | 低–中 | **保留（简化）** |
| 平台 Admin | 必须 | 中 | 低 | **保留** |
| 2 个模板 + 配色/布局变体 | 支撑建站器 | 中 | 低 | **保留** |
| 订单状态/取消恢复 | 业务完整 | 中 | 低 | **保留** |
| 商家登录/数据隔离 | 题目未明确要求 | 中 | 中 | stretch |
| 优惠券领取/钱包 | 加分但可替代 | 低–中 | 中 | 删除 |
| 统计大屏/Chart.js | 非核心 | 低 | 中 | 删除 |
| NPC/自动导览 | 氛围 | 低–中 | 中 | 删除 |
| 2D 店铺页 | 兜底 | 低 | 中 | 删除 |
| 6 门面/3 模板 | 堆量 | 低 | 高 | 删除 |
| 360/AR/多人/真实支付 | 非要求 | 低 | 高 | 删除 |

**最能体现特色的三件事：**

1. **真正按配置生成不同 3D 店铺**（不是换固定模板）：尺寸、品牌色、招牌、布局变体、商品位、道具种子都不同。
2. **3 个工厂/3 个完整店铺 + 现场创建第 4 家**：直接对应原题“多个服装工厂，每个一个 3D 虚拟店铺”。
3. **端到端业务闭环**：进店→看商品→加购→用券→下单→后台看订单/库存变化；不用做复杂电商。

---

## 3. 精简版 MVP

### 3.1 范围

1. **3 个工厂/3 个店铺/3 个门面**：全部可进入；每店 4–6 个商品；2 个模板（boutique/minimal）+ 尺寸/配色/布局变体。
2. **商圈**：广场、3 个门面、招牌、第一人称 + 环视、AABB 碰撞、点击/靠近进入；无 NPC/导览。
3. **店铺**：程序化房间、货架、商品画框、招牌、灯光；点击商品弹出 HTML 详情；加入购物车。
4. **建站器**：3 步表单（品牌、模板/配色、商品）+ 增量实时预览 + 发布；新店成为第 4 个门面；配置真正影响场景。
5. **交易**：会话购物车、访客结算、模拟支付、订单状态（pending/paid/cancelled）、库存扣减/取消恢复、UUID 订单号、幂等键。
6. **优惠券**：券码、满减/折扣、最低消费、有效期、总使用上限、店铺/平台范围；结算校验/核销；Admin 创建。
7. **后台**：平台管理员 Django Admin 管理工厂/店铺/商品/订单/优惠券；不做商家 Admin/统计大屏。
8. **部署**：本机 + 服务器用户级 venv/gunicorn/WhiteNoise/tmux/3000/SQLite；不改共享服务器配置。

### 3.2 验收标准

- 3 个种子店 + 1 个现场新建店均可进入；每个门面都有对应店铺。
- 新建店与种子店在尺寸/配色/招牌/布局/商品上明显不同（截图对比）。
- 从进店到下单 ≤5 次点击；券码错误提示明确；订单/库存/券核销一致。
- 双击提交/刷新不产生重复订单；取消订单只恢复一次库存；券不超过使用上限。
- 1920×1080、Iris Xe：完整商圈/店铺 ≥30 FPS，目标 45+；首屏 <5 秒。
- 服务器 3000 可访问（校园网或 SSH 隧道）；README 有建库/种子/启动说明。
- 3 分钟演示视频 + 8 张截图 + 事务/并发测试表。

### 3.3 不做清单

- 6 个门面、3 个模板、NPC、自动导览、2D 店铺页、顾客账号、优惠券钱包/领取、商家 Django Admin、统计大屏。
- 360/AR、多人、真实支付、自由拖拽 3D 编辑器、布料物理。
- Nginx/systemd/apt/root 部署（本阶段不碰共享服务器配置）。

---

## 4. 系统架构与模块

### 4.1 架构

```text
浏览器（Chrome/Edge）
  ├─ Django 模板 + Bootstrap + 自定义 CSS
  ├─ Three.js ES Modules：engine.js / mall.js / store.js / builder.js
  └─ fetch JSON + CSRF
        │ HTTP :3000
服务器 40（用户级）
  ├─ gunicorn + WhiteNoise + Django 5.2 LTS
  ├─ mall：Factory / Store / Product / 场景 JSON
  ├─ commerce：Order / OrderItem / Coupon / 会话购物车
  ├─ merchant：建站向导（平台管理员）
  ├─ admin：平台 Admin
  └─ SQLite db.sqlite3 + static/media
```

### 4.2 数据模型（精简）

| 模型 | 关键字段 | 说明 |
|---|---|---|
| Factory | name、slug、description、logo | 3 个种子工厂 |
| Store | factory、name、slug、template、config(JSON)、is_published | config 含尺寸/配色/布局/商品/灯光/种子 |
| Product | store、name、sku、price、stock、image、sizes、colors、is_active | 4–6 个/店 |
| Order | order_no、client_token(unique)、status、subtotal、discount、total、name、phone、address、created_at | 访客订单 |
| OrderItem | order、product、store、name_snapshot、price_snapshot、qty、size、color | 快照 |
| Coupon | code(unique)、type、value、min_spend、valid_from/to、usage_limit、used_count、store、is_active | 券码 |

**删除的模型：** StoreTemplate（改为 JSON/Python 配置）、Customer/Profile、Cart/CartItem（session）、CouponClaim（券码直接核销）。

### 4.3 模块/文件

```text
config/                 settings/urls/wsgi
mall/                   Factory/Store/Product、场景 JSON、seed_demo
commerce/               Order/OrderItem/Coupon、购物车/结算/券
merchant/               建站向导（平台管理员）
templates/              mall/store/builder/cart
static/js/engine.js     渲染器/相机/控制/碰撞/资源释放
static/js/mall.js       广场/门面/进入
static/js/store.js      店铺生成/商品交互
static/js/builder.js    建站表单/增量预览/发布
static/vendor/three/    build + examples/jsm
store_templates.json    模板布局/槽位/灯光配置
```

### 4.4 API（约 7 个）

| 方法/路径 | 用途 |
|---|---|
| GET `/api/mall/scene/` | 商圈场景 |
| GET `/api/stores/{slug}/scene/` | 店铺场景 |
| POST `/api/builder/preview/` | 仅模板切换/点击生成预览时调用 |
| GET/POST `/api/cart/` | 会话购物车 |
| POST `/api/coupons/validate/` | 券码校验 |
| POST `/api/orders/` | 创建订单（幂等） |
| GET `/api/orders/{order_no}/` | 订单状态 |

### 4.5 实时预览（增量更新）

- 初始化：`scene = createStoreScene(config)`；保存 `roomGroup`、`signTexture`、`productFrames`、`lights`。
- 品牌色：更新材质颜色 + 重绘招牌 CanvasTexture；不重建。
- Logo/店名：只重绘招牌。
- 商品：增删画框/贴图；不重建房间。
- 灯光：改 intensity/color。
- 模板/尺寸：dispose `roomGroup`，重建房间组。
- 防抖 200ms；无后端请求；发布时 POST 最终 config。
- 单一几何实现：`buildStore(config)` 在 JS；Python 只校验/存储；发布后用同一函数生成。

### 4.6 SQLite 事务与幂等

**配置：**

```python
DATABASES = {
  "default": {
    "ENGINE": "django.db.backends.sqlite3",
    "NAME": BASE_DIR / "db.sqlite3",
    "OPTIONS": {"timeout": 20, "transaction_mode": "IMMEDIATE"},
  }
}
```

**下单（伪代码）：**

```python
with transaction.atomic():
    # 1. 幂等：client_token 唯一；已存在直接返回
    try:
        order = Order.objects.create(client_token=token, order_no=uuid4().hex, ...)
    except IntegrityError:
        return Order.objects.get(client_token=token)

    # 2. 扣库存：条件更新 + 行数检查
    for item in items:
        n = Product.objects.filter(pk=item.product_id, stock__gte=item.qty)\
                           .update(stock=F("stock") - item.qty)
        if n != 1:
            raise OutOfStock(item.product_id)

    # 3. 券核销：条件更新
    if coupon:
        n = Coupon.objects.filter(pk=coupon.pk, used_count__lt=F("usage_limit"))\
                          .update(used_count=F("used_count") + 1)
        if n != 1:
            raise CouponExhausted
```

- 事务内只做 DB；不调用外部 API。
- 取消：`filter(pk=..., status__in=["pending","paid"]).update(status="cancelled")`；行数=1 才恢复库存/回退券。
- 不做 `select_for_update()`；不设 `ATOMIC_REQUESTS=True`。
- 测试：双击、重试、超卖、券最后一张、取消两次。

### 4.7 资源释放

- 多页导航：商圈/店铺分页，浏览器回收上下文。
- 预览重建：`disposeGroup(oldGroup)` 遍历 dispose geometry/material/texture；清空引用；取消 RAF/监听/计时器；PMREM dispose。
- 只保留一个活动场景；不做多店缓存。
- 测试：商圈→店铺→商圈 10 次，内存不持续增长。

### 4.8 权限决策

- **MVP：平台管理员 Admin；不做商家登录。** 建站器由管理员演示，避免“假隔离”。
- 若老师要求商家登录：优先独立商家页（`factory=request.user.factory` 过滤）；不建议把 Django Admin 直接给商家。若必须用 Admin，按 1.3.2 的 C 方案完整实现并测试。

### 4.9 部署（不改共享服务器）

```bash
ssh 40
python3 -m venv ~/venvs/metamall
source ~/venvs/metamall/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py collectstatic --noinput
gunicorn config.wsgi:application --bind 0.0.0.0:3000 --workers 2 --threads 2
```

- 用 `tmux` 保持进程；`WhiteNoise` 服务静态；SQLite；媒体用 Django 小视图。
- 不用 root、不装 Nginx/systemd、不 apt；不修改系统 Python。
- 访问：校园网/VPN `http://10.24.116.90:3000`；或 `ssh -N -L 3000:127.0.0.1:3000 40` + `localhost:3000`。
- 3000 入站未验证；部署后先 `curl`；若不通，用隧道。
- 共享集群：不动 8000/8030-8042/8088/9000；不重启；磁盘 61 GB，资产 <100 MB。

---

## 5. 工作量与排期

### 5.1 现实工作量

| 任务 | 乐观（人天） | 现实（人天） |
|---|---|---|
| 项目骨架/模型/Admin/seed | 1.5 | 2 |
| 3D 引擎/商圈/3 店铺/控制/碰撞 | 3 | 4 |
| 店铺生成器/增量预览/发布 | 2 | 3 |
| 购物车/订单/库存/优惠券 | 2 | 3 |
| 部署/测试/截图/视频/报告 | 1.5 | 2 |
| **合计** | **10** | **14** |

- 可用 8–10 人天，现实 10–14 人天；**必须加 1 周缓冲或提高到每周 12–15 小时**。
- AI 可把编码压 20–30%，但视觉/测试/报告不减少；不要按“AI 全自动”估。
- 如果只能 8–10 人天：把模板减到 1 个 + 3 个配色/布局变体；订单只保留 pending/paid；优惠券只做满减；商品减到 4 个/店；仍保留 3 个完整店铺和建站器。

### 5.2 4 周 + 1 周缓冲

| 周次 | A（后端/数据） | B（3D/前端） | 里程碑 |
|---|---|---|---|
| 第 1 周 | 模型/Admin/seed；3 个 Store config；场景 API | Three.js 店铺壳 + 商品画框 + 第一人称；FPS 基准 | 1 个可走店铺 + 3 份配置 + 实测 FPS |
| 第 2 周 | 订单/库存/券模型；购物车/下单 API；幂等/事务测试 | 商圈 3 门面 + 进入店铺；3 店生成；商品详情 | 3 个完整店铺可进、可看商品 |
| 第 3 周 | Admin 订单/券；库存/券并发测试；seed 数据 | 建站器增量预览/发布；第 4 家店；购物车/结算 UI | 建店→逛店→用券→下单闭环 |
| 第 4 周 | 部署（用户级）/备份/README | 性能/资源释放/截图/视频 | 可演示版本 + 在线地址 |
| 第 5 周 | 修 bug/测试/报告数据 | 视觉/录屏/排版 | 最终提交 |

### 5.3 两人分工

| 角色 | 负责 |
|---|---|
| A：Django/数据/事务/部署 | 模型、Admin、订单/库存/券、幂等/事务测试、seed、服务器用户级部署、备份 |
| B：Three.js/交互/建站器/演示 | 引擎、商圈、店铺生成、增量预览、商品交互、UI、性能、截图/视频 |
| 共同 | 场景 JSON 契约、3 店配置、端到端联调、报告统稿 |

### 5.4 范围再砍顺序

1. 第 2 个模板（保留 1 模板 + 3 配色/布局变体）。
2. 订单状态（只 pending/paid，取消用 Admin 操作）。
3. 优惠券类型（只满减，不做百分比）。
4. 商品数（6→4/店）。
5. 商圈装饰（喷泉/长椅/导览牌减少）。
6. **不能砍**：3 个完整店铺、3 个门面、配置驱动生成、商品展示、下单、券、部署。

---

## 6. 技术验证清单

### 6.1 已核查/已实测

| 项目 | 结果 | 结论 |
|---|---|---|
| Iris Xe WebGL 店铺式场景 | 55.8 FPS、80 calls、2,616 triangles、1920×1080、pixelRatio 1.5、1024 阴影、3 灯 | 低模店铺可行；完整商圈仍需测 |
| 渲染器 | ANGLE Intel Iris Xe D3D11（硬件加速） | 不是 SwiftShader |
| SQLite `select_for_update()` | Django 5.2 文档：SQLite 上无效 | 必须用条件更新/幂等 |
| SQLite 事务模式 | 支持 `transaction_mode=IMMEDIATE`、`timeout` | 可降低 `database is locked` |
| 服务器 8088/8042/8000 | 本机可达 | 校园网/VPN 入站通 |
| 服务器 3000 | 未验证（临时 listener 被拒绝） | 部署后必须测；否则 SSH 隧道 |
| 本机内存 | 可用 0.54 GB | 开发/演示前关应用 |
| 本地安装 | 未安装任何软件 | 符合只读调研约束 |

### 6.2 正式开发前必须验证

| # | 验证 | 通过标准 | 方法 |
|---|---|---|---|
| 1 | 完整商圈 + 3 店铺 FPS | ≥30 FPS，目标 45+ @1080p | 原型 + stats.js |
| 2 | draw calls/三角形 | <100 calls、<80k triangles | renderer.info |
| 3 | 3 店差异化 | 尺寸/配色/布局/商品明显不同 | 截图对比 |
| 4 | 建站器增量预览 | 改色/改名/换商品不卡顿、不重建全场景 | 200ms 防抖 + 手动测试 |
| 5 | 资源释放 | 10 次切换内存不持续增长 | renderer.info/任务管理器 |
| 6 | 下单幂等/超卖 | 双击/重试只 1 单；库存不为负 | 单元/并发脚本 |
| 7 | 券核销上限 | 最后一张不被超用；取消回退 | 单元测试 |
| 8 | 服务器 3000 | 浏览器/curl 可达 | 部署后测试；否则隧道 |
| 9 | 离线资产 | 断网可打开商圈/店铺 | 本地 vendor，无 CDN |
| 10 | 中文招牌 | 无方块/错字 | document.fonts.ready + CanvasTexture |
| 11 | Admin 权限（若做商家） | A 不能看/改 B | 直接 URL 测试 |
| 12 | 媒体/静态 | 图片/Logo 正常 | DEBUG=False + WhiteNoise/视图 |

### 6.3 WebGL 基准详情

- 场景：14×12 m 店铺、20 个商品画框（40 draw calls）、6 个货架、80 个 instanced 衣架、地面/三面墙、3 个灯（1 个 1024 阴影）、ACES 色调映射、1920×1080 CSS、pixelRatio 1.5。
- 结果：55.8 FPS、80 draw calls、2,616 triangles。
- 局限：没有 glTF 角色/复杂道具、没有 3 个门面/多店铺、没有 Bloom/SSAO；完整场景需重新测。
- 结论：**低模店铺可行**；不要加实时反射/SSAO/多阴影/高模；保持 <100 calls。

---

## 7. 最终建议

- **v2 是现实可完成的版本；v1 的范围在 4 周 × 8–10 小时下做不完。**
- **把时间集中到“配置驱动生成 + 3 个完整店铺 + 端到端闭环”**，这是评分和演示的核心；不要做 NPC/大屏/商家权限/2D 店铺页。
- **Django + 原生 Three.js 仍是最省事的选择**：无 Node 构建、AI 代码语料最多、与 Django 模板/Admin 直接集成。R3F 只在两人都熟 React 时考虑；Babylon 只在需要内置物理/编辑器时考虑，本项目不需要。
- **SQLite 事务按 v2 重写**；不要用 `select_for_update()`；用条件更新/幂等/唯一约束；测试双击/超卖/券上限。
- **部署优先用户级**：venv + gunicorn + WhiteNoise + tmux + 3000；不改共享服务器；3000 不通就 SSH 隧道。
- **下一步：批准 v2 后，做 1 天尖峰**：3 个店铺配置 + 完整商圈 FPS + 服务器 3000 测试 + 增量预览。尖峰通过再全面开发；不通过就按 5.4 继续砍。
- 如果你们更看重“稳拿分”而不是 3D 演示，1.5 仍是风险更低的选择；但 v2 让 1.7 在现有投入下变得可行。

---

## 8. 参考资料

- Django `select_for_update()`：https://docs.djangoproject.com/en/5.2/ref/models/querysets/#select-for-update
- Django SQLite notes：https://docs.djangoproject.com/en/5.2/ref/databases/#sqlite-notes
- Django transactions：https://docs.djangoproject.com/en/5.2/topics/db/transactions/
- Three.js：https://threejs.org/
- Three.js PointerLockControls：https://threejs.org/docs/#examples/en/controls/PointerLockControls
- Django Admin：https://docs.djangoproject.com/en/5.2/ref/contrib/admin/
- SQLite WAL：https://www.sqlite.org/wal.html
- v1 报告：同目录 `元宇宙商圈_技术调研与可行性分析.md`

---

## 附录 A：v1 与 v2 范围对比

| 项目 | v1 | v2 |
|---|---|---|
| 门面/店铺 | 6 门面/3 完整店铺 | 3 门面/3 完整店铺 + 动态第 4 家 |
| 模板 | 3 | 2 + 尺寸/配色/布局变体 |
| 商品/店 | 4–6 | 4–6 |
| NPC/导览 | 有 | 无 |
| 2D 店铺页 | 有 | 无 |
| 顾客账号 | 有 | 无（访客结算） |
| 优惠券 | 领取/钱包/核销 | 券码校验/核销 |
| 商家 Admin | 有（需隔离） | 无（平台 Admin） |
| 统计大屏 | 有 | 无 |
| 部署 | Nginx/systemd/root | 用户级 venv/gunicorn/tmux |
| 工作量 | 34–43 人天 | 10–14 人天 |

## 附录 B：SQLite 事务/幂等伪代码

```python
from django.db import transaction, IntegrityError
from django.db.models import F
from uuid import uuid4

def create_order(client_token, items, coupon=None, address=None):
    with transaction.atomic():
        try:
            order = Order.objects.create(
                client_token=client_token,
                order_no=uuid4().hex,
                status="pending",
                total=0,
                address=address,
            )
        except IntegrityError:
            return Order.objects.get(client_token=client_token), False

        subtotal = 0
        for item in items:
            n = Product.objects.filter(
                pk=item["product_id"], stock__gte=item["qty"]
            ).update(stock=F("stock") - item["qty"])
            if n != 1:
                raise ValueError("库存不足")
            product = Product.objects.get(pk=item["product_id"])
            OrderItem.objects.create(
                order=order,
                product=product,
                store=product.store,
                name_snapshot=product.name,
                price_snapshot=product.price,
                qty=item["qty"],
                size=item.get("size", ""),
                color=item.get("color", ""),
            )
            subtotal += product.price * item["qty"]

        discount = 0
        if coupon:
            n = Coupon.objects.filter(
                pk=coupon.pk, used_count__lt=F("usage_limit")
            ).update(used_count=F("used_count") + 1)
            if n != 1:
                raise ValueError("优惠券已用完")
            discount = coupon.calculate_discount(subtotal)

        order.subtotal = subtotal
        order.discount = discount
        order.total = subtotal - discount
        order.save(update_fields=["subtotal", "discount", "total"])
        return order, True
```

> 说明：这是方案伪代码，不是可直接运行的项目代码；正式开发时补表单校验、券规则、事务边界和单元测试。

---

**报告结束**

> 本文件是 v2 方案审查，不包含项目代码。正式开发前请先批准范围，并执行 6.2 的验证清单。
