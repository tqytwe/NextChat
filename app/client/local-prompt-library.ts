import { del, get, set } from "idb-keyval";
import { managedDownloadBlob, managedRequestText } from "./managed-nextchat";

export type LocalPromptCatalogKind = "image" | "video";
// "canvas" is the domestic image directory mirrored from the published
// creation workspace. Keep it separate from the platform-owned video library
// so an old image cache can never be mistaken for a video-capable template.
export type LocalPromptCatalogSource = "platform" | "canvas";

// Canvas owns the public image-prompt directory. This is deliberately an
// unauthenticated origin: never proxy a managed access token through it.
const CANVAS_PROMPT_CATALOG_ORIGIN = "https://canvas.jisudeng.com";
const CANVAS_PROMPT_PAGE_SIZE = 500;

export interface LocalPromptCatalogMedia {
  media_type?: string;
  url?: string;
  alt_zh?: string;
  sort_order?: number;
}

export interface LocalPromptCatalogItem {
  id: string;
  title: string;
  description: string;
  prompt_text: string;
  purpose: string;
  style: string;
  subject: string;
  category: string;
  categories: string[];
  featured: boolean;
  version: number;
  updated_at: string;
  media: LocalPromptCatalogMedia[];
  cover_url?: string;
  cover_fingerprint?: string;
  fingerprint: string;
}

export interface LocalPromptCatalogCategory {
  id: string;
  label: string;
  axis?: string;
  /** Stable server-side category ID, used to map prompt category_ids to slug. */
  sourceId?: string;
}

export interface LocalPromptCatalog {
  schema: 1;
  accountId: string;
  locale: string;
  kind: LocalPromptCatalogKind;
  source: LocalPromptCatalogSource;
  marker: string;
  /** Server cursor used to request only changed/deleted prompt records. */
  cursor?: string;
  syncedAt: number;
  items: LocalPromptCatalogItem[];
  categories: LocalPromptCatalogCategory[];
}

export interface PromptCatalogRequestResponse {
  ok: boolean;
  status: number;
  text: string;
}

export interface SyncLocalPromptCatalogOptions {
  signal?: AbortSignal;
  requestText?: (
    baseUrl: string,
    path: string,
    init: RequestInit,
    headers: Headers,
  ) => Promise<PromptCatalogRequestResponse>;
  downloadBlob?: (
    url: string,
    accessToken: string,
    signal?: AbortSignal,
  ) => Promise<Blob>;
}

export interface LocalPromptCatalogSyncResult {
  changed: boolean;
  downloadedCovers: number;
  fromCache: boolean;
  offline: boolean;
  catalog: LocalPromptCatalog;
}

type PromptPage = {
  items?: unknown[];
  total?: number;
  pages?: number;
};

type PromptCatalogManifest = {
  revision?: unknown;
  media_type?: unknown;
  total?: unknown;
  updated_at?: unknown;
};

type PromptCatalogDelta = {
  cursor?: unknown;
  version?: unknown;
  etag?: unknown;
  items?: unknown[];
  deleted_ids?: unknown[];
  categories?: unknown;
};

type PromptEnvelope<T> = {
  code?: number | string;
  message?: string;
  data?: T;
};

type RecordValue = Record<string, unknown>;

const CATALOG_KEY_PREFIX = "jisudeng-local-prompt-catalog:v1:";
const COVER_KEY_PREFIX = "jisudeng-local-prompt-cover:v1:";
const SYNC_CONCURRENCY = 6;
const syncInFlight = new Map<string, Promise<LocalPromptCatalogSyncResult>>();

function normalizedString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function normalizedAccountId(accountId: string) {
  return String(accountId || "").trim();
}

function normalizedLocale(locale: string) {
  const normalized = String(locale || "")
    .trim()
    .toLowerCase();
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("ja")) return "ja";
  if (normalized.startsWith("ko")) return "ko";
  return "en";
}

function catalogScope(
  accountId: string,
  locale: string,
  kind: LocalPromptCatalogKind,
  source: LocalPromptCatalogSource = "platform",
) {
  const scope = [
    encodeURIComponent(normalizedAccountId(accountId)),
    encodeURIComponent(normalizedLocale(locale)),
    kind,
  ].join(":");
  // Preserve the old platform key so a video cache produced by an earlier
  // Direct build remains usable. Canvas image data deliberately gets a new
  // namespace and therefore cannot collide with it.
  return source === "platform" ? scope : `${scope}:${source}`;
}

function catalogKey(
  accountId: string,
  locale: string,
  kind: LocalPromptCatalogKind,
  source: LocalPromptCatalogSource = "platform",
) {
  return `${CATALOG_KEY_PREFIX}${catalogScope(
    accountId,
    locale,
    kind,
    source,
  )}`;
}

function coverKey(
  accountId: string,
  locale: string,
  kind: LocalPromptCatalogKind,
  id: string,
  source: LocalPromptCatalogSource = "platform",
) {
  return `${COVER_KEY_PREFIX}${catalogScope(
    accountId,
    locale,
    kind,
    source,
  )}:${id}`;
}

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(normalizedString).filter(Boolean)
    : [];
}

