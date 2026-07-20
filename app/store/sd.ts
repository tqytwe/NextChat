import {
  Stability,
  StoreKey,
  ACCESS_CODE_PREFIX,
  ApiPath,
} from "@/app/constant";
import { getBearerToken } from "@/app/client/api";
import { getClientConfig } from "@/app/config/client";
import { createPersistStore } from "@/app/utils/store";
import { nanoid } from "nanoid";
import { uploadImage, base64Image2Blob } from "@/app/utils/chat";
import { models, getModelParamBasicData } from "@/app/components/sd/sd-panel";
import { useAccessStore } from "./access";
import {
  getManagedWorkspaceCurrentGroup,
  useManagedWorkspaceStore,
} from "./managed-workspace";
import { withBasePath } from "@/app/utils/api-path";

const NEXTCHAT_IMAGE_STUDIO_RETAIN_DAYS = 1;
const NEXTCHAT_IMAGE_STUDIO_POLL_MS = 2500;
const NEXTCHAT_IMAGE_STUDIO_MAX_POLLS = 120;
const sub2apiImageStudioPollingJobs = new Set<string>();

type Sub2APIEnvelope<T> = {
  code?: number;
  message?: string;
  data?: T;
};

export type Sub2APIImageStudioModel = {
  id: string;
  display_name?: string;
  supported_sizes?: string[];
  supported_aspect_ratios?: string[];
  supported_resolutions?: string[];
  supported_qualities?: string[];
  supported_backgrounds?: string[];
  supported_output_formats?: string[];
  supported_input_fidelities?: string[];
  max_reference_images?: number;
  default_aspect_ratio?: string;
  default_resolution?: string;
  default_quality?: string;
  default_background?: string;
  default_output_format?: string;
  default_input_fidelity?: string;
};

export type Sub2APIImageStudioReference = {
  id: string;
  filename?: string;
  content_type?: string;
  byte_size?: number;
  created_at?: string;
  expires_at?: string;
};

export type Sub2APIImageStudioAsset = {
  id: string;
  url?: string;
  preview_url?: string;
  thumbnail_url?: string;
  download_url?: string;
};

export type Sub2APIImageStudioJob = {
  id: string;
  model?: string;
  status: string;
  error_message?: string;
  assets?: Sub2APIImageStudioAsset[];
  created_at?: string;
  expires_at?: string;
  prompt?: string;
  user_prompt?: string;
  size?: string;
  count?: number;
};

const defaultModel = {
  name: models[0].name,
  value: models[0].value,
};

const defaultParams = getModelParamBasicData(models[0].params({}), {});

const DEFAULT_SD_STATE = {
  currentId: 0,
  draw: [],
  currentModel: defaultModel,
  currentParams: defaultParams,
  sub2apiImageStudioModels: [] as Sub2APIImageStudioModel[],
  sub2apiImageStudioModelsLoading: false,
  sub2apiImageStudioModelsError: "",
  sub2apiImageStudioReferences: [] as Sub2APIImageStudioReference[],
  sub2apiImageStudioReferenceUploading: false,
  sub2apiImageStudioReferencesError: "",
  sub2apiImageStudioJobsLoading: false,
  sub2apiImageStudioJobsError: "",
  sub2apiImageStudioRequestGeneration: 0,
};

