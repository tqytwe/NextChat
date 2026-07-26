import { StoreKey } from "../constant";
import { createPersistStore } from "../utils/store";

export type ManagedMobileChatRole = "user" | "assistant" | "system";

export interface ManagedMobileChatMessage {
  id: string;
  role: ManagedMobileChatRole;
  content: string;
  imageUrls?: string[];
  createdAt: number;
  updatedAt?: number;
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

const DEFAULT_MOBILE_STATE = {
  chatSessions: [] as ManagedMobileChatSession[],
  currentChatId: "",
};

export const useManagedMobileAppStore = createPersistStore<
  typeof DEFAULT_MOBILE_STATE,
  {
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
  }
>(
  DEFAULT_MOBILE_STATE,
  (set, _get) => {
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
      set({ chatSessions: trimSessions(sessions) });
    }

    const methods = {
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
        set({
          chatSessions: [session, ...trimSessions(_get().chatSessions)],
          currentChatId: id,
        });
        return id;
      },

      setCurrentChatId(id: string) {
        set({ currentChatId: id });
      },

      removeChatSession(id: string) {
        const sessions = _get().chatSessions.filter(
          (session) => session.id !== id,
        );
        set({
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
    };

    return methods;
  },
  {
    name: StoreKey.ManagedMobileApp,
    version: 1,
  },
);
