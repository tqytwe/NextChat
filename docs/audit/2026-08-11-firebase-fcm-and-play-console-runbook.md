# 2026-08-11 Firebase / FCM / Play Console 配置手册

范围：`/home/codex/worktrees/nextchat-mobile-closeout` Android APP，以及后端
`/home/codex/worktrees/sub2api-play-billing-20260811/backend`。

状态：代码已接入 FCM 客户端注册、后端移动设备注册、后端 FCM outbox/worker、Play
Billing 客户端桥接与服务端验单；Firebase Android 客户端配置已上传并通过 Play 构建/模拟器烟测。2026-08-12 已在 Google Play system image AVD 上完成客户端 FCM token 获取、设备注册、服务端 worker 发送、APP 前台真实接收、APP 后台系统通知展示和通知点击回 APP 验收。实测发现旧后端 FCM payload 缺少 Android `click_action` 时，后台系统托管通知点击只能恢复 APP，不能稳定把 `event_type/source_type/source_id` 业务 payload 分发给前端；已在 `/home/codex/worktrees/sub2api-play-billing-20260811/backend` 补 `click_action=com.jisudeng.chat.PUSH_OPEN`，并在 APP Manifest/native/frontend 补齐 `PUSH_OPEN`、`kind/status`、任务通知路由和旧 intent 清理。该后端补丁未部署，部署后必须重新做后台真实点击带业务跳转验收。不要伪造 `google-services.json`，不要把任何 JSON 密钥提交进 Git。

## 当前平台固定值

| 项目 | 当前值 |
|---|---|
| Android package / applicationId | `com.jisudeng.chat` |
| Android app name | `JisudengChat` |
| Play 首发版本线 | `3.0.0` / `300` |
| 国内直发版本线 | `2.0.x`，当前计划产物 `2.0.92` / `292` |
| Play AAB 命令 | `ANDROID_VERSION_NAME=3.0.0 ANDROID_VERSION_CODE=300 yarn android:release:play` |
| 国内 APK 命令 | `ANDROID_VERSION_NAME=2.0.92 ANDROID_VERSION_CODE=292 yarn android:release` |
| FCM 客户端上报接口 | `PUT /api/v1/mobile/devices/:installation_id` |
| Play Billing 验单接口 | `POST /api/v1/mobile/play-billing/purchases` |
| 国内兑换码店铺 | `https://pay.ldxp.cn/shop/4B4R3T44`，仅 direct APK 可见 |
| 已验证 Firebase project | `jisudeng` |
| 已验证 Firebase sender/project number | `227074679923` |

## Firebase Android 配置

目标：让 Android 客户端能拿到真实 FCM token，并把 token 注册到后端。

1. 打开 Firebase Console，创建或选择极速蹬 APP 使用的 Firebase project。
2. 在该 Firebase project 中添加 Android app。
3. Android package name 必须填写：

   ```text
   com.jisudeng.chat
   ```

4. 下载 Firebase Console 生成的 `google-services.json`。不要手写，不要复制其他包名的文件。
5. 在 Dell 构建服务器，也就是当前环境，放入下面二选一位置：

   ```text
   /home/codex/worktrees/nextchat-mobile-closeout/android/app/google-services.json
   ```

   当前已上传并验证的 Play 文件为：

   ```text
   /home/codex/worktrees/nextchat-mobile-closeout/android/app/src/play/google-services.json
   ```

   当前公共兜底文件也存在：

   ```text
   /home/codex/worktrees/nextchat-mobile-closeout/android/app/google-services.json
   ```

   如果 Play / 国内 direct 要拆不同 Firebase app 或不同 Firebase project，则分别放：

   ```text
   /home/codex/worktrees/nextchat-mobile-closeout/android/app/src/play/google-services.json
   /home/codex/worktrees/nextchat-mobile-closeout/android/app/src/direct/google-services.json
   ```

