import type { RecommendationIntent } from "./intent-lexicon.js";
import type { DealCandidate, SteamDeckCompatibility } from "./score.js";
import {
  getRecommendationConstraintScore,
  type RecommendationConstraints
} from "./recommendation-constraints.js";

interface RecommendationRerankSignals {
  broadCoop: boolean;
  partyPrompt: boolean;
  highRatingStrategy: boolean;
  tacticsPrompt: boolean;
  fastPacedRoguelike: boolean;
  steamDeckPrompt: boolean;
  explicitRacingOrSports: boolean;
}

export function applyRecommendationReranker(
  deals: DealCandidate[],
  options: {
    rawPreferences: string;
    preferences: RecommendationIntent;
    platforms: string[];
    constraints: RecommendationConstraints;
  }
): DealCandidate[] {
  const signals = buildRecommendationRerankSignals(options.rawPreferences, options.preferences, options.platforms);

  if (
    deals.length <= 1 ||
    (!signals.broadCoop &&
      !signals.highRatingStrategy &&
      !signals.fastPacedRoguelike &&
      !signals.steamDeckPrompt &&
      !hasActiveConstraintSignals(options.constraints))
  ) {
    return deals;
  }

  const originalOrder = new Map(
    deals.map((deal, index) => [deal.id || normalizeTitleKey(deal.title), index])
  );

  return [...deals].sort((left, right) => {
    const scoreDifference =
      getRecommendationRerankScore(right, signals, options.constraints) -
      getRecommendationRerankScore(left, signals, options.constraints);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return (
      (originalOrder.get(left.id || normalizeTitleKey(left.title)) ?? 0) -
      (originalOrder.get(right.id || normalizeTitleKey(right.title)) ?? 0)
    );
  });
}

function buildRecommendationRerankSignals(
  rawPreferences: string,
  preferences: RecommendationIntent,
  platforms: string[]
): RecommendationRerankSignals {
  const normalizedGenres = new Set(preferences.genres.map((genre) => genre.trim().toLowerCase()));
  const steamDeckPrompt = platforms.some((platform) => /steam ?deck|스팀덱/i.test(platform));

  return {
    broadCoop: preferences.multiplayer,
    partyPrompt: /파티|웃긴|떠들|친구(?:들이)?랑.*(?:같이|놀)|party/i.test(rawPreferences),
    highRatingStrategy: preferences.highRating && normalizedGenres.has("strategy"),
    tacticsPrompt: /전술|tactics|turn-?based|턴제/i.test(rawPreferences),
    fastPacedRoguelike:
      (normalizedGenres.has("roguelike") || /로그라이크|로그라이트|roguelike|roguelite/i.test(rawPreferences)) &&
      !preferences.deckbuilding &&
      (/빠른|템포|손맛|액션성|tempo|fast/i.test(rawPreferences) || preferences.shortSession),
    steamDeckPrompt,
    explicitRacingOrSports: /레이싱|racing|sports|스포츠/i.test(rawPreferences)
  };
}

function getRecommendationRerankScore(
  deal: DealCandidate,
  signals: RecommendationRerankSignals,
  constraints: RecommendationConstraints
): number {
  let score = getRecommendationConstraintScore(deal, constraints);

  if (signals.broadCoop) {
    if (deal.multiplayer) {
      score += 120;
    } else {
      score -= signals.partyPrompt ? 320 : 240;
    }

    if (hasCoopFriendlyShape(deal)) {
      score += 90;
    }

    if (signals.partyPrompt && hasPartyFriendlyShape(deal)) {
      score += 120;
    }

    if (signals.partyPrompt && hasStoryAdventurePuzzleFillerShape(deal)) {
      score -= 220;
    }

    if (!signals.explicitRacingOrSports && hasRacingOrSportsShape(deal)) {
      score -= 220;
    }

    if (constraints.coopMode.includes("non-competitive") && hasPvPShape(deal)) {
      score -= 260;
    }

    score += getReviewScore(deal) >= 75 ? 50 : -40;
  }

  if (signals.highRatingStrategy) {
    if (hasStrategyShape(deal)) {
      score += 100;
    }

    score += getReviewScore(deal) >= 85 ? 90 : getReviewScore(deal) >= 75 ? 40 : -60;

    if ((deal.metacritic ?? 0) >= 80) {
      score += 70;
    }

    if (signals.tacticsPrompt && hasTacticsShape(deal)) {
      score += 130;
    }

    if (looksLikeDiscountDrivenStrategyOutlier(deal)) {
      score -= 120;
    }

    if (constraints.avoidComplexity.includes("complex-strategy")) {
      score += hasHeavyStrategyShape(deal) ? -220 : 40;
      score += hasTacticsShape(deal) ? 80 : 0;
    }

    if (constraints.avoidComplexity.includes("reading-heavy")) {
      score += hasReadingHeavyStrategyShape(deal) ? -260 : 35;
    }

    if (constraints.avoidComplexity.includes("long-session")) {
      score += hasLongSessionStrategyShape(deal) ? -180 : 30;
    }
  }

  if (signals.fastPacedRoguelike) {
    if (hasActionRogueliteShape(deal)) {
      score += 160;
    }

    if (hasDeckOrCardShape(deal)) {
      score -= 150;
    }

    if (hasStrategyOnlyRoguelikeShape(deal)) {
      score -= 60;
    }
  }

  if (signals.steamDeckPrompt) {
    switch (deal.steamDeckCompatibility?.status ?? "unknown") {
      case "verified":
        score += 80;
        break;
      case "playable":
        score += 70;
        break;
      case "unknown":
        score -= 60;
        break;
      case "unsupported":
        score -= 140;
        break;
    }
  }

  return score;
}