export const useSdStore = createPersistStore<
  {
    currentId: number;
    draw: any[];
    currentModel: typeof defaultModel;
    currentParams: any;
    sub2apiImageStudioModels: Sub2APIImageStudioModel[];
    sub2apiImageStudioModelsLoading: boolean;
    sub2apiImageStudioModelsError: string;
    sub2apiImageStudioReferences: Sub2APIImageStudioReference[];
    sub2apiImageStudioReferenceUploading: boolean;
    sub2apiImageStudioReferencesError: string;
    sub2apiImageStudioJobsLoading: boolean;
    sub2apiImageStudioJobsError: string;
    sub2apiImageStudioRequestGeneration: number;
  },
  {
    getNextId: () => number;
    sendTask: (data: any, okCall?: Function) => void;
    fetchSub2APIImageStudioModels: () => Promise<Sub2APIImageStudioModel[]>;
    uploadSub2APIImageStudioReference: (
      file: File,
    ) => Promise<Sub2APIImageStudioReference | undefined>;
    deleteSub2APIImageStudioReference: (id: string) => Promise<void>;
    clearSub2APIImageStudioReferences: () => void;
    beginSub2APIImageStudioGroupSwitch: () => void;
    resetSub2APIImageStudioForGroupSwitch: () => void;
    fetchSub2APIImageStudioJobs: () => Promise<Sub2APIImageStudioJob[]>;
    deleteSub2APIImageStudioJob: (jobId: string) => Promise<void>;
    sub2apiImageStudioRequestCall: (data: any) => Promise<void>;
    pollSub2APIImageStudioJob: (
      data: any,
      jobId: string,
      attempt?: number,
      requestGeneration?: number,
    ) => void;
    stabilityRequestCall: (data: any) => void;
    updateDraw: (draw: any) => void;
    setCurrentModel: (model: any) => void;
    setCurrentParams: (data: any) => void;
  }
