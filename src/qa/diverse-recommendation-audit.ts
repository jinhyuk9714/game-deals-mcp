import type { ConfigSource } from "../config.js";
import { createDefaultService } from "../server.js";
import type { CompareResult } from "../domain/service.js";
import type { DealCandidate } from "../domain/score.js";

export type DiverseRecommendationAuditGroup =
  | "steam-deck-lifestyle"
  | "deckbuilding-card"
  | "strategy-rating"
  | "multiplayer-social"
  | "action-roguelite"
  | "constraint-heavy"
  | "mixed-language"
  | "budget-strict"
  | "short-session"
  | "genre-hybrid";

export interface DiverseRecommendationAuditCase {
  index: number;
  group: DiverseRecommendationAuditGroup;
  preferences: string;
  budget?: number | undefined;
  platforms?: string[] | undefined;
  country: string;
}

export interface DiverseRecommendationAuditTopMatch {
  title: string;
  cut?: number | undefined;
  price?: { amount?: number; currency?: string } | undefined;
  multiplayer?: boolean | undefined;
  rating?: number | null | undefined;
  metacritic?: number | null | undefined;
  genres?: string[] | undefined;
  platforms?: string[] | undefined;
  tags?: string[] | undefined;
  steamDeckStatus?: string | null | undefined;
}

export interface DiverseRecommendationAuditResult extends DiverseRecommendationAuditCase {
  summary: string;
  warnings: string[];
  matchCount: number;
  topTitle: string | null;
  topMatch: DiverseRecommendationAuditTopMatch | null;
  flagged: boolean;
  timeout: boolean;
  error?: string | undefined;
}

export interface DiverseRecommendationAuditTopCount {
  title: string;
  count: number;
}

export interface DiverseRecommendationAuditSummary {
  total: number;
  zeroMatches: number;
  flagged: number;
  timeouts: number;
  topCounts: DiverseRecommendationAuditTopCount[];
}

export interface DiverseRecommendationAuditGroupSummary {
  uniqueTopPicks: number;
  topCounts: DiverseRecommendationAuditTopCount[];
  flagged: number;
  timeouts: number;
}

export interface DiverseRecommendationAuditRun {
  generatedAt: string;
  summary: DiverseRecommendationAuditSummary;
  groups: Record<DiverseRecommendationAuditGroup, DiverseRecommendationAuditGroupSummary>;
  results: DiverseRecommendationAuditResult[];
}

export interface DiverseRecommendationAuditService {
  recommendSaleGames(args: {
    preferences: string;
    budget?: number;
    platforms?: string[];
    country: string;
  }): Promise<CompareResult>;
}

export interface DiverseRecommendationAuditRunOptions {
  concurrency?: number | undefined;
  timeoutMs?: number | undefined;
}

export const DEFAULT_DIVERSE_RECOMMENDATION_AUDIT_CONCURRENCY = 4;
export const DEFAULT_DIVERSE_RECOMMENDATION_AUDIT_TIMEOUT_MS = 15_000;
export const DEFAULT_DIVERSE_RECOMMENDATION_AUDIT_OUTPUT =
  "artifacts/diverse-recommend-audit.json";

const DIVERSE_RECOMMENDATION_AUDIT_GROUPS: DiverseRecommendationAuditGroup[] = [
  "steam-deck-lifestyle",
  "deckbuilding-card",
  "strategy-rating",
  "multiplayer-social",
  "action-roguelite",
  "constraint-heavy",
  "mixed-language",
  "budget-strict",
  "short-session",
  "genre-hybrid"
];