function normalizeMedia(value: unknown): LocalPromptCatalogMedia[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry): LocalPromptCatalogMedia | null => {
      const item = asRecord(entry);
      if (!item) return null;
      const url = publicHTTPSURL(normalizedString(item.url));
      if (!url) return null;
      return {
        media_type: normalizedString(item.media_type),
        url,
        alt_zh: normalizedString(item.alt_zh),
        sort_order: Number(item.sort_order || 0),
      } satisfies LocalPromptCatalogMedia;
    })
    .filter((item): item is LocalPromptCatalogMedia => item !== null)
    .sort(
      (left, right) =>
        Number(left.sort_order || 0) - Number(right.sort_order || 0),
    );
}

function publicHTTPSURL(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function firstCover(media: LocalPromptCatalogMedia[]) {
  return (
    media.find(
      (item) => normalizedString(item.media_type).toLowerCase() === "image",
    ) || media[0]
  );
}

function promptFingerprint(item: RecordValue) {
  const mediaFingerprint = normalizeMedia(item.media)
    .map((media) =>
      [
        normalizedString(media.media_type),
        normalizedString(media.url),
        normalizedString(media.alt_zh),
        Number(media.sort_order || 0),
      ].join("~"),
    )
    .join("|");
  return [
    normalizedString(item.id),
    Number(item.version || 0),
    normalizedString(item.updated_at) || normalizedString(item.updatedAt),
    normalizedString(item.prompt_text) || normalizedString(item.prompt),
    mediaFingerprint,
  ].join(":");
}

function normalizeCatalogItem(
  listItem: RecordValue,
  detail?: RecordValue | null,
  categoryAliases?: ReadonlyMap<string, string>,
): LocalPromptCatalogItem {
  const source = { ...listItem, ...(detail || {}) };
  const id = normalizedString(source.id);
  const purpose = normalizedString(source.purpose);
  const style = normalizedString(source.style);
  const subject = normalizedString(source.subject);
  const categories = [
    ...asStringArray(source.categories),
    ...asStringArray(source.category_ids).map(
      (id) => categoryAliases?.get(id) || id,
    ),
    normalizedString(source.category),
    ...asStringArray(source.tags),
  ].filter(Boolean);
  const category = categories[0] || purpose || style || subject || "featured";
  const media = normalizeMedia(source.media);
  const topLevelCover = publicHTTPSURL(
    normalizedString(source.cover_url) || normalizedString(source.coverUrl),
  );
  if (!media.length && topLevelCover) {
    media.push({ media_type: "image", url: topLevelCover, sort_order: 0 });
  }
  const cover = firstCover(media);
  const version = Math.max(0, Number(source.version || 0));
  const updatedAt =
    normalizedString(source.updated_at) || normalizedString(source.updatedAt);
  return {
    id,
    title: normalizedString(source.title) || id,
    description: normalizedString(source.description),
    prompt_text:
      normalizedString(source.prompt_text) || normalizedString(source.prompt),
    purpose,
    style,
    subject,
    category,
    categories: [...new Set(categories)],
    featured: Boolean(source.featured),
    version,
    updated_at: updatedAt,
    media,
    cover_url: normalizedString(cover?.url) || undefined,
    cover_fingerprint: cover?.url
      ? `${cover.url}:${version}:${updatedAt}`
      : undefined,
    fingerprint: promptFingerprint(source),
  };
}

function normalizeCategories(value: unknown): LocalPromptCatalogCategory[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const categories: LocalPromptCatalogCategory[] = [];
  for (const entry of value) {
    // The managed prompt-library endpoint returns category objects, while
    // the Creation Space mirror intentionally keeps its compact catalog
    // response as a string array. Normalize both wire shapes so the mobile
    // picker does not lose category filtering for mirrored prompts.
    if (typeof entry === "string" || typeof entry === "number") {
      const id = normalizedString(entry);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      categories.push({ id, label: id });
      continue;
    }
    const item = asRecord(entry);
    if (!item) continue;
    const sourceId = normalizedString(item.id);
    const id = normalizedString(item.slug) || sourceId;
    const label =
      normalizedString(item.name_zh) ||
      normalizedString(item.name) ||
      normalizedString(item.label) ||
      id;
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    categories.push({
      id,
      label,
      axis: normalizedString(item.dimension) || undefined,
      sourceId: sourceId || undefined,
    });
  }
  return categories;
}

function categoryAliases(categories: LocalPromptCatalogCategory[]) {
  const aliases = new Map<string, string>();
  for (const category of categories) {
    aliases.set(category.id, category.id);
    if (category.sourceId) aliases.set(category.sourceId, category.id);
  }
  return aliases;
}

function markerFor(page: PromptPage, categories: unknown) {
  const first = asRecord(page.items?.[0]);
  const categoryMarker = (Array.isArray(categories) ? categories : [])
    .map((entry) => {
      const item = asRecord(entry);
      if (!item) return "";
      return [
        normalizedString(item.id),
        normalizedString(item.slug),
        normalizedString(item.updated_at),
        normalizedString(item.name_zh),
      ].join(":");
    })
    .filter(Boolean)
    .sort()
    .join("|");
  return [
    Math.max(0, Number(page.total || 0)),
    promptFingerprint(first || {}),
    categoryMarker,
  ].join("|");
}

function promptCatalogBasePath(source: LocalPromptCatalogSource) {
  return source === "canvas"
    ? "/api/v1/mobile/canvas-prompts"
    : "/api/v1/prompts";
}

function promptCategoriesPath(source: LocalPromptCatalogSource) {
  return source === "canvas"
    ? `${promptCatalogBasePath(source)}/categories`
    : "/api/v1/prompt-categories";
}

function promptListPath(
  source: LocalPromptCatalogSource,
  kind: LocalPromptCatalogKind,
  page: number,
  pageSize: number,
) {
  return `${promptCatalogBasePath(source)}?media_type=${encodeURIComponent(
    kind,
  )}&page=${page}&page_size=${pageSize}&sort=${
    pageSize === 1 ? "latest" : "featured"
  }`;
}

function promptCatalogPath(
  source: LocalPromptCatalogSource,
  kind: LocalPromptCatalogKind,
  page: number,
  pageSize: number,
) {
  return `${promptCatalogBasePath(
    source,
  )}/catalog?media_type=${encodeURIComponent(
    kind,
  )}&page=${page}&page_size=${pageSize}`;
}

function promptCatalogDeltaPath(
  source: LocalPromptCatalogSource,
  kind: LocalPromptCatalogKind,
  cursor: string,
) {
  return `${promptCatalogBasePath(
    source,
  )}/catalog/delta?media_type=${encodeURIComponent(
    kind,
  )}&since=${encodeURIComponent(cursor)}`;
}

function promptManifestPath(
  source: LocalPromptCatalogSource,
  kind: LocalPromptCatalogKind,
  locale: string,
) {
  return `${promptCatalogBasePath(
    source,
  )}/manifest?media_type=${encodeURIComponent(
    kind,
  )}&locale=${encodeURIComponent(normalizedLocale(locale))}`;
}

function requestHeaders(accessToken: string, locale: string) {
  return new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    "Accept-Language": normalizedLocale(locale),
  });
}

