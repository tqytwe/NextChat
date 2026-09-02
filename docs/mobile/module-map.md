# APP 模块图

| 模块                    | 客户端入口                                                         | 平台接口责任                                     | 回归入口                                 |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------ | ---------------------------------------- |
| 登录、安全、OAuth、TOTP | `managed-nextchat.ts`、`mobile-app.tsx`                            | auth、session、account                           | `managed-nextchat-request`、账户隔离测试 |
| 对话、模型、联网        | `mobile-chat-tools.ts`、`mobile-model-kind.ts`                     | managed session、gateway                         | 聊天 UI、模型分类测试                    |
| 图像、队列与素材        | `mobile-image-queue.ts`、`mobile-app.tsx` 内的 `AndroidCreationQueueWorker`、`content-workbench.ts`、`local-materials.ts`、`local-prompt-library.ts` | assets、image history、Canvas 只读图像提示词目录 | 统一 FIFO、进程恢复、素材、提示词缓存与账户隔离测试     |
| 视频创作与本机工程      | `mobile-video.ts`、`local-video-cache.ts`、`local-video-projects.ts`、`local-video-project-package.ts` | video bootstrap、jobs、内容下载；工程仅本机持久化 | `mobile-video`、视频工程包、媒体合同测试 |
| 任务投影                | `mobile-platform.ts`                                                | tasks 仅作图片任务历史投影，生成与扣费仍由网关/视频任务为准 | 后端合同与任务恢复测试                   |
| 支付、兑换、订单        | `mobile-platform.ts`、`mobile-subscription.ts`                     | payments、redeem、Play Billing                   | 渠道与订阅测试                           |
| 推送、反馈、邀请        | `mobile-push.ts`、`invite-growth.ts`                               | devices、support、attribution                    | 原生桥与归因测试                         |
| Android 原生桥          | `android-native.ts`、`MainActivity.java`                           | clipboard、file、OAuth、FCM                      | 原生桥与模拟器 smoke                     |

`mobile-app.tsx` 是组合层，不得直接定义新的服务端协议。新增协议必须先进入
[接口生命周期](api-lifecycle.md)，再由客户端模块封装。

`local-video-projects.ts` 与 `content-workbench.ts` 的项目、镜头、提示词历史和
队列关联均按登录账号写入设备 IndexedDB。它们不是云端项目，也不能假称支持跨设备恢复；
跨设备转移必须使用经校验的工程包。视频工程只调用既有视频任务接口，绝不在客户端自行
判断扣费、退款或模型价格。
