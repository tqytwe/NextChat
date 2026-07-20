import { ServiceProvider } from "../constant";
import type { ModelType } from "../store/config";
import { useAppConfig } from "../store/config";
import type { ChatSession } from "../store/chat";
import { useChatStore } from "../store/chat";
import {
  getManagedWorkspaceDefaultModelForCurrentGroup,
  getManagedWorkspaceLLMModelsForCurrentGroup,
} from "../store/managed-workspace";
import type { ManagedWorkspaceBootstrap } from "../store/managed-workspace";

export type ManagedWorkspaceModelApplyResult = {
  model: string;
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
    getManagedWorkspaceDefaultModelForCurrentGroup(bootstrap);
  const allowedModels = new Set(models.map((model) => model.name));
  const configStore = useAppConfig.getState();
  const currentGlobalModel = configStore.modelConfig.model;
  const nextModel =
    options.forceTargetSession || !allowedModels.has(currentGlobalModel)
      ? defaultModel
      : currentGlobalModel;

  configStore.update((config) => {
    config.models = models;
    config.customModels = "";
    if (nextModel) {
      config.modelConfig.model = nextModel as ModelType;
      config.modelConfig.providerName = ServiceProvider.OpenAI;
    }
    if (
      config.modelConfig.compressModel &&
      !allowedModels.has(config.modelConfig.compressModel)
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
      state.sessions.forEach((session) => {
        const isTargetSession = session.id === targetSessionID;
        const sessionModel = session.mask.modelConfig.model;
        const shouldReplaceModel =
          (options.forceTargetSession && isTargetSession) ||
          !allowedModels.has(sessionModel);

        if (shouldReplaceModel) {
          session.mask.modelConfig.model = nextModel as ModelType;
          session.mask.modelConfig.providerName = ServiceProvider.OpenAI;
          session.mask.syncGlobalConfig = false;
        } else if (allowedModels.has(sessionModel)) {
          session.mask.modelConfig.providerName = ServiceProvider.OpenAI;
        }

        if (
          session.mask.modelConfig.compressModel &&
          !allowedModels.has(session.mask.modelConfig.compressModel)
        ) {
          session.mask.modelConfig.compressModel = "";
          session.mask.modelConfig.compressProviderName = "";
        }
      });
    });
  }

  return { model: nextModel, models };
}