function canvasRequestHeaders(locale: string) {
  return new Headers({
    Accept: "application/json",
    "Accept-Language": normalizedLocale(locale),
  });
}

class PromptCatalogRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PromptCatalogRequestError";
  }
}

async function requestData<T>(
  baseUrl: string,
  path: string,
  accessToken: string,
  locale: string,
  options: SyncLocalPromptCatalogOptions,
) {
  const requestText = options.requestText || managedRequestText;
  const response = await requestText(
    baseUrl,
    path,
    { method: "GET", signal: options.signal },
    requestHeaders(accessToken, locale),
  );
  if (!response.ok) {
    throw new PromptCatalogRequestError(
      response.status,
      `prompt catalog request failed: HTTP ${response.status}`,
    );
  }
  let envelope: PromptEnvelope<T> | null = null;
  try {
    envelope = JSON.parse(response.text) as PromptEnvelope<T>;
  } catch {
    // The server contract must remain a standard managed envelope.
  }
  if (!envelope || envelope.code !== 0 || envelope.data === undefined) {
    throw new PromptCatalogRequestError(
      response.status,
      envelope?.message || "prompt catalog response is invalid",
    );
  }
  return envelope.data;
}

/**
 * The manifest is intentionally the only request made during an unchanged
 * app start. A 404 is an upgrade-compatibility fallback for an older backend;
 * current servers expose this route and return a strong revision/ETag.
 */
async function requestPromptCatalogManifest(
  baseUrl: string,
  accessToken: string,
  locale: string,
  source: LocalPromptCatalogSource,
  kind: LocalPromptCatalogKind,
  previousMarker: string,
  options: SyncLocalPromptCatalogOptions,
) {
  const requestText = options.requestText || managedRequestText;
  const headers = requestHeaders(accessToken, locale);
  const marker = normalizedString(previousMarker).replace(/^"|"$/g, "");
  if (marker) headers.set("If-None-Match", `"${marker}"`);
  const response = await requestText(
    baseUrl,
    promptManifestPath(source, kind, locale),
    { method: "GET", signal: options.signal },
    headers,
  );
  if (response.status === 304) {
    return { supported: true, unchanged: true, marker };
  }
  if (response.status === 404 || response.status === 405) {
    return { supported: false, unchanged: false, marker: "" };
  }
  if (!response.ok) {
    throw new PromptCatalogRequestError(
      response.status,
      `prompt catalog manifest request failed: HTTP ${response.status}`,
    );
  }
  let envelope: PromptEnvelope<PromptCatalogManifest> | null = null;
  try {
    envelope = JSON.parse(
      response.text,
    ) as PromptEnvelope<PromptCatalogManifest>;
  } catch {
    // Keep the failure explicit so an existing on-device catalog stays usable.
  }
  const manifest = envelope?.data;
  const revision = normalizedString(manifest?.revision);
  if (!envelope || envelope.code !== 0 || !manifest || !revision) {
    throw new PromptCatalogRequestError(
      response.status,
      envelope?.message || "prompt catalog manifest is invalid",
    );
  }
  return {
    supported: true,
    unchanged: Boolean(marker && marker === revision),
    marker: revision,
    cursor: normalizedString(manifest.updated_at),
  };
}

