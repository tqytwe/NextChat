import { StoreKey } from "../constant";
import { normalizeContentWorkbenchShot } from "../client/content-workbench";
import type {
  ContentWorkbenchBrandControls,
  ContentWorkbenchShotPlan,
} from "../client/content-workbench";
import { createPersistStore } from "../utils/store";

export type ManagedMobileChatRole = "user" | "assistant" | "system";

export interface ManagedMobileChatMessage {
  id: string;
  role: ManagedMobileChatRole;
  content: string;
  imageUrls?: string[];
  createdAt: number;
  updatedAt?: number;
  requestId?: string;
  status?: "sending" | "streaming" | "done" | "error" | "cancelled";
  error?: string;
}

export interface ManagedMobileChatSession {
  id: string;
  title: string;
  model: string;
  agentId?: string;
  groupId?: number;
  pinned?: boolean;
  messages: ManagedMobileChatMessage[];
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export type ContentKitAssetKind = string;
export type ContentKitTaskStatus =
  | "idle"
  | "queued"
  | "reconciling"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type ContentKitRunStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "partial"
  | "cancelled";

export interface ManagedMobileContentKitRun {
  id: string;
  presetId: string;
  status: ContentKitRunStatus;
  total: number;
  createdAt: number;
  updatedAt: number;
}

export interface ManagedMobileContentKitAsset {
  id: string;
  projectId?: string;
  runId: string;
  shotId: string;
  scene?: string;
  kind: ContentKitAssetKind;
  label: string;
  purpose?: string;
  aspect?: "square" | "portrait" | "landscape" | "custom";
  copyFields?: string[];
  prompt: string;
  size: string;
  variant: number;
  requestId?: string;
  taskId?: string;
  actualCost?: number;
  billingRecordId?: string;
  billingStatus?: "pending" | "captured" | "released";
  status: ContentKitTaskStatus;
  imageUrl?: string;
  fileName?: string;
  error?: string;
  selected?: boolean;
  tags?: string[];
  updatedAt: number;
}

export interface ManagedMobileContentKit {
  id: string;
  accountId: string;
  version: number;
  scene?: string;
  productName: string;
  sellingPoints: string;
  parameters?: string;
  audience: string;
  platform: string;
  tone: string;
  brandControls?: ContentWorkbenchBrandControls;
  model: string;
  /** The exact image-purpose group that authorized this local project. */
  imageGroupId?: number;
  referenceImages: string[];
  shotPlan?: ContentWorkbenchShotPlan[];
  assets: ManagedMobileContentKitAsset[];
  presetId?: string;
  runs?: ManagedMobileContentKitRun[];
  activeRunId?: string;
  copyStatus: ContentKitTaskStatus;
  copyTaskId?: string;
  copy?: string;
  copyError?: string;
  createdAt: number;
  updatedAt: number;
}

function newId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function trimSessions(sessions: ManagedMobileChatSession[]) {
  return sessions
    .slice()
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, 80);
}

type MobileAccountState = {
  chatSessions: ManagedMobileChatSession[];
  currentChatId: string;
  contentKits: ManagedMobileContentKit[];
};

type ManagedMobileState = MobileAccountState & {
  activeAccountId: string;
  accounts: Record<string, MobileAccountState>;
};

const DEFAULT_MOBILE_STATE: ManagedMobileState = {
  chatSessions: [] as ManagedMobileChatSession[],
  currentChatId: "",
  contentKits: [] as ManagedMobileContentKit[],
  activeAccountId: "",
  accounts: {} as Record<string, MobileAccountState>,
};

function emptyMobileAccount(): MobileAccountState {
  return { chatSessions: [], currentChatId: "", contentKits: [] };
}

function hasLegacyMobileData(state: ManagedMobileState) {
  return state.chatSessions.length > 0 || state.contentKits.length > 0;
}

