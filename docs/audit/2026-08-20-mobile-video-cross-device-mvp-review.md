# 移动端视频生成跨端归档一期评审稿

> 文档状态：评审稿，供主平台团队与正式创作空间团队讨论。不是开发合同，不代表任何功能已经合并、部署或通过生产验收。
>
> 当前范围：只做国内 Android APP；不包含 Play 版、不包含本次部署。本文以 2026-08-20 检查到的代码为依据；开发前仍须重新确认目标分支和部署版本。

## 1. 目标与一期边界

### 1.1 目标

用户在国内 Android APP 或正式创作空间生成的视频，最终归档为同一用户的持久作品。两端可以查看、播放、下载和删除同一作品；手机“下载到相册”只创建设备副本，不删除云端作品。

### 1.2 一期包含

- 国内 Android APP 生成视频后自动归档到正式创作空间。
- 正式创作空间的视频页面显示手机生成的作品。
- APP 通过主平台 BFF 查看电脑端和手机端的归档作品。
- 两端播放、下载、删除同一归档作品。
- 保留现有模型/分组校验、计费、轮询、取消、重试和审计逻辑。
- 采用分页列表、Range 播放和可重试交付，不把完整 MP4 一次加载到列表页。

### 1.3 明确不包含

- Play 版、Google Play Billing 或 Play 上架工作。
- 图片、音频、文档和普通素材的统一迁移。
- 旧版 Canvas、旧 IndexedDB 视频或旧 `mobile-assets` 的历史迁移。
- 把移动作品改造成画布节点、项目双向编辑或通用跨端素材平台。
- 会员套餐动态容量、全量媒体迁移和新的对象存储产品。

## 2. 事实基线：哪些已经存在，哪些还没有

### 2.1 正式创作空间（`infinite-canvas-official-6af9f33`）

正式创作空间是当前 Go 服务和数据库模型，不是旧版 Node/Vite Canvas。已存在的相关用户接口包括：

```text
POST /api/v1/files
GET  /api/files/:id
GET  /api/files/:id/content

POST /api/v1/videos
GET  /api/v1/video-tasks
GET  /api/v1/videos/:id
GET  /api/v1/videos/:id/content

GET  /api/v1/generation-logs/videos
POST /api/v1/generation-logs/videos
POST /api/v1/generation-logs/videos/delete
```

认证入口是 `POST /api/auth/platform/exchange`。正式数据模型已有 `StorageObject`、`VideoTask`、`VideoGenerationLog` 和 `UserAsset`。本地文件使用正式服务的媒体存储规则；不能在本方案中写成旧版的 `/data/infinite-canvas/users/<userId>/objects/` 或 `/api/storage/*` 合同。

正式 Canvas 用户有自己的本地 `user.ID`，并通过 `PlatformUserID` 关联主平台用户。主平台的数值 `user_id` 不能直接当作 Canvas 本地用户 ID 或 `StorageObject.CreatedBy`。

正式容量配置为：

```text
CANVAS_STORAGE_LIMIT_BYTES
CANVAS_STORAGE_RESERVE_BYTES
CANVAS_STORAGE_CLEANUP_THRESHOLD_BYTES
CANVAS_USER_STORAGE_LIMIT_BYTES
CANVAS_MAX_OBJECT_BYTES
```

当前代码还兼容旧的 `CANVAS_MAX_STORAGE_BYTES`，但它不是新方案应使用的正式变量名。默认值和线上值必须在开发前从目标 Canvas 环境重新读取，不能把默认值当作生产配额。

### 2.2 主平台移动视频

生产分支 `origin/play/main` 当前没有移动视频路由；移动视频任务、Worker、轮询和结果接口只在未合并工作树 `codex/mobile-video-direct-20260820` 中。该工作树还有未提交修改，因此本方案将它们全部标为“待开发/待合并”，不能写成生产已有能力。

该分支当前有 `mobile_video_jobs`、任务 Worker、创建/轮询/取消/重试、私有结果存储、`content`、`content/acknowledge` 和 `save-as-asset` 等实现。Worker 目前把视频结果读成 `[]byte`，硬上限是 `128 MiB`（`128 << 20`），不是 200MB，也不是已完成的流式链路。

### 2.3 桌面视频历史

桌面视频历史的服务端来源是 `video_generation_logs`、`video_tasks` 及其 `/api/v1/generation-logs/videos` 接口；浏览器 `localForage` 只是客户端缓存。`state:video-workbench` 和所谓 `state:mobile-video-workbench` 不能作为正式 Canvas 的跨端数据库合同。本期新增数据库表，不改写浏览器整段状态，也不覆盖现有桌面历史。

