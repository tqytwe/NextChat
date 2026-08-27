# 国内 Direct 发行手册

版本、versionCode 和四语言更新说明唯一来自 `android/release/direct.json`。不要手工
修改 Gradle、下载清单或环境变量中的版本。

```bash
corepack yarn android:doctor
corepack yarn android:docs:check
corepack yarn android:release
corepack yarn android:emulator:start
corepack yarn android:emulator:smoke
```

Direct Release AVD 的 smoke 使用 `install -r`，不得卸载或清数据。Maestro 必须显式
使用 `JISUDENG_ANDROID_PROFILE=direct-e2e`，只在 Direct E2E AVD 运行。每个版本结果
写入 `test-results/android/direct/<versionCode>/`，包括 APK hash、包元数据、日志、截图、
UI XML 和 AVD/serial。

正式候选必须来自干净源码。`ANDROID_RELEASE_ALLOW_DIRTY=1` 只能用于临时调试，不能
更新 `current-baseline.json` 为 `accepted`，也不能作为对外制品。
