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
} from "@/app/components/ui-lib";
import { removeImage } from "@/app/utils/chat";
import { SideBar } from "./sd-sidebar";
import { WindowContent } from "@/app/components/home";
import { params } from "./sd-panel";
import clsx from "clsx";
import { ManagedBrandLogo } from "@/app/components/managed-brand";
import {
  downloadManagedImage,
  getManagedImageSources,
} from "@/app/utils/managed-image-studio-ui";

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
  const sdImages = sdStore.draw ?? [];
  const [statusFilter, setStatusFilter] = useState("all");
  const isSd = location.pathname === Path.Sd;

  useEffect(() => {
    if (managedMode) {
      void sdStore.fetchSub2APIImageStudioJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managedMode]);

  const visibleSdImages = useMemo(() => {
    return sdImages.filter((item: any) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "expired") {
        return managedMode && isSub2APIManagedImageExpired(item);
      }
      if (statusFilter === "running") {
        return ["wait", "running"].includes(item.status);
      }
      return item.status === statusFilter;
    });
  }, [managedMode, sdImages, statusFilter]);

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
                <IconButton
                  icon={<ResetIcon />}
                  text={
                    sdStore.sub2apiImageStudioJobsLoading ? "同步中" : "刷新"
                  }
                  onClick={async () => {
                    const jobs = await sdStore.fetchSub2APIImageStudioJobs();
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
            )}
            {managedMode && sdStore.sub2apiImageStudioJobsError && (
              <div className={styles["library-error"]}>
                {sdStore.sub2apiImageStudioJobsError}
              </div>
            )}
            <div className={styles["sd-img-list"]}>
              {visibleSdImages.length > 0 ? (
                visibleSdImages.map((item: any) => {
                  const managedExpired =
                    managedMode && isSub2APIManagedImageExpired(item);
                  const managedActive =
                    managedMode && isSub2APIImageStudioDrawActive(item);
                  const managedImageSources = managedMode
                    ? getManagedImageSources(item)
                    : [];
                  return (
                    <div
                      key={item.id}
                      style={{ display: "flex" }}
                      className={styles["sd-img-item"]}
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
                              <img
                                key={source.id}
                                className={styles["img"]}
                                src={source.preview}
                                alt={source.id}
                                onClick={() =>
                                  showImageModal(
                                    source.preview,
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
                            ))}
                          </div>
                        ) : (
                          <img
                            className={styles["img"]}
                            src={
                              managedMode
                                ? managedImageSources[0]?.preview ||
                                  item.img_data
                                : item.img_data
                            }
                            alt={item.id}
                            onClick={() =>
                              showImageModal(
                                managedMode
                                  ? managedImageSources[0]?.preview ||
                                      item.img_data
                                  : item.img_data,
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
                      <div
                        style={{ marginLeft: "10px" }}
                        className={styles["sd-img-item-info"]}
                      >
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
                                  onClick={() =>
                                    void downloadManagedImage(item, (count) =>
                                      showToast(`已开始下载 ${count} 张图片`),
                                    ).catch((error: any) =>
                                      showToast(error.message || "下载失败"),
                                    )
                                  }
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
                                      } else {
                                        await sdStore.deleteSub2APIImageStudioJob(
                                          item.job_id,
                                        );
                                      }
                                      return;
                                    }
                                    await removeImage(item.img_data);
                                    sdStore.draw = sdImages.filter(
                                      (i: any) => i.id !== item.id,
                                    );
                                    sdStore.getNextId();
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
                <div>
                  {managedMode ? "暂无创作记录" : Locale.Sd.EmptyRecord}
                </div>
              )}
            </div>
          </div>
        </div>
      </WindowContent>
    </>
  );
}
