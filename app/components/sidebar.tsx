import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";

import styles from "./home.module.scss";

import { IconButton } from "./button";
import SettingsIcon from "../icons/settings.svg";
import GithubIcon from "../icons/github.svg";
import ChatGptIcon from "../icons/chatgpt.svg";
import AddIcon from "../icons/add.svg";
import DeleteIcon from "../icons/delete.svg";
import MaskIcon from "../icons/mask.svg";
import McpIcon from "../icons/mcp.svg";
import DragIcon from "../icons/drag.svg";
import DiscoveryIcon from "../icons/discovery.svg";
import ReturnIcon from "../icons/return.svg";
import PowerIcon from "../icons/power.svg";
import LightningIcon from "../icons/lightning.svg";
import SDIcon from "../icons/sd.svg";

import Locale from "../locales";

import { useAppConfig, useChatStore } from "../store";

import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  NARROW_SIDEBAR_WIDTH,
  Path,
  REPO_URL,
} from "../constant";

import { Link, useNavigate } from "react-router-dom";
import { isIOS, useMobileScreen } from "../utils";
import dynamic from "next/dynamic";
import { Selector, showConfirm } from "./ui-lib";
import clsx from "clsx";
import { isMcpEnabled } from "../mcp/actions";
import { getClientConfig } from "../config/client";
import { withBasePath } from "../utils/api-path";
import { useManagedWorkspaceStore } from "../store/managed-workspace";

const JISUDENG_RETURN_URL = "https://www.jisudeng.com";

const DISCOVERY = [
  { name: Locale.Plugin.Name, path: Path.Plugins },
  { name: "Stable Diffusion", path: Path.Sd },
  { name: Locale.SearchChat.Page.Title, path: Path.SearchChat },
];

const ChatList = dynamic(async () => (await import("./chat-list")).ChatList, {
  loading: () => null,
});

export function useHotKey() {
  const chatStore = useChatStore();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey) {
        if (e.key === "ArrowUp") {
          chatStore.nextSession(-1);
        } else if (e.key === "ArrowDown") {
          chatStore.nextSession(1);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
}

export function useDragSideBar() {
  const limit = (x: number) => Math.min(MAX_SIDEBAR_WIDTH, x);

  const config = useAppConfig();
  const startX = useRef(0);
  const startDragWidth = useRef(config.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH);
  const lastUpdateTime = useRef(Date.now());

  const toggleSideBar = () => {
    config.update((config) => {
      if (config.sidebarWidth < MIN_SIDEBAR_WIDTH) {
        config.sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
      } else {
        config.sidebarWidth = NARROW_SIDEBAR_WIDTH;
      }
    });
  };

  const onDragStart = (e: MouseEvent) => {
    // Remembers the initial width each time the mouse is pressed
    startX.current = e.clientX;
    startDragWidth.current = config.sidebarWidth;
    const dragStartTime = Date.now();

    const handleDragMove = (e: MouseEvent) => {
      if (Date.now() < lastUpdateTime.current + 20) {
        return;
      }
      lastUpdateTime.current = Date.now();
      const d = e.clientX - startX.current;
      const nextWidth = limit(startDragWidth.current + d);
      config.update((config) => {
        if (nextWidth < MIN_SIDEBAR_WIDTH) {
          config.sidebarWidth = NARROW_SIDEBAR_WIDTH;
        } else {
          config.sidebarWidth = nextWidth;
        }
      });
    };

    const handleDragEnd = () => {
      // In useRef the data is non-responsive, so `config.sidebarWidth` can't get the dynamic sidebarWidth
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", handleDragEnd);

      // if user click the drag icon, should toggle the sidebar
      const shouldFireClick = Date.now() - dragStartTime < 300;
      if (shouldFireClick) {
        toggleSideBar();
      }
    };

    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", handleDragEnd);
  };

  const isMobileScreen = useMobileScreen();
  const shouldNarrow =
    !isMobileScreen && config.sidebarWidth < MIN_SIDEBAR_WIDTH;

  useEffect(() => {
    const barWidth = shouldNarrow
      ? NARROW_SIDEBAR_WIDTH
      : limit(config.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH);
    const sideBarWidth = isMobileScreen ? "100vw" : `${barWidth}px`;
    document.documentElement.style.setProperty("--sidebar-width", sideBarWidth);
  }, [config.sidebarWidth, isMobileScreen, shouldNarrow]);

  return {
    onDragStart,
    shouldNarrow,
  };
}

export function SideBarContainer(props: {
  children: React.ReactNode;
  onDragStart: (e: MouseEvent) => void;
  shouldNarrow: boolean;
  className?: string;
}) {
  const isMobileScreen = useMobileScreen();
  const isIOSMobile = useMemo(
    () => isIOS() && isMobileScreen,
    [isMobileScreen],
  );
  const { children, className, onDragStart, shouldNarrow } = props;
  return (
    <div
      className={clsx(styles.sidebar, className, {
        [styles["narrow-sidebar"]]: shouldNarrow,
      })}
      style={{
        // #3016 disable transition on ios mobile screen
        transition: isMobileScreen && isIOSMobile ? "none" : undefined,
      }}
    >
      {children}
      <div
        className={styles["sidebar-drag"]}
        onPointerDown={(e) => onDragStart(e as any)}
      >
        <DragIcon />
      </div>
    </div>
  );
}

export function SideBarHeader(props: {
  title?: string | React.ReactNode;
  subTitle?: string | React.ReactNode;
  logo?: React.ReactNode;
  children?: React.ReactNode;
  shouldNarrow?: boolean;
}) {
  const { title, subTitle, logo, children, shouldNarrow } = props;
  return (
    <Fragment>
      <div
        className={clsx(styles["sidebar-header"], {
          [styles["sidebar-header-narrow"]]: shouldNarrow,
        })}
        data-tauri-drag-region
      >
        <div className={styles["sidebar-title-container"]}>
          <div className={styles["sidebar-title"]} data-tauri-drag-region>
            {title}
          </div>
          <div className={styles["sidebar-sub-title"]}>{subTitle}</div>
        </div>
        <div className={clsx(styles["sidebar-logo"], "no-dark")}>{logo}</div>
      </div>
      {children}
    </Fragment>
  );
}

export function SideBarBody(props: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
}) {
  const { onClick, children } = props;
  return (
    <div className={styles["sidebar-body"]} onClick={onClick}>
      {children}
    </div>
  );
}

