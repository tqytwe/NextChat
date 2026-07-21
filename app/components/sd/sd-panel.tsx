import styles from "./sd-panel.module.scss";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Select, Selector } from "@/app/components/ui-lib";
import { IconButton } from "@/app/components/button";
import Locale from "@/app/locales";
import {
  canSub2APIImageStudioUseReferences,
  getSub2APIImageStudioReferenceLimit,
  inferSub2APIImageStudioAspectTier,
  isSub2APIManagedImageStudio,
  resolveSub2APIImageStudioSize,
  type SdPanelModel,
  type Sub2APIImageStudioModel,
  toSub2APIImageStudioPanelModel,
  useSdStore,
} from "@/app/store/sd";
import {
  getManagedWorkspaceCurrentGroup,
  useManagedWorkspaceStore,
} from "@/app/store/managed-workspace";
import clsx from "clsx";
import UploadIcon from "@/app/icons/upload.svg";
import DeleteIcon from "@/app/icons/clear.svg";
import LoadingIcon from "@/app/icons/three-dots.svg";
import { showToast } from "@/app/components/ui-lib";
import { applyManagedWorkspaceModelsToStores } from "@/app/utils/managed-workspace-models";

export const params = [
  {
    name: Locale.SdPanel.Prompt,
    value: "prompt",
    type: "textarea",
    placeholder: Locale.SdPanel.PleaseInput(Locale.SdPanel.Prompt),
    required: true,
  },
  {
    name: Locale.SdPanel.ModelVersion,
    value: "model",
    type: "select",
    default: "sd3-medium",
    support: ["sd3"],
    options: [
      { name: "SD3 Medium", value: "sd3-medium" },
      { name: "SD3 Large", value: "sd3-large" },
      { name: "SD3 Large Turbo", value: "sd3-large-turbo" },
    ],
  },
  {
    name: Locale.SdPanel.NegativePrompt,
    value: "negative_prompt",
    type: "textarea",
    placeholder: Locale.SdPanel.PleaseInput(Locale.SdPanel.NegativePrompt),
  },
  {
    name: Locale.SdPanel.AspectRatio,
    value: "aspect_ratio",
    type: "select",
    default: "1:1",
    options: [
      { name: "1:1", value: "1:1" },
      { name: "16:9", value: "16:9" },
      { name: "21:9", value: "21:9" },
      { name: "2:3", value: "2:3" },
      { name: "3:2", value: "3:2" },
      { name: "4:5", value: "4:5" },
      { name: "5:4", value: "5:4" },
      { name: "9:16", value: "9:16" },
      { name: "9:21", value: "9:21" },
    ],
  },
  {
    name: Locale.SdPanel.ImageStyle,
    value: "style",
    type: "select",
    default: "3d-model",
    support: ["core"],
    options: [
      { name: Locale.SdPanel.Styles.D3Model, value: "3d-model" },
      { name: Locale.SdPanel.Styles.AnalogFilm, value: "analog-film" },
      { name: Locale.SdPanel.Styles.Anime, value: "anime" },
      { name: Locale.SdPanel.Styles.Cinematic, value: "cinematic" },
      { name: Locale.SdPanel.Styles.ComicBook, value: "comic-book" },
      { name: Locale.SdPanel.Styles.DigitalArt, value: "digital-art" },
      { name: Locale.SdPanel.Styles.Enhance, value: "enhance" },
      { name: Locale.SdPanel.Styles.FantasyArt, value: "fantasy-art" },
      { name: Locale.SdPanel.Styles.Isometric, value: "isometric" },
      { name: Locale.SdPanel.Styles.LineArt, value: "line-art" },
      { name: Locale.SdPanel.Styles.LowPoly, value: "low-poly" },
      {
        name: Locale.SdPanel.Styles.ModelingCompound,
        value: "modeling-compound",
      },
      { name: Locale.SdPanel.Styles.NeonPunk, value: "neon-punk" },
      { name: Locale.SdPanel.Styles.Origami, value: "origami" },
      { name: Locale.SdPanel.Styles.Photographic, value: "photographic" },
      { name: Locale.SdPanel.Styles.PixelArt, value: "pixel-art" },
      { name: Locale.SdPanel.Styles.TileTexture, value: "tile-texture" },
    ],
  },
  {
    name: "Seed",
    value: "seed",
    type: "number",
    default: 0,
    min: 0,
    max: 4294967294,
  },
  {
    name: Locale.SdPanel.OutFormat,
    value: "output_format",
    type: "select",
    default: "png",
    options: [
      { name: "PNG", value: "png" },
      { name: "JPEG", value: "jpeg" },
      { name: "WebP", value: "webp" },
    ],
  },
];

