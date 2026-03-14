export interface RecommendationIntent {
  genres: string[];
  rawgGenres: string[];
  platforms: string[];
  tags: string[];
  multiplayer: boolean;
  deckbuilding: boolean;
  highRating: boolean;
  shortSession: boolean;
}

const INTENT_PATTERNS = {
  roguelike: [/로그라이크|로그라이트|roguelike|roguelite/i],
  deckbuilding: [
    /덱빌딩/i,
    /deck ?build/i,
    /deckbuilder/i,
    /buildcraft/i,
    /카드 ?게임/i,
    /카드 ?배틀러/i,
    /card game/i,
    /card battler/i,
    /손패/i
  ],
  strategy: [/전략|전술|strategy|tactics|tactical|systems-heavy/i],
  action: [
    /액션|전투(?:\s*위주)?|핵앤슬래시|슈팅/i,
    /action/i,
    /combat(?:-| )?heavy/i,
    /combat/i,
    /hack(?:-| )?(?:and(?:-| )?)?slash/i,
    /shooter|shooting/i,
    /슈터|손맛|액션성|real-?time|shooty/i
  ],
  steamDeck: [/스팀덱|steam ?deck|핸드헬드|handheld|휴대용|휴대기|패드/i],
  pc: [/\bpc\b|스팀(?!덱)|\bsteam\b/i],
  multiplayer: [
    /협동|co-?op|coop|멀티|teamplay|multiplayer/i,
    /친구(?:랑|와)?\s*같이/i,
    /친구\s*모임(?:용)?/i,
    /친구들?\s*모였(?:을\s*때)?/i,
    /친구\s*둘이서/i,
    /둘이서/i,
    /2인/i,
    /파티플레이/i,
    /팀플/i,
    /파티용/i,
    /웃긴\s*게임/i,
    /같이\s*웃으면서/i,
    /떠들면서/i,
    /party(?: game| co-?op)?/i,
    /party-friendly|party night/i,
    /hangout|game night|shared-?screen|friends-?first|chill co-?op/i,
    /non-?sweaty/i,
    /with friends|friends|play together/i,
    /여럿이\s*같이\s*놀/i
  ],
  highRating: [
    /평가 좋은|평 좋은|평이 단단한|호평|리뷰 좋은|평점 높은|메타 좋은|검증된/i,
    /high[- ]rated|highly rated|well-reviewed/i
  ],
  shortSession: [
    /짧게|가볍게|부담 없이|잠깐|짬짬이|출퇴근|casual/i,
    /바로\s*켜기\s*좋/i,
    /한 ?판/i,
    /quick|short session|pick-?up/i
  ]
} as const;

function matchesIntentGroup(
  preferences: string,
  group: keyof typeof INTENT_PATTERNS
): boolean {
  return INTENT_PATTERNS[group].some((pattern) => pattern.test(preferences));
}

export function parseRecommendationIntent(preferences: string): RecommendationIntent {
  const genres = new Set<string>();
  const rawgGenres = new Set<string>();
  const platforms = new Set<string>();
  const tags = new Set<string>();

  const roguelike = matchesIntentGroup(preferences, "roguelike");
  const deckbuilding = matchesIntentGroup(preferences, "deckbuilding");
  const strategy = matchesIntentGroup(preferences, "strategy");
  const action = matchesIntentGroup(preferences, "action") || hasInferredActionIntent(preferences);
  const steamDeck = matchesIntentGroup(preferences, "steamDeck");
  const pc = matchesIntentGroup(preferences, "pc");
  const multiplayer = matchesIntentGroup(preferences, "multiplayer");
  const highRating = matchesIntentGroup(preferences, "highRating");
  const shortSession = matchesIntentGroup(preferences, "shortSession");

  if (roguelike) {
    genres.add("Roguelike");
    tags.add("roguelike");
    tags.add("roguelite");
  }

  if (deckbuilding) {
    genres.add("Strategy");
    rawgGenres.add("card");
    tags.add("roguelike-deckbuilder");
  }

  if (strategy) {
    genres.add("Strategy");
    rawgGenres.add("strategy");
  }

  if (action) {
    genres.add("Action");
    rawgGenres.add("action");
  }

  if (steamDeck) {
    platforms.add("Steam Deck");
  }

  if (pc) {
    platforms.add("PC");
  }

  return {
    genres: [...genres],
    rawgGenres: [...rawgGenres],
    platforms: [...platforms],
    tags: [...tags],
    multiplayer,
    deckbuilding,
    highRating,
    shortSession
  };
}

function hasInferredActionIntent(preferences: string): boolean {
  return (
    /슈터|손맛|액션성|real-?time|shooty/i.test(preferences) ||
    ((/빠른|템포|fast|tempo/i.test(preferences) || /turn-?based 말고|not turn-?based|strategy 느낌은 말고/i.test(preferences)) &&
      (/로그라이크|로그라이트|roguelike|roguelite/i.test(preferences) || /strategy 느낌은 말고/i.test(preferences)))
  );
}