export const DIVERSE_RECOMMENDATION_AUDIT_CASES: DiverseRecommendationAuditCase[] = [
  ...buildCases(
    "steam-deck-lifestyle",
    ["Steam Deck"],
    22_000,
    [
      "침대에서 눕겜으로 하기 좋은 스팀덱 할인 게임",
      "핸드헬드로 출퇴근에 하기 좋은 세일작",
      "배터리 부담 적은 Steam Deck game on sale",
      "패드만으로 편하게 할 수 있는 휴대용 할인 게임",
      "글자 너무 작지 않은 스팀덱용 로그라이크",
      "한 손은 간식 먹으면서 하기 좋은 handheld 할인작",
      "소리 없이도 이해되는 스팀덱 세일작",
      "잠깐 꺼내기 좋은 Steam Deck tactics deal",
      "휴대용으로 누워서 하기 좋은 card roguelike",
      "팬 소음 덜 날 것 같은 가벼운 handheld game"
    ],
    1
  ),
  ...buildCases(
    "deckbuilding-card",
    ["PC"],
    18_000,
    [
      "덱 굴리는 맛 좋은 할인 게임",
      "카드 시너지 보는 재미가 큰 세일작",
      "deckbuilder on sale with strong runs",
      "짧게 돌리기 좋은 roguelike deckbuilder",
      "hand management 재미 있는 카드 게임",
      "전투는 카드로 풀지만 너무 무겁지 않은 세일작",
      "build-around 카드 조합이 좋은 할인 게임",
      "로그라이크인데 card battler 느낌 강한 게임",
      "combo-driven deckbuilding game on sale",
      "카드 덱 압축하는 재미 있는 할인작"
    ],
    11
  ),
  ...buildCases(
    "strategy-rating",
    ["PC"],
    25_000,
    [
      "평가 좋은 전략 게임",
      "리뷰 탄탄한 tactics 할인작",
      "well-reviewed strategy game on sale",
      "메타 괜찮은 turn-based tactics",
      "평 높은 전략 게임인데 너무 무겁진 않은 것",
      "popular tactics game on sale",
      "grand strategy 말고 검증된 전략 세일작",
      "too niche하지 않은 high-rated strategy game",
      "읽을 거리 너무 많지 않은 리뷰 좋은 전술 게임",
      "shortish but well-reviewed tactics sale"
    ],
    21
  ),
  ...buildCases(
    "multiplayer-social",
    ["PC"],
    20_000,
    [
      "친구들이랑 밤새 떠들면서 할 할인 게임",
      "party-friendly co-op on sale",
      "hangout game for friends, not PvP",
      "레이싱 말고 같이 웃으면서 할 세일겜",
      "친구 둘이서 편하게 할 할인 게임",
      "소리 지르면서 하기 좋은 co-op bargain",
      "sports 말고 party night game",
      "non-competitive multiplayer on sale",
      "친구들 모였을 때 바로 켜기 좋은 할인 게임",
      "cozy하지 말고 가볍게 팀플할 게임"
    ],
    31
  ),
  ...buildCases(
    "action-roguelite",
    ["PC"],
    19_000,
    [
      "real-time roguelite with strong combat",
      "빠른 손맛 중심 로그라이트",
      "shooty roguelike on sale",
      "turn-based 말고 action roguelite",
      "read less, fight more roguelite",
      "tempo 빠른 combat roguelite",
      "deckbuilder 말고 총질 로그라이트",
      "hack-and-slash roguelite sale",
      "one more run action rogue",
      "arcade feel 있는 로그라이트"
    ],
    41
  ),
  ...buildCases(
    "constraint-heavy",
    ["PC"],
    20_000,
    [
      "리뷰 좋은 게임인데 horror 말고 너무 읽는 건 말고",
      "카드 말고 액션 로그라이트, filler도 말고",
      "전략은 좋은데 grand strategy 말고 할인 중인 것",
      "friends용인데 PvP 말고 sports도 말고",
      "well-reviewed game, not horror, not sports, under budget",
      "short session tactics, not too complex",
      "story-rich 말고 replayability 좋은 세일겜",
      "turn-based 말고 deck 아닌 로그라이크",
      "party game인데 racing 말고 review 좋은 것",
      "배터리 적게 먹는 handheld game, not horror"
    ],
    51
  ),
  ...buildCases(
    "mixed-language",
    ["PC"],
    20_000,
    [
      "well-reviewed 전술 game on sale",
      "handheld 말고 PC에서 할 card roguelike",
      "friends랑 할 funny co-op bargain",
      "review 좋은 action roguelite",
      "not PvP인 party game 세일작",
      "Steam Deck-friendly tactics sale",
      "budget 안에서 high-rated strategy game",
      "deckbuilding인데 too text-heavy 말고",
      "short session용 shooter roguelite",
      "sports 말고 casual multiplayer 할인 게임"
    ],
    61
  ),
  ...buildVariableCases("budget-strict", 71, [
    { preferences: "만원 이하로 살 수 있는 덱빌딩", budget: 10_000, platforms: ["PC"] },
    { preferences: "under 15000 KRW co-op game", budget: 15_000, platforms: ["PC"] },
    { preferences: "12000원 안쪽 action roguelite", budget: 12_000, platforms: ["PC"] },
    {
      preferences: "cheap but well-reviewed strategy game under 20000",
      budget: 20_000,
      platforms: ["PC"]
    },
    {
      preferences: "8000원 이하 handheld-friendly card game",
      budget: 8_000,
      platforms: ["Steam Deck"]
    },
    { preferences: "15000원 이하 party game", budget: 15_000, platforms: ["PC"] },
    { preferences: "budget 10000 안에서 살 세일작", budget: 10_000, platforms: ["PC"] },
    { preferences: "예산 안 넘는 tactics bargain", budget: 18_000, platforms: ["PC"] },
    { preferences: "가성비 위주 short-session 게임", budget: 12_000, platforms: ["PC"] },
    { preferences: "예산 딱 맞춰서 살 협동 게임", budget: 13_000, platforms: ["PC"] }
  ]),
  ...buildCases(
    "short-session",
    ["PC"],
    18_000,
    [
      "출근 전 20분 할 게임",
      "한 판만 하고 끄기 좋은 세일작",
      "quick run game for busy nights",
      "짧은 세션으로 만족감 있는 할인 게임",
      "잠깐 켜도 진도감 있는 tactics game",
      "퇴근 후 brain-off로 한두 판 할 게임",
      "session 짧은 card battler",
      "20분 안쪽 action roguelite",
      "family waiting 중에 틈틈이 할 게임",
      "short burst co-op deal"
    ],
    81
  ),
  ...buildCases(
    "genre-hybrid",
    ["PC"],
    22_000,
    [
      "전략이랑 로그라이크가 같이 있는 세일작",
      "card tactics hybrid on sale",
      "action deckbuilder roguelite",
      "co-op survival 느낌인데 너무 빡세진 않은 게임",
      "RPG tactics mix 할인작",
      "party brawler with roguelite runs",
      "casual strategy hybrid game",
      "shooting deckbuilder sale",
      "story는 적고 tactics랑 card가 같이 있는 게임",
      "handheld-friendly action tactics hybrid"
    ],
    91
  )
];