const sdCommonParams = (model: string, data: any) => {
  return params.filter((item) => {
    return !(item.support && !item.support.includes(model));
  });
};

export const models = [
  {
    name: "Stable Image Ultra",
    value: "ultra",
    params: (data: any) => sdCommonParams("ultra", data),
  },
  {
    name: "Stable Image Core",
    value: "core",
    params: (data: any) => sdCommonParams("core", data),
  },
  {
    name: "Stable Diffusion 3",
    value: "sd3",
    params: (data: any) => {
      return sdCommonParams("sd3", data).filter((item) => {
        return !(
          data.model === "sd3-large-turbo" && item.value == "negative_prompt"
        );
      });
    },
  },
];

export const sub2APIImageStudioParams = [
  {
    name: Locale.SdPanel.Prompt,
    value: "prompt",
    type: "textarea",
    placeholder: "描述你要生成的图片",
    required: true,
    rows: 5,
  },
  {
    name: "尺寸",
    value: "size",
    type: "select",
    default: "1024x1024",
    options: [
      { name: "1:1 · 1024x1024", value: "1024x1024" },
      { name: "3:4 · 1024x1536", value: "1024x1536" },
      { name: "4:3 · 1536x1024", value: "1536x1024" },
    ],
  },
  {
    name: "张数",
    value: "count",
    type: "number",
    default: 1,
    min: 1,
    max: 4,
  },
  {
    name: "质量",
    value: "quality",
    type: "select",
    default: "auto",
    options: [
      { name: "Auto", value: "auto" },
      { name: "High", value: "high" },
      { name: "Medium", value: "medium" },
      { name: "Low", value: "low" },
      { name: "Standard", value: "standard" },
    ],
  },
  {
    name: Locale.SdPanel.OutFormat,
    value: "output_format",
    type: "select",
    default: "png",
    options: [
      { name: "PNG", value: "png" },
      { name: "JPEG", value: "jpeg" },
      { name: "WebP", value: "webp" },
    ],
  },
];

const imageStudioAspectLabels: Record<string, string> = {
  "1:1": "正方 1:1",
  "2:3": "竖版 2:3",
  "3:2": "横版 3:2",
  "9:16": "竖屏 9:16",
  "16:9": "宽屏 16:9",
};

const imageStudioResolutionLabels: Record<string, string> = {
  "1K": "标准 1K",
  "2K": "高清 2K",
  "3K": "精细 3K",
  "4K": "超清 4K",
};