>(
  DEFAULT_SD_STATE,
  (set, _get) => {
    function get() {
      return {
        ..._get(),
        ...methods,
      };
    }

    const methods = {
      getNextId() {
        const id = ++_get().currentId;
        set({ currentId: id });
        return id;
      },
      sendTask(data: any, okCall?: Function) {
        data = { ...data, id: nanoid(), status: "running" };
        set({ draw: [data, ..._get().draw] });
        this.getNextId();
        if (isSub2APIManagedImageStudio()) {
          void this.sub2apiImageStudioRequestCall(data);
        } else {
          this.stabilityRequestCall(data);
        }
        okCall?.();
      },
      async fetchSub2APIImageStudioModels() {
        const requestGeneration = _get().sub2apiImageStudioRequestGeneration;
        set({
          sub2apiImageStudioModels: [],
          sub2apiImageStudioModelsLoading: true,
          sub2apiImageStudioModelsError: "",
        });
        try {
          const data = await fetchSub2APIImageStudio<{
            models: Sub2APIImageStudioModel[];
          }>("/models");
          if (
            _get().sub2apiImageStudioRequestGeneration !== requestGeneration
          ) {
            return [];
          }
          const models = data.models ?? [];
          set({
            sub2apiImageStudioModels: models,
            sub2apiImageStudioModelsLoading: false,
          });
          const currentModel = _get().currentModel;
          if (
            models.length > 0 &&
            !models.some((model) => model.id === currentModel.value)
          ) {
            set({
              currentModel: toSub2APIImageStudioPanelModel(models[0]) as any,
            });
          } else if (models.length === 0) {
            set({ currentModel: defaultModel });
          }
          return models;
        } catch (error: any) {
          if (
            _get().sub2apiImageStudioRequestGeneration !== requestGeneration
          ) {
            return [];
          }
          set({
            sub2apiImageStudioModels: [],
            currentModel: defaultModel,
            sub2apiImageStudioModelsLoading: false,
            sub2apiImageStudioModelsError:
              error.message || "Failed to load image models",
          });
          return [];
        }
      },
      async uploadSub2APIImageStudioReference(file: File) {
        const references = _get().sub2apiImageStudioReferences ?? [];
        if (references.length >= 4) {
          set({ sub2apiImageStudioReferencesError: "最多上传 4 张引用图" });
          return undefined;
        }
        set({
          sub2apiImageStudioReferenceUploading: true,
          sub2apiImageStudioReferencesError: "",
        });
        try {
          const formData = new FormData();
          formData.append("image", file);
          const data = await fetchSub2APIImageStudio<{
            reference: Sub2APIImageStudioReference;
          }>("/references", {
            method: "POST",
            body: formData,
          });
          const reference = data.reference;
          set({
            sub2apiImageStudioReferences: [...references, reference],
            sub2apiImageStudioReferenceUploading: false,
          });
          return reference;
        } catch (error: any) {
          set({
            sub2apiImageStudioReferenceUploading: false,
            sub2apiImageStudioReferencesError:
              error.message || "Reference upload failed",
          });
          return undefined;
        }
      },
      async deleteSub2APIImageStudioReference(id: string) {
        try {
          await fetchSub2APIImageStudio<{ deleted?: boolean }>(
            `/references/${encodeURIComponent(id)}`,
            { method: "DELETE" },
          );
        } finally {
          set({
            sub2apiImageStudioReferences: (
              _get().sub2apiImageStudioReferences ?? []
            ).filter((reference) => reference.id !== id),
          });
        }
      },
      clearSub2APIImageStudioReferences() {
        set({
          sub2apiImageStudioReferences: [],
          sub2apiImageStudioReferencesError: "",
        });
      },
      beginSub2APIImageStudioGroupSwitch() {
        set({
          sub2apiImageStudioRequestGeneration:
            _get().sub2apiImageStudioRequestGeneration + 1,
          sub2apiImageStudioModelsLoading: false,
          sub2apiImageStudioJobsLoading: false,
          sub2apiImageStudioModelsError: "",
          sub2apiImageStudioJobsError: "",
        });
      },
      resetSub2APIImageStudioForGroupSwitch() {
        for (const item of _get().draw ?? []) {
          if (item?.job_id) {
            sub2apiImageStudioPollingJobs.delete(item.job_id);
          }
        }
        set({
          draw: [],
          sub2apiImageStudioModels: [],
          sub2apiImageStudioModelsLoading: false,
          sub2apiImageStudioModelsError: "",
          sub2apiImageStudioReferences: [],
          sub2apiImageStudioReferenceUploading: false,
          sub2apiImageStudioReferencesError: "",
          sub2apiImageStudioJobsError: "",
          sub2apiImageStudioRequestGeneration:
            _get().sub2apiImageStudioRequestGeneration + 1,
          currentModel: defaultModel,
          currentId: _get().currentId + 1,
        });
      },
      async fetchSub2APIImageStudioJobs() {
        const requestGeneration = _get().sub2apiImageStudioRequestGeneration;
        set({
          sub2apiImageStudioJobsLoading: true,
          sub2apiImageStudioJobsError: "",
        });
        try {
          const data = await fetchSub2APIImageStudio<{
            jobs: Sub2APIImageStudioJob[];
          }>("/jobs?page=1&page_size=24");
          const remoteDraws = (data.jobs ?? []).map(
            toSub2APIImageStudioJobDraw,
          );
          if (
            _get().sub2apiImageStudioRequestGeneration !== requestGeneration
          ) {
            return [];
          }
          const draw = mergeSub2APIImageStudioDraws(_get().draw, remoteDraws);
          set({
            draw,
            currentId: _get().currentId + 1,
            sub2apiImageStudioJobsLoading: false,
          });
          remoteDraws.forEach((draw, index) => {
            const job = data.jobs?.[index];
            if (job && isSub2APIImageStudioRunning(job.status)) {
              this.pollSub2APIImageStudioJob(
                draw,
                job.id,
                0,
                requestGeneration,
              );
            }
          });
          refreshManagedWorkspaceBootstrap();
          return data.jobs ?? [];
        } catch (error: any) {
          if (
            _get().sub2apiImageStudioRequestGeneration !== requestGeneration
          ) {
            return [];
          }
          set({
            sub2apiImageStudioJobsLoading: false,
            sub2apiImageStudioJobsError:
              error.message || "Failed to load image jobs",
          });
          return [];
        }
      },
      async deleteSub2APIImageStudioJob(jobId: string) {
        if (!jobId) return;
        try {
          await fetchSub2APIImageStudio<{ deleted?: boolean }>(
            `/jobs/${encodeURIComponent(jobId)}`,
            { method: "DELETE" },
          );
          set({
            draw: (_get().draw ?? []).filter(
              (item: any) => item.job_id !== jobId && item.id !== jobId,
            ),
            sub2apiImageStudioJobsError: "",
          });
          sub2apiImageStudioPollingJobs.delete(jobId);
          this.getNextId();
        } catch (error: any) {
          const message = error.message || "Failed to delete image job";
          set({ sub2apiImageStudioJobsError: message });
          throw error;
        }
      },
      async sub2apiImageStudioRequestCall(data: any) {
        const requestGroupID = currentSub2APIImageStudioGroupID();
        try {
          const result = await fetchSub2APIImageStudio<{
            job: Sub2APIImageStudioJob;
            async?: boolean;
          }>("/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": `nextchat-image-${data.id}`,
            },
            body: JSON.stringify(buildSub2APIImageStudioGeneratePayload(data)),
          });
          if (currentSub2APIImageStudioGroupID() !== requestGroupID) {
            return;
          }
          const job = result.job;
          this.updateDraw(toSub2APIImageStudioDraw(data, job));
          if (isSub2APIImageStudioRunning(job.status)) {
            this.pollSub2APIImageStudioJob(data, job.id);
          } else {
            refreshManagedWorkspaceBootstrap();
          }
        } catch (error: any) {
          if (currentSub2APIImageStudioGroupID() !== requestGroupID) {
            return;
          }
          this.updateDraw({
            ...data,
            status: "error",
            error: error.message || "Image generation failed",
          });
          this.getNextId();
        }
      },
      pollSub2APIImageStudioJob(
        data: any,
        jobId: string,
        attempt = 0,
        requestGeneration = _get().sub2apiImageStudioRequestGeneration,
      ) {
        if (_get().sub2apiImageStudioRequestGeneration !== requestGeneration) {
          sub2apiImageStudioPollingJobs.delete(jobId);
          return;
        }
        if (attempt === 0 && sub2apiImageStudioPollingJobs.has(jobId)) {
          return;
        }
        if (attempt === 0) {
          sub2apiImageStudioPollingJobs.add(jobId);
        }
        if (!jobId || attempt >= NEXTCHAT_IMAGE_STUDIO_MAX_POLLS) {
          sub2apiImageStudioPollingJobs.delete(jobId);
          this.updateDraw({
            ...data,
            status: "error",
            error: "Image generation polling timed out",
          });
          this.getNextId();
          return;
        }
        setTimeout(async () => {
          if (
            _get().sub2apiImageStudioRequestGeneration !== requestGeneration
          ) {
            sub2apiImageStudioPollingJobs.delete(jobId);
            return;
          }
          try {
            const job = await fetchSub2APIImageStudio<Sub2APIImageStudioJob>(
              `/jobs/${encodeURIComponent(jobId)}`,
            );
            if (
              _get().sub2apiImageStudioRequestGeneration !== requestGeneration
            ) {
              sub2apiImageStudioPollingJobs.delete(jobId);
              return;
            }
            this.updateDraw(toSub2APIImageStudioDraw(data, job));
            this.getNextId();
            if (isSub2APIImageStudioRunning(job.status)) {
              this.pollSub2APIImageStudioJob(
                data,
                jobId,
                attempt + 1,
                requestGeneration,
              );
            } else {
              sub2apiImageStudioPollingJobs.delete(jobId);
              refreshManagedWorkspaceBootstrap();
            }
          } catch (error: any) {
            sub2apiImageStudioPollingJobs.delete(jobId);
            this.updateDraw({
              ...data,
              status: "error",
              error: error.message || "Image generation polling failed",
            });
            this.getNextId();
          }
        }, NEXTCHAT_IMAGE_STUDIO_POLL_MS);
      },
      stabilityRequestCall(data: any) {
        const accessStore = useAccessStore.getState();
        let prefix: string = ApiPath.Stability as string;
        let bearerToken = "";
        if (accessStore.useCustomConfig) {
          prefix = accessStore.stabilityUrl || (ApiPath.Stability as string);
          bearerToken = getBearerToken(accessStore.stabilityApiKey);
        }
        if (!bearerToken && accessStore.enabledAccessControl()) {
          bearerToken = getBearerToken(
            ACCESS_CODE_PREFIX + accessStore.accessCode,
          );
        }
        const headers = {
          Accept: "application/json",
          Authorization: bearerToken,
        };
        const path = `${prefix}/${Stability.GeneratePath}/${data.model}`;
        const formData = new FormData();
        for (let paramsKey in data.params) {
          formData.append(paramsKey, data.params[paramsKey]);
        }
        fetch(path, {
          method: "POST",
          headers,
          body: formData,
        })
          .then((response) => response.json())
          .then((resData) => {
            if (resData.errors && resData.errors.length > 0) {
              this.updateDraw({
                ...data,
                status: "error",
                error: resData.errors[0],
              });
              this.getNextId();
              return;
            }
            const self = this;
            if (resData.finish_reason === "SUCCESS") {
              uploadImage(base64Image2Blob(resData.image, "image/png"))
                .then((img_data) => {
                  console.debug("uploadImage success", img_data, self);
                  self.updateDraw({
                    ...data,
                    status: "success",
                    img_data,
                  });
                })
                .catch((e) => {
                  console.error("uploadImage error", e);
                  self.updateDraw({
                    ...data,
                    status: "error",
                    error: JSON.stringify(e),
                  });
                });
            } else {
              self.updateDraw({
                ...data,
                status: "error",
                error: JSON.stringify(resData),
              });
            }
            this.getNextId();
          })
          .catch((error) => {
            this.updateDraw({ ...data, status: "error", error: error.message });
            console.error("Error:", error);
            this.getNextId();
          });
      },
      updateDraw(_draw: any) {
        const draw = [...(_get().draw || [])];
        const nextJobId = _draw?.job_id;
        draw.some((item, index) => {
          if (
            item.id === _draw.id ||
            (nextJobId && item.job_id === nextJobId)
          ) {
            draw[index] = {
              ..._draw,
              id: item.id || _draw.id,
            };
            set(() => ({ draw }));
            return true;
          }
        });
      },
      setCurrentModel(model: any) {
        set({ currentModel: model });
      },
      setCurrentParams(data: any) {
        set({
          currentParams: data,
        });
      },
    };

    return methods;
  },
  {
    name: StoreKey.SdList,
    version: 1.0,
  },
);

