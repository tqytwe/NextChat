import { create } from "zustand";
import { LLMModel } from "../client/api";
import { ServiceProvider } from "../constant";
import { withBasePath } from "../utils/api-path";

const JISUDENG_ORIGIN = "https://www.jisudeng.com";
export const JISUDENG_DASHBOARD_URL = `${JISUDENG_ORIGIN}/dashboard`;
export const JISUDENG_RECHARGE_URL = `${JISUDENG_ORIGIN}/purchase`;
const JISUDENG_LEGACY_HOSTS = new Set(["jisuodeng.zeabur.app"]);
const NEXTCHAT_MANAGED_FRONTEND_HOSTS = new Set(["nexta.zeabur.app"]);
const HOMEPAGE_PATHS = new Set(["/", "/home", "/index"]);
const LEGACY_RECHARGE_PATHS = new Set(["/payment", "/recharge", "/billing"]);
let managedWorkspaceRequestSeq = 0;

type Sub2APIEnvelope<T> = {
  code?: number;
  message?: string;
  data?: T;
};

export type ManagedWorkspaceModel = {
  id: string;
  name: string;
  display_name?: string;
  platform?: string;
  channel?: string;
  use_case?: string;
  sort_order?: number;
  effective_input_price?: number;
  effective_output_price?: number;
};

export type ManagedWorkspaceGroup = {
  id: number;
  name: string;
  description?: string;
  platform?: string;
  rate_multiplier?: number;
  sort_order?: number;
  is_current?: boolean;
  models: ManagedWorkspaceModel[];
};

export type ManagedWorkspaceModels = {
  source: string;
  default_model?: string;
  selected_group_id?: number;
  groups: ManagedWorkspaceGroup[];
};

export type ManagedWorkspaceBootstrap = {
  user: {
    id: number;
    username?: string;
    email?: string;
    avatar_url?: string;
    balance?: number;
    frozen_balance?: number;
  };
  managed_api_key: {
    id: number;
    name: string;
    group_id?: number;
    group_name?: string;
    group_platform?: string;
  };
  brand: {
    site_name?: string;
    site_logo?: string;
    workspace_name?: string;
  };
  features: Record<string, boolean>;
  models: ManagedWorkspaceModels;
  urls: {
    return_url?: string;
    recharge_url?: string;
    profile_url?: string;
  };
  retention: {
    text_session_days?: number;
    image_asset_hours?: number;
    server_chat_log?: boolean;
  };
};

type ManagedWorkspaceState = {
  bootstrap?: ManagedWorkspaceBootstrap;
  loading: boolean;
  switchingGroup: boolean;
  error: string;
  fetchBootstrap: () => Promise<ManagedWorkspaceBootstrap | undefined>;
  switchGroup: (
    groupId: number,
  ) => Promise<ManagedWorkspaceBootstrap | undefined>;
  reset: () => void;
};

