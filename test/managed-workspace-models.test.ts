import {
  getManagedWorkspaceCurrentGroup,
  getManagedWorkspaceModelsForCurrentGroup,
  managedWorkspaceModelsToLLMModels,
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
});
