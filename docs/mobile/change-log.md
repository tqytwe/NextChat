# APP 变更记录

## 未发版源码候选 - 2026-08-27

- 客户端 `80272a59`：底栏的“项目”改为“资产”；普通用户入口不再创建通用云端项目。
  资产页保留图库、本机素材和批次管理，并新增短剧工程入口。
- 客户端 `80272a59`：短剧工程支持创建工程、创建稳定分集 ID、编辑五类创作事实
  (`script`、`visual_bible`、`storyboard`、`image_prompts`、`video_prompts`) 和归档工程。
  文档写入以服务器版本为准；保存只标记后续内容需要复核，不触发生成、扣费或 MP4 合成。
- 客户端 `c6577329`：图像提示词改为匿名直读 Canvas 的公开目录；视频工作台不再把该图像目录误标为视频模板。
- 后端 `c17c6c77`：新增短剧工程/分集/创作事实/素材关联、素材引用删除保护、动态视频模型能力合同、SenseNova 根字段 `watermark:false` 与图片输出张数的严格校验。
- 状态：两个提交均已推送 GitHub `app/domestic`，但未部署；没有新 APK。生产确认令牌、价格锁、逐镜生成与 Canvas MP4 合成仍未实现，不能将本候选标记为完成或 accepted。

## 3.0.25 (325) - candidate

- 客户端：整合服务端媒体能力合同、视频模型筛选、固定会话和移动端视频工作台。
- 客户端进行中：图像提示词目录改为 Direct APP 原生读取 Canvas 公开 JSON，不携带平台令牌；
  本机保存文本目录，封面失败不阻塞复制或应用。
- 客户端进行中：图像工作室输出张数保留 `1/2/3/4` 快捷值，并补充加减和直接输入；上限使用
  当前模型能力合同，客户端不再将请求静默截断为 4。
- 设计进行中：新增创作重构的 Pixel 7 原型包，覆盖登录、首页、对话、图像、视频、资产、
  短剧工程、账户和系统设置。
- 后端候选：视频执行安全、素材/提示词目录、任务持久化、Canvas 提示词镜像与迁移 256-258。
- 工程：建立 `app/domestic`、Dell doctor、Direct Release/E2E AVD 隔离、主机级密钥引用和唯一文档入口。
- 制品：Direct 签名 APK 已从干净 `0d1fabcf` 生成，SHA-256 为
  `dac01bee1d9c4116972e598576812ab0fec31dae7aad373cad848fbec9de99a0`；包名
  `com.jisudeng.chat`、版本 `3.0.25 (325)` 和证书指纹已独立验签。
- 验收：`Jisudeng_Direct_Release_API35` 以 `install -r` 完成 smoke；Direct E2E
  已通过登录、冷启动分组、首条消息、长按复制、断网恢复、附件、内容创作与凭据恢复。
- 未完成：API 35 参考图夹具已改为先选支持能力的 `gpt-image-1`，并已验证引用图片
  附加成功；但对应图片任务在 101 秒内未进入 Completed，需补充后端任务/提供商执行证据，
  再重跑图片重试和图库夹具。因此本版本保持 `candidate`，不标记为 `accepted`。
- 浏览器：共享 Chromium revision 与禁止下载策略已经由 doctor 固定；OAuth 回调、WebView
  外链和下载页的 Playwright 测试套件尚未接入，不能写成已验收。

## 3.0.24 (324) - archived candidate

- 已验证媒体候选制品，来源 `fix/android-media-capabilities-20260826@47634cef`。
- 不作为唯一工程 accepted 制品，后续由 3.0.25 clean build 替代。
