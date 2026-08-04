import {
  managedJsonRequest,
  ManagedApiError,
  ManagedTransportError,
} from "./managed-nextchat";
import type { MobileProtocol } from "./mobile-platform";

export interface MobileWebSearchSource {
  title: string;
  url: string;
  snippet?: string;
  page_age?: string;
  published_at?: string;
}

export interface MobileWebSearchResponse {
  query: string;
  provider: string;
  request_id: string;
  results: MobileWebSearchSource[];
}

export type MobileWebSearchError =
  | ManagedApiError
  | ManagedTransportError
  | Error;

export function mobileWebSearchCapability(
  protocol: Pick<MobileProtocol, "capabilities"> | null | undefined,
) {
  const capability = protocol?.capabilities?.search;
  const grant = protocol?.capabilities?.operation_grants?.find(
    (item) => item.id === "mobile.search.web",
  );
  return {
    configured: Boolean(capability?.configured),
    enabled: Boolean(
      capability?.configured &&
        capability.execution_state === "canonical" &&
        grant?.granted &&
        grant.lifecycle === "canonical",
    ),
    provider: String(capability?.provider || ""),
    optInRequired: capability?.user_opt_in_required !== false,
  };
}

function normalizeSource(value: unknown): MobileWebSearchSource | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const title = String(item.title || item.name || "").trim();
  const url = String(item.url || item.link || "").trim();
  if (!title || !/^https?:\/\//i.test(url)) return null;
  return {
    title: title.slice(0, 240),
    url,
    snippet: String(item.snippet || item.text || item.description || "")
      .trim()
      .slice(0, 1200),
    page_age: String(item.page_age || item.pageAge || "").trim(),
    published_at: String(item.published_at || item.publishedDate || "").trim(),
  };
}

export function normalizeMobileWebSearchResponse(
  value: unknown,
): MobileWebSearchResponse {
  const body = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  const rawResults = Array.isArray(body.results)
    ? body.results
    : Array.isArray(body.items)
    ? body.items
    : [];
  const results = rawResults
    .map(normalizeSource)
    .filter((item): item is MobileWebSearchSource => Boolean(item))
    .slice(0, 8);
  return {
    query: String(body.query || "").trim(),
    provider: String(body.provider || "").trim(),
    request_id: String(body.request_id || body.requestId || "").trim(),
    results,
  };
}

export async function searchMobileWeb(
  baseUrl: string,
  accessToken: string,
  query: string,
  options: {
    requestId: string;
    locale?: string;
    signal?: AbortSignal;
  },
) {
  const cleanQuery = query.trim().slice(0, 1000);
  if (!cleanQuery) throw new Error("A search query is required.");
  const requestId = options.requestId.trim();
  if (!requestId) throw new Error("A request ID is required.");
  const response = await managedJsonRequest<unknown>(
    baseUrl,
    "/api/v1/mobile/web-search",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Accept-Language": options.locale || "",
        "X-Request-ID": requestId,
        "X-Client-Request-ID": requestId,
      },
      body: JSON.stringify({
        query: cleanQuery,
        opt_in: true,
        client_request_id: requestId,
      }),
      signal: options.signal,
    },
    accessToken,
  );
  return normalizeMobileWebSearchResponse(response);
}

export function formatMobileWebSearchContext(
  response: MobileWebSearchResponse,
  locale: string,
) {
  const zh = locale.toLowerCase().startsWith("zh");
  if (!response.results.length) {
    return zh
      ? `联网搜索未找到可引用结果（request ID: ${
          response.request_id || "unknown"
        }）。`
      : `Web search returned no citable results (request ID: ${
          response.request_id || "unknown"
        }).`;
  }
  const heading = zh
    ? `联网搜索来源（仅供参考，请核对原文；request ID: ${
        response.request_id || "unknown"
      }）`
    : `Web sources (verify the original pages; request ID: ${
        response.request_id || "unknown"
      })`;
  const rows = response.results.map((source, index) =>
    [
      `${index + 1}. ${source.title}`,
      source.url,
      source.snippet
        ? zh
          ? `摘要：${source.snippet}`
          : `Snippet: ${source.snippet}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return `${heading}\n${rows.join("\n")}`;
}
