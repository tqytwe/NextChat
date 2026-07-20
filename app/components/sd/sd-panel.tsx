import styles from "./sd-panel.module.scss";
import React, { useEffect, useMemo, useRef } from "react";
import { Select } from "@/app/components/ui-lib";
import { IconButton } from "@/app/components/button";
import Locale from "@/app/locales";
import {
  isSub2APIManagedImageStudio,
  toSub2APIImageStudioPanelModel,
  useSdStore,
} from "@/app/store/sd";
import clsx from "clsx";
import UploadIcon from "@/app/icons/upload.svg";
import DeleteIcon from "@/app/icons/clear.svg";
import LoadingIcon from "@/app/icons/three-dots.svg";
import { showToast } from "@/app/components/ui-lib";

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
  return newParams;
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
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const currentModel = sdStore.currentModel;
  const setCurrentModel = sdStore.setCurrentModel;
  const params = sdStore.currentParams;
  const setParams = sdStore.setCurrentParams;
  const modelOptions = useMemo(() => {
    if (!managedMode) return models;
    return sdStore.sub2apiImageStudioModels.map(toSub2APIImageStudioPanelModel);
  }, [managedMode, sdStore.sub2apiImageStudioModels]);

  useEffect(() => {
    if (managedMode) {
      void sdStore.fetchSub2APIImageStudioModels();
      if (!params.size) {
        setParams(getModelParamBasicData(sub2APIImageStudioParams, params));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managedMode]);

  const handleValueChange = (field: string, val: any) => {
    setParams({
      ...params,
      [field]: val,
    });
  };
  const handleModelChange = (model: any) => {
    setCurrentModel(model);
    setParams(getModelParamBasicData(getParams(model, params), params));
  };
  const uploadReferences = async (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files).slice(0, 4)) {
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
            <span>{sdStore.sub2apiImageStudioModelsError}</span>
          )}
        </div>
      </ControlParamItem>
      {managedMode && (
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
        columns={getParams?.(currentModel, params) as any[]}
        data={params}
        onChange={handleValueChange}
      ></ControlParam>
    </>
  );
}