export async function runDiverseRecommendationAudit(
  service: DiverseRecommendationAuditService,
  cases: DiverseRecommendationAuditCase[] = DIVERSE_RECOMMENDATION_AUDIT_CASES,
  options: DiverseRecommendationAuditRunOptions = {}
): Promise<DiverseRecommendationAuditRun> {
  const concurrency = normalizePositiveInt(
    options.concurrency,
    DEFAULT_DIVERSE_RECOMMENDATION_AUDIT_CONCURRENCY
  );
  const timeoutMs = normalizePositiveInt(
    options.timeoutMs,
    DEFAULT_DIVERSE_RECOMMENDATION_AUDIT_TIMEOUT_MS
  );
  const results = new Array<DiverseRecommendationAuditResult>(cases.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(cases.length, 1)) },
    async () => {
      while (true) {
        const current = cursor;
        cursor += 1;
        if (current >= cases.length) {
          return;
        }

        results[current] = await runDiverseRecommendationAuditCase(
          service,
          cases[current]!,
          timeoutMs
        );
      }
    }
  );

  await Promise.all(workers);

  const summary = summarizeDiverseRecommendationAuditResults(results);

  return {
    generatedAt: new Date().toISOString(),
    summary: summary.summary,
    groups: summary.groups,
    results
  };
}

