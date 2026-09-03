# 国内 Direct 媒体合同对账 - 2026-09-02

## 范围

本记录是对 `app/domestic` 客户端与已部署 API 的只读账号对账。它不包含
访问令牌、API Key、提示词、素材内容、请求体或响应密钥，也没有发起图片或视频
计费任务。

## 视频工作区与切组

- `POST /api/v1/auth/mobile/login`：HTTP 200。
- `GET /api/v1/nextchat/mobile/bootstrap`：HTTP 200；视频工作区包含：
  - `video视频`，稳定组 ID `45`，返回 9 个账号可见模型；
  - `Grok Heavy`，稳定组 ID `65`，返回 31 个账号可见模型。
- `GET /api/v1/mobile/video/bootstrap`：HTTP 200。
  - 对 ID `65` 返回可执行的 `grok-imagine-video` 与
    `grok-imagine-video-1.5`；
  - 对 ID `45` 返回空的可执行模型列表，并以
    `capability_not_declared` / `price_missing` 标注抑制原因。
- `POST /api/v1/mobile/sessions/video/switch-group` 对 `45 -> 65 -> 45`
  三次切换均返回 HTTP 200。每次的 `sessions.video` 都具有
  `purpose=video`、目标 `group_id` 以及 `binding=group-pinned-v1`。

客户端结论：账号工作区是“用户可见成员”的真相，专用 bootstrap 只可补充能力，
不能因其不完整返回删除组 ID `45` 或其模型。无能力字段时客户端使用稳定默认的
分辨率、比例和时长；`grok_video` 适配器继续使用既有移动任务合同，其他账号视频
模型通过选中分组的 purpose=video 会话调用既有平台视频网关。客户端不得把聊天
会话、聊天模型或虚构能力替换为视频会话。

本记录中的 bootstrap 缺字段是当时的只读快照，不等价于账号没有视频能力、价格或
调度绑定。`3.0.36` 不再把该可选快照作为请求拦截条件；本轮没有修改后端代码、
模型分组、价格、账号绑定或计费配置。实际提供方返回仍由真机提交验证。

## 本地素材库

- `GET /api/v1/mobile/assets/sync`：HTTP 404。
- `GET /api/v1/mobile/assets`：HTTP 200；本次账号返回 0 项。
- `GET /api/v1/mobile/image-history`：HTTP 200；本次账号返回 20 项。

客户端结论：`/assets/sync` 当前不是生产可用的增量同步合同。素材库必须先读取
IndexedDB 本机索引；该接口失败时保留现有本机素材、显示可重试的局部同步状态，
并且绝不将整个资产页改成“本机素材读取失败”。单项 Blob、大小或 SHA-256
校验失败仍由本机索引标记并独立重试。

最小后端兼容补丁（待单独批准）：实现受认证的
`GET /api/v1/mobile/assets/sync`，支持 `since`、`If-None-Match`/304、稳定
`version`、`etag`、`items` 和 `deleted_ids`，并提供每个 ready 素材的
认证内容 URL、大小和 SHA-256。该补丁不需要变更余额、扣费、模型注册或数据库
结构。

## 客户端验证边界

已完成的是静态回归、持久化迁移与 API 形状对账。真实手机仍需验收：首项图片
普通失败后后续项继续、登录/余额/权限阻塞后恢复、ID `45` 与 `65` 的连续模型
切换、视频任务实际失败文案、本机素材在同步 404 时仍可添加/查看，以及四语言 UI。