6. 这些文件已在 `.gitignore` 忽略，禁止提交。
7. 本地校验命令：

   ```bash
   cd /home/codex/worktrees/nextchat-mobile-closeout
   node scripts/validate-android-fcm-config.mjs --distribution=play
   node scripts/validate-android-fcm-config.mjs --distribution=direct
   ```

   通过时会显示使用的 `google-services.json` 路径和 Firebase project id。Play 应优先显示 `android/app/src/play/google-services.json`；direct 如未提供 `android/app/src/direct/google-services.json`，会使用公共 `android/app/google-services.json` 兜底。失败时不要继续出包。

## Play App Signing / OAuth 指纹

目标：Play 包、Firebase 和 Google OAuth 使用同一套真实签名指纹。

1. Google Play Console → Setup → App integrity。
2. 复制 App signing key certificate 的 SHA-1 和 SHA-256。
3. Firebase Console → Project settings → Your apps → Android app
   `com.jisudeng.chat`，添加 SHA-1 / SHA-256。
4. 如果 APP 内 Google 快捷登录走 Android package 指纹，也要到 Google Cloud Console
   的 OAuth client / Firebase Authentication provider 中同步这些 SHA 指纹。
5. 国内 direct APK 如果使用自己的 keystore，也需要把 direct keystore 的 SHA-1 /
   SHA-256 加到同一个 Firebase Android app，或者使用单独 direct Firebase app。

## 服务端 FCM HTTP v1 配置

目标：后端 worker 能通过 Firebase Cloud Messaging HTTP v1 API 发推送。

1. 在 Firebase / Google Cloud 中为同一个 Firebase project 创建 service account。
2. 下载 JSON 密钥，存放在仓库外，例如：

   ```text
   /secure/firebase/jisudeng-fcm-service-account.json
   ```

3. 后端环境变量：

   ```bash
   MOBILE_PUSH_ENABLED=true
   FCM_PROJECT_ID=<firebase-project-id>
   FCM_SERVICE_ACCOUNT_FILE=/secure/firebase/jisudeng-fcm-service-account.json
   ```

4. 只有 secret manager 不方便挂文件时才使用：

   ```bash
   FCM_SERVICE_ACCOUNT_JSON='<完整 service account JSON>'
   ```

   `FCM_SERVICE_ACCOUNT_FILE` 与 `FCM_SERVICE_ACCOUNT_JSON` 只能二选一。

5. 后端还需要已配置持久的 `totp.encryption_key`，因为 FCM token 会加密存储。

## FCM 端到端验收

配置完成后，按下面顺序验收：

1. 运行 FCM 配置校验：

   ```bash
   cd /home/codex/worktrees/nextchat-mobile-closeout
   node scripts/validate-android-fcm-config.mjs --distribution=play
   node scripts/validate-android-fcm-config.mjs --distribution=direct
   ```

2. 构建 Play AAB / 国内 APK。正式 release 如果缺 FCM 配置会失败；能打包说明
   `google-services.json` 已进入 Android 构建。2026-08-12 已验证：

   ```text
   dist/android/play/app-play-release-3.0.0-300.aab
   SHA256: 5a323efce0ec17f71b00022448a438728b21055f4ea71e4ee9c6f094bdc7d178
   ```

3. 用 Play internal testing 或 bundletool 安装 Play AAB；用 APK 安装 direct 版。同一 Play flavor/source/signing 的 release APK 已在 `Jisudeng_API35` 通过基础烟测，但不能替代 AAB 安装验收。
4. 登录 APP。
5. 确认 Android 侧请求了通知权限。
6. 后端日志或网关记录必须出现：

   ```text
   PUT /api/v1/mobile/devices/<installation_id>
   ```

   请求体包含 `fcm_token`，后端响应不能泄露明文 token，只能返回设备记录或 token 指纹。