export const useManagedWorkspaceStore = create<ManagedWorkspaceState>(
  (set, get) => ({
    loading: false,
    switchingGroup: false,
    error: "",
    async fetchBootstrap() {
      const requestSeq = ++managedWorkspaceRequestSeq;
      set({ loading: true, error: "" });
      try {
        const bootstrap =
          await fetchManagedWorkspace<ManagedWorkspaceBootstrap>(
            withBasePath("/api/nextchat/bootstrap"),
          );
        if (requestSeq !== managedWorkspaceRequestSeq) {
          return get().bootstrap;
        }
        set({ bootstrap, loading: false });
        return bootstrap;
      } catch (error: any) {
        if (requestSeq !== managedWorkspaceRequestSeq) {
          return get().bootstrap;
        }
        set({
          loading: false,
          error: error.message || "Failed to load workspace",
        });
        return undefined;
      }
    },
    async switchGroup(groupId: number) {
      const requestSeq = ++managedWorkspaceRequestSeq;
      set({ loading: false, switchingGroup: true, error: "" });
      try {
        const result = await fetchManagedWorkspace<{
          managed_api_key: ManagedWorkspaceBootstrap["managed_api_key"];
          models: ManagedWorkspaceModels;
        }>(withBasePath("/api/nextchat/group"), {
          method: "POST",
          body: JSON.stringify({ group_id: groupId }),
        });
        if (requestSeq !== managedWorkspaceRequestSeq) {
          return get().bootstrap;
        }
        const previous = get().bootstrap;
        if (!previous) {
          const bootstrap =
            await fetchManagedWorkspace<ManagedWorkspaceBootstrap>(
              withBasePath("/api/nextchat/bootstrap"),
            );
          if (requestSeq !== managedWorkspaceRequestSeq) {
            return get().bootstrap;
          }
          set({ bootstrap, loading: false, switchingGroup: false });
          return bootstrap;
        }
        const bootstrap = {
          ...previous,
          managed_api_key: result.managed_api_key,
          models: result.models,
        };
        if (requestSeq !== managedWorkspaceRequestSeq) {
          return get().bootstrap;
        }
        set({ bootstrap, loading: false, switchingGroup: false });
        return bootstrap;
      } catch (error: any) {
        if (requestSeq !== managedWorkspaceRequestSeq) {
          return get().bootstrap;
        }
        set({
          loading: false,
          switchingGroup: false,
          error: error.message || "Failed to switch group",
        });
        return undefined;
      }
    },
    reset() {
      managedWorkspaceRequestSeq++;
      set({
        bootstrap: undefined,
        loading: false,
        switchingGroup: false,
        error: "",
      });
    },
  }),
);

export function getManagedWorkspaceCurrentGroup(
  bootstrap?: ManagedWorkspaceBootstrap,
) {
  const groups = bootstrap?.models?.groups ?? [];
  const selected = bootstrap?.models?.selected_group_id;
  return (
    groups.find((group) => group.id === selected) ||
    groups.find((group) => group.is_current) ||
    groups[0]
  );
}

export function getManagedWorkspaceModelsForCurrentGroup(
  bootstrap?: ManagedWorkspaceBootstrap,
) {
  return getManagedWorkspaceCurrentGroup(bootstrap)?.models ?? [];
}

export function getManagedWorkspaceDefaultModelForCurrentGroup(
  bootstrap?: ManagedWorkspaceBootstrap,
) {
  const selected = getManagedWorkspaceDefaultLLMModelForCurrentGroup(bootstrap);
  return selected?.name || "";
}

export function getManagedWorkspaceDefaultLLMModelForCurrentGroup(
  bootstrap?: ManagedWorkspaceBootstrap,
) {
  const group = getManagedWorkspaceCurrentGroup(bootstrap);
  const models = group?.models ?? [];
  const llmModels = managedWorkspaceModelsToLLMModels(models, group?.platform);
  const defaultModel = bootstrap?.models?.default_model?.trim();

  return (
    llmModels.find((model, index) => {
      const raw = models[index];
      return (
        model.name === defaultModel ||
        raw?.name === defaultModel ||
        raw?.id === defaultModel
      );
    }) || llmModels[0]
  );
}

export function getManagedWorkspaceLLMModelsForCurrentGroup(
  bootstrap?: ManagedWorkspaceBootstrap,
) {
  const group = getManagedWorkspaceCurrentGroup(bootstrap);
  return managedWorkspaceModelsToLLMModels(
    group?.models ?? [],
    group?.platform,
  );
}

export function managedWorkspaceModelsToLLMModels(
  models: ManagedWorkspaceModel[],
  groupPlatform?: string,
): LLMModel[] {
  return models.map((model, index) => {
    const provider = resolveManagedWorkspaceModelProvider(
      model.platform || groupPlatform,
      model.name || model.id,
    );
    return {
      name: model.name || model.id,
      displayName: model.display_name || model.name || model.id,
      available: true,
      sorted: model.sort_order ?? index + 1,
      provider,
    };
  });
}