export function getSub2APIImageStudioParams(
  model?: Sub2APIImageStudioModel,
  data: any = {},
) {
  if (!model) return sub2APIImageStudioParams;
  const sizeSet = new Set(model.supported_sizes ?? []);
  const sizingKind = normalizeImageStudioSizingKind(model);
  const defaultSize = model.default_size || model.supported_sizes?.[0];
  const inferred = inferSub2APIImageStudioAspectTier(defaultSize);
  const aspects = normalizeImageStudioOptions(
    model.supported_aspect_ratios,
    inferAspectsFromSupportedSizes(sizeSet),
    ["1:1", "2:3", "3:2", "9:16", "16:9"],
  );
  const requestedAspect =
    data.aspect || model.default_aspect_ratio || inferred.aspect || "1:1";
  const selectedAspect = aspects.includes(requestedAspect)
    ? requestedAspect
    : aspects[0] || "1:1";
  const resolutions = normalizeImageStudioOptions(
    model.supported_resolutions?.map((resolution) => resolution.toUpperCase()),
    inferTiersFromSupportedSizes(sizeSet),
    ["1K"],
  ).filter((tier) =>
    sizeAllowedForImageStudioModel(
      model,
      resolveSub2APIImageStudioSize(selectedAspect, tier),
    ),
  );
  const qualities = normalizeImageStudioOptions(
    model.supported_qualities,
    [],
    ["auto"],
  );
  const outputFormats = normalizeImageStudioOptions(
    model.supported_output_formats,
    [],
    ["png"],
  );
  const backgrounds = normalizeImageStudioOptions(
    model.supported_backgrounds,
    [],
    [],
  ).filter(
    (background) =>
      background !== "transparent" || model.supports_transparency !== false,
  );
  const inputFidelities = normalizeImageStudioOptions(
    model.supported_input_fidelities,
    [],
    [],
  );
  const defaultAspect =
    selectedAspect ||
    aspects.find((aspect) => aspect === inferred.aspect) ||
    aspects[0] ||
    "1:1";
  const defaultResolution =
    model.default_resolution?.toUpperCase() ||
    resolutions.find((resolution) => resolution === inferred.tier) ||
    resolutions[0] ||
    "1K";

  const params: any[] = [
    {
      name: Locale.SdPanel.Prompt,
      value: "prompt",
      type: "textarea",
      placeholder: "描述你要生成的图片",
      required: true,
      rows: 5,
    },
  ];

  if (sizingKind === "fixed") {
    params.push({
      name: "固定尺寸",
      value: "size",
      type: "readonly",
      default: defaultSize || "1024x1024",
      sub: "此模型仅支持该尺寸",
    });
  } else if (sizingKind === "custom") {
    const sizes = Array.from(sizeSet);
    const selectedSize =
      sizes.find((size) => size === data.size) ||
      sizes.find((size) => size === defaultSize) ||
      sizes[0] ||
      defaultSize ||
      "1024x1024";
    params.push({
      name: "尺寸",
      value: "size",
      type: "select",
      default: selectedSize,
      options: sizes.map((size) => ({
        name: size,
        value: size,
      })),
    });
  } else {
    params.push(
      {
        name: "比例",
        value: "aspect",
        type: "select",
        default: defaultAspect,
        options: aspects.map((aspect) => ({
          name: imageStudioAspectLabels[aspect] || aspect,
          value: aspect,
        })),
      },
      {
        name: "分辨率",
        value: "resolution",
        type: "select",
        default: defaultResolution,
        options: resolutions.map((resolution) => ({
          name: imageStudioResolutionLabels[resolution] || resolution,
          value: resolution,
        })),
      },
    );
  }

  params.push({
    name: "张数",
    value: "count",
    type: "number",
    default: 1,
    min: 1,
    max: 4,
  });

  if (qualities.length > 0) {
    params.push({
      name: "质量",
      value: "quality",
      type: "select",
      default: model.default_quality || qualities[0],
      options: qualities.map((quality) => ({
        name: qualityLabel(quality),
        value: quality,
      })),
    });
  }
  if (backgrounds.length > 0) {
    params.push({
      name: "背景",
      value: "background",
      type: "select",
      default: model.default_background || backgrounds[0],
      options: backgrounds.map((background) => ({
        name: backgroundLabel(background),
        value: background,
      })),
    });
  }
  if (outputFormats.length > 0) {
    params.push({
      name: Locale.SdPanel.OutFormat,
      value: "output_format",
      type: "select",
      default: model.default_output_format || outputFormats[0],
      options: outputFormats.map((format) => ({
        name: format.toUpperCase(),
        value: format,
      })),
    });
  }
  if (inputFidelities.length > 0) {
    params.push({
      name: "参考图精度",
      value: "input_fidelity",
      type: "select",
      default: model.default_input_fidelity || inputFidelities[0],
      options: inputFidelities.map((fidelity) => ({
        name: qualityLabel(fidelity),
        value: fidelity,
      })),
      sub: "上传引用图时生效",
    });
  }
  if (
    model.output_compression &&
    imageStudioOutputCompressionApplies(
      model.output_compression,
      data.output_format || model.default_output_format || outputFormats[0],
    )
  ) {
    params.push({
      name: "压缩质量",
      value: "output_compression",
      type: "number",
      default: "",
      min: model.output_compression.min ?? 0,
      max: model.output_compression.max ?? 100,
    });
  }

  return params;
}