export function isSub2APIManagedImageStudio() {
  return !!getClientConfig()?.sub2apiManagedMode;
}

export function toSub2APIImageStudioPanelModel(model: Sub2APIImageStudioModel) {
  return {
    name: model.display_name || model.id,
    value: model.id,
    sub2apiModel: model,
    params: () => [],
  };
}

export function buildSub2APIImageStudioGeneratePayload(data: any) {
  const params = data?.params ?? {};
  const referenceIDs = Array.isArray(params.reference_ids)
    ? params.reference_ids.filter(Boolean)
    : [];
  const tier = normalizeImageStudioTier(params.resolution || params.tier);
  const size =
    params.size ||
    resolveSub2APIImageStudioSize(params.aspect, tier) ||
    "1024x1024";
  const inferredSize = inferSub2APIImageStudioAspectTier(size);
  const payload: any = {
    template_id: params.template_id || "free-create",
    user_prompt: params.prompt ?? "",
    size,
    aspect: params.aspect || inferredSize.aspect,
    tier: params.resolution || params.tier ? tier : inferredSize.tier,
    count: clampImageStudioCount(params.count),
    model: data?.model || "",
    quality: params.quality || "auto",
    output_format: params.output_format || "png",
    retain_days: NEXTCHAT_IMAGE_STUDIO_RETAIN_DAYS,
  };
  if (params.background !== undefined && params.background !== "") {
    payload.background = params.background;
  }
  if (
    params.output_compression !== undefined &&
    params.output_compression !== "" &&
    ["jpeg", "webp"].includes(payload.output_format)
  ) {
    payload.output_compression = params.output_compression;
  }
  if (referenceIDs.length > 0 && params.input_fidelity) {
    payload.input_fidelity = params.input_fidelity;
  }
  if (referenceIDs.length > 0) {
    payload.reference_ids = referenceIDs;
  }
  return payload;
}

