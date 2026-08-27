# 2026-08-11 Android APP UI/UX 与双渠道交付核对

## 2026-08-16 APP 收口补充

本次只推进 APP 代码、构建和本地验收，未部署、未上传 Google Play，也未修改 `infinite-canvas`。国内版与 Play 版继续共用同一套 UI/UX；支付、外链和 Firebase 配置只按渠道分流。

- 修复底部五个主入口在 API 35 模拟器上被 CSS 四列网格挤成两行的问题。现在使用五等分固定网格、稳定栏高和最多两行标签，`Chat / Images / Local gallery / Activity / Account` 均保持同一行，内容滚动底部留白同步收紧。
- `public/downloads/android-version.json` 已同步到国内版 `3.0.2 (302)`，包含 2.0.92 与 3.0.1 的累计更新说明；该文件只代表本地待发布元数据，线上下载地址尚未替换。
- 重新生成并验证 Direct/Play release APK 与 Play AAB。两个 APK 的包名均为 `com.jisudeng.chat`、`versionName=3.0.2`、`versionCode=302`、Target SDK 36，签名指纹一致。
- FCM token 轮换链路已有原生 `onNewToken` 广播、JS 强制重新注册、恢复/联网重试和语言变更同步；本轮保留既有实现并通过原生桥与推送回归测试。

本轮产物与哈希：

```text
Direct APK: android/app/build/outputs/apk/direct/release/app-direct-release.apk
SHA256: d80be4bdbd35a1e2f40ab989ca835bb3a0954aab71ef079f0052c24fd06cf072
Canonical domestic handoff copy: public/downloads/jisudengchat-android.apk

Play APK: android/app/build/outputs/apk/play/release/app-play-release.apk
SHA256: 46266ea8690d02b9f131bd99cbd3807a0cce38104d844e9aafd9c5005ed8d540

Play AAB: dist/android/play/app-play-release-3.0.2-302.aab
SHA256: 2cdb7e6c38209721dea8945a701389d005fb19c88fc005ccc548c53dcbe8186d
```

本轮验证：

- `67 suites / 440 tests` 全量 Jest 通过；本轮底部导航门禁 `46 tests` 通过。
- `corepack yarn tsc --noEmit`、`git diff --check` 通过。
- Direct/Play release Java 编译、Direct 导出、Play 导出、Play 外部购买链接门禁均通过。
- API 35 `Jisudeng_Play_API35` 模拟器上，Direct/Play 两个 3.0.2 APK 均通过安装、冷启动、断网、恢复网络、UI 可见性、进程存活和崩溃/ANR 检查；产物分别见 `test-results/android-emulator/direct-release-3.0.2-ui-final` 与 `test-results/android-emulator/play-release-3.0.2-ui-final`。
- Maestro `01-cold-start-group.yaml` 与 `11-content-kit-output-plan.yaml` 通过；后者实际验证了内容工作台的计划数量、预设切换和商品一致性设置。
- 模拟器 XML 已确认五个底部入口同一行，未再出现 `Account` 第二行换行。

仍不能称为“正式上架完成”：Play Console 商品/服务账号/真实内部测试购买、Data Safety/隐私与网页删除入口、后端 FCM `click_action` 补丁部署后的真实点击复验，以及 Firebase 控制台最终数据验收仍需外部配置或部署授权。

下方原始章节保留 8 月 11 日的历史验收记录；当前版本、产物和状态以本补充章节为准。

范围：`/home/codex/worktrees/nextchat-mobile-closeout`，分支 `claude/mobile-closeout`。

状态：UI/UX、双渠道代码、Play Billing 原生入口、后端 Google 验单/订单履约代码、注销申请入口已实现并本地验证；Firebase Android 客户端配置已上传并完成 Play 构建/模拟器烟测；服务端 FCM HTTP v1 worker 已验证能发送，APP 前台真实接收和后台系统通知展示已通过。后台真实通知点击业务 payload 需要后端 `click_action` 补丁部署后复验；Play Billing 真实控制台配置仍有阻塞项。未部署、未上传 Google Play、未提交。

