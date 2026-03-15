import {
  GameDealService,
  type CatalogCandidate,
  type CompareResult,
  type RecommendationMatch
} from "../domain/service.js";
import type {
  DealsEnrichment,
  DealCandidate,
  DiscoverFilters,
  SteamDeckCompatibility
} from "../domain/score.js";
import type { DealResolution, ResolveDealOptions } from "../providers/itad-client.js";

export type DeterministicRecommendationAuditGroup =
  | "local-guardrail"
  | "provider-outage"
  | "steam-deck-overlay"
  | "social-tiering"
  | "junk-suppression";

export interface DeterministicRecommendationExpectation {
  expectMatchCount?: number | undefined;
  maxMatchCount?: number | undefined;
  expectedTopTitle?: string | undefined;
  expectedEmptyReason?: string | undefined;
  expectedTopGenres?: string[] | undefined;
  forbiddenTopTitles?: string[] | undefined;
  forbiddenEmptyReasons?: string[] | undefined;
  requiredWarnings?: string[] | undefined;
  forbiddenWarnings?: string[] | undefined;
  requiredTopSignals?: string[] | undefined;
  forbiddenTopSignals?: string[] | undefined;
}

interface DeterministicFindDealsFixture {
  match?: {
    genres?: string[] | undefined;
    platforms?: string[] | undefined;
    multiplayer?: boolean | undefined;
    sort?: NonNullable<DiscoverFilters["sort"]> | undefined;
    budget?: number | undefined;
    country?: string | undefined;
    preferredShops?: number[] | undefined;
  };
  result?: DealCandidate[] | undefined;
  error?: string | undefined;
}

interface DeterministicEnrichDealsFixture {
  matchTitles?: string[] | undefined;
  result?: DealCandidate[] | DealsEnrichment | undefined;
  error?: string | undefined;
}

interface DeterministicDiscoverTitlesFixture {
  match?: {
    tags?: string[] | undefined;
    genres?: string[] | undefined;
    limit?: number | undefined;
  };
  result?: CatalogCandidate[] | undefined;
  error?: string | undefined;
}

interface DeterministicResolveDealFixture {
  match?: {
    title?: string | undefined;
    country?: string | undefined;
    preferredShops?: number[] | undefined;
    dealsOnly?: boolean | undefined;
  };
  result?: DealResolution | undefined;
  error?: string | undefined;
}

export interface DeterministicRecommendationProviderFixtures {
  findDeals: DeterministicFindDealsFixture[];
  enrichDeals?: DeterministicEnrichDealsFixture[] | undefined;
  discoverTitles?: DeterministicDiscoverTitlesFixture[] | undefined;
  resolveDeal?: DeterministicResolveDealFixture[] | undefined;
  serviceOptions?:
    | {
        recommendationTimeBudgetMs?: number | undefined;
      }
    | undefined;
}

export interface DeterministicRecommendationAuditCase {
  index: number;
  caseId: string;
  group: DeterministicRecommendationAuditGroup;
  preferences: string;
  budget?: number | undefined;
  platforms?: string[] | undefined;
  country: string;
  providers: DeterministicRecommendationProviderFixtures;
  expectation: DeterministicRecommendationExpectation;
}

export interface DeterministicRecommendationAuditTopMatch {
  title: string;
  cut?: number | undefined;
  price?: { amount?: number; currency?: string } | undefined;
  multiplayer?: boolean | undefined;
  rating?: number | null | undefined;
  metacritic?: number | null | undefined;
  genres?: string[] | undefined;
  platforms?: string[] | undefined;
  tags?: string[] | undefined;
  steamDeckStatus?: SteamDeckCompatibility["status"] | null | undefined;
  matchedSignals?: string[] | undefined;
  missingEvidence?: string[] | undefined;
  recommendationReason?: string | undefined;
  evidenceCompleteness?: string | undefined;
  priceEvidenceSource?: string | undefined;
  platformEvidenceSource?: string | undefined;
  metadataEvidenceSource?: string | undefined;
}

export interface DeterministicRecommendationAuditResult {
  index: number;
  caseId: string;
  group: DeterministicRecommendationAuditGroup;
  preferences: string;
  budget?: number | undefined;
  platforms?: string[] | undefined;
  country: string;
  summary: string;
  warnings: string[];
  matchCount: number;
  topTitle: string | null;
  topMatch: DeterministicRecommendationAuditTopMatch | null;
  emptyReason?: string | undefined;
  flagged: boolean;
  timeout: boolean;
  error?: string | undefined;
}

export interface DeterministicRecommendationAuditTopCount {
  title: string;
  count: number;
}

export interface DeterministicRecommendationAuditSummary {
  total: number;
  zeroMatches: number;
  flagged: number;
  timeouts: number;
  topCounts: DeterministicRecommendationAuditTopCount[];
}

export interface DeterministicRecommendationAuditGroupSummary {
  uniqueTopPicks: number;
  topCounts: DeterministicRecommendationAuditTopCount[];
  flagged: number;
  timeouts: number;
}

export interface DeterministicRecommendationAuditRun {
  generatedAt: string;
  summary: DeterministicRecommendationAuditSummary;
  groups: Record<
    DeterministicRecommendationAuditGroup,
    DeterministicRecommendationAuditGroupSummary
  >;
  results: DeterministicRecommendationAuditResult[];
}

export interface DeterministicRecommendationAuditRunOptions {
  concurrency?: number | undefined;
  timeoutMs?: number | undefined;
  now?: Date | undefined;
}

export const DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_CONCURRENCY = 4;
export const DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_TIMEOUT_MS = 15_000;
export const DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_OUTPUT =
  "artifacts/deterministic-recommend-audit.json";

const DETERMINISTIC_RECOMMENDATION_AUDIT_GROUPS: DeterministicRecommendationAuditGroup[] = [
  "local-guardrail",
  "provider-outage",
  "steam-deck-overlay",
  "social-tiering",
  "junk-suppression"
];

