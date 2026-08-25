import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildMobileVideoScriptPrompt,
  managedVideoCapabilities,
  managedVideoGroups,
  managedVideoWorkspaceModels,
  MOBILE_VIDEO_POLL_INTERVAL_MS,
  MOBILE_VIDEO_POLL_TIMEOUT_MS,
  parseMobileVideoID,
  parseMobileVideoStatus,
  parseMobileVideoURL,
  resolveMobileVideoScriptSelection,
  selectManagedVideoSession,
} from "../app/client/mobile-video";

const chatModel = { id: "gpt-5", name: "gpt-5" };
const videoModel = {
  id: "seedance-1",
  name: "seedance-1",
  video_capabilities: {
    supported_resolutions: ["720p"],
    supported_ratios: ["16:9"],
    supported_durations: [8],
  },
};

describe("mobile video capability and response contract", () => {
  test("uses the same durable task polling window as Creation Space", () => {
    expect(MOBILE_VIDEO_POLL_INTERVAL_MS).toBe(5_000);
    expect(MOBILE_VIDEO_POLL_TIMEOUT_MS).toBe(20 * 60 * 1_000);
  });

  test("keeps the selected creation mode visible and video controls readable on phones", () => {
    const css = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.module.scss"),
      "utf8",
    );
    expect(css).toContain(".creation-mode-active");
    expect(css).toContain("background: var(--ios-blue) !important");
    expect(css).toContain("border: 2px solid var(--ios-blue) !important");
    expect(css).toContain("box-shadow: inset 0 0 0 999px");
    expect(css).toContain("@media (max-width: 480px)");
    const app = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.tsx"),
      "utf8",
    );
    expect(app).toContain('styles["creation-mode-active"]');
  });

  test("uses the shared account-scoped prompt catalog instead of a video localStorage cache", () => {
    const app = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.tsx"),
      "utf8",
    );
    expect(app).toContain('syncLocalPromptCatalog(');
    expect(app).toContain('readLocalPromptCatalog(');
    expect(app).toContain('createLocalPromptCoverObjectURL(');
    expect(app).not.toContain("jisudeng-video-prompts:");
  });

  test("warms the Creation Space mirror for both image and video prompt cards", () => {
    const app = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.tsx"),
      "utf8",
    );
    expect(app).toContain('(["image", "video"] as const).map((kind) =>');
    expect(app).toContain('            "canvas",\n          ),');
    expect(app).not.toContain('kind === "image" ? "canvas" : "platform"');
  });

  test("shows the actual video prompt alongside its cached cover", () => {
    const app = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.tsx"),
      "utf8",
    );
    expect(app).toContain("{item.coverUrl && <img src={item.coverUrl}");
    expect(app).toContain("<small>{item.prompt_text || item.description}</small>");
    expect(app).toContain('"video",\n        "canvas",');
    expect(app).toContain('syncLocalPromptCatalog(\n          activeAccountId,\n          locale,\n          "video",');
    expect(app).toContain('undefined,\n          "canvas",');
    expect(app).toContain("id: item.id");
    expect(app).not.toContain("id: Number(item.id)");
  });

  test("reconciles server video history from hydrated blobs, not stale index metadata", () => {
    const app = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.tsx"),
      "utf8",
    );
    expect(app).toContain("listLocalVideosWithBlobs(activeAccountId)");
    expect(app).toContain("cachedEntries.map(({ entry }) => entry.taskId)");
    expect(app).not.toContain("new Set(entries.map((entry) => entry.taskId))");
  });

  test("keeps the completed default private to the device and only uploads when requested", () => {
    const app = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.tsx"),
      "utf8",
    );
    expect(app).toContain("content/acknowledge");
    expect(app).toContain('form.append("source", "video_result")');
    expect(app).toContain('"/api/v1/mobile/assets"');
    expect(app).not.toContain("/save-as-asset");
  });

  test("reads only the video workspace and never falls back to chat models", () => {
    const workspace = {
      user: { id: 7, balance: 0 },
      managed_api_key: { id: 1, name: "chat" },
      models: { groups: [{ id: 1, name: "chat", models: [chatModel] }] },
      workspaces: {
        video: {
          models: {
            groups: [
              {
                id: 2,
                name: "video",
                video_available: true,
                models: [videoModel],
              },
            ],
          },
        },
      },
    } as any;

    expect(managedVideoWorkspaceModels(workspace)?.groups?.[0]?.id).toBe(2);
    expect(managedVideoGroups(workspace).map((group) => group.id)).toEqual([2]);
    expect(managedVideoGroups({
      ...workspace,
      workspaces: undefined,
    } as any)).toEqual([]);
  });

  test("uses model capabilities first and group capabilities as the declared fallback", () => {
    const group = {
      id: 2,
      name: "video",
      video_available: true,
      video_capabilities: { supported_durations: [10] },
      models: [videoModel],
    } as any;

    expect(managedVideoCapabilities(videoModel as any, group)).toBe(
      videoModel.video_capabilities,
    );
    expect(managedVideoCapabilities({ id: "model-without-own-caps" } as any, group)).toEqual(
      group.video_capabilities,
    );
  });

  test("does not reuse chat credentials when the video session is absent or mislabelled", () => {
    const chat = { user_id: 7, api_key: "chat-key", api_key_id: 1, purpose: "chat" } as any;
    expect(selectManagedVideoSession({ chat } as any)).toBeNull();
    expect(
      selectManagedVideoSession({
        video: { user_id: 7, api_key: "chat-key", api_key_id: 1, purpose: "chat" },
      } as any),
    ).toBeNull();
    expect(
      selectManagedVideoSession({
        video: { user_id: 7, api_key: "video-key", api_key_id: 2, purpose: "video" },
      } as any),
    ).toMatchObject({ api_key: "video-key", purpose: "video" });
  });

  test("parses Agnes IDs, completion state, and metadata URL fields", () => {
    const status = {
      data: {
        video_id: "video_123",
        metadata: {
          status: "completed",
          url: "https://cdn.example/video_123.mp4",
        },
      },
    };

    expect(parseMobileVideoID(status)).toBe("video_123");
    expect(parseMobileVideoStatus(status)).toBe("completed");
    expect(parseMobileVideoURL(status)).toBe("https://cdn.example/video_123.mp4");
  });

  test("accepts nested content URLs used by status/content responses", () => {
    const payload = {
      status: "done",
      content: { video_url: "/v1/videos/video_123/content" },
    };
    expect(parseMobileVideoStatus(payload)).toBe("done");
    expect(parseMobileVideoURL(payload)).toBe("/v1/videos/video_123/content");
  });

  test("follows the active chat session for script generation without reading video models", () => {
    const workspace = {
      models: {
        groups: [
          {
            id: 11,
            name: "Writing",
            models: [{ id: "text-a", name: "text-a" }],
          },
          {
            id: 12,
            name: "Images",
            models: [{ id: "image-a", name: "image-a" }],
          },
        ],
      },
      workspaces: {
        video: {
          models: {
            groups: [
              {
                id: 91,
                name: "Video",
                models: [videoModel],
              },
            ],
          },
        },
      },
    } as any;

    expect(
      resolveMobileVideoScriptSelection({
        workspace,
        chatSessions: [{ id: "chat-1", groupId: 11, model: "text-a" }],
        currentChatId: "chat-1",
        preference: { groupId: 12, model: "image-a" },
      }),
    ).toEqual({ groupId: 11, model: "text-a", source: "session" });
  });

  test("reacts to a changed chat model and fails closed for an unavailable current session", () => {
    const workspace = {
      models: {
        groups: [
          {
            id: 11,
            name: "Writing",
            models: [
              { id: "text-a", name: "text-a" },
              { id: "text-b", name: "text-b" },
            ],
          },
        ],
      },
    } as any;

    expect(
      resolveMobileVideoScriptSelection({
        workspace,
        chatSessions: [{ id: "chat-1", groupId: 11, model: "text-b" }],
        currentChatId: "chat-1",
      }),
    ).toEqual({ groupId: 11, model: "text-b", source: "session" });
    expect(
      resolveMobileVideoScriptSelection({
        workspace,
        chatSessions: [{ id: "chat-1", groupId: 11, model: "removed-model" }],
        currentChatId: "chat-1",
      }),
    ).toEqual({ groupId: 11, model: "", source: "unavailable" });
  });

  test("uses the saved chat preference only when there is no current conversation", () => {
    const workspace = {
      models: {
        groups: [
          {
            id: 11,
            name: "Writing",
            models: [{ id: "text-a", name: "text-a" }],
          },
          {
            id: 12,
            name: "Video",
            models: [videoModel],
          },
        ],
      },
    } as any;
    expect(
      resolveMobileVideoScriptSelection({
        workspace,
        chatSessions: [],
        currentChatId: "",
        preference: { groupId: 11, model: "text-a" },
      }),
    ).toEqual({ groupId: 11, model: "text-a", source: "preference" });
  });

  test("builds a model-agnostic script prompt and preserves the supplied brief", () => {
    const prompt = buildMobileVideoScriptPrompt("A train crossing a rainy city", "zh-CN");
    expect(prompt).toContain("A train crossing a rainy city");
    expect(prompt).toContain("unsupported model parameters");
    expect(prompt).toContain("Chinese");
  });
});