async function requestPromptCatalogDelta(
  baseUrl: string,
  accessToken: string,
  locale: string,
  source: LocalPromptCatalogSource,
  kind: LocalPromptCatalogKind,
  cursor: string,
  marker: string,
  options: SyncLocalPromptCatalogOptions,
) {
  const requestText = options.requestText || managedRequestText;
  const headers = requestHeaders(accessToken, locale);
  const normalizedMarker = normalizedString(marker).replace(/^"|"$/g, "");
  if (normalizedMarker) headers.set("If-None-Match", `"${normalizedMarker}"`);
  const response = await requestText(
    baseUrl,
    promptCatalogDeltaPath(source, kind, cursor),
    { method: "GET", signal: options.signal },
    headers,
  );
  if (response.status === 304) {
    return { supported: true, unchanged: true as const };
  }
  if (response.status === 404 || response.status === 405) {
    return { supported: false, unchanged: false as const };
  }
  if (!response.ok) {
    throw new PromptCatalogRequestError(
      response.status,
      `prompt catalog delta request failed: HTTP ${response.status}`,
    );
  }
  let envelope: PromptEnvelope<PromptCatalogDelta> | null = null;
  try {
    envelope = JSON.parse(response.text) as PromptEnvelope<PromptCatalogDelta>;
  } catch {
    // Keep existing offline data intact on an invalid server payload.
  }
  if (!envelope || envelope.code !== 0 || !envelope.data) {
    throw new PromptCatalogRequestError(
      response.status,
      envelope?.message || "prompt catalog delta response is invalid",
    );
  }
  const payload = envelope.data;
  const nextCursor = normalizedString(payload.cursor);
  const nextMarker = normalizedString(payload.version || payload.etag);
  if (!nextCursor || !nextMarker) {
    throw new PromptCatalogRequestError(
      response.status,
      "prompt catalog delta response is missing its revision cursor",
    );
  }
  return {
    supported: true,
    unchanged: false as const,
    cursor: nextCursor,
    marker: nextMarker,
    items: (Array.isArray(payload.items) ? payload.items : [])
      .map(asRecord)
      .filter((item): item is RecordValue => Boolean(item)),
    deletedIDs: (Array.isArray(payload.deleted_ids) ? payload.deleted_ids : [])
      .map(normalizedString)
      .filter(Boolean),
    categories: payload.categories,
  };
}

async function fetchAllPromptItems(
  baseUrl: string,
  accessToken: string,
  locale: string,
  source: LocalPromptCatalogSource,
  kind: LocalPromptCatalogKind,
  options: SyncLocalPromptCatalogOptions,
) {
  const catalog = await fetchAllPromptCatalogItems(
    baseUrl,
    accessToken,
    locale,
    source,
    kind,
    options,
  );
  if (catalog.supported) return catalog.items;

  return fetchAllPromptItemsLegacy(
    baseUrl,
    accessToken,
    locale,
    source,
    kind,
    options,
  );
}

async function fetchAllPromptCatalogItems(
  baseUrl: string,
  accessToken: string,
  locale: string,
  source: LocalPromptCatalogSource,
  kind: LocalPromptCatalogKind,
  options: SyncLocalPromptCatalogOptions,
): Promise<{ supported: boolean; items: RecordValue[] }> {
  const requestText = options.requestText || managedRequestText;
  const requestPage = async (page: number) => {
    const response = await requestText(
      baseUrl,
      promptCatalogPath(source, kind, page, 100),
      { method: "GET", signal: options.signal },
      requestHeaders(accessToken, locale),
    );
    if (response.status === 404 || response.status === 405) {
      return { supported: false as const };
    }
    if (!response.ok) {
      throw new PromptCatalogRequestError(
        response.status,
        `prompt catalog request failed: HTTP ${response.status}`,
      );
    }
    let envelope: PromptEnvelope<PromptPage> | null = null;
    try {
      envelope = JSON.parse(response.text) as PromptEnvelope<PromptPage>;
    } catch {
      // Keep the response error explicit instead of silently dropping a page.
    }
    if (!envelope || envelope.code !== 0 || !envelope.data) {
      throw new PromptCatalogRequestError(
        response.status,
        envelope?.message || "prompt catalog response is invalid",
      );
    }
    return { supported: true as const, page: envelope.data };
  };

  const first = await requestPage(1);
  if (!first.supported) return { supported: false, items: [] };
  const items = [...(Array.isArray(first.page.items) ? first.page.items : [])];
  const pages = Math.max(1, Number(first.page.pages || 1));
  for (let page = 2; page <= pages; page += 1) {
    const next = await requestPage(page);
    // A server must not change capabilities halfway through one sync. Treat a
    // disappearing catalog route as a compatibility fallback for this run.
    if (!next.supported) return { supported: false, items: [] };
    if (Array.isArray(next.page.items)) items.push(...next.page.items);
  }
  return {
    supported: true,
    items: items
      .map(asRecord)
      .filter((item): item is RecordValue => Boolean(item)),
  };
}

async function fetchAllPromptItemsLegacy(
  baseUrl: string,
  accessToken: string,
  locale: string,
  source: LocalPromptCatalogSource,
  kind: LocalPromptCatalogKind,
  options: SyncLocalPromptCatalogOptions,
) {
  const first = await requestData<PromptPage>(
    baseUrl,
    promptListPath(source, kind, 1, 100),
    accessToken,
    locale,
    options,
  );
  const items = [...(Array.isArray(first.items) ? first.items : [])];
  const pages = Math.max(1, Number(first.pages || 1));
  for (let page = 2; page <= pages; page += 1) {
    const next = await requestData<PromptPage>(
      baseUrl,
      promptListPath(source, kind, page, 100),
      accessToken,
      locale,
      options,
    );
    if (Array.isArray(next.items)) items.push(...next.items);
  }
  return items
    .map(asRecord)
    .filter((item): item is RecordValue => Boolean(item));
}

type CanvasPromptDirectoryPage = {
  items?: unknown[];
  categories?: unknown[];
  total?: unknown;
};

