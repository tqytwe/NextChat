#### 💻 变更类型 | Change Type

<!-- For change type, change [ ] to [x]. -->

- [ ] feat    <!-- 引入新功能 | Introduce new features -->
- [ ] fix    <!-- 修复 Bug | Fix a bug -->
- [ ] refactor    <!-- 重构代码（既不修复 Bug 也不添加新功能） | Refactor code that neither fixes a bug nor adds a feature -->
- [ ] perf    <!-- 提升性能的代码变更 | A code change that improves performance -->
- [ ] style    <!-- 添加或更新不影响代码含义的样式文件 | Add or update style files that do not affect the meaning of the code -->
- [ ] test    <!-- 添加缺失的测试或纠正现有的测试 | Adding missing tests or correcting existing tests -->
- [ ] docs    <!-- 仅文档更新 | Documentation only changes -->
- [ ] ci    <!-- 修改持续集成配置文件和脚本 | Changes to our CI configuration files and scripts -->
- [ ] chore    <!-- 其他不修改 src 或 test 文件的变更 | Other changes that don’t modify src or test files -->
- [ ] build    <!-- 进行架构变更 | Make architectural changes -->

#### 🔀 变更说明 | Description of Change

<!-- 
感谢您的 Pull Request ，请提供此 Pull Request 的变更说明
Thank you for your Pull Request. Please provide a description above.
-->

#### 📝 补充信息 | Additional Information

<!-- 
请添加与此 Pull Request 相关的补充信息
Add any other context about the Pull Request here.
-->

#### 🎨 Managed UI 检查 | Managed UI Review

- [ ] 本 PR 不含 managed 可见改动，或已阅读 `AGENTS.md`、
      `docs/MANAGED_UI_DESIGN_SYSTEM.md` 和 `docs/SUB2API_MANAGED_MODE.md`。
- [ ] 已查看当前桌面、移动或短屏画面，不是只读 JSX/SCSS。
- [ ] 若包含 managed 可见改动，已新增结构化视觉记录并提交真实的修改前后画面产物。
- [ ] 已检查 session/bootstrap 错误、重试、客服、键盘焦点和 reduced-motion。
- [ ] 已确认消息、输入、聊天滚动和会话持久化没有行为变化。
- [ ] 已运行 `yarn design:check`、`yarn test:ci` 和 `yarn build`。