7. 从后端触发一条测试通知，至少覆盖：

   - APP 前台可收到；
   - APP 后台可收到系统通知；
   - 点击通知能回到 APP；
   - 后端 `mobile_push_outbox` / `mobile_push_deliveries` 记录为 sent，失败时保留错误摘要。

### 2026-08-12 Google Play AVD FCM 实测记录

已新建 Google Play AVD，不覆盖旧模拟器：

```text
AVD: Jisudeng_Play_API35
System image: system-images;android-35;google_apis_playstore;x86_64
Device: Pixel 7
```

本轮安装包：

```text
APK: /home/codex/worktrees/nextchat-mobile-closeout/android/app/build/outputs/apk/play/release/app-play-release.apk
SHA256: cec94ef09420e8ca0e80ae112aef75c11167f0f717759f5a2beab493fa0c78b3

AAB: /home/codex/worktrees/nextchat-mobile-closeout/dist/android/play/app-play-release-3.0.0-300.aab
SHA256: 5a323efce0ec17f71b00022448a438728b21055f4ea71e4ee9c6f094bdc7d178
```

第一轮无代理 / 未配置 Google 出口时，已通过：

- APK 安装成功；
- APP 冷启动成功；
- 邮箱密码登录成功，`POST /api/v1/auth/mobile/login status=200`；
- 移动端 bootstrap 成功，`GET /api/v1/nextchat/mobile/bootstrap status=200`；
- Firebase 初始化成功，`FirebaseInitProvider: FirebaseApp initialization successful`；
- 原生桥开始请求 FCM token，`JisudengNative: FCM token request started`；
- token 获取失败时 APP 已把诊断上报到后端，`POST /api/v1/mobile/diagnostics status=200`。

第一轮未通过：

```text
JisudengNative: FCM token request timed out after 20000ms
GCM-GMS: Failed to get direct boot token: java.io.IOException: AUTHENTICATION_FAILED
```

网络分层证据显示第一轮失败是 Dell 测试环境到 Google/Firebase 的出口阻塞，不是 Android SDK 权限问题：

- 主机 `curl -4 https://firebaseinstallations.googleapis.com/` 超时；
- 主机 `curl -4 https://fcmregistrations.googleapis.com/` 超时；
- 模拟器 `dumpsys connectivity` 显示默认网络为 `PARTIAL_CONNECTIVITY`；
- 模拟器 Google 连通性探测 `https://www.google.com/generate_204` 失败；
- 本机 `127.0.0.1:2080` 属于 `NodeBabyLinkService`，不是可用于 HTTPS CONNECT 的通用代理，`curl -x http://127.0.0.1:2080 ...` 返回 proxy 404。

证据目录：

```text
/home/codex/worktrees/nextchat-mobile-closeout/test-results/android-emulator/play-fcm-google-play-avd-20260812/
```

随后使用 Dell 既有 Clash 出口，仅为当前模拟器启动临时本地转发代理：

```text
host: 127.0.0.1:18093
emulator http_proxy: 10.0.2.2:18093
```

该代理只用于本机模拟器验收，不是 APP 生产配置，不需要随包发布。连通性恢复后，第二轮仅清 APP 数据、不再清 GMS/GSF/Play Store，客户端 FCM 注册通过：

```text
08-12 12:38:52.893 POST /api/v1/auth/mobile/login status=200
08-12 12:38:53.991 JisudengNative: FCM token request succeeded length=142
08-12 12:38:53.993 PUT /api/v1/mobile/devices/d95d27ce-bec0-4614-a707-c1f36196c29c
08-12 12:38:54.983 PUT /api/v1/mobile/devices/... status=200
08-12 12:38:55.211 GET /api/v1/nextchat/mobile/bootstrap status=200
```

成功证据目录：

```text
/home/codex/worktrees/nextchat-mobile-closeout/test-results/android-emulator/play-fcm-google-play-avd-proxy-retry-20260812/
```

### 2026-08-12 服务端发送与真实通知实测记录

服务端 FCM HTTP v1 配置已由线上环境实际验证通过：

