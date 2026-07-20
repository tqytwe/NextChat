import {
  getManagedWorkspaceDefaultModelForCurrentGroup,
  getManagedWorkspaceLLMModelsForCurrentGroup,
  getManagedWorkspaceCurrentGroup,
  getManagedWorkspaceModelsForCurrentGroup,
  managedWorkspaceModelsToLLMModels,
  resolveManagedWorkspaceURL,
} from "../app/store/managed-workspace";

describe("Sub2API managed workspace model helpers", () => {
  test("selects the active group and converts its models", () => {
    const bootstrap = {
      models: {
        source: "/v1/models",
        selected_group_id: 8,
        groups: [
          {
            id: 7,
            name: "OpenAI main",
            models: [{ id: "gpt-4o-mini", name: "gpt-4o-mini" }],
          },
          {
            id: 8,
            name: "Grok backup",
            models: [
              {
                id: "grok-4-fast",
                name: "grok-4-fast",
                display_name: "Grok 4 Fast",
                sort_order: 2,
              },
            ],
          },
        ],
      },
    } as any;

    const group = getManagedWorkspaceCurrentGroup(bootstrap);
    const models = getManagedWorkspaceModelsForCurrentGroup(bootstrap);
    const llmModels = managedWorkspaceModelsToLLMModels(models);

    expect(group?.id).toBe(8);
    expect(llmModels).toEqual([
      expect.objectContaining({
        name: "grok-4-fast",
        displayName: "Grok 4 Fast",
        available: true,
        provider: expect.objectContaining({
          providerName: "OpenAI",
          providerType: "openai",
        }),
      }),
    ]);
  });

  test("ignores a default model that is not in the selected group", () => {
    const bootstrap = {
      models: {
        source: "/v1/models",
        default_model: "gpt-5.4-mini",
        selected_group_id: 8,
        groups: [
          {
            id: 7,
            name: "OpenAI main",
            models: [{ id: "gpt-5.4-mini", name: "gpt-5.4-mini" }],
          },
          {
            id: 8,
            name: "Grok only",
            models: [{ id: "grok-4-fast", name: "grok-4-fast" }],
          },
        ],
      },
    } as any;

    expect(getManagedWorkspaceDefaultModelForCurrentGroup(bootstrap)).toBe(
      "grok-4-fast",
    );
    expect(
      getManagedWorkspaceLLMModelsForCurrentGroup(bootstrap).map(
        (model) => model.name,
      ),
    ).toEqual(["grok-4-fast"]);
  });

  test("resolves managed workspace actions away from the public homepage", () => {
    expect(
      resolveManagedWorkspaceURL(
        "https://www.jisudeng.com",
        "https://www.jisudeng.com/dashboard",
      ),
    ).toBe("https://www.jisudeng.com/dashboard");
    expect(
      resolveManagedWorkspaceURL(
        "https://www.jisudeng.com/payment",
        "https://www.jisudeng.com/purchase",
      ),
    ).toBe("https://www.jisudeng.com/purchase");
    expect(
      resolveManagedWorkspaceURL(
        "https://console.example.com",
        "https://www.jisudeng.com/dashboard",
      ),
    ).toBe("https://console.example.com/dashboard");
  });
});