export function SideBarTail(props: {
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  const { primaryAction, secondaryAction } = props;

  return (
    <div className={styles["sidebar-tail"]}>
      <div className={styles["sidebar-actions"]}>{primaryAction}</div>
      <div className={styles["sidebar-actions"]}>{secondaryAction}</div>
    </div>
  );
}

export function SideBar(props: { className?: string }) {
  useHotKey();
  const { onDragStart, shouldNarrow } = useDragSideBar();
  const [showDiscoverySelector, setshowDiscoverySelector] = useState(false);
  const navigate = useNavigate();
  const config = useAppConfig();
  const chatStore = useChatStore();
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const managedMode = !!getClientConfig()?.sub2apiManagedMode;
  const managedBootstrap = useManagedWorkspaceStore((state) => state.bootstrap);
  const managedReturnUrl =
    managedBootstrap?.urls?.return_url || JISUDENG_RETURN_URL;
  const managedRechargeUrl = managedBootstrap?.urls?.recharge_url;
  const managedBalance = managedBootstrap?.user?.balance;
  const managedSubtitle =
    typeof managedBalance === "number"
      ? `余额 $${managedBalance.toFixed(2)}`
      : "Sub2API 托管前台";

  useEffect(() => {
    if (managedMode) return;
    // 检查 MCP 是否启用
    const checkMcpStatus = async () => {
      const enabled = await isMcpEnabled();
      setMcpEnabled(enabled);
      console.log("[SideBar] MCP enabled:", enabled);
    };
    checkMcpStatus();
  }, [managedMode]);

  const newChat = () => {
    if (config.dontShowMaskSplashScreen || managedMode) {
      chatStore.newSession();
      navigate(Path.Chat);
    } else {
      navigate(Path.NewChat);
    }
  };

  const logoutManagedWorkspace = async () => {
    try {
      await fetch(withBasePath("/api/nextchat/session"), {
        method: "DELETE",
        credentials: "same-origin",
      });
    } finally {
      window.location.href = withBasePath("/");
    }
  };

  return (
    <SideBarContainer
      onDragStart={onDragStart}
      shouldNarrow={shouldNarrow}
      {...props}
    >
      <SideBarHeader
        title={managedMode ? "极速蹬 AI 工作台" : "NextChat"}
        subTitle={
          managedMode ? managedSubtitle : "Build your own AI assistant."
        }
        logo={<ChatGptIcon />}
        shouldNarrow={shouldNarrow}
      >
        {!managedMode ? (
          <div className={styles["sidebar-header-bar"]}>
            <IconButton
              icon={<MaskIcon />}
              text={shouldNarrow ? undefined : Locale.Mask.Name}
              className={styles["sidebar-bar-button"]}
              onClick={() => {
                if (config.dontShowMaskSplashScreen !== true) {
                  navigate(Path.NewChat, { state: { fromHome: true } });
                } else {
                  navigate(Path.Masks, { state: { fromHome: true } });
                }
              }}
              shadow
            />
            {mcpEnabled && (
              <IconButton
                icon={<McpIcon />}
                text={shouldNarrow ? undefined : Locale.Mcp.Name}
                className={styles["sidebar-bar-button"]}
                onClick={() => {
                  navigate(Path.McpMarket, { state: { fromHome: true } });
                }}
                shadow
              />
            )}
            <IconButton
              icon={<DiscoveryIcon />}
              text={shouldNarrow ? undefined : Locale.Discovery.Name}
              className={styles["sidebar-bar-button"]}
              onClick={() => setshowDiscoverySelector(true)}
              shadow
            />
          </div>
        ) : (
          <div className={styles["sidebar-header-bar"]}>
            <IconButton
              icon={<SDIcon />}
              text={shouldNarrow ? undefined : "图片创作"}
              className={styles["sidebar-bar-button"]}
              onClick={() => navigate(Path.Sd, { state: { fromHome: true } })}
              shadow
            />
          </div>
        )}
        {showDiscoverySelector && (
          <Selector
            items={[
              ...DISCOVERY.map((item) => {
                return {
                  title: item.name,
                  value: item.path,
                };
              }),
            ]}
            onClose={() => setshowDiscoverySelector(false)}
            onSelection={(s) => {
              navigate(s[0], { state: { fromHome: true } });
            }}
          />
        )}
      </SideBarHeader>
      <SideBarBody
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            navigate(Path.Home);
          }
        }}
      >
        <ChatList narrow={shouldNarrow} />
      </SideBarBody>
      <SideBarTail
        primaryAction={
          <>
            <div className={clsx(styles["sidebar-action"], styles.mobile)}>
              <IconButton
                icon={<DeleteIcon />}
                onClick={async () => {
                  if (await showConfirm(Locale.Home.DeleteChat)) {
                    chatStore.deleteSession(chatStore.currentSessionIndex);
                  }
                }}
              />
            </div>
            <div className={styles["sidebar-action"]}>
              <Link to={Path.Settings}>
                <IconButton
                  aria={Locale.Settings.Title}
                  icon={<SettingsIcon />}
                  shadow
                />
              </Link>
            </div>
            {managedMode ? (
              <>
                <div className={styles["sidebar-action"]}>
                  <a href={managedReturnUrl}>
                    <IconButton
                      aria="返回极速蹬"
                      icon={<ReturnIcon />}
                      text={shouldNarrow ? undefined : "返回"}
                      shadow
                    />
                  </a>
                </div>
                {managedRechargeUrl ? (
                  <div className={styles["sidebar-action"]}>
                    <a href={managedRechargeUrl}>
                      <IconButton
                        aria="充值"
                        icon={<LightningIcon />}
                        text={shouldNarrow ? undefined : "充值"}
                        shadow
                      />
                    </a>
                  </div>
                ) : null}
                <div className={styles["sidebar-action"]}>
                  <IconButton
                    aria="退出工作台"
                    icon={<PowerIcon />}
                    text={shouldNarrow ? undefined : "退出"}
                    onClick={logoutManagedWorkspace}
                    shadow
                  />
                </div>
              </>
            ) : (
              <div className={styles["sidebar-action"]}>
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                  <IconButton
                    aria={Locale.Export.MessageFromChatGPT}
                    icon={<GithubIcon />}
                    shadow
                  />
                </a>
              </div>
            )}
          </>
        }
        secondaryAction={
          <IconButton
            icon={<AddIcon />}
            text={shouldNarrow ? undefined : Locale.Home.NewChat}
            onClick={newChat}
            shadow
          />
        }
      />
    </SideBarContainer>
  );
}