export const SUB2API_IMAGE_STUDIO_SIZE_MATRIX: Record<
  string,
  Record<string, string>
> = {
  "1:1": {
    "1K": "1024x1024",
    "2K": "2048x2048",
    "3K": "3072x3072",
    "4K": "4096x4096",
  },
  "2:3": {
    "1K": "1024x1536",
    "2K": "2048x3072",
    "3K": "2160x3240",
    "4K": "4096x6144",
  },
  "3:2": {
    "1K": "1536x1024",
    "2K": "3072x2048",
    "3K": "3240x2160",
    "4K": "6144x4096",
  },
  "9:16": {
    "1K": "1024x1792",
    "2K": "2048x3584",
    "3K": "1728x3072",
    "4K": "4096x7168",
  },
  "16:9": {
    "1K": "1792x1024",
    "2K": "3584x2048",
    "3K": "3072x1728",
    "4K": "3840x2160",
  },
};

export function resolveSub2APIImageStudioSize(aspect?: string, tier?: string) {
  const normalizedAspect = normalizeImageStudioAspect(aspect);
  const normalizedTier = normalizeImageStudioTier(tier);
  return SUB2API_IMAGE_STUDIO_SIZE_MATRIX[normalizedAspect]?.[normalizedTier];
}

export function inferSub2APIImageStudioAspectTier(size?: string) {
  const raw = (size || "").trim();
  for (const [aspect, tiers] of Object.entries(
    SUB2API_IMAGE_STUDIO_SIZE_MATRIX,
  )) {
    for (const [tier, candidate] of Object.entries(tiers)) {
      if (candidate === raw) {
        return { aspect, tier };
      }
    }
  }
  return { aspect: "1:1", tier: "1K" };
}

