import { ChatGPTApi } from "../app/client/platforms/openai";
import { jest } from "@jest/globals";

describe("ChatGPTApi managed model listing", () => {
  afterEach(() => {
    document.head
      .querySelectorAll("meta[name='config']")
      .forEach((m) => m.remove());
    jest.restoreAllMocks();
  });

  test("loads unfiltered Sub2API gateway models in managed mode", async () => {
    const meta = document.createElement("meta");
    meta.name = "config";
    meta.content = JSON.stringify({ sub2apiManagedMode: true });
    document.head.appendChild(meta);

    const fetchMock = jest.fn(async () => {
      return {
        json: async () => ({
          object: "list",
          data: [
            { id: "grok-4-fast", object: "model", root: "grok-4-fast" },
            {
              id: "custom-image-model",
              object: "model",
              root: "custom-image-model",
            },
          ],
        }),
      } as Response;
    });
    Object.defineProperty(window, "fetch", {
      value: fetchMock,
      configurable: true,
    });

    const models = await new ChatGPTApi().models();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/openai/v1/models",
      expect.objectContaining({ method: "GET" }),
    );
    expect(models.map((m) => m.name)).toEqual([
      "grok-4-fast",
      "custom-image-model",
    ]);
    expect(models.every((m) => m.provider.providerName === "OpenAI")).toBe(
      true,
    );
  });
});