## 3. 最小可行架构

```text
国内 Android APP / 正式创作空间
                 |
                 v
主平台：鉴权、模型路由、计费、任务状态、重试、APP BFF
                 |
                 | 任务成功后的服务间签名流式交付
                 v
正式 Canvas：mobile_video_archives + StorageObject + Canvas 用户映射
                 |
                 +--> 桌面视频页查询并展示
                 +--> 主平台 BFF 查询、播放、下载、删除
```

职责边界：

- 主平台是 provider 任务、模型授权、计费、余额和账务审计的权威来源。
- Canvas 是成功视频二进制和跨端归档目录的权威来源。
- APP 不接触 Canvas Cookie、内部地址、物理路径或服务间密钥。
- IndexedDB/localForage 只做可清理的播放缓存，不能作为跨端唯一存储。
- 不新增对象存储产品；使用正式 Canvas 的 `StorageObject` 和持久卷/既有存储提供器。

## 4. 正式 Canvas 需要新增的最小能力

### 4.1 独立归档表

新增 `mobile_video_archives`，不要复用浏览器状态或覆盖 `video_generation_logs`。建议字段：

```text
id                         Canvas 归档 ID
canvas_user_id             Canvas 本地用户 ID
platform_user_id           主平台用户 ID（审计/映射）
source_task_id             主平台移动视频任务 ID
storage_object_id          StorageObject ID
provider_task_status       completed / failed / cancelled
archive_status             pending / delivering / delivered / deleting / deleted / failed
model, prompt              生成信息（按隐私策略决定是否脱敏）
resolution, ratio
duration_seconds
content_type, byte_size, sha256
created_at, updated_at, delivered_at, deleted_at
last_error_code, last_error_message
```

必须建立数据库唯一约束：

```text
UNIQUE (canvas_user_id, source_task_id)
```

不能只“先查询再插入”；并发重试必须由唯一约束和事务保证幂等。重复导入返回原 `asset_id`/归档记录，不生成重复对象。

### 4.2 服务间导入接口

新增受限内部接口，建议：

```text
POST /api/internal/mobile-video/archives/import
```

这不是浏览器用户接口，不直接复用 `/api/v1/files` 的 Cookie 认证。请求必须使用独立 HMAC 服务签名，签名至少覆盖：HTTP 方法、规范化路径、平台用户 ID、源任务 ID、过期时间、nonce、请求体摘要。服务端拒绝过期、重放、签名错误和用户映射不一致的请求。

请求元数据可以放在签名头或受限 JSON 头中，二进制走请求体：

```json
{
  "platform_user_id": 123,
  "source_task_id": "uuid",
  "model": "seedance-2.0",
  "prompt": "...",
  "resolution": "720p",
  "ratio": "16:9",
  "duration_seconds": 8,
  "content_type": "video/mp4",
  "content_length": 12345678,
  "sha256": "..."
}
```

Canvas 接收后必须：

1. 用 `platform_user_id` 查找/创建 `PlatformUserID` 对应的 Canvas 本地用户；禁止把平台 ID直接写入本地用户字段。
2. 校验内容类型、长度、单对象上限和 SHA-256。
3. 写临时文件，完成校验后原子提交 `StorageObject` 和 `mobile_video_archives` 事务。
4. 事务内处理唯一键冲突，返回已有归档记录。
5. 失败清理临时文件，不留下可被清理器误判的半成品。

请求链路必须是“上游响应流 -> 主平台受控临时文件/请求流 -> Canvas 临时文件”，不得再把完整视频读入 Go/Node 内存。当前 128 MiB 是移动分支事实，不是目标能力；在完成流式改造和压测前，不得宣称支持 200MB。最终单文件上限必须同时受主平台、Canvas `CANVAS_MAX_OBJECT_BYTES`、代理和移动网络超时约束。

### 4.3 查询、内容和删除

新增服务间接口，建议：

```text
GET    /api/internal/mobile-video/archives
GET    /api/internal/mobile-video/archives/:id/content
DELETE /api/internal/mobile-video/archives/:id
```

用户身份从签名主体映射，不信任 URL 中单独传入的 `user_id`。列表必须分页并返回归档元数据，不返回完整视频；内容接口支持 HTTP `Range`，并隐藏物理路径。

删除采用可恢复的顺序：

1. 事务内将归档标记为 `deleting`，阻止新的读取/删除竞争。
2. 检查 `StorageObject` 是否被 Canvas 项目、`UserAsset` 或其他引用保护。
3. 有引用返回 `409`，不自动解除引用、不静默破坏画布。
4. 无引用才删除对象；对象删除成功后软删除归档记录并记录审计。
5. 文件删除失败保留 `deleting`/错误信息，供后台重试，不先删除目录记录。

