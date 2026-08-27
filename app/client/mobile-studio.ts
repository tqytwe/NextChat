import {
  type MobileAsset,
  type MobileId,
  type MobilePage,
  type MobileRequestOptions,
  mobilePlatformJsonRequest,
} from "./mobile-platform";

export type MobileStudioDocumentType =
  | "script"
  | "visual_bible"
  | "storyboard"
  | "image_prompts"
  | "video_prompts";

export type MobileStudioAssetLinkType =
  | "reference"
  | "character"
  | "scene"
  | "prop"
  | "keyframe"
  | "shot"
  | "video"
  | "audio"
  | "final";

export interface MobileStudioProject {
  id: string;
  title: string;
  description: string;
  aspect_ratio: "9:16" | "16:9" | "1:1";
  language: string;
  status: "draft" | "active" | "archived";
  cover_asset_id?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface MobileStudioEpisode {
  id: string;
  project_id: string;
  stable_id: string;
  title: string;
  sequence: number;
  status: "draft" | "ready" | "archived";
  created_at: string;
  updated_at: string;
}

export interface MobileStudioDocument {
  id: string;
  project_id: string;
  episode_id?: string;
  document_type: MobileStudioDocumentType;
  content: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface MobileStudioAssetLink {
  id: string;
  project_id: string;
  episode_id?: string;
  asset_id: string;
  link_type: MobileStudioAssetLinkType;
  stable_ref?: string;
  position?: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MobileStudioProjectInput {
  title: string;
  description?: string;
  aspect_ratio?: MobileStudioProject["aspect_ratio"];
  language?: string;
  status?: "draft" | "active";
  cover_asset_id?: string;
  version?: number;
}

export interface MobileStudioEpisodeInput {
  stable_id: string;
  title: string;
  sequence: number;
  status?: "draft" | "ready";
}

export interface MobileStudioDocumentInput {
  episode_id?: string;
  expected_version: number;
  content: Record<string, unknown>;
}

export interface MobileStudioAssetLinkInput {
  episode_id?: string;
  asset_id: string;
  link_type: MobileStudioAssetLinkType;
  stable_ref?: string;
  position?: number;
  metadata?: Record<string, unknown>;
}

function pathSegment(value: MobileId) {
  return encodeURIComponent(String(value));
}

function requestInit(
  method: string,
  body?: unknown,
  options?: MobileRequestOptions,
) {
  return {
    method,
    signal: options?.signal ?? undefined,
    headers: options?.headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  } satisfies RequestInit;
}

function studioPath(projectID?: MobileId) {
  return projectID === undefined
    ? "/studio/projects"
    : `/studio/projects/${pathSegment(projectID)}`;
}

export function createMobileStudioClient(baseUrl: string, accessToken: string) {
  const request = <T>(path: string, init: RequestInit) =>
    mobilePlatformJsonRequest<T>(baseUrl, accessToken, path, init);
  return {
    projects: {
      create: (
        input: MobileStudioProjectInput,
        options?: MobileRequestOptions,
      ) =>
        request<MobileStudioProject>(
          studioPath(),
          requestInit("POST", input, options),
        ),
      list: (page = 1, pageSize = 20, options?: MobileRequestOptions) =>
        request<MobilePage<MobileStudioProject>>(
          `${studioPath()}?page=${page}&page_size=${pageSize}`,
          requestInit("GET", undefined, options),
        ),
      detail: (projectID: MobileId, options?: MobileRequestOptions) =>
        request<MobileStudioProject>(
          studioPath(projectID),
          requestInit("GET", undefined, options),
        ),
      update: (
        projectID: MobileId,
        input: MobileStudioProjectInput,
        options?: MobileRequestOptions,
      ) =>
        request<MobileStudioProject>(
          studioPath(projectID),
          requestInit("PATCH", input, options),
        ),
      archive: (projectID: MobileId, options?: MobileRequestOptions) =>
        request<{ id: string; archived: boolean }>(
          studioPath(projectID),
          requestInit("DELETE", undefined, options),
        ),
    },
    episodes: {
      list: (projectID: MobileId, options?: MobileRequestOptions) =>
        request<{ items: MobileStudioEpisode[] }>(
          `${studioPath(projectID)}/episodes`,
          requestInit("GET", undefined, options),
        ),
      create: (
        projectID: MobileId,
        input: MobileStudioEpisodeInput,
        options?: MobileRequestOptions,
      ) =>
        request<MobileStudioEpisode>(
          `${studioPath(projectID)}/episodes`,
          requestInit("POST", input, options),
        ),
      update: (
        projectID: MobileId,
        episodeID: MobileId,
        input: MobileStudioEpisodeInput,
        options?: MobileRequestOptions,
      ) =>
        request<MobileStudioEpisode>(
          `${studioPath(projectID)}/episodes/${pathSegment(episodeID)}`,
          requestInit("PATCH", input, options),
        ),
      archive: (
        projectID: MobileId,
        episodeID: MobileId,
        options?: MobileRequestOptions,
      ) =>
        request<{ id: string; archived: boolean }>(
          `${studioPath(projectID)}/episodes/${pathSegment(episodeID)}`,
          requestInit("DELETE", undefined, options),
        ),
    },
    documents: {
      list: (
        projectID: MobileId,
        episodeID?: MobileId,
        options?: MobileRequestOptions,
      ) =>
        request<{ items: MobileStudioDocument[] }>(
          `${studioPath(projectID)}/documents${
            episodeID === undefined
              ? ""
              : `?episode_id=${pathSegment(episodeID)}`
          }`,
          requestInit("GET", undefined, options),
        ),
      put: (
        projectID: MobileId,
        type: MobileStudioDocumentType,
        input: MobileStudioDocumentInput,
        options?: MobileRequestOptions,
      ) =>
        request<MobileStudioDocument>(
          `${studioPath(projectID)}/documents/${pathSegment(type)}`,
          requestInit("PUT", input, options),
        ),
    },
    assets: {
      list: (
        projectID: MobileId,
        episodeID?: MobileId,
        options?: MobileRequestOptions,
      ) =>
        request<{ items: MobileStudioAssetLink[] }>(
          `${studioPath(projectID)}/assets${
            episodeID === undefined
              ? ""
              : `?episode_id=${pathSegment(episodeID)}`
          }`,
          requestInit("GET", undefined, options),
        ),
      link: (
        projectID: MobileId,
        input: MobileStudioAssetLinkInput,
        options?: MobileRequestOptions,
      ) =>
        request<MobileStudioAssetLink>(
          `${studioPath(projectID)}/assets`,
          requestInit("POST", input, options),
        ),
      unlink: (
        projectID: MobileId,
        linkID: MobileId,
        options?: MobileRequestOptions,
      ) =>
        request<{ id: string; deleted: boolean }>(
          `${studioPath(projectID)}/assets/${pathSegment(linkID)}`,
          requestInit("DELETE", undefined, options),
        ),
    },
  };
}

export type MobileStudioLinkedAsset = MobileStudioAssetLink & {
  asset?: MobileAsset;
};
