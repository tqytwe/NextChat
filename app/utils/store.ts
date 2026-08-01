import { create } from "zustand";
import { combine, persist, createJSONStorage } from "zustand/middleware";
import { Updater } from "../typing";
import { deepClone } from "./clone";
import { indexedDBStorage } from "@/app/utils/indexedDB-storage";

type SecondParam<T> = T extends (
  _f: infer _F,
  _s: infer S,
  ...args: infer _U
) => any
  ? S
  : never;

type MakeUpdater<T> = {
  lastUpdateTime: number;
  _hasHydrated: boolean;
  _persistenceBlocked: boolean;

  markUpdate: () => void;
  update: Updater<T>;
  setHasHydrated: (state: boolean) => void;
  setPersistenceBlocked: (state: boolean) => void;
};

export const PERSISTENCE_SCHEMA_BLOCKED_EVENT =
  "nextchat-persistence-schema-blocked";

export class UnsupportedPersistenceSchemaError extends Error {
  constructor(
    readonly storeName: string,
    readonly persistedVersion: number,
    readonly supportedVersion: number,
  ) {
    super(
      `Stored ${storeName} schema v${persistedVersion} is newer than supported v${supportedVersion}`,
    );
    this.name = "UnsupportedPersistenceSchemaError";
  }
}

export function assertSupportedPersistenceSchema(
  storeName: string,
  persistedVersion: number,
  supportedVersion: number,
  hasMigration: boolean,
) {
  if (persistedVersion === supportedVersion) return;
  if (persistedVersion < supportedVersion && hasMigration) return;
  throw new UnsupportedPersistenceSchemaError(
    storeName,
    persistedVersion,
    supportedVersion,
  );
}

function reportPersistenceBlocked(error: unknown) {
  if (
    !(error instanceof UnsupportedPersistenceSchemaError) ||
    typeof window === "undefined"
  ) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(PERSISTENCE_SCHEMA_BLOCKED_EVENT, {
      detail: {
        store: error.storeName,
        persistedVersion: error.persistedVersion,
        supportedVersion: error.supportedVersion,
      },
    }),
  );
}

type SetStoreState<T> = (
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: boolean | undefined,
) => void;

export function createPersistStore<T extends object, M>(
  state: T,
  methods: (
    set: SetStoreState<T & MakeUpdater<T>>,
    get: () => T & MakeUpdater<T>,
  ) => M,
  persistOptions: SecondParam<typeof persist<T & M & MakeUpdater<T>>>,
) {
  persistOptions.storage = createJSONStorage(() => indexedDBStorage);
  const configuredVersion = Number(persistOptions.version || 0);
  const originalMigrate = persistOptions.migrate;
  persistOptions.migrate = (persistedState: unknown, persistedVersion: number) => {
    assertSupportedPersistenceSchema(
      persistOptions.name,
      persistedVersion,
      configuredVersion,
      Boolean(originalMigrate),
    );
    if (!originalMigrate) return persistedState as any;
    const backupKey = `${persistOptions.name}:backup:v${persistedVersion}:${Date.now()}`;
    const snapshot = JSON.stringify({
      state: persistedState,
      version: persistedVersion,
    });
    return indexedDBStorage
      .backupItem(backupKey, snapshot)
      .then(() => originalMigrate(persistedState as any, persistedVersion));
  };
  const oldOnRehydrateStorage = persistOptions?.onRehydrateStorage;
  persistOptions.onRehydrateStorage = (state) => {
    const afterRehydrate = oldOnRehydrateStorage?.(state);
    return (persistedState, error) => {
      if (typeof afterRehydrate === "function") {
        afterRehydrate(persistedState, error);
      }
      if (error) {
        reportPersistenceBlocked(error);
        state.setPersistenceBlocked(true);
      }
      state.setHasHydrated(true);
    };
  };

  return create(
    persist(
      combine(
        {
          ...state,
          lastUpdateTime: 0,
          _hasHydrated: false,
          _persistenceBlocked: false,
        },
        (set, get) => {
          return {
            ...methods(set, get as any),

            markUpdate() {
              set({ lastUpdateTime: Date.now() } as Partial<
                T & M & MakeUpdater<T>
              >);
            },
            update(updater) {
              const state = deepClone(get());
              updater(state);
              set({
                ...state,
                lastUpdateTime: Date.now(),
              });
            },
            setHasHydrated: (state: boolean) => {
              set({ _hasHydrated: state } as Partial<T & M & MakeUpdater<T>>);
            },
            setPersistenceBlocked: (state: boolean) => {
              set({ _persistenceBlocked: state } as Partial<
                T & M & MakeUpdater<T>
              >);
            },
          } as M & MakeUpdater<T>;
        },
      ),
      persistOptions as any,
    ),
  );
}
