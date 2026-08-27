# Dell 构建环境

Android 构建机器是 `dell-PowerEdge-R730`，唯一构建用户是 `codex`，不是 Linux
用户 `dell`。所有命令从唯一客户端工程运行：

```bash
cd /home/codex/worktrees/jisudeng-app-domestic
corepack yarn android:doctor
```

| 资产 | 固定位置 |
| --- | --- |
| SDK | `/home/dell/Android/Sdk` |
| Gradle 缓存 | `/home/codex/.gradle` |
| AVD | `/home/codex/.android/avd` |
| Maestro | `/home/codex/.maestro/bin/maestro` |
| 浏览器缓存 | `/home/codex/.cache/ms-playwright` |
| 主机配置 | `/home/codex/.config/jisudeng-mobile/android-release.env` |
| 受保护密钥 | `/home/codex/.local/share/jisudeng-mobile/secrets/android` |

编译目标固定为 Android 36 平台，Build Tools 固定为 `35.0.0`；Direct/Play 模拟器继续
固定为 API 35 Google APIs 镜像。两者用途不同，不能因为 AVD 是 API 35 就把 APP 的
`compileSdk` 或 `targetSdk` 降级。`android:doctor` 会检查这两个编译包；只有经过明确
维护授权的 `android:toolchain:provision --confirm-provision` 可以安装清单中缺失的固定 SDK
包或创建 Direct AVD，且不会下载浏览器缓存。

Direct Release AVD 只能验签名 APK 和覆盖升级；Direct E2E AVD 只运行允许清数据的
Maestro 流程；Play AVD 仅用于未来 Play 验收。正常 build/smoke/e2e 缺少任何资产时
必须失败，绝不下载或创建。仅 `android:toolchain:provision --confirm-provision` 可修改
AVD，且需要明确维护授权。
