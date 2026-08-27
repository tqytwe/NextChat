export const PLAY_WELFARE_ENDPOINTS = {
  hub: "/api/v1/play/hub",
  teamDirectory: "/api/v1/play/teams/directory?limit=20",
  teamPublicLeaderboard: "/api/v1/play/teams/leaderboard/public?limit=10",
  teamSeasons: "/api/v1/play/teams/seasons?limit=3",
  arenaMonthlyOverview:
    "/api/v1/play/arena/overview?period=monthly&include_history=1",
  arenaDailyRewardSummary: "/api/v1/play/arena/daily/reward-summary",
  arenaDailyCurrent: "/api/v1/play/arena/daily/current",
  checkinStatus: "/api/v1/play/checkin/status",
  blindboxStatus: "/api/v1/play/blindbox/status",
  quizToday: "/api/v1/play/quiz/today",
} as const;

export const PLAY_WELFARE_TEAM_ENDPOINTS = {
  me: "/api/v1/play/teams/me",
  admission: "/api/v1/play/teams/admission",
  myApplications: "/api/v1/play/teams/applications/me?limit=20",
  leaderboard: "/api/v1/play/teams/leaderboard",
  captainApplications: "/api/v1/play/teams/applications?limit=50",
  application: "/api/v1/play/teams/applications",
  recruiting: "/api/v1/play/teams/recruiting",
  inviteRotate: "/api/v1/play/teams/invite/rotate",
} as const;

export const PLAY_WELFARE_REWARD_ENDPOINTS = {
  checkin: "/api/v1/play/checkin",
  checkinMakeup: "/api/v1/play/checkin/makeup",
  blindboxOpen: "/api/v1/play/blindbox/open",
  quizSubmit: "/api/v1/play/quiz/submit",
} as const;

export interface PlayWelfareVIPTier {
  tier: number;
  label: string;
  min_recharge: number;
  recharge_bonus_pct: number;
  perks?: string[];
}

export interface PlayWelfareVIPStatus {
  tier: number;
  label: string;
  recharge_bonus_pct: number;
  perks?: string[];
  next_tier?: number;
  next_label?: string;
  next_min_recharge?: number;
  amount_to_next?: number;
}

export interface PlayWelfareCampaign {
  id: number;
  name: string;
  start_at: string;
  end_at: string;
}

export interface PlayWelfareHub {
  growth: {
    vip?: PlayWelfareVIPStatus;
    vip_tiers?: PlayWelfareVIPTier[];
    membership_paid_amount?: number;
    is_member?: boolean;
  };
  campaigns?: PlayWelfareCampaign[];
  team?: {
    enabled: boolean;
    team?: {
      id: number;
      name: string;
      member_count: number;
      monthly_spend: string;
      estimated_pool: string;
    };
  };
  arena?: {
    enabled: boolean;
    rank?: number;
    tokens_to_prev_rank?: number;
    estimated_reward?: number;
    period?: { name?: string };
  };
}

// These public rows intentionally contain team aggregates only. Never add a
// user identity, individual consumption, or personal reward to this contract.
export interface PlayWelfareTeamDirectoryEntry {
  team_id: number;
  team_name: string;
  member_count: number;
  member_capacity: number;
  monthly_spend: string;
  estimated_pool: string;
  accepting_applications: boolean;
}

export interface PlayWelfareTeamDirectory {
  month: string;
  rows: PlayWelfareTeamDirectoryEntry[];
}

export interface PlayWelfareTeamLeaderboardEntry {
  rank: number;
  team_id: number;
  team_name: string;
  member_count: number;
  monthly_spend: string;
  estimated_pool: string;
  gap_to_previous: string;
  is_mine?: boolean;
}

export interface PlayWelfareTeamLeaderboard {
  rows: PlayWelfareTeamLeaderboardEntry[];
  month: string;
  total_teams: number;
}

export interface PlayWelfareTeamSeason {
  month: string;
  status: string;
  settled_at?: string;
}

export interface PlayWelfareTeamSeasonRanking {
  rank: number;
  team_id: number;
  team_name: string;
  member_count: number;
  team_spend: string;
  pool_amount: string;
  paid_amount: string;
  settlement_status: string;
}

export interface PlayWelfareTeamSeasonDetail {
  season: PlayWelfareTeamSeason;
  total_teams: number;
  rows: PlayWelfareTeamSeasonRanking[];
}

