import { useMemo } from "react";
import { useAccessStore, useAppConfig } from "../store";
import { collectModelsWithDefaultModel } from "./model";
import { getClientConfig } from "../config/client";
import type { LLMModel } from "../client/api";

type ModelCollectionConfig = {
  models: readonly LLMModel[];
  customModels: string;
  modelConfig: {
    model?: string;
  };
};

type ModelCollectionAccess = {
  customModels?: string;
  defaultModel?: string;
};

export function collectVisibleModelsForWorkspace(
  configStore: ModelCollectionConfig,
  accessStore: ModelCollectionAccess,
  managedMode: boolean,
) {
  if (managedMode) {
    return collectModelsWithDefaultModel(
      configStore.models,
      "",
      configStore.modelConfig.model ?? "",
    );
  }

  return collectModelsWithDefaultModel(
    configStore.models,
    [configStore.customModels, accessStore.customModels].join(","),
    accessStore.defaultModel ?? "",
  );
}

export function useAllModels() {
  const accessStore = useAccessStore();
  const configStore = useAppConfig();
  const managedMode =
    !!getClientConfig()?.sub2apiManagedMode || !!accessStore.sub2apiManagedMode;
  const models = useMemo(() => {
    return collectVisibleModelsForWorkspace(
      configStore,
      accessStore,
      managedMode,
    );
  }, [
    accessStore.customModels,
    accessStore.defaultModel,
    accessStore.sub2apiManagedMode,
    configStore.customModels,
    configStore.modelConfig.model,
    configStore.models,
    managedMode,
  ]);

  return models;
}
