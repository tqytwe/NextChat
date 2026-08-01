import {
  Stability,
  StoreKey,
  ACCESS_CODE_PREFIX,
  ApiPath,
} from "@/app/constant";
import { getBearerToken } from "@/app/client/api";
import { createPersistStore } from "@/app/utils/store";
import { nanoid } from "nanoid";
import { uploadImage, base64Image2Blob } from "@/app/utils/chat";
import { models, getModelParamBasicData } from "@/app/components/sd/sd-panel";
import { useAccessStore } from "./access";

const defaultModel = {
  name: models[0].name,
  value: models[0].value,
};

const defaultParams = getModelParamBasicData(models[0].params({}), {});

type SdAccountState = {
  currentId: number;
  draw: any[];
  currentModel: typeof defaultModel;
  currentParams: any;
};

const DEFAULT_SD_STATE: SdAccountState & {
  activeAccountId: string;
  accounts: Record<string, SdAccountState>;
} = {
  currentId: 0,
  draw: [],
  currentModel: defaultModel,
  currentParams: defaultParams,
  activeAccountId: "",
  accounts: {} as Record<string, SdAccountState>,
};

function emptySdAccount(): SdAccountState {
  return {
    currentId: 0,
    draw: [],
    currentModel: defaultModel,
    currentParams: defaultParams,
  };
}

export const useSdStore = createPersistStore<
  {
    currentId: number;
    draw: any[];
    currentModel: typeof defaultModel;
    currentParams: any;
    activeAccountId: string;
    accounts: Record<string, SdAccountState>;
  },
  {
    activateAccount: (userId: number | string) => void;
    clearActiveAccount: () => void;
    clearAllAccounts: () => void;
    getNextId: () => number;
    sendTask: (data: any, okCall?: Function) => void;
    updateDraw: (draw: any) => void;
    setCurrentModel: (model: any) => void;
    setCurrentParams: (data: any) => void;
  }
>(
  DEFAULT_SD_STATE,
  (set, _get) => {
    function get() {
      return {
        ..._get(),
        ...methods,
      };
    }

    function commitAccount(patch: Partial<SdAccountState>) {
      const state = _get();
      const next = {
        currentId: patch.currentId ?? state.currentId,
        draw: patch.draw ?? state.draw,
        currentModel: patch.currentModel ?? state.currentModel,
        currentParams: patch.currentParams ?? state.currentParams,
      };
      set({
        ...next,
        accounts: state.activeAccountId
          ? { ...state.accounts, [state.activeAccountId]: next }
          : state.accounts,
      });
    }

    const methods = {
      activateAccount(userId: number | string) {
        const accountId = String(userId || "").trim();
        if (!accountId || accountId === _get().activeAccountId) return;

        const state = _get();
        const accounts = { ...state.accounts };
        if (state.activeAccountId) {
          accounts[state.activeAccountId] = {
            currentId: state.currentId,
            draw: state.draw,
            currentModel: state.currentModel,
            currentParams: state.currentParams,
          };
        }
        const hasLegacy = !state.activeAccountId && state.draw.length > 0;
        const next =
          accounts[accountId] ||
          (hasLegacy
            ? {
                currentId: state.currentId,
                draw: state.draw,
                currentModel: state.currentModel,
                currentParams: state.currentParams,
              }
            : emptySdAccount());
        accounts[accountId] = next;
        set({ ...next, activeAccountId: accountId, accounts });
      },

      clearActiveAccount() {
        const state = _get();
        const empty = emptySdAccount();
        set({
          ...empty,
          accounts: state.activeAccountId
            ? { ...state.accounts, [state.activeAccountId]: empty }
            : state.accounts,
        });
      },

      clearAllAccounts() {
        set({
          ...emptySdAccount(),
          activeAccountId: "",
          accounts: {},
        });
      },

      getNextId() {
        const id = ++_get().currentId;
        commitAccount({ currentId: id });
        return id;
      },
      sendTask(data: any, okCall?: Function) {
        data = { ...data, id: nanoid(), status: "running" };
        commitAccount({ draw: [data, ..._get().draw] });
        this.getNextId();
        this.stabilityRequestCall(data);
        okCall?.();
      },
      stabilityRequestCall(data: any) {
        const accessStore = useAccessStore.getState();
        let prefix: string = ApiPath.Stability as string;
        let bearerToken = "";
        if (accessStore.useCustomConfig) {
          prefix = accessStore.stabilityUrl || (ApiPath.Stability as string);
          bearerToken = getBearerToken(accessStore.stabilityApiKey);
        }
        if (!bearerToken && accessStore.enabledAccessControl()) {
          bearerToken = getBearerToken(
            ACCESS_CODE_PREFIX + accessStore.accessCode,
          );
        }
        const headers = {
          Accept: "application/json",
          Authorization: bearerToken,
        };
        const path = `${prefix}/${Stability.GeneratePath}/${data.model}`;
        const formData = new FormData();
        for (let paramsKey in data.params) {
          formData.append(paramsKey, data.params[paramsKey]);
        }
        fetch(path, {
          method: "POST",
          headers,
          body: formData,
        })
          .then((response) => response.json())
          .then((resData) => {
            if (resData.errors && resData.errors.length > 0) {
              this.updateDraw({
                ...data,
                status: "error",
                error: resData.errors[0],
              });
              this.getNextId();
              return;
            }
            const self = this;
            if (resData.finish_reason === "SUCCESS") {
              uploadImage(base64Image2Blob(resData.image, "image/png"))
                .then((img_data) => {
                  console.debug("uploadImage success", img_data, self);
                  self.updateDraw({
                    ...data,
                    status: "success",
                    img_data,
                  });
                })
                .catch((e) => {
                  console.error("uploadImage error", e);
                  self.updateDraw({
                    ...data,
                    status: "error",
                    error: JSON.stringify(e),
                  });
                });
            } else {
              self.updateDraw({
                ...data,
                status: "error",
                error: JSON.stringify(resData),
              });
            }
            this.getNextId();
          })
          .catch((error) => {
            this.updateDraw({ ...data, status: "error", error: error.message });
            console.error("Error:", error);
            this.getNextId();
          });
      },
      updateDraw(_draw: any) {
        const draw = [...(_get().draw || [])];
        draw.some((item, index) => {
          if (item.id === _draw.id) {
            draw[index] = _draw;
            commitAccount({ draw });
            return true;
          }
        });
      },
      setCurrentModel(model: any) {
        commitAccount({ currentModel: model });
      },
      setCurrentParams(data: any) {
        commitAccount({
          currentParams: data,
        });
      },
    };

    return methods;
  },
  {
    name: StoreKey.SdList,
    version: 3,
    migrate: (persistedState: any, _persistedVersion: number) => ({
      ...DEFAULT_SD_STATE,
      ...(persistedState || {}),
      accounts: persistedState?.accounts || {},
      activeAccountId: persistedState?.activeAccountId || "",
    }),
  },
);