// The server decides captain authority. The app must not infer it from a
// captain user ID, which would expand the authenticated response's privacy
// surface merely to decide whether to load captain-only controls.
export interface PlayWelfareMyTeam {
  id: number;
  name: string;
  is_captain: boolean;
  can_manage: boolean;
  invite_code?: string;
  is_recruiting: boolean;
  member_count: number;
  current_month: string;
  team_spend: string;
  estimated_pool: string;
  next_threshold?: string;
}

export interface PlayWelfareTeamMe {
  enabled: boolean;
  team?: PlayWelfareMyTeam;
}

export interface PlayWelfareTeamAdmission {
  enabled: boolean;
  can_apply_or_join: boolean;
  current_team_id?: number;
  cooldown_ends_at?: string;
  cooldown_active: boolean;
  member_capacity: number;
  application_ttl_hours: number;
  captain_sla_hours: number;
}

export interface PlayWelfareTeamApplication {
  id: number;
  team_id: number;
  applicant_display_name?: string;
  status: string;
  message?: string;
  requested_at: string;
  sla_due_at: string;
  expires_at: string;
  handled_at?: string;
  decision_note?: string;
}

export interface PlayWelfareTeamInvite {
  invite_code: string;
  expires_at: string;
  rotated_at: string;
}

export interface PlayWelfareArenaOverview {
  enabled: boolean;
  period?: { name?: string; status?: string };
  current: {
    rank?: number;
    token_sum?: number;
    tokens_to_prev_rank?: number;
    estimated_reward?: number;
  };
  rows: Array<{
    rank: number;
    display_name: string;
    anonymous?: boolean;
    token_sum: number;
  }>;
  reward_tiers: Array<{
    rank_start: number;
    rank_end: number;
    reward_amount: number;
  }>;
  history: Array<{
    period?: { name?: string; settled_at?: string };
    winners_count: number;
    total_amount: number;
    winners: Array<{
      rank: number;
      display_name: string;
      anonymous?: boolean;
      reward_amount: number;
      paid_at?: string;
    }>;
  }>;
}

// Daily arena ("Token 农场" daily board). Field names mirror the backend DTOs
// (playArenaDailyRewardSummaryDTO / playArenaCurrentDTO) verbatim; display_name
// is server-side masked (e.g. "15***@qq.com"), so rows carry no raw identity.
export interface PlayWelfareArenaDailyPeriod {
  id?: number;
  name?: string;
  start_at?: string;
  end_at?: string;
  status?: string;
  period_type?: string;
  settled_at?: string;
}

export interface PlayWelfareArenaDailyRewardSummary {
  enabled: boolean;
  // Most recently settled day: winners already paid (or pending payout).
  recent?: {
    period?: PlayWelfareArenaDailyPeriod;
    settled_at?: string;
    paid_today: boolean;
    winners_count: number;
    total_amount: number;
    winners: Array<{
      rank: number;
      display_name: string;
      anonymous?: boolean;
      avatar_url?: string;
      token_sum: number;
      amount: number;
    }>;
  };
  // Today's live board with per-row estimated reward.
  current?: {
    period?: PlayWelfareArenaDailyPeriod;
    rows: Array<{
      rank: number;
      display_name: string;
      anonymous?: boolean;
      avatar_url?: string;
      token_sum: number;
      estimated_reward: number;
    }>;
  };
}

// Authenticated viewer's own daily standing (mirrors monthly overview.current).
export interface PlayWelfareArenaDailyCurrent {
  enabled: boolean;
  period?: PlayWelfareArenaDailyPeriod;
  token_sum?: number;
  display_token_sum?: number;
  rank?: number;
  tokens_to_prev_rank?: number;
  estimated_reward?: number;
  recharge_boost_active?: boolean;
  arena_score_multiplier?: number;
  campaign_active?: boolean;
}

export interface PlayWelfareRewardCoupon {
  user_coupon_id?: number;
  name?: string;
  benefit_type?: string;
  benefit_value?: number;
  expires_at?: string;
}

export interface PlayWelfareRedeemCode {
  id?: number;
  code?: string;
  type?: string;
  value?: number;
  expires_at?: string;
}

export interface PlayWelfareCheckinStatus {
  enabled: boolean;
  eligible: boolean;
  ineligible_reason?: string;
  checked_in_today: boolean;
  reward_amount: number;
  coupon_pool_ready: boolean;
  server_date: string;
  streak_count?: number;
  next_milestone_days?: number;
  next_milestone_bonus?: number;
  can_makeup?: boolean;
  makeup_date?: string;
  recharge_boost_active?: boolean;
  boost_checkin_multiplier?: number;
}