export function resolveManagedWorkspaceModelProvider(
  platform?: string,
  modelName?: string,
): LLMModel["provider"] {
  const knownProviderName =
    resolveManagedWorkspaceKnownServiceProvider(platform);
  if (knownProviderName) {
    return buildManagedWorkspaceProvider(knownProviderName);
  }

  const customProvider = normalizeManagedWorkspaceCustomProvider(platform);
  if (customProvider) {
    return {
      id: customProvider,
      providerName: labelManagedWorkspaceCustomProvider(platform),
      providerType: customProvider,
      sorted: 100,
    };
  }

  const inferredProviderName = resolveManagedWorkspaceKnownServiceProvider(
    inferManagedWorkspacePlatformFromModel(modelName),
  );
  if (inferredProviderName) {
    return buildManagedWorkspaceProvider(inferredProviderName);
  }

  return buildManagedWorkspaceProvider(ServiceProvider.OpenAI);
}

function buildManagedWorkspaceProvider(
  providerName: ServiceProvider,
): LLMModel["provider"] {
  return {
    id: managedWorkspaceProviderId(providerName),
    providerName,
    providerType: managedWorkspaceProviderType(providerName),
    sorted: managedWorkspaceProviderSort(providerName),
  };
}

export function resolveManagedWorkspaceServiceProvider(
  platform?: string,
): ServiceProvider {
  return (
    resolveManagedWorkspaceKnownServiceProvider(platform) ||
    ServiceProvider.OpenAI
  );
}

function resolveManagedWorkspaceKnownServiceProvider(
  platform?: string,
): ServiceProvider | undefined {
  const normalized = (platform || "").trim().toLowerCase();
  switch (normalized) {
    case "anthropic":
    case "claude":
      return ServiceProvider.Anthropic;
    case "gemini":
    case "google":
    case "antigravity":
      return ServiceProvider.Google;
    case "grok":
    case "xai":
      return ServiceProvider.XAI;
    case "baidu":
    case "ernie":
      return ServiceProvider.Baidu;
    case "bytedance":
    case "doubao":
    case "volcengine":
      return ServiceProvider.ByteDance;
    case "alibaba":
    case "qwen":
    case "dashscope":
      return ServiceProvider.Alibaba;
    case "tencent":
    case "hunyuan":
      return ServiceProvider.Tencent;
    case "moonshot":
    case "kimi":
      return ServiceProvider.Moonshot;
    case "iflytek":
    case "spark":
      return ServiceProvider.Iflytek;
    case "deepseek":
      return ServiceProvider.DeepSeek;
    case "chatglm":
    case "glm":
      return ServiceProvider.ChatGLM;
    case "siliconflow":
      return ServiceProvider.SiliconFlow;
    case "302.ai":
    case "ai302":
      return ServiceProvider["302.AI"];
    case "":
      return undefined;
    case "openai":
      return ServiceProvider.OpenAI;
    default:
      return undefined;
  }
}

function inferManagedWorkspacePlatformFromModel(modelName?: string) {
  const model = (modelName || "").trim().toLowerCase();
  if (!model) return "";
  if (
    model.startsWith("gpt-") ||
    model.startsWith("o1") ||
    model.startsWith("o3") ||
    model.startsWith("o4") ||
    model.startsWith("dall-e")
  ) {
    return "openai";
  }
  if (model.startsWith("claude") || model.includes("-claude-")) {
    return "anthropic";
  }
  if (
    model.startsWith("gemini") ||
    model.startsWith("imagen") ||
    model.includes("-gemini-")
  ) {
    return "gemini";
  }
  if (model.startsWith("grok") || model.includes("-grok-")) {
    return "grok";
  }
  if (model.startsWith("deepseek")) {
    return "deepseek";
  }
  if (model.startsWith("qwen") || model.includes("-qwen-")) {
    return "alibaba";
  }
  if (
    model.startsWith("doubao") ||
    model.startsWith("seedream") ||
    model.includes("-doubao-")
  ) {
    return "bytedance";
  }
  if (model.startsWith("hunyuan")) {
    return "tencent";
  }
  if (model.startsWith("kimi") || model.startsWith("moonshot")) {
    return "moonshot";
  }
  if (model.startsWith("glm") || model.startsWith("chatglm")) {
    return "chatglm";
  }
  if (model.startsWith("ernie")) {
    return "baidu";
  }
  return "";
}

