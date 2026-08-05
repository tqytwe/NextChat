import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  loadPlayWelfareData,
  loadPlayWelfareTeamSeason,
  PLAY_WELFARE_ENDPOINTS,
  PLAY_WELFARE_REWARD_ENDPOINTS,
  PLAY_WELFARE_TEAM_ENDPOINTS,
  playWelfareTeamSeasonEndpoint,
} from "../app/client/play-welfare";
import type { PlayWelfareRequest } from "../app/client/play-welfare";

describe("native play welfare team competition", () => {
  test("loads public proof and unteamed admission data together", async () => {
    const calls: string[] = [];
    const request: PlayWelfareRequest = async (path) => {
      calls.push(path);
      return { path } as never;
    };

    const data = await loadPlayWelfareData(request);

    expect(calls).toEqual([
      ...Object.values(PLAY_WELFARE_ENDPOINTS),
      PLAY_WELFARE_TEAM_ENDPOINTS.me,
      PLAY_WELFARE_TEAM_ENDPOINTS.admission,
      PLAY_WELFARE_TEAM_ENDPOINTS.myApplications,
    ]);
    expect(data.unavailable).toEqual([]);
    expect(data.teamDirectory).toEqual({
      path: PLAY_WELFARE_ENDPOINTS.teamDirectory,
    });
    expect(data.teamPublicLeaderboard).toEqual({
      path: PLAY_WELFARE_ENDPOINTS.teamPublicLeaderboard,
    });
    expect(data.teamLeaderboard).toBeUndefined();
  });

  test("loads private competition and the captain queue only for a captain", async () => {
    const calls: string[] = [];
    const request: PlayWelfareRequest = async (path) => {
      calls.push(path);
      if (path === PLAY_WELFARE_TEAM_ENDPOINTS.me) {
        return {
          enabled: true,
          team: {
            id: 12,
            name: "Aurora",
            is_captain: true,
            can_manage: true,
            is_recruiting: true,
            member_count: 8,
            current_month: "2026-08",
            team_spend: "0",
            estimated_pool: "0",
          },
        } as never;
      }
      return { path } as never;
    };

    const data = await loadPlayWelfareData(request, 42);

    expect(calls).toContain(PLAY_WELFARE_TEAM_ENDPOINTS.leaderboard);
    expect(calls).toContain(PLAY_WELFARE_TEAM_ENDPOINTS.captainApplications);
    expect(data.teamLeaderboard).toEqual({
      path: PLAY_WELFARE_TEAM_ENDPOINTS.leaderboard,
    });
    expect(data.teamCaptainApplications).toEqual({
      path: PLAY_WELFARE_TEAM_ENDPOINTS.captainApplications,
    });
  });

  test("does not request the captain queue for an ordinary member", async () => {
    const calls: string[] = [];
    const request: PlayWelfareRequest = async (path) => {
      calls.push(path);
      if (path === PLAY_WELFARE_TEAM_ENDPOINTS.me) {
        return {
          enabled: true,
          team: {
            id: 12,
            name: "Aurora",
            is_captain: false,
            can_manage: false,
            is_recruiting: true,
            member_count: 8,
            current_month: "2026-08",
            team_spend: "0",
            estimated_pool: "0",
          },
        } as never;
      }
      return { path } as never;
    };

    const data = await loadPlayWelfareData(request, 99);

    expect(calls).toContain(PLAY_WELFARE_TEAM_ENDPOINTS.leaderboard);
    expect(calls).not.toContain(
      PLAY_WELFARE_TEAM_ENDPOINTS.captainApplications,
    );
    expect(data.teamCaptainApplications).toBeUndefined();
  });

  test("keeps public competition visible when one public source fails", async () => {
    const request: PlayWelfareRequest = async (path) => {
      if (path === PLAY_WELFARE_ENDPOINTS.teamPublicLeaderboard) {
        throw new Error("not deployed");
      }
      return { path } as never;
    };

    const data = await loadPlayWelfareData(request);

    expect(data.unavailable).toContain("teamPublicLeaderboard");
    expect(data.hub).toEqual({ path: PLAY_WELFARE_ENDPOINTS.hub });
    expect(data.teamDirectory).toEqual({
      path: PLAY_WELFARE_ENDPOINTS.teamDirectory,
    });
  });

  test("loads daily check-in, blind-box, and quiz states independently", async () => {
    const request: PlayWelfareRequest = async (path) => {
      if (path === PLAY_WELFARE_ENDPOINTS.checkinStatus) {
        return { enabled: true, checked_in_today: false } as never;
      }
      if (path === PLAY_WELFARE_ENDPOINTS.blindboxStatus) {
        return { enabled: true, can_open: true } as never;
      }
      if (path === PLAY_WELFARE_ENDPOINTS.quizToday) {
        return { enabled: true, questions: [] } as never;
      }
      return { path } as never;
    };

    const data = await loadPlayWelfareData(request);

    expect(data.checkinStatus?.checked_in_today).toBe(false);
    expect(data.blindboxStatus?.can_open).toBe(true);
    expect(data.quizToday?.questions).toEqual([]);
    expect(data.unavailable).toEqual([]);
  });

  test("does not hide healthy daily play modules when one state endpoint fails", async () => {
    const request: PlayWelfareRequest = async (path) => {
      if (path === PLAY_WELFARE_ENDPOINTS.blindboxStatus) {
        throw new Error("blind box not deployed");
      }
      if (path === PLAY_WELFARE_ENDPOINTS.checkinStatus) {
        return { enabled: true } as never;
      }
      if (path === PLAY_WELFARE_ENDPOINTS.quizToday) {
        return { enabled: true, questions: [] } as never;
      }
      return { path } as never;
    };

    const data = await loadPlayWelfareData(request);

    expect(data.unavailable).toContain("blindboxStatus");
    expect(data.checkinStatus).toEqual({ enabled: true });
    expect(data.quizToday).toEqual({ enabled: true, questions: [] });
  });

  test("loads the daily arena board, settlement summary, and viewer standing", async () => {
    const calls: string[] = [];
    const request: PlayWelfareRequest = async (path) => {
      calls.push(path);
      if (path === PLAY_WELFARE_ENDPOINTS.arenaDailyRewardSummary) {
        return {
          enabled: true,
          recent: {
            paid_today: true,
            winners_count: 1,
            total_amount: 0.5,
            winners: [{ rank: 1, display_name: "15***@qq.com", token_sum: 7, amount: 0.5 }],
          },
          current: {
            rows: [{ rank: 1, display_name: "15***@qq.com", token_sum: 3, estimated_reward: 0.5 }],
          },
        } as never;
      }
      if (path === PLAY_WELFARE_ENDPOINTS.arenaDailyCurrent) {
        return { enabled: true, rank: 2, estimated_reward: 0.2 } as never;
      }
      return { path } as never;
    };

    const data = await loadPlayWelfareData(request);

    expect(calls).toContain(PLAY_WELFARE_ENDPOINTS.arenaDailyRewardSummary);
    expect(calls).toContain(PLAY_WELFARE_ENDPOINTS.arenaDailyCurrent);
    expect(data.arenaDailyRewardSummary?.current?.rows[0]?.estimated_reward).toBe(0.5);
    expect(data.arenaDailyRewardSummary?.recent?.paid_today).toBe(true);
    expect(data.arenaDailyCurrent?.rank).toBe(2);
    expect(data.unavailable).toEqual([]);
  });

  test("keeps healthy arena data visible when the daily board endpoint fails", async () => {
    const request: PlayWelfareRequest = async (path) => {
      if (path === PLAY_WELFARE_ENDPOINTS.arenaDailyRewardSummary) {
        throw new Error("daily board not deployed");
      }
      if (path === PLAY_WELFARE_ENDPOINTS.arenaMonthlyOverview) {
        return { enabled: true, rows: [] } as never;
      }
      return { path } as never;
    };

    const data = await loadPlayWelfareData(request);

    expect(data.unavailable).toContain("arenaDailyRewardSummary");
    expect(data.unavailable).not.toContain("arenaMonthlyOverview");
    expect(data.arenaMonthlyOverview).toEqual({ enabled: true, rows: [] });
  });

  test("keeps reward mutations on the existing idempotent play routes", () => {
    expect(PLAY_WELFARE_REWARD_ENDPOINTS).toEqual({
      checkin: "/api/v1/play/checkin",
      checkinMakeup: "/api/v1/play/checkin/makeup",
      blindboxOpen: "/api/v1/play/blindbox/open",
      quizSubmit: "/api/v1/play/quiz/submit",
    });
    const source = readFileSync(
      new URL("../app/components/mobile-app.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("PLAY_WELFARE_REWARD_ENDPOINTS.checkin");
    expect(source).toContain("PLAY_WELFARE_REWARD_ENDPOINTS.blindboxOpen");
    expect(source).toContain("PLAY_WELFARE_REWARD_ENDPOINTS.quizSubmit");
    expect(source).toContain('"Idempotency-Key": requestID');
  });

  test("uses an encoded, bounded public season endpoint", async () => {
    const calls: string[] = [];
    const request: PlayWelfareRequest = async (path) => {
      calls.push(path);
      return { path } as never;
    };

    const result = await loadPlayWelfareTeamSeason(request, "2026-07");

    expect(calls).toEqual([playWelfareTeamSeasonEndpoint("2026-07")]);
    expect(result).toEqual({
      path: "/api/v1/play/teams/seasons/2026-07?limit=10",
    });
  });

  test("keeps team identity and individual team economics out of the public client contract", () => {
    const clientSource = readFileSync(
      new URL("../app/client/play-welfare.ts", import.meta.url),
      "utf8",
    );
    const viewSource = readFileSync(
      new URL("../app/components/mobile-app.tsx", import.meta.url),
      "utf8",
    );
    const welfareView = viewSource.slice(
      viewSource.indexOf("if (route === Path.AccountWelfare) {"),
      viewSource.indexOf("if (route === Path.AccountInvite) {"),
    );

    const teamContract = clientSource.slice(
      clientSource.indexOf("export interface PlayWelfareTeamDirectoryEntry"),
      clientSource.indexOf("export interface PlayWelfareMyTeam"),
    );

    expect(teamContract).not.toContain("user_id");
    expect(teamContract).not.toContain("personal_reward");
    expect(teamContract).not.toContain("estimated_reward");
    expect(welfareView).not.toContain("teamRewardShowcase");
    expect(welfareView).toContain("welfareTeamSeasonProof");
    expect(viewSource).toContain("PLAY_WELFARE_TEAM_ENDPOINTS.application");
  });

  test("limits invite and welfare loading to their native account routes", () => {
    const source = readFileSync(
      new URL("../app/components/mobile-app.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain(
      "if (route !== Path.AccountInvite && route !== Path.AccountWelfare) return;",
    );
    expect(source).toContain("if (route !== Path.AccountWelfare) return;");
    expect(source).toContain("if (route === Path.AccountWelfare) {");
  });
});
