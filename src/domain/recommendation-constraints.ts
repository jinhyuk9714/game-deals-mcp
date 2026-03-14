import type { RecommendationIntent } from "./intent-lexicon.js";

export type ExcludeGenre =
  | "card/deckbuilder"
  | "racing"
  | "sports"
  | "strategy"
  | "horror"
  | "pvp";
export type AvoidComplexity = "complex-strategy" | "long-session" | "reading-heavy";
export type PreferSession = "short" | "medium";
export type CoopMode = "coop" | "party" | "non-competitive";
export type QualityIntent = "review-backed" | "popular" | "not-filler";
export type ExcludeGameplay = "turn-based";
export type DeckPreference = "required" | "preferred" | "avoid";
export type StrategyPreference = "required" | "preferred" | "avoid";

export interface RecommendationConstraints {
  excludeGenres: ExcludeGenre[];
  excludeGameplay: ExcludeGameplay[];
  avoidComplexity: AvoidComplexity[];
  preferSession: PreferSession[];
  coopMode: CoopMode[];
  qualityIntent: QualityIntent[];
  deckPreference: DeckPreference;
  strategyPreference: StrategyPreference;
  deckSignal: boolean;
  strategySignal: boolean;
  actionBias: boolean;
}

interface ConstraintCandidate {
  title: string;
  genres: string[];
  tags?: string[] | undefined;
  multiplayer?: boolean | undefined;
  rating?: number | null | undefined;
  metacritic?: number | null | undefined;
  metadataStatus?: string | undefined;
  price?: { amount: number; currency: string } | undefined;
}

const NEGATION_TERMS =
  "(?:말고|빼고|제외|아닌|없이|싫(?:은)?|피하(?:고|는)|원치 않|avoid|without|not)";

const CARD_PATTERNS = /(카드|card|cards|deck(?:builder|building)?|덱빌딩|덱빌더|손패)/i;
const RACING_PATTERNS = /(레이싱|racing)/i;
const SPORTS_PATTERNS = /(스포츠|sports?)/i;
const STRATEGY_PATTERNS = /(전략|strategy|strategic)/i;
const TACTICS_PATTERNS = /(전술|tactics?|tactical|turn-?based|턴제)/i;
const HORROR_PATTERNS = /(호러|공포|horror)/i;
const PVP_PATTERNS = /(pvp|경쟁|대전|versus|\bvs\b|competitive|배틀로얄|battle royale)/i;
const PARTY_PATTERNS =
  /(파티|party|party-friendly|party night|hangout|game night|shared-?screen|friends-?first|chill co-?op|친구\s*모임(?:용)?|웃기|웃으면서|떠들|fun|brawler|beat ?em ?up)/i;
const COOP_PATTERNS =
  /(협동|co-?op|coop|teamplay|multiplayer|친구(?:들이)?랑.*(?:같이|놀)|친구\s*모임(?:용)?|친구\s*둘이서|둘이서|2인|멀티|with friends|friends|play together|여럿이.*(?:같이|놀)|hangout|game night|shared-?screen|friends-?first|chill co-?op)/i;
const ACTION_CUE_PATTERNS =
  /(액션성|손맛|real-?time|shooty|슈터|shooter|shooting|빠른|템포|tempo|fast)/i;
const REVIEW_PATTERNS =
  /(리뷰 좋(?:은|고)|평가 좋(?:은|고)|평\s*좋(?:은|고)|평이\s*단단한|검증된|평점 높은|well-reviewed|high[- ]rated|highly rated)/i;
const POPULAR_PATTERNS = /(인기|유명|많이 하는|popular|well-known)/i;
const NOT_FILLER_PATTERNS = /(filler\s*(?:아닌|말고)|잡게임\s*말고|뻔한\s*거\s*말고|not filler)/i;
const SHORT_SESSION_PATTERNS =
  /(짧게|짧은|가볍게|잠깐|짬짬이|한 ?판|quick|short session|pick-?up)/i;
