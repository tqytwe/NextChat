import chatStyles from "@/app/components/chat.module.scss";
import styles from "@/app/components/sd/sd.module.scss";
import homeStyles from "@/app/components/home.module.scss";

import { IconButton } from "@/app/components/button";
import ReturnIcon from "@/app/icons/return.svg";
import Locale from "@/app/locales";
import { Path } from "@/app/constant";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  copyToClipboard,
  getMessageTextContent,
  useMobileScreen,
} from "@/app/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppConfig } from "@/app/store";
import MinIcon from "@/app/icons/min.svg";
import MaxIcon from "@/app/icons/max.svg";
import { getClientConfig } from "@/app/config/client";
import { ChatAction } from "@/app/components/chat";
import DeleteIcon from "@/app/icons/clear.svg";
import CopyIcon from "@/app/icons/copy.svg";
import DownloadIcon from "@/app/icons/download.svg";
import ImageIcon from "@/app/icons/image.svg";
import MenuIcon from "@/app/icons/menu.svg";
import PromptIcon from "@/app/icons/prompt.svg";
import ResetIcon from "@/app/icons/reload.svg";
import {
  isSub2APIImageStudioDrawActive,
  isSub2APIManagedImageExpired,
  useSdStore,
} from "@/app/store/sd";
import LoadingIcon from "@/app/icons/three-dots.svg";
import ErrorIcon from "@/app/icons/delete.svg";
import SDIcon from "@/app/icons/sd.svg";
import { Property } from "csstype";
import {
  showConfirm,
  showImageModal,
  showModal,
  showToast,
  Select,
} from "@/app/components/ui-lib";
import { removeImage } from "@/app/utils/chat";
import { SideBar } from "./sd-sidebar";
import { WindowContent } from "@/app/components/home";
import { params } from "./sd-panel";
import clsx from "clsx";
import { ManagedBrandLogo } from "@/app/components/managed-brand";
import {
  downloadManagedImage,
  fetchManagedImageAssetBlob,
  getManagedImageAssetMessage,
  getManagedImageSources,
  summarizeManagedImageItems,
  type ManagedImageItemStatusSummary,
  type ManagedImageSource,
} from "@/app/utils/managed-image-studio-ui";

type ImageStudioLibraryViewMode = "gallery" | "list";
type ImageStudioLibrarySortMode = "newest" | "oldest" | "expires";

function getSdTaskStatus(item: any) {
  let s: string;
  let color: Property.Color | undefined = undefined;
  switch (item.status) {
    case "success":
      s = Locale.Sd.Status.Success;
      color = "green";
      break;
    case "error":
      s = Locale.Sd.Status.Error;
      color = "red";
      break;
    case "wait":
      s = Locale.Sd.Status.Wait;
      color = "yellow";
      break;
    case "running":
      s = Locale.Sd.Status.Running;
      color = "blue";
      break;
    default:
      s = item.status.toUpperCase();
  }
  return (
    <p className={styles["line-1"]} title={item.error} style={{ color: color }}>
      <span>
        {Locale.Sd.Status.Name}: {s}
        {item.sub2api_status && item.sub2api_status !== item.status
          ? ` · ${item.sub2api_status}`
          : ""}
      </span>
      {item.sync_deferred && (
        <span className="clickable">- 同步暂缓：{item.sync_error}</span>
      )}
      {item.status === "error" && (
        <span
          className="clickable"
          onClick={() => {
            showModal({
              title: Locale.Sd.Detail,
              children: (
                <div style={{ color: color, userSelect: "text" }}>
                  {item.error}
                </div>
              ),
            });
          }}
        >
          - {item.error}
        </span>
      )}
    </p>
  );
}

