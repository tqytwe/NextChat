# APP 历史工作树归档索引

盘点日期：2026-08-27。以下目录均不是开发入口；客户端唯一入口为
`/home/codex/worktrees/jisudeng-app-domestic@app/domestic`，后端唯一入口为
`/home/codex/worktrees/jisudeng-mobile-backend@app/domestic`。

| 路径 | 仓库 / 分支 / 提交 | 未提交项 | 大小 | 用途 | 替代入口 |
| --- | --- | --- | --- | --- | --- |
| `/home/codex/worktrees/nextchat-mobile-closeout` | NextChat / `claude/mobile-closeout` / `a9c65dfe` | 5 | 2.8G | 3.0.23 收口基线与旧本地候选 | `jisudeng-app-domestic` |
| `/home/codex/worktrees/nextchat-mobile-media-capabilities-20260826` | NextChat / `fix/android-media-capabilities-20260826` / `47634cef` | 0 | 964M | 3.0.24 媒体候选 | `jisudeng-app-domestic` |
| `/home/codex/worktrees/nextchat-mobile-final-20260805` | NextChat / `codex/mobile-final-20260805` / `eaddacb2` | 0 | 1.7G | 2.0.89 历史制品 | `jisudeng-app-domestic` |
| `/home/codex/worktrees/nextchat-mobile-platform-20260804` | NextChat / `codex/mobile-complete-20260805` / `a8817a3d` | 0 | 2.2G | 2.0.87 历史制品 | `jisudeng-app-domestic` |
| `/home/codex/worktrees/sub2api-mobile-projects-20260816` | sub2api / `codex/mobile-projects-20260816` / `6fec2fc9e` | 4 | 780M | 项目与任务候选 | `jisudeng-mobile-backend` |
| `/home/codex/worktrees/sub2api-mobile-video-20260820` | sub2api / `codex/mobile-video-direct-20260820` / `9131ff5cf` | 0 | 266M | 视频、素材、提示词候选 | `jisudeng-mobile-backend` |

归档前必须保留 Git 提交和远端分支。完成新唯一工程连续构建、签名和验收后，可按授权清理
旧工作树的可再生 `node_modules`、`android/.gradle`、测试结果、旧浏览器 revision 和
已迁移的私钥副本；不得删除源码、Git 历史、远端分支、生产容器或未登记资产。

当前没有执行任何清理：`3.0.25` 仍为 candidate，且有两个工作树含未提交内容。只有新的
唯一工程连续两次完成离线构建、签名、Direct 覆盖升级和完整 E2E 后，才能依据本索引逐项
盘点可再生成目录、恢复命令和释放空间，再取得单独的删除授权。
