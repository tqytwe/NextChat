# APP 架构

APP 是 Capacitor Android 容器中的 NextChat 移动工作台。客户端负责界面、
本地草稿、缩略图/素材缓存、原生文件与通知桥接；Sub2API 负责身份、权限、
会话、余额、支付、任务、项目、持久化、计费和异步执行。

```text
Mobile UI -> mobile-platform / managed-nextchat -> Sub2API mobile contract
       -> Android native bridge -> files, clipboard, OAuth callback, FCM
Sub2API -> task workers / media providers / object storage -> task and asset state
```

任务成功、余额、订单、兑换、生成文件存在性和任务终态只能由服务端决定。
APP 本地状态是缓存或待恢复队列，不能替代服务端真相。Canvas/Web 交接使用
项目、资产、任务 ID 与短时 handoff token，不向 APP 或浏览器暴露平台 API key。
