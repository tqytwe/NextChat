import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildMobileVideoScriptPrompt,
  classifyMobileVideoBootstrapFailure,
  managedVideoCapabilities,
  filterManagedVideoGroups,
  mergeManagedVideoGroups,
  managedVideoGroups,
  managedVideoModels,
  managedVideoWorkspaceModels,
  MOBILE_VIDEO_POLL_INTERVAL_MS,
  MOBILE_VIDEO_POLL_TIMEOUT_MS,
  normalizeMobileVideoBootstrapGroups,
  parseMobileVideoID,
  parseMobileVideoStatus,
  parseMobileVideoURL,
  resolveMobileVideoScriptSelection,
  resolveManagedVideoGroups,
  selectManagedVideoSession,
  selectManagedVideoSessionForGroup,
} from "../app/client/mobile-video";
import { ManagedApiError } from "../app/client/managed-nextchat";

const chatModel = { id: "gpt-5", name: "gpt-5" };
const videoModel = {
  id: "seedance-1",
  name: "seedance-1",
  modalities: ["video"],
  adapter: "grok_video",
  capability_version: "2026-08-26.1",
  video_capabilities: {
    operations: ["generate"],
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
    expect(app).toContain("syncLocalPromptCatalog(");
    expect(app).toContain("readLocalPromptCatalog(");
    expect(app).toContain("createLocalPromptCoverObjectURL(");
    expect(app).not.toContain("jisudeng-video-prompts:");
  });

  test("keeps the Canvas image prompt catalog out of the video workbench", () => {
    const app = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.tsx"),
      "utf8",
    );
    const studio = app.slice(
      app.indexOf("function AndroidVideoStudio()"),
      app.indexOf("function AndroidImageStudio()"),
    );
    expect(studio).toContain(
      "Canvas publishes an image-prompt directory only. Do not mislabel its",
    );
    expect(studio).not.toContain("syncLocalPromptCatalog(");
  });

  test("does not claim Canvas image prompts are video templates", () => {
    const app = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.tsx"),
      "utf8",
    );
    const studio = app.slice(
      app.indexOf("function AndroidVideoStudio()"),
      app.indexOf("function AndroidImageStudio()"),
    );
    expect(studio).toContain("setVideoPrompts([]);");
    expect(studio).not.toContain('"video",\n          "canvas",');
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
    expect(app).toContain("/content/ack");
    expect(app).not.toContain("/content/acknowledge");
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
    expect(
      managedVideoGroups({
        ...workspace,
        workspaces: undefined,
      } as any),
    ).toEqual([]);
  });

  test("uses group capabilities as optional defaults for a returned model", () => {
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
    expect(
      managedVideoCapabilities({ id: "model-without-own-caps" } as any, group),
    ).toEqual(group.video_capabilities);
  });

  test("keeps every account-returned model in a video workspace", () => {
    const group = {
      id: 2,
      name: "video",
      video_available: true,
      video_capabilities: { supported_durations: [10] },
      models: [
        {
          id: "opaque-provider-id",
          name: "opaque-provider-id",
          modalities: ["video"],
          adapter: "grok_video",
          capability_version: "2026-08-26.1",
          video_capabilities: {
            operations: ["generate"],
            supported_resolutions: ["720p"],
            supported_ratios: ["16:9"],
            supported_durations: [10],
          },
        },
        {
          id: "misleading-video-name",
          name: "misleading-video-name",
          modalities: ["chat"],
          adapter: "grok_video",
          capability_version: "2026-08-26.1",
          video_capabilities: {
            operations: ["generate"],
            supported_resolutions: ["720p"],
            supported_ratios: ["16:9"],
            supported_durations: [10],
          },
        },
      ],
    } as any;

    expect(managedVideoModels(group).map((model) => model.id)).toEqual([
      "opaque-provider-id",
      "misleading-video-name",
    ]);
  });

  test("does not hide a sibling merely because it lacks a media contract", () => {
    const group = {
      id: 2,
      name: "mixed media",
      video_available: true,
      models: [
        {
          id: "opaque-provider-id",
          modalities: ["video"],
          adapter: "grok_video",
          capability_version: "2026-08-26.1",
          video_capabilities: {
            operations: ["generate"],
            supported_resolutions: ["720p"],
            supported_ratios: ["16:9"],
            supported_durations: [10],
          },
        },
        // A legacy chat row can still be present in a workspace group. The
        // group-level video flag must not make it selectable for video jobs.
        { id: "chat-model-without-media-contract" },
      ],
    } as any;

    expect(managedVideoModels(group).map((model) => model.id)).toEqual([
      "opaque-provider-id",
      "chat-model-without-media-contract",
    ]);
  });

  test("keeps every non-empty returned video group", () => {
    const groups = filterManagedVideoGroups([
      {
        id: 2,
        name: "declared video",
        video_available: true,
        models: [
          {
            id: "opaque-provider-id",
            modalities: ["video"],
            adapter: "grok_video",
            capability_version: "2026-08-26.1",
            video_capabilities: {
              operations: ["generate"],
              supported_resolutions: ["720p"],
              supported_ratios: ["16:9"],
              supported_durations: [10],
            },
          },
        ],
      },
      {
        id: 3,
        name: "legacy-only",
        models: [{ id: "video-looking-name" }],
      },
    ] as any);

    expect(groups.map((group) => group.id)).toEqual([2, 3]);
  });

  test("normalizes typed and legacy video bootstrap models without losing capabilities", () => {
    const groups = normalizeMobileVideoBootstrapGroups(
      [
        {
          id: 21,
          name: "video视频",
          video_available: true,
          video_capabilities: { supported_durations: [5] },
          models: [
            {
              id: "provider-video-1",
              display_name: "Provider video 1",
              modalities: ["video"],
              adapter: "grok_video",
              capability_version: "2026-08-26.1",
              video_capabilities: {
                operations: ["generate"],
                supported_resolutions: ["720p"],
                supported_ratios: ["16:9"],
                supported_durations: [10],
              },
            },
            {
              model: "provider-video-2",
              name: "Provider video 2",
              modalities: ["video"],
              adapter: "agnes_video",
              capability_version: "2026-08-26.1",
              video_capabilities: {
                operations: ["generate"],
                supported_resolutions: ["480p"],
                supported_ratios: ["16:9"],
                supported_durations: [6],
              },
            },
            "legacy-video-2",
          ],
          model_capabilities: {
            "legacy-video-2": { supported_durations: [8] },
          },
        },
      ],
      "2026-08-26.1",
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: 21, name: "video视频" });
    expect(groups[0].models).toEqual([
      expect.objectContaining({
        id: "provider-video-1",
        modalities: ["video"],
        adapter: "grok_video",
        capability_version: "2026-08-26.1",
        video_capabilities: expect.objectContaining({
          operations: ["generate"],
          supported_durations: [10],
        }),
      }),
      expect.objectContaining({
        id: "provider-video-2",
        name: "provider-video-2",
        display_name: "Provider video 2",
        modalities: ["video"],
        adapter: "agnes_video",
        capability_version: "2026-08-26.1",
        video_capabilities: expect.objectContaining({
          operations: ["generate"],
          supported_durations: [6],
        }),
      }),
      expect.objectContaining({
        id: "legacy-video-2",
        video_capabilities: { supported_durations: [8] },
      }),
    ]);
  });

  test("keeps a server display name out of the exact video task model value", () => {
    const [group] = normalizeMobileVideoBootstrapGroups(
      [
        {
          id: 22,
          name: "video视频",
          video_available: true,
          models: [
            {
              model: "provider-exact-video-id",
              name: "展示名称",
              modalities: ["video"],
              adapter: "grok_video",
              capability_version: "2026-08-26.1",
              video_capabilities: {
                operations: ["generate"],
                supported_resolutions: ["720p"],
                supported_ratios: ["16:9"],
                supported_durations: [5],
              },
            },
          ],
        },
      ],
      "2026-08-26.1",
    );

    expect(group?.models?.[0]).toMatchObject({
      id: "provider-exact-video-id",
      name: "provider-exact-video-id",
      display_name: "展示名称",
    });
  });

  test("shows executable models from both configured video groups by exact server IDs", () => {
    const groups = normalizeMobileVideoBootstrapGroups(
      [
        {
          id: 21,
          name: "video视频",
          video_available: true,
          models: [
            {
              model: "agnes-video-v2.0",
              display_name: "Agnes Video",
              modalities: ["video"],
              adapter: "agnes_video",
              capability_version: "2026-08-26.1",
              video_capabilities: {
                operations: ["generate"],
                supported_resolutions: ["720p"],
                supported_ratios: ["16:9"],
                supported_durations: [8],
              },
            },
          ],
        },
        {
          id: 22,
          name: "Grok Heavy",
          video_available: true,
          models: [
            {
              model: "grok-imagine-video-1.5",
              display_name: "Grok Imagine Video",
              modalities: ["video"],
              adapter: "grok_video",
              capability_version: "2026-08-26.1",
              video_capabilities: {
                operations: ["generate"],
                supported_resolutions: ["1080p"],
                supported_ratios: ["16:9"],
                supported_durations: [10],
              },
            },
          ],
        },
      ],
      "2026-08-26.1",
      true,
    );

    const resolved = resolveManagedVideoGroups({
      serverBootstrapLoaded: true,
      serverGroups: groups,
    });
    expect(resolved.source).toBe("server");
    expect(resolved.groups.map((group) => group.name)).toEqual([
      "video视频",
      "Grok Heavy",
    ]);
    expect(
      managedVideoModels(resolved.groups[0]).map((model) => model.id),
    ).toEqual(["agnes-video-v2.0"]);
    expect(
      managedVideoModels(resolved.groups[1]).map((model) => model.id),
    ).toEqual(["grok-imagine-video-1.5"]);
  });

  test("keeps old-shaped workspace rows even when a protocol marker exists", () => {
    const groups = normalizeMobileVideoBootstrapGroups(
      [
        {
          id: 31,
          name: "legacy-shaped group",
          models: ["video-looking-but-undeclared"],
        },
      ],
      undefined,
      true,
    );

    expect(filterManagedVideoGroups(groups)).toEqual(groups);
    expect(managedVideoModels(groups[0])).toEqual([
      expect.objectContaining({ id: "video-looking-but-undeclared" }),
    ]);
  });

  test("keeps every existing mobile bootstrap model without name guesses", () => {
    const groups = normalizeMobileVideoBootstrapGroups(
      [
        {
          id: 21,
          name: "video视频",
          video_available: true,
          models: ["agnes-video-v2", "chat-model-that-must-not-leak"],
          model_capabilities: {
            "agnes-video-v2": {
              text_to_video: true,
              resolutions: ["720p", "1080p"],
              ratios: ["16:9"],
              durations: [8],
            },
          },
        },
      ],
      "existing-mobile-bootstrap",
      true,
    );

    expect(
      resolveManagedVideoGroups({
        serverBootstrapLoaded: true,
        serverGroups: groups,
      }).groups,
    ).toEqual([expect.objectContaining({ id: 21, name: "video视频" })]);
    expect(managedVideoModels(groups[0])).toEqual([
      expect.objectContaining({ id: "agnes-video-v2" }),
      expect.objectContaining({ id: "chat-model-that-must-not-leak" }),
    ]);
  });

  test("preserves successful server suppression diagnostics without exposing a model", () => {
    const groups = normalizeMobileVideoBootstrapGroups([
      {
        id: 22,
        name: "Grok Heavy",
        video_available: false,
        video_unavailable_code: "price_missing",
        suppressed: [
          { model: "grok-video-preview", code: "price_missing" },
          { model: "mapped-but-unsupported", code: "adapter_unsupported" },
        ],
      },
    ]);

    expect(groups).toEqual([
      expect.objectContaining({
        id: 22,
        video_available: false,
        video_suppressed: [
          { model: "grok-video-preview", code: "price_missing" },
          { model: "mapped-but-unsupported", code: "adapter_unsupported" },
        ],
      }),
    ]);
    expect(
      resolveManagedVideoGroups({
        serverBootstrapLoaded: true,
        serverGroups: groups,
      }),
    ).toEqual({
      source: "server",
      groups: [expect.objectContaining({ id: 22, name: "Grok Heavy", models: [] })],
      suppressed: [
        {
          groupId: 22,
          groupName: "Grok Heavy",
          model: "grok-video-preview",
          code: "price_missing",
        },
        {
          groupId: 22,
          groupName: "Grok Heavy",
          model: "mapped-but-unsupported",
          code: "adapter_unsupported",
        },
      ],
    });
  });

  test("keeps the account video workspace when a successful bootstrap is partial or empty", () => {
    const workspace = {
      user: { id: 7, balance: 0 },
      managed_api_key: { id: 1, name: "chat" },
      models: {
        groups: [
          {
            id: 1,
            name: "chat",
            models: [{ id: "chat-video-looking", modalities: ["chat"] }],
          },
        ],
      },
      workspaces: {
        video: {
          models: {
            groups: [
              {
                id: 91,
                name: "Grok Heavy",
                video_available: true,
                models: [
                  {
                    id: "opaque-video",
                    modalities: ["video"],
                    adapter: "grok_video",
                    capability_version: "2026-08-26.1",
                    video_capabilities: {
                      operations: ["generate"],
                      supported_resolutions: ["720p"],
                      supported_ratios: ["16:9"],
                      supported_durations: [8],
                    },
                  },
                ],
              },
            ],
          },
        },
      },
    } as any;

    expect(
      resolveManagedVideoGroups({
        serverBootstrapLoaded: false,
        workspace,
      }),
    ).toMatchObject({ source: "workspace", groups: [{ id: 91 }] });
    expect(
      resolveManagedVideoGroups({
        serverBootstrapLoaded: true,
        serverGroups: [],
        workspace,
      }),
    ).toEqual({
      source: "workspace",
      groups: workspace.workspaces.video.models.groups,
      suppressed: [],
    });
    expect(
      resolveManagedVideoGroups({
        serverBootstrapLoaded: false,
        workspace: { ...workspace, workspaces: undefined },
      }),
    ).toEqual({ source: "unavailable", groups: [], suppressed: [] });
  });

  test("merges a partial bootstrap into all account-authorized video groups by IDs", () => {
    const workspaceGroups = [
      {
        id: 41,
        name: "workspace group one",
        models: [
          { id: "provider-model-a", name: "provider-model-a" },
          { id: "provider-model-b", name: "provider-model-b" },
        ],
      },
      {
        id: 42,
        name: "workspace group two",
        models: [{ id: "provider-model-c", name: "provider-model-c" }],
      },
    ] as any;
    const serverGroups = [
      {
        id: 41,
        name: "stale server label",
        models: [
          {
            id: "provider-model-a",
            display_name: "Server display name",
            video_capabilities: { supported_resolutions: ["1080p"] },
          },
        ],
      },
    ] as any;

    const merged = mergeManagedVideoGroups({ workspaceGroups, serverGroups });
    expect(merged.map((group) => group.id)).toEqual([41, 42]);
    expect(merged[0].name).toBe("workspace group one");
    expect(merged[0].models?.map((model) => model.id)).toEqual([
      "provider-model-a",
      "provider-model-b",
    ]);
    expect(merged[0].models?.[0]).toMatchObject({
      display_name: "Server display name",
      video_capabilities: { supported_resolutions: ["1080p"] },
    });
  });

  test("keeps a successful empty bootstrap distinct from a failed bootstrap", () => {
    expect(
      resolveManagedVideoGroups({
        serverBootstrapLoaded: true,
        serverGroups: [],
      }),
    ).toEqual({ source: "server", groups: [], suppressed: [] });
    expect(
      resolveManagedVideoGroups({
        serverBootstrapLoaded: false,
        workspace: null,
      }),
    ).toEqual({ source: "unavailable", groups: [], suppressed: [] });
  });

  test("does not reuse chat credentials when the video session is absent or mislabelled", () => {
    const chat = {
      user_id: 7,
      api_key: "chat-key",
      api_key_id: 1,
      purpose: "chat",
    } as any;
    expect(selectManagedVideoSession({ chat } as any)).toBeNull();
    expect(
      selectManagedVideoSession({
        video: {
          user_id: 7,
          api_key: "chat-key",
          api_key_id: 1,
          purpose: "chat",
        },
      } as any),
    ).toBeNull();
    expect(
      selectManagedVideoSession({
        video: {
          user_id: 7,
          api_key: "video-key",
          api_key_id: 2,
          purpose: "video",
        },
      } as any),
    ).toMatchObject({ api_key: "video-key", purpose: "video" });
    expect(
      selectManagedVideoSession({
        video: {
          user_id: 7,
          api_key: "unlabelled-key",
          api_key_id: 3,
        },
      } as any),
    ).toBeNull();
    expect(
      selectManagedVideoSession({
        video: {
          user_id: 7,
          api_key: "",
          api_key_id: 4,
          purpose: "video",
        },
      } as any),
    ).toBeNull();
  });

  test("requires the video key to be pinned to the selected group", () => {
    const sessions = {
      video: {
        user_id: 7,
        api_key: "video-key",
        api_key_id: 2,
        purpose: "video",
        group_id: 22,
      },
    } as any;
    expect(selectManagedVideoSessionForGroup(sessions, 22)).toMatchObject({
      api_key: "video-key",
      group_id: 22,
    });
    expect(selectManagedVideoSessionForGroup(sessions, 21)).toBeNull();
    expect(
      selectManagedVideoSessionForGroup(
        { video: { ...sessions.video, group_id: undefined } },
        22,
      ),
    ).toBeNull();
  });

  test("classifies bootstrap endpoint, login, and transport failures for truthful retry UI", () => {
    expect(
      classifyMobileVideoBootstrapFailure(
        new ManagedApiError("missing", 404, "/api/v1/mobile/video/bootstrap"),
      ),
    ).toBe("not_found");
    expect(
      classifyMobileVideoBootstrapFailure(
        new ManagedApiError("expired", 401, "/api/v1/mobile/video/bootstrap"),
      ),
    ).toBe("unauthorized");
    expect(classifyMobileVideoBootstrapFailure(new Error("offline"))).toBe(
      "request_failed",
    );
  });

  test("binds video creation to the dedicated video session and purpose", () => {
    const app = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.tsx"),
      "utf8",
    );
    const studio = app.slice(
      app.indexOf("function AndroidVideoStudio()"),
      app.indexOf("function AndroidImageStudio()"),
    );

    expect(studio).toContain("managed.switchVideoGroup(submissionGroup.id)");
    expect(studio).toContain('purpose: "video"');
    expect(studio).toContain("selectManagedVideoSessionForGroup(");
    expect(studio).toContain(
      "shouldRefreshManagedSession(activeManaged.videoSession)",
    );
    expect(studio).not.toContain("managed.switchGroup(selectedGroup.id)");
  });

  test("contains video faults inside a recoverable workbench boundary with sanitized diagnostics", () => {
    const app = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.tsx"),
      "utf8",
    );
    const studio = app.slice(
      app.indexOf("function AndroidVideoStudio()"),
      app.indexOf("function AndroidImageStudio()"),
    );

    expect(app).toContain("class MobileVideoWorkbenchBoundary");
    expect(studio).toContain("<MobileVideoWorkbenchBoundary");
    expect(studio).toContain("lastAction: lastVideoSelectionAction");
    expect(app).toContain('type: "mobile_video_workbench"');
    expect(app).not.toContain("prompt: this.props.diagnostic");
  });

  test("localizes server suppression codes instead of rendering the raw code", () => {
    const app = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.tsx"),
      "utf8",
    );
    const studio = app.slice(
      app.indexOf("function AndroidVideoStudio()"),
      app.indexOf("function AndroidImageStudio()"),
    );

    expect(app).toContain("function localizedVideoUnavailableReason(");
    expect(app).toContain("price_missing: ");
    expect(app).toContain("adapter_unsupported:");
    expect(app).toContain("subscription_reservation_unsupported:");
    expect(studio).toContain("serverCheckedWithoutVideo");
    expect(studio).toContain("localizedVideoUnavailableReason(");
    expect(studio).not.toContain("unavailableVideoDiagnostic.code}</span>");
  });

  test("shows distinct retry states for missing endpoint, expired login, and failed requests", () => {
    const app = readFileSync(
      resolve(process.cwd(), "app/components/mobile-app.tsx"),
      "utf8",
    );
    const studio = app.slice(
      app.indexOf("function AndroidVideoStudio()"),
      app.indexOf("function AndroidImageStudio()"),
    );
    expect(app).toContain("function videoBootstrapFailureCopy(");
    expect(studio).toContain("classifyMobileVideoBootstrapFailure(error)");
    expect(studio).toContain("bootstrapFailureCopy.title");
    expect(studio).toContain("bootstrapFailureCopy.hint");
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
    expect(parseMobileVideoURL(status)).toBe(
      "https://cdn.example/video_123.mp4",
    );
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
    const prompt = buildMobileVideoScriptPrompt(
      "A train crossing a rainy city",
      "zh-CN",
    );
    expect(prompt).toContain("A train crossing a rainy city");
    expect(prompt).toContain("unsupported model parameters");
    expect(prompt).toContain("Chinese");
  });
});