function migrateContentKit(kit: any): ManagedMobileContentKit {
  const fallbackRunId =
    kit.activeRunId || `content-kit-run-${kit.id || newId("legacy")}`;
  const shotPlan: ContentWorkbenchShotPlan[] | undefined = Array.isArray(
    kit.shotPlan,
  )
    ? kit.shotPlan.map((shot: any) => normalizeContentWorkbenchShot(shot))
    : undefined;
  const shotByID = new Map<string, ContentWorkbenchShotPlan>(
    (shotPlan || []).map((shot): [string, ContentWorkbenchShotPlan] => [
      shot.id,
      shot,
    ]),
  );
  const assets = (kit.assets || []).map((asset: any, index: number) => {
    const shotId = asset.shotId || asset.kind || `shot-${index + 1}`;
    const shot = shotByID.get(shotId);
    return {
      ...asset,
      id: asset.id || `${fallbackRunId}-output-${index + 1}`,
      projectId: asset.projectId || kit.id || "",
      runId: asset.runId || fallbackRunId,
      shotId,
      scene: asset.scene || kit.scene || kit.presetId || "custom",
      purpose: asset.purpose || shot?.purpose,
      aspect: asset.aspect || shot?.aspect,
      copyFields: Array.isArray(asset.copyFields)
        ? asset.copyFields
        : shot?.copyFields,
      variant: Number(asset.variant || 1),
      requestId: asset.requestId || newId("content-kit-output"),
      billingStatus: asset.billingStatus || "pending",
      // A request left in flight cannot be safely resent after process death:
      // retain it for manual result reconciliation instead of duplicating a
      // potentially billable image request.
      status:
        asset.status === "running" ? "reconciling" : asset.status || "idle",
      tags: Array.isArray(asset.tags) ? asset.tags : [],
      updatedAt: Number(asset.updatedAt || kit.updatedAt || Date.now()),
    };
  });
  const runs =
    Array.isArray(kit.runs) && kit.runs.length
      ? kit.runs.map((run: any) => ({
          ...run,
          status: run.status === "running" ? "queued" : run.status || "queued",
          total: Number(
            run.total ||
              assets.filter((asset: any) => asset.runId === run.id).length,
          ),
          createdAt: Number(run.createdAt || kit.createdAt || Date.now()),
          updatedAt: Number(run.updatedAt || kit.updatedAt || Date.now()),
        }))
      : [
          {
            id: fallbackRunId,
            presetId: kit.presetId || "legacy",
            status: assets.some((asset: any) => asset.status === "failed")
              ? "partial"
              : "completed",
            total: assets.length,
            createdAt: Number(kit.createdAt || Date.now()),
            updatedAt: Number(kit.updatedAt || kit.createdAt || Date.now()),
          },
        ];
  return {
    ...kit,
    version: Number(kit.version || 1),
    scene:
      kit.scene ||
      (kit.presetId === "campaign"
        ? "brand"
        : kit.presetId === "quick"
        ? "social"
        : kit.presetId || "custom"),
    parameters: String(kit.parameters || ""),
    presetId: kit.presetId || "legacy",
    activeRunId: kit.activeRunId || fallbackRunId,
    // Older projects predate group-pinned image sessions. Keep the missing
    // value missing so generation can fail closed instead of borrowing the
    // user's current chat or unrelated image group.
    imageGroupId:
      Number.isSafeInteger(Number(kit.imageGroupId)) &&
      Number(kit.imageGroupId) > 0
        ? Number(kit.imageGroupId)
        : undefined,
    shotPlan,
    assets,
    runs,
  } as ManagedMobileContentKit;
}

