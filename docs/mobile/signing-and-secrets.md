# 签名与密钥

签名和 Firebase 是 Dell 主机资产，不属于 Git 仓库。唯一秘密根目录为
`/home/codex/.local/share/jisudeng-mobile/secrets/android`，目录及文件必须只允许
`codex` 读取。

工程通过 Git 忽略的 `android/keystore.properties` 和 flavor Firebase 链接引用该目录；
它们不是副本。禁止提交、打印或复制 keystore、密码、`google-services.json`、FCM
服务账号、Google Play 服务账号或 OAuth secret。

当前国内签名身份：包名 `com.jisudeng.chat`，证书 SHA-256 为
`cd7abbd79daf6648a429ff34d7450b18cfb6b416e660b2f5169178e0a488627e`。doctor 只检查
文件存在性、权限、包名与证书指纹；轮换必须先完成旧用户升级可行性、Firebase/OAuth
指纹更新和一份新签名制品验收。
