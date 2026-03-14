import type { ConfigSource } from "../config.js";
import { createDefaultService } from "../server.js";
import type { CompareResult } from "../domain/service.js";
import type { DealCandidate } from "../domain/score.js";
import {
  classifyEvidenceFirstAuditResult,
  extractRecommendationEmptyReason,
  extractRecommendationMissingEvidence
} from "./evidence-first-audit.js";

export type RecommendationAuditGroup =
  | "steam-deck"
  | "deckbuilding-short"
  | "strategy-rating"
  | "multiplayer"
  | "action-roguelite";

export interface RecommendationAuditCase {
  index: number;
  group: RecommendationAuditGroup;
  preferences: string;
  budget?: number | undefined;
  platforms?: string[] | undefined;
  country: string;
}

export interface RecommendationAuditTopMatch {
  title: string;
  cut?: number | undefined;
  price?: { amount?: number; currency?: string } | undefined;
  multiplayer?: boolean | undefined;
  rating?: number | null | undefined;
  metacritic?: number | null | undefined;
  genres?: string[] | undefined;
  steamDeckStatus?: string | null | undefined;
}

export interface RecommendationAuditResult extends RecommendationAuditCase {
  summary: string;
  warnings: string[];
  matchCount: number;
  topTitle: string | null;
  topMatch: RecommendationAuditTopMatch | null;
  emptyReason?: string | undefined;
  missingEvidence?: string[] | undefined;
  groundlessRecommendation?: boolean | undefined;
  recoverableButMissed?: boolean | undefined;
  evidenceRejected?: boolean | undefined;
  flagged: boolean;
  timeout: boolean;
  error?: string | undefined;
}

export interface RecommendationAuditTopCount {
  title: string;
  count: number;
}

export interface RecommendationAuditSummary {
  total: number;
  zeroMatches: number;
  flagged: number;
  groundlessRecommendations: number;
  recoverableButMissed: number;
  evidenceRejected: number;
  timeouts: number;
  topCounts: RecommendationAuditTopCount[];
}

export interface RecommendationAuditGroupSummary {
  uniqueTopPicks: number;
  topCounts: RecommendationAuditTopCount[];
  flagged: number;
  groundlessRecommendations: number;
  recoverableButMissed: number;
  evidenceRejected: number;
  timeouts: number;
}

export interface RecommendationAuditRun {
  generatedAt: string;
  summary: RecommendationAuditSummary;
  groups: Record<RecommendationAuditGroup, RecommendationAuditGroupSummary>;
  results: RecommendationAuditResult[];
}

export interface RecommendationAuditService {
  recommendSaleGames(args: {
    preferences: string;
    budget?: number;
    platforms?: string[];
    country: string;
  }): Promise<CompareResult>;
}

export interface RecommendationAuditRunOptions {
  concurrency?: number | undefined;
  timeoutMs?: number | undefined;
}

export const DEFAULT_RECOMMENDATION_AUDIT_CONCURRENCY = 4;
export const DEFAULT_RECOMMENDATION_AUDIT_TIMEOUT_MS = 15_000;
export const DEFAULT_RECOMMENDATION_AUDIT_OUTPUT = "artifacts/local-recommend-audit.json";

const RECOMMENDATION_AUDIT_GROUPS: RecommendationAuditGroup[] = [
  "steam-deck",
  "deckbuilding-short",
  "strategy-rating",
  "multiplayer",
  "action-roguelite"
];

export const RECOMMENDATION_AUDIT_CASES: RecommendationAuditCase[] = [
  ...buildCases("steam-deck", ["Steam Deck"], 20_000, [
    "스팀덱에서 하기 좋은 로그라이크",
    "핸드헬드에서 하기 좋은 로그라이크",
    "휴대용으로 가볍게 즐길 로그라이트",
    "패드로 돌리기 편한 로그라이크",
    "스팀덱에서 할 전략 게임",
    "휴대용 pc에서 할 전략 게임",
    "스팀덱에서 평가 좋은 전략 게임",
    "핸드헬드용 전략 할인 게임",
    "패드로 하기 좋은 전략 세일작",
    "스팀덱에서 할 만한 전략 로그라이크"
  ], 1),
  ...buildCases("deckbuilding-short", ["Steam Deck"], 15_000, [
    "잠깐씩 즐길 카드게임",
    "한 판씩 돌리기 좋은 카드 배틀러",
    "짧게 즐길 덱빌딩 게임",
    "가볍게 할 카드 로그라이크",
    "출퇴근에 하기 좋은 덱빌딩",
    "quick deckbuilder for short sessions",
    "pick-up card battler",
    "손패 굴리는 게임 추천",
    "짬짬이 하기 좋은 카드게임",
    "부담 없이 한 판 하기 좋은 덱빌딩"
  ], 11),
  ...buildCases("strategy-rating", ["PC"], 25_000, [
    "검증된 전술 게임",
    "highly rated turn-based tactics",
    "평가 좋은 전략 할인 게임",
    "리뷰 좋은 전략 세일겜",
    "평 좋은 전략겜 세일 중인 것만",
    "well-reviewed tactics game",
    "평점 높은 전략 게임",
    "메타 좋은 전략 할인작",
    "너무 마이너하지 않은 평가 좋은 전략 게임",
    "턴제 전술 중 평가 좋은 할인작"
  ], 21),
  ...buildCases("multiplayer", ["PC"], 20_000, [
    "친구랑 같이 할 게임",
    "둘이서 하기 좋은 게임",
    "친구들이랑 웃기게 떠들면서 할 협동 할인 게임",
    "파티플레이로 하기 좋은 세일겜",
    "팀플하기 좋은 할인 게임",
    "co-op game for friends",
    "party game on sale",
    "친구와 같이 할 협동 게임",
    "2인으로 하기 좋은 액션 게임",
    "여럿이 같이 놀기 좋은 할인 게임"
  ], 31),
  ...buildCases("action-roguelite", ["PC"], 18_000, [
    "전투 위주 로그라이트",
    "핵앤슬래시 로그라이크",
    "슈팅 로그라이트",
    "combat-heavy roguelike",
    "빠른 템포 로그라이트",
    "손맛 좋은 액션 로그라이크",
    "action roguelite",
    "슈터 로그라이트",
    "템포 빠른 전투형 로그라이트",
    "한 판씩 즐길 액션 로그라이트"
  ], 41)
];