export async function runLocalDiverseRecommendationAudit(
  env: ConfigSource = process.env,
  options: DiverseRecommendationAuditRunOptions = {}
): Promise<DiverseRecommendationAuditRun> {
  const service = createDefaultService(env);
  return runDiverseRecommendationAudit(service, DIVERSE_RECOMMENDATION_AUDIT_CASES, options);
}

export function summarizeDiverseRecommendationAuditResults(
  results: DiverseRecommendationAuditResult[]
): {
  summary: DiverseRecommendationAuditSummary;
  groups: Record<DiverseRecommendationAuditGroup, DiverseRecommendationAuditGroupSummary>;
} {
  const topCounts = countTopTitles(results);
  const groups = Object.fromEntries(
    DIVERSE_RECOMMENDATION_AUDIT_GROUPS.map((group) => {
      const groupResults = results.filter((result) => result.group === group);
      const groupTopCounts = countTopTitles(groupResults);

      return [
        group,
        {
          uniqueTopPicks: groupTopCounts.length,
          topCounts: groupTopCounts,
          flagged: groupResults.filter((result) => result.flagged).length,
          timeouts: groupResults.filter((result) => result.timeout).length
        } satisfies DiverseRecommendationAuditGroupSummary
      ];
    })
  ) as Record<DiverseRecommendationAuditGroup, DiverseRecommendationAuditGroupSummary>;

  return {
    summary: {
      total: results.length,
      zeroMatches: results.filter((result) => result.matchCount === 0).length,
      flagged: results.filter((result) => result.flagged).length,
      timeouts: results.filter((result) => result.timeout).length,
      topCounts
    },
    groups
  };
}

export function isDiverseRecommendationAuditFlagged(
  testCase: DiverseRecommendationAuditCase,
  topMatch: DiverseRecommendationAuditTopMatch | null
): boolean {
  if (!topMatch) {
    return true;
  }

  const requirements = inferPromptRequirements(testCase);

  if (requirements.needsSteamDeckSafe && topMatch.steamDeckStatus === "unsupported") {
    return true;
  }

  if (!matchesRequestedPlatform(testCase, topMatch)) {
    return true;
  }

  if (requirements.needsBudgetFit && isOverBudget(testCase, topMatch)) {
    return true;
  }

  if (requirements.needsMultiplayer && topMatch.multiplayer !== true) {
    return true;
  }

  if (requirements.needsDeck && !hasDeckOrCardEvidence(topMatch)) {
    return true;
  }

  if (requirements.needsStrategy && !hasStrategyEvidence(topMatch)) {
    return true;
  }

  if (requirements.needsAction && !hasActionEvidence(topMatch)) {
    return true;
  }

  if (requirements.needsRoguelike && !hasRoguelikeEvidence(topMatch)) {
    return true;
  }

  if (requirements.needsReview && !hasReviewSignal(topMatch)) {
    return true;
  }

  if (requirements.needsShortSession && !hasShortSessionFriendlyShape(topMatch)) {
    return true;
  }

  if (requirements.needsPartyShape && (!hasPartyOrSocialShape(topMatch) || isStoryFiller(topMatch))) {
    return true;
  }

  if (requirements.excludesDeck && hasDeckOrCardEvidence(topMatch)) {
    return true;
  }

  if (requirements.excludesStrategy && hasStrategyEvidence(topMatch)) {
    return true;
  }

  if (requirements.excludesTurnBased && hasTurnBasedEvidence(topMatch)) {
    return true;
  }

  if (requirements.excludesPvp && hasPvpEvidence(topMatch)) {
    return true;
  }

  if ((requirements.excludesRacing || requirements.excludesSports) && hasRacingSportsEvidence(topMatch)) {
    return true;
  }

  if (requirements.excludesHorror && hasHorrorEvidence(topMatch)) {
    return true;
  }

  if (requirements.excludesReadingHeavy && isReadingHeavy(topMatch)) {
    return true;
  }

  if (requirements.excludesStoryFiller && isStoryFiller(topMatch)) {
    return true;
  }

  if (
    testCase.group === "action-roguelite" &&
    (hasDeckOrCardEvidence(topMatch) || hasStrategyEvidence(topMatch) || hasTurnBasedEvidence(topMatch))
  ) {
    return true;
  }

  if (
    testCase.group === "multiplayer-social" &&
    requirements.needsMultiplayer &&
    !hasCoopOrTeamplayShape(topMatch) &&
    !hasPartyOrSocialShape(topMatch)
  ) {
    return true;
  }

  if (
    testCase.group === "genre-hybrid" &&
    countSatisfiedHybridAxes(requirements, topMatch) < 2
  ) {
    return true;
  }

  return false;
}

