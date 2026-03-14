import type { DealCandidate } from "./score.js";
import {
  filterRecommendationRequiredConstraints,
  type RecommendationConstraints
} from "./recommendation-constraints.js";

export interface RecommendationDegradedModePreferences {
  genres: string[];
  rawgGenres: string[];
  platforms: string[];
  tags: string[];
  multiplayer: boolean;
  deckbuilding: boolean;
  highRating: boolean;
  shortSession: boolean;
}

export interface RecommendationDegradedModeResult {
  matches: DealCandidate[];
  applied: boolean;
}

export const RECOMMENDATION_DEGRADED_MODE_WARNING =
  "메타데이터가 불안정해 완화된 추천 기준을 적용했습니다.";

const DEGRADED_MODE_WARNING_PATTERNS = [
  /RAWG.*5\d\d/i,
  /일부 메타데이터를 생략했습니다\./,
  /응답 시간을 맞추기 위해 일부 추천 후보 보강을 생략했습니다\./,
  /Steam Deck 호환성 정보를 일부 확인하지 못했습니다\./,
  /RAWG 메타데이터를 불러오지 못해 가격 정보만 표시했습니다\./,
  /추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다\./,
  /추가 추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다\./
] as const;

export function applyRecommendationDegradedMode(args: {
  deals: DealCandidate[];
  warnings: string[];
  preferences: RecommendationDegradedModePreferences;
  steamDeckRequest: boolean;
  constraints: RecommendationConstraints;
}): RecommendationDegradedModeResult {
  if (!hasRecommendationDegradedModeSignal(args.warnings)) {
    return { matches: [], applied: false };
  }

  const candidates = filterRecommendationRequiredConstraints(dedupeDeals(args.deals), args.constraints);
  if (candidates.length === 0) {
    return { matches: [], applied: false };
  }

  if (args.preferences.deckbuilding || args.constraints.deckPreference === "required") {
    const matches = candidates.filter(
      (deal) =>
        hasDegradedDeckbuildingEvidence(deal) &&
        (!args.steamDeckRequest || getDeckStatus(deal) !== "unsupported")
    );
    return { matches, applied: matches.length > 0 };
  }

  if (args.preferences.multiplayer) {
    const partyPrompt = args.constraints.coopMode.includes("party");
    const matches = candidates.filter(
      (deal) =>
        deal.cut > 0 &&
        deal.multiplayer &&
        (partyPrompt ? hasPartyFriendlyEvidence(deal) : hasSocialCoopEvidence(deal)) &&
        (!args.constraints.excludeGenres.includes("pvp") || !hasPvPEvidence(deal)) &&
        (!args.constraints.coopMode.includes("non-competitive") || !hasPvPEvidence(deal)) &&
        (!args.constraints.excludeGenres.includes("racing") || !hasRacingOrSportsEvidence(deal)) &&
        (!args.constraints.excludeGenres.includes("sports") || !hasRacingOrSportsEvidence(deal)) &&
        (!partyPrompt || !hasStoryAdventurePuzzleEvidence(deal))
    );
    return { matches, applied: matches.length > 0 };
  }

  const actionRogueliteIntent =
    hasActionRogueliteIntent(args.preferences.genres) ||
    (hasRoguelikeIntent(args.preferences.genres) &&
      (args.constraints.actionBias ||
        args.constraints.excludeGameplay.includes("turn-based") ||
        args.constraints.excludeGenres.includes("strategy") ||
        args.constraints.excludeGenres.includes("card/deckbuilder")));
  if (actionRogueliteIntent) {
    const matches = candidates.filter(
      (deal) =>
        hasActionRogueliteEvidence(deal) &&
        (!args.constraints.excludeGameplay.includes("turn-based") || !hasTurnBasedEvidence(deal)) &&
        (!args.constraints.excludeGenres.includes("strategy") || !hasStrategyTacticsEvidence(deal)) &&
        (!args.constraints.excludeGenres.includes("card/deckbuilder") || !hasDegradedDeckbuildingEvidence(deal)) &&
        (!args.steamDeckRequest || getDeckStatus(deal) !== "unsupported")
    );
    return { matches, applied: matches.length > 0 };
  }

  const genericRoguelikeIntent =
    hasRoguelikeIntent(args.preferences.genres) &&
    !args.preferences.deckbuilding &&
    !actionRogueliteIntent;

  if (args.steamDeckRequest && genericRoguelikeIntent) {
    const matches = candidates.filter(
      (deal) => getDeckStatus(deal) !== "unsupported" && hasRoguelikeDealEvidence(deal)
    );
    return { matches, applied: matches.length > 0 };
  }

  if (
    args.preferences.highRating &&
    args.preferences.rawgGenres.includes("strategy") &&
    !args.steamDeckRequest
  ) {
    const matches = candidates.filter(
      (deal) =>
        deal.cut > 0 &&
        hasStrongReviewSignal(deal) &&
        hasStrategyTacticsEvidence(deal) &&
        !(
          (args.constraints.excludeGenres.includes("strategy") ||
            args.constraints.strategyPreference === "avoid") &&
          hasStrategyTacticsEvidence(deal)
        ) &&
        (!args.constraints.avoidComplexity.includes("complex-strategy") ||
          !hasHeavyStrategyEvidence(deal) ||
          hasTacticsEvidence(deal)) &&
        (!args.constraints.avoidComplexity.includes("reading-heavy") ||
          !hasReadingHeavyEvidence(deal)) &&
        (!args.constraints.avoidComplexity.includes("long-session") ||
          !hasLongSessionEvidence(deal))
    );
    return { matches, applied: matches.length > 0 };
  }

  if (args.steamDeckRequest && args.preferences.highRating && args.preferences.rawgGenres.includes("strategy")) {
    const matches = candidates.filter(
      (deal) =>
        getDeckStatus(deal) !== "unsupported" &&
        hasStrongReviewSignal(deal) &&
        hasStrategyTacticsEvidence(deal)
    );
    return { matches, applied: matches.length > 0 };
  }

  if (genericRoguelikeIntent) {
    const matches = candidates.filter(
      (deal) =>
        hasRoguelikeDealEvidence(deal) &&
        hasStrongReviewSignal(deal) &&
        (!args.steamDeckRequest || getDeckStatus(deal) !== "unsupported")
    );
    return { matches, applied: matches.length > 0 };
  }

  return { matches: [], applied: false };
}

