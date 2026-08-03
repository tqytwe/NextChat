import { describe, expect, test } from "@jest/globals";

import {
  resolveMobileChatPreference,
  updateMobileChatPreference,
} from "../app/client/mobile-chat-preference";

type TestModel = { id: string; name: string; image?: boolean };

const groups = [
  {
    id: 7,
    models: [
      { id: "first", name: "first" },
      { id: "chosen", name: "chosen" },
    ],
  },
  {
    id: 9,
    models: [
      { id: "other-first", name: "other-first" },
      { id: "other-chosen", name: "other-chosen" },
    ],
  },
];

type ResolveInput = Omit<
  Parameters<typeof resolveMobileChatPreference<TestModel>>[0],
  "isChatModel" | "modelValue"
>;

function resolve(input: ResolveInput) {
  return resolveMobileChatPreference({
    ...input,
    isChatModel: (model) => !model.image,
    modelValue: (model) => model.name,
  });
}

describe("mobile chat model preference", () => {
  test("keeps a non-first selected model when opening a new chat", () => {
    const preference = updateMobileChatPreference({}, 7, "chosen");

    expect(resolve({ groups, preference, preferredGroupId: 7 })).toEqual({
      groupId: 7,
      model: "chosen",
      reason: "saved",
    });
  });

  test("uses the active valid session choice before an older stored fallback", () => {
    const preference = updateMobileChatPreference({}, 7, "first");

    expect(
      resolve({
        groups,
        preference,
        preferredGroupId: 7,
        candidateModels: ["chosen"],
      }),
    ).toEqual({ groupId: 7, model: "chosen", reason: "saved" });
  });

  test("preserves the saved model before workspace models finish loading", () => {
    const preference = updateMobileChatPreference({}, 7, "chosen");

    expect(resolve({ groups: [], preference, preferredGroupId: 7 })).toEqual({
      groupId: 7,
      model: "chosen",
      reason: "pending",
    });
  });

  test("reports unavailable when a loaded workspace has no chat models", () => {
    const preference = updateMobileChatPreference({}, 7, "chosen");

    expect(
      resolve({
        groups: [],
        workspaceLoaded: true,
        preference,
        preferredGroupId: 7,
      }),
    ).toEqual({ groupId: 7, model: "", reason: "unavailable" });
  });

  test("uses the last valid model for each group and falls back only when unavailable", () => {
    let preference = updateMobileChatPreference({}, 7, "chosen");
    preference = updateMobileChatPreference(preference, 9, "other-chosen");

    expect(resolve({ groups, preference, preferredGroupId: 7 })).toEqual({
      groupId: 7,
      model: "chosen",
      reason: "saved",
    });
    expect(resolve({ groups, preference, preferredGroupId: 9 })).toEqual({
      groupId: 9,
      model: "other-chosen",
      reason: "saved",
    });
    expect(
      resolve({
        groups: [{ id: 7, models: [{ id: "first", name: "first" }] }],
        preference,
        preferredGroupId: 7,
      }),
    ).toEqual({ groupId: 7, model: "first", reason: "fallback" });
  });

  test("finds a uniquely migrated saved model before falling back to another group", () => {
    const preference = updateMobileChatPreference({}, 7, "chosen");

    expect(
      resolve({
        groups: [
          {
            id: 3,
            is_current: true,
            models: [{ id: "current", name: "current" }],
          },
          { id: 9, models: [{ id: "chosen", name: "chosen" }] },
        ],
        preference,
        preferredGroupId: 7,
      }),
    ).toEqual({ groupId: 9, model: "chosen", reason: "migrated" });
  });

  test("uses the server current group before the first group after a saved choice is gone", () => {
    const preference = updateMobileChatPreference({}, 7, "chosen");

    expect(
      resolve({
        groups: [
          { id: 3, models: [{ id: "first", name: "first" }] },
          {
            id: 9,
            is_current: true,
            models: [{ id: "current", name: "current" }],
          },
        ],
        preference,
        preferredGroupId: 7,
      }),
    ).toEqual({ groupId: 9, model: "current", reason: "fallback" });
  });

  test("uses the server current group instead of array order when no preference exists", () => {
    expect(
      resolve({
        groups: [
          { id: 3, models: [{ id: "first", name: "first" }] },
          {
            id: 9,
            is_current: true,
            models: [{ id: "current", name: "current" }],
          },
        ],
        preference: {},
      }),
    ).toEqual({ groupId: 9, model: "current", reason: "default" });
  });

  test("keeps a valid saved group instead of moving it just because its saved model moved", () => {
    const preference = updateMobileChatPreference({}, 7, "chosen");

    expect(
      resolve({
        groups: [
          { id: 7, models: [{ id: "first", name: "first" }] },
          {
            id: 9,
            is_current: true,
            models: [{ id: "chosen", name: "chosen" }],
          },
        ],
        preference,
        preferredGroupId: 7,
      }),
    ).toEqual({ groupId: 7, model: "first", reason: "fallback" });
  });
});
