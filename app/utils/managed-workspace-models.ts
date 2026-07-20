import { ServiceProvider } from "../constant";
import type { LLMModel } from "../client/api";
import type { ModelType } from "../store/config";
import { useAppConfig } from "../store/config";
import type { ChatSession } from "../store/chat";
import { useChatStore } from "../store/chat";
import {
  getManagedWorkspaceDefaultLLMModelForCurrentGroup,
  getManagedWorkspaceLLMModelsForCurrentGroup,
} from "../store/managed-workspace";
import type { ManagedWorkspaceBootstrap } from "../store/managed-workspace";

export type ManagedWorkspaceModelApplyResult = {
  model: string;
  providerName: string;
  models: ReturnType<typeof getManagedWorkspaceLLMModelsForCurrentGroup>;
};

export function applyManagedWorkspaceModelsToStores(
  bootstrap: ManagedWorkspaceBootstrap | undefined,
  options: {
    targetSession?: ChatSession;
    forceTargetSession?: boolean;
  } = {},
): ManagedWorkspaceModelApplyResult {
  const models = getManagedWorkspaceLLMModelsForCurrentGroup(bootstrap);
  const defaultModel =
    getManagedWorkspaceDefaultLLMModelForCurrentGroup(bootstrap);
  const configStore = useAppConfig.getState();
  const currentGlobalModel = configStore.modelConfig.model;
  const currentGlobalProvider =
    configStore.modelConfig.providerName || ServiceProvider.OpenAI;
  const currentAllowedModel = findManagedWorkspaceModel(
    models,
    currentGlobalModel,
    currentGlobalProvider,
  );
  const nextModel =
    options.forceTargetSession || !currentAllowedModel
      ? defaultModel
      : currentAllowedModel;

  configStore.update((config) => {
    config.models = models;
    config.customModels = "";
    if (nextModel) {
      config.modelConfig.model = nextModel.name as ModelType;
      config.modelConfig.providerName = nextModel.provider
        .providerName as ServiceProvider;
    }
    if (
      config.modelConfig.compressModel &&
      !findManagedWorkspaceModel(
        models,
        config.modelConfig.compressModel,
        config.modelConfig.compressProviderName,
      )
    ) {
      config.modelConfig.compressModel = "";
      config.modelConfig.compressProviderName = "";
    }
  });

  if (nextModel) {
    const chatStore = useChatStore.getState();
    const targetSessionID =
      options.targetSession?.id || chatStore.currentSession()?.id;

    chatStore.update((state) => {
      const session = state.sessions.find(
        (session) => session.id === targetSessionID,
      );
      if (!session) return;

      const sessionModel = session.mask.modelConfig.model;
      const sessionProvider =
        session.mask.modelConfig.providerName || ServiceProvider.OpenAI;
      const allowedSessionModel = findManagedWorkspaceModel(
        models,
        sessionModel,
        sessionProvider,
      );
      const replacementModel =
        options.forceTargetSession || !allowedSessionModel
          ? nextModel
          : allowedSessionModel;

      if (replacementModel) {
        session.mask.modelConfig.model = replacementModel.name as ModelType;
        session.mask.modelConfig.providerName = replacementModel.provider
          .providerName as ServiceProvider;
        session.mask.syncGlobalConfig = false;
      }

      if (
        session.mask.modelConfig.compressModel &&
        !findManagedWorkspaceModel(
          models,
          session.mask.modelConfig.compressModel,
          session.mask.modelConfig.compressProviderName,
        )
      ) {
        session.mask.modelConfig.compressModel = "";
        session.mask.modelConfig.compressProviderName = "";
      }
    });
  }

  return {
    model: nextModel?.name || "",
    providerName: nextModel?.provider?.providerName || "",
    models,
  };
}

function findManagedWorkspaceModel(
  models: LLMModel[],
  modelName?: string,
  providerName?: string,
) {
  if (!modelName) return undefined;
  const exact = models.find(
    (model) =>
      model.name === modelName && model.provider.providerName === providerName,
  );
  if (exact) return exact;

  const byName = models.filter((model) => model.name === modelName);
  return byName.length === 1 ? byName[0] : undefined;
}