```text
MOBILE_PUSH_ENABLED=true
FCM_PROJECT_ID=jisudeng
FCM_SERVICE_ACCOUNT_FILE=/data/firebase/jisudeng-firebase-adminsdk-fbsvc-e34d5e2fbf.json
```

`/data/firebase/...json` 是线上实际使用路径；早期示例 `/secure/firebase/jisudeng-fcm-service-account.json` 当前线上不存在/未使用。Google/Firebase 网络连通性已验证：

```text
oauth2.googleapis.com:443 open
fcm.googleapis.com:443 open
```

后端数据库中存在刚登录的 Android 设备：

```text
user_id=4
device_id=b1b60a8d-427a-4a6a-aa36-c06d691b087b
app_version=3.0.0
last_seen_at=2026-08-12 04:38:54+00
```

受控测试推送记录：

```text
mobile_push_outbox.id=415
event_type=support.reply
pending -> sent
sent_at=2026-08-12 05:10:31+00
last_error_code=null

mobile_push_deliveries.id=1
outbox_id=415
device_id=b1b60a8d-427a-4a6a-aa36-c06d691b087b
status=sent
attempts=0
last_error_code=null
```

随后用测试账号在 Google Play AVD 触发真实移动任务完成推送：

```text
create-task f13cde76-c303-4bfd-b141-b5b4a1032b80 -> queued
transition-running -> 200
transition-completed -> 200
```

APP 前台真实 FCM 到达：

```text
JisudengPushService: FCM message received event_type=task.completed source_type=mobile_task has_source_id=true
```

APP 后台真实系统通知展示：

```text
0|com.jisudeng.chat|0|mobile_task:15e0ab4e-fa7a-485e-bbef-1641aeb912cc|10209
android.title=任务已完成
android.text=你在极速蹬发起的任务已处理完成
effectiveNotificationChannel=jisudengchat_push
contentIntent=startActivity
```

点击该后台系统通知后，APP 可回到前台；但旧后端 payload 未设置 Android `click_action`，在干净重启后真实后台通知点击只恢复 MAIN intent，未稳定分发 `jisudeng:push-open` 业务事件。已补代码：

- 后端 `/home/codex/worktrees/sub2api-play-billing-20260811/backend/internal/repository/mobile_push_fcm_sender.go`：Android notification 增加 `click_action=com.jisudeng.chat.PUSH_OPEN`，保留 tag/collapse key。
- APP `/home/codex/worktrees/nextchat-mobile-closeout/android/app/src/main/AndroidManifest.xml`：MainActivity 增加 `com.jisudeng.chat.PUSH_OPEN` intent-filter。
- APP `/home/codex/worktrees/nextchat-mobile-closeout/android/app/src/main/java/com/jisudeng/chat/MainActivity.java`：解析 `kind/status`，分发后清理旧 push intent。
- APP `/home/codex/worktrees/nextchat-mobile-closeout/app/components/mobile-app.tsx`：`mobile_task` 通知按 `kind` 跳到聊天、生图或任务列表。

新 APK 上 `PUSH_OPEN` 分发模拟验证通过：

```text
push open dispatched event_type=task.completed source_type=mobile_task source_id=codex-task-click
PUT /api/v1/mobile/devices/d95d27ce-bec0-4614-a707-c1f36196c29c status=200
```

后端补丁部署前不要把“后台真实点击带业务 payload 跳转”标记为最终通过。部署后重新验收：

1. 后端配置 `MOBILE_PUSH_ENABLED=true`、`FCM_PROJECT_ID=jisudeng`、`FCM_SERVICE_ACCOUNT_FILE=/secure/firebase/jisudeng-fcm-service-account.json`；
2. 从后端 worker / 管理后台触发测试通知；
3. 验证 APP 前台收到、后台系统通知收到、点击通知可回到 APP；
4. 点击后台真实通知后，APP logcat 必须出现 `push open dispatched event_type=... source_type=... source_id=...`；
5. 前端必须跳到对应页面：反馈进反馈、支付进订单、`mobile_task kind=chat` 进聊天、`kind=image` 进生图、其他任务进首页任务列表；
6. 后端 `mobile_push_outbox` / `mobile_push_deliveries` 记录为 sent 或保留失败摘要。

