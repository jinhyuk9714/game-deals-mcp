import type { RecommendationIntent } from "./intent-lexicon.js";
import type { DealCandidate } from "./score.js";
import type { CatalogCandidate } from "./service.js";
import {
  matchesRecommendationHardConstraints,
  type RecommendationConstraints
} from "./recommendation-constraints.js";

export interface RecommendationRetrievalSignals {
  broadCoop: boolean;
  highRatingStrategy: boolean;
  tacticsPrompt: boolean;
  steamDeckOverlay: boolean;
  explicitRacingOrSports: boolean;
}

export interface RecommendationCatalogMixProfile {
  kind: "broad-coop" | "high-rating-strategy" | "steam-deck-overlay";
  tags: string[];
  rawgGenres: string[];
  limit: number;
  maxResolutions: number;
  maxMatches: number;
}

export function buildRecommendationCatalogMixPlan(options: {
  rawPreferences: string;
  preferences: RecommendationIntent;
  platforms: string[];
  currentMatches: DealCandidate[];
  constraints: RecommendationConstraints;
}): {
  signals: RecommendationRetrievalSignals;
  profiles: RecommendationCatalogMixProfile[];
} {
  const signals = buildRecommendationRetrievalSignals(options);
  const profiles: RecommendationCatalogMixProfile[] = [];

  if (signals.broadCoop) {
    profiles.push({
      kind: "broad-coop",
      tags: ["multiplayer"],
      rawgGenres: ["action", "casual"],
      limit: 8,
      maxResolutions: 4,
      maxMatches: 2
    });
  }

  if (signals.highRatingStrategy) {
    profiles.push({
      kind: "high-rating-strategy",
      tags: [],
      rawgGenres: ["strategy"],
      limit: 8,
      maxResolutions: 4,
      maxMatches: 2
    });
  }

  if (
    signals.steamDeckOverlay &&
    (options.preferences.tags.length > 0 || options.preferences.rawgGenres.length > 0)
  ) {
    profiles.push({
      kind: "steam-deck-overlay",
      tags: [...options.preferences.tags],
      rawgGenres: [...options.preferences.rawgGenres],
      limit: 6,
      maxResolutions: 3,
      maxMatches: 3
    });
  }

  return {
    signals,
    profiles
  };
}

export function filterRecommendationCatalogCandidates(
  candidates: CatalogCandidate[],
  profile: RecommendationCatalogMixProfile,
  signals: RecommendationRetrievalSignals,
  constraints: RecommendationConstraints
): CatalogCandidate[] {
  return [...candidates]
    .filter(
      (candidate) =>
        matchesRecommendationHardConstraints(candidate, constraints) &&
        matchesRecommendationCatalogCandidate(candidate, profile, signals)
    )
    .sort((left, right) => {
      const scoreDifference =
        getRecommendationCatalogCandidateScore(right, profile, signals) -
        getRecommendationCatalogCandidateScore(left, profile, signals);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return left.title.localeCompare(right.title);
    });
}

export function splitRecommendationCatalogResolvedDeals(
  deals: DealCandidate[],
  profile: RecommendationCatalogMixProfile,
  signals: RecommendationRetrievalSignals,
  constraints: RecommendationConstraints
): {
  accepted: DealCandidate[];
  unknownFallback: DealCandidate[];
} {
  const accepted: DealCandidate[] = [];
  const unknownFallback: DealCandidate[] = [];

  for (const deal of deals) {
    if (!matchesRecommendationHardConstraints(deal, constraints)) {
      continue;
    }

    switch (profile.kind) {
      case "broad-coop":
        if (
          deal.multiplayer &&
          hasCoopFriendlyShape(deal) &&
          (signals.explicitRacingOrSports || !hasRacingOrSportsShape(deal))
        ) {
          accepted.push(deal);
        }
        break;
      case "high-rating-strategy":
        if (hasStrategyShape(deal) && hasReviewSignal(deal)) {
          accepted.push(deal);
        }
        break;
      case "steam-deck-overlay": {
        if (!hasReviewSignal(deal)) {
          break;
        }

        const deckStatus = getDeckCompatibilityStatus(deal);
        if (deckStatus === "verified" || deckStatus === "playable") {
          accepted.push(deal);
        } else if (deckStatus === "unknown") {
          unknownFallback.push(deal);
        }
        break;
      }
    }
  }

  return {
    accepted,
    unknownFallback
  };
}

function buildRecommendationRetrievalSignals(options: {
  rawPreferences: string;
  preferences: RecommendationIntent;
  platforms: string[];
  currentMatches: DealCandidate[];
}): RecommendationRetrievalSignals {
  const normalizedGenres = new Set(
    options.preferences.genres.map((genre) => genre.trim().toLowerCase())
  );
  const explicitRacingOrSports = /레이싱|racing|sports|스포츠/i.test(options.rawPreferences);
  const actionRogueliteIntent =
    normalizedGenres.has("action") &&
    (normalizedGenres.has("roguelike") || normalizedGenres.has("roguelite"));
  const genericRoguelikeIntent =
    (normalizedGenres.has("roguelike") || normalizedGenres.has("roguelite")) &&
    !options.preferences.deckbuilding &&
    !actionRogueliteIntent;
  const supportedDeckCount = options.currentMatches.filter((deal) => {
    const status = getDeckCompatibilityStatus(deal);
    return status === "verified" || status === "playable";
  }).length;

  return {
    broadCoop:
      options.preferences.multiplayer &&
      !options.preferences.deckbuilding &&
      !actionRogueliteIntent &&
      !explicitRacingOrSports,
    highRatingStrategy:
      options.preferences.highRating &&
      options.preferences.rawgGenres.some((genre) => genre.trim().toLowerCase() === "strategy"),
    tacticsPrompt: /전술|tactics|turn-?based|턴제/i.test(options.rawPreferences),
    steamDeckOverlay:
      options.platforms.some((platform) => /steam ?deck|스팀덱/i.test(platform)) &&
      supportedDeckCount < 3 &&
      !options.preferences.deckbuilding &&
      !actionRogueliteIntent &&
      !genericRoguelikeIntent,
    explicitRacingOrSports
  };
}