const MEDIUM_SESSION_PATTERNS = /(적당한 길이|medium session|한두 시간|1-?2 hours?)/i;
const LONG_SESSION_PATTERNS = /(긴 세션|오래 걸리|long session|한 판이 길|hours?-long)/i;
const READING_HEAVY_PATTERNS =
  /(읽을 거(?:\s*\S+){0,2}\s*많|글자.*많|텍스트 많|reading-heavy|text-heavy|story rich|visual novel|without heavy reading)/i;
const COMPLEX_STRATEGY_PATTERNS =
  /(복잡한\s*(전략|strategy)|머리 아픈\s*(전략|strategy)|heavy strategy|grand strategy|4x)/i;

export function parseRecommendationConstraints(preferences: string): RecommendationConstraints {
  const excludeGenres = new Set<ExcludeGenre>();
  const excludeGameplay = new Set<ExcludeGameplay>();
  const avoidComplexity = new Set<AvoidComplexity>();
  const preferSession = new Set<PreferSession>();
  const coopMode = new Set<CoopMode>();
  const qualityIntent = new Set<QualityIntent>();

  const hasCard = CARD_PATTERNS.test(preferences);
  const cardExcluded = matchesNegated(preferences, CARD_PATTERNS);
  const racingExcluded = matchesNegated(preferences, RACING_PATTERNS);
  const sportsExcluded = matchesNegated(preferences, SPORTS_PATTERNS);
  const horrorExcluded = matchesNegated(preferences, HORROR_PATTERNS);
  const pvpExcluded =
    matchesNegated(preferences, PVP_PATTERNS) ||
    /비경쟁|non-competitive|non-?sweaty/i.test(preferences);
  const turnBasedExcluded =
    matchesNegated(preferences, TACTICS_PATTERNS) ||
    /strategy 느낌은 말고|turn-?based 말고|not turn-?based/i.test(preferences);
  const hasStrategy =
    STRATEGY_PATTERNS.test(preferences) && !matchesNegated(preferences, STRATEGY_PATTERNS);
  const hasTactics =
    /전술|tactics?|tactical/i.test(preferences) ||
    ((/turn-?based|턴제/i.test(preferences) || TACTICS_PATTERNS.test(preferences)) && !turnBasedExcluded);
  const strategyExcluded = matchesNegated(preferences, STRATEGY_PATTERNS) && !hasTactics;
  const actionBias =
    ACTION_CUE_PATTERNS.test(preferences) ||
    turnBasedExcluded ||
    /strategy 느낌은 말고|실시간/i.test(preferences);

  if (cardExcluded) {
    excludeGenres.add("card/deckbuilder");
  }
  if (racingExcluded) {
    excludeGenres.add("racing");
  }
  if (sportsExcluded) {
    excludeGenres.add("sports");
  }
  if (
    /(레이싱|racing).{0,12}(이나|or|\/).{0,12}(스포츠|sports?).{0,8}(말고|제외|빼고)/i.test(
      preferences
    )
  ) {
    excludeGenres.add("racing");
    excludeGenres.add("sports");
  }
  if (strategyExcluded) {
    excludeGenres.add("strategy");
  }
  if (horrorExcluded) {
    excludeGenres.add("horror");
  }
  if (pvpExcluded) {
    excludeGenres.add("pvp");
  }
  if (turnBasedExcluded) {
    excludeGameplay.add("turn-based");
  }

  if (
    COMPLEX_STRATEGY_PATTERNS.test(preferences) ||
    ((hasStrategy || hasTactics) && /너무\s*복잡한\s*건\s*말고|too complex/i.test(preferences))
  ) {
    avoidComplexity.add("complex-strategy");
  }
  if (LONG_SESSION_PATTERNS.test(preferences)) {
    avoidComplexity.add("long-session");
  }
  if (READING_HEAVY_PATTERNS.test(preferences)) {
    avoidComplexity.add("reading-heavy");
  }

  if (SHORT_SESSION_PATTERNS.test(preferences)) {
    preferSession.add("short");
  }
  if (MEDIUM_SESSION_PATTERNS.test(preferences)) {
    preferSession.add("medium");
  }

  if (COOP_PATTERNS.test(preferences)) {
    coopMode.add("coop");
  }
  if (PARTY_PATTERNS.test(preferences)) {
    coopMode.add("party");
  }
  if (pvpExcluded || /비경쟁|non-competitive|non-?sweaty|경쟁\s*말고/i.test(preferences)) {
    coopMode.add("non-competitive");
  }

  if (REVIEW_PATTERNS.test(preferences)) {
    qualityIntent.add("review-backed");
  }
  if (POPULAR_PATTERNS.test(preferences)) {
    qualityIntent.add("popular");
  }
  if (NOT_FILLER_PATTERNS.test(preferences)) {
    qualityIntent.add("not-filler");
  }

  return {
    excludeGenres: [...excludeGenres],
    excludeGameplay: [...excludeGameplay],
    avoidComplexity: [...avoidComplexity],
    preferSession: [...preferSession],
    coopMode: [...coopMode],
    qualityIntent: [...qualityIntent],
    deckPreference: cardExcluded ? "avoid" : hasCard ? "required" : "preferred",
    strategyPreference: strategyExcluded ? "avoid" : hasStrategy || hasTactics ? "required" : "preferred",
    deckSignal: hasCard || cardExcluded,
    strategySignal: hasStrategy || hasTactics || strategyExcluded,
    actionBias
  };
}