export async function runRecommendationAudit(
  service: RecommendationAuditService,
  cases: RecommendationAuditCase[] = RECOMMENDATION_AUDIT_CASES,
  options: RecommendationAuditRunOptions = {}
): Promise<RecommendationAuditRun> {
  const concurrency = normalizePositiveInt(
    options.concurrency,
    DEFAULT_RECOMMENDATION_AUDIT_CONCURRENCY
  );
  const timeoutMs = normalizePositiveInt(options.timeoutMs, DEFAULT_RECOMMENDATION_AUDIT_TIMEOUT_MS);
  const results = new Array<RecommendationAuditResult>(cases.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, Math.max(cases.length, 1)) }, async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= cases.length) {
        return;
      }

      results[current] = await runRecommendationAuditCase(service, cases[current]!, timeoutMs);
    }
  });

  await Promise.all(workers);

  const summary = summarizeRecommendationAuditResults(results);

  return {
    generatedAt: new Date().toISOString(),
    summary: summary.summary,
    groups: summary.groups,
    results
  };
}

export async function runLocalRecommendationAudit(
  env: ConfigSource = process.env,
  options: RecommendationAuditRunOptions = {}
): Promise<RecommendationAuditRun> {
  const service = createDefaultService(env);
  return runRecommendationAudit(service, RECOMMENDATION_AUDIT_CASES, options);
}

export function summarizeRecommendationAuditResults(results: RecommendationAuditResult[]): {
  summary: RecommendationAuditSummary;
  groups: Record<RecommendationAuditGroup, RecommendationAuditGroupSummary>;
} {
  const topCounts = countTopTitles(results);
  const groups = Object.fromEntries(
    RECOMMENDATION_AUDIT_GROUPS.map((group) => {
      const groupResults = results.filter((result) => result.group === group);
      const groupTopCounts = countTopTitles(groupResults);

      return [
        group,
        {
          uniqueTopPicks: groupTopCounts.length,
          topCounts: groupTopCounts,
          flagged: groupResults.filter((result) => result.flagged).length,
          groundlessRecommendations: groupResults.filter(
            (result) => result.groundlessRecommendation
          ).length,
          recoverableButMissed: groupResults.filter(
            (result) => result.recoverableButMissed
          ).length,
          evidenceRejected: groupResults.filter((result) => result.evidenceRejected).length,
          timeouts: groupResults.filter((result) => result.timeout).length
        } satisfies RecommendationAuditGroupSummary
      ];
    })
  ) as Record<RecommendationAuditGroup, RecommendationAuditGroupSummary>;

  return {
    summary: {
      total: results.length,
      zeroMatches: results.filter((result) => result.matchCount === 0).length,
      flagged: results.filter((result) => result.flagged).length,
      groundlessRecommendations: results.filter((result) => result.groundlessRecommendation).length,
      recoverableButMissed: results.filter((result) => result.recoverableButMissed).length,
      evidenceRejected: results.filter((result) => result.evidenceRejected).length,
      timeouts: results.filter((result) => result.timeout).length,
      topCounts
    },
    groups
  };
}

export function isRecommendationAuditFlagged(
  group: RecommendationAuditGroup,
  topMatch: RecommendationAuditTopMatch | null
): boolean {
  if (!topMatch) {
    return false;
  }

  switch (group) {
    case "multiplayer":
      return topMatch.multiplayer !== true;
    case "deckbuilding-short":
      return !hasDeckOrCardEvidence(topMatch);
    case "strategy-rating":
      return !hasStrategyRatingEvidence(topMatch);
    case "action-roguelite":
      return !hasActionRogueliteEvidence(topMatch);
    case "steam-deck":
      return topMatch.steamDeckStatus !== "verified" && topMatch.steamDeckStatus !== "playable";
  }
}