## 渠道规则

- 国内直发 APK：继续 `2.0.x` 版本线，本次产物为 `2.0.92(292)`。
- Google Play AAB：单独 `3.0.x` 版本线，本次产物为 `3.0.0(300)`。
- 两个版本共用同一套移动端 UI/UX 和多语言资源；只按发行渠道隐藏或展示合规相关能力。
- 国内版保留外部兑换码店铺 `https://pay.ldxp.cn/shop/4B4R3T44`。
- Play 版不得展示或打包第三方购买链接；数字余额/套餐购买走 Google Play Billing，兑换码中心只保留已有码兑换能力。

## 用户问题逐项收口

| # | 要求 | 当前处理 |
|---|---|---|
| 1 | 分享 APP 不应放在账户页下面，二维码要绑定邀请链路 | 分享入口移入邀请活动页；分享海报/二维码使用邀请注册链接和 APP 下载链接，带 `aff_code`、`campaign_id`、`invite_token`、`source=invite_poster_app_qr`。 |
| 2 | 充值套餐、兑换码中心、购买兑换码重复；优先 APP 内打开，允许外部浏览器；微信支付替换按钮不能灰 | 充值页移除重复的购买兑换码区块；兑换码中心保留购买入口；新增网页打开方式设置：APP 内加载或外部浏览器；国内版微信支付行改为清晰主按钮“去第三方购买兑换码”；USDT、PayNow 与其他非微信支付继续走移动端支付 API。 |
| 3 | 登录用户需要个人资料、改密码、找回密码、2FA；Play 需要账号删除入口 | 新增账户资料/安全页：头像 URL、昵称/资料保存、修改密码、忘记/重置密码入口、TOTP 状态/设置/启用/停用/发送验证码。新增“注销账号申请”，用户填写原因、验证码/动态码、`DELETE` 确认短语后，经反馈/工单通道提交 `account_deletion_request`，后台人工核验后禁用/删除；不在 APP 内直接删除账号。 |
| 4 | 国内版和 Play 版 UI/UX 要统一 | 样式和组件共用同一套移动端 UI；渠道差异只在支付、外链、更新检查等合规入口上分流。 |
| 5 | 服务中心四个常用入口无效/误导 | 账户首页服务中心改为资料安全、福利活动、权益/账单或兑换、邀请活动、反馈记录等真实入口；移除误导性的“我的项目与图库/帮助与设置”主入口。 |
| 6 | 中文订单显示英文 | 订单标题和状态增加本地化映射；动态套餐、卡券、支付方式字段优先读取当前语言字段。 |
| 7 | 客服未接实时客服就不要独立入口 | 客服工单并入反馈记录页；反馈页展示工单列表、状态、详情和回复。 |
| 8 | 余额符号 | 余额和金额继续统一显示美元符号 `$`。 |
| 9 | 快捷登录 | 移动登录保留 Google 与 GitHub OAuth 快捷登录链路，native bridge 会把 OAuth callback 回传 APP。 |
| 10 | 日语、韩语 | 移动端文案现在按 `cn/en/jp/ko` 四语言结构校验；新增 `managed-mobile-i18n-parity` 门禁防止漏翻键，并检查 `jp/ko` 不得静默回退到英文用户文案。 |

## 主要代码入口

- `app/components/mobile-app.tsx`
  - `DirectWechatReplacementPaymentButton`
  - `AndroidPlayBillingPanel`
  - `Path.AccountDirectCodeShop`
  - `Path.AccountProfile`
  - `submitAccountDeletionRequest`
  - `purchasePlayBillingItem`
  - `localizedOrderTitle`
  - 邀请分享、反馈/工单、资料安全、Play/Direct 分流
- `app/client/managed-mobile-i18n.ts`
  - `cn/en/jp/ko` 四语言移动端文案