export const useManagedMobileAppStore = createPersistStore<
  typeof DEFAULT_MOBILE_STATE,
  {
    activateAccount: (userId: number | string) => void;
    clearActiveAccount: () => void;
    clearAllAccounts: () => void;
    ensureChatSession: (model: string, groupId?: number) => string;
    createChatSession: (model: string, groupId?: number) => string;
    setCurrentChatId: (id: string) => void;
    removeChatSession: (id: string) => void;
    renameChatSession: (id: string, title: string) => void;
    togglePinChatSession: (id: string) => void;
    clearChatSession: (id: string) => void;
    addChatMessage: (
      sessionId: string,
      message: Omit<ManagedMobileChatMessage, "id" | "createdAt"> &
        Partial<Pick<ManagedMobileChatMessage, "id" | "createdAt">>,
    ) => string;
    updateChatMessage: (
      sessionId: string,
      messageId: string,
      patch: Partial<ManagedMobileChatMessage>,
    ) => void;
    removeChatMessage: (sessionId: string, messageId: string) => void;
    updateChatSession: (
      sessionId: string,
      patch: Partial<ManagedMobileChatSession>,
    ) => void;
    clearChatError: (sessionId: string) => void;
    createContentKit: (
      input: Omit<
        ManagedMobileContentKit,
        "id" | "accountId" | "version" | "createdAt" | "updatedAt"
      >,
    ) => string;
    updateContentKit: (
      id: string,
      patch: Partial<ManagedMobileContentKit>,
    ) => void;
    removeContentKit: (id: string) => void;
  }