export function normalizeSub2APIImageStudioAssetURL(
  url?: string,
  assetID?: string,
) {
  const fallback = assetID
    ? `/api/nextchat/image-studio/assets/${encodeURIComponent(assetID)}/content`
    : "";
  const raw = (url || fallback).trim();
  if (!raw) return "";
  if (raw.startsWith("/api/v1/image-studio/")) {
    return withBasePath(
      raw.replace("/api/v1/image-studio/", "/api/nextchat/image-studio/"),
    );
  }
  if (raw.startsWith("/api/nextchat/image-studio/")) {
    return withBasePath(raw);
  }
  return raw;
}

function toSub2APIImageStudioDraw(data: any, job: Sub2APIImageStudioJob) {
  const asset = job.assets?.[0];
  const imgData = normalizeSub2APIImageStudioAssetURL(
    asset?.preview_url || asset?.url,
    asset?.id,
  );
  const status = normalizeSub2APIImageStudioTaskStatus(job, imgData);
  return {
    ...data,
    status,
    job_id: job.id,
    model_name: job.model || data.model_name,
    img_data: imgData || data.img_data,
    error: job.error_message || data.error,
    expires_at: job.expires_at,
    image_asset_expired: isSub2APIManagedImageExpired({
      ...data,
      expires_at: job.expires_at,
    }),
    assets: job.assets?.map((asset) => ({
      ...asset,
      url: normalizeSub2APIImageStudioAssetURL(asset.url, asset.id),
      preview_url: normalizeSub2APIImageStudioAssetURL(
        asset.preview_url || asset.url,
        asset.id,
      ),
      thumbnail_url: normalizeSub2APIImageStudioAssetURL(
        asset.thumbnail_url,
        asset.id,
      ),
      download_url: normalizeSub2APIImageStudioAssetURL(
        asset.download_url,
        asset.id,
      ),
    })),
  };
}