- `app/client/mobile-display.ts`
  - 服务端返回的显示字段按当前语言优先取值
- `package.json`
  - `android:export:direct`
  - `android:export:play`
  - `android:build`
  - `android:bundle:play`
- `scripts/check-android-play-assets.mjs`
  - Play 构建后禁止出现 `pay.ldxp.cn` 等外部购买链接
- `app/client/android-native.ts`
  - Google Play Billing 原生桥接
- `app/client/mobile-platform.ts`
  - `/api/v1/mobile/play-billing/purchases` purchase token 提交客户端
- `/home/codex/worktrees/sub2api-play-billing-20260811/backend/internal/service/mobile_play_billing.go`
  - Google Play Android Publisher API 验单、商品映射、purchase token 幂等订单、余额/套餐履约复用

## 验证记录

已通过：

```bash
corepack yarn tsc --noEmit --pretty false
corepack yarn test:ci --runInBand test/android-play-distribution.test.ts test/mobile-app-backend-alignment.test.ts test/managed-mobile-i18n-parity.test.ts test/mobile-display.test.ts
corepack yarn test:ci --runInBand test/android-fcm-config.test.ts test/android-play-distribution.test.ts test/managed-mobile-i18n-parity.test.ts
corepack yarn test:ci --runInBand test/android-fcm-config.test.ts test/android-play-distribution.test.ts test/mobile-app-backend-alignment.test.ts test/managed-mobile-i18n-parity.test.ts
corepack yarn test:ci --runInBand test/android-fcm-config.test.ts test/android-play-distribution.test.ts test/mobile-app-backend-alignment.test.ts test/managed-mobile-i18n-parity.test.ts test/mobile-display.test.ts
corepack yarn test:ci --runInBand
corepack yarn lint
git diff --check
node scripts/check-android-play-assets.mjs
node scripts/validate-android-fcm-config.mjs --distribution=play
node scripts/validate-android-fcm-config.mjs --distribution=direct
NEXT_PUBLIC_SUB2API_BASE_URL=https://api.jisudeng.com NEXT_PUBLIC_NEXTCHAT_WEB_URL=https://www.jisudeng.com ANDROID_VERSION_NAME=3.0.0 ANDROID_VERSION_CODE=300 corepack yarn android:release:play
ANDROID_VERSION_NAME=3.0.0 ANDROID_VERSION_CODE=300 ./gradlew assemblePlayRelease
ANDROID_APK_PATH=android/app/build/outputs/apk/play/release/app-play-release.apk ANDROID_EXPECTED_VERSION=3.0.0 ANDROID_SMOKE_NETWORK_CYCLE=1 ANDROID_SMOKE_ARTIFACT_DIR=test-results/android-emulator/play-release-3.0.0-300 corepack yarn android:emulator:smoke
cd android && ./gradlew :app:compilePlayDebugJavaWithJavac :app:compileDirectDebugJavaWithJavac
```

测试结果：

- 最新核心移动端测试：5 suites / 67 tests 通过。
- FCM/Play/多语言门禁测试：3 suites / 17 tests 通过。
- 全量测试：67 suites / 426 tests 通过。
- lint：无错误；仍有既有 `<img>` 与 React hook dependency warnings。
- Play 外链静态检查：`[Android Play Assets] no external purchase links found`。
- FCM release gate：Play 使用 `android/app/src/play/google-services.json`；direct 当前使用公共 `android/app/google-services.json` 兜底；两者 package 均为 `com.jisudeng.chat`。
- Play AAB 构建：`dist/android/play/app-play-release-3.0.0-300.aab`，SHA256 `5a323efce0ec17f71b00022448a438728b21055f4ea71e4ee9c6f094bdc7d178`。
- Play flavor release APK 模拟器烟测：Google Play AVD 通过安装、启动、FCM token 注册、PUSH_OPEN 模拟分发检查，版本 `3.0.0 (300)`。
- Android Java 编译：`:app:compilePlayDebugJavaWithJavac` 与 `:app:compileDirectDebugJavaWithJavac` 通过。
- 日语/韩语补充验收：`jp`、`ko` 各 1081 个字符串键，可疑英文回退均为 0。

