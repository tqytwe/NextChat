# 极速蹬 Android APP 收口需求台账

> 唯一发布事实来源。**禁止写"全部完成"**。每项以真实证据为准：代码位置 / 接口 / 单测 / 模拟器 smoke / 真机 / 真实账号（普通+管理员）/ 生产响应。
> 状态取值：`未开始` / `审计中` / `代码就绪(仅单测)` / `模拟器已过` / `待真机` / `待真实账号` / `待凭据` / `超授权` / `已验收`。

## 0. 基线与环境（真实核验）

| 项 | 事实 | 证据 |
|---|---|---|
| APP 工作区 | `nextchat-mobile-closeout` ⟶ origin/main `eaddacb2`，CLEAN | git worktree |
| 后端工作区 | `sub2api-mobile-closeout` ⟶ origin/play/main `10246e875`，CLEAN | git worktree |
| 2.0.89(289) 后端 | 已并入 play/main（release 分支领先 0） | git rev-list |
| 禁碰网页工作区 | `sub2api-mobile-final-20260805`（46 处未提交），全程不碰 | git status |
| 生产站点/API | https://www.jisudeng.com / https://api.jisudeng.com | 只读探测 200 |
| 授权边界 | 生产仅**只读 + 无害幂等写**；禁下单/退款/提现/扣费 | 用户授权 |

## 1. 阶段1 基线门禁（改码前基准）

| 侧 | 门禁 | 结果 | 证据 |
|---|---|---|---|
| 后端 | check-fork-integrity.sh | **PASS (EXIT 0)** | 复跑日志 bvyfbh5u4 |
| 后端 | Go 单测 service/repo/handler/admin/routes/migrations/dto | 全 ok | fork-integrity |
| 后端 | 前端保护测试 BILLING-010/MARKETPLACE-013/RISK-013 等 | 全绿（补装 vitest 后） | 复跑日志 |
| 后端 | make build-backend + frontend lint:check/typecheck/test:run 完整 | **PASS**：make build-backend EXIT0（`-buildvcs=false`）；frontend lint:check EXIT0(design-governance base=10246e875)；typecheck(vue-tsc) EXIT0；test:run 103 files/**708 tests** passed | 本轮复跑（2026-08-05） |
| APP | corepack yarn install | OK (14.35s) | bvidhubi9 |
| APP | tsc --noEmit | **无编译错误** | b7acmng1g |
| APP | test:ci | **64→65 suites / 391→396 tests passed**（+#8 农场2 +#11 i18n parity3） | b7acmng1g；本轮复跑 65/396 |
| APP | android:emulator:smoke | **PASS (EXIT 0)**（emulator-5554，network-cycle 开）：baseline APK 2.0.89(289) 装载→COLD 启动 971ms→WebView 渲染真实本地化 UI(极速蹬 AI 工作台/Chats/余额¥26.28)→wifi/data 断开重连存活→3 张截图 md5 各异→logcat 2384 行 0 FATAL/0 ANR。**注：验的是基线 APK，非 #8/#11 源码改动（需重新构建 APK 才进包）**。工具注：脚本用 `rg`，本机 `rg` 是 harness 注入的 shell 函数不被非交互脚本继承，用 grep -P shim 垫平 | test-results/android-emulator/* |
| APP | verify-android-release-artifact.mjs | **PASS (EXIT 0)**：Verified canonical Android artifact public/downloads/jisudengchat-android.apk（验的是线上 2.0.89(289) 产物，非 #8/#11 源码改动） | 本轮复跑（2026-08-05） |
| APP | **#12 候选 APK 构建 + emulator smoke** | **PASS (EXIT 0)**（Task #7，2026-08-05）：`android:export` 打包 Web 资源（193.99s，导出时自动移除内置 prod APK/version.json）→ `cap sync` + `gradlew assembleRelease` 出**生产签名 release 变体** APK（versionCode **290**/versionName **2.0.90**，>289；7.64MB；label JisudengChat）。**签名核实**：`keystore.properties` + `keystores/nextchat-release.jks` 一直在项目内（gitignore 未跟踪，新 worktree 未带；此前误判"不在库"已纠正）；apksigner 验 `Signer #1 SHA-256 = cd7abbd7…627e`，与线上 android-version.json 的 signingCertificateSha256 **完全一致**=真生产签名。emulator-5554 装载（先卸载旧 debug 2.0.90 解签名冲突）→ 启动 Status ok → WebView 渲染真实登录 UI → wifi/data 断开重连存活 → 0 FATAL/0 ANR（app PID）。**#12 代码进包实证**：解包 APK 内 `page-*.js` 含 `liveTranscriptionModel`、`transcriptionModel`×9、cn `实时转写模型`、en `Live transcription`。**注**：验证的是功能进包 + 冷启存活，非真实登录后 Live 通话链路（需真实账号/真实 live 分组，仍待补）。工具注：`rg` shim 同上 | test-results/android-emulator-c12-release/* |