export interface PlayWelfareCheckinResult {
  reward_amount: number;
  balance_added: number;
  reward_type?: string;
  coupon?: PlayWelfareRewardCoupon;
  redeem_code?: PlayWelfareRedeemCode;
  server_date: string;
  streak_count?: number;
  milestone_bonus?: number;
}

export interface PlayWelfareBlindboxStatus {
  enabled: boolean;
  coupon_pool_ready: boolean;
  cost_amount: number;
  vip_tier?: { tier?: number; label?: string };
  expected_reward?: number;
  daily_limit?: number;
  effective_limit?: number;
  opens_today?: number;
  can_open: boolean;
  server_date: string;
  recharge_boost_active?: boolean;
  campaign_active?: boolean;
}

export interface PlayWelfareBlindboxResult {
  cost_amount: number;
  reward_amount: number;
  net_amount: number;
  reward_type?: string;
  coupon?: PlayWelfareRewardCoupon;
  redeem_code?: PlayWelfareRedeemCode;
  opens_today?: number;
  server_date: string;
}

export interface PlayWelfareQuizQuestion {
  id: number;
  prompt: string;
  options: string[];
}

export interface PlayWelfareQuizToday {
  enabled: boolean;
  coupon_pool_ready: boolean;
  questions: PlayWelfareQuizQuestion[];
  already_submitted: boolean;
  previous_score?: number;
  previous_total?: number;
  previous_reward?: number;
  previous_reward_type?: string;
  previous_coupon?: PlayWelfareRewardCoupon;
  reward_per_correct: number;
  server_date: string;
}

export interface PlayWelfareQuizSubmitResult {
  score: number;
  total: number;
  reward_amount: number;
  reward_type?: string;
  coupon?: PlayWelfareRewardCoupon;
  redeem_code?: PlayWelfareRedeemCode;
  server_date: string;
}

export type PlayWelfareRequest = <T>(path: string) => Promise<T>;

type PlayWelfareUnavailable =
  | keyof typeof PLAY_WELFARE_ENDPOINTS
  | "teamMe"
  | "teamAdmission"
  | "teamMyApplications"
  | "teamLeaderboard"
  | "teamCaptainApplications";

export interface PlayWelfareData {
  hub?: PlayWelfareHub;
  teamDirectory?: PlayWelfareTeamDirectory;
  teamPublicLeaderboard?: PlayWelfareTeamLeaderboard;
  teamSeasons?: PlayWelfareTeamSeason[];
  teamMe?: PlayWelfareTeamMe;
  teamAdmission?: PlayWelfareTeamAdmission;
  teamMyApplications?: PlayWelfareTeamApplication[];
  teamLeaderboard?: PlayWelfareTeamLeaderboard;
  teamCaptainApplications?: PlayWelfareTeamApplication[];
  arenaMonthlyOverview?: PlayWelfareArenaOverview;
  arenaDailyRewardSummary?: PlayWelfareArenaDailyRewardSummary;
  arenaDailyCurrent?: PlayWelfareArenaDailyCurrent;
  checkinStatus?: PlayWelfareCheckinStatus;
  blindboxStatus?: PlayWelfareBlindboxStatus;
  quizToday?: PlayWelfareQuizToday;
  unavailable: PlayWelfareUnavailable[];
}

export function playWelfareTeamSeasonEndpoint(month: string) {
  return `/api/v1/play/teams/seasons/${encodeURIComponent(month)}?limit=10`;
}

