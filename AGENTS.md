# 极速蹬 NextChat Managed 开发约束

本仓库当前生产集成分支是 `feat/sub2api-managed-20260720`。修改任何可见界面、
样式、图标、托管状态或交互前，必须先完整读取：

- `docs/MANAGED_UI_DESIGN_SYSTEM.md`
- `docs/SUB2API_MANAGED_MODE.md`

## 强制工作流

1. 先查看当前实际画面或已有截图，再读取目标组件及相邻组件。
   机器边界以 `docs/managed-ui-governance.json` 为准，文档与清单必须同步修改。
2. 确认改动属于 managed 品牌壳，不得借视觉整改重写上游聊天核心。
3. 优先复用 `app/icons/*.svg`、`IconButton`、Modal 和已有布局组件。
4. 检查桌面、移动、短屏、浅色、深色、键盘焦点和 reduced-motion。
5. 新增 `docs/visual-reviews/YYYY-MM-DD-<slug>.md`，记录当前与修改后画面、
   状态、视口和聊天核心无回归证据；只读 JSX/SCSS 不算完成视觉检查。
6. 运行 `yarn design:check`、相关测试、`yarn test:ci` 和 `yarn build`。

## Managed 范围

允许统一：

- 极速蹬品牌、标题、导航入口、返回/充值/退出操作。
- 客服入口和客服面板。
- session、bootstrap、锁定、错误、空状态和加载状态。
- managed 壳的颜色、间距、圆角、焦点和响应式。

禁止借机修改：

- 聊天消息结构、消息 Markdown、输入区和发送行为。
- 会话列表、会话持久化、滚动恢复和生成状态。
- 上游非 managed 模式的主题、设置和插件能力。

## 硬性规则

- 功能图标使用现有 `app/icons/*.svg`，通过组件导入；禁止在 managed JSX 内新增
  手写 SVG 或用 emoji 代替功能图标。
- 新图标采用 24x24 viewBox、`currentColor`、1.5-2 描边，并与同工具栏图标保持
  相同尺寸和视觉重量。
- managed 样式必须限定在 `.managed-shell` 或 managed CSS module，禁止修改
  全局 `body`、输入控件或上游主题 token 来实现局部效果。
- 运营卡片圆角 8px，控件 6-8px，浮层 12px；禁止新增大圆角、渐变按钮、
  彩色阴影和 `transition: all`。
- 所有操作必须有 hover、active、focus-visible、loading、disabled 和 error
  中适用的状态；图标按钮必须有可访问名称。
- 不得清除焦点轮廓而没有 2px、3:1 对比度的 `focus-visible` 替代。
- 客服和状态面板不得永久挤压聊天列表；短屏下所有核心操作必须可到达。
- `prefers-reduced-motion: reduce` 下取消位移、缩放、旋转、闪烁和持续脉冲。
- session、bootstrap 和 group switch 必须保持独立状态与请求生命周期；视觉改动
  不得把未 ready 的工作台伪装成可用状态。

确需例外时，在文件中加入：

```text
design-governance-allow: <rule-name> - <具体原因>
```

允许的 rule name 为 `inline-svg`、`transition-all`、`large-radius`、
`raw-color`、`focus-reset`、`global-style`。每项例外必须在评审中单独说明。
