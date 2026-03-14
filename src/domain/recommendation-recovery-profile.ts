import type { RecommendationIntent } from "./intent-lexicon.js";
import type { RecommendationConstraints } from "./recommendation-constraints.js";
import type { DealCandidate } from "./score.js";

export type RecommendationRecoveryKind =
  | "broad-multiplayer"
  | "steam-deck-roguelike"
  | "steam-deck-strategy-roguelike"
  | "steam-deck-strategy"
  | "deckbuilding-card"
  | "non-steam-strategy-rating";

export interface RecommendationRecoveryQuery {
  tags?: string[] | undefined;
  rawgGenres?: string[] | undefined;
  limit: number;
}

export interface RecommendationRecoveryProfile {
  kind: RecommendationRecoveryKind;
  queries: RecommendationRecoveryQuery[];
  maxDiscoverCalls: number;
  maxResolutions: number;
  maxMatches: number;
}

export function buildRecommendationSparseRecoveryProfile(options: {
  currentMatches: DealCandidate[];
  preferences: RecommendationIntent;
  constraints: RecommendationConstraints;
  steamDeckRequest: boolean;
  simpleSocialPrompt?: boolean | undefined;
}): RecommendationRecoveryProfile | null {
  const top = options.currentMatches[0];

  if (
    (options.constraints.deckPreference === "required" || options.constraints.deckSignal) &&
    (!top || !hasDeckOrCardEvidence(top))
  ) {
    return {
      kind: "deckbuilding-card",
      queries: [
        { tags: ["roguelike-deckbuilder"], limit: 8 },
        { rawgGenres: ["card"], limit: 8 }
      ],
      maxDiscoverCalls: 2,
      maxResolutions: 6,
      maxMatches: 2
    };
  }

  if (
    !options.steamDeckRequest &&
    options.currentMatches.length === 0 &&
    options.preferences.highRating &&
    options.preferences.rawgGenres.some((genre) => genre.trim().toLowerCase() === "strategy")
  ) {
    return {
      kind: "non-steam-strategy-rating",
      queries: [{ rawgGenres: ["strategy"], limit: 8 }],
      maxDiscoverCalls: 1,
      maxResolutions: 6,
      maxMatches: 2
    };
  }

  if (options.steamDeckRequest && options.currentMatches.length === 0) {
    if (hasStrategyIntent(options.preferences, options.constraints) && hasRoguelikeIntent(options.preferences.genres)) {
      return {
        kind: "steam-deck-strategy-roguelike",
        queries: [{ tags: ["roguelike", "roguelite"], rawgGenres: ["strategy"], limit: 8 }],
        maxDiscoverCalls: 1,
        maxResolutions: 6,
        maxMatches: 2
      };
    }

    if (
      options.preferences.highRating &&
      options.preferences.rawgGenres.some((genre) => genre.trim().toLowerCase() === "strategy")
    ) {
      return {
        kind: "steam-deck-strategy",
        queries: [{ rawgGenres: ["strategy"], limit: 8 }],
        maxDiscoverCalls: 1,
        maxResolutions: 6,
        maxMatches: 2
      };
    }

    if (hasRoguelikeIntent(options.preferences.genres)) {
      return {
        kind: "steam-deck-roguelike",
        queries: [
          { tags: ["roguelike", "roguelite"], rawgGenres: ["action"], limit: 8 },
          { tags: ["roguelike", "roguelite"], limit: 8 }
        ],
        maxDiscoverCalls: 2,
        maxResolutions: 6,
        maxMatches: 2
      };
    }
  }

  if (options.preferences.multiplayer && (!top || top.multiplayer !== true)) {
    const simpleSocialCatalogLimit = options.simpleSocialPrompt ? 16 : 8;

    return {
      kind: "broad-multiplayer",
      queries: [
        { tags: ["multiplayer"], rawgGenres: ["action", "casual"], limit: simpleSocialCatalogLimit },
        { tags: ["multiplayer"], rawgGenres: ["action"], limit: simpleSocialCatalogLimit },
        { tags: ["multiplayer"], limit: simpleSocialCatalogLimit }
      ],
      maxDiscoverCalls: 3,
      maxResolutions: options.simpleSocialPrompt ? 10 : 8,
      maxMatches: 2
    };
  }

  return null;
}

function hasRoguelikeIntent(genres: string[]): boolean {
  return genres.some((genre) => {
    const normalized = genre.trim().toLowerCase();
    return normalized === "roguelike" || normalized === "roguelite";
  });
}

function hasStrategyIntent(
  preferences: RecommendationIntent,
  constraints: RecommendationConstraints
): boolean {
  return (
    constraints.strategySignal ||
    preferences.rawgGenres.some((genre) => genre.trim().toLowerCase() === "strategy") ||
    preferences.genres.some((genre) => /\b(strategy|strategic|tactics?|tactical|turn-?based)\b/i.test(genre))
  );
}

function hasDeckOrCardEvidence(deal: DealCandidate): boolean {
  return /\b(deck|deckbuilder|deckbuilding|card|cards|hand|battler)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}
