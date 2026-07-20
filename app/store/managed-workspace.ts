import { create } from "zustand";
import { LLMModel } from "../client/api";
import { ServiceProvider } from "../constant";
import { withBasePath } from "../utils/api-path";

const JISUDENG_ORIGIN = "https://www.jisudeng.com";
export const JISUDENG_DASHBOARD_URL = `${JISUDENG_ORIGIN}/dashboard`;
export const JISUDENG_RECHARGE_URL = `${JISUDENG_ORIGIN}/purchase`;
const JISUDENG_LEGACY_HOSTS = new Set(["jisuodeng.zeabur.app"]);
const HOMEPAGE_PATHS = new Set(["/", "/home", "/index"]);
const LEGACY_RECHARGE_PATHS = new Set(["/payment", "/recharge", "/billing"]);

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
      set({ loading: true, error: "" });
      try {
        const bootstrap =
          await fetchManagedWorkspace<ManagedWorkspaceBootstrap>(
            withBasePath("/api/nextchat/bootstrap"),
          );
        set({ bootstrap, loading: false });
        return bootstrap;
      } catch (error: any) {
        set({
          loading: false,
          error: error.message || "Failed to load workspace",
        });
        return undefined;
      }
    },
    async switchGroup(groupId: number) {
      set({ switchingGroup: true, error: "" });
      try {
        const result = await fetchManagedWorkspace<{
          managed_api_key: ManagedWorkspaceBootstrap["managed_api_key"];
          models: ManagedWorkspaceModels;
        }>(withBasePath("/api/nextchat/group"), {
          method: "POST",
          body: JSON.stringify({ group_id: groupId }),
        });
        const previous = get().bootstrap;
        if (!previous) {
          const bootstrap = await get().fetchBootstrap();
          set({ switchingGroup: false });
          return bootstrap;
        }
        const bootstrap = {
          ...previous,
          managed_api_key: result.managed_api_key,
          models: result.models,
        };
        set({ bootstrap, switchingGroup: false });
        return bootstrap;
      } catch (error: any) {
        set({
          switchingGroup: false,
          error: error.message || "Failed to switch group",
        });
        return undefined;
      }
    },
    reset() {
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
  const models = getManagedWorkspaceModelsForCurrentGroup(bootstrap);
  const defaultModel = bootstrap?.models?.default_model?.trim();
  const selected =
    models.find(
      (model) => model.name === defaultModel || model.id === defaultModel,
    ) || models[0];

  return selected?.name || selected?.id || "";
}

export function getManagedWorkspaceLLMModelsForCurrentGroup(
  bootstrap?: ManagedWorkspaceBootstrap,
) {
  return managedWorkspaceModelsToLLMModels(
    getManagedWorkspaceModelsForCurrentGroup(bootstrap),
  );
}

export function managedWorkspaceModelsToLLMModels(
  models: ManagedWorkspaceModel[],
): LLMModel[] {
  return models.map((model, index) => ({
    name: model.name || model.id,
    displayName: model.display_name || model.name || model.id,
    available: true,
    sorted: model.sort_order ?? index + 1,
    provider: {
      id: "openai",
      providerName: ServiceProvider.OpenAI,
      providerType: "openai",
      sorted: 1,
    },
  }));
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
