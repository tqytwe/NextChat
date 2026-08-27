# APP 模块图

| 模块                    | 客户端入口                                                         | 平台接口责任                                     | 回归入口                                 |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------ | ---------------------------------------- |
| 登录、安全、OAuth、TOTP | `managed-nextchat.ts`、`mobile-app.tsx`                            | auth、session、account                           | `managed-nextchat-request`、账户隔离测试 |
| 对话、模型、联网        | `mobile-chat-tools.ts`、`mobile-model-kind.ts`                     | managed session、gateway                         | 聊天 UI、模型分类测试                    |
| 图像与素材              | `mobile-image.ts`、`local-materials.ts`、`local-prompt-library.ts` | assets、image history、Canvas 只读图像提示词目录 | 素材、提示词缓存与账户隔离测试           |
| 视频创作                | `mobile-video.ts`、`mobile-media-contract.ts`                      | video bootstrap、estimate、jobs                  | `mobile-video`、媒体合同测试             |
| 任务与短剧工程          | `mobile-platform.ts`、`mobile-studio.ts`、`mobile-app.tsx`         | tasks、legacy projects、Studio projects          | 后端合同、工程恢复与任务测试             |
| 支付、兑换、订单        | `mobile-platform.ts`、`mobile-subscription.ts`                     | payments、redeem、Play Billing                   | 渠道与订阅测试                           |
| 推送、反馈、邀请        | `mobile-push.ts`、`invite-growth.ts`                               | devices、support、attribution                    | 原生桥与归因测试                         |
| Android 原生桥          | `android-native.ts`、`MainActivity.java`                           | clipboard、file、OAuth、FCM                      | 原生桥与模拟器 smoke                     |

`mobile-app.tsx` 是组合层，不得直接定义新的服务端协议。新增协议必须先进入
[接口生命周期](api-lifecycle.md)，再由客户端模块封装。
