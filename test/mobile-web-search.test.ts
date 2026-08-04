import { describe, expect, test } from "@jest/globals";
import {
  formatMobileWebSearchContext,
  mobileWebSearchCapability,
  normalizeMobileWebSearchResponse,
} from "../app/client/mobile-web-search";

describe("mobile web search", () => {
  test("requires a server-declared canonical capability", () => {
    expect(
      mobileWebSearchCapability({
        capabilities: {
          search: {
            configured: true,
            execution_state: "observe",
          },
          operation_grants: [
            { id: "mobile.search.web", granted: false, lifecycle: "observe" },
          ],
        },
      }),
    ).toMatchObject({ configured: true, enabled: false });

    expect(
      mobileWebSearchCapability({
        capabilities: {
          search: {
            configured: true,
            provider: "exa",
            execution_state: "canonical",
            user_opt_in_required: true,
          },
          operation_grants: [
            {
              id: "mobile.search.web",
              granted: true,
              lifecycle: "canonical",
            },
          ],
        },
      }),
    ).toMatchObject({ configured: true, enabled: true, provider: "exa" });
  });

  test("normalizes and formats cited sources without exposing secret fields", () => {
    const result = normalizeMobileWebSearchResponse({
      query: "最新模型",
      provider: "exa",
      request_id: "req-42",
      results: [
        {
          title: "Model documentation",
          url: "https://example.com/docs",
          text: "A short summary",
          api_key: "must-not-be-rendered",
        },
        { title: "invalid", url: "javascript:alert(1)" },
      ],
    });
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      title: "Model documentation",
      url: "https://example.com/docs",
      snippet: "A short summary",
    });
    const context = formatMobileWebSearchContext(result, "zh-CN");
    expect(context).toContain("request ID: req-42");
    expect(context).toContain("https://example.com/docs");
    expect(context).not.toContain("must-not-be-rendered");
  });
});
