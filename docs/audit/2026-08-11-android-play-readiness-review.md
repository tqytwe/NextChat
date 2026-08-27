# 2026-08-11 Android Play 上架复审

范围：`/home/codex/worktrees/nextchat-mobile-closeout`，分支 `claude/mobile-closeout`。

状态：Play Billing 原生入口、后端 Google API 验单与订单履约代码、注销申请入口已补；Firebase Android 客户端配置已上传并完成 Play 包/模拟器烟测；2026-08-12 Google Play AVD 上已完成客户端 FCM token 获取、设备注册、服务端 worker 发送、APP 前台真实接收、后台系统通知展示和通知点击回 APP验收。实测发现旧后端 FCM payload 缺少 Android `click_action` 时，后台系统托管通知点击只能恢复 APP，不能稳定把业务 payload 分发给前端；已在后端/APP 代码中补齐，但未部署。Play Console 商品与真实购买仍未端到端验收。未部署、未上传 Google Play、未提交。

## 结论

当前 Play 版仍不能标记为“可提交审核”。已经通过的部分是渠道分流、Target SDK、自安装权限移除、外部购买链接静态隔离、四语言门禁、AI 举报入口、Firebase Android 客户端配置、Play flavor AAB 静态构建、Play flavor release APK 模拟器烟测、FCM token 注册、服务端 worker 发送、APP 前台真实接收、后台系统通知展示、Play Billing 原生购买入口、后端 Google Play Android Publisher API 验单代码、幂等订单/余额/套餐履约接入，以及应用内注销账号申请入口。明确阻塞项是后端 FCM `click_action` 补丁部署后的真实后台点击业务跳转复验、Play Console 商品与服务账号真实配置、至少一笔内部测试购买验收、Play Console Data Safety/隐私/数据删除网页链接、OAuth/签名指纹控制台核对和 Play AAB 通过 bundletool 或 Play internal testing 安装验收。

## 多代理复审矩阵