export function applyRecommendationConstraintOverrides(
  intent: RecommendationIntent,
  constraints: RecommendationConstraints
): RecommendationIntent {
  const genres = new Set(intent.genres);
  const rawgGenres = new Set(intent.rawgGenres);
  const platforms = [...intent.platforms];
  const tags = new Set(intent.tags);

  if (constraints.deckPreference === "avoid") {
    rawgGenres.delete("card");
    intent.tags
      .filter((tag) => /deckbuilder|card/i.test(tag))
      .forEach((tag) => tags.delete(tag));
  } else if (constraints.deckPreference === "required") {
    rawgGenres.add("card");
    tags.add("roguelike-deckbuilder");
  }

  if (constraints.strategyPreference === "avoid" || constraints.excludeGenres.includes("strategy")) {
    genres.delete("Strategy");
    rawgGenres.delete("strategy");
  } else if (constraints.strategyPreference === "required") {
    genres.add("Strategy");
    rawgGenres.add("strategy");
  }

  if (constraints.actionBias) {
    genres.add("Action");
    rawgGenres.add("action");
  }

  return {
    genres: [...genres],
    rawgGenres: [...rawgGenres],
    platforms,
    tags: [...tags],
    multiplayer: intent.multiplayer,
    deckbuilding: intent.deckbuilding && constraints.deckPreference !== "avoid",
    highRating: intent.highRating,
    shortSession: intent.shortSession || constraints.preferSession.includes("short")
  };
}

export function applyRecommendationHardConstraints<T extends ConstraintCandidate>(
  values: T[],
  constraints: RecommendationConstraints
): T[] {
  return values.filter((value) => matchesRecommendationHardConstraints(value, constraints));
}

export function filterRecommendationRequiredConstraints<T extends ConstraintCandidate>(
  values: T[],
  constraints: RecommendationConstraints
): T[] {
  return applyRecommendationHardConstraints(values, constraints).filter((value) => {
    if (constraints.deckPreference === "required" && !hasDeckOrCardEvidence(value)) {
      return false;
    }

    if (constraints.strategyPreference === "required" && !hasStrategyOrTacticsEvidence(value)) {
      return false;
    }

    if (constraints.coopMode.includes("coop") && !value.multiplayer) {
      return false;
    }

    if (
      constraints.actionBias &&
      constraints.excludeGameplay.includes("turn-based") &&
      hasTurnBasedEvidence(value)
    ) {
      return false;
    }

    if (
      constraints.qualityIntent.includes("review-backed") &&
      !hasReviewBackedEvidence(value)
    ) {
      return false;
    }

    return true;
  });
}