## Play Billing 配置

目标：Play 版数字余额、套餐/权益购买全部走 Google Play Billing；APP 不本地发放余额。

1. Google Play Console 中为 `com.jisudeng.chat` 创建商品。
2. 首发建议：余额充值和固定期限平台套餐都先用 one-time product。
3. 商品 ID 示例：

   ```text
   jisudeng.balance.50
   jisudeng.plan.pro.30d
   ```

4. Google Cloud / Play Console 创建 Android Publisher API service account，并授权访问该
   Play app。
5. 下载 JSON 密钥，存放仓库外：

   ```text
   /secure/google-play/android-publisher-service-account.json
   ```

6. 后端环境变量示例：

   ```bash
   PLAY_BILLING_PACKAGE_NAME=com.jisudeng.chat
   PLAY_BILLING_SERVICE_ACCOUNT_FILE=/secure/google-play/android-publisher-service-account.json
   MOBILE_PLAY_BILLING_PRODUCTS_JSON='[
     {"product_id":"jisudeng.balance.50","product_type":"inapp","order_type":"balance","amount":50,"pay_amount":7.99,"currency":"USD","formatted_price":"$7.99"},
     {"product_id":"jisudeng.plan.pro.30d","product_type":"inapp","order_type":"subscription","plan_id":7,"amount":19.99,"currency":"USD","formatted_price":"$19.99"}
   ]'
   ```

7. 验收必须走 Play internal testing 真实购买：

   - APP 展示 Play 商品；
   - Google Play 返回 `purchaseToken`；
   - APP 提交 `/api/v1/mobile/play-billing/purchases`；
   - 后端 Android Publisher API 验单成功；
   - `payment_orders` 幂等创建；
   - 余额 ledger 或套餐履约刷新；
   - APP 刷新权益；
   - 消耗型余额商品 consume，非消耗型/订阅型商品 acknowledge。

## Play 账号删除 / Data Safety

APP 内已实现“注销账号申请”，经移动反馈/工单通道提交
`account_deletion_request`，由后台人工核验余额、订单、退款和法定留存后禁用或删除。

Play Console 仍必须配置一个公开网页删除申请 URL。当前平台已经有可公开访问的
`/legal/:documentId` 路由；在管理后台的 `login_agreement_documents` 中新增一份：

```json
{
  "id": "account-deletion",
  "title": "账号注销与数据删除申请",
  "content_md": "# 账号注销与数据删除申请\n\n你可以在 JisudengChat APP 内进入「资料与安全 → 注销账号申请」提交申请。\n\n如果无法使用 APP，请使用注册邮箱联系平台客服，并提供账号邮箱、申请原因和可验证的身份信息。平台会在核验余额、订单、退款、争议和法定留存要求后处理账号禁用或删除。\n\n已完成删除或依法必须留存的数据范围，会按隐私政策说明处理。"
}
```

然后 Play Console 中填写：

```text
https://www.jisudeng.com/legal/account-deletion
```

如果已有正式隐私政策文档，建议同时配置：

```text
https://www.jisudeng.com/legal/privacy
```

## 官方依据

- Firebase Android setup：`https://firebase.google.com/docs/android/setup`
- FCM HTTP v1 授权：`https://firebase.google.com/docs/cloud-messaging/auth-server`
- Google Play Billing 集成：`https://developer.android.com/google/play/billing/integrate`
- Google Play 支付政策：`https://support.google.com/googleplay/android-developer/answer/9858738`
- Google Play 账号删除政策：`https://support.google.com/googleplay/android-developer/answer/13327111`