function canvasCatalogMarker(
  items: RecordValue[],
  total: number,
  categories: unknown,
) {
  // The published directory does not yet expose ETag. Keep a compact marker
  // for diagnostics and compare the normalized item fingerprints below for
  // correctness; do not store all prompt bodies in a synthetic marker.
  const latest = items.reduce((value, item) => {
    const updated = normalizedString(item.updatedAt || item.updated_at);
    return updated > value ? updated : value;
  }, "");
  return `${total}:${latest}:${normalizeCategories(categories).length}`;
}

async function syncCanvasImagePromptCatalog(
  account: string,
  locale: string,
  options: SyncLocalPromptCatalogOptions,
): Promise<LocalPromptCatalogSyncResult> {
  const language = normalizedLocale(locale);
  const previous = await readLocalPromptCatalog(
    account,
    language,
    "image",
    "canvas",
  );
  // The public Canvas directory currently has no ETag. A six-hour refresh
  // keeps operator edits discoverable without downloading 1,500+ prompts on
  // every foreground resume; the cached catalog remains available offline.
  const refreshDue =
    !previous || Date.now() - previous.syncedAt >= 6 * 60 * 60 * 1000;
  if (!refreshDue && previous) {
    return {
      changed: false,
      downloadedCovers: 0,
      fromCache: true,
      offline: false,
      catalog: previous,
    };
  }

  const requestText = options.requestText || managedRequestText;
  try {
    const requestPage = async (page: number) => {
      const response = await requestText(
        CANVAS_PROMPT_CATALOG_ORIGIN,
        `/api/prompts?page=${page}&pageSize=${CANVAS_PROMPT_PAGE_SIZE}`,
        { method: "GET", signal: options.signal },
        canvasRequestHeaders(language),
      );
      if (!response.ok) {
        throw new PromptCatalogRequestError(
          response.status,
          `Canvas prompt catalog request failed: HTTP ${response.status}`,
        );
      }
      let envelope: PromptEnvelope<CanvasPromptDirectoryPage> | null = null;
      try {
        envelope = JSON.parse(
          response.text,
        ) as PromptEnvelope<CanvasPromptDirectoryPage>;
      } catch {
        // The existing cache is retained below when Canvas returns malformed JSON.
      }
      if (
        !envelope ||
        envelope.code !== 0 ||
        !envelope.data ||
        !Array.isArray(envelope.data.items)
      ) {
        throw new PromptCatalogRequestError(
          response.status,
          "Canvas prompt catalog response is invalid",
        );
      }
      return envelope.data;
    };

    const first = await requestPage(1);
    const total = Math.max(0, Number(first.total || 0));
    const pages = Math.max(1, Math.ceil(total / CANVAS_PROMPT_PAGE_SIZE));
    const pagesData = [first];
    for (let page = 2; page <= pages; page += 1)
      pagesData.push(await requestPage(page));
    const categories = first.categories || [];
    const aliases = categoryAliases(normalizeCategories(categories));
    const items = pagesData
      .flatMap((page) => page.items || [])
      .map(asRecord)
      .filter((item): item is RecordValue => Boolean(item))
      .map((item) => normalizeCatalogItem(item, item, aliases))
      .filter((item) => Boolean(item.id && item.prompt_text));
    const catalog: LocalPromptCatalog = {
      schema: 1,
      accountId: account,
      locale: language,
      kind: "image",
      source: "canvas",
      marker: canvasCatalogMarker(
        pagesData
          .flatMap((page) => page.items || [])
          .map(asRecord)
          .filter((item): item is RecordValue => Boolean(item)),
        total,
        categories,
      ),
      syncedAt: Date.now(),
      items,
      categories: normalizeCategories(categories),
    };
    const previousByID = new Map(
      (previous?.items || []).map((item) => [item.id, item.fingerprint]),
    );
    const changed =
      !previous ||
      previous.items.length !== catalog.items.length ||
      catalog.items.some(
        (item) => previousByID.get(item.id) !== item.fingerprint,
      );
    await set(catalogKey(account, language, "image", "canvas"), catalog);
    return {
      changed,
      downloadedCovers: 0,
      fromCache: false,
      offline: false,
      catalog,
    };
  } catch (error) {
    if (previous)
      return {
        changed: false,
        downloadedCovers: 0,
        fromCache: true,
        offline: true,
        catalog: previous,
      };
    throw error;
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const result = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), values.length) },
    async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        result[index] = await mapper(values[index]);
      }
    },
  );
  await Promise.all(workers);
  return result;
}

function asStoredCatalog(value: unknown): LocalPromptCatalog | null {
  const catalog = asRecord(value);
  if (!catalog || catalog.schema !== 1 || !Array.isArray(catalog.items))
    return null;
  const accountId = normalizedString(catalog.accountId);
  const locale = normalizedLocale(normalizedString(catalog.locale));
  const kind = normalizedString(catalog.kind);
  const source = normalizedString(catalog.source) || "platform";
  if (
    !accountId ||
    (kind !== "image" && kind !== "video") ||
    (source !== "platform" && source !== "canvas")
  ) {
    return null;
  }
  const categories = normalizeCategories(catalog.categories);
  const aliases = categoryAliases(categories);
  return {
    schema: 1,
    accountId,
    locale,
    kind,
    source,
    marker: normalizedString(catalog.marker),
    cursor: normalizedString(catalog.cursor) || undefined,
    syncedAt: Math.max(0, Number(catalog.syncedAt || 0)),
    items: catalog.items
      .map(asRecord)
      .filter((item): item is RecordValue => Boolean(item))
      .map((item) => normalizeCatalogItem(item, item, aliases))
      .filter((item) => Boolean(item.id)),
    categories,
  };
}