| 项目 | 结论 | 证据 / 处理 |
|---|---|---|
| Target SDK / 版本 | PASS | Play 合并 manifest 显示 `versionName=3.0.0`、`versionCode=300`、`targetSdk=36`、`minSdk=23`。当前 Google Play target API 要求参考官方文档：<https://developer.android.com/google/play/requirements/target-sdk>。 |
| Play / direct 分流 | PASS | `android/app/build.gradle` 有 `play` / `direct` 两个 flavor，二者共用 `com.jisudeng.chat`；native bridge 暴露 `distributionChannel`。 |
| 自安装权限 | PASS | `android/app/src/play/AndroidManifest.xml` 用 `tools:node="remove"` 移除 `REQUEST_INSTALL_PACKAGES`；Play merged manifest 未包含该权限。 |
| 外部购买链接 | PASS（静态） | Play 构建时 `paymentMethods=[]`、`directRedeemShopUrl=""`，`node scripts/check-android-play-assets.mjs` 输出 `no external purchase links found`；Play 包不应出现 `pay.ldxp.cn`。Google Play 支付政策要求 Play 分发应用内数字内容/服务购买使用 Google Play billing，且不得通过应用内 WebView/按钮/链接/CTA 引导到其他支付方式。官方支付政策参考：<https://support.google.com/googleplay/android-developer/answer/9858738>。 |
| 国内支付 | PASS（代码） | direct APK 保留 USDT、PayNow 与其他非微信支付方式；微信支付行替换为清晰的第三方兑换码购买入口，链接为 `https://pay.ldxp.cn/shop/4B4R3T44`。 |
| Play Billing | CODE READY / CONFIG BLOCKER | APP 已接 Google Play Billing Library `9.1.0`，Play 版充值/套餐页展示后端 `play_billing_products` / plan 字段下发的 Google Play 商品，购买后把 `purchase_token` 交给 `/api/v1/mobile/play-billing/purchases`。后端隔离 worktree `/home/codex/worktrees/sub2api-play-billing-20260811` 已新增受 JWT 保护的验单接口、Android Publisher API service-account JWT 验单、商品映射、purchase token 稳定订单号、`payment_orders` 幂等入账、余额 ledger / 套餐履约复用和单测。当前还缺 Play Console 商品 ID、服务账号真实 JSON、`MOBILE_PLAY_BILLING_PRODUCTS_JSON` 生产映射和至少一笔内部测试购买；未配置时仍返回 `PLAY_BILLING_NOT_CONFIGURED` / `PLAY_BILLING_PRODUCT_NOT_MAPPED`，不会本地发余额。Google 官方流程要求先验证 purchase，再发放权益，只在已购买状态处理，并在发放后 consume/acknowledge。参考：<https://developer.android.com/google/play/billing/integrate> 与 <https://developer.android.com/google/play/billing/release-notes>。 |
| FCM 推送 | RECEIVE PASS / CLICK PAYLOAD PATCH READY / DEPLOY BLOCKER | `android/app/src/play/google-services.json` 已上传；`android/app/google-services.json` 作为 direct 兜底，两者当前 SHA256 相同，Firebase project id 为 `jisudeng`，Android package 为 `com.jisudeng.chat`。`node scripts/validate-android-fcm-config.mjs --distribution=play` 明确使用 `android/app/src/play/google-services.json`。Play AAB 构建日志显示 `Applied google-services plugin from .../android/app/src/play/google-services.json`，merged manifest 含 Firebase Messaging service/provider、`com.jisudeng.chat.PUSH_OPEN` intent-filter，资源含 `google_app_id` / `gcm_defaultSenderId` / `project_id`。2026-08-12 Google Play AVD 实测：登录 200、bootstrap 200、Firebase 初始化成功、原生 FCM token 获取成功 `length=142`，`PUT /api/v1/mobile/devices/d95d27ce-bec0-4614-a707-c1f36196c29c status=200`；线上 worker 推送 `mobile_push_outbox.id=415 pending -> sent`，delivery `sent`；真实任务完成推送前台收到 `JisudengPushService: FCM message received event_type=task.completed source_type=mobile_task`，后台系统通知展示 `mobile_task:<task_id>` 且可点回 APP。旧后端 payload 缺 Android `click_action` 导致后台系统通知点击不能稳定把 payload 分发给前端；已补后端 `click_action=com.jisudeng.chat.PUSH_OPEN` 和 APP push-open 解析/任务路由，后端补丁部署后必须复验后台真实点击业务跳转。 |
| 账号删除 | PARTIAL / CONFIG BLOCKER | APP 资料与安全页已新增“注销账号申请”：用户填写原因、验证码/动态码、`DELETE` 确认短语后，经 `/api/v1/mobile/support/tickets` 或 legacy `/api/v1/play/mobile-feedback` 提交 `account_deletion_request` 工单，后台人工核验余额、订单和留存要求后禁用/删除。网页申请入口建议用现有公开 `/legal/:documentId`：管理后台新增 `id=account-deletion` 文档后，在 Play Console 填 `https://www.jisudeng.com/legal/account-deletion`；未配置前仍是提审阻塞。官方要求参考：<https://support.google.com/googleplay/android-developer/answer/13327111>。 |
| 隐私政策 / Data Safety | UNKNOWN | 需要 Play Console 中公开隐私政策 URL，并按实际收集的数据申报账号信息、OAuth、聊天/图片内容、反馈、设备安装 ID、FCM token、诊断、支付/余额等。官方参考：<https://support.google.com/googleplay/android-developer/answer/10144311> 和 <https://support.google.com/googleplay/android-developer/answer/10787469>。 |
| AI 生成内容举报 | PASS（代码），UNKNOWN（运营） | 聊天与图片结果有举报入口，反馈类型为 `ai_content_report` 并提交 `/api/v1/play/mobile-feedback`；后台处理时效和处置流程仍需运营验收。官方政策参考：<https://support.google.com/googleplay/android-developer/answer/14916972>。 |
| OAuth 快捷登录 | PASS（代码），UNKNOWN（真机/控制台） | Google/GitHub start/callback 与 Android deep link 回传存在；仍需 Play 包环境验证 provider redirect、首次注册、失败重试和回调恢复。 |
| 签名与升级 | UNKNOWN | 本地 AAB 有构建/upload 签名证书；最终 Play App Signing 证书、历史版本覆盖安装和 Firebase/Google OAuth SHA 指纹必须在 Play Console / Firebase Console 核对。 |
| Play AAB 模拟器验收 | STATIC PASS / APK SMOKE PASS / AAB INSTALL PENDING | Play AAB 已生成并静态检查通过：`dist/android/play/app-play-release-3.0.0-300.aab`，SHA256 `5a323efce0ec17f71b00022448a438728b21055f4ea71e4ee9c6f094bdc7d178`。同一 Play flavor/source/signing 生成的 `app-play-release.apk` 已安装到 Google Play AVD，SHA256 `cec94ef09420e8ca0e80ae112aef75c11167f0f717759f5a2beab493fa0c78b3`，版本 `3.0.0 (300)`、`targetSdk=36`、`POST_NOTIFICATIONS granted=true`、MainActivity 注册 `com.jisudeng.chat.PUSH_OPEN`。AAB 本体仍需 bundletool 或 Play internal testing 安装验收。 |

## Play Billing 当前实现边界

已完成：

- Android 原生桥接 `queryPlayBillingProducts`、`launchPlayBillingPurchase`、`queryPlayBillingPurchases`、`consumePlayBillingPurchase`、`acknowledgePlayBillingPurchase`。
- `android/app/build.gradle` 引入 `com.android.billingclient:billing:9.1.0`。
- Play 版充值/套餐页改为 Play Billing 商品面板；国内版 USDT、PayNow、第三方购码入口不受影响。
- APP 不硬编码 SKU；从后端 checkout/plans 识别 `google_play_product_id`、`play_billing_product_id`、`android_product_id` 等字段。
- APP 购买成功后只提交 purchase token 给后端验单，不在本地直接增加余额或权益。
- 后端隔离 worktree `/home/codex/worktrees/sub2api-play-billing-20260811` 新增 `/api/v1/mobile/play-billing/purchases` handler、Android Publisher API HTTP verifier、服务端商品映射、幂等 `payment_orders` 入账、余额/套餐履约复用、单测和移动协议登记。