// Account-wide play state and public competition proof load together. The
// member-only leaderboard and captain queue are requested only after /me has
// proven that they are relevant.
export async function loadPlayWelfareData(
  request: PlayWelfareRequest,
  _currentUserID?: number,
): Promise<PlayWelfareData> {
  const [
    hub,
    teamDirectory,
    teamPublicLeaderboard,
    teamSeasons,
    arenaMonthlyOverview,
    arenaDailyRewardSummary,
    arenaDailyCurrent,
    checkinStatus,
    blindboxStatus,
    quizToday,
    teamMe,
    teamAdmission,
    teamMyApplications,
  ] = await Promise.allSettled([
    request<PlayWelfareHub>(PLAY_WELFARE_ENDPOINTS.hub),
    request<PlayWelfareTeamDirectory>(PLAY_WELFARE_ENDPOINTS.teamDirectory),
    request<PlayWelfareTeamLeaderboard>(
      PLAY_WELFARE_ENDPOINTS.teamPublicLeaderboard,
    ),
    request<PlayWelfareTeamSeason[]>(PLAY_WELFARE_ENDPOINTS.teamSeasons),
    request<PlayWelfareArenaOverview>(
      PLAY_WELFARE_ENDPOINTS.arenaMonthlyOverview,
    ),
    request<PlayWelfareArenaDailyRewardSummary>(
      PLAY_WELFARE_ENDPOINTS.arenaDailyRewardSummary,
    ),
    request<PlayWelfareArenaDailyCurrent>(
      PLAY_WELFARE_ENDPOINTS.arenaDailyCurrent,
    ),
    request<PlayWelfareCheckinStatus>(PLAY_WELFARE_ENDPOINTS.checkinStatus),
    request<PlayWelfareBlindboxStatus>(PLAY_WELFARE_ENDPOINTS.blindboxStatus),
    request<PlayWelfareQuizToday>(PLAY_WELFARE_ENDPOINTS.quizToday),
    request<PlayWelfareTeamMe>(PLAY_WELFARE_TEAM_ENDPOINTS.me),
    request<PlayWelfareTeamAdmission>(PLAY_WELFARE_TEAM_ENDPOINTS.admission),
    request<PlayWelfareTeamApplication[]>(
      PLAY_WELFARE_TEAM_ENDPOINTS.myApplications,
    ),
  ]);
  const unavailable: PlayWelfareData["unavailable"] = [];
  const data: PlayWelfareData = { unavailable };
  if (hub.status === "fulfilled") data.hub = hub.value;
  else unavailable.push("hub");
  if (teamDirectory.status === "fulfilled") {
    data.teamDirectory = teamDirectory.value;
  } else unavailable.push("teamDirectory");
  if (teamPublicLeaderboard.status === "fulfilled") {
    data.teamPublicLeaderboard = teamPublicLeaderboard.value;
  } else unavailable.push("teamPublicLeaderboard");
  if (teamSeasons.status === "fulfilled") data.teamSeasons = teamSeasons.value;
  else unavailable.push("teamSeasons");
  if (arenaMonthlyOverview.status === "fulfilled") {
    data.arenaMonthlyOverview = arenaMonthlyOverview.value;
  } else unavailable.push("arenaMonthlyOverview");
  if (arenaDailyRewardSummary.status === "fulfilled") {
    data.arenaDailyRewardSummary = arenaDailyRewardSummary.value;
  } else unavailable.push("arenaDailyRewardSummary");
  if (arenaDailyCurrent.status === "fulfilled") {
    data.arenaDailyCurrent = arenaDailyCurrent.value;
  } else unavailable.push("arenaDailyCurrent");
  if (checkinStatus.status === "fulfilled") {
    data.checkinStatus = checkinStatus.value;
  } else unavailable.push("checkinStatus");
  if (blindboxStatus.status === "fulfilled") {
    data.blindboxStatus = blindboxStatus.value;
  } else unavailable.push("blindboxStatus");
  if (quizToday.status === "fulfilled") {
    data.quizToday = quizToday.value;
  } else unavailable.push("quizToday");
  if (teamMe.status === "fulfilled") data.teamMe = teamMe.value;
  else unavailable.push("teamMe");
  if (teamAdmission.status === "fulfilled") {
    data.teamAdmission = teamAdmission.value;
  } else unavailable.push("teamAdmission");
  if (teamMyApplications.status === "fulfilled") {
    data.teamMyApplications = teamMyApplications.value;
  } else unavailable.push("teamMyApplications");

  const team = data.teamMe?.team;
  if (!team) return data;

  const isCaptain = team.is_captain && team.can_manage;
  const privateResults = await Promise.allSettled([
    request<PlayWelfareTeamLeaderboard>(
      PLAY_WELFARE_TEAM_ENDPOINTS.leaderboard,
    ),
    ...(isCaptain
      ? [
          request<PlayWelfareTeamApplication[]>(
            PLAY_WELFARE_TEAM_ENDPOINTS.captainApplications,
          ),
        ]
      : []),
  ]);
  const leaderboard = privateResults[0];
  if (leaderboard.status === "fulfilled") {
    data.teamLeaderboard = leaderboard.value;
  } else unavailable.push("teamLeaderboard");
  if (isCaptain) {
    const captainApplications = privateResults[1];
    if (captainApplications?.status === "fulfilled") {
      data.teamCaptainApplications = captainApplications.value;
    } else unavailable.push("teamCaptainApplications");
  }
  return data;
}

export function loadPlayWelfareTeamSeason(
  request: PlayWelfareRequest,
  month: string,
) {
  return request<PlayWelfareTeamSeasonDetail>(
    playWelfareTeamSeasonEndpoint(month),
  );
}
