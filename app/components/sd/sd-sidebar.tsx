import { IconButton } from "@/app/components/button";
import GithubIcon from "@/app/icons/github.svg";
import SDIcon from "@/app/icons/sd.svg";
import ReturnIcon from "@/app/icons/return.svg";
import HistoryIcon from "@/app/icons/history.svg";
import ResetIcon from "@/app/icons/reload.svg";
import Locale from "@/app/locales";
import homeStyles from "@/app/components/home.module.scss";

import { Path, REPO_URL } from "@/app/constant";

import { useNavigate } from "react-router-dom";
import dynamic from "next/dynamic";
import {
  SideBarContainer,
  SideBarBody,
  SideBarHeader,
  SideBarTail,
  useDragSideBar,
  useHotKey,
} from "@/app/components/sidebar";

import { getParams, getModelParamBasicData } from "./sd-panel";
import { isSub2APIManagedImageStudio, useSdStore } from "@/app/store/sd";
import { showToast } from "@/app/components/ui-lib";
import { useMobileScreen } from "@/app/utils";
import {
  JISUDENG_DASHBOARD_URL,
  resolveManagedWorkspaceURL,
  useManagedWorkspaceStore,
} from "@/app/store/managed-workspace";
import { ManagedBrandLogo } from "@/app/components/managed-brand";
import { getImageStudioBackPath } from "@/app/utils/managed-image-studio-ui";

const SdPanel = dynamic(
  async () => (await import("@/app/components/sd")).SdPanel,
  {
    loading: () => null,
  },
);

function replaceLocation(url: string) {
  window.location.replace(url);
}

export function SideBar(props: { className?: string }) {
  useHotKey();
  const isMobileScreen = useMobileScreen();
  const { onDragStart, shouldNarrow } = useDragSideBar();
  const navigate = useNavigate();
  const sdStore = useSdStore();
  const currentModel = sdStore.currentModel;
  const params = sdStore.currentParams;
  const setParams = sdStore.setCurrentParams;
  const managedMode = isSub2APIManagedImageStudio();
  const managedBootstrap = useManagedWorkspaceStore((state) => state.bootstrap);
  const managedReturnUrl = resolveManagedWorkspaceURL(
    managedBootstrap?.urls?.return_url,
    JISUDENG_DASHBOARD_URL,
  );
  const returnToPreviousImageStudioPage = () => {
    navigate(getImageStudioBackPath(managedMode));
  };
  const returnToManagedConsole = () => replaceLocation(managedReturnUrl);

  const handleSubmit = () => {
    if (managedMode && sdStore.sub2apiImageStudioModelsLoading) {
      showToast("图片模型正在加载");
      return;
    }
    if (
      managedMode &&
      !sdStore.sub2apiImageStudioModels.some(
        (model) => model.id === currentModel.value,
      )
    ) {
      showToast("当前分组暂无图片模型，请先切换分组");
      return;
    }
    const columns = getParams?.(currentModel, params);
    const reqParams: any = {};
    for (let i = 0; i < columns.length; i++) {
      const item = columns[i];
      reqParams[item.value] = params[item.value] ?? null;
      if (item.required) {
        if (!reqParams[item.value]) {
          showToast(Locale.SdPanel.ParamIsRequired(item.name));
          return;
        }
      }
    }
    if (managedMode) {
      reqParams.template_id = params.template_id || "free-create";
      reqParams.reference_ids = sdStore.sub2apiImageStudioReferences.map(
        (reference) => reference.id,
      );
    }
    let data: any = {
      model: currentModel.value,
      model_name: currentModel.name,
      status: "wait",
      params: reqParams,
      created_at: new Date().toLocaleString(),
      img_data: "",
    };
    sdStore.sendTask(data, () => {
      setParams(getModelParamBasicData(columns, params, true));
      if (managedMode) {
        sdStore.clearSub2APIImageStudioReferences();
      }
      navigate(Path.SdNew);
    });
  };

  return (
    <SideBarContainer
      onDragStart={onDragStart}
      shouldNarrow={shouldNarrow}
      {...props}
    >
      {isMobileScreen ? (
        <div
          className="window-header"
          data-tauri-drag-region
          style={{
            paddingLeft: 0,
            paddingRight: 0,
          }}
        >
          <div className="window-actions">
            <div className="window-action-button">
              <IconButton
                icon={<ReturnIcon />}
                bordered
                title={Locale.Sd.Actions.ReturnHome}
                onClick={returnToPreviousImageStudioPage}
              />
            </div>
          </div>
          {managedMode ? (
            <ManagedBrandLogo compact />
          ) : (
            <SDIcon width={50} height={50} />
          )}
          <div className="window-actions">
            <div className="window-action-button">
              <IconButton
                icon={<HistoryIcon />}
                bordered
                title={Locale.Sd.Actions.History}
                onClick={() => navigate(Path.SdNew)}
              />
            </div>
          </div>
        </div>
      ) : (
        <SideBarHeader
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconButton
                icon={<ReturnIcon />}
                bordered
                title={Locale.Sd.Actions.ReturnHome}
                onClick={returnToPreviousImageStudioPage}
              />
              {managedMode && !shouldNarrow ? <span>图片创作</span> : null}
            </div>
          }
          subTitle={
            managedMode && typeof managedBootstrap?.user?.balance === "number"
              ? `余额 $${managedBootstrap.user.balance.toFixed(2)}`
              : undefined
          }
          logo={
            managedMode ? (
              <ManagedBrandLogo compact />
            ) : (
              <SDIcon width={38} height={"100%"} />
            )
          }
        ></SideBarHeader>
      )}
      <SideBarBody>
        <SdPanel />
      </SideBarBody>
      <SideBarTail
        className={managedMode ? homeStyles["managed-sidebar-tail"] : undefined}
        primaryAction={
          managedMode ? (
            <>
              <div className={homeStyles["sidebar-action"]}>
                <IconButton
                  icon={<ReturnIcon />}
                  text={shouldNarrow ? undefined : "返回上级"}
                  shadow
                  onClick={returnToPreviousImageStudioPage}
                />
              </div>
              <div className={homeStyles["sidebar-action"]}>
                <IconButton
                  icon={<ReturnIcon />}
                  text={shouldNarrow ? undefined : "控制台"}
                  shadow
                  onClick={returnToManagedConsole}
                />
              </div>
              <div className={homeStyles["sidebar-action"]}>
                <IconButton
                  icon={<ResetIcon />}
                  text={shouldNarrow ? undefined : "刷新任务"}
                  shadow
                  onClick={async () => {
                    const jobs = await sdStore.fetchSub2APIImageStudioJobs();
                    const error =
                      useSdStore.getState().sub2apiImageStudioJobsError;
                    showToast(error || `已同步 ${jobs.length} 个图片任务`);
                  }}
                />
              </div>
              <div className={homeStyles["sidebar-action"]}>
                <IconButton
                  text={Locale.SdPanel.Submit}
                  type="primary"
                  shadow
                  onClick={handleSubmit}
                ></IconButton>
              </div>
            </>
          ) : (
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              <IconButton icon={<GithubIcon />} shadow />
            </a>
          )
        }
        secondaryAction={
          managedMode ? undefined : (
            <IconButton
              text={Locale.SdPanel.Submit}
              type="primary"
              shadow
              onClick={handleSubmit}
            ></IconButton>
          )
        }
      />
    </SideBarContainer>
  );
}
