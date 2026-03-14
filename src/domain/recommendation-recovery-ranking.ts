import type { RecommendationRecoveryKind } from "./recommendation-recovery-profile.js";
import type { RecommendationConstraints } from "./recommendation-constraints.js";

export interface RecommendationRecoveryRankingProfile {
  kind: RecommendationRecoveryKind;
  shortSession: boolean;
  tacticsPrompt?: boolean | undefined;
  avoidComplexity?: RecommendationConstraints["avoidComplexity"] | undefined;
  qualityIntent?: RecommendationConstraints["qualityIntent"] | undefined;
  partyPrompt?: boolean | undefined;
  socialProfile?: "generic-coop" | "party-hangout" | undefined;
  nonCompetitive?: boolean | undefined;
  excludeRacingOrSports?: boolean | undefined;
  requestedPlatforms?: string[] | undefined;
  simpleSocialPrompt?: boolean | undefined;
}

export interface RecommendationRecoveryCandidateScore {
  title: string;
  score: number;
}

interface RecoveryRankableCandidate {
  title: string;
  genres: string[];
  platforms: string[];
  tags?: string[] | undefined;
  rating?: number | null | undefined;
  metacritic?: number | null | undefined;
  multiplayer: boolean;
}

export function rankRecommendationRecoveryCandidates<T extends RecoveryRankableCandidate>(
  candidates: T[],
  profile: RecommendationRecoveryRankingProfile
): T[] {
  return [...candidates].sort((left, right) => {
    const leftScore = scoreRecommendationRecoveryCandidate(left, profile).score;
    const rightScore = scoreRecommendationRecoveryCandidate(right, profile).score;

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return left.title.localeCompare(right.title);
  });
}

export function scoreRecommendationRecoveryCandidate(
  candidate: RecoveryRankableCandidate,
  profile: RecommendationRecoveryRankingProfile
): RecommendationRecoveryCandidateScore {
  let score = 0;

  switch (profile.kind) {
    case "steam-deck-roguelike":
      score += hasActionRoguelikeCandidateShape(candidate) ? 7 : 0;
      score += hasRogueliteCandidateShape(candidate) ? 3 : 0;
      score += hasReviewSignal(candidate) ? 2 : 0;
      score += hasHandheldFriendlyShape(candidate) ? 2 : 0;
      score -= hasStrategyCandidateShape(candidate) ? 2 : 0;
      score -= hasDeckbuildingCandidateShape(candidate) ? 2 : 0;
      break;
    case "steam-deck-strategy":
      score += hasStrategyCandidateShape(candidate) ? 4 : 0;
      score += hasTacticsCandidateShape(candidate) ? 3 : 0;
      score += hasReviewSignal(candidate) ? 3 : 0;
      score -= hasHeavyStrategyCandidateShape(candidate) ? 3 : 0;
      break;
    case "non-steam-strategy-rating":
      score += hasStrategyCandidateShape(candidate) ? 5 : 0;
      score += hasReviewSignal(candidate) ? 4 : 0;
      score += profile.tacticsPrompt && hasTacticsCandidateShape(candidate) ? 4 : 0;
      score += !profile.tacticsPrompt && hasTacticsCandidateShape(candidate) ? 2 : 0;
      score -= hasHeavyStrategyCandidateShape(candidate) ? 4 : 0;
      if (profile.avoidComplexity?.includes("complex-strategy")) {
        score -= hasHeavyStrategyCandidateShape(candidate) ? 4 : 0;
        score += hasTacticsCandidateShape(candidate) ? 2 : 0;
      }
      if (profile.avoidComplexity?.includes("reading-heavy")) {
        score -= hasReadingHeavyCandidateShape(candidate) ? 4 : 0;
      }
      if (profile.avoidComplexity?.includes("long-session")) {
        score -= hasLongSessionCandidateShape(candidate) ? 3 : 0;
      }
      if (profile.qualityIntent?.includes("popular")) {
        score += hasMainstreamStrategyCandidateShape(candidate) ? 2 : 0;
      }
      if (profile.qualityIntent?.includes("not-filler")) {
        score -= hasLikelyFillerCandidateShape(candidate) ? 3 : 0;
      }
      break;
    case "steam-deck-strategy-roguelike":
      score += hasStrategyCandidateShape(candidate) ? 4 : 0;
      score += hasTacticsCandidateShape(candidate) ? 2 : 0;
      score += hasRoguelikeCandidateShape(candidate) ? 4 : 0;
      score += hasReviewSignal(candidate) ? 3 : 0;
      score -= hasHeavyStrategyCandidateShape(candidate) ? 2 : 0;
      break;
    case "deckbuilding-card":
      score += hasDeckbuildingCandidateShape(candidate) ? 5 : 0;
      score += hasRoguelikeDeckbuilderTag(candidate) ? 4 : 0;
      score += hasReviewSignal(candidate) ? 2 : 0;
      score += hasHandheldFriendlyShape(candidate) ? 1 : 0;
      score -= hasHeavyStrategyCandidateShape(candidate) ? 2 : 0;
      break;
    case "broad-multiplayer":
      score += candidate.multiplayer ? 5 : -12;
      score += candidate.multiplayer ? 4 : -8;
      score += hasExplicitCoopCandidateShape(candidate) ? 5 : 0;
      score += hasLocalSocialCandidateShape(candidate) ? 4 : 0;
      score += hasPartyRecoveryCandidateShape(candidate) ? 4 : 0;
      score += hasReviewSignal(candidate) ? 3 : profile.qualityIntent?.includes("review-backed") ? -5 : 0;
      score += profile.partyPrompt && hasPartyFriendlyCandidateShape(candidate) ? 5 : 0;
      score += !profile.partyPrompt && hasGenericCoopCandidateShape(candidate) ? 5 : 0;
      score += getRequestedPlatformScore(candidate, profile.requestedPlatforms);
      score += profile.simpleSocialPrompt && hasSimpleSocialCandidateShape(candidate) ? 2 : 0;
      score +=
        profile.socialProfile === "generic-coop" && hasGenericCoopCandidateShape(candidate) ? 6 : 0;
      score +=
        profile.socialProfile === "generic-coop" && hasLocalSocialCandidateShape(candidate) ? 4 : 0;
      score +=
        profile.socialProfile === "party-hangout" && hasPartyFriendlyCandidateShape(candidate) ? 4 : 0;
      score -=
        profile.socialProfile === "generic-coop" &&
        hasPartyFriendlyCandidateShape(candidate) &&
        !hasGenericCoopCandidateShape(candidate)
          ? 8
          : 0;
      score -= hasSingleplayerBiasCandidateShape(candidate) ? 4 : 0;
      score -=
        (profile.excludeRacingOrSports || hasRacingOrSportsCandidateShape(candidate))
          && hasRacingOrSportsCandidateShape(candidate)
          ? 4
          : 0;
      score -= profile.nonCompetitive && hasPvPCandidateShape(candidate) ? 5 : 0;
      score -= hasStoryAdventurePuzzleFillerCandidateShape(candidate) ? 4 : 0;
      score -= hasLikelyFillerCandidateShape(candidate) ? 3 : 0;
      score -= hasLikelySocialJunkCandidateShape(candidate) ? 5 : 0;
      break;
  }

  if (profile.shortSession && hasHandheldFriendlyShape(candidate)) {
    score += 1;
  }

  return {
    title: candidate.title,
    score
  };
}

