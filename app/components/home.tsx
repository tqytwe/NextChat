"use client";

require("../polyfill");

import { useEffect, useMemo, useState } from "react";
import styles from "./home.module.scss";

import BotIcon from "../icons/bot.svg";
import LoadingIcon from "../icons/three-dots.svg";

import { getCSSVar, useMobileScreen } from "../utils";

import dynamic from "next/dynamic";
import { Path, ServiceProvider, SlotID } from "../constant";
import { ErrorBoundary } from "./error";

import { getISOLang, getLang } from "../locales";

import {
  HashRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { SideBar } from "./sidebar";
import { useAppConfig } from "../store/config";
import { AuthPage } from "./auth";
import { getClientConfig } from "../config/client";
import { type ClientApi, getClientApi } from "../client/api";
import { ModelType, useAccessStore, useChatStore } from "../store";
import {
  getManagedWorkspaceDefaultModelForCurrentGroup,
  getManagedWorkspaceLLMModelsForCurrentGroup,
  JISUDENG_DASHBOARD_URL,
  useManagedWorkspaceStore,
} from "../store/managed-workspace";
import clsx from "clsx";
import { initializeMcpSystem, isMcpEnabled } from "../mcp/actions";
import { withBasePath } from "../utils/api-path";

export function Loading(props: { noLogo?: boolean }) {
  return (
    <div className={clsx("no-dark", styles["loading-content"])}>
      {!props.noLogo && <BotIcon />}
      <LoadingIcon />
    </div>
  );
}

const Artifacts = dynamic(async () => (await import("./artifacts")).Artifacts, {
  loading: () => <Loading noLogo />,
});

const Settings = dynamic(async () => (await import("./settings")).Settings, {
  loading: () => <Loading noLogo />,
});

const Chat = dynamic(async () => (await import("./chat")).Chat, {
  loading: () => <Loading noLogo />,
});

const NewChat = dynamic(async () => (await import("./new-chat")).NewChat, {
  loading: () => <Loading noLogo />,
});

const MaskPage = dynamic(async () => (await import("./mask")).MaskPage, {
  loading: () => <Loading noLogo />,
});

const PluginPage = dynamic(async () => (await import("./plugin")).PluginPage, {
  loading: () => <Loading noLogo />,
});

const SearchChat = dynamic(
  async () => (await import("./search-chat")).SearchChatPage,
  {
    loading: () => <Loading noLogo />,
  },
);

const Sd = dynamic(async () => (await import("./sd")).Sd, {
  loading: () => <Loading noLogo />,
});

const McpMarketPage = dynamic(
  async () => (await import("./mcp-market")).McpMarketPage,
  {
    loading: () => <Loading noLogo />,
  },
);

export function useSwitchTheme() {
  const config = useAppConfig();

  useEffect(() => {
    document.body.classList.remove("light");
    document.body.classList.remove("dark");

    if (config.theme === "dark") {
      document.body.classList.add("dark");
    } else if (config.theme === "light") {
      document.body.classList.add("light");
    }

    const metaDescriptionDark = document.querySelector(
      'meta[name="theme-color"][media*="dark"]',
    );
    const metaDescriptionLight = document.querySelector(
      'meta[name="theme-color"][media*="light"]',
    );

    if (config.theme === "auto") {
      metaDescriptionDark?.setAttribute("content", "#151515");
      metaDescriptionLight?.setAttribute("content", "#fafafa");
    } else {
      const themeColor = getCSSVar("--theme-color");
      metaDescriptionDark?.setAttribute("content", themeColor);
      metaDescriptionLight?.setAttribute("content", themeColor);
    }
  }, [config.theme]);
}

function useHtmlLang() {
  useEffect(() => {
    const lang = getISOLang();
    const htmlLang = document.documentElement.lang;

    if (lang !== htmlLang) {
      document.documentElement.lang = lang;
    }
  }, []);
}

const useHasHydrated = () => {
  const [hasHydrated, setHasHydrated] = useState<boolean>(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return hasHydrated;
};

const loadAsyncGoogleFont = () => {
  const linkEl = document.createElement("link");
  const proxyFontUrl = "/google-fonts";
  const remoteFontUrl = "https://fonts.googleapis.com";
  const googleFontUrl =
    getClientConfig()?.buildMode === "export" ? remoteFontUrl : proxyFontUrl;
  linkEl.rel = "stylesheet";
  linkEl.href =
    googleFontUrl +
    "/css2?family=" +
    encodeURIComponent("Noto Sans:wght@300;400;700;900") +
    "&display=swap";
  document.head.appendChild(linkEl);
};

export function WindowContent(props: { children: React.ReactNode }) {
  return (
    <div className={styles["window-content"]} id={SlotID.AppBody}>
      {props?.children}
    </div>
  );
}

function Screen() {
  const config = useAppConfig();
  const location = useLocation();
  const isArtifact = location.pathname.includes(Path.Artifacts);
  const isHome = location.pathname === Path.Home;
  const isAuth = location.pathname === Path.Auth;
  const isSd = location.pathname === Path.Sd;
  const isSdNew = location.pathname === Path.SdNew;

  const isMobileScreen = useMobileScreen();
  const shouldTightBorder =
    getClientConfig()?.isApp || (config.tightBorder && !isMobileScreen);

  useEffect(() => {
    loadAsyncGoogleFont();
  }, []);

  if (isArtifact) {
    return (
      <Routes>
        <Route path="/artifacts/:id" element={<Artifacts />} />
      </Routes>
    );
  }
  const renderContent = () => {
    if (isAuth) return <AuthPage />;
    if (isSd) return <Sd />;
    if (isSdNew) return <Sd />;
    return (
      <>
        <SideBar
          className={clsx({
            [styles["sidebar-show"]]: isHome,
          })}
        />
        <WindowContent>
          <Routes>
            <Route path={Path.Home} element={<Chat />} />
            <Route path={Path.NewChat} element={<NewChat />} />
            <Route path={Path.Masks} element={<MaskPage />} />
            <Route path={Path.Plugins} element={<PluginPage />} />
            <Route path={Path.SearchChat} element={<SearchChat />} />
            <Route path={Path.Chat} element={<Chat />} />
            <Route path={Path.Settings} element={<Settings />} />
            <Route path={Path.McpMarket} element={<McpMarketPage />} />
          </Routes>
        </WindowContent>
      </>
    );
  };

  return (
    <div
      className={clsx(styles.container, {
        [styles["tight-container"]]: shouldTightBorder,
        [styles["rtl-screen"]]: getLang() === "ar",
      })}
    >
      {renderContent()}
    </div>
  );
}

export function useLoadData(enabled = true) {
  const config = useAppConfig();
  const clientConfig = useMemo(() => getClientConfig(), []);
  const managedWorkspace = useManagedWorkspaceStore();

  const api: ClientApi = getClientApi(config.modelConfig.providerName);

  useEffect(() => {
    if (!enabled) return;
    (async () => {
      if (clientConfig?.sub2apiManagedMode) {
        const bootstrap = await managedWorkspace.fetchBootstrap();
        const models = getManagedWorkspaceLLMModelsForCurrentGroup(bootstrap);
        const nextModel =
          getManagedWorkspaceDefaultModelForCurrentGroup(bootstrap);
        config.update((nextConfig) => {
          nextConfig.models = models;
          if (nextModel) {
            nextConfig.modelConfig.model = nextModel as ModelType;
            nextConfig.modelConfig.providerName = ServiceProvider.OpenAI;
          }
        });
        if (nextModel) {
          const chatStore = useChatStore.getState();
          const session = chatStore.currentSession();
          chatStore.updateTargetSession(session, (session) => {
            session.mask.modelConfig.model = nextModel as ModelType;
            session.mask.modelConfig.providerName = ServiceProvider.OpenAI;
            session.mask.syncGlobalConfig = false;
          });
        }
        return;
      }
      const models = await api.llm.models();
      config.mergeModels(models);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, clientConfig?.sub2apiManagedMode]);
}

type ManagedGateStatus =
  | "authenticated"
  | "checking"
  | "launching"
  | "locked"
  | "error";

function readLaunchToken() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search)
    .get("launch_token")
    ?.trim();
}

function removeLaunchTokenFromLocation() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("launch_token");
  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

function useSub2APIManagedGate() {
  const clientConfig = useMemo(() => getClientConfig(), []);
  const managedMode = !!clientConfig?.sub2apiManagedMode;
  const [status, setStatus] = useState<ManagedGateStatus>(() => {
    if (!clientConfig?.sub2apiManagedMode || typeof window === "undefined") {
      return "authenticated";
    }
    return readLaunchToken() ? "launching" : "checking";
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!managedMode || typeof window === "undefined") {
      return;
    }

    const controller = new AbortController();

    const start = async () => {
      const launchToken = readLaunchToken();
      setError("");
      setStatus(launchToken ? "launching" : "checking");

      try {
        if (launchToken) {
          const res = await fetch(withBasePath("/api/nextchat/session"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ launch_token: launchToken }),
            credentials: "same-origin",
            signal: controller.signal,
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.msg || "Failed to start managed session");
          }
          removeLaunchTokenFromLocation();
          setStatus("authenticated");
          return;
        }

        const res = await fetch(withBasePath("/api/nextchat/session"), {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.msg || "Failed to check managed session");
        }
        const body = (await res.json()) as { authenticated?: boolean };
        setStatus(body.authenticated ? "authenticated" : "locked");
      } catch (error: any) {
        if (!controller.signal.aborted) {
          console.error("[Sub2API Managed] session gate failed", error);
          setError(error.message || "Failed to start managed session");
          setStatus("error");
        }
      }
    };

    start();

    return () => controller.abort();
  }, [managedMode]);

  return {
    managedMode,
    authenticated: !managedMode || status === "authenticated",
    pending: managedMode && (status === "checking" || status === "launching"),
    locked: managedMode && status === "locked",
    error,
  };
}