未完成 / 必须补齐：

- Google Play Console 创建 one-time product / subscription，并把商品 ID 写入后端 `MOBILE_PLAY_BILLING_PRODUCTS_JSON` 或同名 settings 键。
- 后端配置 `PLAY_BILLING_SERVICE_ACCOUNT_FILE` 或 `PLAY_BILLING_SERVICE_ACCOUNT_JSON`，服务账号必须在 Play Console 授权访问 Android Publisher API。
- 用 Play internal testing 跑至少一笔真实购买，确认 Google 验单、订单完成、余额/套餐刷新、client consume/acknowledge 全链路通过。
- 对退款、撤销、RTDN 做运营补偿和后续自动化；未完成前不能把 Play Billing 标记为最终端到端验收通过。

## FCM 修复边界

已完成：

- 新增 `scripts/validate-android-fcm-config.mjs`，校验 Firebase 配置存在且 Android package 为 `com.jisudeng.chat`。
- `package.json` 的 `android:build` 和 `android:bundle:play` 在导出/打包前先跑 FCM 配置校验。
- `android/app/build.gradle` 的 release 任务在缺少真实 Firebase 配置时直接失败；存在配置时会校验包名再应用 `com.google.gms.google-services`。
- Gradle / 校验脚本现在优先读取 flavor 专属配置：`android/app/src/play/google-services.json` 或 `android/app/src/direct/google-services.json`；公共 `android/app/google-services.json` 只作为兜底，避免两个渠道后续拆 Firebase project 时被公共文件遮蔽。
- `android/.gitignore` 忽略本地 `google-services.json`，避免把 Firebase 项目配置误提交。
- 2026-08-12 复测：Play 配置文件已放入 `android/app/src/play/google-services.json`，package 为 `com.jisudeng.chat`，project id 为 `jisudeng`；`ANDROID_VERSION_NAME=3.0.0 ANDROID_VERSION_CODE=300 corepack yarn android:release:play` 构建通过，AAB 内无 `pay.ldxp.cn`，Play manifest 无 `REQUEST_INSTALL_PACKAGES`。

需要 owner / Firebase 管理员提供：

- direct 如需独立 Firebase app/project，再补 `android/app/src/direct/google-services.json`；当前 direct 使用公共 `android/app/google-services.json` 兜底。
- 服务端 FCM HTTP v1 service account / 发送凭据，并确认后端推送 worker 已指向 Firebase project `jisudeng`。
- Play App Signing 证书 SHA-1 / SHA-256 指纹补登记到 Firebase / Google OAuth 控制台。
- 详细配置手册：`docs/audit/2026-08-11-firebase-fcm-and-play-console-runbook.md`。

配置补齐后的验收顺序：

1. `node scripts/validate-android-fcm-config.mjs --distribution=play`
2. `NEXT_PUBLIC_SUB2API_BASE_URL=https://api.jisudeng.com NEXT_PUBLIC_NEXTCHAT_WEB_URL=https://www.jisudeng.com ANDROID_VERSION_NAME=3.0.0 ANDROID_VERSION_CODE=300 corepack yarn android:release:play`
3. 检查 AAB/merged resources 含 `google_app_id`、`gcm_defaultSenderId`。
4. 用 `bundletool` 或 Play internal testing 安装 Play AAB；本地 APK 烟测不能替代 AAB 安装验收。
5. 登录后确认客户端拿到 FCM token，并成功调用 `PUT /api/v1/mobile/devices/:installation_id`。
6. 从服务端发送测试通知，模拟器/真机前台和后台均能收到，点击通知能回到 APP 对应页面。

## 当前不可再作为“最终可提审”引用的旧产物

这些产物仍可作为 UI/UX 静态验证证据，但生成时间早于真实 Firebase 配置上传，不应作为最终上架包或最终国内发布包：

```text
delivery-bundles/android-final/2026-08-11/direct-2.0.92-292-uiux-fixes/jisudengchat-direct-2.0.92-292-uiux-fixes.apk
SHA256: c4ec65ea2497e8132ad180233f5df21046f3347749eb46b4d4274e1220b40b31

delivery-bundles/android-final/2026-08-11/play-3.0.0-300-uiux-fixes/jisudengchat-play-3.0.0-300-uiux-fixes.aab
SHA256: 5a1ce093736c35d78ed28e4542d8972f1deee98988547c2449a96376b12a133a
```

当前重新构建的 Play AAB：

```text
/home/codex/worktrees/nextchat-mobile-closeout/dist/android/play/app-play-release-3.0.0-300.aab
SHA256: 5a323efce0ec17f71b00022448a438728b21055f4ea71e4ee9c6f094bdc7d178
```