function normalizeManagedWorkspaceCustomProvider(platform?: string) {
  return (platform || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function labelManagedWorkspaceCustomProvider(platform?: string) {
  const normalized = normalizeManagedWorkspaceCustomProvider(platform);
  if (!normalized) return "Sub2API";
  return normalized
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function managedWorkspaceProviderId(providerName: ServiceProvider) {
  if (providerName === ServiceProvider["302.AI"]) return "ai302";
  return providerName.toLowerCase();
}

function managedWorkspaceProviderType(providerName: ServiceProvider) {
  if (providerName === ServiceProvider["302.AI"]) return "ai302";
  return providerName.toLowerCase();
}

function managedWorkspaceProviderSort(providerName: ServiceProvider) {
  switch (providerName) {
    case ServiceProvider.OpenAI:
      return 1;
    case ServiceProvider.Azure:
      return 2;
    case ServiceProvider.Google:
      return 3;
    case ServiceProvider.Anthropic:
      return 4;
    case ServiceProvider.Baidu:
      return 5;
    case ServiceProvider.ByteDance:
      return 6;
    case ServiceProvider.Alibaba:
      return 7;
    case ServiceProvider.Tencent:
      return 8;
    case ServiceProvider.Moonshot:
      return 9;
    case ServiceProvider.Iflytek:
      return 10;
    case ServiceProvider.XAI:
      return 11;
    case ServiceProvider.ChatGLM:
      return 12;
    case ServiceProvider.DeepSeek:
      return 13;
    case ServiceProvider.SiliconFlow:
      return 14;
    case ServiceProvider["302.AI"]:
      return 15;
    default:
      return 100;
  }
}

export function resolveManagedWorkspaceURL(
  value: string | undefined,
  fallback: string,
) {
  const fallbackURL = new URL(fallback, JISUDENG_ORIGIN);
  const raw = value?.trim();
  if (!raw) return fallbackURL.toString();

  try {
    const url = new URL(raw, JISUDENG_ORIGIN);
    if (
      fallbackURL.origin === JISUDENG_ORIGIN &&
      JISUDENG_LEGACY_HOSTS.has(url.hostname)
    ) {
      return fallbackURL.toString();
    }
    const normalizedPath = url.pathname.replace(/\/+$/g, "") || "/";
    if (NEXTCHAT_MANAGED_FRONTEND_HOSTS.has(url.hostname)) {
      return fallbackURL.toString();
    }
    if (HOMEPAGE_PATHS.has(normalizedPath)) {
      return new URL(fallbackURL.pathname, url.origin).toString();
    }
    if (
      fallbackURL.pathname === "/purchase" &&
      LEGACY_RECHARGE_PATHS.has(normalizedPath)
    ) {
      const rechargeURL = new URL(fallbackURL.pathname, url.origin);
      rechargeURL.search = url.search;
      return rechargeURL.toString();
    }
    return url.toString();
  } catch {
    return fallbackURL.toString();
  }
}

async function fetchManagedWorkspace<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
    credentials: "same-origin",
    cache: "no-store",
  });
  const envelope = (await res.json().catch(() => undefined)) as
    | Sub2APIEnvelope<T>
    | undefined;
  if (!res.ok || envelope?.code !== 0 || !envelope.data) {
    throw new Error(envelope?.message || "Workspace request failed");
  }
  return envelope.data;
}