function matchesRecommendationCatalogCandidate(
  candidate: CatalogCandidate,
  profile: RecommendationCatalogMixProfile,
  signals: RecommendationRetrievalSignals
): boolean {
  switch (profile.kind) {
    case "broad-coop":
      return (
        candidate.multiplayer &&
        hasReviewSignal(candidate) &&
        hasCoopFriendlyShape(candidate) &&
        (signals.explicitRacingOrSports || !hasRacingOrSportsShape(candidate))
      );
    case "high-rating-strategy":
      return hasStrategyShape(candidate) && hasReviewSignal(candidate);
    case "steam-deck-overlay":
      return hasReviewSignal(candidate);
  }
}

function getRecommendationCatalogCandidateScore(
  candidate: CatalogCandidate,
  profile: RecommendationCatalogMixProfile,
  signals: RecommendationRetrievalSignals
): number {
  let score = getReviewScore(candidate);

  switch (profile.kind) {
    case "broad-coop":
      if (hasCoopFriendlyShape(candidate)) {
        score += 120;
      }
      if (hasPartyFriendlyShape(candidate)) {
        score += 100;
      }
      if (!signals.explicitRacingOrSports && hasRacingOrSportsShape(candidate)) {
        score -= 240;
      }
      break;
    case "high-rating-strategy":
      if (hasStrategyShape(candidate)) {
        score += 120;
      }
      if (signals.tacticsPrompt && hasTacticsShape(candidate)) {
        score += 160;
      }
      break;
    case "steam-deck-overlay":
      if (signals.tacticsPrompt && hasTacticsShape(candidate)) {
        score += 40;
      }
      break;
  }

  return score;
}

function hasReviewSignal(value: {
  rating?: number | null | undefined;
  metacritic?: number | null | undefined;
}): boolean {
  return (value.rating ?? 0) >= 4 || (value.metacritic ?? 0) >= 75;
}

function getReviewScore(value: {
  rating?: number | null | undefined;
  metacritic?: number | null | undefined;
}): number {
  return Math.max((value.rating ?? 0) * 20, value.metacritic ?? 0);
}

function hasCoopFriendlyShape(value: { title: string; genres: string[]; tags?: string[] | undefined }): boolean {
  const normalizedGenres = new Set(value.genres.map((genre) => genre.trim().toLowerCase()));
  const normalizedTags = new Set((value.tags ?? []).map((tag) => tag.trim().toLowerCase()));

  return (
    normalizedGenres.has("action") ||
    normalizedGenres.has("casual") ||
    normalizedGenres.has("arcade") ||
    normalizedGenres.has("party") ||
    normalizedTags.has("party")
  );
}

function hasPartyFriendlyShape(value: {
  title: string;
  genres: string[];
  tags?: string[] | undefined;
}): boolean {
  const haystack = `${value.title} ${value.genres.join(" ")} ${(value.tags ?? []).join(" ")}`.toLowerCase();
  return /\b(party|brawler|beat ?em ?up|fun)\b/.test(haystack) || hasCoopFriendlyShape(value);
}

function hasRacingOrSportsShape(value: {
  title: string;
  genres: string[];
  tags?: string[] | undefined;
}): boolean {
  const normalizedGenres = new Set(value.genres.map((genre) => genre.trim().toLowerCase()));
  const normalizedTags = new Set((value.tags ?? []).map((tag) => tag.trim().toLowerCase()));

  return (
    normalizedGenres.has("racing") ||
    normalizedGenres.has("sports") ||
    normalizedTags.has("racing") ||
    normalizedTags.has("sports")
  );
}

function hasStrategyShape(value: {
  title: string;
  genres: string[];
  tags?: string[] | undefined;
}): boolean {
  const normalizedGenres = new Set(value.genres.map((genre) => genre.trim().toLowerCase()));
  const normalizedTags = new Set((value.tags ?? []).map((tag) => tag.trim().toLowerCase()));

  return normalizedGenres.has("strategy") || normalizedTags.has("strategy");
}

function hasTacticsShape(value: {
  title: string;
  genres: string[];
  tags?: string[] | undefined;
}): boolean {
  const haystack = `${value.title} ${value.genres.join(" ")} ${(value.tags ?? []).join(" ")}`.toLowerCase();
  return /\b(tactics|tactical|turn-?based)\b/.test(haystack) || /전술|턴제/.test(haystack);
}

function getDeckCompatibilityStatus(
  deal: DealCandidate
): NonNullable<DealCandidate["steamDeckCompatibility"]>["status"] {
  return deal.steamDeckCompatibility?.status ?? "unknown";
}