async function runRecommendationAuditCase(
  service: RecommendationAuditService,
  testCase: RecommendationAuditCase,
  timeoutMs: number
): Promise<RecommendationAuditResult> {
  try {
    const request: {
      preferences: string;
      budget?: number;
      platforms?: string[];
      country: string;
    } = {
      preferences: testCase.preferences,
      country: testCase.country
    };

    if (typeof testCase.budget === "number") {
      request.budget = testCase.budget;
    }

    if (testCase.platforms) {
      request.platforms = testCase.platforms;
    }

    const response = await withTimeout(
      service.recommendSaleGames(request),
      timeoutMs
    );

    const matches = Array.isArray(response.matches) ? response.matches : [];
    const topMatch = toAuditTopMatch(matches[0]);
    const emptyReason = extractRecommendationEmptyReason(response);
    const classification = classifyEvidenceFirstAuditResult({
      topMatch,
      invalidRecommendation: isRecommendationAuditFlagged(testCase.group, topMatch),
      emptyReason
    });

    return {
      ...testCase,
      summary: response.summary,
      warnings: response.warnings ?? [],
      matchCount: matches.length,
      topTitle: topMatch?.title ?? null,
      topMatch,
      emptyReason,
      missingEvidence: extractRecommendationMissingEvidence(response),
      groundlessRecommendation: classification.groundlessRecommendation,
      recoverableButMissed: classification.recoverableButMissed,
      evidenceRejected: classification.evidenceRejected,
      flagged: classification.flagged,
      timeout: false
    };
  } catch (error) {
    return {
      ...testCase,
      summary: "",
      warnings: [],
      matchCount: 0,
      topTitle: null,
      topMatch: null,
      groundlessRecommendation: false,
      recoverableButMissed: true,
      evidenceRejected: false,
      flagged: true,
      timeout: isTimeoutError(error),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function toAuditTopMatch(value: unknown): RecommendationAuditTopMatch | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const deal = value as Partial<DealCandidate>;
  if (typeof deal.title !== "string" || deal.title.length === 0) {
    return null;
  }

  return {
    title: deal.title,
    cut: typeof deal.cut === "number" ? deal.cut : undefined,
    price: deal.price,
    multiplayer: typeof deal.multiplayer === "boolean" ? deal.multiplayer : undefined,
    rating: typeof deal.rating === "number" ? deal.rating : deal.rating ?? undefined,
    metacritic:
      typeof deal.metacritic === "number" ? deal.metacritic : deal.metacritic ?? undefined,
    genres: Array.isArray(deal.genres) ? deal.genres : undefined,
    steamDeckStatus: deal.steamDeckCompatibility?.status ?? null
  };
}

function countTopTitles(results: RecommendationAuditResult[]): RecommendationAuditTopCount[] {
  const counts = new Map<string, number>();

  for (const result of results) {
    if (!result.topTitle) {
      continue;
    }

    counts.set(result.topTitle, (counts.get(result.topTitle) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => {
      const countDifference = right[1] - left[1];
      if (countDifference !== 0) {
        return countDifference;
      }

      return left[0].localeCompare(right[0]);
    })
    .map(([title, count]) => ({ title, count }));
}

function hasDeckOrCardEvidence(match: RecommendationAuditTopMatch): boolean {
  return /\b(deck|deckbuilder|deckbuilding|card|cards|hand)\b/i.test(
    `${match.title} ${(match.genres ?? []).join(" ")}`
  );
}

function hasStrategyRatingEvidence(match: RecommendationAuditTopMatch): boolean {
  return (
    (match.genres ?? []).some((genre) => genre.trim().toLowerCase() === "strategy") &&
    hasReviewSignal(match)
  );
}

function hasActionRogueliteEvidence(match: RecommendationAuditTopMatch): boolean {
  const genres = new Set((match.genres ?? []).map((genre) => genre.trim().toLowerCase()));
  return (
    genres.has("action") && (genres.has("roguelike") || genres.has("roguelite"))
  );
}

function hasReviewSignal(match: RecommendationAuditTopMatch): boolean {
  return (match.rating ?? 0) >= 4 || (match.metacritic ?? 0) >= 75;
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("timeout:");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout:${timeoutMs}`)), timeoutMs)
    )
  ]);
}

function buildCases(
  group: RecommendationAuditGroup,
  platforms: string[],
  budget: number,
  preferences: string[],
  startIndex: number
): RecommendationAuditCase[] {
  return preferences.map((value, index) => ({
    index: startIndex + index,
    group,
    preferences: value,
    budget,
    platforms,
    country: "KR"
  }));
}
