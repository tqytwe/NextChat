import { describe, expect, test } from "@jest/globals";

import {
  planUsageInfo,
  subscriptionUsagePeriods,
} from "../app/client/mobile-subscription";

const labels = {
  dailyCardUsage: "Daily card",
  dailyUsage: "Daily",
  weeklyUsage: "Weekly",
  monthlyUsage: "Monthly",
};

describe("mobile subscription usage", () => {
  test("uses the authoritative nested progress supplied by account summary", () => {
    const periods = subscriptionUsagePeriods(
      {
        daily_usage_usd: 1,
        group: { daily_limit_usd: 10 },
        progress: {
          daily: {
            limit_usd: 25,
            used_usd: 7.5,
            remaining_usd: 17.5,
          },
        },
      },
      labels,
    );

    expect(periods).toEqual([
      { label: "Daily", limit: 25, used: 7.5, remaining: 17.5 },
    ]);
  });

  test("falls back to subscription group limits when progress is unavailable", () => {
    const periods = subscriptionUsagePeriods(
      {
        daily_usage_usd: 3,
        weekly_usage_usd: 8,
        group: { daily_limit_usd: 10, weekly_limit_usd: 50 },
      },
      labels,
    );

    expect(periods).toEqual([
      { label: "Daily", limit: 10, used: 3, remaining: 7 },
      { label: "Weekly", limit: 50, used: 8, remaining: 42 },
    ]);
  });

  test("recognizes a plan quota_limit_usd as a USD entitlement", () => {
    expect(
      planUsageInfo({ id: 7, quota_limit_usd: 16 }, []).total,
    ).toBe(16);
    expect(
      planUsageInfo({ id: 7, quota_limit_usd: 16 }, []).unit,
    ).toBe("USD");
  });
});