## 2. P0 聊天

状态：**审计中**（子代理运行中）。待填：分组/会话分离、首次发送才建会话、新会话继承最后模型、附件上传、原生长按选择/复制、返回层级、页面滚动、错误分类与重试、退出保留账号/清除全部/账号隔离。真机 + 真实账号验收待补。

## 3. P0 生图 + 内容工作台

状态：**审计中**（子代理运行中）。待填：capability 决定参考图编辑（不静默换模型）、多图独立任务/重试、真实错误不伪装网络错误、工作台镜头产出（主图/场景/细节/竖版/横幅/详情页留白）、本机项目/批次/镜头/集合聚合。真机验收待补。

## 4. P1 账户 + 增长

| 需求 | 状态 | 证据 |
|---|---|---|
| 套餐/卡券/用量进度 | 代码就绪(有单测) | mobile-subscription.ts; test/mobile-subscription.test.ts(6) |
| 中英文回退 | **已补齐(有单测)**（Task #11✓） | managed-mobile-i18n cn/en 全键对齐；新增递归 parity 测试(键路径集合 + 叶子类型 function/string/object 逐点比对 + 非平凡遍历守卫)；负控已验证(注入 cn-only 键→精确报 theme.__negctrl_only_cn 并转红，恢复复绿)；见 §7 |
| 本机素材库 | 代码就绪(有单测) | local-materials.ts(账户隔离/上限/不上传); test/local-materials.test.ts |
| 分享 APP 海报 | 代码就绪(**缺单测**) | invite-growth.ts; mode:'app' 单QR + 三级回退无直接单测 |
| 玩法-签到/盲盒/答题/战队/邀请 | 代码就绪(有单测) | play-welfare.ts; test(11)+invite-growth.test(11); 后端 play.go 路由齐 |
| 玩法-**农场** | **已补齐(有单测)**（Task #8✓） | 农场=Token农场=Arena；APP 已接 daily/reward-summary + daily/current；client+i18n(cn/en 6键对齐)+UI三段渲染；typecheck绿；test:ci 393(新增2独立加载/降级测试) |
| 战队申请与队长审批 | 代码就绪(有单测) | mobile-app.tsx submit/decide; 队长身份服务端判定 |

真机（原生分享/奖励到账/降级态）+ 真实账号验收待补。

## 5. P1 管理员

| 需求 | 状态 | 证据 |
|---|---|---|
| capability 决定入口（fail-close） | **已验收(代码+生产)** | mobile-capabilities.ts; 生产:普通用户 admin.available=false(仅available键)/管理员 true(+api_base/step_up/compliance+6写操作) |
| 用户/订单/订阅/余额/模型/任务/工单/审计 真实详情 | **已验收(代码+生产)** | mobile-admin.ts allowlist→真实 canonical 路由; 生产管理员 TOTP 登录后 8/8 端点全 200 真实数据(users599/orders243/subs28/models35/usage/cleanup0/tickets6/audit35003); 审计日志首条即本次登录事件 |
| 退款/提现 TOTP step-up | 代码就绪(有单测) | admin.go stepUpAuth; 生产已证登录强制2FA；**写操作超授权，不执行** |
| 退款/提现 幂等键 | **已补齐(有单测)**（Task #10✓） | refund/withdrawal 的 approve/reject/mark_paid 6 动作全经 executeAdminIdempotentJSON 接入 IdempotencyCoordinator（与其余 20+ admin 写操作对齐）；payload 含 request_id 进指纹→同 key 不同笔 409 防误重放；6 scope 唯一；新增接线守卫测试(含负控)；见 §7 |
| request ID / 审计记录 | 代码就绪 | client_request_id.go; audit_log.go 对写操作 record=true |
| 普通用户不可见管理员 | **已验收(代码+生产)** | admin_auth.go IsAdmin→403; 生产普通用户 admin 块无接口线索 |