>(
  DEFAULT_MOBILE_STATE,
  (set, _get) => {
    function commitAccount(patch: Partial<MobileAccountState>) {
      const state = _get();
      const next = {
        chatSessions: patch.chatSessions ?? state.chatSessions,
        currentChatId: patch.currentChatId ?? state.currentChatId,
        contentKits: patch.contentKits ?? state.contentKits,
      };
      set({
        ...next,
        accounts: state.activeAccountId
          ? { ...state.accounts, [state.activeAccountId]: next }
          : state.accounts,
      });
    }

    function updateSession(
      sessionId: string,
      updater: (session: ManagedMobileChatSession) => void,
    ) {
      const sessions = _get().chatSessions.slice();
      const index = sessions.findIndex((session) => session.id === sessionId);
      if (index < 0) return;
      const session = {
        ...sessions[index],
        messages: sessions[index].messages.slice(),
      };
      updater(session);
      session.updatedAt = Date.now();
      sessions[index] = session;
      commitAccount({ chatSessions: trimSessions(sessions) });
    }

    const methods = {
      activateAccount(userId: number | string) {
        const accountId = String(userId || "").trim();
        if (!accountId || accountId === _get().activeAccountId) return;

        const state = _get();
        const accounts = { ...state.accounts };
        if (state.activeAccountId) {
          accounts[state.activeAccountId] = {
            chatSessions: state.chatSessions,
            currentChatId: state.currentChatId,
            contentKits: state.contentKits,
          };
        }

        // Attribute pre-v2 data to the first authenticated account after upgrade.
        const legacy =
          !state.activeAccountId && hasLegacyMobileData(state)
            ? {
                chatSessions: state.chatSessions,
                currentChatId: state.currentChatId,
                contentKits: state.contentKits,
              }
            : null;
        const saved = accounts[accountId] || legacy;
        const next = saved
          ? {
              ...emptyMobileAccount(),
              ...saved,
              contentKits: saved.contentKits || [],
            }
          : emptyMobileAccount();
        accounts[accountId] = next;
        set({ ...next, activeAccountId: accountId, accounts });
      },

      clearActiveAccount() {
        const state = _get();
        const empty = emptyMobileAccount();
        set({
          ...empty,
          accounts: state.activeAccountId
            ? { ...state.accounts, [state.activeAccountId]: empty }
            : state.accounts,
        });
      },

      clearAllAccounts() {
        set({
          ...emptyMobileAccount(),
          activeAccountId: "",
          accounts: {},
        });
      },

      ensureChatSession(model: string, groupId?: number) {
        const current = _get().chatSessions.find(
          (session) => session.id === _get().currentChatId,
        );
        if (current) return current.id;
        return methods.createChatSession(model, groupId);
      },

      createChatSession(model: string, groupId?: number) {
        const now = Date.now();
        const id = newId("chat");
        const session: ManagedMobileChatSession = {
          id,
          title: "",
          model,
          groupId,
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        commitAccount({
          chatSessions: [session, ...trimSessions(_get().chatSessions)],
          currentChatId: id,
        });
        return id;
      },

      setCurrentChatId(id: string) {
        commitAccount({ currentChatId: id });
      },

      removeChatSession(id: string) {
        const sessions = _get().chatSessions.filter(
          (session) => session.id !== id,
        );
        commitAccount({
          chatSessions: sessions,
          currentChatId:
            _get().currentChatId === id
              ? sessions[0]?.id || ""
              : _get().currentChatId,
        });
      },

      renameChatSession(id: string, title: string) {
        updateSession(id, (session) => {
          session.title = title.trim();
        });
      },

      togglePinChatSession(id: string) {
        updateSession(id, (session) => {
          session.pinned = !session.pinned;
        });
      },

      clearChatSession(id: string) {
        updateSession(id, (session) => {
          session.messages = [];
          session.error = "";
          session.title = "";
        });
      },

      addChatMessage(
        sessionId: string,
        message: Omit<ManagedMobileChatMessage, "id" | "createdAt"> &
          Partial<Pick<ManagedMobileChatMessage, "id" | "createdAt">>,
      ) {
        const id = message.id || newId("message");
        const createdAt = message.createdAt || Date.now();
        updateSession(sessionId, (session) => {
          session.messages.push({
            ...message,
            id,
            createdAt,
          });
          if (!session.title && message.role === "user") {
            session.title =
              message.content.trim().slice(0, 28) ||
              (message.imageUrls?.length ? "图片对话" : "");
          }
          session.error = "";
        });
        return id;
      },

      updateChatMessage(
        sessionId: string,
        messageId: string,
        patch: Partial<ManagedMobileChatMessage>,
      ) {
        updateSession(sessionId, (session) => {
          const index = session.messages.findIndex(
            (message) => message.id === messageId,
          );
          if (index < 0) return;
          session.messages[index] = {
            ...session.messages[index],
            ...patch,
            updatedAt: Date.now(),
          };
        });
      },

      removeChatMessage(sessionId: string, messageId: string) {
        updateSession(sessionId, (session) => {
          session.messages = session.messages.filter(
            (message) => message.id !== messageId,
          );
          if (session.error) session.error = "";
        });
      },

      updateChatSession(
        sessionId: string,
        patch: Partial<ManagedMobileChatSession>,
      ) {
        updateSession(sessionId, (session) => {
          Object.assign(session, patch);
        });
      },

      clearChatError(sessionId: string) {
        updateSession(sessionId, (session) => {
          session.error = "";
        });
      },

      createContentKit(
        input: Omit<
          ManagedMobileContentKit,
          "id" | "accountId" | "version" | "createdAt" | "updatedAt"
        >,
      ) {
        const state = _get();
        const now = Date.now();
        const id = newId("content-kit");
        commitAccount({
          contentKits: [
            {
              ...input,
              assets: input.assets.map((asset) => ({
                ...asset,
                projectId: asset.projectId || id,
              })),
              id,
              accountId: state.activeAccountId,
              version: 1,
              createdAt: now,
              updatedAt: now,
            },
            ...state.contentKits,
          ],
        });
        return id;
      },

      updateContentKit(id: string, patch: Partial<ManagedMobileContentKit>) {
        commitAccount({
          contentKits: _get().contentKits.map((kit) =>
            kit.id === id
              ? {
                  ...kit,
                  ...patch,
                  version: (kit.version || 0) + 1,
                  updatedAt: Date.now(),
                }
              : kit,
          ),
        });
      },

      removeContentKit(id: string) {
        commitAccount({
          contentKits: _get().contentKits.filter((kit) => kit.id !== id),
        });
      },
    };

    return methods;
  },
  {
    name: StoreKey.ManagedMobileApp,
    version: 8,
    migrate: (persistedState: any, _persistedVersion: number) => ({
      ...DEFAULT_MOBILE_STATE,
      ...(persistedState || {}),
      contentKits: (persistedState?.contentKits || []).map(migrateContentKit),
      accounts: Object.fromEntries(
        Object.entries(persistedState?.accounts || {}).map(
          ([id, account]: any) => [
            id,
            {
              ...emptyMobileAccount(),
              ...account,
              contentKits: (account?.contentKits || []).map(migrateContentKit),
            },
          ],
        ),
      ),
      activeAccountId: persistedState?.activeAccountId || "",
    }),
  },
);