function ManagedImagePreview(props: {
  source: ManagedImageSource;
  isMobileScreen: boolean;
  compact?: boolean;
}) {
  const { source, isMobileScreen, compact } = props;
  const [state, setState] = useState<{
    loading: boolean;
    url: string;
    error: string;
  }>({ loading: true, url: "", error: "" });

  useEffect(() => {
    let alive = true;
    let objectURL = "";
    const previewURL = source.preview || "";

    setState({ loading: true, url: "", error: "" });
    if (!previewURL) {
      setState({ loading: false, url: "", error: "图片不可用" });
      return;
    }

    if (isLocalManagedImageURL(previewURL)) {
      setState({ loading: false, url: previewURL, error: "" });
      return;
    }

    fetchManagedImageAssetBlob(previewURL, { kind: "image", retries: 1 })
      .then((asset) => {
        if (typeof URL.createObjectURL !== "function") {
          if (alive) setState({ loading: false, url: previewURL, error: "" });
          return;
        }
        objectURL = URL.createObjectURL(asset.blob);
        if (!alive) {
          URL.revokeObjectURL(objectURL);
          return;
        }
        setState({ loading: false, url: objectURL, error: "" });
      })
      .catch((error) => {
        if (!alive) return;
        setState({
          loading: false,
          url: "",
          error: getManagedImageAssetMessage(error),
        });
      });

    return () => {
      alive = false;
      if (objectURL && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(objectURL);
      }
    };
  }, [source.preview]);

  if (state.loading) {
    return (
      <div
        className={clsx(styles["pre-img"], {
          [styles["asset-preview-compact"]]: compact,
        })}
      >
        <LoadingIcon />
      </div>
    );
  }

  if (state.error) {
    return (
      <div
        className={clsx(
          styles["pre-img"],
          styles["asset-error-img"],
          compact && styles["asset-preview-compact"],
        )}
        title={state.error}
      >
        {state.error}
      </div>
    );
  }

  return (
    <img
      className={styles["img"]}
      src={state.url}
      alt={source.filename || source.id}
      onClick={() =>
        showImageModal(
          state.url,
          true,
          isMobileScreen
            ? { width: "100%", height: "fit-content" }
            : { maxWidth: "100%", maxHeight: "100%" },
          isMobileScreen
            ? { width: "100%", height: "fit-content" }
            : { width: "100%", height: "100%" },
        )
      }
    />
  );
}

function isLocalManagedImageURL(url: string) {
  return url.startsWith("data:") || url.startsWith("blob:");
}

function managedImageTimestamp(item: any, field: "created_at" | "expires_at") {
  const primary = Date.parse(item?.[field] || "");
  if (Number.isFinite(primary)) return primary;
  const fallback = Date.parse(item?.created_at || "");
  return Number.isFinite(fallback) ? fallback : 0;
}

function compareManagedImages(
  left: any,
  right: any,
  sortMode: ImageStudioLibrarySortMode,
) {
  if (sortMode === "oldest") {
    return (
      managedImageTimestamp(left, "created_at") -
      managedImageTimestamp(right, "created_at")
    );
  }
  if (sortMode === "expires") {
    const leftExpires = managedImageTimestamp(left, "expires_at") || Infinity;
    const rightExpires = managedImageTimestamp(right, "expires_at") || Infinity;
    return leftExpires - rightExpires;
  }
  return (
    managedImageTimestamp(right, "created_at") -
    managedImageTimestamp(left, "created_at")
  );
}

function showManagedImageItemDetails(
  item: any,
  summary: ManagedImageItemStatusSummary,
) {
  showModal({
    title: "图片子任务",
    children: (
      <div className={styles["item-detail"]}>
        <div>sub2api_status: {item.sub2api_status || item.status}</div>
        <div>items: {summary.label}</div>
        {summary.failedItems.length > 0 && (
          <div className={styles["item-detail-failures"]}>
            {summary.failedItems.map((failed, index) => (
              <div key={`${failed.id || failed.status}-${index}`}>
                <strong>{failed.id || `item-${index + 1}`}</strong>
                <span>status: {failed.status}</span>
                {failed.assetID && <span>asset: {failed.assetID}</span>}
                {failed.error && <span>error: {failed.error}</span>}
              </div>
            ))}
          </div>
        )}
        <pre>{JSON.stringify(item.items ?? [], null, 2)}</pre>
      </div>
    ),
  });
}