function hasReviewSignal(candidate: RecoveryRankableCandidate): boolean {
  return (candidate.rating ?? 0) >= 4 || (candidate.metacritic ?? 0) >= 75;
}

function hasActionRoguelikeCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasActionCandidateShape(candidate) && hasRoguelikeCandidateShape(candidate);
}

function hasActionCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(action|shooter|shooting|combat|brawler)\b/i);
}

function hasRoguelikeCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(roguelike|roguelite)\b/i);
}

function hasRogueliteCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(roguelite|action roguelike)\b/i);
}

function hasStrategyCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(strategy|strategic|tactics?|tactical|turn-?based)\b/i);
}

function hasTacticsCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(tactics?|tactical|turn-?based)\b/i);
}

function hasHeavyStrategyCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(grand strategy|4x|management|wargame|simulation)\b/i);
}

function hasReadingHeavyCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(text-heavy|reading-heavy|story rich|visual novel|narrative)\b/i);
}

function hasLongSessionCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(grand strategy|4x|management|simulation|campaign)\b/i);
}

function hasDeckbuildingCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(deck|deckbuilder|deckbuilding|card|cards|battler|hand)\b/i);
}

function hasRoguelikeDeckbuilderTag(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(roguelike deckbuilder|roguelike-deckbuilder)\b/i);
}

function hasHandheldFriendlyShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(action|casual|arcade|party|roguelike|roguelite|card|deckbuilder)\b/i);
}

function hasMainstreamStrategyCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return (candidate.metacritic ?? 0) >= 80 || (candidate.rating ?? 0) >= 4.2;
}

function hasLikelyFillerCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(pack|asset|demo|test|simulator|course|bundle)\b/i);
}

function hasLikelySocialJunkCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(ai games?|shovelware|collection|bundle|course|demo)\b/i);
}

function hasPartyRecoveryCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(action|casual|arcade|party|brawler|co-?op|coop|fun)\b/i);
}

function hasExplicitCoopCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(co-?op|coop|cooperative|teamplay|team-based|multiplayer)\b/i);
}

function hasPartyFriendlyCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(party|brawler|beat ?em ?up|fun|hangout)\b/i);
}

function hasLocalSocialCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(
    candidate,
    /\b(local[ -]?co-?op|couch[ -]?co-?op|split[ -]?screen|same[ -]?screen|teamplay|cooperative)\b/i
  );
}

function hasGenericCoopCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(co-?op|coop|cooperative|teamplay|local[ -]?co-?op)\b/i);
}

function hasSimpleSocialCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(
    candidate,
    /\b(co-?op|coop|cooperative|teamplay|local[ -]?co-?op|party|casual|action|arcade|brawler)\b/i
  );
}

function hasSingleplayerBiasCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(singleplayer|story rich|story-rich|narrative|solo)\b/i);
}

function hasRacingOrSportsCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(racing|sports?)\b/i);
}

function hasPvPCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(pvp|versus|vs|competitive|battle royale)\b/i);
}

function hasStoryAdventurePuzzleFillerCandidateShape(candidate: RecoveryRankableCandidate): boolean {
  return hasCandidatePattern(candidate, /\b(adventure|puzzle|story|narrative)\b/i);
}

function hasCandidatePattern(candidate: RecoveryRankableCandidate, pattern: RegExp): boolean {
  return pattern.test(`${candidate.title} ${candidate.genres.join(" ")} ${(candidate.tags ?? []).join(" ")}`);
}

function getRequestedPlatformScore(
  candidate: RecoveryRankableCandidate,
  requestedPlatforms: string[] | undefined
): number {
  if (!requestedPlatforms || requestedPlatforms.length === 0 || candidate.platforms.length === 0) {
    return 0;
  }

  const requested = new Set(requestedPlatforms.map(normalizePlatform));
  return candidate.platforms.some((platform) => requested.has(normalizePlatform(platform))) ? 4 : -6;
}

function normalizePlatform(value: string): string {
  return value.trim().toLowerCase();
}
