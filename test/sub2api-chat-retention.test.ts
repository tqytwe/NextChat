import { pruneExpiredSessions } from "../app/store/chat";
import { jest } from "@jest/globals";

describe("Sub2API managed chat retention", () => {
  const now = new Date("2026-07-20T04:00:00.000Z").getTime();
  const day = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("keeps local chat sessions updated within seven days", () => {
    const state = {
      sessions: [
        { id: "fresh", lastUpdate: now - 2 * day },
        { id: "boundary", lastUpdate: now - 7 * day },
        { id: "expired", lastUpdate: now - 8 * day },
      ],
      currentSessionIndex: 2,
      lastInput: "",
    } as any;

    const pruned = pruneExpiredSessions(state);

    expect(pruned.sessions.map((session: any) => session.id)).toEqual([
      "fresh",
      "boundary",
    ]);
    expect(pruned.currentSessionIndex).toBe(1);
  });

  test("creates an empty session when every local chat session is expired", () => {
    const state = {
      sessions: [{ id: "expired", lastUpdate: now - 8 * day }],
      currentSessionIndex: 0,
      lastInput: "",
    } as any;

    const pruned = pruneExpiredSessions(state);

    expect(pruned.sessions).toHaveLength(1);
    expect(pruned.sessions[0].id).not.toBe("expired");
    expect(pruned.sessions[0].lastUpdate).toBe(now);
    expect(pruned.currentSessionIndex).toBe(0);
  });
});