function normalizeImageStudioOptions(
  preferred: string[] | undefined,
  inferred: string[],
  fallback: string[],
) {
  const out = [...(preferred ?? []), ...inferred, ...fallback]
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(out));
}

function inferAspectsFromSupportedSizes(sizes: Set<string>) {
  const aspects = new Set<string>();
  sizes.forEach((size) => {
    const { aspect } = inferSub2APIImageStudioAspectTier(size);
    if (aspect) aspects.add(aspect);
  });
  return Array.from(aspects);
}

function inferTiersFromSupportedSizes(sizes: Set<string>) {
  const tiers = new Set<string>();
  sizes.forEach((size) => {
    const { tier } = inferSub2APIImageStudioAspectTier(size);
    if (tier) tiers.add(tier);
  });
  return Array.from(tiers);
}

function sizeAllowedForImageStudioModel(
  model: Sub2APIImageStudioModel,
  size?: string,
) {
  if (!size) return false;
  const supported = model.supported_sizes ?? [];
  return supported.length === 0 || supported.includes(size);
}

function normalizeImageStudioSizingKind(model: Sub2APIImageStudioModel) {
  const raw = (model.sizing_kind || "").trim().toLowerCase();
  if (raw === "fixed" || raw === "custom" || raw === "aspect_resolution") {
    return raw;
  }
  if (
    (model.supported_aspect_ratios?.length ?? 0) > 0 ||
    (model.supported_resolutions?.length ?? 0) > 0
  ) {
    return "aspect_resolution";
  }
  if ((model.supported_sizes?.length ?? 0) > 1) {
    return "custom";
  }
  if ((model.supported_sizes?.length ?? 0) === 1) return "fixed";
  return "aspect_resolution";
}

function imageStudioOutputCompressionApplies(
  compression: NonNullable<Sub2APIImageStudioModel["output_compression"]>,
  outputFormat?: string,
) {
  const formats = compression.formats ?? [];
  if (formats.length === 0) return true;
  const normalizedFormat = String(outputFormat || "")
    .trim()
    .toLowerCase();
  return formats
    .map((format) => format.trim().toLowerCase())
    .includes(normalizedFormat);
}

function qualityLabel(value: string) {
  switch (value) {
    case "auto":
      return "Auto";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    case "standard":
      return "Standard";
    default:
      return value;
  }
}

function backgroundLabel(value: string) {
  switch (value) {
    case "auto":
      return "Auto";
    case "opaque":
      return "不透明";
    case "transparent":
      return "透明";
    default:
      return value;
  }
}

export function ControlParamItem(props: {
  title: string;
  subTitle?: React.ReactNode;
  required?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx(styles["ctrl-param-item"], props.className)}>
      <div className={styles["ctrl-param-item-header"]}>
        <div className={styles["ctrl-param-item-title"]}>
          <div>
            {props.title}
            {props.required && <span style={{ color: "red" }}>*</span>}
          </div>
        </div>
      </div>
      {props.children}
      {props.subTitle && (
        <div className={styles["ctrl-param-item-sub-title"]}>
          {props.subTitle}
        </div>
      )}
    </div>
  );
}

