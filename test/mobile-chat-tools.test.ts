import { describe, expect, jest, test } from "@jest/globals";

import {
  createMobileCompletionStreamAccumulator,
  formatMobileWebSearchSources,
  MOBILE_WEB_SEARCH_TOOL,
  runMobileWebSearchToolLoop,
} from "../app/client/mobile-chat-tools";

describe("mobile model-driven web search tools", () => {
  test("accumulates streamed answer text and fragmented tool arguments", () => {
    const deltas: string[] = [];
    const accumulator = createMobileCompletionStreamAccumulator((delta) => deltas.push(delta));
    accumulator.ingest({ choices: [{ delta: { content: "答案" } }] });
    accumulator.ingest({ choices: [{ delta: { tool_calls: [
      { index: 0, id: "call-stream", function: { name: "web_search", arguments: '{"query":"tod' } },
    ] } }] });
    accumulator.ingest({ choices: [{ delta: { tool_calls: [
      { index: 0, function: { arguments: 'ay"}' } },
    ] } }] });

    expect(deltas).toEqual(["答案"]);
    expect(accumulator.payload()).toEqual({
      choices: [{
        message: {
          role: "assistant",
          content: "答案",
          tool_calls: [{
            id: "call-stream",
            type: "function",
            function: { name: "web_search", arguments: '{"query":"today"}' },
          }],
        },
      }],
    });
  });

  test("only calls the search service after the model requests web_search", async () => {
    const requests: unknown[] = [];
    const searches: string[] = [];
    const result = await runMobileWebSearchToolLoop({
      messages: [{ role: "user", content: "请联网查今天的发布内容" }],
      locale: "zh-CN",
      requestCompletion: async (messages) => {
        requests.push(messages);
        if (requests.length === 1) {
          return {
            choices: [
              {
                message: {
                  role: "assistant",
                  tool_calls: [
                    {
                      id: "call-1",
                      type: "function",
                      function: {
                        name: "web_search",
                        arguments: '{"query":"today releases"}',
                      },
                    },
                  ],
                },
              },
            ],
          };
        }
        return { choices: [{ message: { role: "assistant", content: "已查到结果。" } }] };
      },
      search: async (query, toolCallId) => {
        searches.push(`${toolCallId}:${query}`);
        return {
          query,
          provider: "exa",
          request_id: "search-1",
          tool_call_id: toolCallId,
          results: [{ title: "Release", url: "https://example.com/release", snippet: "New release" }],
        };
      },
    });

    expect(MOBILE_WEB_SEARCH_TOOL.function.name).toBe("web_search");
    expect(searches).toEqual(["call-1:today releases"]);
    expect(requests).toHaveLength(2);
    expect(result.content).toBe("已查到结果。");
    expect(result.sources).toEqual([
      expect.objectContaining({ provider: "exa", requestId: "search-1" }),
    ]);
    expect(formatMobileWebSearchSources(result.sources, "zh-CN")).toContain(
      "exa · search-1",
    );
    expect(formatMobileWebSearchSources(result.sources, "ja-JP")).toContain(
      "ウェブの出典",
    );
    expect(formatMobileWebSearchSources(result.sources, "ko-KR")).toContain(
      "웹 출처",
    );
  });

  test("does not search when a capable model answers without a tool call", async () => {
    const search = jest.fn(async (_query: string, _toolCallId: string) => {
      throw new Error("search should not run");
    });
    const result = await runMobileWebSearchToolLoop({
      messages: [{ role: "user", content: "解释这个概念" }],
      locale: "en-US",
      requestCompletion: async () => ({
        choices: [{ message: { role: "assistant", content: "Explanation." } }],
      }),
      search,
    });

    expect(search).not.toHaveBeenCalled();
    expect(result).toMatchObject({ content: "Explanation.", sources: [] });
  });

  test("bounds repeated tool calls and returns a truthful tool error to the model", async () => {
    const requestBodies: any[] = [];
    const result = await runMobileWebSearchToolLoop({
      messages: [{ role: "user", content: "search" }],
      locale: "en-US",
      maxRounds: 1,
      requestCompletion: async (messages) => {
        requestBodies.push(messages);
        if (requestBodies.length === 1) {
          return {
            choices: [
              {
                message: {
                  role: "assistant",
                  tool_calls: [
                    {
                      id: "call-fail",
                      type: "function",
                      function: { name: "web_search", arguments: '{"query":"status"}' },
                    },
                  ],
                },
              },
            ],
          };
        }
        return { choices: [{ message: { role: "assistant", content: "Search is unavailable." } }] };
      },
      search: async () => {
        throw new Error("HTTP 502 upstream busy request req-42");
      },
    });

    expect(requestBodies).toHaveLength(2);
    expect(JSON.stringify(requestBodies[1])).toContain("HTTP 502 upstream busy request req-42");
    expect(result.content).toBe("Search is unavailable.");
  });
});
