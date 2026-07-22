# 极速蹬 NextChat Managed UI 整改计划

> 状态：reviewed
> 边界：只统一 Sub2API managed 品牌壳、入口、客服和系统状态

## 1. 不变边界

本整改不重写上游聊天核心。以下行为保持冻结：

- 消息结构、消息 Markdown 和生成状态。
- 输入区、发送、停止、重新生成和附件逻辑。
- 会话列表、历史存储、滚动恢复和本地持久化。
- 非 managed 用户的主题、设置、插件和导出体验。

品牌文字通过 Locale 或 managed config 注入；视觉样式限定在 `.managed-shell`
或 managed CSS module。不能通过改全局 `body/input/select/--primary` 完成托管外观。

## 2. 单一壳配置

Sub2API 后端提供唯一 `BuildManagedShellConfig()`。它投影为：

- 匿名 `public-shell`：锁定页、会话失效页和启动前客服。
- 登录 `bootstrap.shell`：品牌、入口、功能、客服和账户状态。

NextChat 不维护第二份可编辑品牌、导航或客服默认值。配置包含
`contract_version`、`revision`、brand、urls、support contact 和 features。
SSR 使用 public shell 的工作区标题，CSR 在 bootstrap 和 hash route 变化后更新
为 `{本地化页面名} | {workspaceName}`。

## 3. 状态机整改

session、bootstrap 和 group switch 分成独立状态：

- session：checking、authenticated、expired、unauthorized。
- bootstrap：idle、loading、ready、error、timeout。
- group switch：idle、switching、success、error。

三者各自持有 request id 或 AbortController。过期请求必须清理自己的 loading 状态，
不能通过一个全局 sequence 让切组永久锁死。

聊天主界面门禁为 `session=authenticated && bootstrap=ready`。需要明确展示：

- login-required、feature-disabled、token-expired、session-expired。
- account-locked、no-group、no-model、insufficient-balance。
- bootstrap-unavailable、timeout、network-error。

状态页统一包含品牌、标题、解释、主操作、次操作、客服入口和诊断 ID。主操作按
状态选择重试、重新进入或充值；次操作返回控制台。生产环境隐藏组件栈，不把
“清理本地数据”作为默认恢复动作。

## 4. 布局与响应式

- 保持聊天工作区和滚动合同，不增加营销 Hero。
- 侧栏尾部只保留紧凑入口，客服详情通过 popover/modal 打开。
- 客服区不能持续挤压聊天列表；短屏允许折叠为一个入口。
- 600px 断点只有一个归属，固定验证 599、600、601px。
- 最低检查 360x568、390x844、768x1024、1280x800 和 1920x1080。
- 所有关键操作在短屏、200% zoom、浅色、深色和中英文下可达。

## 5. 视觉与交互

- 功能图标只使用 `app/icons/*.svg` 和 `IconButton`。
- managed token 限定在 `.managed-shell`，使用语义 surface/text/border/action/
  status/focus。
- 卡片 8px，控件 6-8px，popover/modal 12px；触控目标至少 44px。
- Hover 不移动布局，active 80-120ms，focus-visible 至少 2px 和 3:1。
- Toast/状态消息有 live-region；错误页有可见重试；loading 不无限持续。
- reduced-motion 下取消位移、缩放、旋转、shimmer、ping 和持续脉冲。
- 侧栏拖拽提供键盘替代、重置和边界约束。

## 6. 迁移顺序

1. 固定 managed token、图标和设计门禁。当前先落地 fail-closed 增量检查、
   managed/shared/frozen 机器清单和结构化画面证据；浏览器自动化在后续阶段接入。
2. 拆分 session/bootstrap/group switch 状态机并补并发测试。
3. 新增 public shell/bootstrap shell 双投影 parser。
4. 统一锁定、错误、超时、无模型、余额不足和重试页。
5. 统一 sidebar 品牌、返回、充值、客服和退出入口。
6. 修复焦点、Toast、短屏和 reduced-motion。
7. 补 SSR/CSR title、hash route 和 `/ai` 重新进入合同。
8. 删除 managed 层的硬编码品牌、客服和旧状态 fallback。

## 7. 测试门禁

- 两种 bootstrap/group switch 并发时序。
- bootstrap 401、500、超时、断网、重试和会话过期。
- public shell、旧/新 bootstrap contract 和配置 revision。
- hash route title、`/ai` base path 和 relaunch URL。
- 客服打开/关闭、返回、充值、退出和锁定页。
- DOM 快照证明消息结构和输入区未变化。
- 会话持久化、滚动恢复和生成状态回归。
- Playwright 覆盖桌面/移动、浅深色、中英文、短屏和 reduced-motion。
- `yarn design:check`、`yarn test:ci` 和 `yarn build`。

CI 在 lint/test/build 前运行 `design:verify`。Docker 中的纯 production build 不依赖
Git diff，避免 `.git` 或基线分支不在构建上下文时阻断发布。

## 8. 视觉证据

任何 managed 可见改动必须提交
`docs/visual-reviews/YYYY-MM-DD-<slug>.md`。记录当前与修改后画面、状态、视口、
复用组件，以及聊天列表、输入、滚动和持久化无回归的证据。