export function getRecommendationConstraintScore(
  value: ConstraintCandidate,
  constraints: RecommendationConstraints
): number {
  let score = 0;

  if (!matchesRecommendationHardConstraints(value, constraints)) {
    return -1000;
  }

  if (constraints.deckSignal && constraints.deckPreference === "required") {
    score += hasDeckOrCardEvidence(value) ? 180 : -260;
  } else if (
    constraints.deckSignal &&
    constraints.deckPreference === "preferred" &&
    hasDeckOrCardEvidence(value)
  ) {
    score += 80;
  }

  if (constraints.strategySignal && constraints.strategyPreference === "required") {
    score += hasStrategyOrTacticsEvidence(value) ? 140 : -220;
  } else if (
    constraints.strategySignal &&
    constraints.strategyPreference === "preferred" &&
    hasStrategyOrTacticsEvidence(value)
  ) {
    score += 60;
  }

  if (constraints.avoidComplexity.includes("complex-strategy")) {
    if (hasHeavyStrategyEvidence(value)) {
      score -= 160;
    }
    if (hasTacticsEvidence(value)) {
      score += 90;
    }
  }

  if (constraints.actionBias) {
    score += hasActionEvidence(value) ? 130 : -80;
    if (hasActionRogueliteEvidence(value)) {
      score += 140;
    }
    if (hasDeckOrCardEvidence(value)) {
      score -= 120;
    }
    if (hasStrategyOrTacticsEvidence(value)) {
      score -= 100;
    }
    if (constraints.excludeGameplay.includes("turn-based") && hasTurnBasedEvidence(value)) {
      score -= 220;
    }
  }

  if (constraints.avoidComplexity.includes("reading-heavy")) {
    score += hasReadingHeavyEvidence(value) ? -140 : 40;
  }

  if (constraints.avoidComplexity.includes("long-session")) {
    score += hasLongSessionEvidence(value) ? -120 : 30;
  }

  if (constraints.preferSession.includes("short")) {
    score += hasShortSessionEvidence(value) ? 90 : hasLongSessionEvidence(value) ? -60 : 0;
  }

  if (constraints.preferSession.includes("medium")) {
    score += hasMediumSessionEvidence(value) ? 45 : 0;
  }

  if (constraints.coopMode.includes("coop")) {
    score += value.multiplayer ? 100 : -220;
  }

  if (constraints.coopMode.includes("party")) {
    score += hasPartyFriendlyEvidence(value) ? 90 : 0;
  }

  if (constraints.coopMode.includes("non-competitive")) {
    score += hasPvPEvidence(value) ? -240 : value.multiplayer ? 80 : 0;
  }

  if (constraints.qualityIntent.includes("review-backed")) {
    score += hasReviewBackedEvidence(value) ? 120 : -160;
  }

  if (constraints.qualityIntent.includes("popular")) {
    score += getReviewScore(value) >= 80 ? 60 : 0;
  }

  if (constraints.qualityIntent.includes("not-filler")) {
    score += isLikelyFiller(value) ? -180 : hasReviewBackedEvidence(value) ? 70 : 0;
  }

  return score;
}

export function matchesRecommendationHardConstraints(
  value: ConstraintCandidate,
  constraints: RecommendationConstraints
): boolean {
  if (
    (constraints.excludeGenres.includes("card/deckbuilder") || constraints.deckPreference === "avoid") &&
    hasDeckOrCardEvidence(value)
  ) {
    return false;
  }

  if (constraints.excludeGenres.includes("racing") && hasRacingEvidence(value)) {
    return false;
  }

  if (constraints.excludeGenres.includes("sports") && hasSportsEvidence(value)) {
    return false;
  }

  if (
    (constraints.excludeGenres.includes("strategy") || constraints.strategyPreference === "avoid") &&
    hasStrategyOrTacticsEvidence(value)
  ) {
    return false;
  }

  if (constraints.excludeGameplay.includes("turn-based") && hasTurnBasedEvidence(value)) {
    return false;
  }

  if (constraints.excludeGenres.includes("horror") && hasHorrorEvidence(value)) {
    return false;
  }

  if (constraints.excludeGenres.includes("pvp") && hasPvPEvidence(value)) {
    return false;
  }

  return true;
}

function matchesNegated(preferences: string, pattern: RegExp): boolean {
  return (
    new RegExp(`${pattern.source}\\s*(?:은|는|이|가|도|만)?\\s*${NEGATION_TERMS}`, "i").test(
      preferences
    ) ||
    new RegExp(
      `(?:말고|빼고|제외|없이|avoid|without|not)\\s*(?:the\\s+)?${pattern.source}`,
      "i"
    ).test(preferences)
  );
}