function toSub2APIImageStudioJobDraw(job: Sub2APIImageStudioJob) {
  const prompt =
    job.prompt ||
    job.user_prompt ||
    (job as any).params?.prompt ||
    "历史图片任务";
  return toSub2APIImageStudioDraw(
    {
      id: `job-${job.id}`,
      job_id: job.id,
      model: job.model,
      model_name: job.model,
      params: {
        prompt,
        size: job.size,
        count: job.count,
      },
      created_at: job.created_at,
      img_data: "",
    },
    job,
  );
}

export function mergeSub2APIImageStudioDraws(
  existing: any[] = [],
  remote: any[] = [],
) {
  const localPending = existing.filter((item: any) => !item?.job_id);
  return [...localPending, ...remote];
}

export function isSub2APIManagedImageExpired(item: any, now = Date.now()) {
  if (item?.image_asset_expired || item?.status === "expired") return true;
  const expiresAt = Date.parse(item?.expires_at || "");
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

function normalizeSub2APIImageStudioTaskStatus(
  job: Sub2APIImageStudioJob,
  imgData: string,
) {
  switch (job.status) {
    case "completed":
    case "partial":
      return imgData ? "success" : "running";
    case "failed":
    case "cancelled":
      return "error";
    default:
      return "running";
  }
}

function isSub2APIImageStudioRunning(status: string) {
  return status === "pending" || status === "running";
}

function currentSub2APIImageStudioGroupID() {
  return getManagedWorkspaceCurrentGroup(
    useManagedWorkspaceStore.getState().bootstrap,
  )?.id;
}

function refreshManagedWorkspaceBootstrap() {
  if (isSub2APIManagedImageStudio()) {
    void useManagedWorkspaceStore.getState().fetchBootstrap();
  }
}

function clampImageStudioCount(value: any) {
  const count = Number.parseInt(String(value || 1), 10);
  if (!Number.isFinite(count) || count <= 0) return 1;
  return Math.min(count, 4);
}

function normalizeImageStudioAspect(value: any) {
  const aspect = String(value || "1:1").trim();
  if (aspect === "3:4") return "2:3";
  if (aspect === "4:3") return "3:2";
  return SUB2API_IMAGE_STUDIO_SIZE_MATRIX[aspect] ? aspect : "1:1";
}

function normalizeImageStudioTier(value: any) {
  const tier = String(value || "1K")
    .trim()
    .toUpperCase();
  return ["1K", "2K", "3K", "4K"].includes(tier) ? tier : "1K";
}

async function fetchSub2APIImageStudio<T>(path: string, init?: RequestInit) {
  const res = await fetch(withBasePath(`/api/nextchat/image-studio${path}`), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
    credentials: "same-origin",
    cache: "no-store",
  });
  const envelope = (await res.json().catch(() => undefined)) as
    | Sub2APIEnvelope<T>
    | undefined;
  if (!res.ok || envelope?.code !== 0 || !envelope.data) {
    throw new Error(
      normalizeSub2APIImageStudioError(
        envelope?.message || "Sub2API image studio request failed",
      ),
    );
  }
  return envelope.data;
}

function normalizeSub2APIImageStudioError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("image generation is not enabled for this group")) {
    return "当前分组未开启图片生成，请切换到支持图片的分组";
  }
  if (lower.includes("idempotency key is required")) {
    return "图片生成缺少幂等请求头，请刷新页面后重试";
  }
  return message;
}
