import { GameDealService, type CatalogCandidate, type CompareResult } from "../domain/service.js";
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
  expectedTopGenres?: string[] | undefined;
  forbiddenTopTitles?: string[] | undefined;
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
      expectMatchCount: 2,
      expectedTopTitle: "Party Brawler Heroes"
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
      expectMatchCount: 2,
      expectedTopTitle: "Tactics Breakthrough"
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
      expectMatchCount: 2,
      expectedTopTitle: "Aces of Ruin Deluxe"
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
      expectMatchCount: 1,
      expectedTopTitle: "Portable Rogue Tactics Deluxe"
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
      expectMatchCount: 2,
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
      expectMatchCount: 2,
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
      expectMatchCount: 1,
      expectedTopTitle: "Portable Unknown Tactics",
      expectedTopGenres: ["Strategy", "Tactics"],
      requiredTopSignals: ["unknown", "strategy", "tactics"],
      forbiddenTopSignals: ["unsupported"]
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
    const evaluation = evaluateDeterministicExpectation(
      testCase.expectation,
      matches.length,
      topMatch,
      response.warnings ?? []
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
  warnings: string[]
): { flagged: boolean; failures: string[] } {
  const failures: string[] = [];
  const topTitle = topMatch?.title ?? null;
  const topGenres = new Set((topMatch?.genres ?? []).map(normalizeText));
  const topSignals = topMatch ? buildTopSignalBlob(topMatch) : "";

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

  const deal = value as Partial<DealCandidate & { tags?: string[] }>;
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
    steamDeckStatus: deal.steamDeckCompatibility?.status ?? null
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
