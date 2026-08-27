# APP 历史工作树归档索引

| 路径 | 用途 | 状态 | 替代入口 |
| --- | --- | --- | --- |
| `/home/codex/worktrees/nextchat-mobile-closeout` | 3.0.23 收口基线与旧本地候选 | 只读归档 | `jisudeng-app-domestic` |
| `/home/codex/worktrees/nextchat-mobile-media-capabilities-20260826` | 3.0.24 媒体候选 | 只读归档 | `jisudeng-app-domestic` |
| `/home/codex/worktrees/nextchat-mobile-final-20260805` | 2.0.89 历史制品 | 只读归档 | `jisudeng-app-domestic` |
| `/home/codex/worktrees/nextchat-mobile-platform-20260804` | 2.0.87 历史制品 | 只读归档 | `jisudeng-app-domestic` |
| `/home/codex/worktrees/sub2api-mobile-projects-20260816` | 项目与任务候选 | 只读归档 | `jisudeng-mobile-backend` |
| `/home/codex/worktrees/sub2api-mobile-video-20260820` | 视频、素材、提示词候选 | 只读归档 | `jisudeng-mobile-backend` |

归档前必须保留 Git 提交和远端分支。完成新唯一工程连续构建、签名和验收后，可按授权清理
旧工作树的可再生 `node_modules`、`android/.gradle`、测试结果、旧浏览器 revision 和
已迁移的私钥副本；不得删除源码、Git 历史、远端分支、生产容器或未登记资产。