export const DETERMINISTIC_RECOMMENDATION_AUDIT_CASES: DeterministicRecommendationAuditCase[] = [
  {
    index: 1,
    caseId: "local-multiplayer-party-brawler",
    group: "local-guardrail",
    preferences: "친구들이랑 웃기게 떠들면서 할 협동 할인 게임",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "trailblazers",
              title: "Trailblazers",
              priceAmount: 1_764,
              regularAmount: 44_400,
              cut: 96,
              genres: ["Racing", "Action", "Casual", "Sports", "Indie"],
              multiplayer: true,
              rating: 3.17,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "party-brawler-heroes",
              title: "Party Brawler Heroes",
              priceAmount: 9_900,
              regularAmount: 22_000,
              cut: 55,
              genres: ["Action", "Casual", "Party", "Indie"],
              multiplayer: true,
              rating: 4.05,
              metacritic: 78,
              metadataStatus: "unavailable"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Party Brawler Heroes",
      requiredTopSignals: ["party", "multiplayer"]
    }
  },
  {
    index: 2,
    caseId: "local-strategy-tactics-reviewed",
    group: "local-guardrail",
    preferences: "highly rated turn-based tactics",
    budget: 25_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "dominions-5",
              title: "Dominions 5 - Warriors of the Faith",
              priceAmount: 9_450,
              regularAmount: 43_000,
              cut: 78,
              genres: ["Strategy", "Indie"],
              multiplayer: true,
              rating: 4.67,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "tactics-breakthrough",
              title: "Tactics Breakthrough",
              priceAmount: 14_500,
              regularAmount: 22_300,
              cut: 35,
              genres: ["Strategy", "Tactics", "Indie"],
              multiplayer: false,
              rating: 4.6,
              metacritic: 74,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Tactics Breakthrough",
      forbiddenTopTitles: ["Dominions 5 - Warriors of the Faith"],
      requiredTopSignals: ["strategy", "tactics", "high-rating"]
    }
  },
  {
    index: 3,
    caseId: "local-deckbuilder-short-run",
    group: "local-guardrail",
    preferences: "가볍게 할 카드 로그라이크",
    budget: 15_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "aces-of-ruin-deluxe",
              title: "Aces of Ruin Deluxe",
              priceAmount: 11_900,
              regularAmount: 23_800,
              cut: 50,
              genres: ["Strategy", "Card", "Deckbuilder", "Roguelike"],
              multiplayer: false,
              rating: 4.2,
              metacritic: 81,
              metadataStatus: "rawg",
              steamDeckStatus: "playable"
            }),
            buildDeal({
              id: "ball-x-pit",
              title: "BALL x PIT",
              priceAmount: 11_250,
              regularAmount: 22_500,
              cut: 50,
              genres: ["Action", "Roguelike"],
              multiplayer: false,
              rating: 4.1,
              metadataStatus: "rawg",
              steamDeckStatus: "verified"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Aces of Ruin Deluxe",
      requiredTopSignals: ["card", "deckbuilder", "playable"]
    }
  },
  {
    index: 4,
    caseId: "local-action-roguelite-combat",
    group: "local-guardrail",
    preferences: "빠른 템포 로그라이트",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "inscryption",
              title: "Inscryption",
              priceAmount: 10_285,
              regularAmount: 28_571,
              cut: 64,
              genres: ["Indie", "Strategy", "Adventure", "Roguelike", "Deckbuilder", "Card"],
              multiplayer: false,
              rating: 4.38,
              metacritic: 86,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "ball-x-pit-action",
              title: "BALL x PIT",
              priceAmount: 11_250,
              regularAmount: 22_500,
              cut: 50,
              genres: ["Indie", "Action", "Roguelike"],
              multiplayer: false,
              rating: 4.1,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "BALL x PIT"
    }
  },
  {
    index: 5,
    caseId: "outage-rawg-timeout-reviewed-strategy",
    group: "provider-outage",
    preferences: "평가 좋은 전략 할인 게임",
    budget: 25_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "reviewed-strategy-fallback",
              title: "Reviewed Strategy Fallback",
              priceAmount: 15_900,
              regularAmount: 31_800,
              cut: 50,
              genres: ["Strategy", "Tactics"],
              multiplayer: false,
              rating: 4.25,
              metacritic: 80,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [{ error: "RAWG timeout" }]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Reviewed Strategy Fallback",
      requiredWarnings: ["RAWG 메타데이터를 불러오지 못해 가격 정보만 표시했습니다."]
    }
  },
  {
    index: 6,
    caseId: "outage-itad-partial-teamplay-survives",
    group: "provider-outage",
    preferences: "teamplay 할인작인데 경쟁 냄새 적은 것",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "orbital-teamplay-coop",
              title: "Orbital Teamplay Co-op",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["teamplay", "co-op", "multiplayer"],
              multiplayer: true,
              rating: 4.12,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          matchTitles: ["Orbital Teamplay Co-op"],
          result: {
            deals: [
              buildDeal({
                id: "orbital-teamplay-coop",
                title: "Orbital Teamplay Co-op",
                priceAmount: 13_500,
                regularAmount: 27_000,
                cut: 50,
                genres: ["Action", "Casual", "Co-op"],
                tags: ["teamplay", "co-op", "multiplayer"],
                multiplayer: true,
                rating: 4.12,
                metadataStatus: "missing"
              })
            ],
            warnings: [
              "ITAD request failed with 429",
              "가격 개요 정보가 없어 제목만 확인했습니다."
            ]
          }
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Orbital Teamplay Co-op",
      requiredWarnings: ["ITAD request failed with 429"]
    }
  },
  {
    index: 7,
    caseId: "outage-price-overview-missing-deckbuilder",
    group: "provider-outage",
    preferences: "잠깐씩 즐길 카드게임",
    budget: 15_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "aces-of-ruin-outage",
              title: "Aces of Ruin Deluxe",
              priceAmount: 11_900,
              regularAmount: 23_800,
              cut: 50,
              genres: ["Strategy", "Card", "Deckbuilder", "Roguelike"],
              multiplayer: false,
              rating: 4.2,
              metadataStatus: "missing",
              steamDeckStatus: "playable"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          matchTitles: ["Aces of Ruin Deluxe"],
          result: {
            deals: [
              buildDeal({
                id: "aces-of-ruin-outage",
                title: "Aces of Ruin Deluxe",
                priceAmount: 11_900,
                regularAmount: 23_800,
                cut: 50,
                genres: ["Strategy", "Card", "Deckbuilder", "Roguelike"],
                multiplayer: false,
                rating: 4.2,
                metadataStatus: "missing",
                steamDeckStatus: "playable"
              })
            ],
            warnings: ["가격 개요 정보가 없어 제목만 확인했습니다."]
          }
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Aces of Ruin Deluxe",
      requiredWarnings: ["가격 개요 정보가 없어 제목만 확인했습니다."]
    }
  },
  {
    index: 8,
    caseId: "outage-title-only-junk-stays-empty",
    group: "provider-outage",
    preferences: "party-friendly co-op on sale",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "ai-games-pack",
              title: "AI Games Collection",
              priceAmount: 7_900,
              regularAmount: 19_800,
              cut: 60,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          matchTitles: ["AI Games Collection"],
          result: {
            deals: [
              buildDeal({
                id: "ai-games-pack",
                title: "AI Games Collection",
                priceAmount: 7_900,
                regularAmount: 19_800,
                cut: 60,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing"
              })
            ],
            warnings: ["가격 개요 정보가 없어 제목만 확인했습니다."]
          }
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      forbiddenTopTitles: ["AI Games Collection"]
    }
  },
  {
    index: 9,
    caseId: "steam-deck-reviewed-strategy-overlay",
    group: "steam-deck-overlay",
    preferences: "스팀덱에서 평가 좋은 전략 게임",
    budget: 20_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "portable-tactics-complete",
              title: "Portable Tactics Complete",
              priceAmount: 14_900,
              regularAmount: 29_800,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "verified"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          matchTitles: ["Portable Tactics Complete"],
          result: {
            deals: [
              buildDeal({
                id: "portable-tactics-complete",
                title: "Portable Tactics Complete",
                priceAmount: 14_900,
                regularAmount: 29_800,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "verified"
              })
            ],
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "Steam Deck 호환성 정보를 확인하지 못했습니다."
            ]
          }
        }
      ],
      discoverTitles: [
        {
          match: { genres: ["strategy"] },
          result: [
            buildCatalogCandidate({
              title: "Portable Tactics",
              genres: ["Strategy", "Tactics"],
              tags: ["turn-based"],
              rating: 4.4,
              metacritic: 83
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Portable Tactics Complete",
      requiredWarnings: ["일부 메타데이터를 생략했습니다."]
    }
  },
  {
    index: 10,
    caseId: "steam-deck-strategy-roguelike-overlay",
    group: "steam-deck-overlay",
    preferences: "스팀덱에서 할 만한 전략 로그라이크",
    budget: 20_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "portable-rogue-tactics-deluxe",
              title: "Portable Rogue Tactics Deluxe",
              priceAmount: 16_500,
              regularAmount: 33_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "unknown"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          matchTitles: ["Portable Rogue Tactics Deluxe"],
          result: {
            deals: [
              buildDeal({
                id: "portable-rogue-tactics-deluxe",
                title: "Portable Rogue Tactics Deluxe",
                priceAmount: 16_500,
                regularAmount: 33_000,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "unknown"
              })
            ],
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "Steam Deck 호환성 정보를 확인하지 못했습니다."
            ]
          }
        }
      ],
      discoverTitles: [
        {
          match: { genres: ["strategy"], tags: ["roguelike", "roguelite"] },
          result: [
            buildCatalogCandidate({
              title: "Portable Rogue Tactics",
              genres: ["Strategy", "Roguelike"],
              tags: ["roguelike", "turn-based"],
              rating: 4.2,
              metacritic: 81
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      forbiddenTopSignals: ["unknown", "unsupported"]
    }
  },
  {
    index: 11,
    caseId: "steam-deck-unsupported-remains-rejected",
    group: "steam-deck-overlay",
    preferences: "스팀덱에서 할 만한 전략 로그라이크",
    budget: 20_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "unsupported-deck-rogue",
              title: "Unsupported Deck Rogue",
              priceAmount: 13_900,
              regularAmount: 27_800,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "unsupported"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "unsupported-deck-rogue",
                title: "Unsupported Deck Rogue",
                priceAmount: 13_900,
                regularAmount: 27_800,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "unsupported"
              })
            ],
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "Steam Deck 호환성 정보를 확인하지 못했습니다."
            ]
          }
        }
      ],
      discoverTitles: [
        {
          result: [
            buildCatalogCandidate({
              title: "Unsupported Deck Rogue",
              genres: ["Strategy", "Roguelike"],
              tags: ["roguelike", "turn-based"],
              rating: 4.3,
              metacritic: 82
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      forbiddenTopTitles: ["Unsupported Deck Rogue"]
    }
  },
  {
    index: 12,
    caseId: "steam-deck-deckbuilder-overlay",
    group: "steam-deck-overlay",
    preferences: "가볍게 할 카드 로그라이크",
    budget: 15_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "aces-of-ruin-portable",
              title: "Aces of Ruin Deluxe",
              priceAmount: 11_900,
              regularAmount: 23_800,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "playable"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "aces-of-ruin-portable",
                title: "Aces of Ruin Deluxe",
                priceAmount: 11_900,
                regularAmount: 23_800,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "playable"
              })
            ],
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "Steam Deck 호환성 정보를 확인하지 못했습니다."
            ]
          }
        }
      ],
      discoverTitles: [
        {
          result: [
            buildCatalogCandidate({
              title: "Aces of Ruin",
              genres: ["Strategy", "Card", "Deckbuilder", "Roguelike"],
              tags: ["card", "deckbuilder"],
              rating: 4.2,
              metacritic: 81
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Aces of Ruin Deluxe"
    }
  },
  {
    index: 13,
    caseId: "social-party-friendly-coop",
    group: "social-tiering",
    preferences: "party-friendly co-op on sale",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "party-brawler-heroes-social",
              title: "Party Brawler Heroes",
              priceAmount: 9_900,
              regularAmount: 22_000,
              cut: 55,
              genres: ["Action", "Casual", "Party"],
              tags: ["party", "multiplayer"],
              multiplayer: true,
              rating: 4.1,
              metacritic: 77,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "deponia-party",
              title: "Deponia",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: ["Adventure", "Puzzle"],
              multiplayer: false,
              metadataStatus: "missing"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Party Brawler Heroes",
      forbiddenTopTitles: ["Deponia"]
    }
  },
  {
    index: 14,
    caseId: "social-teamplay-explicit-wins",
    group: "social-tiering",
    preferences: "teamplay 할인작인데 경쟁 냄새 적은 것",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "orbital-teamplay",
              title: "Orbital Teamplay Co-op",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["teamplay", "co-op", "multiplayer"],
              multiplayer: true,
              rating: 4.12,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "racket-nx",
              title: "Racket: Nx",
              priceAmount: 14_900,
              regularAmount: 29_800,
              cut: 50,
              genres: ["Sports", "Party", "Arcade"],
              tags: ["party", "multiplayer"],
              multiplayer: true,
              rating: 4.3,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Orbital Teamplay Co-op",
      forbiddenTopTitles: ["Racket: Nx"]
    }
  },
  {
    index: 15,
    caseId: "social-hangout-not-pvp",
    group: "social-tiering",
    preferences: "hangout game for friends, not PvP",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "teamplay-coop-deluxe",
              title: "Teamplay Co-op Deluxe",
              priceAmount: 12_500,
              regularAmount: 25_000,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["teamplay", "co-op", "multiplayer"],
              multiplayer: true,
              rating: 4.08,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "competitive-arena",
              title: "Competitive Arena Ultra",
              priceAmount: 9_900,
              regularAmount: 33_000,
              cut: 70,
              genres: ["Action", "PvP"],
              tags: ["competitive", "pvp", "multiplayer"],
              multiplayer: true,
              rating: 4.0,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Teamplay Co-op Deluxe",
      forbiddenTopTitles: ["Competitive Arena Ultra"]
    }
  },
  {
    index: 16,
    caseId: "social-party-budget-cap",
    group: "social-tiering",
    preferences: "15000원 이하 party game",
    budget: 15_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "party-brawler-budget",
              title: "Party Brawler Heroes",
              priceAmount: 14_900,
              regularAmount: 22_000,
              cut: 32,
              genres: ["Action", "Casual", "Party"],
              tags: ["party", "multiplayer"],
              multiplayer: true,
              rating: 4.1,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "expensive-party",
              title: "Expensive Party Nights",
              priceAmount: 19_900,
              regularAmount: 39_800,
              cut: 50,
              genres: ["Action", "Party"],
              tags: ["party", "multiplayer"],
              multiplayer: true,
              rating: 4.3,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Party Brawler Heroes",
      forbiddenTopTitles: ["Expensive Party Nights"]
    }
  },
  {
    index: 17,
    caseId: "junk-deponia-rejected",
    group: "junk-suppression",
    preferences: "party-friendly co-op on sale",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "deponia",
              title: "Deponia",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: ["Indie", "Adventure", "Puzzle"],
              multiplayer: false,
              metadataStatus: "missing"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      expectedEmptyReason: "missing-social-metadata",
      forbiddenTopTitles: ["Deponia"]
    }
  },
  {
    index: 18,
    caseId: "junk-ai-games-rejected",
    group: "junk-suppression",
    preferences: "hangout game for friends, not PvP",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "ai-games",
              title: "AI Games",
              priceAmount: 7_500,
              regularAmount: 15_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      forbiddenTopTitles: ["AI Games"]
    }
  },
  {
    index: 19,
    caseId: "junk-bundle-demo-rejected",
    group: "junk-suppression",
    preferences: "friends-first co-op bargain",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "co-op-course-bundle",
              title: "Co-op Mastery Course Bundle",
              priceAmount: 11_000,
              regularAmount: 22_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "social-demo-pack",
              title: "Social Party Demo Pack",
              priceAmount: 5_000,
              regularAmount: 10_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      forbiddenTopTitles: ["Co-op Mastery Course Bundle", "Social Party Demo Pack"]
    }
  },
  {
    index: 20,
    caseId: "junk-good-vs-bad-prefers-good",
    group: "junk-suppression",
    preferences: "non-sweaty multiplayer sale for PC",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "deponia-plus",
              title: "Deponia",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: ["Adventure", "Puzzle"],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "orbital-teamplay-good",
              title: "Orbital Teamplay Co-op",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["teamplay", "co-op", "multiplayer"],
              multiplayer: true,
              rating: 4.12,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Orbital Teamplay Co-op",
      forbiddenTopTitles: ["Deponia"]
    }
  },
  {
    index: 21,
    caseId: "local-steam-deck-supported-beats-unknown",
    group: "local-guardrail",
    preferences: "스팀덱에서 할 전략 게임",
    budget: 20_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "deck-ready-tactics",
              title: "Deck Ready Tactics",
              priceAmount: 12_000,
              regularAmount: 24_000,
              cut: 50,
              genres: ["Strategy", "Tactics"],
              multiplayer: false,
              rating: 4.2,
              metacritic: 82,
              metadataStatus: "rawg",
              steamDeckStatus: "playable"
            }),
            buildDeal({
              id: "unknown-deck-strategy",
              title: "Unknown Deck Strategy",
              priceAmount: 9_000,
              regularAmount: 18_000,
              cut: 50,
              genres: ["Strategy", "Indie"],
              multiplayer: false,
              rating: 4.35,
              metacritic: 84,
              metadataStatus: "rawg",
              steamDeckStatus: "unknown"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Deck Ready Tactics",
      requiredTopSignals: ["strategy", "tactics", "playable"],
      forbiddenTopSignals: ["unsupported"],
      forbiddenWarnings: ["ITAD request failed with 429", "RAWG timeout"]
    }
  },
  {
    index: 22,
    caseId: "local-social-teamplay-beats-party-only",
    group: "local-guardrail",
    preferences: "co-op game for friends",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "orbital-teamplay-local",
              title: "Orbital Teamplay Co-op",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["teamplay", "co-op", "multiplayer"],
              multiplayer: true,
              rating: 4.12,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "party-brawler-local",
              title: "Party Brawler Heroes",
              priceAmount: 9_900,
              regularAmount: 22_000,
              cut: 55,
              genres: ["Action", "Casual", "Party"],
              tags: ["party", "multiplayer"],
              multiplayer: true,
              rating: 4.1,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 2,
      expectedTopTitle: "Orbital Teamplay Co-op",
      expectedTopGenres: ["Co-op"],
      requiredTopSignals: ["teamplay", "co-op", "multiplayer"]
    }
  },
  {
    index: 23,
    caseId: "local-strategy-warning-free-top-pick",
    group: "local-guardrail",
    preferences: "well-reviewed strategy game on sale",
    budget: 25_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "shining-force-iii",
              title: "Shining Force III",
              priceAmount: 17_900,
              regularAmount: 35_800,
              cut: 50,
              genres: ["Strategy", "Tactics"],
              multiplayer: false,
              rating: 4.25,
              metacritic: 81,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      maxMatchCount: 1,
      expectedTopTitle: "Shining Force III",
      expectedTopGenres: ["Strategy", "Tactics"],
      requiredTopSignals: ["strategy", "tactics"],
      forbiddenWarnings: ["RAWG timeout", "ITAD request failed with 429"]
    }
  },
  {
    index: 24,
    caseId: "outage-itad-429-strategy-still-recovers",
    group: "provider-outage",
    preferences: "리뷰 좋은 전략 세일겜",
    budget: 25_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "tactics-fallback-429",
              title: "Fallback Tactics Gold",
              priceAmount: 16_900,
              regularAmount: 33_800,
              cut: 50,
              genres: ["Strategy", "Tactics"],
              multiplayer: false,
              rating: 4.3,
              metacritic: 82,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "tactics-fallback-429",
                title: "Fallback Tactics Gold",
                priceAmount: 16_900,
                regularAmount: 33_800,
                cut: 50,
                genres: ["Strategy", "Tactics"],
                multiplayer: false,
                rating: 4.3,
                metacritic: 82,
                metadataStatus: "missing"
              })
            ],
            warnings: [
              "ITAD request failed with 429",
              "가격 개요 정보가 없어 제목만 확인했습니다."
            ]
          }
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Fallback Tactics Gold",
      expectedTopGenres: ["Strategy", "Tactics"],
      requiredWarnings: ["ITAD request failed with 429"],
      requiredTopSignals: ["strategy", "tactics"]
    }
  },
  {
    index: 25,
    caseId: "outage-rawg-timeout-social-rescue",
    group: "provider-outage",
    preferences: "party-friendly co-op on sale",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "party-brawler-rawg-timeout",
              title: "Party Brawler Heroes",
              priceAmount: 9_900,
              regularAmount: 22_000,
              cut: 55,
              genres: ["Action", "Casual", "Party"],
              tags: ["party", "multiplayer"],
              multiplayer: true,
              rating: 4.1,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "party-brawler-rawg-timeout",
                title: "Party Brawler Heroes",
                priceAmount: 9_900,
                regularAmount: 22_000,
                cut: 55,
                genres: ["Action", "Casual", "Party"],
                tags: ["party", "multiplayer"],
                multiplayer: true,
                rating: 4.1,
                metadataStatus: "missing"
              })
            ],
            warnings: ["RAWG timeout", "일부 메타데이터를 생략했습니다."]
          }
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Party Brawler Heroes",
      requiredWarnings: ["RAWG timeout"],
      requiredTopSignals: ["party", "multiplayer"]
    }
  },
  {
    index: 26,
    caseId: "outage-junk-partial-stays-empty",
    group: "provider-outage",
    preferences: "hangout game for friends, not PvP",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "deponia-partial",
              title: "Deponia",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: ["Adventure", "Puzzle"],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "ai-games-partial",
              title: "AI Games",
              priceAmount: 7_500,
              regularAmount: 15_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "deponia-partial",
                title: "Deponia",
                priceAmount: 9_900,
                regularAmount: 19_800,
                cut: 50,
                genres: ["Adventure", "Puzzle"],
                multiplayer: false,
                metadataStatus: "missing"
              }),
              buildDeal({
                id: "ai-games-partial",
                title: "AI Games",
                priceAmount: 7_500,
                regularAmount: 15_000,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing"
              })
            ],
            warnings: [
              "ITAD request failed with 429",
              "가격 개요 정보가 없어 제목만 확인했습니다."
            ]
          }
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      forbiddenTopTitles: ["Deponia", "AI Games"]
    }
  },
  {
    index: 27,
    caseId: "steam-deck-supported-beats-unknown-overlay",
    group: "steam-deck-overlay",
    preferences: "스팀덱에서 할 전략 게임",
    budget: 20_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "deck-playable-overlay",
              title: "Deck Ready Tactics",
              priceAmount: 12_000,
              regularAmount: 24_000,
              cut: 50,
              genres: ["Strategy", "Tactics"],
              multiplayer: false,
              rating: 4.2,
              metacritic: 82,
              metadataStatus: "rawg",
              steamDeckStatus: "playable"
            }),
            buildDeal({
              id: "deck-unknown-overlay",
              title: "Unknown Deck Strategy",
              priceAmount: 9_000,
              regularAmount: 18_000,
              cut: 50,
              genres: ["Strategy", "Indie"],
              multiplayer: false,
              rating: 4.35,
              metacritic: 84,
              metadataStatus: "rawg",
              steamDeckStatus: "unknown"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Deck Ready Tactics",
      requiredTopSignals: ["playable", "strategy"],
      forbiddenTopSignals: ["unsupported"]
    }
  },
  {
    index: 28,
    caseId: "steam-deck-unknown-allowed-after-strict-zero",
    group: "steam-deck-overlay",
    preferences: "스팀덱에서 평가 좋은 전략 게임",
    budget: 20_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "portable-unknown-tactics",
              title: "Portable Unknown Tactics",
              priceAmount: 14_500,
              regularAmount: 29_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "unknown"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "portable-unknown-tactics",
                title: "Portable Unknown Tactics",
                priceAmount: 14_500,
                regularAmount: 29_000,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "unknown"
              })
            ],
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "Steam Deck 호환성 정보를 확인하지 못했습니다."
            ]
          }
        }
      ],
      discoverTitles: [
        {
          result: [
            buildCatalogCandidate({
              title: "Portable Unknown Tactics",
              genres: ["Strategy", "Tactics"],
              tags: ["turn-based"],
              rating: 4.2,
              metacritic: 80
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      forbiddenTopSignals: ["unknown", "unsupported"]
    }
  },
  {
    index: 29,
    caseId: "steam-deck-playable-beats-unsupported",
    group: "steam-deck-overlay",
    preferences: "스팀덱에서 할 만한 전략 로그라이크",
    budget: 20_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "portable-playable-rogue",
              title: "Portable Rogue Tactics Deluxe",
              priceAmount: 16_500,
              regularAmount: 33_000,
              cut: 50,
              genres: ["Strategy", "Roguelike"],
              multiplayer: false,
              rating: 4.2,
              metacritic: 81,
              metadataStatus: "rawg",
              steamDeckStatus: "playable"
            }),
            buildDeal({
              id: "unsupported-rogue-overlay",
              title: "Unsupported Deck Rogue",
              priceAmount: 13_900,
              regularAmount: 27_800,
              cut: 50,
              genres: ["Strategy", "Roguelike"],
              multiplayer: false,
              rating: 4.3,
              metacritic: 82,
              metadataStatus: "rawg",
              steamDeckStatus: "unsupported"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Portable Rogue Tactics Deluxe",
      requiredTopSignals: ["playable", "strategy", "roguelike"],
      forbiddenTopSignals: ["unsupported"]
    }
  },
  {
    index: 30,
    caseId: "social-generic-coop-rejects-racket-nx",
    group: "social-tiering",
    preferences: "friends-first co-op bargain",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "orbital-teamplay-rich",
              title: "Orbital Teamplay Co-op",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["teamplay", "co-op", "multiplayer"],
              multiplayer: true,
              rating: 4.12,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "racket-nx-rich",
              title: "Racket: Nx",
              priceAmount: 14_900,
              regularAmount: 29_800,
              cut: 50,
              genres: ["Sports", "Party", "Arcade"],
              tags: ["party", "multiplayer"],
              multiplayer: true,
              rating: 4.3,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Orbital Teamplay Co-op",
      forbiddenTopTitles: ["Racket: Nx"],
      requiredTopSignals: ["teamplay", "co-op"],
      forbiddenTopSignals: ["sports"]
    }
  },
  {
    index: 31,
    caseId: "social-party-hangout-rejects-sports-outlier",
    group: "social-tiering",
    preferences: "party night bargain that is not about sweaty PvP",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "party-brawler-rich",
              title: "Party Brawler Heroes",
              priceAmount: 9_900,
              regularAmount: 22_000,
              cut: 55,
              genres: ["Action", "Casual", "Party"],
              tags: ["party", "multiplayer"],
              multiplayer: true,
              rating: 4.1,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "racket-nx-party",
              title: "Racket: Nx",
              priceAmount: 14_900,
              regularAmount: 29_800,
              cut: 50,
              genres: ["Sports", "Party", "Arcade"],
              tags: ["party", "multiplayer"],
              multiplayer: true,
              rating: 4.3,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Party Brawler Heroes",
      forbiddenTopTitles: ["Racket: Nx"],
      requiredTopSignals: ["party", "multiplayer"],
      forbiddenTopSignals: ["sports", "pvp"]
    }
  },
  {
    index: 32,
    caseId: "social-metadata-light-rescue-keeps-teamplay",
    group: "social-tiering",
    preferences: "shared-screen vibe 나는 multiplayer bargain",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "teamplay-rich-rescue",
              title: "Teamplay Co-op Deluxe",
              priceAmount: 12_500,
              regularAmount: 25_000,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["teamplay", "shared-screen", "multiplayer"],
              multiplayer: true,
              rating: 4.08,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "teamplay-rich-rescue",
                title: "Teamplay Co-op Deluxe",
                priceAmount: 12_500,
                regularAmount: 25_000,
                cut: 50,
                genres: ["Action", "Casual", "Co-op"],
                tags: ["teamplay", "shared-screen", "multiplayer"],
                multiplayer: true,
                rating: 4.08,
                metadataStatus: "missing"
              })
            ],
            warnings: ["가격 개요 정보가 없어 제목만 확인했습니다."]
          }
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Teamplay Co-op Deluxe",
      requiredWarnings: ["가격 개요 정보가 없어 제목만 확인했습니다."],
      requiredTopSignals: ["teamplay", "shared-screen", "multiplayer"]
    }
  },
  {
    index: 33,
    caseId: "junk-collection-rejected",
    group: "junk-suppression",
    preferences: "친구 모임용으로 바로 설명 가능한 할인작",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "co-op-collection",
              title: "Co-op Collection",
              priceAmount: 12_000,
              regularAmount: 24_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      forbiddenTopTitles: ["Co-op Collection"]
    }
  },
  {
    index: 34,
    caseId: "junk-good-teamplay-beats-ai-and-demo",
    group: "junk-suppression",
    preferences: "hangout-friendly game deal for PC",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "ai-games-rich",
              title: "AI Games",
              priceAmount: 7_500,
              regularAmount: 15_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "social-demo-pack-rich",
              title: "Social Party Demo Pack",
              priceAmount: 5_000,
              regularAmount: 10_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "orbital-teamplay-clean",
              title: "Orbital Teamplay Co-op",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["teamplay", "co-op", "multiplayer"],
              multiplayer: true,
              rating: 4.12,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Orbital Teamplay Co-op",
      forbiddenTopTitles: ["AI Games", "Social Party Demo Pack"],
      requiredTopSignals: ["teamplay", "multiplayer"]
    }
  },
  {
    index: 35,
    caseId: "junk-deckbuilder-good-beats-bundle",
    group: "junk-suppression",
    preferences: "짧게 돌리기 좋은 roguelike deckbuilder",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "deckbuilder-bundle",
              title: "Deckbuilder Bundle",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "aces-of-ruin-clean",
              title: "Aces of Ruin Deluxe",
              priceAmount: 11_900,
              regularAmount: 23_800,
              cut: 50,
              genres: ["Strategy", "Card", "Deckbuilder", "Roguelike"],
              multiplayer: false,
              rating: 4.2,
              metacritic: 81,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Aces of Ruin Deluxe",
      forbiddenTopTitles: ["Deckbuilder Bundle"],
      expectedTopGenres: ["Card", "Deckbuilder", "Roguelike"],
      requiredTopSignals: ["card", "deckbuilder", "roguelike"]
    }
  },
  {
    index: 36,
    caseId: "local-steam-deck-reviewed-strategy-warning-overlay",
    group: "local-guardrail",
    preferences: "스팀덱에서 평가 좋은 전략 게임",
    budget: 20_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "portable-tactics-complete-local",
              title: "Portable Tactics Complete",
              priceAmount: 14_900,
              regularAmount: 29_800,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "playable"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "portable-tactics-complete-local",
                title: "Portable Tactics Complete",
                priceAmount: 14_900,
                regularAmount: 29_800,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "playable"
              })
            ],
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
            ]
          }
        }
      ],
      discoverTitles: [
        {
          result: [
            buildCatalogCandidate({
              title: "Portable Tactics",
              genres: ["Strategy", "Tactics"],
              tags: ["turn-based"],
              rating: 4.4,
              metacritic: 83
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Portable Tactics Complete",
      requiredWarnings: [
        "일부 메타데이터를 생략했습니다.",
        "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
      ],
      expectedTopGenres: ["Strategy", "Tactics"],
      requiredTopSignals: ["strategy", "tactics", "playable"],
      forbiddenTopSignals: ["unsupported"]
    }
  },
  {
    index: 37,
    caseId: "local-steam-deck-deckbuilder-warning-overlay",
    group: "local-guardrail",
    preferences: "가볍게 할 카드 로그라이크",
    budget: 15_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "portable-arcana-local",
              title: "Portable Arcana Deluxe",
              priceAmount: 10_900,
              regularAmount: 21_800,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "unknown"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "portable-arcana-local",
                title: "Portable Arcana Deluxe",
                priceAmount: 10_900,
                regularAmount: 21_800,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "unknown"
              })
            ],
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
            ]
          }
        }
      ],
      discoverTitles: [
        {
          result: [
            buildCatalogCandidate({
              title: "Portable Arcana",
              genres: ["Card", "Deckbuilder", "Roguelike"],
              tags: ["card", "deckbuilder", "roguelike-deckbuilder"],
              rating: 4.2,
              metacritic: 80
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      requiredWarnings: [
        "일부 메타데이터를 생략했습니다.",
        "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
      ],
      forbiddenTopSignals: ["unknown", "unsupported"]
    }
  },
  {
    index: 38,
    caseId: "local-steam-deck-roguelike-warning-overlay",
    group: "local-guardrail",
    preferences: "스팀덱에서 할 만한 전략 로그라이크",
    budget: 20_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "portable-rogue-tactics-complete-local",
              title: "Portable Rogue Tactics Complete",
              priceAmount: 16_900,
              regularAmount: 33_800,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "playable"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "portable-rogue-tactics-complete-local",
                title: "Portable Rogue Tactics Complete",
                priceAmount: 16_900,
                regularAmount: 33_800,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "playable"
              })
            ],
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
            ]
          }
        }
      ],
      discoverTitles: [
        {
          result: [
            buildCatalogCandidate({
              title: "Portable Rogue Tactics",
              genres: ["Strategy", "Roguelike"],
              tags: ["turn-based", "roguelike"],
              rating: 4.3,
              metacritic: 82
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Portable Rogue Tactics Complete",
      requiredWarnings: [
        "일부 메타데이터를 생략했습니다.",
        "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
      ],
      expectedTopGenres: ["Strategy", "Roguelike"],
      requiredTopSignals: ["strategy", "roguelike", "playable"],
      forbiddenTopSignals: ["unsupported"]
    }
  },
  {
    index: 39,
    caseId: "outage-rawg-502-social-teamplay-recovers",
    group: "provider-outage",
    preferences: "teamplay 할인작인데 경쟁 냄새 적은 것",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "orbital-teamplay-rawg-502",
              title: "Orbital Teamplay Co-op",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["teamplay", "co-op", "multiplayer"],
              multiplayer: true,
              rating: 4.12,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "orbital-teamplay-rawg-502",
                title: "Orbital Teamplay Co-op",
                priceAmount: 13_500,
                regularAmount: 27_000,
                cut: 50,
                genres: ["Action", "Casual", "Co-op"],
                tags: ["teamplay", "co-op", "multiplayer"],
                multiplayer: true,
                rating: 4.12,
                metadataStatus: "missing"
              })
            ],
            warnings: ["RAWG timeout", "일부 메타데이터를 생략했습니다."]
          }
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Orbital Teamplay Co-op",
      requiredWarnings: ["RAWG timeout"],
      requiredTopSignals: ["teamplay", "co-op", "multiplayer"]
    }
  },
  {
    index: 40,
    caseId: "outage-price-overview-hybrid-two-axis-beats-filler",
    group: "provider-outage",
    preferences: "action deckbuilder bargain",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "solo-action-filler",
              title: "Solo Action Story",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: ["Action", "Adventure"],
              multiplayer: false,
              rating: 3.9,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "rogue-deck-assault",
              title: "Rogue Deck Assault",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Card", "Deckbuilder", "Roguelike"],
              tags: ["deckbuilder", "card", "roguelike"],
              multiplayer: false,
              rating: 4.18,
              metacritic: 81,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "solo-action-filler",
                title: "Solo Action Story",
                priceAmount: 9_900,
                regularAmount: 19_800,
                cut: 50,
                genres: ["Action", "Adventure"],
                multiplayer: false,
                rating: 3.9,
                metadataStatus: "missing"
              }),
              buildDeal({
                id: "rogue-deck-assault",
                title: "Rogue Deck Assault",
                priceAmount: 13_500,
                regularAmount: 27_000,
                cut: 50,
                genres: ["Action", "Card", "Deckbuilder", "Roguelike"],
                tags: ["deckbuilder", "card", "roguelike"],
                multiplayer: false,
                rating: 4.18,
                metacritic: 81,
                metadataStatus: "missing"
              })
            ],
            warnings: [
              "가격 개요 정보가 없어 제목만 확인했습니다.",
              "역대 최저가 정보를 가져오지 못했습니다."
            ]
          }
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Rogue Deck Assault",
      forbiddenTopTitles: ["Solo Action Story"],
      requiredWarnings: ["가격 개요 정보가 없어 제목만 확인했습니다."],
      expectedTopGenres: ["Action", "Card", "Deckbuilder"],
      requiredTopSignals: ["action", "card", "deckbuilder"]
    }
  },
  {
    index: 41,
    caseId: "outage-itad-429-junk-remains-empty",
    group: "provider-outage",
    preferences: "friends-only fun bargain, not sports",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "deponia-itad-429",
              title: "Deponia",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: ["Adventure", "Puzzle"],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "ai-games-itad-429",
              title: "AI Games",
              priceAmount: 7_500,
              regularAmount: 15_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "deponia-itad-429",
                title: "Deponia",
                priceAmount: 9_900,
                regularAmount: 19_800,
                cut: 50,
                genres: ["Adventure", "Puzzle"],
                multiplayer: false,
                metadataStatus: "missing"
              }),
              buildDeal({
                id: "ai-games-itad-429",
                title: "AI Games",
                priceAmount: 7_500,
                regularAmount: 15_000,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing"
              })
            ],
            warnings: [
              "ITAD request failed with 429",
              "가격 개요 정보가 없어 제목만 확인했습니다."
            ]
          }
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      requiredWarnings: ["ITAD request failed with 429"],
      forbiddenTopTitles: ["Deponia", "AI Games"]
    }
  },
  {
    index: 42,
    caseId: "steam-deck-rawg-timeout-playable-roguelike-recovers",
    group: "steam-deck-overlay",
    preferences: "스팀덱에서 할 만한 전략 로그라이크",
    budget: 20_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "portable-playable-timeout-rogue",
              title: "Portable Rogue Tactics Deluxe",
              priceAmount: 16_500,
              regularAmount: 33_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "playable"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "portable-playable-timeout-rogue",
                title: "Portable Rogue Tactics Deluxe",
                priceAmount: 16_500,
                regularAmount: 33_000,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "playable"
              })
            ],
            warnings: [
              "RAWG timeout",
              "일부 메타데이터를 생략했습니다.",
              "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
            ]
          }
        }
      ],
      discoverTitles: [
        {
          result: [
            buildCatalogCandidate({
              title: "Portable Rogue Tactics",
              genres: ["Strategy", "Roguelike"],
              tags: ["turn-based", "roguelike"],
              rating: 4.2,
              metacritic: 81
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Portable Rogue Tactics Deluxe",
      requiredWarnings: ["RAWG timeout"],
      expectedTopGenres: ["Strategy", "Roguelike"],
      requiredTopSignals: ["strategy", "roguelike", "playable"],
      forbiddenTopSignals: ["unsupported"]
    }
  },
  {
    index: 43,
    caseId: "steam-deck-itad-429-unknown-deckbuilder-recovers",
    group: "steam-deck-overlay",
    preferences: "스팀덱에서 가볍게 할 카드 덱빌딩",
    budget: 15_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "portable-deck-unknown-429",
              title: "Portable Arcana Deluxe",
              priceAmount: 10_900,
              regularAmount: 21_800,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "unknown"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "portable-deck-unknown-429",
                title: "Portable Arcana Deluxe",
                priceAmount: 10_900,
                regularAmount: 21_800,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "unknown"
              })
            ],
            warnings: [
              "ITAD request failed with 429",
              "가격 개요 정보가 없어 제목만 확인했습니다.",
              "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
            ]
          }
        }
      ],
      discoverTitles: [
        {
          result: [
            buildCatalogCandidate({
              title: "Portable Arcana",
              genres: ["Card", "Deckbuilder", "Roguelike"],
              tags: ["card", "deckbuilder", "roguelike-deckbuilder"],
              rating: 4.2,
              metacritic: 80
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      requiredWarnings: ["ITAD request failed with 429"],
      forbiddenTopSignals: ["unknown", "unsupported"]
    }
  },
  {
    index: 44,
    caseId: "steam-deck-timeout-junk-stays-empty",
    group: "steam-deck-overlay",
    preferences: "스팀덱에서 할 만한 전략 게임",
    budget: 20_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "deponia-steamdeck-timeout",
              title: "Deponia",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: ["Adventure", "Puzzle"],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "unknown"
            }),
            buildDeal({
              id: "ai-games-steamdeck-timeout",
              title: "AI Games",
              priceAmount: 7_500,
              regularAmount: 15_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "unknown"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "deponia-steamdeck-timeout",
                title: "Deponia",
                priceAmount: 9_900,
                regularAmount: 19_800,
                cut: 50,
                genres: ["Adventure", "Puzzle"],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "unknown"
              }),
              buildDeal({
                id: "ai-games-steamdeck-timeout",
                title: "AI Games",
                priceAmount: 7_500,
                regularAmount: 15_000,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "unknown"
              })
            ],
            warnings: [
              "RAWG timeout",
              "일부 메타데이터를 생략했습니다.",
              "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
            ]
          }
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      requiredWarnings: ["RAWG timeout"],
      forbiddenTopTitles: ["Deponia", "AI Games"],
      forbiddenTopSignals: ["unsupported"]
    }
  },
  {
    index: 45,
    caseId: "social-friends-first-teamplay-beats-racket-nx",
    group: "social-tiering",
    preferences: "friends-first co-op bargain",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "orbital-teamplay-friends-first",
              title: "Orbital Teamplay Co-op",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["teamplay", "co-op", "multiplayer"],
              multiplayer: true,
              rating: 4.12,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "racket-nx-friends-first",
              title: "Racket: Nx",
              priceAmount: 14_900,
              regularAmount: 29_800,
              cut: 50,
              genres: ["Sports", "Party", "Arcade"],
              tags: ["party", "multiplayer"],
              multiplayer: true,
              rating: 4.3,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Orbital Teamplay Co-op",
      forbiddenTopTitles: ["Racket: Nx"],
      requiredTopSignals: ["teamplay", "co-op", "multiplayer"],
      forbiddenTopSignals: ["sports"]
    }
  },
  {
    index: 46,
    caseId: "social-mixed-language-hangout-rejects-deponia",
    group: "social-tiering",
    preferences: "hangout-friendly game deal for friends, 스토리겜 말고",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "deponia-mixed-language",
              title: "Deponia",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: ["Adventure", "Puzzle"],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "hangout-teamplay-mixed",
              title: "Hangout Teamplay Deluxe",
              priceAmount: 12_900,
              regularAmount: 25_800,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["hangout", "teamplay", "multiplayer"],
              multiplayer: true,
              rating: 4.05,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Hangout Teamplay Deluxe",
      forbiddenTopTitles: ["Deponia"],
      requiredTopSignals: ["hangout", "teamplay", "multiplayer"]
    }
  },
  {
    index: 47,
    caseId: "social-budget-party-rejects-ai-games",
    group: "social-tiering",
    preferences: "15000원 이하 party game",
    budget: 15_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "ai-games-party-budget",
              title: "AI Games",
              priceAmount: 7_500,
              regularAmount: 15_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "party-brawler-budget-clean",
              title: "Party Brawler Heroes",
              priceAmount: 9_900,
              regularAmount: 22_000,
              cut: 55,
              genres: ["Action", "Casual", "Party"],
              tags: ["party", "multiplayer"],
              multiplayer: true,
              rating: 4.1,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Party Brawler Heroes",
      forbiddenTopTitles: ["AI Games"],
      requiredTopSignals: ["party", "multiplayer"]
    }
  },
  {
    index: 48,
    caseId: "junk-metadata-only-social-rejected",
    group: "junk-suppression",
    preferences: "party-friendly co-op on sale",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "metadata-only-social-pack",
              title: "Metadata Social Pack",
              priceAmount: 8_900,
              regularAmount: 17_800,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      forbiddenTopTitles: ["Metadata Social Pack"]
    }
  },
  {
    index: 49,
    caseId: "junk-course-and-demo-lose-to-valid-social",
    group: "junk-suppression",
    preferences: "hangout game for friends, not PvP",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "co-op-course-megabundle",
              title: "Co-op Course Megabundle",
              priceAmount: 7_900,
              regularAmount: 15_800,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "party-demo-collection",
              title: "Party Demo Collection",
              priceAmount: 4_900,
              regularAmount: 9_800,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "hangout-teamplay-clean",
              title: "Hangout Teamplay Deluxe",
              priceAmount: 12_900,
              regularAmount: 25_800,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["hangout", "teamplay", "multiplayer"],
              multiplayer: true,
              rating: 4.05,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Hangout Teamplay Deluxe",
      forbiddenTopTitles: ["Co-op Course Megabundle", "Party Demo Collection"],
      requiredTopSignals: ["hangout", "teamplay", "multiplayer"]
    }
  },
  {
    index: 50,
    caseId: "junk-hybrid-two-axis-beats-filler",
    group: "junk-suppression",
    preferences: "short-session action deckbuilder",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "single-axis-card-filler",
              title: "Card Puzzle Stories",
              priceAmount: 8_900,
              regularAmount: 17_800,
              cut: 50,
              genres: ["Card", "Puzzle"],
              multiplayer: false,
              rating: 3.8,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "two-axis-deck-assault",
              title: "Rogue Deck Assault",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Card", "Deckbuilder", "Roguelike"],
              tags: ["deckbuilder", "card", "roguelike"],
              multiplayer: false,
              rating: 4.18,
              metacritic: 81,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Rogue Deck Assault",
      forbiddenTopTitles: ["Card Puzzle Stories"],
      expectedTopGenres: ["Action", "Card", "Deckbuilder"],
      requiredTopSignals: ["action", "card", "deckbuilder"]
    }
  },
  {
    index: 51,
    caseId: "local-non-sweaty-teamplay-clean-smoke",
    group: "local-guardrail",
    preferences: "non-sweaty multiplayer sale for PC",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "local-orbital-teamplay-clean",
              title: "Orbital Teamplay Co-op",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["teamplay", "co-op", "multiplayer"],
              multiplayer: true,
              rating: 4.12,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "local-racket-nx-clean",
              title: "Racket: Nx",
              priceAmount: 14_900,
              regularAmount: 29_800,
              cut: 50,
              genres: ["Sports", "Party", "Arcade"],
              tags: ["party", "multiplayer"],
              multiplayer: true,
              rating: 4.3,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Orbital Teamplay Co-op",
      forbiddenTopTitles: ["Racket: Nx"],
      requiredTopSignals: ["teamplay", "co-op", "multiplayer"],
      forbiddenTopSignals: ["sports"],
      forbiddenWarnings: ["RAWG timeout", "ITAD request failed with 429"]
    }
  },
  {
    index: 52,
    caseId: "local-hybrid-deckbuilder-clean-smoke",
    group: "local-guardrail",
    preferences: "action deckbuilder bargain",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "local-balatro-filler",
              title: "Balatro",
              priceAmount: 11_900,
              regularAmount: 23_800,
              cut: 50,
              genres: ["Card", "Deckbuilder", "Roguelike"],
              tags: ["deckbuilder", "card"],
              multiplayer: false,
              rating: 4.22,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "local-rogue-deck-assault-clean",
              title: "Rogue Deck Assault",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Card", "Deckbuilder", "Roguelike"],
              tags: ["deckbuilder", "card", "roguelike"],
              multiplayer: false,
              rating: 4.18,
              metacritic: 81,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Rogue Deck Assault",
      forbiddenTopTitles: ["Balatro"],
      expectedTopGenres: ["Action", "Card", "Deckbuilder"],
      requiredTopSignals: ["action", "card", "deckbuilder"],
      forbiddenWarnings: ["가격 개요 정보가 없어 제목만 확인했습니다.", "ITAD request failed with 429"]
    }
  },
  {
    index: 53,
    caseId: "local-steam-deck-handheld-clean-smoke",
    group: "local-guardrail",
    preferences: "스팀덱으로 잠깐씩 할 카드 덱빌딩",
    budget: 15_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "local-portable-arcana-playable",
              title: "Portable Arcana Deluxe",
              priceAmount: 10_900,
              regularAmount: 21_800,
              cut: 50,
              genres: ["Card", "Deckbuilder", "Roguelike"],
              tags: ["card", "deckbuilder", "portable"],
              multiplayer: false,
              metadataStatus: "rawg",
              steamDeckStatus: "playable"
            }),
            buildDeal({
              id: "local-unsupported-deck-rogue",
              title: "Unsupported Deck Rogue",
              priceAmount: 8_900,
              regularAmount: 17_800,
              cut: 50,
              genres: ["Card", "Deckbuilder"],
              tags: ["card", "deckbuilder"],
              multiplayer: false,
              metadataStatus: "rawg",
              steamDeckStatus: "unsupported"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Portable Arcana Deluxe",
      expectedTopGenres: ["Card", "Deckbuilder", "Roguelike"],
      requiredTopSignals: ["card", "deckbuilder", "playable"],
      forbiddenTopSignals: ["unsupported"],
      forbiddenWarnings: ["RAWG timeout", "ITAD request failed with 429"]
    }
  },
  {
    index: 54,
    caseId: "outage-rawg-timeout-mixed-language-social-recovers",
    group: "provider-outage",
    preferences: "friends-first co-op bargain, 스포츠 말고",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "outage-hangout-teamplay-mixed",
              title: "Hangout Teamplay Deluxe",
              priceAmount: 12_900,
              regularAmount: 25_800,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["hangout", "teamplay", "multiplayer"],
              multiplayer: true,
              rating: 4.05,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "outage-deponia-mixed",
              title: "Deponia",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: ["Adventure", "Puzzle"],
              multiplayer: false,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "outage-hangout-teamplay-mixed",
                title: "Hangout Teamplay Deluxe",
                priceAmount: 12_900,
                regularAmount: 25_800,
                cut: 50,
                genres: ["Action", "Casual", "Co-op"],
                tags: ["hangout", "teamplay", "multiplayer"],
                multiplayer: true,
                rating: 4.05,
                metadataStatus: "missing"
              }),
              buildDeal({
                id: "outage-deponia-mixed",
                title: "Deponia",
                priceAmount: 9_900,
                regularAmount: 19_800,
                cut: 50,
                genres: ["Adventure", "Puzzle"],
                multiplayer: false,
                metadataStatus: "missing"
              })
            ],
            warnings: ["RAWG timeout", "일부 메타데이터를 생략했습니다."]
          }
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Hangout Teamplay Deluxe",
      requiredWarnings: ["RAWG timeout"],
      forbiddenTopTitles: ["Deponia"],
      requiredTopSignals: ["hangout", "teamplay", "multiplayer"]
    }
  },
  {
    index: 55,
    caseId: "outage-price-history-missing-junk-stays-empty",
    group: "provider-outage",
    preferences: "genre hybrid bargain, story filler 말고",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "outage-history-missing-deponia",
              title: "Deponia",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: ["Adventure", "Puzzle"],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "outage-history-missing-ai-games",
              title: "AI Games",
              priceAmount: 7_500,
              regularAmount: 15_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "outage-history-missing-deponia",
                title: "Deponia",
                priceAmount: 9_900,
                regularAmount: 19_800,
                cut: 50,
                genres: ["Adventure", "Puzzle"],
                multiplayer: false,
                metadataStatus: "missing"
              }),
              buildDeal({
                id: "outage-history-missing-ai-games",
                title: "AI Games",
                priceAmount: 7_500,
                regularAmount: 15_000,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing"
              })
            ],
            warnings: [
              "가격 개요 정보가 없어 제목만 확인했습니다.",
              "역대 최저가 정보를 가져오지 못했습니다."
            ]
          }
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      requiredWarnings: ["가격 개요 정보가 없어 제목만 확인했습니다."],
      forbiddenTopTitles: ["Deponia", "AI Games"]
    }
  },
  {
    index: 56,
    caseId: "outage-itad-429-handheld-recoverable-vs-junk",
    group: "provider-outage",
    preferences: "스팀덱으로 출퇴근길에 할 카드 로그라이크",
    budget: 15_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "outage-portable-arcana-429",
              title: "Portable Arcana Deluxe",
              priceAmount: 10_900,
              regularAmount: 21_800,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "unknown"
            }),
            buildDeal({
              id: "outage-deponia-handheld-429",
              title: "Deponia",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: ["Adventure", "Puzzle"],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "unsupported"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "outage-portable-arcana-429",
                title: "Portable Arcana Deluxe",
                priceAmount: 10_900,
                regularAmount: 21_800,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "unknown"
              }),
              buildDeal({
                id: "outage-deponia-handheld-429",
                title: "Deponia",
                priceAmount: 9_900,
                regularAmount: 19_800,
                cut: 50,
                genres: ["Adventure", "Puzzle"],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "unsupported"
              })
            ],
            warnings: [
              "ITAD request failed with 429",
              "가격 개요 정보가 없어 제목만 확인했습니다.",
              "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
            ]
          }
        }
      ],
      discoverTitles: [
        {
          result: [
            buildCatalogCandidate({
              title: "Portable Arcana",
              genres: ["Card", "Deckbuilder", "Roguelike"],
              tags: ["card", "deckbuilder", "portable"],
              rating: 4.2,
              metacritic: 80
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      requiredWarnings: ["ITAD request failed with 429"],
      forbiddenTopSignals: ["unknown", "unsupported"],
      forbiddenTopTitles: ["Deponia"]
    }
  },
  {
    index: 57,
    caseId: "steam-deck-lifestyle-story-filler-rejected",
    group: "steam-deck-overlay",
    preferences: "스팀덱으로 출퇴근길에 잠깐 할 세일 게임",
    budget: 20_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "steamdeck-lifestyle-portable-brawler",
              title: "Portable Lounge Brawler",
              priceAmount: 12_900,
              regularAmount: 25_800,
              cut: 50,
              genres: ["Action", "Casual"],
              tags: ["portable", "handheld", "short-session"],
              multiplayer: false,
              rating: 4.01,
              metadataStatus: "rawg",
              steamDeckStatus: "playable"
            }),
            buildDeal({
              id: "steamdeck-lifestyle-deponia",
              title: "Deponia",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: ["Adventure", "Puzzle"],
              multiplayer: false,
              metadataStatus: "rawg",
              steamDeckStatus: "unknown"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Portable Lounge Brawler",
      forbiddenTopTitles: ["Deponia"],
      requiredTopSignals: ["playable", "portable"],
      forbiddenTopSignals: ["unsupported"]
    }
  },
  {
    index: 58,
    caseId: "steam-deck-lifestyle-playable-recovers-under-partial-metadata",
    group: "steam-deck-overlay",
    preferences: "스팀덱으로 가볍게 즐길 handheld bargain",
    budget: 18_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "steamdeck-lifestyle-partial-portable",
              title: "Portable Lounge Brawler",
              priceAmount: 12_900,
              regularAmount: 25_800,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "playable"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "steamdeck-lifestyle-partial-portable",
                title: "Portable Lounge Brawler",
                priceAmount: 12_900,
                regularAmount: 25_800,
                cut: 50,
                genres: [],
                platforms: [],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "playable"
              })
            ],
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
            ]
          }
        }
      ],
      discoverTitles: [
        {
          result: [
            buildCatalogCandidate({
              title: "Portable Lounge Brawler",
              genres: ["Action", "Casual"],
              tags: ["portable", "handheld", "short-session"],
              rating: 4.01,
              metacritic: 77
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Portable Lounge Brawler",
      requiredWarnings: ["일부 메타데이터를 생략했습니다."],
      requiredTopSignals: ["playable", "portable"],
      forbiddenTopSignals: ["unsupported"]
    }
  },
  {
    index: 59,
    caseId: "steam-deck-lifestyle-unsupported-stays-empty",
    group: "steam-deck-overlay",
    preferences: "스팀덱으로 출퇴근길에 할 만한 할인 게임",
    budget: 20_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "steamdeck-lifestyle-unsupported-story",
              title: "Portable Story Archive",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: ["Adventure", "Story Rich"],
              tags: ["portable"],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "unsupported"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "steamdeck-lifestyle-unsupported-story",
                title: "Portable Story Archive",
                priceAmount: 9_900,
                regularAmount: 19_800,
                cut: 50,
                genres: ["Adventure", "Story Rich"],
                tags: ["portable"],
                multiplayer: false,
                metadataStatus: "missing",
                steamDeckStatus: "unsupported"
              })
            ],
            warnings: [
              "RAWG timeout",
              "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
            ]
          }
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      requiredWarnings: ["RAWG timeout"],
      forbiddenTopTitles: ["Portable Story Archive"],
      forbiddenTopSignals: ["unsupported"]
    }
  },
  {
    index: 60,
    caseId: "social-budget-strict-teamplay-rejects-racket-nx",
    group: "social-tiering",
    preferences: "15000원 이하 teamplay 할인작, sports 말고",
    budget: 15_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "social-budget-teamplay-clean",
              title: "Orbital Teamplay Co-op",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["teamplay", "co-op", "multiplayer"],
              multiplayer: true,
              rating: 4.12,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "social-budget-racket-nx",
              title: "Racket: Nx",
              priceAmount: 14_900,
              regularAmount: 29_800,
              cut: 50,
              genres: ["Sports", "Party", "Arcade"],
              tags: ["party", "multiplayer"],
              multiplayer: true,
              rating: 4.3,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Orbital Teamplay Co-op",
      forbiddenTopTitles: ["Racket: Nx"],
      requiredTopSignals: ["teamplay", "co-op", "multiplayer"],
      forbiddenTopSignals: ["sports"]
    }
  },
  {
    index: 61,
    caseId: "social-constraint-heavy-non-sweaty-not-sports-teamplay",
    group: "social-tiering",
    preferences: "non-sweaty multiplayer sale for PC, not PvP, not sports",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "social-constraint-teamplay-clean",
              title: "Orbital Teamplay Co-op",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["teamplay", "co-op", "multiplayer"],
              multiplayer: true,
              rating: 4.12,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "social-constraint-racket-nx",
              title: "Racket: Nx",
              priceAmount: 14_900,
              regularAmount: 29_800,
              cut: 50,
              genres: ["Sports", "Party", "Arcade"],
              tags: ["party", "multiplayer"],
              multiplayer: true,
              rating: 4.3,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "social-constraint-competitive",
              title: "Competitive Arena Ultra",
              priceAmount: 11_900,
              regularAmount: 23_800,
              cut: 50,
              genres: ["Action", "Shooter"],
              tags: ["pvp", "competitive", "multiplayer"],
              multiplayer: true,
              rating: 4,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Orbital Teamplay Co-op",
      forbiddenTopTitles: ["Racket: Nx", "Competitive Arena Ultra"],
      requiredTopSignals: ["teamplay", "co-op", "multiplayer"],
      forbiddenTopSignals: ["sports", "pvp", "competitive"]
    }
  },
  {
    index: 62,
    caseId: "social-mixed-language-friends-first-rejects-ai-games",
    group: "social-tiering",
    preferences: "hangout-friendly bargain, 팀플 느낌 강한 걸로, AI shovelware 말고",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "social-mixed-ai-games",
              title: "AI Games",
              priceAmount: 7_500,
              regularAmount: 15_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "social-mixed-hangout-teamplay",
              title: "Hangout Teamplay Deluxe",
              priceAmount: 12_900,
              regularAmount: 25_800,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["hangout", "teamplay", "multiplayer"],
              multiplayer: true,
              rating: 4.05,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Hangout Teamplay Deluxe",
      forbiddenTopTitles: ["AI Games"],
      requiredTopSignals: ["hangout", "teamplay", "multiplayer"]
    }
  },
  {
    index: 63,
    caseId: "junk-genre-hybrid-cozy-filler-loses-to-two-axis-match",
    group: "junk-suppression",
    preferences: "action deckbuilder bargain, cozy filler 말고",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "junk-cozy-grove-filler",
              title: "Cozy Grove",
              priceAmount: 11_900,
              regularAmount: 23_800,
              cut: 50,
              genres: ["Adventure", "Casual", "Cozy"],
              tags: ["cozy", "story-rich"],
              multiplayer: false,
              rating: 4.0,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "junk-cozy-rogue-deck-assault",
              title: "Rogue Deck Assault",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Card", "Deckbuilder", "Roguelike"],
              tags: ["deckbuilder", "card", "roguelike"],
              multiplayer: false,
              rating: 4.18,
              metacritic: 81,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Rogue Deck Assault",
      forbiddenTopTitles: ["Cozy Grove"],
      expectedTopGenres: ["Action", "Card", "Deckbuilder"],
      requiredTopSignals: ["action", "card", "deckbuilder"]
    }
  },
  {
    index: 64,
    caseId: "junk-hybrid-balatro-loses-when-action-axis-required",
    group: "junk-suppression",
    preferences: "action card roguelike bargain",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "junk-balatro-filler-action-required",
              title: "Balatro",
              priceAmount: 11_900,
              regularAmount: 23_800,
              cut: 50,
              genres: ["Card", "Deckbuilder", "Roguelike"],
              tags: ["deckbuilder", "card"],
              multiplayer: false,
              rating: 4.22,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "junk-rogue-deck-action-required",
              title: "Rogue Deck Assault",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Card", "Deckbuilder", "Roguelike"],
              tags: ["deckbuilder", "card", "roguelike"],
              multiplayer: false,
              rating: 4.18,
              metacritic: 81,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Rogue Deck Assault",
      forbiddenTopTitles: ["Balatro"],
      expectedTopGenres: ["Action", "Card", "Deckbuilder"],
      requiredTopSignals: ["action", "card", "deckbuilder"]
    }
  },
  {
    index: 65,
    caseId: "junk-hybrid-ball-pit-loses-when-deck-axis-required",
    group: "junk-suppression",
    preferences: "deckbuilder action bargain",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "junk-ball-pit-filler",
              title: "BALL x PIT",
              priceAmount: 12_900,
              regularAmount: 25_800,
              cut: 50,
              genres: ["Action", "Arcade", "Roguelike"],
              tags: ["action", "arcade"],
              multiplayer: false,
              rating: 4.08,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "junk-ball-pit-deck-assault",
              title: "Rogue Deck Assault",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Card", "Deckbuilder", "Roguelike"],
              tags: ["deckbuilder", "card", "roguelike"],
              multiplayer: false,
              rating: 4.18,
              metacritic: 81,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Rogue Deck Assault",
      forbiddenTopTitles: ["BALL x PIT"],
      expectedTopGenres: ["Action", "Card", "Deckbuilder"],
      requiredTopSignals: ["action", "card", "deckbuilder"]
    }
  },
  {
    index: 66,
    caseId: "local-strategy-rating-rawg-timeout-01",
    group: "local-guardrail",
    preferences: "평가 좋은 전략 할인 게임",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "reviewed-tactics-reserve-01",
              title: "Reviewed Tactics Reserve",
              priceAmount: 14_900,
              regularAmount: 29_800,
              cut: 50,
              genres: ["Strategy", "Tactics"],
              multiplayer: false,
              rating: 4.4,
              metacritic: 84,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "reviewed-tactics-reserve-01",
                title: "Reviewed Tactics Reserve",
                priceAmount: 14_900,
                regularAmount: 29_800,
                cut: 50,
                genres: ["Strategy", "Tactics"],
                multiplayer: false,
                rating: 4.4,
                metacritic: 84,
                metadataStatus: "missing"
              })
            ],
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "가격 개요 정보가 없어 제목만 확인했습니다."
            ]
          }
        }
      ],
      discoverTitles: [{ error: "RAWG request failed with timeout after 1500ms" }]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Reviewed Tactics Reserve",
      expectedTopGenres: ["Strategy", "Tactics"],
      requiredWarnings: [
        "가격 개요 정보가 없어 제목만 확인했습니다.",
        "RAWG request failed with timeout after 1500ms"
      ],
      requiredTopSignals: ["strategy", "tactics"]
    }
  },
  {
    index: 67,
    caseId: "local-strategy-rating-rawg-timeout-02",
    group: "local-guardrail",
    preferences: "리뷰 좋은 전략 세일겜",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "reviewed-tactics-reserve-02",
              title: "Reviewed Tactics Reserve",
              priceAmount: 14_900,
              regularAmount: 29_800,
              cut: 50,
              genres: ["Strategy", "Tactics"],
              multiplayer: false,
              rating: 4.4,
              metacritic: 84,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "reviewed-tactics-reserve-02",
                title: "Reviewed Tactics Reserve",
                priceAmount: 14_900,
                regularAmount: 29_800,
                cut: 50,
                genres: ["Strategy", "Tactics"],
                multiplayer: false,
                rating: 4.4,
                metacritic: 84,
                metadataStatus: "missing"
              })
            ],
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "가격 개요 정보가 없어 제목만 확인했습니다."
            ]
          }
        }
      ],
      discoverTitles: [{ error: "RAWG request failed with timeout after 1500ms" }]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Reviewed Tactics Reserve",
      expectedTopGenres: ["Strategy", "Tactics"],
      requiredWarnings: [
        "가격 개요 정보가 없어 제목만 확인했습니다.",
        "RAWG request failed with timeout after 1500ms"
      ],
      requiredTopSignals: ["strategy", "tactics"]
    }
  },
  {
    index: 68,
    caseId: "local-strategy-rating-rawg-timeout-03",
    group: "local-guardrail",
    preferences: "평 좋은 전략겜 세일 중인 것만",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "reviewed-tactics-reserve-03",
              title: "Reviewed Tactics Reserve",
              priceAmount: 14_900,
              regularAmount: 29_800,
              cut: 50,
              genres: ["Strategy", "Tactics"],
              multiplayer: false,
              rating: 4.4,
              metacritic: 84,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "reviewed-tactics-reserve-03",
                title: "Reviewed Tactics Reserve",
                priceAmount: 14_900,
                regularAmount: 29_800,
                cut: 50,
                genres: ["Strategy", "Tactics"],
                multiplayer: false,
                rating: 4.4,
                metacritic: 84,
                metadataStatus: "missing"
              })
            ],
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "가격 개요 정보가 없어 제목만 확인했습니다."
            ]
          }
        }
      ],
      discoverTitles: [{ error: "RAWG request failed with timeout after 1500ms" }]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Reviewed Tactics Reserve",
      expectedTopGenres: ["Strategy", "Tactics"],
      requiredWarnings: [
        "가격 개요 정보가 없어 제목만 확인했습니다.",
        "RAWG request failed with timeout after 1500ms"
      ],
      requiredTopSignals: ["strategy", "tactics"]
    }
  },
  {
    index: 69,
    caseId: "local-strategy-rating-rawg-timeout-04",
    group: "local-guardrail",
    preferences: "평점 높은 전략 게임",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "reviewed-tactics-reserve-04",
              title: "Reviewed Tactics Reserve",
              priceAmount: 14_900,
              regularAmount: 29_800,
              cut: 50,
              genres: ["Strategy", "Tactics"],
              multiplayer: false,
              rating: 4.4,
              metacritic: 84,
              metadataStatus: "missing"
            })
          ]
        }
      ],
      enrichDeals: [
        {
          result: {
            deals: [
              buildDeal({
                id: "reviewed-tactics-reserve-04",
                title: "Reviewed Tactics Reserve",
                priceAmount: 14_900,
                regularAmount: 29_800,
                cut: 50,
                genres: ["Strategy", "Tactics"],
                multiplayer: false,
                rating: 4.4,
                metacritic: 84,
                metadataStatus: "missing"
              })
            ],
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "가격 개요 정보가 없어 제목만 확인했습니다."
            ]
          }
        }
      ],
      discoverTitles: [{ error: "RAWG request failed with timeout after 1500ms" }]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Reviewed Tactics Reserve",
      expectedTopGenres: ["Strategy", "Tactics"],
      requiredWarnings: [
        "가격 개요 정보가 없어 제목만 확인했습니다.",
        "RAWG request failed with timeout after 1500ms"
      ],
      requiredTopSignals: ["strategy", "tactics"]
    }
  },
  {
    index: 70,
    caseId: "steam-deck-lifestyle-ai-games-loses-to-playable-portable",
    group: "steam-deck-overlay",
    preferences: "침대에서 눕겜으로 하기 좋은 스팀덱 할인 게임",
    budget: 18_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "portable-lounge-brawler-ai",
              title: "Portable Lounge Brawler",
              priceAmount: 12_900,
              regularAmount: 25_800,
              cut: 50,
              genres: ["Action", "Casual"],
              tags: ["portable", "handheld", "short-session"],
              multiplayer: false,
              rating: 4.05,
              metadataStatus: "rawg",
              steamDeckStatus: "playable"
            }),
            buildDeal({
              id: "steamdeck-ai-games",
              title: "AI Games",
              priceAmount: 7_500,
              regularAmount: 15_000,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "unknown"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Portable Lounge Brawler",
      forbiddenTopTitles: ["AI Games"],
      requiredTopSignals: ["playable", "portable"]
    }
  },
  {
    index: 71,
    caseId: "steam-deck-lifestyle-deckbuilder-beats-ball-x-pit",
    group: "steam-deck-overlay",
    preferences: "easy-to-read portable deckbuilder discount",
    budget: 18_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "portable-arcana-readable",
              title: "Portable Arcana Deluxe",
              priceAmount: 10_900,
              regularAmount: 21_800,
              cut: 50,
              genres: ["Card", "Deckbuilder", "Roguelike"],
              tags: ["card", "deckbuilder", "portable", "readable"],
              multiplayer: false,
              rating: 4.2,
              metacritic: 81,
              metadataStatus: "rawg",
              steamDeckStatus: "playable"
            }),
            buildDeal({
              id: "ball-x-pit-readable",
              title: "BALL x PIT",
              priceAmount: 11_250,
              regularAmount: 22_500,
              cut: 50,
              genres: ["Action", "Roguelike"],
              tags: ["action", "arcade"],
              multiplayer: false,
              rating: 4.1,
              metadataStatus: "rawg",
              steamDeckStatus: "playable"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Portable Arcana Deluxe",
      forbiddenTopTitles: ["BALL x PIT"],
      requiredTopSignals: ["deckbuilder", "portable", "playable"]
    }
  },
  {
    index: 72,
    caseId: "steam-deck-lifestyle-controller-friendly-portable-wins",
    group: "steam-deck-overlay",
    preferences: "컨트롤러만으로 막힘 없이 하는 handheld bargain",
    budget: 18_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "portable-controller-ready",
              title: "Portable Controller Ready",
              priceAmount: 13_200,
              regularAmount: 26_400,
              cut: 50,
              genres: ["Action", "Casual"],
              tags: ["portable", "controller-friendly", "handheld"],
              multiplayer: false,
              rating: 4.04,
              metadataStatus: "rawg",
              steamDeckStatus: "playable"
            }),
            buildDeal({
              id: "steamdeck-ai-games-controller",
              title: "AI Games",
              priceAmount: 6_900,
              regularAmount: 13_800,
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckStatus: "unknown"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Portable Controller Ready",
      forbiddenTopTitles: ["AI Games"],
      requiredTopSignals: ["portable", "playable"]
    }
  },
  {
    index: 73,
    caseId: "steam-deck-lifestyle-readability-story-filler-loses",
    group: "steam-deck-overlay",
    preferences: "글자 너무 작지 않은 스팀덱용 로그라이크",
    budget: 18_000,
    platforms: ["Steam Deck"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "portable-readable-roguelite",
              title: "Portable Readable Roguelite",
              priceAmount: 14_200,
              regularAmount: 28_400,
              cut: 50,
              genres: ["Action", "Roguelike"],
              tags: ["portable", "handheld", "readable"],
              multiplayer: false,
              rating: 4.08,
              metadataStatus: "rawg",
              steamDeckStatus: "playable"
            }),
            buildDeal({
              id: "deponia-readable",
              title: "Deponia",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: ["Adventure", "Puzzle"],
              multiplayer: false,
              metadataStatus: "rawg",
              steamDeckStatus: "unknown"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Portable Readable Roguelite",
      forbiddenTopTitles: ["Deponia"],
      requiredTopSignals: ["playable", "portable", "roguelike"]
    }
  },
  {
    index: 74,
    caseId: "junk-deckbuilding-brightgunner-loses-to-card-synergy",
    group: "junk-suppression",
    preferences: "핸드 관리 위주 카드 전투 세일작",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "brightgunner-filler",
              title: "BrightGunner",
              priceAmount: 11_800,
              regularAmount: 23_600,
              cut: 50,
              genres: ["Action", "Shooter"],
              tags: ["action", "shooter"],
              multiplayer: false,
              rating: 4.1,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "card-deckbuilder-expedition",
              title: "Card Deckbuilder Expedition",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Strategy", "Card", "Deckbuilder", "Roguelike"],
              tags: ["card", "deckbuilder", "hand-management"],
              multiplayer: false,
              rating: 4.32,
              metacritic: 82,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Card Deckbuilder Expedition",
      forbiddenTopTitles: ["BrightGunner"],
      requiredTopSignals: ["card", "deckbuilder"]
    }
  },
  {
    index: 75,
    caseId: "junk-deckbuilding-deponia-loses-to-deckbuilder",
    group: "junk-suppression",
    preferences: "덱 굴리는 맛 좋은 할인 게임",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "deponia-deck-junk",
              title: "Deponia",
              priceAmount: 9_900,
              regularAmount: 19_800,
              cut: 50,
              genres: ["Adventure", "Puzzle"],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "monster-train-raw",
              title: "Monster Train",
              priceAmount: 15_200,
              regularAmount: 30_400,
              cut: 50,
              genres: ["Strategy", "Card", "Deckbuilder", "Roguelike"],
              tags: ["card", "deckbuilder", "deck"],
              multiplayer: false,
              rating: 4.3,
              metacritic: 86,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Monster Train",
      forbiddenTopTitles: ["Deponia"],
      requiredTopSignals: ["card", "deckbuilder"]
    }
  },
  {
    index: 76,
    caseId: "junk-deckbuilding-two-axis-beats-single-axis-filler",
    group: "junk-suppression",
    preferences: "전투는 카드로 풀지만 너무 무겁지 않은 세일작",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "single-axis-filler",
              title: "BrightGunner",
              priceAmount: 10_900,
              regularAmount: 21_800,
              cut: 50,
              genres: ["Action", "Shooter"],
              tags: ["action"],
              multiplayer: false,
              rating: 4.0,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "dice-fold-two-axis",
              title: "Dice & Fold",
              priceAmount: 14_900,
              regularAmount: 29_800,
              cut: 50,
              genres: ["Card", "Deckbuilder", "Roguelike"],
              tags: ["card", "deckbuilder", "lightweight"],
              multiplayer: false,
              rating: 4.18,
              metacritic: 80,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Dice & Fold",
      forbiddenTopTitles: ["BrightGunner"],
      requiredTopSignals: ["card", "deckbuilder"]
    }
  },
  {
    index: 77,
    caseId: "junk-action-roguelite-brightgunner-loses-to-ball-pit",
    group: "junk-suppression",
    preferences: "real-time roguelite with strong combat",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "brightgunner-action-filler",
              title: "BrightGunner",
              priceAmount: 10_900,
              regularAmount: 21_800,
              cut: 50,
              genres: ["Action", "Shooter"],
              tags: ["action", "shooter"],
              multiplayer: false,
              rating: 4.0,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "ball-pit-action-roguelite",
              title: "BALL x PIT",
              priceAmount: 12_900,
              regularAmount: 25_800,
              cut: 50,
              genres: ["Action", "Roguelike"],
              tags: ["action", "arcade", "roguelike"],
              multiplayer: false,
              rating: 4.08,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "BALL x PIT",
      forbiddenTopTitles: ["BrightGunner"],
      requiredTopSignals: ["action", "roguelike"]
    }
  },
  {
    index: 78,
    caseId: "junk-action-card-inscryption-loses-when-action-axis-required",
    group: "junk-suppression",
    preferences: "action card roguelike bargain",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "inscryption-hybrid-filler",
              title: "Inscryption",
              priceAmount: 12_900,
              regularAmount: 25_800,
              cut: 50,
              genres: ["Card", "Deckbuilder", "Roguelike"],
              tags: ["card", "deckbuilder", "roguelike"],
              multiplayer: false,
              rating: 4.15,
              metacritic: 85,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "rogue-deck-assault-action-card",
              title: "Rogue Deck Assault",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Card", "Deckbuilder", "Roguelike"],
              tags: ["action", "card", "deckbuilder", "roguelike"],
              multiplayer: false,
              rating: 4.18,
              metacritic: 81,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Rogue Deck Assault",
      forbiddenTopTitles: ["Inscryption"],
      requiredTopSignals: ["action", "card", "deckbuilder"]
    }
  },
  {
    index: 79,
    caseId: "junk-short-session-cozy-grove-loses-to-arcade-run",
    group: "junk-suppression",
    preferences: "짧은 세션용 shooter roguelite",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "cozy-grove-short-filler",
              title: "Cozy Grove",
              priceAmount: 11_900,
              regularAmount: 23_800,
              cut: 50,
              genres: ["Adventure", "Casual", "Cozy"],
              tags: ["cozy", "story-rich"],
              multiplayer: false,
              rating: 4.0,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "ball-pit-short-session",
              title: "BALL x PIT",
              priceAmount: 12_900,
              regularAmount: 25_800,
              cut: 50,
              genres: ["Action", "Roguelike"],
              tags: ["action", "arcade", "roguelike", "short-run"],
              multiplayer: false,
              rating: 4.08,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "BALL x PIT",
      forbiddenTopTitles: ["Cozy Grove"],
      requiredTopSignals: ["action", "roguelike"]
    }
  },
  {
    index: 80,
    caseId: "junk-genre-hybrid-inscryption-loses-when-second-axis-missing",
    group: "junk-suppression",
    preferences: "action deckbuilder bargain, cozy filler 말고",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "inscryption-second-axis-missing",
              title: "Inscryption",
              priceAmount: 12_900,
              regularAmount: 25_800,
              cut: 50,
              genres: ["Card", "Deckbuilder", "Roguelike"],
              tags: ["card", "deckbuilder", "roguelike"],
              multiplayer: false,
              rating: 4.15,
              metacritic: 85,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "rogue-deck-assault-two-axis",
              title: "Rogue Deck Assault",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Card", "Deckbuilder", "Roguelike"],
              tags: ["action", "card", "deckbuilder", "roguelike"],
              multiplayer: false,
              rating: 4.18,
              metacritic: 81,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Rogue Deck Assault",
      forbiddenTopTitles: ["Inscryption"],
      requiredTopSignals: ["action", "card", "deckbuilder"]
    }
  },
  {
    index: 81,
    caseId: "local-strategy-rating-dominions-loses-to-tactics",
    group: "local-guardrail",
    preferences: "평이 단단한 전략 할인 게임",
    budget: 25_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "dominions-heavy",
              title: "Dominions 5 - Warriors of the Faith",
              priceAmount: 16_500,
              regularAmount: 33_000,
              cut: 50,
              genres: ["Strategy"],
              tags: ["grand strategy", "wargame", "simulation", "reading-heavy"],
              multiplayer: false,
              rating: 4.25,
              metacritic: 82,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "tactics-breakthrough-reviewed",
              title: "Tactics Breakthrough",
              priceAmount: 17_900,
              regularAmount: 35_800,
              cut: 50,
              genres: ["Strategy", "Tactics"],
              tags: ["tactics", "turn-based"],
              multiplayer: false,
              rating: 4.3,
              metacritic: 84,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Tactics Breakthrough",
      forbiddenTopTitles: ["Dominions 5 - Warriors of the Faith"],
      requiredTopSignals: ["strategy", "tactics", "high-rating"]
    }
  },
  {
    index: 82,
    caseId: "social-friends-gathering-rejects-brightgunner",
    group: "social-tiering",
    preferences: "친구들 모였을 때 바로 켜기 좋은 할인 게임",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "brightgunner-social-gathering",
              title: "BrightGunner",
              priceAmount: 0,
              regularAmount: 21_800,
              cut: 100,
              genres: ["Indie", "Action"],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "hangout-ready-teamplay",
              title: "Hangout Teamplay Deluxe",
              priceAmount: 14_900,
              regularAmount: 29_800,
              cut: 50,
              genres: ["Action", "Casual", "Co-op"],
              tags: ["hangout", "teamplay", "co-op", "multiplayer"],
              multiplayer: true,
              rating: 4.11,
              metacritic: 79,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectedTopTitle: "Hangout Teamplay Deluxe",
      forbiddenTopTitles: ["BrightGunner"],
      requiredTopSignals: ["teamplay", "multiplayer"]
    }
  },
  {
    index: 83,
    caseId: "junk-constraint-action-roguelite-not-filler-beats-ball-pit",
    group: "junk-suppression",
    preferences: "카드 말고 액션 로그라이트, filler도 말고",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "ball-pit-constraint-filler",
              title: "BALL x PIT",
              priceAmount: 12_900,
              regularAmount: 25_800,
              cut: 50,
              genres: ["Action", "Roguelike"],
              tags: ["action", "roguelike"],
              multiplayer: false,
              rating: 4.08,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "arcade-run-zero",
              title: "Arcade Run Zero",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Arcade", "Roguelike"],
              tags: ["action", "combat", "roguelike", "short-run"],
              multiplayer: false,
              rating: 4.28,
              metacritic: 82,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectedTopTitle: "Arcade Run Zero",
      forbiddenTopTitles: ["BALL x PIT"],
      requiredTopSignals: ["action", "roguelike"]
    }
  },
  {
    index: 84,
    caseId: "junk-constraint-strategy-not-grand-strategy-rejects-brightgunner",
    group: "junk-suppression",
    preferences: "전략은 좋은데 grand strategy 말고 할인 중인 것",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "brightgunner-grand-strategy-filler",
              title: "BrightGunner",
              priceAmount: 0,
              regularAmount: 21_800,
              cut: 100,
              genres: ["Indie", "Action"],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "dominions-grand-strategy-heavy",
              title: "Dominions 5 - Warriors of the Faith",
              priceAmount: 16_500,
              regularAmount: 33_000,
              cut: 50,
              genres: ["Strategy"],
              tags: ["grand strategy", "wargame", "simulation", "reading-heavy"],
              multiplayer: false,
              rating: 4.25,
              metacritic: 82,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "reviewed-tactics-lite-grand",
              title: "Reviewed Tactics Reserve",
              priceAmount: 17_500,
              regularAmount: 35_000,
              cut: 50,
              genres: ["Strategy", "Tactics"],
              tags: ["tactics", "turn-based"],
              multiplayer: false,
              rating: 4.35,
              metacritic: 84,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Reviewed Tactics Reserve",
      forbiddenTopTitles: ["BrightGunner", "Dominions 5 - Warriors of the Faith"],
      requiredTopSignals: ["strategy", "tactics"]
    }
  },
  {
    index: 85,
    caseId: "junk-constraint-turn-based-not-deck-roguelike-beats-ball-pit",
    group: "junk-suppression",
    preferences: "turn-based 말고 deck 아닌 로그라이크",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "ball-pit-turnbased-not-deck",
              title: "BALL x PIT",
              priceAmount: 12_900,
              regularAmount: 25_800,
              cut: 50,
              genres: ["Action", "Roguelike"],
              tags: ["action", "roguelike"],
              multiplayer: false,
              rating: 4.08,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "arcade-run-zero-turnbased-not-deck",
              title: "Arcade Run Zero",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Arcade", "Roguelike"],
              tags: ["action", "combat", "roguelike", "real-time"],
              multiplayer: false,
              rating: 4.28,
              metacritic: 82,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "dwarf-fortress-turnbased-bad",
              title: "Dwarf Fortress",
              priceAmount: 15_000,
              regularAmount: 30_000,
              cut: 50,
              genres: ["Strategy", "Simulation", "Roguelike", "Turn-Based"],
              tags: ["turn-based", "simulation"],
              multiplayer: false,
              rating: 4.33,
              metacritic: 93,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectedTopTitle: "Arcade Run Zero",
      forbiddenTopTitles: ["BALL x PIT", "Dwarf Fortress"],
      requiredTopSignals: ["action", "roguelike"]
    }
  },
  {
    index: 86,
    caseId: "junk-constraint-thoughtful-not-grand-strategy-rejects-brightgunner",
    group: "junk-suppression",
    preferences: "grand strategy는 아닌데 생각할 맛 있는 세일작",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "brightgunner-thoughtful-filler",
              title: "BrightGunner",
              priceAmount: 0,
              regularAmount: 21_800,
              cut: 100,
              genres: ["Indie", "Action"],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "dominions-thoughtful-grand",
              title: "Dominions 5 - Warriors of the Faith",
              priceAmount: 16_500,
              regularAmount: 33_000,
              cut: 50,
              genres: ["Strategy"],
              tags: ["grand strategy", "wargame", "simulation", "reading-heavy"],
              multiplayer: false,
              rating: 4.25,
              metacritic: 82,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "tactics-reserve-thoughtful",
              title: "Reviewed Tactics Reserve",
              priceAmount: 17_500,
              regularAmount: 35_000,
              cut: 50,
              genres: ["Strategy", "Tactics"],
              tags: ["tactics", "turn-based"],
              multiplayer: false,
              rating: 4.35,
              metacritic: 84,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 1,
      expectedTopTitle: "Reviewed Tactics Reserve",
      forbiddenTopTitles: ["BrightGunner", "Dominions 5 - Warriors of the Faith"],
      requiredTopSignals: ["strategy", "tactics"]
    }
  },
  {
    index: 87,
    caseId: "junk-constraint-roguelike-not-turn-based-beats-ball-pit",
    group: "junk-suppression",
    preferences: "턴제는 아닌데 로그라이크 느낌은 나는 세일작",
    budget: 18_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "ball-pit-not-turnbased",
              title: "BALL x PIT",
              priceAmount: 12_900,
              regularAmount: 25_800,
              cut: 50,
              genres: ["Action", "Roguelike"],
              tags: ["action", "roguelike"],
              multiplayer: false,
              rating: 4.08,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "arcade-run-zero-not-turnbased",
              title: "Arcade Run Zero",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Arcade", "Roguelike"],
              tags: ["action", "combat", "roguelike", "real-time"],
              multiplayer: false,
              rating: 4.28,
              metacritic: 82,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectedTopTitle: "Arcade Run Zero",
      forbiddenTopTitles: ["BALL x PIT"],
      requiredTopSignals: ["action", "roguelike"]
    }
  },
  {
    index: 88,
    caseId: "junk-hybrid-strategy-roguelike-beats-shogun-showdown",
    group: "junk-suppression",
    preferences: "전략이랑 로그라이크가 같이 있는 세일작",
    budget: 22_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "shogun-showdown-hybrid",
              title: "Shogun Showdown",
              priceAmount: 11_263,
              regularAmount: 22_526,
              cut: 50,
              genres: ["Strategy", "Roguelike", "Card", "Deckbuilder"],
              tags: ["strategy", "roguelike", "card", "deckbuilder"],
              multiplayer: false,
              rating: 4.36,
              metacritic: 84,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "rogue-tactics-reserve",
              title: "Rogue Tactics Reserve",
              priceAmount: 15_900,
              regularAmount: 31_800,
              cut: 50,
              genres: ["Strategy", "Tactics", "Roguelike", "Action"],
              tags: ["strategy", "tactics", "roguelike", "action"],
              multiplayer: false,
              rating: 4.42,
              metacritic: 86,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectedTopTitle: "Rogue Tactics Reserve",
      forbiddenTopTitles: ["Shogun Showdown"],
      requiredTopSignals: ["strategy", "roguelike"]
    }
  },
  {
    index: 89,
    caseId: "junk-hybrid-casual-strategy-rejects-dominions",
    group: "junk-suppression",
    preferences: "casual strategy hybrid game",
    budget: 22_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "dominions-casual-hybrid-bad",
              title: "Dominions 5 - Warriors of the Faith",
              priceAmount: 9_450,
              regularAmount: 43_000,
              cut: 78,
              genres: ["Strategy", "Indie"],
              tags: ["grand strategy", "wargame", "simulation", "reading-heavy"],
              multiplayer: true,
              rating: 4.67,
              metacritic: 82,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "brightgunner-casual-hybrid-bad",
              title: "BrightGunner",
              priceAmount: 0,
              regularAmount: 21_800,
              cut: 100,
              genres: ["Indie", "Action"],
              multiplayer: false,
              metadataStatus: "missing"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      forbiddenTopTitles: ["Dominions 5 - Warriors of the Faith", "BrightGunner"]
    }
  },
  {
    index: 90,
    caseId: "junk-hybrid-action-buildcraft-rejects-brightgunner",
    group: "junk-suppression",
    preferences: "arcade action plus buildcraft hybrid deal",
    budget: 22_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "brightgunner-buildcraft-bad",
              title: "BrightGunner",
              priceAmount: 0,
              regularAmount: 21_800,
              cut: 100,
              genres: ["Indie", "Action"],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "rogue-deck-assault-buildcraft",
              title: "Rogue Deck Assault",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Card", "Deckbuilder", "Roguelike"],
              tags: ["action", "card", "deckbuilder", "roguelike"],
              multiplayer: false,
              rating: 4.18,
              metacritic: 81,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectedTopTitle: "Rogue Deck Assault",
      forbiddenTopTitles: ["BrightGunner"],
      requiredTopSignals: ["action", "card", "deckbuilder"]
    }
  },
  {
    index: 91,
    caseId: "junk-hybrid-systems-heavy-not-oppressive-stays-empty",
    group: "junk-suppression",
    preferences: "systems-heavy but not oppressive hybrid bargain",
    budget: 22_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "brightgunner-systems-hybrid-bad",
              title: "BrightGunner",
              priceAmount: 0,
              regularAmount: 21_800,
              cut: 100,
              genres: ["Indie", "Action"],
              multiplayer: false,
              metadataStatus: "missing"
            }),
            buildDeal({
              id: "dominions-systems-hybrid-bad",
              title: "Dominions 5 - Warriors of the Faith",
              priceAmount: 9_450,
              regularAmount: 43_000,
              cut: 78,
              genres: ["Strategy", "Indie"],
              tags: ["grand strategy", "wargame", "simulation", "reading-heavy"],
              multiplayer: true,
              rating: 4.67,
              metacritic: 82,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectMatchCount: 0,
      forbiddenTopTitles: ["BrightGunner", "Dominions 5 - Warriors of the Faith"]
    }
  },
  {
    index: 92,
    caseId: "junk-observed-strategy-rating-grand-strategy-rejects-dominions",
    group: "junk-suppression",
    preferences: "grand strategy 말고 검증된 전략 세일작",
    budget: 25_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "dominions-grand-strategy-observed-bad",
              title: "Dominions 5 - Warriors of the Faith",
              priceAmount: 9_450,
              regularAmount: 43_000,
              cut: 78,
              genres: ["Strategy", "Indie"],
              tags: ["grand strategy", "wargame", "simulation", "reading-heavy"],
              multiplayer: true,
              rating: 4.67,
              metacritic: 82,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "tactics-breakthrough-reviewed",
              title: "Tactics Breakthrough",
              priceAmount: 16_900,
              regularAmount: 33_800,
              cut: 50,
              genres: ["Strategy", "Tactics"],
              tags: ["tactics", "strategy", "turn-based"],
              multiplayer: false,
              rating: 4.34,
              metacritic: 84,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectedTopTitle: "Tactics Breakthrough",
      forbiddenTopTitles: ["Dominions 5 - Warriors of the Faith"],
      requiredTopSignals: ["strategy", "tactics", "high-rating"]
    }
  },
  {
    index: 93,
    caseId: "junk-observed-constraint-cardless-action-roguelite-rejects-ball-pit",
    group: "junk-suppression",
    preferences: "카드 말고 액션 로그라이트, filler도 말고",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "ball-pit-observed-cardless-bad",
              title: "BALL x PIT",
              priceAmount: 13_200,
              regularAmount: 16_500,
              cut: 20,
              genres: ["Indie", "Action", "Roguelike"],
              multiplayer: false,
              rating: 4.35,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "arcade-run-zero-observed-cardless-good",
              title: "Arcade Run Zero",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Arcade", "Roguelike"],
              tags: ["action", "combat", "roguelike", "real-time"],
              multiplayer: false,
              rating: 4.28,
              metacritic: 82,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectedTopTitle: "Arcade Run Zero",
      forbiddenTopTitles: ["BALL x PIT"],
      requiredTopSignals: ["action", "roguelike"]
    }
  },
  {
    index: 94,
    caseId: "junk-observed-constraint-strategy-not-grand-strategy-rejects-dominions",
    group: "junk-suppression",
    preferences: "전략은 좋은데 grand strategy 말고 할인 중인 것",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "dominions-strategy-not-grand-bad",
              title: "Dominions 5 - Warriors of the Faith",
              priceAmount: 9_450,
              regularAmount: 43_000,
              cut: 78,
              genres: ["Strategy", "Indie"],
              tags: ["grand strategy", "wargame", "simulation", "reading-heavy"],
              multiplayer: true,
              rating: 4.67,
              metacritic: 82,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "reviewed-tactics-reserve-observed",
              title: "Reviewed Tactics Reserve",
              priceAmount: 17_500,
              regularAmount: 35_000,
              cut: 50,
              genres: ["Strategy", "Tactics"],
              tags: ["tactics", "turn-based"],
              multiplayer: false,
              rating: 4.35,
              metacritic: 84,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectedTopTitle: "Reviewed Tactics Reserve",
      forbiddenTopTitles: ["Dominions 5 - Warriors of the Faith"],
      requiredTopSignals: ["strategy", "tactics"]
    }
  },
  {
    index: 95,
    caseId: "junk-observed-constraint-turn-based-not-deck-roguelike-rejects-ball-pit",
    group: "junk-suppression",
    preferences: "turn-based 말고 deck 아닌 로그라이크",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "ball-pit-turnbased-deck-bad",
              title: "BALL x PIT",
              priceAmount: 13_200,
              regularAmount: 16_500,
              cut: 20,
              genres: ["Indie", "Action", "Roguelike"],
              multiplayer: false,
              rating: 4.35,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "arcade-run-zero-turnbased-deck-good",
              title: "Arcade Run Zero",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Arcade", "Roguelike"],
              tags: ["action", "combat", "roguelike", "real-time"],
              multiplayer: false,
              rating: 4.28,
              metacritic: 82,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectedTopTitle: "Arcade Run Zero",
      forbiddenTopTitles: ["BALL x PIT"],
      requiredTopSignals: ["action", "roguelike"]
    }
  },
  {
    index: 96,
    caseId: "junk-observed-hybrid-strategy-roguelike-rejects-shogun-showdown",
    group: "junk-suppression",
    preferences: "전략이랑 로그라이크가 같이 있는 세일작",
    budget: 22_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "shogun-showdown-observed-bad",
              title: "Shogun Showdown",
              priceAmount: 11_263,
              regularAmount: 22_526,
              cut: 50,
              genres: ["Strategy", "Indie", "RPG", "Roguelike", "Deckbuilder", "Card"],
              multiplayer: false,
              rating: 4.36,
              metacritic: 84,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "rogue-tactics-reserve-observed-good",
              title: "Rogue Tactics Reserve",
              priceAmount: 15_900,
              regularAmount: 31_800,
              cut: 50,
              genres: ["Strategy", "Tactics", "Roguelike", "Action"],
              tags: ["strategy", "tactics", "roguelike", "action"],
              multiplayer: false,
              rating: 4.42,
              metacritic: 86,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectedTopTitle: "Rogue Tactics Reserve",
      forbiddenTopTitles: ["Shogun Showdown"],
      requiredTopSignals: ["strategy", "roguelike"]
    }
  },
  {
    index: 97,
    caseId: "junk-observed-constraint-roguelike-not-turn-based-rejects-ball-pit",
    group: "junk-suppression",
    preferences: "턴제는 아닌데 로그라이크 느낌은 나는 세일작",
    budget: 20_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "ball-pit-observed-not-turnbased-bad",
              title: "BALL x PIT",
              priceAmount: 13_200,
              regularAmount: 16_500,
              cut: 20,
              genres: ["Indie", "Action", "Roguelike"],
              multiplayer: false,
              rating: 4.35,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "arcade-run-zero-observed-not-turnbased-good",
              title: "Arcade Run Zero",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Arcade", "Roguelike"],
              tags: ["action", "combat", "roguelike", "real-time"],
              multiplayer: false,
              rating: 4.28,
              metacritic: 82,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectedTopTitle: "Arcade Run Zero",
      forbiddenTopTitles: ["BALL x PIT"],
      requiredTopSignals: ["action", "roguelike"]
    }
  },
  {
    index: 98,
    caseId: "junk-observed-hybrid-action-buildcraft-rejects-rounds",
    group: "junk-suppression",
    preferences: "arcade action plus buildcraft hybrid deal",
    budget: 22_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "rounds-buildcraft-bad",
              title: "ROUNDS",
              priceAmount: 3_200,
              regularAmount: 6_400,
              cut: 50,
              genres: ["Indie", "Action", "Deckbuilder", "Card", "Roguelike"],
              multiplayer: true,
              rating: 3.72,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "rogue-deck-assault-observed-buildcraft-good",
              title: "Rogue Deck Assault",
              priceAmount: 13_500,
              regularAmount: 27_000,
              cut: 50,
              genres: ["Action", "Card", "Deckbuilder", "Roguelike"],
              tags: ["action", "card", "deckbuilder", "roguelike"],
              multiplayer: false,
              rating: 4.18,
              metacritic: 81,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectedTopTitle: "Rogue Deck Assault",
      forbiddenTopTitles: ["ROUNDS"],
      requiredTopSignals: ["action", "card", "deckbuilder"]
    }
  },
  {
    index: 99,
    caseId: "junk-observed-hybrid-systems-heavy-not-oppressive-rejects-dominions",
    group: "junk-suppression",
    preferences: "systems-heavy but not oppressive hybrid bargain",
    budget: 22_000,
    platforms: ["PC"],
    country: "KR",
    providers: {
      findDeals: [
        {
          result: [
            buildDeal({
              id: "dominions-systems-hybrid-observed-bad",
              title: "Dominions 5 - Warriors of the Faith",
              priceAmount: 9_450,
              regularAmount: 43_000,
              cut: 78,
              genres: ["Strategy", "Indie"],
              tags: ["grand strategy", "wargame", "simulation", "reading-heavy"],
              multiplayer: true,
              rating: 4.67,
              metacritic: 82,
              metadataStatus: "rawg"
            }),
            buildDeal({
              id: "systems-tactics-bargain-good",
              title: "Systems Tactics Bargain",
              priceAmount: 16_200,
              regularAmount: 32_400,
              cut: 50,
              genres: ["Strategy", "Tactics"],
              tags: ["strategy", "tactics", "systems", "approachable"],
              multiplayer: false,
              rating: 4.12,
              metacritic: 79,
              metadataStatus: "rawg"
            })
          ]
        }
      ]
    },
    expectation: {
      expectedTopTitle: "Systems Tactics Bargain",
      forbiddenTopTitles: ["Dominions 5 - Warriors of the Faith"],
      requiredTopSignals: ["strategy", "tactics"]
    }
  }
];