export function ControlParam(props: {
  columns: any[];
  data: any;
  onChange: (field: string, val: any) => void;
}) {
  return (
    <>
      {props.columns?.map((item) => {
        let element: null | JSX.Element;
        switch (item.type) {
          case "textarea":
            element = (
              <ControlParamItem
                title={item.name}
                subTitle={item.sub}
                required={item.required}
              >
                <textarea
                  rows={item.rows || 3}
                  style={{ maxWidth: "100%", width: "100%", padding: "10px" }}
                  placeholder={item.placeholder}
                  onChange={(e) => {
                    props.onChange(item.value, e.currentTarget.value);
                  }}
                  value={props.data[item.value]}
                ></textarea>
              </ControlParamItem>
            );
            break;
          case "select":
            element = (
              <ControlParamItem
                title={item.name}
                subTitle={item.sub}
                required={item.required}
              >
                <Select
                  aria-label={item.name}
                  value={props.data[item.value]}
                  onChange={(e) => {
                    props.onChange(item.value, e.currentTarget.value);
                  }}
                >
                  {item.options.map((opt: any) => {
                    return (
                      <option value={opt.value} key={opt.value}>
                        {opt.name}
                      </option>
                    );
                  })}
                </Select>
              </ControlParamItem>
            );
            break;
          case "number":
            element = (
              <ControlParamItem
                title={item.name}
                subTitle={item.sub}
                required={item.required}
              >
                <input
                  aria-label={item.name}
                  type="number"
                  min={item.min}
                  max={item.max}
                  value={props.data[item.value] || 0}
                  onChange={(e) => {
                    props.onChange(item.value, parseInt(e.currentTarget.value));
                  }}
                />
              </ControlParamItem>
            );
            break;
          case "readonly":
            element = (
              <ControlParamItem
                title={item.name}
                subTitle={item.sub}
                required={item.required}
              >
                <input
                  aria-label={item.name}
                  type="text"
                  value={props.data[item.value] || item.default || ""}
                  readOnly
                  style={{ maxWidth: "100%", width: "100%" }}
                />
              </ControlParamItem>
            );
            break;
          default:
            element = (
              <ControlParamItem
                title={item.name}
                subTitle={item.sub}
                required={item.required}
              >
                <input
                  aria-label={item.name}
                  type="text"
                  value={props.data[item.value]}
                  style={{ maxWidth: "100%", width: "100%" }}
                  onChange={(e) => {
                    props.onChange(item.value, e.currentTarget.value);
                  }}
                />
              </ControlParamItem>
            );
        }
        return <div key={item.value}>{element}</div>;
      })}
    </>
  );
}

export const getModelParamBasicData = (
  columns: any[],
  data: any,
  clearText?: boolean,
) => {
  const newParams: any = {};
  columns.forEach((item: any) => {
    if (clearText && ["text", "textarea", "number"].includes(item.type)) {
      newParams[item.value] = item.default || "";
    } else {
      // @ts-ignore
      newParams[item.value] = data[item.value] || item.default || "";
    }
  });
  if (data?.template_id) {
    newParams.template_id = data.template_id;
  }
  return newParams;
};

export const normalizeModelParamData = (
  columns: any[],
  data: any,
  clearText?: boolean,
) => {
  const next = getModelParamBasicData(columns, data, clearText);
  columns.forEach((item: any) => {
    if (item.type !== "select") return;
    const options = item.options ?? [];
    if (!options.some((option: any) => option.value === next[item.value])) {
      next[item.value] =
        options.find((option: any) => option.value === item.default)?.value ||
        options[0]?.value ||
        "";
    }
  });
  return next;
};

export const getParams = (model: any, params: any) => {
  if (typeof model?.params === "function") {
    const directParams = model.params(params);
    if (Array.isArray(directParams) && directParams.length > 0) {
      return directParams;
    }
  }
  if (isSub2APIManagedImageStudio()) {
    return sub2APIImageStudioParams;
  }
  return models.find((m) => m.value === model.value)?.params(params) || [];
};

