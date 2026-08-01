export type SubscriptionUsagePeriod = {
  label: string;
  used: number;
  limit: number;
  remaining: number;
};

type SubscriptionUsageLabels = {
  dailyCardUsage: string;
  dailyUsage: string;
  weeklyUsage: string;
  monthlyUsage: string;
};

function firstNumberField(record: any, fields: string[]) {
  for (const field of fields) {
    const value = Number(record?.[field]);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function firstStringField(record: any, fields: string[]) {
  for (const field of fields) {
    const value = record?.[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function planGroupValue(plan: any) {
  return String(
    plan?.group_id ||
      plan?.target_group_id ||
      plan?.group?.id ||
      plan?.target_group?.id ||
      plan?.group_name ||
      plan?.target_group_name ||
      "",
  );
}

function matchingSubscription(plan: any, subscriptions: any[] = []) {
  const planId = String(plan?.id || plan?.plan_id || plan?.product_id || "");
  const groupValue = planGroupValue(plan);
  return subscriptions.find((item) => {
    const itemPlanId = String(
      item?.plan_id || item?.product_id || item?.plan?.id || "",
    );
    if (planId && itemPlanId && planId === itemPlanId) return true;
    const itemGroup = String(
      item?.group_id ||
        item?.group?.id ||
        item?.group_name ||
        item?.group?.name ||
        "",
    );
    return Boolean(groupValue && itemGroup && groupValue === itemGroup);
  });
}

export function planUsageInfo(plan: any, subscriptions: any[] = []) {
  const subscription = matchingSubscription(plan, subscriptions);
  const source = subscription || plan || {};
  const quotaFields = ["quota_limit_usd", "quotaLimitUsd"];
  const total =
    firstNumberField(source, [
      "quota_total",
      "quotaTotal",
      "included_quota",
      "includedQuota",
      "usage_limit",
      "usageLimit",
      "included_balance",
      "includedBalance",
      "grant_amount",
      "grantAmount",
      ...quotaFields,
    ]) ??
    firstNumberField(plan, [
      "quota_total",
      "included_balance",
      "grant_amount",
      ...quotaFields,
    ]);
  const used = firstNumberField(source, [
    "quota_used",
    "quotaUsed",
    "used_quota",
    "usedQuota",
    "used",
  ]);
  const remaining = firstNumberField(source, [
    "quota_remaining",
    "quotaRemaining",
    "remaining_quota",
    "remainingQuota",
    "remaining",
  ]);
  const hasUsdQuota =
    firstNumberField(source, quotaFields) !== undefined ||
    firstNumberField(plan, quotaFields) !== undefined;
  const unit =
    firstStringField(source, ["quota_unit", "quotaUnit", "unit", "currency"]) ||
    firstStringField(plan, ["quota_unit", "quotaUnit", "unit", "currency"]) ||
    (hasUsdQuota ? "USD" : "");
  return { subscription, total, used, remaining, unit };
}

function numericUsage(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function usageWindowPeriod(
  subscription: any,
  progressWindow: any,
  label: string,
  usedKey: string,
  limitKey: string,
): SubscriptionUsagePeriod[] {
  const group = subscription.group || {};
  const limit =
    numericUsage(progressWindow?.limit_usd) ?? numericUsage(group[limitKey]);
  if (!limit || limit <= 0) return [];
  const used =
    numericUsage(progressWindow?.used_usd) ?? numericUsage(subscription[usedKey]) ?? 0;
  const remaining =
    numericUsage(progressWindow?.remaining_usd) ?? Math.max(0, limit - used);
  return [{ label, used, limit, remaining }];
}

export function subscriptionUsagePeriods(
  subscription: any,
  labels: SubscriptionUsageLabels,
): SubscriptionUsagePeriod[] {
  if (!subscription) return [];
  const dailyCard = subscription.daily_card || subscription.dailyCard;
  const dailyCardLimit = numericUsage(dailyCard?.quota_limit_usd);
  if (dailyCardLimit && dailyCardLimit > 0) {
    const used = numericUsage(dailyCard.quota_used_usd) ?? 0;
    const remaining =
      numericUsage(dailyCard.remaining_quota_usd) ??
      Math.max(0, dailyCardLimit - used);
    return [
      {
        label: labels.dailyCardUsage,
        used,
        limit: dailyCardLimit,
        remaining,
      },
    ];
  }

  const progress = subscription.progress || {};
  return [
    ...usageWindowPeriod(
      subscription,
      progress.daily,
      labels.dailyUsage,
      "daily_usage_usd",
      "daily_limit_usd",
    ),
    ...usageWindowPeriod(
      subscription,
      progress.weekly,
      labels.weeklyUsage,
      "weekly_usage_usd",
      "weekly_limit_usd",
    ),
    ...usageWindowPeriod(
      subscription,
      progress.monthly,
      labels.monthlyUsage,
      "monthly_usage_usd",
      "monthly_limit_usd",
    ),
  ];
}

export function formatUsageUSD(value: number) {
  return `$${Math.max(0, value).toFixed(2)}`;
}
