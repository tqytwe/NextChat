# 极速蹬 NextChat Managed UI 设计规范

> 状态：active
> 生效日期：2026-07-21
> 适用范围：NextChat managed 品牌壳、入口、客服和系统状态

本文档固定极速蹬托管工作台的视觉与交互边界。它不重新设计 NextChat 聊天产品，
而是确保极速蹬托管层与 Sub2API 使用一致的品牌、图标重量、状态语言和质量门禁。

## 1. 修改前必须看画面

任何 managed 可见改动必须：

1. 查看当前桌面和移动画面或已有截图。
2. 阅读目标组件、CSS module、相邻侧栏/状态组件和已有 SVG 图标。
3. 判断是否会影响聊天列表宽度、输入区、滚动或会话持久化。
4. 优先复用已有组件，不在 managed 文件中重新实现通用按钮、Modal 或 Toast。
5. 修改后保留前后截图，并检查短屏、浅深色和键盘路径。

只阅读 JSX 或 SCSS 不能替代画面检查。

每次可见 managed 改动必须新增
`docs/visual-reviews/YYYY-MM-DD-<slug>.md`，记录目标状态、当前画面、复用决定、
桌面/移动/短屏结果、前后截图，以及消息、输入、滚动和会话持久化的回归证据。

## 2. 与 Sub2API 的共同语言

- 内容层级、状态颜色、圆角、触控尺寸、焦点和 reduced-motion 与
  `Sub2API/docs/FRONTEND_DESIGN_SYSTEM.md` 保持一致。
- 目标合同中，managed 配置、品牌、客服和入口地址以 Sub2API
  bootstrap/public shell 为唯一业务来源，NextChat 不维护另一份可编辑配置。
  当前已接入客服投影；完整 `ManagedShellConfigV1`、revision 和 SSR 标题投影仍按
  整改计划迁移，不能用本地硬编码继续扩展新字段。
- NextChat 使用自己的实现和 CSS token，不跨仓库复制 Vue、Tailwind 或 CSS 文件。

## 3. 布局

- 聊天工作区保持上游布局和滚动合同。
- managed 品牌壳只占用必要空间，不增加营销 Hero 或装饰卡片。
- 侧栏尾部只保留紧凑的客服、充值、返回和退出入口；详情通过 popover/modal 打开。
- 360px 宽和 568px 高的短屏中，聊天、新建会话、模型选择和返回操作必须可达。
- 600px 断点只能有一个明确归属，必须检查 599、600、601px。

## 4. 图标

- 功能图标统一来自 `app/icons/*.svg`，并复用 `IconButton`。
- 新增图标采用 24x24 viewBox、`currentColor`、圆角端点和 1.5-2 描边。
- 常规尺寸为 16、20、24px；触控容器至少 44px。
- 同一工具栏不得混用实心、彩色、emoji、细线和粗线图标。
- 图标按钮必须提供 title、aria-label 或清晰可见文字。
- 品牌 Logo 和模型 Logo 可保留原始品牌形态，不作为功能图标复用。

## 5. 颜色和层级

- managed token 必须限定在 `.managed-shell`：surface、text、border、action、
  info、success、warning、danger 和 focus。
- 正文对比度至少 4.5:1；边框、焦点和非文本状态至少 3:1。
- 状态不能只靠颜色，必须同时有图标和明确文案。
- 卡片默认使用边框，不使用彩色阴影；popover 和 modal 才使用提升层级阴影。
- 禁止渐变按钮、装饰光斑和与工作任务无关的持续动画。

## 6. 间距和圆角

- 间距只使用 4、8、12、16、20、24、32px。
- 运营卡片 8px，控件 6-8px，popover/modal 12px。
- 全圆角仅用于头像、状态点和真正的 pill。
- 面板不得嵌套装饰卡片，Sidebar footer 不得成为第二个 Dashboard。

## 7. 状态

managed 壳必须明确处理：

- session checking、launching、authenticated、expired、unauthorized。
- bootstrap loading、ready、error、timeout。
- account locked、feature disabled、no group、no model、insufficient balance。
- network error、relaunch、return、recharge 和 contact support。

状态页使用同一骨架：品牌、标题、解释、主操作、次操作、客服入口和诊断 ID。
生产页面不得显示组件栈，不得把“清理本地数据”作为默认恢复动作。

session、bootstrap 和 group switch 使用互相独立的状态与请求生命周期。进入聊天
工作区必须同时满足 session authenticated 和 bootstrap ready。bootstrap 失败时
显示完整错误页和重试入口，不能渲染品牌、模型、客服为空的半工作台。

## 8. 交互

- Hover 只增强颜色、边框或阴影，不改变布局。
- Active 反馈为 80-120ms，不改变控件尺寸。
- Focus-visible 至少 2px、3:1，并且不被 overflow 裁切。
- Loading 保持按钮宽度，防重复提交并使用正确的忙碌语义。
- Error 提供原因、重试和安全返回，不允许无限 skeleton。
- Toast 和状态消息必须有 live-region 语义，不能只在视觉上变化。
- `reduce` 模式取消位移、缩放、旋转、shimmer、ping 和持续脉冲。

## 9. 冻结边界

以下文件或行为不能因视觉治理被重写：

- 消息结构和聊天状态 store。
- 输入区、发送、停止和重新生成逻辑。
- 会话列表、历史存储和滚动恢复。
- 非 managed 用户的设置、主题和插件体验。

必要的品牌文案通过 Locale 或 managed config 注入；必要的焦点样式通过
`.managed-shell` 覆盖。不能用修改上游核心 DOM 的方式实现托管视觉。

允许的受控例外只有：通过 Locale 或 managed config 替换品牌文案、为 managed
容器补焦点/状态属性、以及修复会阻断 managed 用户的可访问性。任何例外必须用 DOM
快照、会话回归和视觉记录证明消息结构、输入、滚动与持久化行为未变化。

## 10. 验收

当前机器门禁已强制 Git 基线、managed/shared/frozen 文件范围、增量视觉规则、
功能图标合同和带真实前后画面的结构化审查记录。`ManagedShellConfigV1`、
Playwright/axe CI 和运行时状态自动探测仍属于整改计划，不能写成已经落地。

每次 managed UI 改动至少检查：

- 360x568、390x844、768x1024、1280x800、1920x1080。
- 浅色、深色、中英文和 reduced-motion。
- Tab、Shift+Tab、Enter、Space、Escape。
- session/bootstrap 正常、超时、401、500 和重试。
- 客服打开/关闭、返回、充值、退出和锁定页。
- 聊天列表、输入区、滚动和本地会话行为无回归。
- `yarn design:check`、`yarn test:ci` 和 `yarn build` 通过。
- 已新增并填写 `docs/visual-reviews/YYYY-MM-DD-<slug>.md`。
