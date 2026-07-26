import {
  DEFAULT_MANAGED_BACKEND_BASE_URL,
  ManagedAuthResponse,
  ManagedAuthUser,
  ManagedMobileBootstrap,
  ManagedSession,
  ManagedWorkspaceBootstrap,
  flattenManagedModels,
  getManagedMobileBootstrap,
  isManagedAuthError,
  isManagedTotpLogin,
  loginManagedUser,
  loginManagedUser2FA,
  logoutManagedUser,
  managedGatewayBaseUrl,
  normalizeManagedBaseUrl,
  pickManagedDefaultModel,
  refreshManagedToken,
  shouldRefreshManagedToken,
  switchManagedImageGroupCompatible,
  switchManagedChatGroupCompatible,
} from "../client/managed-nextchat";
import { getManagedMobileText } from "../client/managed-mobile-i18n";
import { ServiceProvider, StoreKey } from "../constant";
import { createPersistStore } from "../utils/store";
import { useAccessStore } from "./access";
import { useAppConfig } from "./config";
import { useChatStore } from "./chat";

const DEFAULT_MANAGED_STATE = {
  backendBaseUrl: DEFAULT_MANAGED_BACKEND_BASE_URL,
  accessToken: "",
  refreshToken: "",
  tokenType: "Bearer",
  accessTokenExpiresAt: "",
  pendingTotpToken: "",
  pendingTotpEmail: "",
  user: null as ManagedAuthUser | null,
  session: null as ManagedSession | null,
  imageSession: null as ManagedSession | null,
  workspace: null as ManagedWorkspaceBootstrap | null,
  lastSyncAt: 0,
  lastError: "",
  loading: false,
};

type ManagedLoginResult = {
  requires2FA: boolean;
};

export const useManagedNextChatStore = createPersistStore<
  typeof DEFAULT_MANAGED_STATE,
  {
    setBackendBaseUrl: (url: string) => void;
    clearLastError: () => void;
    isAuthenticated: () => boolean;
    login: (
      email: string,
      password: string,
      backendBaseUrl?: string,
    ) => Promise<ManagedLoginResult>;
    login2FA: (code: string) => Promise<ManagedLoginResult>;
    refreshAuthToken: () => Promise<void>;
    ensureFreshAuthToken: (force?: boolean) => Promise<string>;
    bootstrap: (options?: { silent?: boolean }) => Promise<void>;
    switchGroup: (groupID: number) => Promise<void>;
    switchImageGroup: (groupID: number) => Promise<void>;
    applyAuth: (auth: ManagedAuthResponse) => void;
    applyBootstrap: (bootstrap: ManagedMobileBootstrap) => void;
    logout: () => Promise<void>;
  }
