"""Build course handouts from real browser captures (document tooling only)."""
from pathlib import Path
import json
import shutil
from datetime import datetime

from PIL import Image, ImageOps, ImageDraw, ImageFont
from docx import Document
from docx.shared import Inches as DI, Pt as DP, Cm
from docx.enum.section import WD_SECTION_START
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
CAP = ROOT / 'output' / 'playwright'
ASSETS = DOCS / 'screenshots'
DATA = DOCS / '验证数据'
BACKUP = ROOT / 'output' / 'backups' / 'before-v4-materials'
TITLE = '元宇宙商圈_课程汇报'
REPORT = '侯福宽ERP课程作业报告'
SITE = 'http://10.24.116.90:3002/'
DATE = '2026-10-20'
FONT = 'Microsoft YaHei'
REF1 = 'https://decentraland.org/blog/announcements/the-ultimate-guide-to-metaverse-fashion-week-2025'
REF2 = 'https://group.hugoboss.com/en/newsroom/news/news-detail/boss-enters-metaverse-fashion-week-with-an-immersive-ai-inspired-showroom-experience'


def prepare():
    BACKUP.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(exist_ok=True)
    DATA.mkdir(exist_ok=True)
    for p in DOCS.glob(TITLE + '.*'):
        target = BACKUP / p.name
        if not target.exists():
            shutil.copy2(p, target)
    for p in ASSETS.iterdir():
        if p.is_file() and not (BACKUP / 'screenshots' / p.name).exists():
            (BACKUP / 'screenshots').mkdir(exist_ok=True)
            shutil.copy2(p, BACKUP / 'screenshots' / p.name)
    names = {
        'mall': 'district-1920', 'store': 'yunchang-store-1920',
        'jijian': 'jijian-store-1920', 'qinghe': 'qinghe-store-1920',
        'builder': 'builder-configured', 'published': 'published-store',
        'walking': 'walking', 'interaction': 'product-interaction',
        'cart': 'cart-detail', 'order': 'order-detail',
        'admin_orders': 'admin-orders', 'admin_coupons': 'admin-coupons',
    }
    for name, source in names.items():
        with Image.open(CAP / f'v4-online-{source}.png') as im:
            temporary = ASSETS / f'{name}.v4.tmp.jpg'
            im.convert('RGB').save(temporary, quality=92)
        temporary.replace(ASSETS / f'{name}.jpg')
    shutil.copy2(CAP / 'v4-online-builder-configured.png', ASSETS / 'builder_full.png')
    for name in ['online-performance', 'online-commerce', 'online-regression']:
        shutil.copy2(CAP / f'v4-{name}.json', DATA / f'v4-{name}.json')
    shutil.copy2(CAP / 'v3-concurrency.json', DATA / 'v4-concurrency.json')
    return json.loads((DATA / 'v4-online-performance.json').read_text(encoding='utf-8'))


def metric(perf, route, width=1920, mode='high'):
    return next(v for v in perf['results'] if v['route']==route and v['viewport'][0]==width and v['mode']==mode)


def fps_range(perf, routes, mode='high'):
    values=[v['fps'] for v in perf['results'] if v['route'] in routes and v['mode']==mode]
    lo,hi=round(min(values)),round(max(values))
    return str(lo) if lo==hi else f'{lo}–{hi}'


def performance_rows(perf):
    rows=[]
    for label,route in [('商圈 / 高清静止','/'),('云裳 / 高清','/stores/yunchang-store/'),('极简 / 高清','/stores/jijian-store/'),('青禾 / 高清','/stores/qinghe-store/'),('建店器 / 高清','/builder/')]:
        a,b=metric(perf,route,1440),metric(perf,route)
        rows.append([label,f"{a['fps']:.1f}",f"{b['fps']:.1f}",str(b['draw']['calls']),f"{b['draw']['triangles']:,}"])
    for label,mode in [('商圈 / 移动导览','cinematic'),('商圈 / 流畅','smooth')]:
        b=metric(perf,'/',mode=mode)
        rows.append([label,'未测',f"{b['fps']:.1f}",str(b['draw']['calls']),f"{b['draw']['triangles']:,}"])
    return rows