function hasRecommendationDegradedModeSignal(warnings: string[]): boolean {
  return warnings.some((warning) =>
    DEGRADED_MODE_WARNING_PATTERNS.some((pattern) => pattern.test(warning))
  );
}

function hasActionRogueliteIntent(genres: string[]): boolean {
  const normalizedGenres = new Set(genres.map((genre) => genre.trim().toLowerCase()));
  return normalizedGenres.has("action") && normalizedGenres.has("roguelike");
}

function hasRoguelikeIntent(genres: string[]): boolean {
  return genres.some((genre) => genre.trim().toLowerCase() === "roguelike");
}

function hasStrongReviewSignal(deal: DealCandidate): boolean {
  return (deal.rating ?? 0) >= 4 || (deal.metacritic ?? 0) >= 75;
}

function hasRoguelikeDealEvidence(deal: DealCandidate): boolean {
  return deal.genres.some((genre) => {
    const normalized = genre.trim().toLowerCase();
    return normalized === "roguelike" || normalized === "roguelite";
  });
}

function hasDegradedDeckbuildingEvidence(deal: DealCandidate): boolean {
  return /\b(deck|deckbuilder|deckbuilding|card|cards|hand|battler)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasStrategyTacticsEvidence(deal: DealCandidate): boolean {
  return /\b(strategy|strategic|tactics?|tactical|turn-?based)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasTacticsEvidence(deal: DealCandidate): boolean {
  return /\b(tactics?|tactical|turn-?based)\b/i.test(`${deal.title} ${deal.genres.join(" ")}`) ||
    /전술|턴제/.test(`${deal.title} ${deal.genres.join(" ")}`);
}

function hasActionRogueliteEvidence(deal: DealCandidate): boolean {
  return /\b(action|combat|shooter|shooting|brawler)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  ) && hasRoguelikeDealEvidence(deal);
}

function hasTurnBasedEvidence(deal: DealCandidate): boolean {
  return /\b(turn-?based)\b/i.test(`${deal.title} ${deal.genres.join(" ")}`) || /턴제/.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasHeavyStrategyEvidence(deal: DealCandidate): boolean {
  return /\b(grand strategy|4x|simulation|management|wargame)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasReadingHeavyEvidence(deal: DealCandidate): boolean {
  return /\b(text-heavy|reading-heavy|story rich|visual novel|narrative)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasLongSessionEvidence(deal: DealCandidate): boolean {
  return /\b(grand strategy|4x|simulation|management|wargame|campaign)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasPartyFriendlyEvidence(deal: DealCandidate): boolean {
  return /\b(casual|arcade|party|brawler|fun|hangout|co-?op|coop)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasSocialCoopEvidence(deal: DealCandidate): boolean {
  return (
    hasPartyFriendlyEvidence(deal) ||
    /\b(co-?op|coop|cooperative|teamplay|team-based|multiplayer)\b/i.test(
      `${deal.title} ${deal.genres.join(" ")}`
    )
  );
}

function hasPvPEvidence(deal: DealCandidate): boolean {
  return /\b(pvp|versus|vs|competitive|battle royale)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasRacingOrSportsEvidence(deal: DealCandidate): boolean {
  return /\b(racing|sports)\b/i.test(`${deal.title} ${deal.genres.join(" ")}`);
}

function hasStoryAdventurePuzzleEvidence(deal: DealCandidate): boolean {
  return /\b(adventure|puzzle|story|narrative)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function getDeckStatus(
  deal: DealCandidate
): NonNullable<DealCandidate["steamDeckCompatibility"]>["status"] {
  return deal.steamDeckCompatibility?.status ?? "unknown";
}

function dedupeDeals(deals: DealCandidate[]): DealCandidate[] {
  const seen = new Set<string>();
  const unique: DealCandidate[] = [];

  for (const deal of deals) {
    const key = deal.id || deal.title.trim().toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(deal);
  }

  return unique;
}