function asHaystack(value: ConstraintCandidate): string {
  return `${value.title} ${value.genres.join(" ")} ${(value.tags ?? []).join(" ")}`.toLowerCase();
}

function hasDeckOrCardEvidence(value: ConstraintCandidate): boolean {
  return /\b(deck|deckbuilder|deckbuilding|card|cards|hand|battler)\b/i.test(asHaystack(value));
}

function hasStrategyOrTacticsEvidence(value: ConstraintCandidate): boolean {
  return /\b(strategy|strategic|tactics?|tactical|turn-?based)\b/i.test(asHaystack(value));
}

function hasTacticsEvidence(value: ConstraintCandidate): boolean {
  return /\b(tactics?|tactical|turn-?based)\b/i.test(asHaystack(value));
}

function hasTurnBasedEvidence(value: ConstraintCandidate): boolean {
  return /\b(turn-?based)\b/i.test(asHaystack(value)) || /턴제/.test(asHaystack(value));
}

function hasRacingEvidence(value: ConstraintCandidate): boolean {
  return /\b(racing)\b/i.test(asHaystack(value));
}

function hasSportsEvidence(value: ConstraintCandidate): boolean {
  return /\b(sports?)\b/i.test(asHaystack(value));
}

function hasHorrorEvidence(value: ConstraintCandidate): boolean {
  return /\b(horror)\b/i.test(asHaystack(value));
}

function hasPvPEvidence(value: ConstraintCandidate): boolean {
  return /\b(pvp|versus|vs|competitive|battle royale)\b/i.test(asHaystack(value));
}

function hasActionEvidence(value: ConstraintCandidate): boolean {
  return /\b(action|combat|shooter|shooting|hack|slash|brawler)\b/i.test(asHaystack(value));
}

function hasActionRogueliteEvidence(value: ConstraintCandidate): boolean {
  return hasActionEvidence(value) && /\b(roguelike|roguelite)\b/i.test(asHaystack(value));
}

function hasHeavyStrategyEvidence(value: ConstraintCandidate): boolean {
  const haystack = asHaystack(value);
  return (
    /\b(grand strategy|4x|simulation|management|wargame)\b/i.test(haystack) ||
    (hasStrategyOrTacticsEvidence(value) && !hasTacticsEvidence(value))
  );
}

function hasReadingHeavyEvidence(value: ConstraintCandidate): boolean {
  return /\b(story rich|visual novel|text-heavy|narrative)\b/i.test(asHaystack(value));
}

function hasLongSessionEvidence(value: ConstraintCandidate): boolean {
  return /\b(simulation|management|grand strategy|4x|mmo)\b/i.test(asHaystack(value));
}

function hasShortSessionEvidence(value: ConstraintCandidate): boolean {
  return /\b(action|arcade|casual|party|roguelike|deckbuilder|card)\b/i.test(asHaystack(value));
}

function hasMediumSessionEvidence(value: ConstraintCandidate): boolean {
  return /\b(action|strategy|tactics|rpg)\b/i.test(asHaystack(value));
}

function hasPartyFriendlyEvidence(value: ConstraintCandidate): boolean {
  return /\b(party|brawler|fun|casual)\b/i.test(asHaystack(value));
}

function hasReviewBackedEvidence(value: ConstraintCandidate): boolean {
  return (value.rating ?? 0) >= 4 || (value.metacritic ?? 0) >= 75;
}

function isLikelyFiller(value: ConstraintCandidate): boolean {
  const haystack = asHaystack(value);
  return (
    /\b(pack|asset|demo|test|simulator)\b/i.test(haystack) ||
    ((value.price?.amount ?? 9_999) <= 1_000 && !hasReviewBackedEvidence(value)) ||
    value.metadataStatus === "unavailable"
  );
}

function getReviewScore(value: ConstraintCandidate): number {
  return Math.max((value.rating ?? 0) * 20, value.metacritic ?? 0);
}