def make_montage():
    out = Image.new('RGB', (1920, 1080), '#101e30')
    draw = ImageDraw.Draw(out)
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 28)
    for i, (name, label) in enumerate([
        ('mall', '未来商业中庭 / 四个真实入口'), ('store', '云裳 / 织光庭院'),
        ('jijian', '极简 / 零度艺廊'), ('qinghe', '青禾 / 森屿温室'),
    ]):
        x, y = (i % 2) * 960, (i // 2) * 540
        with Image.open(ASSETS / f'{name}.jpg') as im:
            out.paste(ImageOps.fit(im, (952, 492)), (x + 4, y + 44))
        draw.text((x + 18, y + 5), label, font=font, fill='#b1e8ee')
    out.save(ASSETS / 'scene_comparison.jpg', quality=94)


def set_doc_font(run, size=10.5, bold=False):
    run.font.name = FONT
    run.font.size = DP(size)
    run.font.bold = bold
    run._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'), FONT)


def build_report(perf):
    template = next(p for p in ROOT.parent.glob('*.docx') if len(p.stem) == 2)
    doc = Document(template)
    body = doc._element.body
    start = doc.paragraphs[35]._element
    remove = False
    for child in list(body):
        if child is start:
            remove = True
        if remove and child.tag != qn('w:sectPr'):
            body.remove(child)
    doc.paragraphs[22].text = '课程大作业报告'
    doc.paragraphs[23].text = '题目 1.7：元宇宙商圈的设计与实现'
    # Keep the template logos and identity fields; collapse its spacer paragraphs.
    for para in doc.paragraphs[:35]:
        fmt = para.paragraph_format
        fmt.space_before = fmt.space_after = DP(0)
        if not para.text:
            fmt.line_spacing_rule = WD_LINE_SPACING.EXACTLY
            fmt.line_spacing = DP(6)
    doc.paragraphs[21].paragraph_format.space_before = DP(180)
    for i in [21, 22, 23]:
        doc.paragraphs[i].alignment = 1
    for i in [22, 23]:
        for run in doc.paragraphs[i].runs:
            set_doc_font(run, 18 if i == 22 else 14, True)
    section = doc.add_section(WD_SECTION_START.NEW_PAGE)
    section.header.is_linked_to_previous = False
    section.footer.is_linked_to_previous = False
    section.top_margin = Cm(1.8)
    section.bottom_margin = Cm(1.7)
    section.left_margin = section.right_margin = Cm(2.1)
    section.header_distance = Cm(.8)
    section.footer_distance = Cm(.8)
    section.header.paragraphs[0].text = 'ERP 课程大作业 · METAMALL 重构版 v4'
    p = section.footer.paragraphs[0]
    p.alignment = 2
    r = p.add_run('第 ')
    field = OxmlElement('w:fldSimple'); field.set(qn('w:instr'), 'PAGE')
    p._p.append(field); p.add_run(' 页')
    # The source template carries a Cloud Computing header and a line grid.
    # Grid snapping doubled Chinese line height and created blank spill pages.
    for idx, sec in enumerate(doc.sections):
        grid = sec._sectPr.find(qn('w:docGrid'))
        if grid is not None:
            sec._sectPr.remove(grid)
        if idx == 0:
            for part in [sec.header, sec.footer]:
                for child in list(part._element):
                    part._element.remove(child)
                part._element.append(OxmlElement('w:p'))
    number = OxmlElement('w:pgNumType'); number.set(qn('w:start'), '1')
    section._sectPr.append(number)
    for name in ['Normal', 'Body Text', 'Caption', 'Heading 1', 'Heading 2']:
        if name not in doc.styles:
            doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
    if 'Table Grid' not in doc.styles:
        style = doc.styles.add_style('Table Grid', WD_STYLE_TYPE.TABLE)
        borders = OxmlElement('w:tblBorders')
        for edge in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
            el = OxmlElement('w:' + edge); el.set(qn('w:val'), 'single'); el.set(qn('w:sz'), '4')
            el.set(qn('w:color'), 'A8B8C6'); borders.append(el)
        props = OxmlElement('w:tblPr'); props.append(borders); style._element.append(props)
    for name in ['Normal', 'Body Text', 'Caption']:
        style = doc.styles[name]
        style.font.name = FONT
        style.font.size = DP(10.5 if name != 'Caption' else 9)
        style._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'), FONT)
        style.paragraph_format.space_after = DP(6)
        style.paragraph_format.line_spacing = DP(15)
        snap = OxmlElement('w:snapToGrid'); snap.set(qn('w:val'), '0')
        style._element.get_or_add_pPr().append(snap)
    for name, size in [('Heading 1', 19), ('Heading 2', 13)]:
        style = doc.styles[name]; style.font.name = FONT; style.font.size = DP(size)
        style._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'), FONT)
    # Avoid inheriting the old Odoo lab heading's page-break style.
    doc.styles['Heading 1'].paragraph_format.page_break_before = False

    def h(t, level=1): doc.add_heading(t, level)
    def p(t): doc.add_paragraph(t)
    def page(): doc.add_page_break()
    def picture(name, caption, width=6.35):
        para = doc.add_paragraph(); para.paragraph_format.space_after = DP(2)
        para.paragraph_format.line_spacing = 1
        para.add_run().add_picture(str(ASSETS / f'{name}.jpg'), width=DI(width))
        doc.add_paragraph(caption, style='Caption')
    def table(headers, rows):
        t = doc.add_table(rows=1, cols=len(headers)); t.style = 'Table Grid'
        for c, text in zip(t.rows[0].cells, headers): c.text = text
        for row in rows:
            for c, text in zip(t.add_row().cells, row): c.text = str(text)
        for row in t.rows:
            for c in row.cells:
                for para in c.paragraphs:
                    para.paragraph_format.space_after = DP(4)
                    for run in para.runs: set_doc_font(run, 9)

    h('一、系统需求分析')
    p('本项目对应题目 1.7“元宇宙商圈的设计与实现”。核心是面向多个服装工厂的 3D 产品展示与自动建店，扩展下单和优惠券。目标是能够现场解释、操作并复核的课程原型。')
    h('1.1 用户与业务需求', 2)
    table(['角色', '主要操作', '验收依据'], [
        ['参观者', '浏览商圈、角色行走、进入不同品牌展馆、点击立体商品', '三家种子店均有独立入口与商品'],
        ['工厂运营者', '设置品牌、风格、布局、尺寸、灯光和来源商品并发布', '预览与正式场景使用相同配置规范'],
        ['顾客', '领券、加购、改数量、结算、模拟支付、取消', '库存及优惠券按订单状态一次性更新'],
        ['管理员', '维护工厂/店铺/商品/券，查看订单和库存', 'Django Admin；取消订单走统一业务服务'],
    ])
    h('1.2 数据与范围', 2)
    p('可重建基础数据集 dataset/seed.json 包含 3 个工厂、3 个种子店、12 件商品和 3 种优惠券。新版实机额外发布“织界未来店”，公开展馆为 4 家、公开商品为 16 件；新增店来自真实发布动作，不是固定第四个模型。')
    p('WELCOME30 为满额减券，MINT50 为门店限定优惠，QINGHE10 为门店折扣券。具体门槛、有效期和数量以数据库为准。系统区分领取与核销，核销在下单事务内完成。')
    h('1.3 本次视觉与功能修复目标', 2)
    p('将传统网页中的小画布改为整屏虚拟空间；以未来商业中庭、空间地标、品牌建筑和可控访客形成到达感。三种店铺改变建筑轮廓和陈列，不只改变颜色。自动建店公开尺寸/布局/灯光等结构参数，交易增加数量调整、券预览与幂等校验。')
    p('当前实现是本机角色漫游与模拟交易。立体服装用于类别/配色示意，真实商品信息来自 Django；不将其表述为多人实时社交、AR 试衣或真实支付。')

    page(); h('二、系统框架设计')
    h('2.1 技术与模块边界', 2)
    table(['层次', '实现', '职责'], [
        ['页面与交互', 'Django Templates + 原生 JS/CSS', '导航、配置表单、商品详情、异步加购'],
        ['3D 表现', 'Three.js r186 + 本地 addons', 'world/runtime / architecture / garments / visitor'],
        ['场景规范', 'mall/scene.py', '统一风格、尺寸、布局、色板、商品序列化'],
        ['业务与持久化', 'Django 5.2.18 + SQLite', '工厂、店铺、商品、订单、券；Admin 管理'],
    ])
    p('浏览路径：GET / → district.js 生成商圈 → /stores/<slug>/ 读取 Store.build_scene() → world/architecture.js 生成展馆和商品交互。建店路径：表单 → POST /builder/preview/ → 同一场景规范 → 发布创建 Store 与商品副本 → 商圈动态增加入口。')
    h('2.2 数据关系与事务', 2)
    p('Factory 1—N Store，Store 1—N Product，Order 1—N OrderItem；Coupon 可限定 Store。Order 保存金额快照、状态、会话归属和唯一提交 token；OrderItem 保留商品/单价/数量。来源商品复制图片引用、价格、库存、尺码和颜色。')
    p('SQLite 使用 IMMEDIATE 事务，扣库存采用 stock >= quantity 的条件 UPDATE，券采用剩余量条件更新。唯一 token 抑制重复下单；取消先按状态条件转换，再恢复库存和券。前台和 Admin 均调用 commerce/services.py，避免后台改状态漏恢复或反复恢复。')
    h('2.3 实现与复现步骤', 2)
    p('① 创建虚拟环境并安装 requirements.txt；② migrate；③ 全新库 seed_demo --with-admin；④ runserver；⑤ 检查三个种子展馆；⑥ 建店发布并完成交易；⑦ 执行测试与并发脚本。已有订单的库不要重复执行种子重置，缺图引用可用 repair_catalog。')
    p('部署：新版独立目录 /home/sean/metamall-v4-20261020、独立 SQLite 副本与 3002 端口。旧 3000 / 3001 保留；全部运行资源本地提供，无前端 Node 构建。课程使用 Django 开发服务器，不将其作为商业生产部署。')

    page(); h('三、系统实现截图与说明')
    h('3.1 商圈：先看见空间，再选择目的地', 2)
    picture('mall', '图 1　新版实机商圈：三家品牌与新增织界未来店均有独立标识和入口。')
    p('构图以到达平台、前景角色、中景三品牌、后景城市和星体形成纵深。轨道顶棚与悬浮雕塑抬高，避开门头；底部目的地栏提供可靠入口。主画布随视口变化，界面不再把 3D 压成网页中的插图。')
    picture('walking', '图 2　进入世界后控制角色行走；靠近展馆按 E 进入。')
    p('WASD / 方向键移动，Shift 加速，鼠标环视，E 进店，Esc 返回全景。拖拽相机与点击入口区分，池体和平台边界有基础限制；本地访客与行人提供尺度参照。')

    page(); h('3.2 三种品牌空间与商品交互')
    picture('scene_comparison', '图 3　同一版本实机对照：商圈、云裳庭院、极简艺廊、青禾温室。')
    table(['品牌', '空间结构', '材质与叙事'], [
        ['云裳制衣', '暖色拱廊、庭院式陈列、悬浮环装置', '纺织/石材纹理、柔和暖光，东方日常'],
        ['极简工坊', '冷色悬挑、矩形画廊、克制灯带', '金属/石材、冷光，工业极简'],
        ['青禾服饰', '弧形温室肋架、岛式陈列、绿植', '木材/瓷砖、绿色层次，植物与自然'],
    ])
    picture('interaction', '图 4　点击立体商品打开详情；真实图片、价格与库存来自后端。')
    p('商品按类别形成衬衫、连衣裙、裤装等示意轮廓；详情中可旋转示意模型并异步加购。每店有品牌牌、陈列台、收银/试衣空间道具；截图与当前线上版本一致。')

    page(); h('3.3 自动建店：配置生成与发布一致')
    picture('builder', '图 5　实际配置“织界未来店”：艺廊、岛式、14×11、冷光、种子 861。')
    p('参数包括品牌、工厂、来源商品、三种建筑风格、三种陈列布局、宽深、灯光和装置种子。结构参数改变时重建；品牌颜色和名称只更新对应材质/标牌。WorldRuntime 统一管理渲染、质量、相机与释放；architecture 同时生成商圈门面、预览和正式展厅。服装曲面增加领口、袖子、衣襟和褶皱；静态建筑按材质合批。')
    picture('published', '图 6　发布后的正式店铺；同一配置生成实际新展馆与商品。')
    p('预览与正式页面都经 mall/scene.py 序列化，由 world/architecture.js 渲染。测试比较风格、尺寸、布局、灯光、种子、色板及商品图片；不选来源时预览与正式店均为空，避免伪造预览商品。发布后商圈自动追加入口，三个种子位置保持稳定。')

    page(); h('3.4 交易闭环与后台')
    picture('cart', '图 7　购物车可调整数量、移除商品、校验优惠券并预览应付。', 5.8)
    picture('order', '图 8　线上实测订单 D6A336C0B6DC：299−30=269，状态为已支付。', 5.8)
    p('实测从角色行走入店、点选立体衬衫、领券、加购、数量 2→1、WELCOME30 结算至模拟支付，随后打开 Admin 订单和优惠券列表。自动操作约 27 秒，仅证明流程可跑通，不代表人工答辩耗时。')
    p('Admin 可查询订单明细/状态、商品库存、券使用量；财务快照只读，取消动作通过统一服务恢复资源。会话级归属限制订单读取/支付/取消。取消、错误券、过期券、最低消费、跨店与券用尽由自动测试补充验证。')

    page(); h('四、系统性能测试')
    p('测试日期 2026-10-20；线上新版含 4 家已发布店。Windows / Intel Iris Xe / Chrome 155；浏览器 DPR=1，前台窗口，无 DevTools 降速。每场景加载后预热 1.2 秒，以 requestAnimationFrame 连续采样 3 秒。以下为短样本，不外推到其他设备。')
    table(['场景 / 画质', '1440×1000 FPS', '1920×1080 FPS', '调用中位数', '三角形中位数'], performance_rows(perf))
    p('窗口高度包含 72px 导航。高清反射为商圈 1024 / 店内 768；商圈静止相机缓存反射 100ms，镜头移动立即更新；1024 阴影静态缓存，角色移动每 4 帧刷新，辉光开启。流畅模式关闭反射/阴影/辉光，像素比 0.85。调用统计覆盖全部通道，表内取中位数；原始 JSON 同时保存最小/最大值。')
    p('移动导览需要更新反射，单列其 FPS，不能用静止视角数据代表移动表现。GPU 首次编译曾出现 X4122 极小浮点精度 warning；本次实测无页面异常或 HTTP 404/500，未隐藏着色器检查。')
    h('4.1 正确性与资源释放', 2)
    table(['验证', '结果'], [
        ['Django 自动测试', '23 项通过；独立测试库；无新增迁移'],
        ['最后 1 库存 / 1 券，8 并发请求', '只生成 1 单；库存 0；券核销 1'],
        ['同一订单，4 并发取消', '只恢复一次；库存 1；券核销回到 0'],
        ['同 token 并发双提交', '只生成 1 单'],
        ['建店器连续 12 次风格切换', '预热后纹理数稳定 28；几何数随风格变化'],
        ['连续 10 次完整店铺切换', '纹理数按风格复现，未持续增长；JS 堆有周期回收'],
        ['Chrome 页面与资源', '本次实测路径无 pageerror、HTTP 4xx/5xx 资源'],
    ])
    p('并发脚本使用独立临时 SQLite 文件，不读写演示库。纹理数稳定证明这一段切换中未持续增加，不等同于完整 GPU 显存或长时稳定性证明。原始 JSON、测试日志、截图保存在 docs/验证数据 与 docs/screenshots，当前证据前缀为 v4。旧 v3 数据仅作为历史对照。')

    page(); h('附：演示脚本、来源与交付说明')
    h('三分钟建议演示顺序', 2)
    table(['时间', '动作', '向评委说明'], [
        ['0:00–0:25', '商圈全景，三品牌入口，角色行走', '虚拟空间、地标与品牌差异'],
        ['0:25–0:55', '进入云裳，点选商品、加购', '3D 物件与真实商品数据关联'],
        ['0:55–1:30', '购物车 WELCOME30，299→269，模拟支付', '优惠券、订单、库存闭环'],
        ['1:30–2:10', '建店器改风格/布局/尺寸，查看新展馆', '相同规范生成预览与正式页面'],
        ['2:10–2:40', 'Admin 订单/券核销/商品库存', '业务结果可追溯'],
        ['2:40–3:00', '性能表与并发结果', '实测条件、取舍与实现范围'],
    ])
    p('为控制时长，预先打开后台、建店器和支付结果标签；完整发布操作可作为追问演示。上述为待人工排练的时间预算，尚未由真人逐字汇报计时。')
    h('来源、职责与实现范围', 2)
    p('报告人：侯福宽。身份字段沿用课程模板。开发、资料整理与验证过程中使用 AI 编程/文档辅助；答辩时应能解释场景配置、事务和测试证据，不虚构第二位组员或线下工作量。')
    p('空间组织参考 Decentraland MVFW 2025 的中心广场/品牌展馆，以及 BOSS 的虚拟展厅。建筑和服装示意几何由本项目编程生成；参考项目图片未嵌入产品场景。')
    p('参考 1：' + REF1)
    p('参考 2：' + REF2)
    p('Three.js 与 addons 使用 MIT；RobotExpressive 模型为 Tomás Laulhé / Don McCurdy，CC0 1.0，授权文件随源码提供。数据为课程模拟数据，支付不对接金融服务。')
    p('新版访问：' + SITE + '；不可直连时执行 ssh -N -L 3002:127.0.0.1:3002 40，访问 localhost:3002。提交包包含本报告、12 页 PPT/PDF、源代码、数据集和实测证据，不包含虚拟环境及个人会话数据库。')
    doc.save(DOCS / f'{REPORT}.docx')


def build_slides(perf):
    prs = Presentation(); prs.slide_width = Inches(13.333333); prs.slide_height = Inches(7.5)
    BG = '0C1829'; FG = 'EFF5FA'; MUTED = 'AAC0D0'; ACCENT = 'A4E4EB'

    def rect(slide, x, y, w, h, color, transparency=None):
        shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
        shape.fill.solid(); shape.fill.fore_color.rgb = RGBColor.from_string(color)
        shape.line.fill.background()
        return shape
    def text(slide, value, x, y, w, h, size=20, color=FG, bold=False):
        shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        tf = shape.text_frame; tf.word_wrap = True
        tf.margin_left = tf.margin_right = Inches(.02)
        tf.margin_top = tf.margin_bottom = 0
        for i, line in enumerate(value.split('\n')):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.text = line; p.font.name = FONT; p.font.size = Pt(size); p.font.bold = bold
            p.font.color.rgb = RGBColor.from_string(color); p.space_after = Pt(12)
        return shape
    def pic(slide, name, x, y, w, h):
        path = ASSETS / f'{name}.jpg'
        with Image.open(path) as im:
            scale = min(w / im.width, h / im.height)
            iw, ih = im.width * scale, im.height * scale
        slide.shapes.add_picture(str(path), Inches(x + (w-iw)/2), Inches(y+(h-ih)/2), width=Inches(iw), height=Inches(ih))
    def slide(title, subtitle, note):
        s = prs.slides.add_slide(prs.slide_layouts[6]); s.background.fill.solid(); s.background.fill.fore_color.rgb=RGBColor.from_string(BG)
        text(s, 'METAMALL  /  ERP 1.7', .42, .2, 8, .3, 11, ACCENT)
        text(s, title, .45, .67, 12.4, .65, 30, FG, True)
        text(s, subtitle, .47, 1.4, 12.2, .45, 14, MUTED)
        rect(s, .45, 7.07, 12.4, .012, '294254')
        text(s, '侯福宽 · 软件工程 · 2026.10.20', .47, 7.19, 10, .2, 9, MUTED)
        text(s, f'{len(prs.slides):02d} / 12', 11.9, 7.17, .9, .22, 10, ACCENT)
        s.notes_slide.notes_text_frame.text = note
        return s

    s=slide('元宇宙商圈', '多个真实工厂，三个品牌世界，一个配置驱动的虚拟商业空间。', '开场：题目1.7，重点演示3D空间、自动建店和交易闭环。')
    pic(s,'mall',4.55,1.95,8.3,4.67)
    text(s,'进入世界\n看见制造',.5,2.35,3.8,1.8,38,ACCENT,True)
    text(s,'Django 5.2.18 + SQLite\n原生 Three.js r186\n实机截图 · 可现场操作',.53,4.5,3.8,1.5,18)
    s=slide('课程要求，如何落地', '核心要求与加分项都对应到实际页面、数据和验证。', '不要只报功能名，指出每个要求对应的实物：三厂三店、参数建店、订单库存和提交材料。')
    for x,num,title,body in [(.5,'01','多工厂 / 3D 店铺','3 个工厂、3 个种子品牌\n12 件基础商品\n动态增加已发布展馆'),(4.8,'02','自动建店','风格、布局、尺寸、灯光\n来源商品与品牌参数\n实时预览 + 发布'),(9.1,'03','交易与交付','优惠券、订单、库存\n后台、测试、真实数据\n源码 + 数据集 + 报告')]:
        rect(s,x,2.1,3.75,4.45,'15283A'); text(s,num,x+.2,2.35,2,.7,36,ACCENT);text(s,title,x+.2,3.3,3.3,.6,23,FG,True);text(s,body,x+.2,4.2,3.3,2,19)
    s=slide('把首页变成“到达一个世界”', '未来商业中庭、轨道地标、远景城市；三家门头和新增入口同时可见。', '空间组织参考Decentraland MVFW与BOSS展厅。强调建筑、尺度、动线，不只增加霓虹。')
    pic(s,'mall',.5,1.98,8.7,4.9);text(s,'前景：到达与角色\n中景：品牌与入口\n后景：城市与星体\n\n地标抬高，避开门头\n底部导视可直接进店',9.5,2.3,3.3,3.9,20)
    text(s,'参考：Decentraland MVFW 2025 / BOSS immersive showroom；链接见报告。',9.5,6.1,3.2,.7,10,MUTED)
    s=slide('三个品牌，三种建筑语言', '差异来自结构、陈列和材质；同一引擎保留品牌辨识度。', '云裳拱廊庭院；极简矩形悬挑艺廊；青禾弧形温室和绿植。现场可切换三个店。')
    for x,name,label,body in [(.5,'store','云裳 · 织光庭院','拱廊 / 暖光 / 织物'),(4.83,'jijian','极简 · 零度艺廊','悬挑 / 冷光 / 金属'),(9.16,'qinghe','青禾 · 森屿温室','肋架 / 绿植 / 木材')]:
        pic(s,name,x,2.15,3.67,2.06);text(s,label,x,4.53,3.8,.6,22,ACCENT,True);text(s,body,x,5.37,3.8,.8,18)
    s=slide('从旁观场景，到实际进入', 'WASD 行走，E 进店；点击立体商品，查看真实信息并加购。', '本机可控角色，没有多人联网。服装是类别/颜色示意，不声称精准试衣。')
    pic(s,'walking',.5,2.03,6.1,3.43);pic(s,'interaction',6.75,2.03,6.1,3.43)
    text(s,'角色、边界、相机与目的地',.53,5.75,6,.5,23,ACCENT);text(s,'立体物件 → Django 商品 → 购物车',6.78,5.75,6,.5,23,ACCENT)
    text(s,'本机漫游；服装模型用于款式示意，商品图片 / 价格 / 库存来自实际数据库。',.53,6.48,12,.35,15,MUTED)
    s=slide('自动建店，参数改变真实空间', '不是只有换色：建筑风格、陈列布局、宽深、灯光和装置种子都可配置。', '现场改一个结构参数，再改品牌色。预览debounce调用后端，配置由统一规范生成。')
    pic(s,'builder',.5,1.98,9.0,5.06);text(s,'风格 × 3\n布局 × 3\n尺寸与灯光\n品牌与来源商品\n\n结构变化重新生成\n颜色/名称局部更新',9.72,2.2,3.1,4.5,20)
    s=slide('预览与发布，共用一套规范', '真实发布“织界未来店”：艺廊 / 岛式 / 14×11 / 冷光 / 种子 861。', '指向scene.py和world/architecture.js。发布不是预设第四家；商圈从数据追加。测试比较配置和商品图片。')
    pic(s,'published',.5,2.02,8.1,4.56);text(s,'表单配置\n↓\nmall/scene.py\n↓\nworld/architecture.js\n↙             ↘\n实时预览       正式展馆',8.95,2.2,3.8,3.8,22,ACCENT)
    text(s,'新店商品保留图片、价格、库存、尺码与配色；无来源时不伪造商品。',8.95,6.1,3.7,.8,15,MUTED)
    s=slide('从 3D 商品到订单，完成闭环', '实机订单 D6A336C0B6DC：立领亚麻衬衫 ¥299，WELCOME30 后实付 ¥269。', '展示购物车数量2改1、用券与已支付结果。支付为模拟，不真实扣款。')
    pic(s,'cart',.5,2.0,6.45,4.4);pic(s,'order',7.25,2.0,5.55,4.4)
    text(s,'领券 → 加购 → 改数量 → 验券 → 下单 → 模拟支付',.6,6.52,12,.4,21,ACCENT)
    s=slide('业务结果，可以在后台核验', '订单金额快照、商品库存、优惠券核销；前台与后台取消使用同一服务。', '现场Admin看订单、券used_count及库存。说明并发取消只恢复一次，订单不允许直接编辑财务快照。')
    pic(s,'admin_orders',.5,2.05,8.2,4.61);text(s,'条件扣减库存 / 券\n唯一 token 幂等\n订单会话归属校验\n状态转换后恢复一次\n\nAdmin 统一取消动作',9.0,2.4,3.8,3.9,21)
    s=slide('保留轻量技术，明确复用边界', '无 Vue / React / Node 构建；本地资源、同一场景规范、一个业务事务。', '报告人侯福宽；使用AI编程和文档辅助。没有虚构双人分工。解释实现复用。')
    for y,left,right in [(2.1,'Templates + 原生 JS','交互 / 表单 / 异步购物车'),(3.16,'WorldRuntime','统一生命周期；共享建筑与服装生成'),(4.22,'mall/scene.py','配置规范 → 预览与正式场景'),(5.28,'Django + SQLite','Factory / Store / Product / Order / Coupon')]:
        rect(s,.5,y,12.3,.83,'15283A');text(s,left,.72,y+.18,4.5,.5,23,ACCENT);text(s,right,5.3,y+.21,7.1,.45,20)
    text(s,'报告人：侯福宽；实现、资料整理与验证使用 AI 辅助，原始证据随提交包提供。',.6,6.5,12,.35,14,MUTED)
    s=slide('性能与正确性，用实测回答', 'Chrome 155 / Iris Xe / DPR 1；4 店；预热 1.2 秒 + rAF 采样 3 秒 / 场景。', '高清商圈未达60，流畅模式关闭反射阴影辉光并降像素比，达到60。短样本不外推。23测试+并发脚本。')
    text(s,fps_range(perf,['/'])+'\n商圈高清静止 FPS',.6,2.17,4,1.5,31,ACCENT,True)
    text(s,fps_range(perf,['/stores/yunchang-store/','/stores/jijian-store/','/stores/qinghe-store/'])+'\n店内高清 FPS',4.9,2.17,3.8,1.5,31,ACCENT,True)
    text(s,fps_range(perf,['/'],'smooth')+'\n商圈流畅 FPS',9.1,2.17,3.6,1.5,31,ACCENT,True)
    tour=metric(perf,'/',mode='cinematic')
    text(s,f"移动导览另测 {tour['fps']:.1f} FPS；反射：商圈 1024 / 店内 768。\n静止缓存 100ms；镜头移动立即更新；阴影与辉光开启。\n23 项 Django 测试通过；8 请求争抢 1 库存，只生成 1 单。\n4 并发取消仅恢复 1 次；同 token 双提交仅 1 单。\n建店器 12 次风格切换：纹理 28，反射目标始终为 1。",.65,4.25,12,2.4,20)
    s=slide('现场 Demo：三分钟看完整条链', '先展示世界和差异，再证明配置生成与业务闭环。', '按此顺序人工排练。预开后台、建店器与结果页，完整发布作为追问。机器自动操作27秒不当成人工3分钟实测。')
    text(s,'00:00  商圈 / 角色 / 三品牌\n00:25  进入云裳 / 选商品\n00:55  用券 / 下单 / 模拟支付\n01:30  建店参数 / 新店\n02:10  后台订单 / 库存 / 券\n02:40  实测数据 / 实现边界',.6,2.13,7.4,4.5,23)
    rect(s,8.35,2.1,4.4,4.55,'15283A');text(s,'打开新版',8.64,2.55,3.7,.6,29,ACCENT,True);text(s,SITE,8.64,3.6,3.8,1.1,19);text(s,'源码 / 数据集 / 报告\n12 页 PPT / PDF\n实机截图 / 原始验证数据',8.64,5.1,3.8,1.3,18)
    assert len(prs.slides)==12
    prs.save(DOCS / f'{TITLE}.pptx')


if __name__ == '__main__':
    perf = prepare()
    make_montage()
    build_report(perf)
    build_slides(perf)
    print(json.dumps({'slides':12,'pptx':str(DOCS / (TITLE+'.pptx')),'report':str(DOCS / (REPORT+'.docx'))},ensure_ascii=False))
