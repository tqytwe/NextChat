import { describe, expect, test } from "@jest/globals";

import {
  UnsupportedPersistenceSchemaError,
  assertSupportedPersistenceSchema,
} from "../app/utils/store";

describe("persisted mobile schema safety", () => {
  test("rejects a newer stored schema instead of allowing a downgrade write", () => {
    expect(() =>
      assertSupportedPersistenceSchema(
        "nextchat-managed-mobile-app-store",
        7,
        6,
        true,
      ),
    ).toThrow(UnsupportedPersistenceSchemaError);
  });

  test("requires an explicit migration before reading a different schema", () => {
    expect(() =>
      assertSupportedPersistenceSchema("sd-list", 1, 3, false),
    ).toThrow(UnsupportedPersistenceSchemaError);
  });

  test("accepts an older schema only when the store supplies a migration", () => {
    expect(() =>
      assertSupportedPersistenceSchema("nextchat-managed-store", 3, 4, true),
    ).not.toThrow();
  });

  test("accepts the current schema without requiring a no-op migration", () => {
    expect(() =>
      assertSupportedPersistenceSchema("sync-store", 1.2, 1.2, false),
    ).not.toThrow();
  });
});