>(
  DEFAULT_MANAGED_STATE,
  (set, _get) => {
    let bootstrapInFlight: Promise<void> | null = null;
    let refreshInFlight: Promise<string> | null = null;

    function get() {
      return {
        ..._get(),
        ...methods,
      };
    }

    function errorMessage(error: unknown, fallback: string) {
      return error instanceof Error && error.message ? error.message : fallback;
    }

    const methods = {
      setBackendBaseUrl(url: string) {
        set({ backendBaseUrl: normalizeManagedBaseUrl(url) });
      },

      clearLastError() {
        set({ lastError: "" });
      },

      isAuthenticated() {
        return !!get().accessToken && !!get().session?.api_key;
      },

      async login(email: string, password: string, backendBaseUrl?: string) {
        const baseUrl = normalizeManagedBaseUrl(
          backendBaseUrl || get().backendBaseUrl,
        );
        set({
          backendBaseUrl: baseUrl,
          loading: true,
          lastError: "",
          pendingTotpToken: "",
          pendingTotpEmail: "",
        });
        try {
          const result = await loginManagedUser(baseUrl, email, password);
          if (isManagedTotpLogin(result)) {
            set({
              loading: false,
              pendingTotpToken: result.temp_token,
              pendingTotpEmail: result.user_email_masked || email,
            });
            return { requires2FA: true };
          }
          get().applyAuth(result);
          await get().bootstrap();
          return { requires2FA: false };
        } catch (error) {
          const text = getManagedMobileText();
          set({
            loading: false,
            lastError: errorMessage(error, text.errors.loginFailed),
          });
          throw error;
        }
      },

      async login2FA(code: string) {
        const { backendBaseUrl, pendingTotpToken } = get();
        const text = getManagedMobileText();
        if (!pendingTotpToken) {
          throw new Error(text.errors.totpExpired);
        }
        set({ loading: true, lastError: "" });
        try {
          const auth = await loginManagedUser2FA(
            backendBaseUrl,
            pendingTotpToken,
            code,
          );
          get().applyAuth(auth);
          await get().bootstrap();
          return { requires2FA: false };
        } catch (error) {
          set({
            loading: false,
            lastError: errorMessage(error, text.errors.verifyFailed),
          });
          throw error;
        }
      },

      async refreshAuthToken() {
        await get().ensureFreshAuthToken(true);
      },

      async ensureFreshAuthToken(force = false) {
        const state = get();
        if (
          !force &&
          state.accessToken &&
          !shouldRefreshManagedToken(state.accessTokenExpiresAt)
        ) {
          return state.accessToken;
        }
        if (!state.refreshToken) {
          if (state.accessToken && !force) return state.accessToken;
          throw new Error(getManagedMobileText().errors.missingRefreshToken);
        }
        if (refreshInFlight) return refreshInFlight;
        refreshInFlight = (async () => {
          try {
            const auth = await refreshManagedToken(
              get().backendBaseUrl,
              get().refreshToken,
            );
            get().applyAuth(auth);
            return get().accessToken;
          } catch (error) {
            if (isManagedAuthError(error)) {
              set({
                accessToken: "",
                refreshToken: "",
                accessTokenExpiresAt: "",
                session: null,
                imageSession: null,
                workspace: null,
              });
            }
            throw error;
          } finally {
            refreshInFlight = null;
          }
        })();
        return refreshInFlight;
      },

      async bootstrap(options?: { silent?: boolean }) {
        if (bootstrapInFlight) return bootstrapInFlight;
        const text = getManagedMobileText();
        if (!get().accessToken) {
          throw new Error(text.errors.loginRequired);
        }
        const previousError = get().lastError;
        set(
          options?.silent
            ? { loading: true }
            : { loading: true, lastError: "" },
        );
        bootstrapInFlight = (async () => {
          try {
            const requestBootstrap = async (forceRefresh = false) => {
              const accessToken =
                await get().ensureFreshAuthToken(forceRefresh);
              return getManagedMobileBootstrap(
                get().backendBaseUrl,
                accessToken,
              );
            };
            let bootstrap: ManagedMobileBootstrap;
            try {
              bootstrap = await requestBootstrap();
            } catch (error) {
              if (!isManagedAuthError(error) || !get().refreshToken)
                throw error;
              bootstrap = await requestBootstrap(true);
            }
            get().applyBootstrap(bootstrap);
          } catch (error) {
            set({
              loading: false,
              lastError: options?.silent
                ? previousError
                : errorMessage(error, text.errors.syncFailed),
            });
            throw error;
          } finally {
            bootstrapInFlight = null;
          }
        })();
        return bootstrapInFlight;
      },

      async switchGroup(groupID: number) {
        const text = getManagedMobileText();
        if (!get().accessToken) {
          throw new Error(text.errors.loginRequired);
        }
        set({ loading: true, lastError: "" });
        try {
          const requestSwitch = async (forceRefresh = false) => {
            const accessToken = await get().ensureFreshAuthToken(forceRefresh);
            return switchManagedChatGroupCompatible(
              get().backendBaseUrl,
              accessToken,
              groupID,
            );
          };
          let bootstrap: ManagedMobileBootstrap;
          try {
            bootstrap = await requestSwitch();
          } catch (error) {
            if (!isManagedAuthError(error) || !get().refreshToken) throw error;
            bootstrap = await requestSwitch(true);
          }
          get().applyBootstrap(bootstrap);
        } catch (error) {
          set({
            loading: false,
            lastError: errorMessage(error, text.errors.switchGroupFailed),
          });
          throw error;
        }
      },

      async switchImageGroup(groupID: number) {
        const text = getManagedMobileText();
        if (!get().accessToken) throw new Error(text.errors.loginRequired);
        set({ loading: true, lastError: "" });
        try {
          const requestSwitch = async (forceRefresh = false) => {
            const accessToken = await get().ensureFreshAuthToken(forceRefresh);
            return switchManagedImageGroupCompatible(
              get().backendBaseUrl,
              accessToken,
              groupID,
            );
          };
          let legacyBootstrap: ManagedMobileBootstrap | null;
          try {
            legacyBootstrap = await requestSwitch();
          } catch (error) {
            if (!isManagedAuthError(error) || !get().refreshToken) throw error;
            legacyBootstrap = await requestSwitch(true);
          }
          if (legacyBootstrap) {
            get().applyBootstrap(legacyBootstrap);
          } else {
            await get().bootstrap({ silent: true });
          }
        } catch (error) {
          set({
            loading: false,
            lastError: errorMessage(error, text.errors.switchGroupFailed),
          });
          throw error;
        }
      },

      applyAuth(auth: ManagedAuthResponse) {
        const expiresIn = auth.expires_in ?? 0;
        set({
          accessToken: auth.access_token,
          refreshToken: auth.refresh_token || get().refreshToken,
          tokenType: auth.token_type || "Bearer",
          accessTokenExpiresAt: expiresIn
            ? new Date(Date.now() + expiresIn * 1000).toISOString()
            : "",
          user: auth.user || get().user,
          pendingTotpToken: "",
          pendingTotpEmail: "",
        });
      },

      applyBootstrap(bootstrap: ManagedMobileBootstrap) {
        const {
          session,
          sessions,
          managed_api_keys,
          workspaces,
          ...workspace
        } = bootstrap;
        const chatSession = sessions?.chat || session;
        const imageSession = sessions?.image || chatSession;
        const chatModels = workspaces?.chat?.models || workspace.models;
        const normalizedWorkspace = {
          ...workspace,
          models: chatModels,
          managed_api_keys,
          workspaces,
        };
        const backendBaseUrl = get().backendBaseUrl;
        const models = flattenManagedModels(chatModels);
        const defaultModel = pickManagedDefaultModel(chatModels);

        useAccessStore.getState().update((access) => {
          access.useCustomConfig = true;
          access.openaiUrl = managedGatewayBaseUrl(backendBaseUrl);
          access.openaiApiKey = chatSession.api_key;
          access.needCode = false;
          access.hideUserApiKey = true;
          access.hideBalanceQuery = false;
        });

        useAppConfig.getState().update((config) => {
          if (models.length > 0) {
            config.models = models;
          }
          config.modelConfig.providerName = ServiceProvider.OpenAI;
          config.modelConfig.model = defaultModel as any;
        });

        const chatStore = useChatStore.getState();
        const sessionForUpdate = chatStore.currentSession();
        chatStore.updateTargetSession(sessionForUpdate, (chatSession) => {
          chatSession.mask.modelConfig.providerName = ServiceProvider.OpenAI;
          chatSession.mask.modelConfig.model = defaultModel as any;
        });

        set({
          session: chatSession,
          imageSession,
          workspace: normalizedWorkspace,
          user: workspace.user || get().user,
          lastSyncAt: Date.now(),
          loading: false,
          lastError: "",
        });
      },

      async logout() {
        const { backendBaseUrl, refreshToken } = get();
        set({ loading: true });
        try {
          if (refreshToken) {
            await logoutManagedUser(backendBaseUrl, refreshToken).catch(
              () => {},
            );
          }
        } finally {
          useAccessStore.getState().update((access) => {
            access.openaiApiKey = "";
            access.accessCode = "";
          });
          set({
            ...DEFAULT_MANAGED_STATE,
            backendBaseUrl,
            loading: false,
          });
        }
      },
    };

    return methods;
  },
  {
    name: StoreKey.ManagedNextChat,
    version: 1,
  },
);