export function Sd() {
  const isMobileScreen = useMobileScreen();
  const navigate = useNavigate();
  const location = useLocation();
  const clientConfig = useMemo(() => getClientConfig(), []);
  const managedMode = !!clientConfig?.sub2apiManagedMode;
  const showMaxIcon = !isMobileScreen && !clientConfig?.isApp;
  const config = useAppConfig();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sdStore = useSdStore();
  const sdImages = useMemo(() => sdStore.draw ?? [], [sdStore.draw]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] =
    useState<ImageStudioLibrarySortMode>("newest");
  const [viewMode, setViewMode] =
    useState<ImageStudioLibraryViewMode>("gallery");
  const isSd = location.pathname === Path.Sd;
  const expiredManagedImages = useMemo(() => {
    if (!managedMode) return [];
    return sdImages.filter((item: any) => isSub2APIManagedImageExpired(item));
  }, [managedMode, sdImages]);

  useEffect(() => {
    if (managedMode) {
      void sdStore.fetchSub2APIImageStudioJobs({ includeHistory: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managedMode]);

  const visibleSdImages = useMemo(() => {
    return sdImages
      .filter((item: any) => {
        const expired = managedMode && isSub2APIManagedImageExpired(item);
        if (statusFilter === "expired") return expired;
        if (expired) return false;
        if (statusFilter === "all") return true;
        if (statusFilter === "running") {
          return ["wait", "running"].includes(item.status);
        }
        return item.status === statusFilter;
      })
      .sort((left: any, right: any) =>
        managedMode ? compareManagedImages(left, right, sortMode) : 0,
      );
  }, [managedMode, sdImages, sortMode, statusFilter]);

  return (
    <>
      <SideBar className={clsx({ [homeStyles["sidebar-show"]]: isSd })} />
      <WindowContent>
        <div className={chatStyles.chat} key={"1"}>
          <div className="window-header" data-tauri-drag-region>
            {isMobileScreen && (
              <div className="window-actions">
                <div className={"window-action-button"}>
                  <IconButton
                    icon={<ReturnIcon />}
                    bordered
                    title={Locale.Chat.Actions.ChatList}
                    onClick={() => navigate(Path.Sd)}
                  />
                </div>
              </div>
            )}
            <div
              className={clsx(
                "window-header-title",
                chatStyles["chat-body-title"],
              )}
            >
              <div className={`window-header-main-title`}>
                {managedMode ? "创作库" : "Stability AI"}
              </div>
              <div className="window-header-sub-title">
                {Locale.Sd.SubTitle(visibleSdImages.length || 0)}
              </div>
            </div>

            <div className="window-actions">
              {showMaxIcon && (
                <div className="window-action-button">
                  <IconButton
                    aria={Locale.Chat.Actions.FullScreen}
                    icon={config.tightBorder ? <MinIcon /> : <MaxIcon />}
                    bordered
                    onClick={() => {
                      config.update(
                        (config) => (config.tightBorder = !config.tightBorder),
                      );
                    }}
                  />
                </div>
              )}
              {isMobileScreen &&
                (managedMode ? (
                  <ManagedBrandLogo compact />
                ) : (
                  <SDIcon width={50} height={50} />
                ))}
            </div>
          </div>
          <div className={chatStyles["chat-body"]} ref={scrollRef}>
            {managedMode && (
              <div className={styles["library-toolbar"]}>
                <div className={styles["library-tabs"]}>
                  {[
                    ["all", "全部"],
                    ["running", "生成中"],
                    ["success", "成功"],
                    ["error", "失败"],
                    ["expired", "已过期"],
                  ].map(([value, label]) => (
                    <IconButton
                      key={value}
                      text={label}
                      type={statusFilter === value ? "primary" : null}
                      onClick={() => setStatusFilter(value)}
                      shadow
                    />
                  ))}
                </div>
                <div className={styles["library-controls"]}>
                  <Select
                    aria-label="创作库排序"
                    value={sortMode}
                    onChange={(event) =>
                      setSortMode(
                        event.currentTarget.value as ImageStudioLibrarySortMode,
                      )
                    }
                  >
                    <option value="newest">最新优先</option>
                    <option value="oldest">最早优先</option>
                    <option value="expires">即将过期</option>
                  </Select>
                  <div className={styles["library-view-toggle"]}>
                    <IconButton
                      icon={<ImageIcon />}
                      title="画廊"
                      type={viewMode === "gallery" ? "primary" : null}
                      onClick={() => setViewMode("gallery")}
                      shadow
                    />
                    <IconButton
                      icon={<MenuIcon />}
                      title="列表"
                      type={viewMode === "list" ? "primary" : null}
                      onClick={() => setViewMode("list")}
                      shadow
                    />
                  </div>
                  {expiredManagedImages.length > 0 && (
                    <IconButton
                      icon={<DeleteIcon />}
                      text="清理过期"
                      onClick={async () => {
                        if (!(await showConfirm("清理已过期的图片任务？"))) {
                          return;
                        }
                        const count =
                          await sdStore.clearExpiredSub2APIImageStudioJobs();
                        const error =
                          useSdStore.getState().sub2apiImageStudioJobsError;
                        showToast(error || `已清理 ${count} 个过期任务`);
                      }}
                      shadow
                      disabled={sdStore.sub2apiImageStudioJobsLoading}
                    />
                  )}
                  <IconButton
                    icon={<ResetIcon />}
                    text={
                      sdStore.sub2apiImageStudioJobsLoading
                        ? "同步中"
                        : sdStore.sub2apiImageStudioHistoryLoaded
                        ? "刷新创作库"
                        : "加载创作库"
                    }
                    onClick={async () => {
                      const jobs = await sdStore.fetchSub2APIImageStudioJobs({
                        includeHistory: true,
                      });
                      const error =
                        useSdStore.getState().sub2apiImageStudioJobsError;
                      showModal({
                        title: "创作库",
                        children: (
                          <div>
                            {error ? error : `已同步 ${jobs.length} 个图片任务`}
                          </div>
                        ),
                      });
                    }}
                    shadow
                    disabled={sdStore.sub2apiImageStudioJobsLoading}
                  />
                </div>
              </div>
            )}
            {managedMode && sdStore.sub2apiImageStudioJobsError && (
              <div className={styles["library-error"]}>
                {sdStore.sub2apiImageStudioJobsError}
              </div>
            )}
            <div
              className={clsx(
                styles["sd-img-list"],
                managedMode && styles[`sd-img-list-${viewMode}`],
              )}
            >
              {visibleSdImages.length > 0 ? (
                visibleSdImages.map((item: any) => {
                  const managedExpired =
                    managedMode && isSub2APIManagedImageExpired(item);
                  const managedActive =
                    managedMode && isSub2APIImageStudioDrawActive(item);
                  const managedImageSources = managedMode
                    ? getManagedImageSources(item)
                    : [];
                  const managedItemSummary = managedMode
                    ? summarizeManagedImageItems(item.items)
                    : undefined;
                  return (
                    <div
                      key={item.id}
                      className={clsx(
                        styles["sd-img-item"],
                        managedMode && styles[`sd-img-item-${viewMode}`],
                      )}
                    >
                      {managedExpired ? (
                        <div
                          className={clsx(
                            styles["pre-img"],
                            styles["expired-img"],
                          )}
                        >
                          图片已过期
                        </div>
                      ) : item.status === "success" ? (
                        managedMode && managedImageSources.length > 1 ? (
                          <div className={styles["managed-img-grid"]}>
                            {managedImageSources.map((source) => (
                              <ManagedImagePreview
                                key={source.id}
                                source={source}
                                isMobileScreen={isMobileScreen}
                                compact
                              />
                            ))}
                          </div>
                        ) : managedMode ? (
                          managedImageSources[0] ? (
                            <ManagedImagePreview
                              source={managedImageSources[0]}
                              isMobileScreen={isMobileScreen}
                            />
                          ) : (
                            <div
                              className={clsx(
                                styles["pre-img"],
                                styles["asset-error-img"],
                              )}
                            >
                              图片不可用
                            </div>
                          )
                        ) : (
                          <img
                            className={styles["img"]}
                            src={item.img_data}
                            alt={item.id}
                            onClick={() =>
                              showImageModal(
                                item.img_data,
                                true,
                                isMobileScreen
                                  ? { width: "100%", height: "fit-content" }
                                  : { maxWidth: "100%", maxHeight: "100%" },
                                isMobileScreen
                                  ? { width: "100%", height: "fit-content" }
                                  : { width: "100%", height: "100%" },
                              )
                            }
                          />
                        )
                      ) : item.status === "error" ? (
                        <div className={styles["pre-img"]}>
                          <ErrorIcon />
                        </div>
                      ) : (
                        <div className={styles["pre-img"]}>
                          <LoadingIcon />
                        </div>
                      )}
                      <div className={styles["sd-img-item-info"]}>
                        <p className={styles["line-1"]}>
                          {Locale.SdPanel.Prompt}:{" "}
                          <span
                            className="clickable"
                            title={item.params.prompt}
                            onClick={() => {
                              showModal({
                                title: Locale.Sd.Detail,
                                children: (
                                  <div style={{ userSelect: "text" }}>
                                    {item.params.prompt}
                                  </div>
                                ),
                              });
                            }}
                          >
                            {item.params.prompt}
                          </span>
                        </p>
                        <p>
                          {Locale.SdPanel.AIModel}: {item.model_name}
                        </p>
                        {getSdTaskStatus(item)}
                        {managedItemSummary && (
                          <p
                            className={styles["line-1"]}
                            title={managedItemSummary.label}
                          >
                            items: {managedItemSummary.label}
                            <span
                              className="clickable"
                              onClick={() =>
                                showManagedImageItemDetails(
                                  item,
                                  managedItemSummary,
                                )
                              }
                            >
                              {" "}
                              - 明细
                            </span>
                          </p>
                        )}
                        <p>{item.created_at}</p>
                        {managedMode && item.expires_at && (
                          <p className={styles["line-1"]}>
                            保留至: {new Date(item.expires_at).toLocaleString()}
                          </p>
                        )}
                        <div className={chatStyles["chat-message-actions"]}>
                          <div className={chatStyles["chat-input-actions"]}>
                            <ChatAction
                              text={Locale.Sd.Actions.Params}
                              icon={<PromptIcon />}
                              onClick={() => {
                                showModal({
                                  title: Locale.Sd.GenerateParams,
                                  children: (
                                    <div style={{ userSelect: "text" }}>
                                      {Object.keys(item.params).map((key) => {
                                        let label = key;
                                        let value = item.params[key];
                                        switch (label) {
                                          case "prompt":
                                            label = Locale.SdPanel.Prompt;
                                            break;
                                          case "negative_prompt":
                                            label =
                                              Locale.SdPanel.NegativePrompt;
                                            break;
                                          case "aspect_ratio":
                                            label = Locale.SdPanel.AspectRatio;
                                            break;
                                          case "seed":
                                            label = "Seed";
                                            value = value || 0;
                                            break;
                                          case "output_format":
                                            label = Locale.SdPanel.OutFormat;
                                            value = value?.toUpperCase();
                                            break;
                                          case "style":
                                            label = Locale.SdPanel.ImageStyle;
                                            value = params
                                              .find(
                                                (item) =>
                                                  item.value === "style",
                                              )
                                              ?.options?.find(
                                                (item) => item.value === value,
                                              )?.name;
                                            break;
                                          default:
                                            break;
                                        }

                                        return (
                                          <div
                                            key={key}
                                            style={{ margin: "10px" }}
                                          >
                                            <strong>{label}: </strong>
                                            {value}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ),
                                });
                              }}
                            />
                            <ChatAction
                              text={Locale.Sd.Actions.Copy}
                              icon={<CopyIcon />}
                              onClick={() =>
                                copyToClipboard(
                                  getMessageTextContent({
                                    role: "user",
                                    content: item.params.prompt,
                                  }),
                                )
                              }
                            />
                            {managedMode &&
                              !managedExpired &&
                              managedImageSources.length > 0 && (
                                <ChatAction
                                  text="下载"
                                  icon={<DownloadIcon />}
                                  onClick={async () => {
                                    showToast("正在准备下载");
                                    try {
                                      const result =
                                        await downloadManagedImage(item);
                                      showToast(
                                        result.kind === "zip"
                                          ? `已开始下载 ZIP（${result.count} 张图片）`
                                          : `已开始下载 ${result.count} 张图片`,
                                      );
                                    } catch (error: any) {
                                      showToast(
                                        getManagedImageAssetMessage(error),
                                      );
                                    }
                                  }}
                                />
                              )}
                            <ChatAction
                              text={Locale.Sd.Actions.Retry}
                              icon={<ResetIcon />}
                              onClick={() => {
                                let retryModel = item.model;
                                let retryModelName = item.model_name;
                                if (managedMode) {
                                  if (sdStore.sub2apiImageStudioModelsLoading) {
                                    showToast("图片模型正在加载");
                                    return;
                                  }
                                  const modelCapability =
                                    sdStore.sub2apiImageStudioModels.find(
                                      (model) => model.id === item.model,
                                    );
                                  if (!modelCapability) {
                                    showToast(
                                      "当前分组不支持该图片模型，请切换到兼容分组后重试",
                                    );
                                    return;
                                  }
                                  retryModel = modelCapability.id;
                                  retryModelName =
                                    modelCapability.display_name ||
                                    modelCapability.id;
                                }
                                const reqData = {
                                  model: retryModel,
                                  model_name: retryModelName,
                                  status: "wait",
                                  params: { ...item.params },
                                  created_at: new Date().toLocaleString(),
                                  img_data: "",
                                };
                                sdStore.sendTask(reqData);
                              }}
                            />
                            <ChatAction
                              text={
                                managedActive
                                  ? "取消"
                                  : Locale.Sd.Actions.Delete
                              }
                              icon={<DeleteIcon />}
                              onClick={async () => {
                                if (
                                  await showConfirm(Locale.Sd.Danger.Delete)
                                ) {
                                  try {
                                    if (managedMode && item.job_id) {
                                      if (managedActive) {
                                        await sdStore.cancelSub2APIImageStudioJob(
                                          item.job_id,
                                        );
                                        showToast("已取消任务");
                                      } else {
                                        await sdStore.deleteSub2APIImageStudioJob(
                                          item.job_id,
                                        );
                                        showToast("已删除任务");
                                      }
                                      return;
                                    }
                                    await removeImage(item.img_data);
                                    useSdStore.setState({
                                      draw: useSdStore
                                        .getState()
                                        .draw.filter(
                                          (i: any) => i.id !== item.id,
                                        ),
                                    } as any);
                                    sdStore.getNextId();
                                    showToast("已删除记录");
                                  } catch (error: any) {
                                    showToast(error.message || "删除失败");
                                  }
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className={styles["library-empty"]}>
                  {managedMode
                    ? sdStore.sub2apiImageStudioHistoryLoaded
                      ? statusFilter === "expired"
                        ? "没有已过期任务"
                        : "暂无创作记录"
                      : "当前没有进行中的图片任务"
                    : Locale.Sd.EmptyRecord}
                </div>
              )}
            </div>
          </div>
        </div>
      </WindowContent>
    </>
  );
}