## 6. P1 联网 + 语音

状态：**审计已完成（主上下文源码级，2026-08-05）**。原"子代理运行中"作废（上会话子代理未回传，本轮改在主上下文完成）。

**联网工具循环（`runMobileWebSearchToolLoop`，mobile-chat-tools.ts:234）——达标，无缺口：**
- 双闸上限：`maxRounds` clamp [1,4]（默认3）、`maxToolCalls` clamp [1,8]（默认6）。
- 超轮次→抛本地化 `tool call limit reached`；超调用数→该工具返回本地化错误而非静默继续；非白名单工具名→`unsupported tool` 拒绝；空 query→`a valid query is required`；search 抛错→`boundedErrorMessage` 包裹进 tool 结果（不伪装网络错误、不中断循环）。
- 每次 search `sources.push({provider,requestId,query,results})`→引用可回溯。生产配置侧已证 `provider=duckduckgo`、`model_tool_call_required=true`、`default_enabled=true`、`max_results=10`、`timeout_ms=8000`。

**Live/语音全链路（`startLiveVoiceConversation` mobile-app.tsx:7135 + `mobileLiveSessionPayload`/`startMobileLiveSession` mobile-live.ts）——健壮：**
- Live LLM=`selectedModel||fallbackModel`；连接前 session 刷新/切组/`api_key` 校验齐；`AbortController` 全程护栏；`onState` failed 落 `chatError`；转写经 `onTranscript` 落会话（user done 去重、assistant delta/done 流式）；挂断/取消/`close(reason)` 路径完整。真实 live 分组验收待补（需真实账号）。

**转写模型/音色可选性——生产探测结论（Task #5，只读）：**
- 我持有的 `api.jisudeng.com`+`ANTHROPIC_AUTH_TOKEN` 只授权 claude-code 代理面，`GET /v1/models` 仅返回 Claude 聊天模型、**零** transcribe/realtime/voice/audio 条目 → 此面**无法**枚举 Live 转写模型/音色。
- 权威事实在后端源码：`ValidateLiveCallRequest`（openai_live.go:200）仅校验 SDP 非空 + Session 是合法 JSON；`model` 只读进计费/租约 record；`createUpstreamLiveCall`（:359）把 **Session blob 原样透传**给 ChatGPT `/backend-api/codex/realtime/calls` 上游。**后端不白名单、不改写 `input_audio_transcription.model` 与 `voice`**。
- **清单来源修正（初判"无可枚举清单"作废）**：ASR/TTS 模型确由平台登记 —— `model_prices_and_context_window.json` 带 `mode` 字段：5 个 `audio_transcription`（`gpt-4o-mini-transcribe`/`gpt-4o-transcribe`/`gpt-4o-transcribe-diarize`+日期变体/`whisper-*`）、4 个 `audio_speech`（`gpt-4o-mini-tts`/`gemini-2.5-flash-preview-tts`+变体）、1 个 `realtime`。分组 key 已加载的模型（`workspace.models.groups[].models`）本就含这些；`nextchat.go` 不按 mode 剥离，故 APP 客户端可直接过滤，**无需动后端、无需新增端点**。
- **架构边界（用户已确认，Task #6 范围）**：Live/Realtime 只吃 `voice`（`alloy/ash/.../verse`），**不吃"TTS 模型"**（`audio_speech` 只能走独立 `/v1/audio/speech`，而念回复是原生系统 TTS）。故本次 = ASR 转写模型可选（源=分组模型过滤）+ 音色 voice 可选（源=策展常量，因 voice 非模型目录条目）。服务端 TTS 念回复路径搁置为独立功能。

