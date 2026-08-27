# 极速蹬 APP 工程入口

这是国内 Android APP 的唯一工程入口。客户端只从
`/home/codex/worktrees/jisudeng-app-domestic` 和 GitHub `app/domestic` 开发；
后端只从 `/home/codex/worktrees/jisudeng-mobile-backend` 和 GitHub
`app/domestic` 开发。旧工作树只能用于只读审计，见 [归档索引](archive-index.md)。

开始任何工作前，依次执行：

```bash
corepack yarn android:doctor
corepack yarn android:docs:check
```

不要扫描整个 Dell 主机来寻找 SDK、签名、模拟器或构建命令。它们由
[Dell 构建环境](dell-build-environment.md)、[签名与密钥](signing-and-secrets.md)
和 [发行手册](release-runbook.md) 定义。

| 文档 | 用途 |
| --- | --- |
| [当前基线](current-baseline.json) | 唯一客户端/后端提交、版本、制品与验收状态 |
| [架构](architecture.md) | 客户端、原生桥、平台服务和异步任务的责任边界 |
| [模块图](module-map.md) | 功能入口、状态层、后端所有者与测试入口 |
| [接口生命周期](api-lifecycle.md) | API 状态、替代路径和废弃规则 |
| [Dell 构建环境](dell-build-environment.md) | 固定用户、工具、缓存、AVD 和排障 |
| [签名与密钥](signing-and-secrets.md) | 私钥引用、权限与轮换，不含任何秘密 |
| [发行手册](release-runbook.md) | Direct/Play 构建和验收顺序 |
| [变更记录](change-log.md) | 版本、模块、接口和验收事实 |
