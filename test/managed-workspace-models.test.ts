import {
  getManagedWorkspaceDefaultModelForCurrentGroup,
  getManagedWorkspaceLLMModelsForCurrentGroup,
  getManagedWorkspaceCurrentGroup,
  getManagedWorkspaceModelsForCurrentGroup,
  managedWorkspaceModelsToLLMModels,
  resolveManagedWorkspaceURL,
} from "../app/store/managed-workspace";
import { collectVisibleModelsForWorkspace } from "../app/utils/hooks";

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
        "https://www.jisudeng.com/home",
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
        "https://www.jisudeng.com/payment?return=/ai",
        "https://www.jisudeng.com/purchase",
      ),
    ).toBe("https://www.jisudeng.com/purchase?return=/ai");
    expect(
      resolveManagedWorkspaceURL(
        "https://console.example.com",
        "https://www.jisudeng.com/dashboard",
      ),
    ).toBe("https://console.example.com/dashboard");
    expect(
      resolveManagedWorkspaceURL(
        "https://jisuodeng.zeabur.app",
        "https://www.jisudeng.com/purchase",
      ),
    ).toBe("https://www.jisudeng.com/purchase");
  });

  test("uses only Sub2API current-group models in managed mode", () => {
    const models = collectVisibleModelsForWorkspace(
      {
        models: managedWorkspaceModelsToLLMModels([
          { id: "grok-4-fast", name: "grok-4-fast" },
        ]),
        customModels: "+gpt-5.4-mini@openai",
        modelConfig: { model: "grok-4-fast" },
      },
      {
        customModels: "+claude-4-sonnet@anthropic",
        defaultModel: "gpt-5.4-mini",
      },
      true,
    );

    expect(models.map((model) => model.name)).toEqual(["grok-4-fast"]);
    expect(models[0].isDefault).toBe(true);
  });

  test("keeps local custom models only outside managed mode", () => {
    const models = collectVisibleModelsForWorkspace(
      {
        models: managedWorkspaceModelsToLLMModels([
          { id: "grok-4-fast", name: "grok-4-fast" },
        ]),
        customModels: "+gpt-5.4-mini@openai",
        modelConfig: { model: "grok-4-fast" },
      },
      {
        customModels: "+claude-4-sonnet@anthropic",
        defaultModel: "gpt-5.4-mini",
      },
      false,
    );

    expect(models.map((model) => model.name)).toEqual([
      "gpt-5.4-mini",
      "claude-4-sonnet",
      "grok-4-fast",
    ]);
    expect(
      models.find((model) => model.name === "gpt-5.4-mini")?.isDefault,
    ).toBe(true);
  });
});