export async function runDeterministicRecommendationAudit(
  cases: DeterministicRecommendationAuditCase[] = DETERMINISTIC_RECOMMENDATION_AUDIT_CASES,
  options: DeterministicRecommendationAuditRunOptions = {}
): Promise<DeterministicRecommendationAuditRun> {
  const concurrency = normalizePositiveInt(
    options.concurrency,
    DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_CONCURRENCY
  );
  const timeoutMs = normalizePositiveInt(
    options.timeoutMs,
    DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_TIMEOUT_MS
  );
  const results = new Array<DeterministicRecommendationAuditResult>(cases.length);
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

        results[current] = await runDeterministicRecommendationAuditCase(
          cases[current]!,
          timeoutMs
        );
      }
    }
  );

  await Promise.all(workers);

  const summary = summarizeDeterministicRecommendationAuditResults(results);

  return {
    generatedAt: (options.now ?? new Date()).toISOString(),
    summary: summary.summary,
    groups: summary.groups,
    results
  };
}

export function summarizeDeterministicRecommendationAuditResults(
  results: DeterministicRecommendationAuditResult[]
): {
  summary: DeterministicRecommendationAuditSummary;
  groups: Record<
    DeterministicRecommendationAuditGroup,
    DeterministicRecommendationAuditGroupSummary
  >;
} {
  const topCounts = countTopTitles(results);
  const groups = Object.fromEntries(
    DETERMINISTIC_RECOMMENDATION_AUDIT_GROUPS.map((group) => {
      const groupResults = results.filter((result) => result.group === group);
      const groupTopCounts = countTopTitles(groupResults);

      return [
        group,
        {
          uniqueTopPicks: groupTopCounts.length,
          topCounts: groupTopCounts,
          flagged: groupResults.filter((result) => result.flagged).length,
          timeouts: groupResults.filter((result) => result.timeout).length
        } satisfies DeterministicRecommendationAuditGroupSummary
      ];
    })
  ) as Record<
    DeterministicRecommendationAuditGroup,
    DeterministicRecommendationAuditGroupSummary
  >;

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

async function runDeterministicRecommendationAuditCase(
  testCase: DeterministicRecommendationAuditCase,
  timeoutMs: number
): Promise<DeterministicRecommendationAuditResult> {
  try {
    const service = new GameDealService(
      createFixtureProviders(testCase.providers),
      testCase.providers.serviceOptions
    );
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
    const emptyReason =
      typeof response.emptyReason === "string" && response.emptyReason.length > 0
        ? response.emptyReason
        : undefined;
    const evaluation = evaluateDeterministicExpectation(
      testCase.expectation,
      matches.length,
      topMatch,
      response.warnings ?? [],
      emptyReason
    );

    return {
      index: testCase.index,
      caseId: testCase.caseId,
      group: testCase.group,
      preferences: testCase.preferences,
      ...(typeof testCase.budget === "number" ? { budget: testCase.budget } : {}),
      ...(testCase.platforms ? { platforms: testCase.platforms } : {}),
      country: testCase.country,
      summary: response.summary,
      warnings: response.warnings ?? [],
      matchCount: matches.length,
      topTitle: topMatch?.title ?? null,
      topMatch,
      emptyReason,
      flagged: evaluation.flagged,
      timeout: false,
      ...(evaluation.failures.length > 0 ? { error: evaluation.failures.join("; ") } : {})
    };
  } catch (error) {
    return {
      index: testCase.index,
      caseId: testCase.caseId,
      group: testCase.group,
      preferences: testCase.preferences,
      ...(typeof testCase.budget === "number" ? { budget: testCase.budget } : {}),
      ...(testCase.platforms ? { platforms: testCase.platforms } : {}),
      country: testCase.country,
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

function createFixtureProviders(
  fixtures: DeterministicRecommendationProviderFixtures
): ConstructorParameters<typeof GameDealService>[0] {
  return {
    async findDeals(args) {
      const fixture = findMatchingFixture(fixtures.findDeals, (candidate) =>
        matchesFindDealsFixture(candidate, args)
      );
      if (!fixture) {
        return [];
      }
      if (fixture.error) {
        throw new Error(fixture.error);
      }
      return cloneValue(fixture.result ?? []);
    },
    async enrichDeals(deals) {
      const fixture = findMatchingFixture(fixtures.enrichDeals ?? [], (candidate) =>
        matchesEnrichDealsFixture(candidate, deals)
      );
      if (!fixture) {
        return cloneValue(deals);
      }
      if (fixture.error) {
        throw new Error(fixture.error);
      }
      return cloneValue(fixture.result ?? deals);
    },
    async discoverTitles(input) {
      const fixture = findMatchingFixture(fixtures.discoverTitles ?? [], (candidate) =>
        matchesDiscoverTitlesFixture(candidate, input)
      );
      if (!fixture) {
        return [];
      }
      if (fixture.error) {
        throw new Error(fixture.error);
      }
      return cloneValue(fixture.result ?? []);
    },
    async resolveDeal(title, country, options) {
      const fixture = findMatchingFixture(fixtures.resolveDeal ?? [], (candidate) =>
        matchesResolveDealFixture(candidate, title, country, options)
      );
      if (!fixture) {
        return {
          kind: "not-found",
          title
        } satisfies DealResolution;
      }
      if (fixture.error) {
        throw new Error(fixture.error);
      }
      return cloneValue(
        fixture.result ?? {
          kind: "not-found",
          title
        }
      );
    }
  };
}

function evaluateDeterministicExpectation(
  expectation: DeterministicRecommendationExpectation,
  matchCount: number,
  topMatch: DeterministicRecommendationAuditTopMatch | null,
  warnings: string[],
  emptyReason?: string
): { flagged: boolean; failures: string[] } {
  const failures: string[] = [];
  const topTitle = topMatch?.title ?? null;
  const topGenres = new Set((topMatch?.genres ?? []).map(normalizeText));
  const topSignals = topMatch ? buildTopSignalBlob(topMatch) : "";

  if (matchCount > 0 && topMatch) {
    if (topMatch.priceEvidenceSource !== "ITAD") {
      failures.push("accepted top match is missing ITAD price evidence");
    }

    if (!topMatch.platformEvidenceSource) {
      failures.push("accepted top match is missing platform evidence");
    }

    if (!topMatch.evidenceCompleteness) {
      failures.push("accepted top match is missing evidence completeness");
    }

    if ((topMatch.matchedSignals?.length ?? 0) === 0) {
      failures.push("accepted top match is missing matched signals");
    }

    if (typeof topMatch.recommendationReason !== "string" || topMatch.recommendationReason.length === 0) {
      failures.push("accepted top match is missing recommendation reason");
    }
  }

  if (
    typeof expectation.expectMatchCount === "number" &&
    matchCount !== expectation.expectMatchCount
  ) {
    failures.push(
      `expected matchCount=${expectation.expectMatchCount}, received ${matchCount}`
    );
  }

  if (
    typeof expectation.maxMatchCount === "number" &&
    matchCount > expectation.maxMatchCount
  ) {
    failures.push(`expected matchCount<=${expectation.maxMatchCount}, received ${matchCount}`);
  }

  if (
    typeof expectation.expectedTopTitle === "string" &&
    topTitle !== expectation.expectedTopTitle
  ) {
    failures.push(
      `expected topTitle=${expectation.expectedTopTitle}, received ${topTitle ?? "null"}`
    );
  }

  if (
    typeof expectation.expectedEmptyReason === "string" &&
    emptyReason !== expectation.expectedEmptyReason
  ) {
    failures.push(
      `expected emptyReason=${expectation.expectedEmptyReason}, received ${emptyReason ?? "null"}`
    );
  }

  for (const expectedGenre of expectation.expectedTopGenres ?? []) {
    if (!topGenres.has(normalizeText(expectedGenre))) {
      failures.push(`missing top genre: ${expectedGenre}`);
    }
  }

  for (const forbidden of expectation.forbiddenTopTitles ?? []) {
    if (topTitle === forbidden) {
      failures.push(`forbidden top title selected: ${forbidden}`);
    }
  }

  for (const forbiddenEmptyReason of expectation.forbiddenEmptyReasons ?? []) {
    if (emptyReason === forbiddenEmptyReason) {
      failures.push(`unexpected empty reason: ${forbiddenEmptyReason}`);
    }
  }

  for (const requiredWarning of expectation.requiredWarnings ?? []) {
    if (!warnings.some((warning) => warning.includes(requiredWarning))) {
      failures.push(`missing warning: ${requiredWarning}`);
    }
  }

  for (const forbiddenWarning of expectation.forbiddenWarnings ?? []) {
    if (warnings.some((warning) => warning.includes(forbiddenWarning))) {
      failures.push(`unexpected warning: ${forbiddenWarning}`);
    }
  }

  for (const requiredSignal of expectation.requiredTopSignals ?? []) {
    if (!topSignals.includes(normalizeSignal(requiredSignal))) {
      failures.push(`missing top signal: ${requiredSignal}`);
    }
  }

  for (const forbiddenSignal of expectation.forbiddenTopSignals ?? []) {
    if (topSignals.includes(normalizeSignal(forbiddenSignal))) {
      failures.push(`unexpected top signal: ${forbiddenSignal}`);
    }
  }

  return {
    flagged: failures.length > 0,
    failures
  };
}

function matchesFindDealsFixture(
  fixture: DeterministicFindDealsFixture,
  args: DiscoverFilters & { country: string }
): boolean {
  if (!fixture.match) {
    return true;
  }

  return (
    matchesOptionalStringArray(args.genres, fixture.match.genres) &&
    matchesOptionalStringArray(args.platforms, fixture.match.platforms) &&
    matchesOptionalNumberArray(args.preferredShops, fixture.match.preferredShops) &&
    matchesOptionalScalar(args.multiplayer, fixture.match.multiplayer) &&
    matchesOptionalScalar(args.sort, fixture.match.sort) &&
    matchesOptionalScalar(args.budget, fixture.match.budget) &&
    matchesOptionalScalar(args.country, fixture.match.country)
  );
}

function matchesEnrichDealsFixture(
  fixture: DeterministicEnrichDealsFixture,
  deals: DealCandidate[]
): boolean {
  if (!fixture.matchTitles) {
    return true;
  }

  const titles = deals.map((deal) => normalizeText(deal.title));
  return fixture.matchTitles.every((title) => titles.includes(normalizeText(title)));
}

function matchesDiscoverTitlesFixture(
  fixture: DeterministicDiscoverTitlesFixture,
  input: { tags?: string[] | undefined; genres?: string[] | undefined; limit?: number | undefined }
): boolean {
  if (!fixture.match) {
    return true;
  }

  return (
    matchesOptionalStringArray(input.tags, fixture.match.tags) &&
    matchesOptionalStringArray(input.genres, fixture.match.genres) &&
    matchesOptionalScalar(input.limit, fixture.match.limit)
  );
}

function matchesResolveDealFixture(
  fixture: DeterministicResolveDealFixture,
  title: string,
  country: string,
  options?: ResolveDealOptions
): boolean {
  if (!fixture.match) {
    return true;
  }

  return (
    matchesOptionalScalar(normalizeText(title), fixture.match.title && normalizeText(fixture.match.title)) &&
    matchesOptionalScalar(country, fixture.match.country) &&
    matchesOptionalNumberArray(options?.preferredShops, fixture.match.preferredShops) &&
    matchesOptionalScalar(options?.dealsOnly, fixture.match.dealsOnly)
  );
}

function toAuditTopMatch(value: unknown): DeterministicRecommendationAuditTopMatch | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const deal = value as Partial<RecommendationMatch>;
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
    tags: Array.isArray(deal.tags) ? deal.tags : undefined,
    steamDeckStatus: deal.steamDeckCompatibility?.status ?? null,
    matchedSignals: Array.isArray(deal.matchedSignals) ? deal.matchedSignals : undefined,
    missingEvidence: Array.isArray(deal.missingEvidence) ? deal.missingEvidence : undefined,
    recommendationReason:
      typeof deal.recommendationReason === "string" ? deal.recommendationReason : undefined,
    evidenceCompleteness:
      typeof deal.evidenceCompleteness === "string" ? deal.evidenceCompleteness : undefined,
    priceEvidenceSource:
      typeof deal.evidence?.priceEvidence?.source === "string"
        ? deal.evidence.priceEvidence.source
        : undefined,
    platformEvidenceSource:
      typeof deal.evidence?.platformEvidence?.source === "string"
        ? deal.evidence.platformEvidence.source
        : undefined,
    metadataEvidenceSource:
      typeof deal.evidence?.metadataEvidence?.source === "string"
        ? deal.evidence.metadataEvidence.source
        : undefined
  };
}

function countTopTitles(
  results: DeterministicRecommendationAuditResult[]
): DeterministicRecommendationAuditTopCount[] {
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

function findMatchingFixture<T>(fixtures: T[], predicate: (fixture: T) => boolean): T | undefined {
  return fixtures.find(predicate);
}

function matchesOptionalScalar<T>(actual: T | undefined, expected: T | undefined): boolean {
  if (typeof expected === "undefined") {
    return true;
  }
  return actual === expected;
}

function matchesOptionalStringArray(
  actual: string[] | undefined,
  expected: string[] | undefined
): boolean {
  if (!expected || expected.length === 0) {
    return true;
  }
  const normalizedActual = (actual ?? []).map(normalizeText);
  return expected.every((value) => normalizedActual.includes(normalizeText(value)));
}

function matchesOptionalNumberArray(
  actual: number[] | undefined,
  expected: number[] | undefined
): boolean {
  if (!expected || expected.length === 0) {
    return true;
  }
  return expected.every((value) => (actual ?? []).includes(value));
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSignal(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTopSignalBlob(match: DeterministicRecommendationAuditTopMatch): string {
  const parts = [
    match.title,
    ...(match.genres ?? []),
    ...(match.tags ?? []),
    ...(match.platforms ?? []),
    ...(match.matchedSignals ?? []),
    ...(match.missingEvidence ?? []),
    match.evidenceCompleteness ?? "",
    match.priceEvidenceSource ?? "",
    match.platformEvidenceSource ?? "",
    match.metadataEvidenceSource ?? "",
    match.steamDeckStatus ?? "",
    match.multiplayer === true ? "multiplayer" : ""
  ];

  return normalizeSignal(parts.filter(Boolean).join(" "));
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function buildDeal(input: {
  id: string;
  title: string;
  priceAmount: number;
  regularAmount: number;
  cut: number;
  genres: string[];
  platforms?: string[] | undefined;
  tags?: string[] | undefined;
  multiplayer: boolean;
  rating?: number | undefined;
  metacritic?: number | undefined;
  metadataStatus?: DealCandidate["metadataStatus"] | undefined;
  steamDeckStatus?: SteamDeckCompatibility["status"] | undefined;
}): DealCandidate & { tags?: string[] } {
  return {
    id: input.id,
    title: input.title,
    price: { amount: input.priceAmount, currency: "KRW" },
    regular: { amount: input.regularAmount, currency: "KRW" },
    cut: input.cut,
    genres: input.genres,
    platforms: input.platforms ?? ["PC"],
    ...(input.tags ? { tags: input.tags } : {}),
    multiplayer: input.multiplayer,
    ...(typeof input.rating === "number" ? { rating: input.rating } : {}),
    ...(typeof input.metacritic === "number" ? { metacritic: input.metacritic } : {}),
    metadataStatus: input.metadataStatus ?? "rawg",
    ...(input.steamDeckStatus
      ? {
          steamDeckCompatibility: {
            status: input.steamDeckStatus,
            details: [],
            source: "steam"
          } satisfies SteamDeckCompatibility
        }
      : {})
  };
}

function buildCatalogCandidate(input: {
  title: string;
  genres: string[];
  tags?: string[] | undefined;
  rating?: number | undefined;
  metacritic?: number | undefined;
  multiplayer?: boolean | undefined;
}): CatalogCandidate {
  return {
    title: input.title,
    genres: input.genres,
    platforms: ["PC"],
    ...(input.tags ? { tags: input.tags } : {}),
    ...(typeof input.rating === "number" ? { rating: input.rating } : {}),
    ...(typeof input.metacritic === "number" ? { metacritic: input.metacritic } : {}),
    multiplayer: input.multiplayer ?? false
  };
}
