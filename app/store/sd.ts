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
import { withBasePath } from "@/app/utils/api-path";

const NEXTCHAT_IMAGE_STUDIO_RETAIN_DAYS = 1;
const NEXTCHAT_IMAGE_STUDIO_POLL_MS = 2500;
const NEXTCHAT_IMAGE_STUDIO_MAX_POLLS = 120;

type Sub2APIEnvelope<T> = {
  code?: number;
  message?: string;
  data?: T;
};

export type Sub2APIImageStudioModel = {
  id: string;
  display_name?: string;
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
  expires_at?: string;
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
  },
  {
    getNextId: () => number;
    sendTask: (data: any, okCall?: Function) => void;
    fetchSub2APIImageStudioModels: () => Promise<Sub2APIImageStudioModel[]>;
    sub2apiImageStudioRequestCall: (data: any) => Promise<void>;
    pollSub2APIImageStudioJob: (
      data: any,
      jobId: string,
      attempt?: number,
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
        set({
          sub2apiImageStudioModelsLoading: true,
          sub2apiImageStudioModelsError: "",
        });
        try {
          const data = await fetchSub2APIImageStudio<{
            models: Sub2APIImageStudioModel[];
          }>("/models");
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
          }
          return models;
        } catch (error: any) {
          set({
            sub2apiImageStudioModelsLoading: false,
            sub2apiImageStudioModelsError:
              error.message || "Failed to load image models",
          });
          return [];
        }
      },
      async sub2apiImageStudioRequestCall(data: any) {
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
          const job = result.job;
          this.updateDraw(toSub2APIImageStudioDraw(data, job));
          if (isSub2APIImageStudioRunning(job.status)) {
            this.pollSub2APIImageStudioJob(data, job.id);
          }
        } catch (error: any) {
          this.updateDraw({
            ...data,
            status: "error",
            error: error.message || "Image generation failed",
          });
          this.getNextId();
        }
      },
      pollSub2APIImageStudioJob(data: any, jobId: string, attempt = 0) {
        if (!jobId || attempt >= NEXTCHAT_IMAGE_STUDIO_MAX_POLLS) {
          this.updateDraw({
            ...data,
            status: "error",
            error: "Image generation polling timed out",
          });
          this.getNextId();
          return;
        }
        setTimeout(async () => {
          try {
            const job = await fetchSub2APIImageStudio<Sub2APIImageStudioJob>(
              `/jobs/${encodeURIComponent(jobId)}`,
            );
            this.updateDraw(toSub2APIImageStudioDraw(data, job));
            this.getNextId();
            if (isSub2APIImageStudioRunning(job.status)) {
              this.pollSub2APIImageStudioJob(data, jobId, attempt + 1);
            }
          } catch (error: any) {
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
        const draw = _get().draw || [];
        draw.some((item, index) => {
          if (item.id === _draw.id) {
            draw[index] = _draw;
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
    params: () => [],
  };
}

export function buildSub2APIImageStudioGeneratePayload(data: any) {
  const params = data?.params ?? {};
  return {
    template_id: "free-create",
    user_prompt: params.prompt ?? "",
    size: params.size || "1024x1024",
    count: clampImageStudioCount(params.count),
    model: data?.model || "",
    quality: params.quality || "auto",
    output_format: params.output_format || "png",
    retain_days: NEXTCHAT_IMAGE_STUDIO_RETAIN_DAYS,
  };
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

function clampImageStudioCount(value: any) {
  const count = Number.parseInt(String(value || 1), 10);
  if (!Number.isFinite(count) || count <= 0) return 1;
  return Math.min(count, 4);
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
    throw new Error(envelope?.message || "Sub2API image studio request failed");
  }
  return envelope.data;
}