function hasCoopFriendlyShape(deal: DealCandidate): boolean {
  const normalizedGenres = new Set(deal.genres.map((genre) => genre.trim().toLowerCase()));
  return (
    normalizedGenres.has("action") ||
    normalizedGenres.has("casual") ||
    normalizedGenres.has("arcade") ||
    normalizedGenres.has("party")
  );
}

function hasPartyFriendlyShape(deal: DealCandidate): boolean {
  const values = `${deal.title} ${deal.genres.join(" ")}`.toLowerCase();
  return /\b(party|brawler|beat ?em ?up|fun|hangout)\b/.test(values) || hasCoopFriendlyShape(deal);
}

function hasRacingOrSportsShape(deal: DealCandidate): boolean {
  const normalizedGenres = new Set(deal.genres.map((genre) => genre.trim().toLowerCase()));
  return normalizedGenres.has("racing") || normalizedGenres.has("sports");
}

function hasPvPShape(deal: DealCandidate): boolean {
  return /\b(pvp|versus|vs|competitive|battle royale)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasStoryAdventurePuzzleFillerShape(deal: DealCandidate): boolean {
  return /\b(adventure|puzzle|story|narrative)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasStrategyShape(deal: DealCandidate): boolean {
  return deal.genres.some((genre) => genre.trim().toLowerCase() === "strategy");
}

function hasTacticsShape(deal: DealCandidate): boolean {
  const values = `${deal.title} ${deal.genres.join(" ")}`.toLowerCase();
  return /\b(tactics|tactical|turn-?based)\b/.test(values) || /전술|턴제/.test(values);
}

function looksLikeDiscountDrivenStrategyOutlier(deal: DealCandidate): boolean {
  return (
    hasStrategyShape(deal) &&
    deal.cut >= 70 &&
    (deal.metacritic ?? 0) < 75 &&
    /[:\-]/.test(deal.title)
  );
}

function hasHeavyStrategyShape(deal: DealCandidate): boolean {
  return /\b(grand strategy|4x|management|wargame|simulation|campaign)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasReadingHeavyStrategyShape(deal: DealCandidate): boolean {
  return /\b(text-heavy|reading-heavy|story rich|visual novel|narrative)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasLongSessionStrategyShape(deal: DealCandidate): boolean {
  return /\b(grand strategy|4x|management|simulation|campaign|wargame)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasActionRogueliteShape(deal: DealCandidate): boolean {
  const normalizedGenres = new Set(deal.genres.map((genre) => genre.trim().toLowerCase()));
  return normalizedGenres.has("action") && hasRoguelikeShape(deal);
}

function hasStrategyOnlyRoguelikeShape(deal: DealCandidate): boolean {
  const normalizedGenres = new Set(deal.genres.map((genre) => genre.trim().toLowerCase()));
  return normalizedGenres.has("strategy") && hasRoguelikeShape(deal) && !normalizedGenres.has("action");
}

function hasDeckOrCardShape(deal: DealCandidate): boolean {
  const values = `${deal.title} ${deal.genres.join(" ")}`.toLowerCase();
  return /\b(deck|deckbuilder|deckbuilding|card|cards|hand)\b/.test(values);
}

function hasRoguelikeShape(deal: DealCandidate): boolean {
  return deal.genres.some((genre) => {
    const normalized = genre.trim().toLowerCase();
    return normalized === "roguelike" || normalized === "roguelite";
  });
}

function getReviewScore(deal: DealCandidate): number {
  return Math.max((deal.rating ?? 0) * 20, deal.metacritic ?? 0);
}

function normalizeTitleKey(value: string): string {
  return value.trim().toLowerCase();
}

function hasActiveConstraintSignals(constraints: RecommendationConstraints): boolean {
  return (
    constraints.actionBias ||
    constraints.excludeGameplay.length > 0 ||
    constraints.excludeGenres.length > 0 ||
    constraints.coopMode.length > 0 ||
    constraints.avoidComplexity.length > 0 ||
    constraints.preferSession.length > 0 ||
    constraints.qualityIntent.length > 0 ||
    constraints.deckSignal ||
    constraints.strategySignal
  );
}