export async function readLocalPromptCatalog(
  accountId: string,
  locale: string,
  kind: LocalPromptCatalogKind,
  source: LocalPromptCatalogSource = "platform",
) {
  const account = normalizedAccountId(accountId);
  if (!account) return null;
  const catalog = asStoredCatalog(
    await get<unknown>(catalogKey(account, locale, kind, source)),
  );
  return catalog?.source === source ? catalog : null;
}

export async function readLocalPromptCover(
  accountId: string,
  locale: string,
  kind: LocalPromptCatalogKind,
  promptId: string,
  source: LocalPromptCatalogSource = "platform",
) {
  const account = normalizedAccountId(accountId);
  const id = normalizedString(promptId);
  if (!account || !id) return null;
  const value = await get<unknown>(coverKey(account, locale, kind, id, source));
  return value instanceof Blob ? value : null;
}

export async function createLocalPromptCoverObjectURL(
  accountId: string,
  locale: string,
  kind: LocalPromptCatalogKind,
  promptId: string,
  source: LocalPromptCatalogSource = "platform",
) {
  const blob = await readLocalPromptCover(
    accountId,
    locale,
    kind,
    promptId,
    source,
  );
  if (!blob || typeof URL === "undefined" || !URL.createObjectURL) return "";
  return URL.createObjectURL(blob);
}

export async function hydrateLocalPromptCatalogCovers(
  accountId: string,
  locale: string,
  kind: LocalPromptCatalogKind,
  catalog: LocalPromptCatalog,
) {
  const objectURLs: string[] = [];
  const items = await Promise.all(
    catalog.items.map(async (item) => {
      const url = await createLocalPromptCoverObjectURL(
        accountId,
        locale,
        kind,
        item.id,
        catalog.source,
      );
      if (url) objectURLs.push(url);
      return { item, coverUrl: url };
    }),
  );
  return { items, objectURLs };
}

export async function clearLocalPromptCatalogs(accountId: string) {
  const account = normalizedAccountId(accountId);
  if (!account) return;
  for (const locale of ["zh", "en", "ja", "ko"]) {
    for (const kind of ["image", "video"] as const) {
      for (const source of ["platform", "canvas"] as const) {
        const catalog = await readLocalPromptCatalog(
          account,
          locale,
          kind,
          source,
        );
        await del(catalogKey(account, locale, kind, source));
        await Promise.all(
          (catalog?.items || []).map((item) =>
            del(coverKey(account, locale, kind, item.id, source)),
          ),
        );
      }
    }
  }
}

async function cachePromptCatalogCovers(
  account: string,
  language: string,
  source: LocalPromptCatalogSource,
  kind: LocalPromptCatalogKind,
  catalog: LocalPromptCatalog,
  previous: LocalPromptCatalog | null,
  changedIDs: Set<string>,
  accessToken: string,
  baseUrl: string,
  options: SyncLocalPromptCatalogOptions,
) {
  const downloader =
    options.downloadBlob ||
    ((url: string, token: string, signal?: AbortSignal) =>
      managedDownloadBlob(baseUrl, url, token, signal));
  const previousByID = new Map(
    (previous?.items || []).map((item) => [item.id, item]),
  );
  const downloadedFlags = await mapWithConcurrency(
    catalog.items.filter((item) => changedIDs.has(item.id)),
    SYNC_CONCURRENCY,
    async (item) => {
      const old = previousByID.get(item.id);
      if (!item.cover_url) {
        if (old?.cover_url) {
          await del(coverKey(account, language, kind, item.id, source));
        }
        return 0;
      }
      const cover = await readLocalPromptCover(
        account,
        language,
        kind,
        item.id,
        source,
      );
      if (old?.cover_fingerprint === item.cover_fingerprint && cover) {
        return 0;
      }
      try {
        const blob = await downloader(
          item.cover_url,
          accessToken,
          options.signal,
        );
        if (!(blob instanceof Blob) || blob.size === 0) return 0;
        await set(coverKey(account, language, kind, item.id, source), blob);
        return 1;
      } catch {
        // A cover is presentation metadata, not the prompt body. Keep the
        // catalog usable and retry this cover during the next sync instead of
        // hiding every prompt because one external image is unavailable.
        return 0;
      }
    },
  );
  return downloadedFlags.reduce<number>((total, value) => total + value, 0);
}

async function applyPromptCatalogDelta(
  previous: LocalPromptCatalog,
  payload: {
    cursor: string;
    marker: string;
    items: RecordValue[];
    deletedIDs: string[];
    categories: unknown;
  },
) {
  const previousByID = new Map(previous.items.map((item) => [item.id, item]));
  const deleted = new Set(payload.deletedIDs);
  const changedIDs = new Set<string>();
  const categories =
    payload.categories === undefined
      ? previous.categories
      : normalizeCategories(payload.categories);
  const aliases = categoryAliases(categories);
  for (const raw of payload.items) {
    const id = normalizedString(raw.id);
    if (!id || deleted.has(id)) continue;
    const old = previousByID.get(id);
    const next = normalizeCatalogItem(raw, raw, aliases);
    if (!next.prompt_text && old?.prompt_text) {
      previousByID.set(id, old);
      continue;
    }
    if (next.id && next.prompt_text) {
      previousByID.set(id, next);
      changedIDs.add(id);
    }
  }
  for (const id of deleted) previousByID.delete(id);
  return {
    catalog: {
      ...previous,
      marker: payload.marker,
      cursor: payload.cursor,
      syncedAt: Date.now(),
      items: [...previousByID.values()],
      categories,
    } satisfies LocalPromptCatalog,
    changedIDs,
    deleted,
  };
}