## 5. 主平台需要新增的最小能力

### 5.1 拆分生成和归档状态

provider 生成成功与 Canvas 归档成功不是同一状态。建议在 `mobile_video_jobs` 增加或等价持久化：

```text
provider_task_status: queued / processing / completed / failed / cancelled
archive_status: pending / delivering / delivered / failed
canvas_asset_id
canvas_storage_object_id
canvas_delivery_attempts
canvas_delivery_error
canvas_delivered_at
```

provider 已成功且已计费时，Canvas 暂时不可用只能进入归档重试；不能把生成任务伪装成失败，也不能自动退款。归档失败必须保留平台私有结果、账务记录和重试信息，直到交付成功或进入人工处理。

### 5.2 交付 Worker 与 outbox

新增独立归档 outbox/队列或在现有任务表中实现同等可靠性：

- 事务记录 `provider completed` 和 `archive pending`。
- Worker 可租约领取、超时回收、指数退避重试。
- 交付请求带固定 `source_task_id`，由 Canvas 唯一约束保证幂等。
- Canvas 返回归档 ID后再写入主平台；重复响应不得重复扣费或生成副本。
- 交付成功后才可清理临时结果；`content/acknowledge` 保留兼容响应，但不得删除 Canvas 云端作品。
- Worker 重启、网络超时和部分响应都必须可恢复。

### 5.3 APP BFF

保留主平台移动鉴权，新增：

```text
GET    /api/v1/mobile/video/library
GET    /api/v1/mobile/video/assets/:id/content
DELETE /api/v1/mobile/video/assets/:id
```

主平台校验 JWT 和用户归属，再用服务间签名访问 Canvas。列表返回分页元数据和 `asset_id/source_task_id`；内容由主平台代理并支持 Range。现有 `GET /api/v1/mobile/video/jobs/:id/content` 可在任务关联 `canvas_asset_id` 后继续代理，兼容旧客户端。

`POST /content/acknowledge` 保留兼容返回，但语义改为“客户端已收到/已确认”，不得删除云端归档。`save-as-asset` 不再上传手机本地 Blob，改为返回“已归档到创作空间”的作品信息；如另有用户主动保存为素材的需求，另立需求，不放入本期。

## 6. 国内 Android APP 最小改动

- 生成、模型选择、轮询、取消、重试和错误提示保持现有逻辑。
- 生成完成后不调用删除云端结果的旧确认语义。
- “本地视频历史”改为“我的视频作品”，优先读取 `/mobile/video/library`。
- 列表显示归档状态；`pending/delivering` 显示处理中，`failed` 显示可重试，不把它显示成 provider 生成失败。
- 播放/下载使用主平台 BFF；下载到相册仍是设备副本。
- IndexedDB 只缓存已经播放或下载的副本，可清理、可重建。
- “保存到素材库”改为“已保存到创作空间/查看创作空间”。
- 本期不改图片提示词、通用参考素材选择器或其他导航，避免扩大移动端改造面。

## 7. 正式创作空间桌面端最小改动

- 新增正式 Canvas 的 `mobile_video_archives` 查询层/服务接口。
- 视频页将现有 `video_tasks`、`video_generation_logs` 与移动归档按 `source_task_id`/归档 ID合并展示并去重。
- 移动作品显示“移动端生成”来源标记和归档状态。
- 播放使用 `StorageObject` 内容接口和 Range，不加载整段视频到历史列表。
- 删除移动归档调用专用删除服务，不改写浏览器 `localForage` 整体历史，不删除主平台任务和账务审计。
- 不把移动归档写入 `state:video-workbench`，不覆盖桌面浏览器同时保存的原有历史。

## 8. 容量、持久化和失败策略

### 8.1 容量

使用正式 Canvas 的容量变量：

```text
CANVAS_STORAGE_LIMIT_BYTES
CANVAS_STORAGE_RESERVE_BYTES
CANVAS_STORAGE_CLEANUP_THRESHOLD_BYTES
CANVAS_USER_STORAGE_LIMIT_BYTES
CANVAS_MAX_OBJECT_BYTES
```

本期不新增错误的 `CANVAS_MAX_STORAGE_BYTES` 合同，也不默认引入 `CANVAS_USER_VIDEO_QUOTA_BYTES`。如果要单独限制视频，应由双方先决定是复用 `CANVAS_USER_STORAGE_LIMIT_BYTES`，还是新增正式配置并在 Canvas 配置、文档、告警和测试中同时实现。