export function SdPanel() {
  const sdStore = useSdStore();
  const managedMode = isSub2APIManagedImageStudio();
  const managedWorkspace = useManagedWorkspaceStore();
  const managedBootstrap = managedWorkspace.bootstrap;
  const managedGroups = managedBootstrap?.models?.groups ?? [];
  const currentManagedGroup = getManagedWorkspaceCurrentGroup(managedBootstrap);
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const currentModel = sdStore.currentModel;
  const setCurrentModel = sdStore.setCurrentModel;
  const params = sdStore.currentParams;
  const setParams = sdStore.setCurrentParams;
  const modelOptions = useMemo<SdPanelModel[]>(() => {
    if (!managedMode) return models;
    return sdStore.sub2apiImageStudioModels.map((model) => ({
      ...toSub2APIImageStudioPanelModel(model),
      params: (data: any) => getSub2APIImageStudioParams(model, data),
    }));
  }, [managedMode, sdStore.sub2apiImageStudioModels]);
  const activeModel = useMemo(() => {
    return (
      modelOptions.find((model) => model.value === currentModel.value) ||
      modelOptions[0] ||
      currentModel
    );
  }, [currentModel, modelOptions]);
  const columns = useMemo(
    () => getParams?.(activeModel, params) as any[],
    [activeModel, params],
  );
  const managedBalance = managedBootstrap?.user?.balance;
  const managedBalanceLabel =
    typeof managedBalance === "number"
      ? `$${managedBalance.toFixed(2)}`
      : "正在同步";
  const activeSub2APIModel = activeModel.sub2apiModel as
    | Sub2APIImageStudioModel
    | undefined;
  const canUploadReferences =
    managedMode && canSub2APIImageStudioUseReferences(activeSub2APIModel);
  const referenceLimit =
    getSub2APIImageStudioReferenceLimit(activeSub2APIModel);

  useEffect(() => {
    if (managedMode) {
      void sdStore.fetchSub2APIImageStudioModels();
      void sdStore.fetchSub2APIImageStudioJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managedMode, currentManagedGroup?.id]);

  useEffect(() => {
    if (!managedMode || modelOptions.length === 0) return;
    if (activeModel.value !== currentModel.value) {
      setCurrentModel(activeModel);
    }
    const nextColumns = getParams(activeModel, params);
    const normalized = normalizeModelParamData(nextColumns, params);
    if (JSON.stringify(normalized) !== JSON.stringify(params)) {
      setParams(normalized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managedMode, modelOptions, activeModel.value, currentModel.value]);

  const handleValueChange = (field: string, val: any) => {
    const nextParams = {
      ...params,
      [field]: val,
    };
    setParams(
      normalizeModelParamData(getParams(activeModel, nextParams), nextParams),
    );
  };
  const handleModelChange = (model: any) => {
    setCurrentModel(model);
    setParams(normalizeModelParamData(getParams(model, params), params));
  };
  const switchManagedImageGroup = async (groupId: number) => {
    if (!Number.isFinite(groupId) || groupId <= 0) return;
    if (groupId === currentManagedGroup?.id) {
      setShowGroupSelector(false);
      return;
    }
    setShowGroupSelector(false);
    sdStore.beginSub2APIImageStudioGroupSwitch();
    const bootstrap = await managedWorkspace.switchGroup(groupId);
    if (!bootstrap) {
      showToast(managedWorkspace.error || "切换分组失败");
      return;
    }
    sdStore.resetSub2APIImageStudioForGroupSwitch();
    applyManagedWorkspaceModelsToStores(bootstrap);
    const models = await sdStore.fetchSub2APIImageStudioModels();
    await sdStore.fetchSub2APIImageStudioJobs();
    const group = getManagedWorkspaceCurrentGroup(bootstrap);
    showToast(
      models.length > 0
        ? `${group?.name ?? "分组"} · ${models.length} 个图片模型`
        : `${group?.name ?? "分组"} 暂无图片模型`,
    );
  };
  const uploadReferences = async (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!canUploadReferences || referenceLimit <= 0) {
      showToast("当前模型不支持引用图");
      return;
    }
    const remaining =
      referenceLimit - sdStore.sub2apiImageStudioReferences.length;
    for (const file of Array.from(files).slice(0, Math.max(remaining, 0))) {
      const reference = await sdStore.uploadSub2APIImageStudioReference(file);
      if (!reference) {
        showToast(
          sdStore.sub2apiImageStudioReferencesError || "引用图上传失败",
        );
        break;
      }
    }
    if (referenceInputRef.current) {
      referenceInputRef.current.value = "";
    }
  };

  return (
    <>
      {managedMode && (
        <ControlParamItem
          title="创作分组"
          subTitle={
            currentManagedGroup?.platform
              ? `协议 ${currentManagedGroup.platform}`
              : undefined
          }
        >
          <div className={styles["managed-group-row"]}>
            <IconButton
              text={currentManagedGroup?.name || "选择分组"}
              type="primary"
              shadow
              onClick={() => setShowGroupSelector(true)}
              disabled={managedWorkspace.switchingGroup}
            />
            <IconButton
              text={managedWorkspace.switchingGroup ? "切换中" : "切换"}
              shadow
              onClick={() => setShowGroupSelector(true)}
              disabled={managedWorkspace.switchingGroup}
            />
          </div>
          {managedWorkspace.error && (
            <div className={styles["managed-inline-error"]}>
              {managedWorkspace.error}
            </div>
          )}
          {showGroupSelector && (
            <Selector
              defaultSelectedValue={
                currentManagedGroup ? String(currentManagedGroup.id) : undefined
              }
              items={managedGroups.map((group) => ({
                title: group.name,
                subTitle: `${group.platform || "分组"} · 切换后读取图片模型`,
                value: String(group.id),
              }))}
              onClose={() => setShowGroupSelector(false)}
              onSelection={(selection) => {
                if (selection.length === 0) return;
                void switchManagedImageGroup(Number(selection[0]));
              }}
            />
          )}
        </ControlParamItem>
      )}
      {managedMode && (
        <ControlParamItem title="账户余额">
          <div className={styles["managed-balance"]}>{managedBalanceLabel}</div>
        </ControlParamItem>
      )}
      <ControlParamItem title={Locale.SdPanel.AIModel}>
        <div className={styles["ai-models"]}>
          {modelOptions.map((item) => {
            return (
              <IconButton
                text={item.name}
                key={item.value}
                type={currentModel.value == item.value ? "primary" : null}
                shadow
                onClick={() => handleModelChange(item)}
              />
            );
          })}
          {managedMode && sdStore.sub2apiImageStudioModelsLoading && (
            <span>加载中...</span>
          )}
          {managedMode && sdStore.sub2apiImageStudioModelsError && (
            <span className={styles["managed-inline-error"]}>
              {sdStore.sub2apiImageStudioModelsError}
            </span>
          )}
          {managedMode &&
            !sdStore.sub2apiImageStudioModelsLoading &&
            !sdStore.sub2apiImageStudioModelsError &&
            modelOptions.length === 0 && (
              <span className={styles["managed-inline-error"]}>
                当前分组暂无图片模型
              </span>
            )}
        </div>
      </ControlParamItem>
      {managedMode && canUploadReferences && (
        <ControlParamItem title="引用图">
          <input
            ref={referenceInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            style={{ display: "none" }}
            onChange={(event) => uploadReferences(event.currentTarget.files)}
          />
          <div className={styles["reference-upload"]}>
            <IconButton
              icon={
                sdStore.sub2apiImageStudioReferenceUploading ? (
                  <LoadingIcon />
                ) : (
                  <UploadIcon />
                )
              }
              text="上传引用图"
              onClick={() => referenceInputRef.current?.click()}
              shadow
              disabled={
                sdStore.sub2apiImageStudioReferences.length >= referenceLimit
              }
            />
            {sdStore.sub2apiImageStudioReferences.length > 0 && (
              <IconButton
                icon={<DeleteIcon />}
                text="清空"
                onClick={sdStore.clearSub2APIImageStudioReferences}
                shadow
              />
            )}
          </div>
          {sdStore.sub2apiImageStudioReferencesError && (
            <div className={styles["reference-error"]}>
              {sdStore.sub2apiImageStudioReferencesError}
            </div>
          )}
          <div className={styles["reference-list"]}>
            {sdStore.sub2apiImageStudioReferences.map((reference) => (
              <div className={styles["reference-item"]} key={reference.id}>
                <span title={reference.filename || reference.id}>
                  {reference.filename || reference.id}
                </span>
                <IconButton
                  icon={<DeleteIcon />}
                  aria="删除引用图"
                  onClick={() =>
                    void sdStore.deleteSub2APIImageStudioReference(reference.id)
                  }
                />
              </div>
            ))}
          </div>
        </ControlParamItem>
      )}
      <ControlParam
        columns={columns}
        data={params}
        onChange={handleValueChange}
      ></ControlParam>
    </>
  );
}