async function syncLocalPromptCatalogInternal(
  accountId: string,
  locale: string,
  kind: LocalPromptCatalogKind,
  source: LocalPromptCatalogSource,
  baseUrl: string,
  accessToken: string,
  options: SyncLocalPromptCatalogOptions,
): Promise<LocalPromptCatalogSyncResult> {
  const account = normalizedAccountId(accountId);
  if (!account) {
    throw new Error("A signed-in account is required.");
  }
  if (source === "canvas") {
    if (kind !== "image") {
      throw new Error("Canvas prompt catalog supports image prompts only.");
    }
    return syncCanvasImagePromptCatalog(account, locale, options);
  }
  if (!accessToken) {
    throw new Error("A signed-in account is required.");
  }
  const language = normalizedLocale(locale);
  const previous = await readLocalPromptCatalog(
    account,
    language,
    kind,
    source,
  );
  // IndexedDB may evict large cover blobs while retaining the catalog index.
  // Do not accept a manifest 304 in that state: force one metadata refresh so
  // the normal cover reconciliation can repair only the missing blobs.
  let previousMarker = previous?.marker || "";
  const missingCoverIDs = new Set<string>();
  if (previous) {
    const missingCover = await mapWithConcurrency(
      previous.items.filter((item) => Boolean(item.cover_url)),
      SYNC_CONCURRENCY,
      async (item) => ({
        id: item.id,
        missing: !(await readLocalPromptCover(
          account,
          language,
          kind,
          item.id,
          source,
        )),
      }),
    );
    for (const item of missingCover) {
      if (item.missing) missingCoverIDs.add(item.id);
    }
    if (missingCoverIDs.size) previousMarker = "";
  }
  let marker = "";
  let manifestCursor = "";
  let rawCategories: unknown;
  try {
    const manifest = await requestPromptCatalogManifest(
      baseUrl,
      accessToken,
      language,
      source,
      kind,
      previousMarker,
      options,
    );
    if (manifest.supported) {
      marker = manifest.marker || previous?.marker || "";
      manifestCursor = manifest.cursor || previous?.cursor || "";
      if (manifest.unchanged && previous) {
        return {
          changed: false,
          downloadedCovers: 0,
          fromCache: true,
          offline: false,
          catalog: previous,
        };
      }
      // The metadata index can remain after IndexedDB evicts one or more
      // cover blobs. A forced manifest response with the same revision is
      // enough to repair those blobs directly from the existing index; do not
      // request the whole catalog or let a delta 304 hide the repair.
      if (previous && missingCoverIDs.size > 0 && marker === previous.marker) {
        const downloadedCovers = await cachePromptCatalogCovers(
          account,
          language,
          source,
          kind,
          previous,
          previous,
          missingCoverIDs,
          accessToken,
          baseUrl,
          options,
        );
        return {
          changed: downloadedCovers > 0,
          downloadedCovers,
          fromCache: false,
          offline: false,
          catalog: previous,
        };
      }
      // A current server can return only changed/deleted catalog entries.
      // Keep a full-catalog fallback so older production remains compatible
      // until the Direct backend is deployed with the delta route.
      if (previous?.cursor) {
        const delta = await requestPromptCatalogDelta(
          baseUrl,
          accessToken,
          language,
          source,
          kind,
          previous.cursor,
          previous.marker,
          options,
        );
        if (delta.supported) {
          if (delta.unchanged) {
            return {
              changed: false,
              downloadedCovers: 0,
              fromCache: true,
              offline: false,
              catalog: previous,
            };
          }
          if (
            typeof delta.cursor !== "string" ||
            typeof delta.marker !== "string" ||
            !Array.isArray(delta.items) ||
            !Array.isArray(delta.deletedIDs)
          ) {
            throw new PromptCatalogRequestError(
              200,
              "prompt catalog delta response is missing its revision cursor",
            );
          }
          const applied = await applyPromptCatalogDelta(previous, {
            cursor: delta.cursor,
            marker: delta.marker,
            items: delta.items,
            deletedIDs: delta.deletedIDs,
            categories: delta.categories,
          });
          await set(
            catalogKey(account, language, kind, source),
            applied.catalog,
          );
          await Promise.all(
            [...applied.deleted].map((id) =>
              del(coverKey(account, language, kind, id, source)),
            ),
          );
          const downloadedCovers = await cachePromptCatalogCovers(
            account,
            language,
            source,
            kind,
            applied.catalog,
            previous,
            applied.changedIDs,
            accessToken,
            baseUrl,
            options,
          );
          return {
            changed: Boolean(
              applied.changedIDs.size ||
                applied.deleted.size ||
                delta.categories !== undefined ||
                previous.marker !== applied.catalog.marker,
            ),
            downloadedCovers,
            fromCache: false,
            offline: false,
            catalog: applied.catalog,
          };
        }
      }
      rawCategories = await requestData<unknown[]>(
        baseUrl,
        promptCategoriesPath(source),
        accessToken,
        language,
        options,
      );
    } else {
      // Older production servers do not have the manifest route yet. Keep a
      // bounded compatibility probe until the server-side route is deployed.
      const [markerPage, categories] = await Promise.all([
        requestData<PromptPage>(
          baseUrl,
          promptListPath(source, kind, 1, 1),
          accessToken,
          language,
          options,
        ),
        requestData<unknown[]>(
          baseUrl,
          promptCategoriesPath(source),
          accessToken,
          language,
          options,
        ),
      ]);
      marker = markerFor(markerPage, categories);
      rawCategories = categories;
    }
  } catch (error) {
    if (previous) {
      return {
        changed: false,
        downloadedCovers: 0,
        fromCache: true,
        offline: true,
        catalog: previous,
      };
    }
    throw error;
  }
  if (previous && previousMarker && previousMarker === marker) {
    return {
      changed: false,
      downloadedCovers: 0,
      fromCache: true,
      offline: false,
      catalog: previous,
    };
  }

  try {
    // Current backends return prompt text in the paginated catalog response,
    // avoiding one detail request per item on a first install. The helper
    // falls back to the legacy list/detail contract only when an older server
    // does not expose the catalog endpoint.
    const rawItems = await fetchAllPromptItems(
      baseUrl,
      accessToken,
      language,
      source,
      kind,
      options,
    );
    const normalizedCategories = normalizeCategories(rawCategories);
    const aliases = categoryAliases(normalizedCategories);
    const previousById = new Map(
      (previous?.items || []).map((item) => [item.id, item]),
    );
    const items = await mapWithConcurrency(
      rawItems,
      SYNC_CONCURRENCY,
      async (item) => {
        const id = normalizedString(item.id);
        const old = previousById.get(id);
        if (
          old &&
          old.fingerprint === promptFingerprint(item) &&
          old.prompt_text
        ) {
          return old;
        }
        if (normalizedString(item.prompt_text)) {
          return normalizeCatalogItem(item, item, aliases);
        }
        const detail = await requestData<RecordValue>(
          baseUrl,
          `${promptCatalogBasePath(source)}/${encodeURIComponent(id)}`,
          accessToken,
          language,
          options,
        );
        return normalizeCatalogItem(item, detail, aliases);
      },
    );
    const catalog: LocalPromptCatalog = {
      schema: 1,
      accountId: account,
      locale: language,
      kind,
      source,
      marker,
      // The manifest's updated_at is the server cursor for the next delta.
      // Keep an existing cursor only for an older compatible server that did
      // not include one in its manifest response.
      cursor: manifestCursor || previous?.cursor || undefined,
      syncedAt: Date.now(),
      items: items.filter((item) => Boolean(item.id && item.prompt_text)),
      categories: normalizedCategories,
    };
    const downloader =
      options.downloadBlob ||
      ((url: string, token: string, signal?: AbortSignal) =>
        managedDownloadBlob(baseUrl, url, token, signal));
    // Commit the metadata index before downloading large cover blobs. If the
    // app is backgrounded or the network drops, the next activation can reuse
    // all prompt text and only repair the missing cover objects.
    await set(catalogKey(account, language, kind, source), catalog);
    const activeIDs = new Set(catalog.items.map((item) => item.id));
    await Promise.all(
      (previous?.items || [])
        .filter((item) => !activeIDs.has(item.id))
        .map((item) => del(coverKey(account, language, kind, item.id, source))),
    );
    const downloadedFlags = await mapWithConcurrency(
      catalog.items,
      SYNC_CONCURRENCY,
      async (item) => {
        const old = previousById.get(item.id);
        if (!item.cover_url) {
          if (old?.cover_url) {
            await del(coverKey(account, language, kind, item.id, source));
          }
          return 0;
        }
        const cover = await readLocalPromptCover(
          account,
          language,
          kind,
          item.id,
          source,
        );
        if (old?.cover_fingerprint === item.cover_fingerprint && cover) {
          return 0;
        }
        try {
          const blob = await downloader(
            item.cover_url,
            accessToken,
            options.signal,
          );
          if (!(blob instanceof Blob) || blob.size === 0) return 0;
          await set(coverKey(account, language, kind, item.id, source), blob);
          return 1;
        } catch {
          // Keep prompt text available when a remote cover is temporarily
          // unavailable; the missing blob is retried on the next activation.
          return 0;
        }
      },
    );
    const downloadedCovers = downloadedFlags.reduce<number>(
      (total, value) => total + value,
      0,
    );
    return {
      changed: true,
      downloadedCovers,
      fromCache: false,
      offline: false,
      catalog,
    };
  } catch (error) {
    if (previous) {
      return {
        changed: false,
        downloadedCovers: 0,
        fromCache: true,
        offline: true,
        catalog: previous,
      };
    }
    throw error;
  }
}

/**
 * The server remains the source of truth. This memoizes only one in-flight
 * sync for a catalog scope so initial app startup and an opened library cannot
 * fetch the complete directory twice.
 */
export function syncLocalPromptCatalog(
  accountId: string,
  locale: string,
  kind: LocalPromptCatalogKind,
  baseUrl: string,
  accessToken: string,
  options: SyncLocalPromptCatalogOptions = {},
  source: LocalPromptCatalogSource = "platform",
): Promise<LocalPromptCatalogSyncResult> {
  const scope = catalogScope(accountId, locale, kind, source);
  const existing = syncInFlight.get(scope);
  if (existing) return existing;
  const request = syncLocalPromptCatalogInternal(
    accountId,
    locale,
    kind,
    source,
    baseUrl,
    accessToken,
    options,
  );
  syncInFlight.set(scope, request);
  const release = () => {
    if (syncInFlight.get(scope) === request) syncInFlight.delete(scope);
  };
  void request.then(release, release);
  return request;
}