**语音模型可选性——Task #12 落地后的状态（2026-08-05）：**
| 能力 | 实现 | 可选性 |
|---|---|---|
| Live LLM | `model = selectedModel \|\| fallbackModel`，即分组所选聊天模型 | ✅ 可选（原有） |
| Live ASR | `input_audio_transcription.model` 现由偏好 `liveTranscriptionModel` 决定，空值回落 `gpt-4o-mini-transcribe` | ✅ **可选（Task #12）**：下拉源=分组模型过滤 `isTranscriptionModel` + 自定义输入 |
| Live 音色 voice | 现由偏好 `liveVoice` 透传，空值用服务端默认 | ✅ **可选（Task #12）**：下拉源=策展常量 `LIVE_VOICE_OPTIONS` + 自定义输入 |
| 按住说话/唤醒词 ASR | 安卓原生 `recognizeSpeech`（android-native.ts:812），系统识别器 | ❌ 设备能力（无模型概念） |
| TTS 念回复 | 安卓原生 `speakNativeText`，仅透传 `rate`（ttsRate 0.5–2x） | ❌ 仅语速；服务端 TTS 模型路径搁置为独立功能 |

即：Live 路的 LLM/转写模型/音色三者现均可选（未设置=零行为变化）；原生按住说话与念回复仍是设备能力，不在"选模型"范围。真实 live 分组验收待补（需真实账号）。

## 7. 本次收口已落地的真实改动

| # | 改动 | 侧 | 验证 | 发布状态 |
|---|---|---|---|---|
| Task #9 | step-up sudo 窗口 15min→60min（含安全权衡注释 + 全链路回归单测 TestVerifyStepUpGrantsConfiguredTTL） | 后端 | go build EXIT0；新测 PASS；既有 unit 测试全绿 | 仅本地 claude/mobile-closeout，未推未部署，待 PR→play/main 过 CI |
| Task #8 | 农场 arena 补齐日榜+结算明细（client 2 端点+类型+hub 装载；i18n cn/en 6 键对齐；UI 3 段渲染+数据绑定；2 新单测含单点失败降级不连坐） | APP | tsc EXIT0；test:ci 391→**393** passed；play-welfare.test.ts PASS | 仅本地，仅构建候选 APK，不替换线上下载文件 |
| Task #10 | refund/withdrawal 6 写动作接入 IdempotencyCoordinator（fund_handler.go + withdrawal_handler.go；每动作独立 scope + payload 含 request_id 进指纹）；新增接线守卫测试 TestFundWithdrawalWriteActionsRequireIdempotencyKey | 后端 | go build EXIT0；admin 包 untagged+`-tags unit` 全绿；**负控已验证**（临时移除包裹层→refund.approve 子测试转红 500≠400，恢复后复绿） | 仅本地 claude/mobile-closeout，未推未部署，待 PR→play/main 过 CI |
| Task #11 | i18n cn/en 自动 parity 测试（test/managed-mobile-i18n-parity.test.ts；递归比对键路径集合 + 叶子类型 + 非平凡遍历守卫，填补 Task #8 后无回归防护缺口） | APP | tsc EXIT0；test:ci 393→**396** passed（65 suites）；**负控已验证**（注入 cn-only 键→精确报 theme.__negctrl_only_cn 转红，恢复复绿） | 仅本地 claude/mobile-closeout，未推未部署 |
| Task #12 | Live 自选转写模型(ASR)+音色(voice)。纯 APP、**后端零改动/无新端点/无新环境变量**：mobile-live.ts 把 `input_audio_transcription.model` 参数化（`transcriptionModel`，空值回落 `gpt-4o-mini-transcribe`）并透传 `voice`，两处 session 构造点均接线；mobile-app.tsx 新增偏好 `liveTranscriptionModel`/`liveVoice`（读/写/规范化，旧存量 blob 缺键回落空串=零回归）+ `VoiceConversationSheet` 两个下拉（ASR=分组模型过滤+自定义；音色=策展常量+自定义）；分类器抽到纯模块 `mobile-model-kind.ts` 并**修正潜在 bug**（`isChatModel` 现排除 ASR/TTS，此前会混入聊天下拉） | APP | tsc EXIT0；test:ci 396→**405** passed（65→**66** suites，+新测 test/mobile-model-kind.test.ts + mobile-live 扩测）；i18n parity 3/3 PASS（6 键 cn/en 对齐）；**负控已验证**（向 isTtsModel 注入裸 `audio` 词→精确只令 native-audio realtime 用例转红、其余5绿，恢复复绿） | 仅本地 claude/mobile-closeout，未推未部署。**生产签名候选 APK 已构建+模拟器 smoke 通过**：release 变体 versionCode **290**/2.0.90（>289 门禁）；**真生产签名**（apksigner Signer#1 SHA-256=cd7abbd7…627e，与线上 signingCertificateSha256 一致；keystore 在项目内 gitignore 文件，此前误判"不在库"已纠正）；7.64MB（线上 2.0.89 亦 7.64MB）；emulator-5554 smoke EXIT0（install→launch Status ok→WebView 真实渲染登录 UI→wifi/data 断开重连存活→无 app-PID FATAL/ANR）；**#12 代码进包已证**（解包 APK 内 page-*.js 含 liveTranscriptionModel/transcriptionModel×9/实时转写模型/Live transcription）。候选 APK 未替换线上下载文件。**⚠️ 已被 Task #13 撤销**（用户决定取消全部 Live/语音新功能） |
| Task #13 | **撤销最近新增语音功能**（用户决定：取消 Live 实时通话 + 语音面板 + 念回复TTS + 唤醒词 + #12 选模型/音色；**保留最早 583946d0 的按住说话识别发送**）。删除 mobile-app.tsx 内 Live/唤醒词/TTS/`VoiceConversationSheet`/语音偏好全部符号 + 删除 `mobile-live.ts` + `mobile-live.test.ts`；`startVoiceTurn` 简化为仅 PTT 路径（剥离 autoSend/唤醒词分支）；分类器修复 `mobile-model-kind.ts` 保留（顺带修的聊天下拉 bug）；i18n 文件不动（保 parity；遗留死键无害、代码零引用） | APP | tsc EXIT0；test:ci **65 suites/400 tests** 全绿（校正 mobile-app-backend-alignment.test.ts 两条断言=删除的 VoiceConversationSheet/plainVoiceText，删后复绿）；**按住说话全链路存活已 grep 证**（recognizeSpeech/startForegroundPttSession/beginVoiceHold/moveVoiceHold/endVoiceHold/hold-bar 渲染全在）；**语音代码离包已证**（解包 2.0.91 APK：VoiceConversationSheet/startMobileLiveSession/input_audio_transcription 全=0；voiceHoldToTalk/voiceReleaseSend/voiceInput 各3）；死 i18n 键仅存 i18n 文件、代码零引用 | 已提交 `7b0c1bcd`（分支 claude/mobile-closeout，未推）。**生产签名 APK 已重建+归档**：versionCode **291**/2.0.91、真生产签名 cd7abbd7…627e、sha256 3e43f557…9d128、7.28MB；已按规范写入 public/downloads/（覆盖本地 2.0.90 归档，未触线上下载）。**注**：本次未跑 emulator smoke（纯删除、tsc+test:ci+离包证据已足），如需可补跑 |