async function runDiverseRecommendationAuditCase(
  service: DiverseRecommendationAuditService,
  testCase: DiverseRecommendationAuditCase,
  timeoutMs: number
): Promise<DiverseRecommendationAuditResult> {
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

    const response = await withTimeout(service.recommendSaleGames(request), timeoutMs);

    const matches = Array.isArray(response.matches) ? response.matches : [];
    const topMatch = toAuditTopMatch(matches[0]);

    return {
      ...testCase,
      summary: response.summary,
      warnings: response.warnings ?? [],
      matchCount: matches.length,
      topTitle: topMatch?.title ?? null,
      topMatch,
      flagged: isDiverseRecommendationAuditFlagged(testCase, topMatch),
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
      flagged: true,
      timeout: isTimeoutError(error),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function inferPromptRequirements(testCase: DiverseRecommendationAuditCase) {
  const text = normalizeText(testCase.preferences);
  const sanitizedDeckText = text.replace(/steam deck|handheld deck/gi, " ");
  const sanitizedStrategyText = text.replace(
    /turn-based 말고|not turn-based|turn based 말고|턴제 말고/gi,
    " "
  );
  const needsDeck = /(deckbuilder|deckbuilding|card|cards|battler|hand|카드|덱|\bdeck\b)/i.test(
    sanitizedDeckText
  );
  const needsStrategy = /(strategy|tactics|tactical|turn-based|turn based|전략|전술|턴제)/i.test(
    sanitizedStrategyText
  );
  const needsAction = /(action|combat|shooter|shoot|hack|slash|arcade|총질|액션|전투|손맛)/i.test(
    text
  );
  const needsRoguelike = /(roguelike|roguelite|rogue|로그라이크|로그라이트)/i.test(text);
  const needsReview = /(well-reviewed|review|high-rated|highly rated|metacritic|평가|평점|리뷰|검증)/i.test(
    text
  );
  const needsMultiplayer =
    /(friends|co-?op|party|hangout|multiplayer|teamplay|친구|협동|파티|팀플|둘이서|같이)/i.test(text) ||
    testCase.group === "multiplayer-social";
  const needsPartyShape = /(party|hangout|funny|떠들면서|같이 웃으면서|party-friendly|party night|웃긴)/i.test(
    text
  );
  const needsShortSession =
    /(short|quick|20분|20 minute|20min|한 판|잠깐|틈틈이|quick run|short burst|짧은 세션|brain-off)/i.test(
      text
    ) || testCase.group === "short-session";
  const excludesDeck = /(카드 말고|deckbuilder 말고|deck 아닌|not deck|not deckbuilder)/i.test(text);
  const excludesStrategy = /(strategy 말고|grand strategy 말고|too complex|너무 복잡|마이너하지 않은|not too complex)/i.test(
    text
  );
  const excludesTurnBased = /(turn-based 말고|not turn-based|turn based 말고|턴제 말고)/i.test(text);
  const excludesPvp = /(not pvp|pvp 말고|non-competitive|경쟁 말고)/i.test(text);
  const excludesRacing = /(not racing|레이싱 말고|racing 말고)/i.test(text);
  const excludesSports = /(not sports|스포츠 말고|sports 말고)/i.test(text);
  const excludesHorror = /(not horror|horror 말고|공포 말고)/i.test(text);
  const excludesReadingHeavy = /(읽는 건 말고|text-heavy 말고|reading-heavy|too text-heavy|읽을 거리 너무 많은)/i.test(
    text
  );
  const excludesStoryFiller = /(filler도 말고|story-rich 말고|filler는 말고|story는 적고)/i.test(text);
  const needsSteamDeckSafe =
    testCase.platforms?.includes("Steam Deck") === true ||
    /(steam deck|handheld|핸드헬드|휴대용|스팀덱)/i.test(text);
  const needsBudgetFit = testCase.group === "budget-strict";

  return {
    needsDeck,
    needsStrategy,
    needsAction,
    needsRoguelike,
    needsReview,
    needsMultiplayer,
    needsPartyShape,
    needsShortSession,
    needsSteamDeckSafe,
    needsBudgetFit,
    excludesDeck,
    excludesStrategy,
    excludesTurnBased,
    excludesPvp,
    excludesRacing,
    excludesSports,
    excludesHorror,
    excludesReadingHeavy,
    excludesStoryFiller
  };
}

function toAuditTopMatch(value: unknown): DiverseRecommendationAuditTopMatch | null {
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
    platforms: Array.isArray(deal.platforms) ? deal.platforms : undefined,
    tags: Array.isArray((deal as { tags?: unknown }).tags)
      ? (((deal as { tags?: unknown }).tags as string[]) ?? undefined)
      : undefined,
    steamDeckStatus: deal.steamDeckCompatibility?.status ?? null
  };
}

function countTopTitles(results: DiverseRecommendationAuditResult[]): DiverseRecommendationAuditTopCount[] {
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

function collectText(match: DiverseRecommendationAuditTopMatch): string {
  return normalizeText(
    [match.title, ...(match.genres ?? []), ...(match.tags ?? []), ...(match.platforms ?? [])].join(" ")
  );
}

function hasDeckOrCardEvidence(match: DiverseRecommendationAuditTopMatch): boolean {
  return /\b(deck|deckbuilder|deckbuilding|card|cards|battler|hand)\b|카드|덱/i.test(
    collectText(match)
  );
}

function hasStrategyEvidence(match: DiverseRecommendationAuditTopMatch): boolean {
  return /\b(strategy|tactics|tactical|turn-based|turn based|4x)\b|전략|전술|턴제/i.test(
    collectText(match)
  );
}

function hasActionEvidence(match: DiverseRecommendationAuditTopMatch): boolean {
  return /\b(action|combat|shooter|shoot|hack|slash|arcade|brawler)\b|액션|전투|슈터|총질|손맛/i.test(
    collectText(match)
  );
}

function hasRoguelikeEvidence(match: DiverseRecommendationAuditTopMatch): boolean {
  return /\b(roguelike|roguelite|rogue)\b|로그라이크|로그라이트/i.test(collectText(match));
}

function hasTurnBasedEvidence(match: DiverseRecommendationAuditTopMatch): boolean {
  return /\b(turn-based|turn based)\b|턴제/i.test(collectText(match));
}

function hasCoopOrTeamplayShape(match: DiverseRecommendationAuditTopMatch): boolean {
  return /\b(co-?op|cooperative|teamplay|team-based|multiplayer)\b|협동|팀플|멀티/i.test(
    collectText(match)
  );
}

function hasPartyOrSocialShape(match: DiverseRecommendationAuditTopMatch): boolean {
  return /\b(party|casual|fun|brawler)\b|파티|캐주얼|웃긴/i.test(collectText(match));
}

function hasShortSessionFriendlyShape(match: DiverseRecommendationAuditTopMatch): boolean {
  return (
    hasDeckOrCardEvidence(match) ||
    hasRoguelikeEvidence(match) ||
    hasActionEvidence(match) ||
    hasPartyOrSocialShape(match) ||
    /\b(casual|arcade)\b|캐주얼/i.test(collectText(match))
  );
}

function hasReviewSignal(match: DiverseRecommendationAuditTopMatch): boolean {
  return (match.rating ?? 0) >= 4 || (match.metacritic ?? 0) >= 75;
}

function hasPvpEvidence(match: DiverseRecommendationAuditTopMatch): boolean {
  return /\b(pvp|versus|competitive|battle royale)\b|대전|경쟁/i.test(collectText(match));
}

function hasRacingSportsEvidence(match: DiverseRecommendationAuditTopMatch): boolean {
  return /\b(racing|sports)\b|레이싱|스포츠/i.test(collectText(match));
}

function hasHorrorEvidence(match: DiverseRecommendationAuditTopMatch): boolean {
  return /\b(horror)\b|공포/i.test(collectText(match));
}

function isReadingHeavy(match: DiverseRecommendationAuditTopMatch): boolean {
  return /\b(text-heavy|visual novel|grand strategy|management|wargame)\b|텍스트|비주얼 노벨|운영/i.test(
    collectText(match)
  );
}

function isStoryFiller(match: DiverseRecommendationAuditTopMatch): boolean {
  return /\b(story|story-rich|narrative|adventure|puzzle|solo|single-player|single player)\b|스토리|어드벤처|퍼즐/i.test(
    collectText(match)
  );
}

function isOverBudget(
  testCase: DiverseRecommendationAuditCase,
  topMatch: DiverseRecommendationAuditTopMatch
): boolean {
  return (
    typeof testCase.budget === "number" &&
    typeof topMatch.price?.amount === "number" &&
    topMatch.price.amount > testCase.budget
  );
}

function matchesRequestedPlatform(
  testCase: DiverseRecommendationAuditCase,
  topMatch: DiverseRecommendationAuditTopMatch
): boolean {
  if (!testCase.platforms?.length || !topMatch.platforms?.length) {
    return true;
  }

  if (testCase.platforms.includes("Steam Deck")) {
    return true;
  }

  const requested = new Set(testCase.platforms.map((platform) => platform.toLowerCase()));
  return topMatch.platforms.some((platform) => requested.has(platform.toLowerCase()));
}

function countSatisfiedHybridAxes(
  requirements: ReturnType<typeof inferPromptRequirements>,
  topMatch: DiverseRecommendationAuditTopMatch
): number {
  let count = 0;
  if (requirements.needsDeck && hasDeckOrCardEvidence(topMatch)) {
    count += 1;
  }
  if (requirements.needsStrategy && hasStrategyEvidence(topMatch)) {
    count += 1;
  }
  if (requirements.needsAction && hasActionEvidence(topMatch)) {
    count += 1;
  }
  if (requirements.needsRoguelike && hasRoguelikeEvidence(topMatch)) {
    count += 1;
  }
  if (requirements.needsMultiplayer && topMatch.multiplayer === true) {
    count += 1;
  }
  return count;
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

function normalizeText(value: string): string {
  return value.toLowerCase();
}

function buildCases(
  group: DiverseRecommendationAuditGroup,
  platforms: string[],
  budget: number,
  preferences: string[],
  startIndex: number
): DiverseRecommendationAuditCase[] {
  return preferences.map((value, index) => ({
    index: startIndex + index,
    group,
    preferences: value,
    budget,
    platforms,
    country: "KR"
  }));
}

function buildVariableCases(
  group: DiverseRecommendationAuditGroup,
  startIndex: number,
  cases: Array<{ preferences: string; budget: number; platforms: string[] }>
): DiverseRecommendationAuditCase[] {
  return cases.map((value, index) => ({
    index: startIndex + index,
    group,
    preferences: value.preferences,
    budget: value.budget,
    platforms: value.platforms,
    country: "KR"
  }));
}