function ManagedLockedPage(props: { error?: string }) {
  return (
    <div className={clsx("no-dark", styles["managed-lock-page"])}>
      <div className={styles["managed-lock-logo"]}>
        <BotIcon />
      </div>
      <div className={styles["managed-lock-title"]}>极速蹬 AI 工作台</div>
      <div className={styles["managed-lock-subtitle"]}>
        请从极速蹬控制台进入
      </div>
      {props.error ? (
        <div className={styles["managed-lock-error"]}>{props.error}</div>
      ) : null}
      <div className={styles["managed-lock-actions"]}>
        <button
          className={styles["managed-lock-primary"]}
          onClick={() => {
            window.location.replace(JISUDENG_DASHBOARD_URL);
          }}
        >
          返回控制台
        </button>
      </div>
    </div>
  );
}

export function Home() {
  useSwitchTheme();
  const clientConfig = useMemo(() => getClientConfig(), []);
  const managedGate = useSub2APIManagedGate();
  const hasHydrated = useHasHydrated();
  useLoadData(managedGate.authenticated);
  useHtmlLang();

  useEffect(() => {
    if (!managedGate.authenticated) return;
    console.log("[Config] got config from build time", getClientConfig());
    useAccessStore.getState().fetch();
    if (clientConfig?.sub2apiManagedMode) return;

    const initMcp = async () => {
      try {
        const enabled = await isMcpEnabled();
        if (enabled) {
          console.log("[MCP] initializing...");
          await initializeMcpSystem();
          console.log("[MCP] initialized");
        }
      } catch (err) {
        console.error("[MCP] failed to initialize:", err);
      }
    };
    initMcp();
  }, [clientConfig?.sub2apiManagedMode, managedGate.authenticated]);

  if (!hasHydrated || managedGate.pending) {
    return <Loading />;
  }

  if (managedGate.locked || managedGate.error) {
    return <ManagedLockedPage error={managedGate.error} />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <Screen />
      </Router>
    </ErrorBoundary>
  );
}
