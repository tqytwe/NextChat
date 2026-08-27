# 国内版创作重构原型

本目录的 `domestic-creation-rearchitecture.html` 是 Pixel 7（`412 x 915`）
可浏览原型。它是国内 Direct APP 的信息架构和交互基线，不是可发布的
APP 页面实现。

截图位于 `png/`：

- `login.png`：登录。Google/GitHub 仅放在登录和注册，不出现在重置密码。
- `home.png`：以继续创作和进行中任务为核心的首页。
- `chat.png`：对话及保存到短剧工程的入口。
- `image.png`：图像工作室、Canvas 图像提示词、能力驱动的输出张数。
- `prompts.png`：Canvas 提示词目录和详情弹窗。
- `video.png`：动态分组、模型、分辨率和确认单入口。
- `assets.png`：未归档资产、图片批次、视频片段、本机素材与短剧工程。
- `project.png`：短剧工程的剧本、视觉设定、分镜、生产和成片流程。
- `account.png`、`settings.png`：资料/安全与统一系统设置的层级。

设计约束：

- 固定底部五项：`首页 / 对话 / 创作 / 资产 / 我的`。
- `创作`只在图像工作室和视频工作台之间切换；`资产`承接结果和短剧工程。
- 面向用户的名称是“短剧工程”，不是“云端项目”或“云端任务”；服务端仍是
  工程、资产、任务和计费的真相源。
- 所有生成在服务端返回确认单后才提交；确认内容变化后必须重新确认。
- 页面使用 8px 以内圆角、明确边界、紧凑行高、固定触控尺寸与可读的状态色。
- 四语言实现时必须替换文案并逐屏截图；动态组名、模型名和后端错误单独
  本地化，不能回退原始英文或协议字段。

原型生成命令（不会下载浏览器）：

```bash
for screen in login home chat image prompts video assets project account settings; do
  /home/codex/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome \
    --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --window-size=412,915 \
    --screenshot="docs/mobile/prototypes/png/${screen}.png" \
    "file:///home/codex/worktrees/jisudeng-app-domestic/docs/mobile/prototypes/domestic-creation-rearchitecture.html?screen=${screen}"
done
```