## 构建产物

国内直发 APK：

```text
/home/codex/worktrees/nextchat-mobile-closeout/delivery-bundles/android-final/2026-08-11/direct-2.0.92-292-uiux-fixes/jisudengchat-direct-2.0.92-292-uiux-fixes.apk
SHA256: c4ec65ea2497e8132ad180233f5df21046f3347749eb46b4d4274e1220b40b31
```

Play AAB：

```text
/home/codex/worktrees/nextchat-mobile-closeout/dist/android/play/app-play-release-3.0.0-300.aab
SHA256: 5a323efce0ec17f71b00022448a438728b21055f4ea71e4ee9c6f094bdc7d178
```

Play flavor release APK：

```text
/home/codex/worktrees/nextchat-mobile-closeout/android/app/build/outputs/apk/play/release/app-play-release.apk
SHA256: cec94ef09420e8ca0e80ae112aef75c11167f0f717759f5a2beab493fa0c78b3
```

## 模拟器验证

使用服务器 Android SDK：`/home/dell/Android/Sdk`。

AVD：`Jisudeng_API35`。

最终复测命令在同一 shell 会话内启动模拟器、等待 `boot_completed=1`、安装 APK、启动 APP、抓截图/XML/logcat、切换断网/恢复网络、检查崩溃和 ANR，结果：

```text
Android smoke test passed.
Package: com.jisudeng.chat
Version: 2.0.92 (292)
Artifacts: /home/codex/worktrees/nextchat-mobile-closeout/test-results/android-emulator-direct-uiux-fixes-final
```

Play flavor release APK 复测：

```text
Package: com.jisudeng.chat
Version: 3.0.0 (300)
Target SDK: 36
POST_NOTIFICATIONS: granted=true
MainActivity intent-filter: com.jisudeng.chat.PUSH_OPEN
PUSH_OPEN模拟分发: push open dispatched event_type=task.completed source_type=mobile_task source_id=codex-task-click
FCM token上报: PUT /api/v1/mobile/devices/d95d27ce-bec0-4614-a707-c1f36196c29c status=200
Artifacts: test-results/android-emulator/play-release-3.0.0-300
```

当前 Google Play AVD 仍保留用于继续验收；如需释放资源，可在后续确认无任务后关闭。

## 未声称完成的事项

- 没有部署、没有上传 Play。
- 已实现应用内注销申请入口；网页删除申请链接建议用现有 `/legal/:documentId`，在管理后台新增 `id=account-deletion` 后配置 `https://www.jisudeng.com/legal/account-deletion`。该内容未在生产后台配置、Play Console Data deletion 未填写前，不能标记为账号删除政策完全通过。
- FCM 客户端注册、Firebase Android config、真实登录后的 token 上报、服务端 worker 发送、APP 前台真实接收和后台系统通知展示均已通过；旧后端 payload 缺 Android `click_action` 导致后台系统通知点击不能稳定分发业务 payload。已补后端 `click_action=com.jisudeng.chat.PUSH_OPEN` 和 APP push-open 任务路由，但后端补丁未部署，部署后需重验后台真实点击到对应页面。
- Play Billing 已接 APP 原生入口、后端 Google API 验单代码、商品映射、订单幂等入账和余额/套餐履约复用；但 Google Play Console 商品、服务账号 JSON、生产映射和真实内部测试购买未配置，不能标记为 Play Billing 端到端通过。
- Firebase / FCM / Play Console 详细配置见 `docs/audit/2026-08-11-firebase-fcm-and-play-console-runbook.md`。
- Play 上架复审详见 `docs/audit/2026-08-11-android-play-readiness-review.md`。当前不能称为可提交审核。