容量不足时，导入接口必须在提交前返回明确错误；成功归档对象必须有 `StorageObjectReference`/归档记录保护，不得被未引用对象清理器删除。临时文件和失败导入仍按既有策略回收。

是否在创建任务前预留最大产物容量是决策项：建议首期不把“最大可能大小”从余额/配额中永久预扣，而是在 provider 成功后归档前进行原子容量检查；如果产品要求保证“生成必能归档”，则另行实现可释放的临时配额预留，不能只在 UI 提示。

### 8.2 持久化和备份

Canvas 持久卷、数据库和 `StorageObject` 提供器必须纳入备份、恢复演练、容量告警和删除审计。APP 本地文件不作为备份来源。生产容量、单文件上限、代理超时和流式压测结果须在上线前记录。

## 9. 分阶段实施顺序（不代表本次已执行）

### 阶段 A：合同和数据库

1. 双方确认用户映射、字段、状态、错误码、Range、删除和容量规则。
2. Canvas 增加 `mobile_video_archives`、唯一约束、引用保护和服务间签名校验。
3. 先用测试文件完成导入幂等、越权、Range、容量和删除引用测试。

### 阶段 B：归档交付

1. 主平台把移动视频实现从未合并分支整理到目标开发分支，补齐流式传输，明确不超过的真实上限。
2. 增加 provider/archive 双状态和 outbox 重试。
3. 联调 Canvas 导入，验证 Worker 重启、超时、重复投递和临时文件回收。

### 阶段 C：两端读取

1. 主平台 BFF 增加列表、Range 内容和删除代理。
2. 正式 Canvas 桌面端合并显示移动归档，不覆盖桌面历史。
3. 国内 APP 改用归档列表和 BFF 内容；本地缓存只做加速。

### 阶段 D：灰度验收

按单一测试账号先验收，再扩大范围；本阶段仍不包含 Play 版和生产全量发布。

## 10. 必须通过的验收清单

### 正常链路

```text
APP 生成
 -> 主平台 provider completed、计费记录完整
 -> Canvas archive delivered、StorageObject 存在
 -> APP 列表可见/Range 可播放/可下载
 -> 电脑创作空间可见/可播放
 -> 两端展示同一 archive_id/source_task_id
```

### 异常与安全

- 相同 `source_task_id` 并发或重试只产生一个归档对象。
- Canvas 短暂不可用时，provider 成功和账务不丢，归档进入重试，不自动退款。
- Canvas 容量满、单对象超限、哈希不匹配、类型不符均有明确错误且不留半成品。
- 非归属用户无法列出、读取、Range 播放或删除归档。
- Worker 重启、租约过期、网络超时后可继续交付。
- 删除有引用返回 `409`；无引用时文件和软删除记录最终一致。
- APP 下载到相册后，云端归档仍存在。
- 桌面端写入原视频历史时，移动归档不丢失；分页和刷新后数据一致。
- 主平台、Canvas、APP 日志均能按 `source_task_id` 关联，但不记录服务密钥和完整敏感内容。

## 11. 评审必须确认的决策点

1. 是否确认：Canvas 是成功视频成品的唯一跨端云端归档位置，主平台只保留任务、临时结果和账务审计。
2. `mobile_video_archives` 是否由正式 Canvas 团队维护，还是由主平台维护后通过 Canvas API写入；建议由 Canvas 维护归档表和对象引用。
3. 平台用户到 Canvas 本地用户的映射是否统一使用 `PlatformUserID`，以及首次映射由登录交换还是内部导入创建。
4. 视频容量是否复用 `CANVAS_USER_STORAGE_LIMIT_BYTES`；若单独配额，名称、默认值、告警和迁移责任是什么。
5. 最终单文件上限和是否允许超过当前 128 MiB；流式改造、代理限制和压测由哪一方负责。
6. 是否在创建任务前预留容量；若不预留，归档失败后的重试保留期和人工处理规则是什么。
7. 有 Canvas 引用时是否一律返回 `409`；本期建议禁止自动解除引用。
8. HMAC 密钥名称、存储位置、轮换周期、时间偏差容忍和 nonce 防重放方案。
9. 主平台移动视频分支合并到哪个开发分支、何时完成代码审查和迁移测试；在此之前不能称为已具备生产能力。
10. Canvas 持久卷和数据库的备份周期、恢复责任人、容量告警阈值及上线回滚方案。

以上决策没有形成双方确认记录前，不应替换当前移动视频临时结果逻辑，也不应部署或构建国内 APP 发布包。
