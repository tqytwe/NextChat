# APP 变更记录

## 3.0.25 (325) - candidate

- 客户端：整合服务端媒体能力合同、视频模型筛选、固定会话和移动端视频工作台。
- 后端候选：视频执行安全、素材/提示词目录、任务持久化、Canvas 提示词镜像与迁移 256-258。
- 工程：建立 `app/domestic`、Dell doctor、Direct Release/E2E AVD 隔离、主机级密钥引用和唯一文档入口。
- 制品：Direct 签名 APK 已从干净 `0d1fabcf` 生成，SHA-256 为
  `dac01bee1d9c4116972e598576812ab0fec31dae7aad373cad848fbec9de99a0`；包名
  `com.jisudeng.chat`、版本 `3.0.25 (325)` 和证书指纹已独立验签。
- 验收：`Jisudeng_Direct_Release_API35` 以 `install -r` 完成 smoke；Direct E2E
  已通过登录、冷启动分组、首条消息、长按复制、断网恢复、附件、内容创作与凭据恢复。
- 未完成：API 35 系统图片选择器的旧 resource ID 不再存在，参考图、图片重试和图库
  夹具需在新选择器上更新后重跑。因此本版本保持 `candidate`，不标记为 `accepted`。

## 3.0.24 (324) - archived candidate

- 已验证媒体候选制品，来源 `fix/android-media-capabilities-20260826@47634cef`。
- 不作为唯一工程 accepted 制品，后续由 3.0.25 clean build 替代。