## 8. 待补代码改动（已识别）

| 项 | 侧 | 来源 | 状态 |
|---|---|---|---|
| ~~农场补齐日榜 + 结算明细~~ | APP | Task #8 | **已完成**（见 §7） |
| ~~refund/withdrawal 接入 IdempotencyCoordinator（请求级幂等去重）~~ | 后端 | P1 管理员审计 + 生产 observe_only | **已完成**（Task #10，见 §7） |
| ~~i18n cn/en 自动 parity 测试~~ | APP | P1 账户审计（回归防护缺口） | **已完成**（Task #11，见 §7） |
| `mobileProtocol` 变量重命名/加注释（实由 /session/status 填充，命名误导审计） | APP | capability 异常定性 | 低优（不影响发布，下一项） |

## 9. 阻塞项

- **管理员只读详情探测**：需用户实时报新鲜 6 位 TOTP（token 用后即销毁）。
- **管理员写操作验收**：超"只读+无害幂等写"授权，不执行。
- **真机验收（范围决策 2026-08-05）**：本服务器**真机连不上**，用户明确定案「用模拟器即可」。`emulator-5554`（headless，`-no-window`，adb 允许操作本模拟器）**即本次验收界面**；台账中原「待真机」项一律以模拟器 smoke/交互为验收上限，真机不再作为阻塞项。
