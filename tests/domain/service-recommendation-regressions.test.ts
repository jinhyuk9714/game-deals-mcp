import { describe, expect, it } from "vitest";

import { GameDealService } from "../../src/domain/service.js";

describe("GameDealService recommendation regressions", () => {
  it("reranks broad co-op prompts away from racing outliers when a reviewed party brawler exists", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "trailblazers",
            title: "Trailblazers",
            price: { amount: 1764, currency: "KRW" },
            regular: { amount: 44400, currency: "KRW" },
            cut: 96,
            genres: ["Racing", "Action", "Casual", "Sports", "Indie"],
            platforms: ["PC"],
            multiplayer: true,
            rating: 3.17,
            metacritic: null,
            metadataStatus: "rawg"
          },
          {
            id: "party-brawler",
            title: "Party Brawler Heroes",
            price: { amount: 9900, currency: "KRW" },
            regular: { amount: 22000, currency: "KRW" },
            cut: 55,
            genres: ["Action", "Casual", "Party", "Indie"],
            platforms: ["PC"],
            multiplayer: true,
            rating: 4.05,
            metacritic: 78,
            metadataStatus: "unavailable"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal() {
        return { kind: "not-found" as const, title: "" };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "친구들이랑 웃기게 떠들면서 할 협동 할인 게임",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Party Brawler Heroes" });
  });

  it("prefers explicit teamplay co-op deals over party-only fallbacks for generic co-op prompts", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "orbital-teamplay-local",
            title: "Orbital Teamplay Co-op",
            price: { amount: 13_500, currency: "KRW" },
            regular: { amount: 27_000, currency: "KRW" },
            cut: 50,
            genres: ["Action", "Casual", "Co-op"],
            platforms: ["PC"],
            tags: ["teamplay", "co-op", "multiplayer"],
            multiplayer: true,
            rating: 4.12,
            metadataStatus: "rawg"
          },
          {
            id: "party-brawler-local",
            title: "Party Brawler Heroes",
            price: { amount: 9_900, currency: "KRW" },
            regular: { amount: 22_000, currency: "KRW" },
            cut: 55,
            genres: ["Action", "Casual", "Party"],
            platforms: ["PC"],
            tags: ["party", "multiplayer"],
            multiplayer: true,
            rating: 4.1,
            metadataStatus: "rawg"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "co-op game for friends",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Orbital Teamplay Co-op" });
  });

  it("reranks tactics-focused strategy prompts toward tactics-backed reviewed titles", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "obscure-strategy",
            title: "Dominions 5 - Warriors of the Faith",
            price: { amount: 9450, currency: "KRW" },
            regular: { amount: 43000, currency: "KRW" },
            cut: 78,
            genres: ["Strategy", "Indie"],
            platforms: ["PC"],
            multiplayer: true,
            rating: 4.67,
            metacritic: null,
            metadataStatus: "rawg"
          },
          {
            id: "tactics-pick",
            title: "Tactics Breakthrough",
            price: { amount: 14500, currency: "KRW" },
            regular: { amount: 22300, currency: "KRW" },
            cut: 35,
            genres: ["Strategy", "Tactics", "Indie"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.6,
            metacritic: 74,
            metadataStatus: "rawg"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal() {
        return { kind: "not-found" as const, title: "" };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "highly rated turn-based tactics",
      budget: 25000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Tactics Breakthrough" });
  });

  it("reranks fast-tempo roguelike prompts toward action roguelites over card roguelikes", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "card-roguelike",
            title: "Inscryption",
            price: { amount: 10285, currency: "KRW" },
            regular: { amount: 28571, currency: "KRW" },
            cut: 64,
            genres: ["Indie", "Strategy", "Adventure", "Roguelike", "Deckbuilder", "Card"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.38,
            metacritic: 86,
            metadataStatus: "rawg"
          },
          {
            id: "action-roguelite",
            title: "BALL x PIT",
            price: { amount: 11250, currency: "KRW" },
            regular: { amount: 22500, currency: "KRW" },
            cut: 50,
            genres: ["Indie", "Action", "Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.1,
            metacritic: null,
            metadataStatus: "rawg"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal() {
        return { kind: "not-found" as const, title: "" };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "빠른 템포 로그라이트",
      budget: 18000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "BALL x PIT" });
  });

  it("breaks Steam Deck ties toward supported titles over unknown ones", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "deck-playable",
            title: "Deck Ready Tactics",
            price: { amount: 12000, currency: "KRW" },
            regular: { amount: 24000, currency: "KRW" },
            cut: 50,
            genres: ["Strategy", "Indie"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.2,
            metacritic: 82,
            metadataStatus: "rawg",
            steamDeckCompatibility: {
              status: "playable",
              details: ["Runs on Steam Deck"],
              source: "steam"
            }
          },
          {
            id: "deck-unknown",
            title: "Unknown Deck Strategy",
            price: { amount: 9000, currency: "KRW" },
            regular: { amount: 18000, currency: "KRW" },
            cut: 50,
            genres: ["Strategy", "Indie"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.35,
            metacritic: 84,
            metadataStatus: "rawg",
            steamDeckCompatibility: {
              status: "unknown",
              details: [],
              source: "steam"
            }
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal() {
        return { kind: "not-found" as const, title: "" };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 할 전략 게임",
      budget: 20000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Deck Ready Tactics" });
  });

  it("caps Steam Deck overlay fan-out at three resolve calls", async () => {
    let resolveCount = 0;

    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "deck-unknown",
            title: "Unknown Deck Strategy",
            price: { amount: 9000, currency: "KRW" },
            regular: { amount: 18000, currency: "KRW" },
            cut: 50,
            genres: ["Strategy", "Indie"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.35,
            metacritic: 84,
            metadataStatus: "rawg",
            steamDeckCompatibility: {
              status: "unknown",
              details: [],
              source: "steam"
            }
          },
          {
            id: "deck-unknown-2",
            title: "Unknown Deck Strategy Two",
            price: { amount: 9500, currency: "KRW" },
            regular: { amount: 19000, currency: "KRW" },
            cut: 50,
            genres: ["Strategy", "Indie"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.25,
            metacritic: 81,
            metadataStatus: "rawg",
            steamDeckCompatibility: {
              status: "unknown",
              details: [],
              source: "steam"
            }
          },
          {
            id: "deck-unknown-3",
            title: "Unknown Deck Strategy Three",
            price: { amount: 9800, currency: "KRW" },
            regular: { amount: 19600, currency: "KRW" },
            cut: 50,
            genres: ["Strategy", "Indie"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.2,
            metacritic: 80,
            metadataStatus: "rawg",
            steamDeckCompatibility: {
              status: "unknown",
              details: [],
              source: "steam"
            }
          },
          {
            id: "deck-unknown-4",
            title: "Unknown Deck Strategy Four",
            price: { amount: 10100, currency: "KRW" },
            regular: { amount: 20200, currency: "KRW" },
            cut: 50,
            genres: ["Strategy", "Indie"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.18,
            metacritic: 79,
            metadataStatus: "rawg",
            steamDeckCompatibility: {
              status: "unknown",
              details: [],
              source: "steam"
            }
          },
          {
            id: "deck-unknown-5",
            title: "Unknown Deck Strategy Five",
            price: { amount: 10500, currency: "KRW" },
            regular: { amount: 21000, currency: "KRW" },
            cut: 50,
            genres: ["Strategy", "Indie"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.15,
            metacritic: 78,
            metadataStatus: "rawg",
            steamDeckCompatibility: {
              status: "unknown",
              details: [],
              source: "steam"
            }
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal(title) {
        resolveCount += 1;

        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: title,
              title,
              price: { amount: 12000, currency: "KRW" },
              regular: { amount: 24000, currency: "KRW" },
              cut: 50,
              genres: ["Strategy", "Indie"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.2,
              metacritic: 82,
              metadataStatus: "rawg",
              steamDeckCompatibility: {
                status: "playable",
                details: ["Runs on Steam Deck"],
                source: "steam"
              }
            }
          ]
        };
      },
      async discoverTitles() {
        return Array.from({ length: 6 }, (_, index) => ({
          title: `Deck Candidate ${index + 1}`,
          released: "2024-01-01",
          genres: ["Strategy"],
          platforms: ["PC"],
          tags: ["Roguelike"],
          rating: 4.2,
          metacritic: 82,
          multiplayer: false
        }));
      }
    });

    await service.recommendSaleGames({
      preferences: "스팀덱에서 할 전략 게임",
      budget: 20000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(resolveCount).toBe(3);
  });

  it("uses a smaller Steam Deck enrichment budget during recommend fallback browse", async () => {
    const enrichOptions: Array<{
      includeSteamDeckCompatibility?: boolean;
      maxRawgLookups?: number;
      maxSteamLookups?: number;
    }> = [];

    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "deck-action",
            title: "Deck Action",
            price: { amount: 10000, currency: "KRW" },
            regular: { amount: 20000, currency: "KRW" },
            cut: 50,
            genres: ["Action"],
            platforms: ["PC"],
            multiplayer: false
          }
        ];
      },
      async enrichDeals(deals, options) {
        enrichOptions.push(options ?? {});
        return deals;
      }
    });

    await service.recommendSaleGames({
      preferences: "스팀덱에서 하기 좋은 액션 게임",
      budget: 20000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(enrichOptions[0]).toMatchObject({
      includeSteamDeckCompatibility: true,
      maxRawgLookups: 12,
      maxSteamLookups: 4
    });
  });

  it("skips Steam Deck roguelike recovery after browse when recommendation budget is low", async () => {
    const budgetWarning = "응답 시간을 맞추기 위해 일부 추천 후보 보강을 생략했습니다.";
    let currentTime = 0;
    let discoverTitlesCalls = 0;
    let resolveCalls = 0;

    const service = new GameDealService(
      {
        async findDeals() {
          currentTime += 3_000;
          return [];
        },
        async enrichDeals(deals) {
          currentTime += 100;
          return deals;
        },
        async discoverTitles() {
          discoverTitlesCalls += 1;
          return [
            {
              title: "Should Not Start",
              released: "2024-01-01",
              genres: ["Roguelike"],
              platforms: ["PC"],
              tags: ["Roguelike"],
              rating: 4.2,
              metacritic: 80,
              multiplayer: false
            }
          ];
        },
        async resolveDeal(title) {
          resolveCalls += 1;
          return { kind: "not-found" as const, title };
        }
      },
      {
        recommendationTimeBudgetMs: 4_000,
        now: () => currentTime
      }
    );

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 하기 좋은 로그라이크",
      budget: 20_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(discoverTitlesCalls).toBe(0);
    expect(resolveCalls).toBe(0);
    expect(result.matches).toEqual([]);
    expect(result.warnings.filter((warning) => warning === budgetWarning)).toHaveLength(1);
  });

  it("runs a minimal Steam Deck sparse recovery when only a small recovery budget remains", async () => {
    let currentTime = 0;
    let discoverTitlesCalls = 0;
    let resolveCalls = 0;

    const service = new GameDealService(
      {
        async findDeals() {
          currentTime += 3_000;
          return [];
        },
        async enrichDeals(deals) {
          currentTime += 100;
          return deals;
        },
        async discoverTitles() {
          discoverTitlesCalls += 1;
          currentTime += 100;
          return [
            {
              title: "Deck Rescue",
              released: "2024-01-01",
              genres: ["Action", "Roguelike"],
              platforms: ["PC"],
              tags: ["Roguelike"],
              rating: 4.2,
              metacritic: 80,
              multiplayer: false
            }
          ];
        },
        async resolveDeal(title) {
          resolveCalls += 1;
          currentTime += 300;
          return {
            kind: "match" as const,
            title,
            matches: [
              {
                id: "deck-rescue",
                title: "Deck Rescue",
                price: { amount: 9900, currency: "KRW" },
                regular: { amount: 19800, currency: "KRW" },
                cut: 50,
                genres: ["Action", "Roguelike"],
                platforms: ["PC"],
                multiplayer: false,
                rating: 4.2,
                metacritic: 80,
                metadataStatus: "rawg",
                steamDeckCompatibility: {
                  status: "playable",
                  details: [],
                  source: "steam"
                }
              }
            ]
          };
        }
      },
      {
        recommendationTimeBudgetMs: 6_000,
        now: () => currentTime
      }
    );

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 하기 좋은 로그라이크",
      budget: 20_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(discoverTitlesCalls).toBe(1);
    expect(resolveCalls).toBe(1);
    expect(result.matches[0]).toMatchObject({ title: "Deck Rescue" });
  });

  it("returns base Steam Deck strategy browse results and skips mixing when little budget remains", async () => {
    const budgetWarning = "응답 시간을 맞추기 위해 일부 추천 후보 보강을 생략했습니다.";
    let currentTime = 0;
    let discoverTitlesCalls = 0;
    let resolveCalls = 0;

    const service = new GameDealService(
      {
        async findDeals() {
          currentTime += 10_500;
          return [
            {
              id: "deck-strategy",
              title: "Deck Strategy",
              price: { amount: 12000, currency: "KRW" },
              regular: { amount: 24000, currency: "KRW" },
              cut: 50,
              genres: ["Strategy"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.2,
              metacritic: 82,
              metadataStatus: "rawg",
              steamDeckCompatibility: {
                status: "unknown",
                details: [],
                source: "steam"
              }
            }
          ];
        },
        async enrichDeals(deals) {
          currentTime += 200;
          return deals;
        },
        async discoverTitles() {
          discoverTitlesCalls += 1;
          return [
            {
              title: "Should Not Mix",
              released: "2024-01-01",
              genres: ["Strategy"],
              platforms: ["PC"],
              tags: ["Tactics"],
              rating: 4.5,
              metacritic: 85,
              multiplayer: false
            }
          ];
        },
        async resolveDeal(title) {
          resolveCalls += 1;
          return { kind: "not-found" as const, title };
        }
      },
      {
        recommendationTimeBudgetMs: 12_000,
        now: () => currentTime
      }
    );

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 할 전략 게임",
      budget: 20_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Deck Strategy" });
    expect(discoverTitlesCalls).toBe(0);
    expect(resolveCalls).toBe(0);
    expect(result.warnings.filter((warning) => warning === budgetWarning)).toHaveLength(1);
  });

  it("skips a Steam Deck recovery loop entirely once the remaining budget is below the recovery threshold", async () => {
    const budgetWarning = "응답 시간을 맞추기 위해 일부 추천 후보 보강을 생략했습니다.";
    let currentTime = 0;
    let discoverTitlesCalls = 0;
    let resolveCalls = 0;

    const service = new GameDealService(
      {
        async findDeals(args) {
          currentTime += args.genres?.includes("Roguelike") ? 7_000 : 200;
          return [];
        },
        async enrichDeals(deals) {
          return deals;
        },
        async discoverTitles() {
          discoverTitlesCalls += 1;
          currentTime += 200;
          return Array.from({ length: 3 }, (_, index) => ({
            title: `Recovery Candidate ${index + 1}`,
            released: "2024-01-01",
            genres: ["Roguelike"],
            platforms: ["PC"],
            tags: ["Roguelike"],
            rating: 4.1,
            metacritic: 78,
            multiplayer: false
          }));
        },
        async resolveDeal(title) {
          resolveCalls += 1;
          currentTime += 1_100;
          return { kind: "not-found" as const, title };
        }
      },
      {
        recommendationTimeBudgetMs: 7_800,
        now: () => currentTime
      }
    );

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 하기 좋은 로그라이크",
      budget: 20_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(discoverTitlesCalls).toBe(0);
    expect(resolveCalls).toBe(0);
    expect(result.matches).toEqual([]);
    expect(result.warnings.filter((warning) => warning === budgetWarning)).toHaveLength(1);
  });

  it("applies the recommendation budget to non-Steam strategy prompts and skips later catalog mixing once base browse succeeds", async () => {
    const budgetWarning = "응답 시간을 맞추기 위해 일부 추천 후보 보강을 생략했습니다.";
    let currentTime = 0;
    let discoverTitlesCalls = 0;
    let resolveCalls = 0;

    const service = new GameDealService(
      {
        async findDeals() {
          currentTime += 2_200;
          return [
            {
              id: "browse-strategy",
              title: "Browse Strategy",
              price: { amount: 14900, currency: "KRW" },
              regular: { amount: 29800, currency: "KRW" },
              cut: 50,
              genres: ["Strategy", "Tactics"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.3,
              metacritic: 82,
              metadataStatus: "rawg"
            }
          ];
        },
        async enrichDeals(deals) {
          currentTime += 200;
          return deals;
        },
        async discoverTitles() {
          discoverTitlesCalls += 1;
          currentTime += 150;
          return [
            {
              title: "Catalog Strategy",
              released: "2024-01-01",
              genres: ["Strategy"],
              platforms: ["PC"],
              tags: ["Tactics"],
              rating: 4.4,
              metacritic: 84,
              multiplayer: false
            }
          ];
        },
        async resolveDeal(title) {
          resolveCalls += 1;
          currentTime += 7_300;

          return {
            kind: "not-found" as const,
            title
          };
        }
      },
      {
        recommendationTimeBudgetMs: 10_000,
        now: () => currentTime
      }
    );

    const result = await service.recommendSaleGames({
      preferences: "평가 좋은 전략 게임",
      budget: 25_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Browse Strategy" });
    expect(discoverTitlesCalls).toBe(1);
    expect(resolveCalls).toBe(1);
    expect(result.warnings.filter((warning) => warning === budgetWarning)).toHaveLength(1);
  });

  it("applies the recommendation budget to non-Steam multiplayer browse results and skips catalog mixing when little time remains", async () => {
    const budgetWarning = "응답 시간을 맞추기 위해 일부 추천 후보 보강을 생략했습니다.";
    let currentTime = 0;
    let discoverTitlesCalls = 0;
    let resolveCalls = 0;

    const service = new GameDealService(
      {
        async findDeals() {
          currentTime += 9_200;
          return [
            {
              id: "browse-party",
              title: "Browse Party Heroes",
              price: { amount: 12900, currency: "KRW" },
              regular: { amount: 25800, currency: "KRW" },
              cut: 50,
              genres: ["Action", "Casual", "Party"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.1,
              metacritic: 78,
              metadataStatus: "rawg"
            }
          ];
        },
        async enrichDeals(deals) {
          currentTime += 250;
          return deals;
        },
        async discoverTitles() {
          discoverTitlesCalls += 1;
          currentTime += 200;
          return [
            {
              title: "Should Not Mix",
              released: "2024-01-01",
              genres: ["Action", "Party"],
              platforms: ["PC"],
              tags: ["multiplayer"],
              rating: 4.2,
              metacritic: 80,
              multiplayer: true
            }
          ];
        },
        async resolveDeal(title) {
          resolveCalls += 1;
          currentTime += 300;
          return { kind: "not-found" as const, title };
        }
      },
      {
        recommendationTimeBudgetMs: 10_000,
        now: () => currentTime
      }
    );

    const result = await service.recommendSaleGames({
      preferences: "hangout game for friends, not PvP",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Browse Party Heroes" });
    expect(discoverTitlesCalls).toBe(0);
    expect(resolveCalls).toBe(0);
    expect(result.warnings.filter((warning) => warning === budgetWarning)).toHaveLength(1);
  });

  it("skips non-Steam last-chance sparse recovery when the remaining budget is below the new floor", async () => {
    const budgetWarning = "응답 시간을 맞추기 위해 일부 추천 후보 보강을 생략했습니다.";
    let currentTime = 0;
    let discoverTitlesCalls = 0;
    let resolveCalls = 0;

    const service = new GameDealService(
      {
        async findDeals() {
          currentTime += 8_000;
          return [];
        },
        async enrichDeals(deals) {
          return deals;
        },
        async discoverTitles() {
          discoverTitlesCalls += 1;
          currentTime += 200;
          return [
            {
              title: "Late Recovery Candidate",
              released: "2024-01-01",
              genres: ["Action", "Party"],
              platforms: ["PC"],
              tags: ["multiplayer"],
              rating: 4.2,
              metacritic: 80,
              multiplayer: true
            }
          ];
        },
        async resolveDeal(title) {
          resolveCalls += 1;
          currentTime += 300;
          return { kind: "not-found" as const, title };
        }
      },
      {
        recommendationTimeBudgetMs: 10_000,
        now: () => currentTime
      }
    );

    const result = await service.recommendSaleGames({
      preferences: "non-competitive multiplayer on sale",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches).toEqual([]);
    expect(discoverTitlesCalls).toBe(0);
    expect(resolveCalls).toBe(0);
    expect(result.warnings.filter((warning) => warning === budgetWarning)).toHaveLength(1);
  });

  it("keeps a best-effort Steam Deck roguelike when metadata instability wipes the strict result", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "deck-playable-rogue",
            title: "Deck Playable Rogue",
            price: { amount: 11800, currency: "KRW" },
            regular: { amount: 23600, currency: "KRW" },
            cut: 50,
            genres: ["Action", "Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.2,
            metacritic: 81,
            metadataStatus: "missing",
            steamDeckCompatibility: {
              status: "playable",
              details: ["Runs on Steam Deck"],
              source: "steam"
            }
          },
          {
            id: "deck-unsupported-rogue",
            title: "Deck Unsupported Rogue",
            price: { amount: 8400, currency: "KRW" },
            regular: { amount: 16800, currency: "KRW" },
            cut: 50,
            genres: ["Strategy", "Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.1,
            metacritic: 78,
            metadataStatus: "missing",
            steamDeckCompatibility: {
              status: "unsupported",
              details: ["Text too small on Steam Deck"],
              source: "steam"
            }
          }
        ];
      },
      async enrichDeals() {
        throw new Error("RAWG request failed with 502");
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 하기 좋은 로그라이크",
      budget: 20000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Deck Playable Rogue" });
    expect(result.matches.map((match) => (match as { title: string }).title)).not.toContain(
      "Deck Unsupported Rogue"
    );
    expect(result.warnings).toContain("메타데이터가 불안정해 완화된 추천 기준을 적용했습니다.");
  });

  it("does not relax strict recommendation gating when metadata warnings are absent", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "deck-playable-rogue",
            title: "Deck Playable Rogue",
            price: { amount: 11800, currency: "KRW" },
            regular: { amount: 23600, currency: "KRW" },
            cut: 50,
            genres: ["Action", "Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.2,
            metacritic: 81,
            metadataStatus: "missing",
            steamDeckCompatibility: {
              status: "playable",
              details: ["Runs on Steam Deck"],
              source: "steam"
            }
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 하기 좋은 로그라이크",
      budget: 20000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches).toEqual([]);
    expect(result.warnings).not.toContain("메타데이터가 불안정해 완화된 추천 기준을 적용했습니다.");
  });

  it("uses a smaller RAWG enrichment budget for non-Steam high-rating strategy browse", async () => {
    const enrichOptions: Array<{
      includeSteamDeckCompatibility?: boolean;
      maxRawgLookups?: number;
      maxSteamLookups?: number;
    }> = [];

    const service = new GameDealService({
      async findDeals() {
        return Array.from({ length: 8 }, (_, index) => ({
          id: `strategy-${index + 1}`,
          title: `Strategy ${index + 1}`,
          price: { amount: 10000 + index * 100, currency: "KRW" },
          regular: { amount: 20000 + index * 200, currency: "KRW" },
          cut: 50,
          genres: ["Strategy"],
          platforms: ["PC"],
          multiplayer: false
        }));
      },
      async enrichDeals(deals, options) {
        enrichOptions.push(options ?? {});
        return deals.map((deal, index) => ({
          ...deal,
          rating: 4.5 - index * 0.05,
          metacritic: 82 - index,
          metadataStatus: "rawg" as const
        }));
      }
    });

    await service.recommendSaleGames({
      preferences: "평가 좋은 전략 할인 게임",
      budget: 25000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(enrichOptions[0]).toMatchObject({
      includeSteamDeckCompatibility: false,
      maxRawgLookups: 6
    });
    expect(enrichOptions[0]?.maxSteamLookups).toBeUndefined();
  });

  it("tries catalog-first before browse junk for non-Steam high-rating strategy prompts", async () => {
    const callOrder: string[] = [];

    const service = new GameDealService({
      async findDeals() {
        callOrder.push("findDeals");
        return [
          {
            id: "junk-browse",
            title: "Deponia",
            price: { amount: 1200, currency: "KRW" },
            regular: { amount: 12000, currency: "KRW" },
            cut: 90,
            genres: ["Adventure", "Puzzle"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 3.8,
            metacritic: 74,
            metadataStatus: "rawg"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles(input) {
        callOrder.push(`discover:${(input.genres ?? []).join(",")}`);
        return [
          {
            title: "Tactics Breakthrough",
            genres: ["Strategy", "Tactics"],
            platforms: ["PC"],
            tags: ["turn-based"],
            rating: 4.45,
            metacritic: 81,
            multiplayer: false
          }
        ];
      },
      async resolveDeal(title) {
        callOrder.push(`resolve:${title}`);
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: "tactics-breakthrough",
              title: "Tactics Breakthrough",
              price: { amount: 14500, currency: "KRW" },
              regular: { amount: 22300, currency: "KRW" },
              cut: 35,
              genres: ["Strategy", "Tactics", "Indie"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.45,
              metacritic: 81,
              metadataStatus: "rawg"
            }
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "평가 좋은 전략 게임",
      budget: 25000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(callOrder[0]).toBe("discover:strategy");
    expect(callOrder).not.toContain("findDeals");
    expect(result.matches[0]).toMatchObject({ title: "Tactics Breakthrough" });
  });

  it("continues non-Steam strategy catalog recovery past zero-discount reviewed candidates until it finds a discounted tactics pick", async () => {
    const resolveCalls: string[] = [];

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles(input) {
        expect(input.genres).toEqual(["strategy"]);
        return [
          {
            title: "Free Tactics",
            genres: ["Strategy", "Tactics"],
            platforms: ["PC"],
            tags: ["turn-based"],
            rating: 4.5,
            metacritic: 84,
            multiplayer: false
          },
          {
            title: "Tactics Breakthrough",
            genres: ["Strategy", "Tactics"],
            platforms: ["PC"],
            tags: ["turn-based"],
            rating: 4.45,
            metacritic: 81,
            multiplayer: false
          }
        ];
      },
      async resolveDeal(title) {
        resolveCalls.push(title);
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: title.toLowerCase().replace(/\s+/g, "-"),
              title,
              price: { amount: title === "Tactics Breakthrough" ? 14500 : 0, currency: "KRW" },
              regular: { amount: 22300, currency: "KRW" },
              cut: title === "Tactics Breakthrough" ? 35 : 0,
              genres: ["Strategy", "Tactics"],
              platforms: ["PC"],
              multiplayer: false,
              rating: title === "Tactics Breakthrough" ? 4.45 : 4.5,
              metacritic: title === "Tactics Breakthrough" ? 81 : 84,
              metadataStatus: "rawg"
            }
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "검증된 전술 게임",
      budget: 25000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(resolveCalls.slice(0, 2)).toEqual(["Free Tactics", "Tactics Breakthrough"]);
    expect(result.matches[0]).toMatchObject({ title: "Tactics Breakthrough" });
  });

  it("keeps non-Steam strategy recovery aligned with complexity and reading constraints", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles() {
        return [
          {
            title: "Text-Heavy Grand Strategy Ledger",
            genres: ["Strategy", "Simulation"],
            platforms: ["PC"],
            tags: ["grand strategy", "management", "text-heavy"],
            rating: 4.6,
            metacritic: 84,
            multiplayer: false
          },
          {
            title: "Tactics Breakthrough",
            genres: ["Strategy", "Tactics"],
            platforms: ["PC"],
            tags: ["turn-based"],
            rating: 4.45,
            metacritic: 81,
            multiplayer: false
          }
        ];
      },
      async resolveDeal(title) {
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: title.toLowerCase().replace(/\s+/g, "-"),
              title,
              price: { amount: title === "Tactics Breakthrough" ? 14500 : 9100, currency: "KRW" },
              regular: { amount: title === "Tactics Breakthrough" ? 22300 : 26000, currency: "KRW" },
              cut: title === "Tactics Breakthrough" ? 35 : 65,
              genres:
                title === "Tactics Breakthrough"
                  ? ["Strategy", "Tactics", "Indie"]
                  : ["Strategy", "Simulation"],
              platforms: ["PC"],
              multiplayer: false,
              rating: title === "Tactics Breakthrough" ? 4.45 : 4.6,
              metacritic: title === "Tactics Breakthrough" ? 81 : 84,
              metadataStatus: "rawg"
            }
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "리뷰 좋은 전략 게임인데 읽을 거 너무 많은 건 말고",
      budget: 25000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Tactics Breakthrough" });
  });

  it("keeps non-Steam metadata warnings from reviving junk browse candidates", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "junk-browse",
            title: "Bundle Course Collection",
            price: { amount: 11000, currency: "KRW" },
            regular: { amount: 22000, currency: "KRW" },
            cut: 50,
            genres: ["Education"],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["RAWG request failed with 502"]
        };
      },
      async discoverTitles() {
        return [
          {
            title: "Verified Tactics",
            genres: ["Strategy", "Tactics"],
            platforms: ["PC"],
            tags: ["turn-based"],
            rating: 4.4,
            metacritic: 83,
            multiplayer: false
          }
        ];
      },
      async resolveDeal(title) {
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: "verified-tactics",
              title: "Verified Tactics",
              price: { amount: 14900, currency: "KRW" },
              regular: { amount: 29800, currency: "KRW" },
              cut: 50,
              genres: ["Strategy", "Tactics"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.4,
              metacritic: 83,
              metadataStatus: "missing"
            }
          ],
          warnings: ["RAWG request failed with 502"]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "well-reviewed strategy game",
      budget: 25000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Verified Tactics" });
    expect(result.matches[0]).not.toMatchObject({ title: "Bundle Course Collection" });
    expect(result.warnings).toContain("RAWG request failed with 502");
  });

  it("salvages non-Steam strategy prompts by overlaying catalog metadata onto discounted browse deals", async () => {
    let discoverCalls = 0;

    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "civ-vi-anthology",
            title: "Sid Meiers Civilization VI Anthology",
            price: { amount: 19900, currency: "KRW" },
            regular: { amount: 99500, currency: "KRW" },
            cut: 80,
            genres: [],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["일부 메타데이터를 생략했습니다."]
        };
      },
      async discoverTitles(input) {
        discoverCalls += 1;
        expect(input.genres).toEqual(["strategy"]);

        return [
          {
            title: "Sid Meier's Civilization VI",
            genres: ["Strategy", "Turn-Based"],
            platforms: ["PC"],
            tags: ["turn-based"],
            rating: 4.5,
            metacritic: 88,
            multiplayer: false
          }
        ];
      },
      async resolveDeal(title) {
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: "title-only-catalog",
              title,
              price: { amount: 0, currency: "KRW" },
              regular: { amount: 0, currency: "KRW" },
              cut: 0,
              genres: [],
              platforms: ["PC"],
              multiplayer: false,
              metadataStatus: "missing"
            }
          ],
          warnings: ["가격 개요 정보가 없어 제목만 확인했습니다."]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "평가 좋은 전략 할인 게임",
      budget: 25000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(discoverCalls).toBeGreaterThanOrEqual(2);
    expect(result.matches[0]).toMatchObject({
      title: "Sid Meiers Civilization VI Anthology",
      cut: 80,
      genres: expect.arrayContaining(["Strategy"]),
      metacritic: 88
    });
  });

  it("salvages simple strategy prompts during ITAD 429 outages from discounted browse deals", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "tactics-sale",
            title: "Tactics Master Gold",
            price: { amount: 12900, currency: "KRW" },
            regular: { amount: 25800, currency: "KRW" },
            cut: 50,
            genres: [],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: [
            "일부 메타데이터를 생략했습니다.",
            "ITAD request failed with 429",
            "가격 개요 정보를 가져오지 못해 일부 데이터만 표시합니다.",
            "역대 최저가 정보를 가져오지 못해 현재 가격만 표시합니다."
          ]
        };
      },
      async discoverTitles() {
        return [
          {
            title: "Tactics Master",
            genres: ["Strategy", "Tactics"],
            platforms: ["PC"],
            tags: ["turn-based"],
            rating: 4.3,
            metacritic: 81,
            multiplayer: false
          }
        ];
      },
      async resolveDeal(title) {
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: "title-only-outage",
              title,
              price: { amount: 0, currency: "KRW" },
              regular: { amount: 0, currency: "KRW" },
              cut: 0,
              genres: [],
              platforms: ["PC"],
              multiplayer: false,
              metadataStatus: "missing"
            }
          ],
          warnings: ["가격 개요 정보가 없어 제목만 확인했습니다."]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "검증된 전술 게임",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({
      title: "Tactics Master Gold",
      cut: 50,
      genres: expect.arrayContaining(["Strategy", "Tactics"]),
      metacritic: 81
    });
  });

  it("salvages non-Steam strategy prompts from metadata-light raw browse candidates after RAWG timeouts", async () => {
    let discoverCalls = 0;

    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "reviewed-tactics-deluxe",
            title: "Reviewed Tactics Deluxe",
            price: { amount: 13_900, currency: "KRW" },
            regular: { amount: 27_800, currency: "KRW" },
            cut: 50,
            genres: [],
            platforms: [],
            multiplayer: false,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: [
            "일부 메타데이터를 생략했습니다.",
            "가격 개요 정보가 없어 제목만 확인했습니다.",
            "RAWG 메타데이터를 일부 불러오지 못했습니다: BrightGunner (RAWG request failed with timeout after 1500ms)"
          ]
        };
      },
      async discoverTitles() {
        discoverCalls += 1;
        return [
          {
            title: "Reviewed Tactics",
            genres: ["Strategy", "Tactics"],
            platforms: ["PC"],
            tags: ["turn-based"],
            rating: 4.4,
            metacritic: 84,
            multiplayer: false
          }
        ];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "평가 좋은 전략 할인 게임",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(discoverCalls).toBe(1);
    expect(result.matches[0]).toMatchObject({
      title: "Reviewed Tactics Deluxe",
      cut: 50,
      genres: expect.arrayContaining(["Strategy", "Tactics"]),
      metacritic: 84
    });
  });

  it("keeps genre-and-platform lenient browse fallback scoped to structured multiplayer recovery", async () => {
    const browseOptions: Array<{ genres?: string[] | undefined; options?: unknown }> = [];

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["일부 메타데이터를 생략했습니다."]
        };
      },
      async discoverTitles() {
        return [
          {
            title: "Fallback Strategy",
            genres: ["Strategy"],
            platforms: ["PC"],
            tags: ["turn-based"],
            rating: 4.2,
            metacritic: 80,
            multiplayer: false
          }
        ];
      },
      async resolveDeal(title) {
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: "fallback-strategy",
              title,
              price: { amount: 0, currency: "KRW" },
              regular: { amount: 0, currency: "KRW" },
              cut: 0,
              genres: [],
              platforms: ["PC"],
              multiplayer: false,
              metadataStatus: "missing"
            }
          ],
          warnings: ["가격 개요 정보가 없어 제목만 확인했습니다."]
        };
      }
    }) as any;

    const originalDiscoverDealsInternal = service.discoverDealsInternal.bind(service);
    service.discoverDealsInternal = async (args: any, options?: any) => {
      browseOptions.push({ genres: args.genres, options });
      return originalDiscoverDealsInternal(args, options);
    };

    await service.recommendSaleGames({
      preferences: "평가 좋은 전략 할인 게임",
      budget: 25000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(
      browseOptions.find((call) => call.genres?.includes("Strategy"))?.options
    ).toMatchObject({ lenientFallbackMode: "genre-only" });
  });

  it("drops deckbuilder picks when the prompt explicitly excludes card gameplay", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "card-roguelike",
            title: "Inscryption",
            price: { amount: 10285, currency: "KRW" },
            regular: { amount: 28571, currency: "KRW" },
            cut: 64,
            genres: ["Strategy", "Roguelike", "Deckbuilder", "Card"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.38,
            metacritic: 86,
            metadataStatus: "rawg"
          },
          {
            id: "action-roguelite",
            title: "BALL x PIT",
            price: { amount: 11250, currency: "KRW" },
            regular: { amount: 22500, currency: "KRW" },
            cut: 50,
            genres: ["Action", "Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.1,
            metacritic: 80,
            metadataStatus: "rawg"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "카드 말고 액션 로그라이트",
      budget: 18000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "BALL x PIT" });
  });

  it("removes racing and sports outliers when the prompt excludes them", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "trailblazers",
            title: "Trailblazers",
            price: { amount: 1764, currency: "KRW" },
            regular: { amount: 44400, currency: "KRW" },
            cut: 96,
            genres: ["Racing", "Action", "Casual", "Sports", "Indie"],
            platforms: ["PC"],
            multiplayer: true,
            rating: 3.17,
            metacritic: null,
            metadataStatus: "rawg"
          },
          {
            id: "party-brawler",
            title: "Party Brawler Heroes",
            price: { amount: 9900, currency: "KRW" },
            regular: { amount: 22000, currency: "KRW" },
            cut: 55,
            genres: ["Action", "Casual", "Party", "Indie"],
            platforms: ["PC"],
            multiplayer: true,
            rating: 4.05,
            metacritic: 78,
            metadataStatus: "unavailable"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "레이싱이나 스포츠는 말고 친구랑 같이 할 게임",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Party Brawler Heroes" });
  });

  it("prefers reviewed tactics picks over heavy strategy when complexity is explicitly avoided", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "grand-strategy",
            title: "Grand Strategy Ledger",
            price: { amount: 9100, currency: "KRW" },
            regular: { amount: 26000, currency: "KRW" },
            cut: 65,
            genres: ["Strategy", "Simulation"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.55,
            metacritic: 83,
            metadataStatus: "rawg"
          },
          {
            id: "tactics-pick",
            title: "Tactics Breakthrough",
            price: { amount: 14500, currency: "KRW" },
            regular: { amount: 22300, currency: "KRW" },
            cut: 35,
            genres: ["Strategy", "Tactics", "Indie"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.45,
            metacritic: 81,
            metadataStatus: "rawg"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "복잡한 전략은 말고 검증된 전술 게임",
      budget: 25000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Tactics Breakthrough" });
  });

  it("demotes competitive multiplayer picks when the prompt asks for non-competitive co-op", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "pvp-arena",
            title: "Arena Showdown PVP",
            price: { amount: 8400, currency: "KRW" },
            regular: { amount: 28000, currency: "KRW" },
            cut: 70,
            genres: ["Action", "Arena"],
            platforms: ["PC"],
            multiplayer: true,
            rating: 4.25,
            metacritic: 79,
            metadataStatus: "rawg"
          },
          {
            id: "party-brawler",
            title: "Party Brawler Heroes",
            price: { amount: 9900, currency: "KRW" },
            regular: { amount: 22000, currency: "KRW" },
            cut: 55,
            genres: ["Action", "Casual", "Party"],
            platforms: ["PC"],
            multiplayer: true,
            rating: 4.05,
            metacritic: 78,
            metadataStatus: "rawg"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "경쟁 말고 친구랑 가볍게 협동",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Party Brawler Heroes" });
  });

  it("prefers reviewed short card picks over filler candidates for quality-sensitive deckbuilding prompts", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "filler-card",
            title: "Card Pack 2026",
            price: { amount: 500, currency: "KRW" },
            regular: { amount: 10000, currency: "KRW" },
            cut: 95,
            genres: ["Card", "Deckbuilder"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 0,
            metacritic: null,
            metadataStatus: "unavailable"
          },
          {
            id: "reviewed-card",
            title: "Card Tactics Express",
            price: { amount: 11000, currency: "KRW" },
            regular: { amount: 22000, currency: "KRW" },
            cut: 50,
            genres: ["Card", "Deckbuilder", "Strategy"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.3,
            metacritic: 82,
            metadataStatus: "rawg"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "리뷰 좋고 filler 아닌 짧은 카드게임",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Card Tactics Express" });
  });

  it("treats party-sale prompts as multiplayer-first instead of falling back to single-player filler", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "deponia",
            title: "Deponia",
            price: { amount: 1200, currency: "KRW" },
            regular: { amount: 12000, currency: "KRW" },
            cut: 90,
            genres: ["Indie", "Adventure", "RPG", "Puzzle"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 3.85,
            metacritic: 74,
            metadataStatus: "rawg"
          },
          {
            id: "party-brawler",
            title: "Party Brawler Heroes",
            price: { amount: 9900, currency: "KRW" },
            regular: { amount: 22000, currency: "KRW" },
            cut: 55,
            genres: ["Action", "Casual", "Party", "Indie"],
            platforms: ["PC"],
            multiplayer: true,
            rating: 4.05,
            metacritic: 78,
            metadataStatus: "rawg"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "party game on sale",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Party Brawler Heroes" });
  });

  it("recovers a reviewed party co-op instead of returning empty for non-PvP non-racing prompts", async () => {
    let resolveCalls = 0;

    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "trailblazers",
            title: "Trailblazers",
            price: { amount: 1764, currency: "KRW" },
            regular: { amount: 44400, currency: "KRW" },
            cut: 96,
            genres: ["Racing", "Action", "Casual", "Sports", "Indie"],
            platforms: ["PC"],
            multiplayer: true,
            rating: 3.17,
            metacritic: null,
            metadataStatus: "rawg"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles() {
        return [
          {
            title: "Party Brawler Heroes",
            genres: ["Action", "Casual", "Party"],
            platforms: ["PC"],
            tags: ["multiplayer", "party"],
            rating: 4.2,
            metacritic: 79,
            multiplayer: true
          }
        ];
      },
      async resolveDeal(title) {
        resolveCalls += 1;
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: "party-brawler",
              title: "Party Brawler Heroes",
              price: { amount: 10900, currency: "KRW" },
              regular: { amount: 21900, currency: "KRW" },
              cut: 50,
              genres: ["Action", "Casual", "Party"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.2,
              metacritic: 79,
              metadataStatus: "rawg"
            }
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "co-op game, not PvP, not racing",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(resolveCalls).toBeGreaterThan(0);
    expect(result.matches[0]).toMatchObject({ title: "Party Brawler Heroes" });
  });

  it("recovers generic co-op candidates even when they are not party-shaped", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles() {
        return [
          {
            title: "Space Fleet Co-op",
            genres: ["Simulation"],
            platforms: ["PC"],
            tags: ["multiplayer", "cooperative", "teamplay"],
            rating: 4.1,
            metacritic: 78,
            multiplayer: true
          }
        ];
      },
      async resolveDeal(title) {
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: "space-fleet-coop",
              title,
              price: { amount: 15900, currency: "KRW" },
              regular: { amount: 25900, currency: "KRW" },
              cut: 39,
              genres: ["Simulation"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.1,
              metacritic: 78,
              metadataStatus: "rawg"
            }
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "co-op game, not PvP, not racing",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Space Fleet Co-op" });
  });

  it("keeps resolving simple social sparse recovery past non-viable titles until it finds an in-budget PC co-op match", async () => {
    const resolvedTitles: string[] = [];

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles() {
        return [
          {
            title: "Aegis Arena",
            genres: ["Action"],
            platforms: ["PC"],
            tags: [],
            rating: 4.2,
            metacritic: 79,
            multiplayer: true
          },
          {
            title: "Ballistics",
            genres: ["Action"],
            platforms: ["PC"],
            tags: [],
            rating: 4.1,
            metacritic: 77,
            multiplayer: true
          },
          {
            title: "Crimson Outlaws",
            genres: ["Action"],
            platforms: ["PC"],
            tags: [],
            rating: 4.1,
            metacritic: 78,
            multiplayer: true
          },
          {
            title: "Delta Derby",
            genres: ["Action"],
            platforms: ["PC"],
            tags: [],
            rating: 4.0,
            metacritic: 76,
            multiplayer: true
          },
          {
            title: "Echo Edge",
            genres: ["Action"],
            platforms: ["PC"],
            tags: [],
            rating: 4.0,
            metacritic: 76,
            multiplayer: true
          },
          {
            title: "Frontline Reloaded",
            genres: ["Action"],
            platforms: ["PC"],
            tags: [],
            rating: 4.2,
            metacritic: 80,
            multiplayer: true
          },
          {
            title: "Galaxy Brawlers",
            genres: ["Action"],
            platforms: ["PC"],
            tags: [],
            rating: 4.1,
            metacritic: 78,
            multiplayer: true
          },
          {
            title: "Helix Heroes",
            genres: ["Action"],
            platforms: ["PC"],
            tags: [],
            rating: 4.0,
            metacritic: 75,
            multiplayer: true
          },
          {
            title: "Jolly Duo",
            genres: ["Casual"],
            platforms: ["PC"],
            tags: [],
            rating: 4.0,
            metacritic: 76,
            multiplayer: true
          },
          {
            title: "Omega Squad",
            genres: ["Simulation"],
            platforms: ["PC"],
            tags: [],
            rating: 4.1,
            metacritic: 78,
            multiplayer: true
          }
        ];
      },
      async resolveDeal(title) {
        resolvedTitles.push(title);

        switch (title) {
          case "Aegis Arena":
            return {
              kind: "match" as const,
              title,
              matches: [
                {
                  id: "aegis-arena",
                  title,
                  price: { amount: 24_900, currency: "KRW" },
                  regular: { amount: 34_900, currency: "KRW" },
                  cut: 29,
                  genres: ["Action"],
                  platforms: ["PC"],
                  multiplayer: true,
                  rating: 4.2,
                  metacritic: 79,
                  metadataStatus: "rawg"
                }
              ]
            };
          case "Ballistics":
            return {
              kind: "match" as const,
              title,
              matches: [
                {
                  id: "ballistics",
                  title,
                  price: { amount: 0, currency: "KRW" },
                  regular: { amount: 10_000, currency: "KRW" },
                  cut: 0,
                  genres: ["Racing", "Arcade"],
                  platforms: ["PC"],
                  multiplayer: true,
                  rating: 4.1,
                  metacritic: 77,
                  metadataStatus: "rawg"
                }
              ]
            };
          case "Crimson Outlaws":
            return {
              kind: "match" as const,
              title,
              matches: [
                {
                  id: "crimson-outlaws",
                  title,
                  price: { amount: 62_050, currency: "KRW" },
                  regular: { amount: 73_000, currency: "KRW" },
                  cut: 15,
                  genres: ["Action"],
                  platforms: ["PC"],
                  multiplayer: true,
                  rating: 4.1,
                  metacritic: 78,
                  metadataStatus: "rawg"
                }
              ]
            };
          case "Delta Derby":
            return {
              kind: "match" as const,
              title,
              matches: [
                {
                  id: "delta-derby",
                  title,
                  price: { amount: 0, currency: "KRW" },
                  regular: { amount: 21_500, currency: "KRW" },
                  cut: 0,
                  genres: ["Racing", "Action"],
                  platforms: ["PC"],
                  multiplayer: true,
                  rating: 4.0,
                  metacritic: 76,
                  metadataStatus: "rawg"
                }
              ]
            };
          case "Echo Edge":
            return {
              kind: "match" as const,
              title,
              matches: [
                {
                  id: "echo-edge",
                  title,
                  price: { amount: 28_900, currency: "KRW" },
                  regular: { amount: 41_900, currency: "KRW" },
                  cut: 31,
                  genres: ["Action"],
                  platforms: ["PC"],
                  multiplayer: true,
                  rating: 4.0,
                  metacritic: 76,
                  metadataStatus: "rawg"
                }
              ]
            };
          case "Frontline Reloaded":
            return {
              kind: "match" as const,
              title,
              matches: [
                {
                  id: "frontline-reloaded",
                  title,
                  price: { amount: 35_900, currency: "KRW" },
                  regular: { amount: 45_000, currency: "KRW" },
                  cut: 20,
                  genres: ["Action"],
                  platforms: ["PC"],
                  multiplayer: true,
                  rating: 4.2,
                  metacritic: 80,
                  metadataStatus: "rawg"
                }
              ]
            };
          case "Galaxy Brawlers":
            return {
              kind: "match" as const,
              title,
              matches: [
                {
                  id: "galaxy-brawlers",
                  title,
                  price: { amount: 0, currency: "KRW" },
                  regular: { amount: 19_900, currency: "KRW" },
                  cut: 0,
                  genres: ["Action", "Party"],
                  platforms: ["PC"],
                  multiplayer: true,
                  rating: 4.1,
                  metacritic: 78,
                  metadataStatus: "rawg"
                }
              ]
            };
          case "Helix Heroes":
            return {
              kind: "match" as const,
              title,
              matches: [
                {
                  id: "helix-heroes",
                  title,
                  price: { amount: 27_500, currency: "KRW" },
                  regular: { amount: 39_000, currency: "KRW" },
                  cut: 29,
                  genres: ["Action"],
                  platforms: ["PC"],
                  multiplayer: true,
                  rating: 4.0,
                  metacritic: 75,
                  metadataStatus: "rawg"
                }
              ]
            };
          case "Jolly Duo":
            return {
              kind: "match" as const,
              title,
              matches: [
                {
                  id: "jolly-duo",
                  title,
                  price: { amount: 9_900, currency: "KRW" },
                  regular: { amount: 19_800, currency: "KRW" },
                  cut: 50,
                  genres: ["Action", "Casual"],
                  platforms: ["PC"],
                  multiplayer: true,
                  rating: 4.0,
                  metacritic: 76,
                  metadataStatus: "rawg"
                }
              ]
            };
          case "Omega Squad":
            return {
              kind: "match" as const,
              title,
              matches: [
                {
                  id: "omega-squad",
                  title,
                  price: { amount: 15_900, currency: "KRW" },
                  regular: { amount: 25_900, currency: "KRW" },
                  cut: 39,
                  genres: ["Simulation"],
                  platforms: ["PC"],
                  multiplayer: true,
                  rating: 4.1,
                  metacritic: 78,
                  metadataStatus: "rawg"
                }
              ]
            };
          default:
            return { kind: "not-found" as const, title };
        }
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "친구랑 같이 할 게임",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(resolvedTitles.length).toBeGreaterThan(0);
    expect(resolvedTitles).toContain("Jolly Duo");
    expect(result.matches[0]).toMatchObject({
      title: "Jolly Duo",
      multiplayer: true,
      cut: 50
    });
  });

  it("widens simple social broad-multiplayer catalog discovery before resolving candidates", async () => {
    const discoverLimits: number[] = [];

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles(input) {
        discoverLimits.push(input.limit ?? 0);
        return [];
      },
      async resolveDeal(title) {
        return { kind: "not-found" as const, title };
      }
    });

    await service.recommendSaleGames({
      preferences: "친구랑 같이 할 게임",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(discoverLimits).toContain(16);
  });

  it("tries simple social sparse recovery before burning budget on base browse", async () => {
    const callOrder: string[] = [];

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles() {
        callOrder.push("discoverTitles");
        return [];
      },
      async resolveDeal(title) {
        callOrder.push(`resolve:${title}`);
        return { kind: "not-found" as const, title };
      }
    }) as any;

    service.discoverDealsInternal = async () => {
      callOrder.push("browse");
      return {
        matches: [],
        summary: "조건에 맞는 할인 게임을 찾지 못했습니다.",
        warnings: ["일부 메타데이터를 생략했습니다."]
      };
    };

    await service.recommendSaleGames({
      preferences: "친구랑 같이 할 게임",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(callOrder[0]).toBe("discoverTitles");
    expect(callOrder).toContain("browse");
  });

  it("uses strict-budget structured multiplayer browse recovery after empty base browse", async () => {
    const browseOptions: unknown[] = [];
    const findCalls: Array<{ genres?: string[] | undefined; sort?: string | undefined }> = [];

    const service = new GameDealService({
      async findDeals(args) {
        findCalls.push({ genres: args.genres, sort: args.sort });

        if (!args.genres || args.genres.length === 0) {
          return [];
        }

        if (args.genres[0] === "Action") {
          return [
            {
              id: "over-budget-action-coop",
              title: "Over Budget Action Co-op",
              price: { amount: 26900, currency: "KRW" },
              regular: { amount: 39900, currency: "KRW" },
              cut: 33,
              genres: ["Action"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.3,
              metacritic: 80,
              metadataStatus: "rawg"
            }
          ];
        }

        if (args.genres[0] === "Casual") {
          return [
            {
              id: "console-party-hit",
              title: "Console Party Hit",
              price: { amount: 12900, currency: "KRW" },
              regular: { amount: 21900, currency: "KRW" },
              cut: 41,
              genres: ["Casual", "Party"],
              platforms: ["PlayStation 4"],
              multiplayer: true,
              rating: 4.4,
              metacritic: 82,
              metadataStatus: "rawg"
            }
          ];
        }

        if (args.genres[0] === "Indie") {
          return [
            {
              id: "space-fleet-coop",
              title: "Space Fleet Co-op",
              price: { amount: 15900, currency: "KRW" },
              regular: { amount: 25900, currency: "KRW" },
              cut: 39,
              genres: ["Indie", "Simulation"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.1,
              metacritic: 78,
              metadataStatus: "rawg"
            }
          ];
        }

        return [];
      },
      async enrichDeals(deals) {
        return deals;
      }
    }) as any;

    const originalDiscoverDealsInternal = service.discoverDealsInternal.bind(service);
    service.discoverDealsInternal = async (args: any, options?: any) => {
      browseOptions.push(options);
      return originalDiscoverDealsInternal(args, options);
    };

    const result = await service.recommendSaleGames({
      preferences: "co-op game, not PvP, not racing",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Space Fleet Co-op" });
    expect(findCalls).toEqual([
      { genres: undefined, sort: "best-value" },
      { genres: ["Action"], sort: "best-value" },
      { genres: ["Casual"], sort: "best-value" },
      { genres: ["Indie"], sort: "best-value" }
    ]);
    expect(browseOptions.slice(1)).toEqual([
      { skipCatalogFallback: true, lenientFallbackMode: "genre-and-platform", maxRawgLookups: 6 },
      { skipCatalogFallback: true, lenientFallbackMode: "genre-and-platform", maxRawgLookups: 6 },
      { skipCatalogFallback: true, lenientFallbackMode: "genre-and-platform", maxRawgLookups: 6 }
    ]);
  });

  it("keeps party prompts from reviving adventure-puzzle filler during structured multiplayer browse", async () => {
    const service = new GameDealService({
      async findDeals(args) {
        if (!args.genres || args.genres.length === 0) {
          return [];
        }

        if (args.genres[0] === "Action") {
          return [
            {
              id: "cozy-filler-party",
              title: "Cozy Grove Party Edition",
              price: { amount: 11900, currency: "KRW" },
              regular: { amount: 21900, currency: "KRW" },
              cut: 46,
              genres: ["Adventure", "Puzzle"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.0,
              metacritic: 76,
              metadataStatus: "rawg"
            }
          ];
        }

        if (args.genres[0] === "Casual") {
          return [
            {
              id: "party-brawler-heroes",
              title: "Party Brawler Heroes",
              price: { amount: 10900, currency: "KRW" },
              regular: { amount: 21900, currency: "KRW" },
              cut: 50,
              genres: ["Action", "Casual", "Party"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.2,
              metacritic: 79,
              metadataStatus: "rawg"
            }
          ];
        }

        return [];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "파티용인데 레이싱은 말고 웃긴 게임",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Party Brawler Heroes" });
  });

  it("keeps structured multiplayer browse alive when platform metadata is omitted", async () => {
    const service = new GameDealService({
      async findDeals(args) {
        if (!args.genres || args.genres.length === 0) {
          if (args.sort === "highest-rating") {
            return [
              {
                id: "orbital-teamplay",
                title: "Orbital Teamplay Co-op",
                price: { amount: 14900, currency: "KRW" },
                regular: { amount: 24900, currency: "KRW" },
                cut: 40,
                genres: [],
                platforms: [],
                multiplayer: true,
                rating: 4.2,
                metacritic: 81,
                metadataStatus: "itad"
              }
            ];
          }

          return [];
        }

        return [];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["RAWG 보강 한도 때문에 일부 메타데이터를 생략했습니다."]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "co-op game, not PvP, not racing",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Orbital Teamplay Co-op" });
  });

  it("treats shooter roguelike prompts as action roguelites", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "inscryption",
            title: "Inscryption",
            price: { amount: 10285, currency: "KRW" },
            regular: { amount: 28571, currency: "KRW" },
            cut: 64,
            genres: ["Indie", "Strategy", "Adventure", "Roguelike", "Deckbuilder", "Card"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.38,
            metacritic: 86,
            metadataStatus: "rawg"
          },
          {
            id: "ball-x-pit",
            title: "BALL x PIT",
            price: { amount: 11250, currency: "KRW" },
            regular: { amount: 22500, currency: "KRW" },
            cut: 50,
            genres: ["Action", "Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.1,
            metacritic: 80,
            metadataStatus: "rawg"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "슈터 로그라이트",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "BALL x PIT" });
  });

  it("demotes turn-based strategy roguelikes when the prompt explicitly rejects them", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "dwarf-fortress",
            title: "Dwarf Fortress",
            price: { amount: 15000, currency: "KRW" },
            regular: { amount: 30000, currency: "KRW" },
            cut: 50,
            genres: ["Strategy", "Simulation", "Roguelike", "Turn-Based"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.33,
            metacritic: 93,
            metadataStatus: "rawg"
          },
          {
            id: "ball-x-pit",
            title: "BALL x PIT",
            price: { amount: 11250, currency: "KRW" },
            regular: { amount: 22500, currency: "KRW" },
            cut: 50,
            genres: ["Action", "Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.1,
            metacritic: 80,
            metadataStatus: "rawg"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "fast roguelite, not turn-based",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "BALL x PIT" });
  });

  it("does not revive excluded turn-based roguelikes during degraded-mode recovery", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "dwarf-fortress",
            title: "Dwarf Fortress",
            price: { amount: 15000, currency: "KRW" },
            regular: { amount: 30000, currency: "KRW" },
            cut: 50,
            genres: ["Strategy", "Simulation", "Roguelike", "Turn-Based"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.33,
            metacritic: 93,
            metadataStatus: "missing"
          },
          {
            id: "ball-x-pit",
            title: "BALL x PIT",
            price: { amount: 11250, currency: "KRW" },
            regular: { amount: 22500, currency: "KRW" },
            cut: 50,
            genres: ["Action", "Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.1,
            metacritic: 80,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals() {
        throw new Error("RAWG request failed with 502");
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "fast roguelite, not turn-based",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "BALL x PIT" });
    expect(result.matches.map((match) => (match as { title: string }).title)).not.toContain(
      "Dwarf Fortress"
    );
  });

  it("keeps ordered multiplayer sparse recovery for exclusion-heavy co-op prompts", async () => {
    const discoverCalls: Array<{ tags?: string[]; genres?: string[] }> = [];

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles(input) {
        const call: { tags?: string[]; genres?: string[] } = {};
        if (input.tags) {
          call.tags = input.tags;
        }
        if (input.genres) {
          call.genres = input.genres;
        }
        discoverCalls.push(call);

        if (discoverCalls.length < 3) {
          return [];
        }

        return [
          {
            title: "Party Brawler Heroes",
            genres: ["Action", "Casual", "Party"],
            platforms: ["PC"],
            tags: ["multiplayer", "party"],
            rating: 4.2,
            metacritic: 79,
            multiplayer: true
          }
        ];
      },
      async resolveDeal(title) {
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: "party-brawler",
              title: "Party Brawler Heroes",
              price: { amount: 10900, currency: "KRW" },
              regular: { amount: 21900, currency: "KRW" },
              cut: 50,
              genres: ["Action", "Casual", "Party"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.2,
              metacritic: 79,
              metadataStatus: "rawg"
            }
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "co-op game, not PvP, not racing",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(discoverCalls).toEqual([
      { tags: ["multiplayer"], genres: ["action", "casual"] },
      { tags: ["multiplayer"], genres: ["action"] },
      { tags: ["multiplayer"] }
    ]);
    expect(result.matches[0]).toMatchObject({ title: "Party Brawler Heroes" });
  });

  it("caps multiplayer sparse recovery fan-out at three discovers and eight resolves", async () => {
    let resolveCalls = 0;
    let discoverCalls = 0;

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles() {
        discoverCalls += 1;
        return [
          {
            title: `Party Candidate ${discoverCalls}-1`,
            genres: ["Action", "Casual", "Party"],
            platforms: ["PC"],
            tags: ["multiplayer", "party"],
            rating: 4.2,
            metacritic: 79,
            multiplayer: true
          },
          {
            title: `Party Candidate ${discoverCalls}-3`,
            genres: ["Action", "Casual", "Party"],
            platforms: ["PC"],
            tags: ["multiplayer", "party"],
            rating: 4.2,
            metacritic: 79,
            multiplayer: true
          },
          {
            title: `Party Candidate ${discoverCalls}-4`,
            genres: ["Action", "Casual", "Party"],
            platforms: ["PC"],
            tags: ["multiplayer", "party"],
            rating: 4.2,
            metacritic: 79,
            multiplayer: true
          }
        ];
      },
      async resolveDeal(title) {
        resolveCalls += 1;
        return { kind: "not-found" as const, title };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "well-reviewed party co-op, not sports",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches).toEqual([]);
    expect(discoverCalls).toBe(3);
    expect(resolveCalls).toBe(8);
  });

  it("continues multiplayer sparse recovery past zero-discount and title-only candidates until it finds a discounted co-op match", async () => {
    const resolveCalls: string[] = [];

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles() {
        return [
          {
            title: "Title Only Party",
            genres: ["Action", "Casual", "Party"],
            platforms: ["PC"],
            tags: ["multiplayer", "party"],
            rating: 4.2,
            metacritic: 78,
            multiplayer: true
          },
          {
            title: "Free Party",
            genres: ["Action", "Casual", "Party"],
            platforms: ["PC"],
            tags: ["multiplayer", "party"],
            rating: 4.25,
            metacritic: 80,
            multiplayer: true
          },
          {
            title: "Party Brawler Heroes",
            genres: ["Action", "Casual", "Party"],
            platforms: ["PC"],
            tags: ["multiplayer", "party"],
            rating: 4.2,
            metacritic: 79,
            multiplayer: true
          }
        ];
      },
      async resolveDeal(title) {
        resolveCalls.push(title);

        if (title === "Title Only Party") {
          return {
            kind: "match" as const,
            title,
            warnings: ["가격 개요 정보가 없어 제목만 확인했습니다."],
            matches: [
              {
                id: "title-only-party",
                title,
                price: { amount: 0, currency: "KRW" },
                regular: { amount: 0, currency: "KRW" },
                cut: 0,
                genres: [],
                platforms: ["PC"],
                multiplayer: true,
                metadataStatus: "missing"
              }
            ]
          };
        }

        if (title === "Free Party") {
          return {
            kind: "match" as const,
            title,
            matches: [
              {
                id: "free-party",
                title,
                price: { amount: 0, currency: "KRW" },
                regular: { amount: 10000, currency: "KRW" },
                cut: 0,
                genres: ["Action", "Casual", "Party"],
                platforms: ["PC"],
                multiplayer: true,
                rating: 4.25,
                metacritic: 80,
                metadataStatus: "rawg"
              }
            ]
          };
        }

        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: "party-brawler",
              title: "Party Brawler Heroes",
              price: { amount: 10900, currency: "KRW" },
              regular: { amount: 21900, currency: "KRW" },
              cut: 50,
              genres: ["Action", "Casual", "Party"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.2,
              metacritic: 79,
              metadataStatus: "rawg"
            }
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "well-reviewed party co-op, not sports",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(resolveCalls.indexOf("Free Party")).toBeGreaterThanOrEqual(0);
    expect(resolveCalls.indexOf("Party Brawler Heroes")).toBeGreaterThan(
      resolveCalls.indexOf("Free Party")
    );
    expect(result.matches[0]).toMatchObject({ title: "Party Brawler Heroes" });
  });

  it("continues multiplayer sparse recovery past over-budget accepted matches until it finds an in-budget co-op match", async () => {
    const resolveCalls: string[] = [];

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles() {
        return [
          {
            title: "AAA Premium Co-op Deluxe",
            genres: ["Action", "Casual", "Party"],
            platforms: ["PC"],
            tags: ["multiplayer", "party"],
            rating: 4.8,
            metacritic: 92,
            multiplayer: true
          },
          {
            title: "ZZZ Budget Party Brawler",
            genres: ["Action", "Casual", "Party"],
            platforms: ["PC"],
            tags: ["multiplayer", "party"],
            rating: 4.1,
            metacritic: 76,
            multiplayer: true
          }
        ];
      },
      async resolveDeal(title) {
        resolveCalls.push(title);

        if (title === "AAA Premium Co-op Deluxe") {
          return {
            kind: "match" as const,
            title,
            matches: [
              {
                id: "premium-coop-deluxe",
                title,
                price: { amount: 29900, currency: "KRW" },
                regular: { amount: 49900, currency: "KRW" },
                cut: 40,
                genres: ["Action", "Casual", "Party"],
                platforms: ["PC"],
                multiplayer: true,
                rating: 4.4,
                metacritic: 82,
                metadataStatus: "rawg"
              }
            ]
          };
        }

        return {
          kind: "match" as const,
          title,
          matches: [
              {
                id: "budget-party-brawler",
                title,
                price: { amount: 11900, currency: "KRW" },
              regular: { amount: 23900, currency: "KRW" },
              cut: 50,
              genres: ["Action", "Casual", "Party"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.2,
              metacritic: 79,
              metadataStatus: "rawg"
            }
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "co-op game, not PvP, not racing",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(resolveCalls).toEqual(["AAA Premium Co-op Deluxe", "ZZZ Budget Party Brawler"]);
    expect(result.matches[0]).toMatchObject({ title: "ZZZ Budget Party Brawler" });
  });

  it("skips non-PC multiplayer catalog candidates when the prompt explicitly asks for PC", async () => {
    const resolveCalls: string[] = [];

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles() {
        return [
          {
            title: "Console Party Hit",
            genres: ["Action", "Casual", "Party"],
            platforms: ["PlayStation 4"],
            tags: ["multiplayer", "party"],
            rating: 4.5,
            metacritic: 85,
            multiplayer: true
          },
          {
            title: "PC Co-op Tactics",
            genres: ["Simulation"],
            platforms: ["PC"],
            tags: ["multiplayer", "cooperative", "teamplay"],
            rating: 4.1,
            metacritic: 78,
            multiplayer: true
          }
        ];
      },
      async resolveDeal(title) {
        resolveCalls.push(title);
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: title.toLowerCase().replace(/\\s+/g, "-"),
              title,
              price: { amount: 15900, currency: "KRW" },
              regular: { amount: 25900, currency: "KRW" },
              cut: 39,
              genres: ["Simulation"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.1,
              metacritic: 78,
              metadataStatus: "rawg"
            }
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "co-op game, not PvP, not racing",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(resolveCalls).toEqual(["PC Co-op Tactics"]);
    expect(result.matches[0]).toMatchObject({ title: "PC Co-op Tactics" });
  });

  it("does not let party prompts drift back to single-player filler after recovery", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "cozy-grove",
            title: "Cozy Grove",
            price: { amount: 0, currency: "KRW" },
            regular: { amount: 20000, currency: "KRW" },
            cut: 100,
            genres: ["Casual", "Indie", "Adventure", "Puzzle"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 3.65,
            metacritic: null,
            metadataStatus: "rawg"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles() {
        return [
          {
            title: "Party Brawler Heroes",
            genres: ["Action", "Casual", "Party"],
            platforms: ["PC"],
            tags: ["multiplayer", "party", "fun"],
            rating: 4.2,
            metacritic: 79,
            multiplayer: true
          }
        ];
      },
      async resolveDeal(title) {
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: "party-brawler",
              title: "Party Brawler Heroes",
              price: { amount: 10900, currency: "KRW" },
              regular: { amount: 21900, currency: "KRW" },
              cut: 50,
              genres: ["Action", "Casual", "Party"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.2,
              metacritic: 79,
              metadataStatus: "rawg"
            }
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "파티용인데 레이싱은 말고 웃긴 게임",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Party Brawler Heroes" });
    expect(result.matches[0]).not.toMatchObject({ title: "Cozy Grove" });
  });

  it("recovers Steam Deck roguelike prompts through bounded sparse recovery", async () => {
    const discoverCalls: Array<{ tags?: string[]; genres?: string[] }> = [];

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles(input) {
        const call: { tags?: string[]; genres?: string[] } = {};
        if (input.tags) {
          call.tags = input.tags;
        }
        if (input.genres) {
          call.genres = input.genres;
        }
        discoverCalls.push(call);

        if (discoverCalls.length === 1) {
          expect(input.genres).toEqual(["action"]);
          return [];
        }

        if (discoverCalls.length === 2) {
          expect(input.genres).toBeUndefined();
          return [
            {
              title: "Deck Runner",
              genres: ["Action", "Roguelike"],
              platforms: ["PC"],
              tags: ["roguelike"],
              rating: 4.1,
              metacritic: 80,
              multiplayer: false
            }
          ];
        }
 
        return [];
      },
      async resolveDeal(title) {
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: "deck-runner",
              title: "Deck Runner",
              price: { amount: 11800, currency: "KRW" },
              regular: { amount: 23600, currency: "KRW" },
              cut: 50,
              genres: ["Action", "Roguelike"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.1,
              metacritic: 80,
              metadataStatus: "rawg",
              steamDeckCompatibility: {
                status: "playable",
                details: [],
                source: "steam"
              }
            }
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 짧게 돌리기 좋은 로그라이크",
      budget: 20000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(discoverCalls).toEqual([
      { tags: ["roguelike", "roguelite"], genres: ["action"] },
      { tags: ["roguelike", "roguelite"] }
    ]);
    expect(result.matches[0]).toMatchObject({ title: "Deck Runner" });
  });

  it("prioritizes action roguelike candidates ahead of generic roguelike tails during Steam Deck sparse recovery", async () => {
    const resolveCalls: string[] = [];

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles() {
        return [
          {
            title: "The Enchanted Cave 2",
            genres: ["Adventure", "RPG", "Roguelike"],
            platforms: ["PC"],
            tags: ["roguelike"],
            rating: 4.5,
            metacritic: 79,
            multiplayer: false
          },
          {
            title: "Hades",
            genres: ["Action", "Roguelike"],
            platforms: ["PC"],
            tags: ["action roguelike", "roguelike"],
            rating: 4.6,
            metacritic: 93,
            multiplayer: false
          }
        ];
      },
      async resolveDeal(title) {
        resolveCalls.push(title);
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: title.toLowerCase().replace(/\s+/g, "-"),
              title,
              price: { amount: 14900, currency: "KRW" },
              regular: { amount: 29800, currency: "KRW" },
              cut: 50,
              genres: title === "Hades" ? ["Action", "Roguelike"] : ["Adventure", "RPG", "Roguelike"],
              platforms: ["PC"],
              multiplayer: false,
              rating: title === "Hades" ? 4.6 : 4.5,
              metacritic: title === "Hades" ? 93 : 79,
              metadataStatus: "rawg",
              steamDeckCompatibility: {
                status: "playable",
                details: [],
                source: "steam"
              }
            }
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 하기 좋은 로그라이크",
      budget: 25000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(resolveCalls[0]).toBe("Hades");
    expect(result.matches[0]).toMatchObject({ title: "Hades" });
  });

  it("recovers Steam Deck tactics prompts through strategy sparse recovery", async () => {
    let discoverCalls = 0;
    let resolveCalls = 0;

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles(input) {
        discoverCalls += 1;
        expect(input.genres).toEqual(["strategy"]);
        return [
          {
            title: "Tactics Deck Verified",
            genres: ["Strategy", "Tactics"],
            platforms: ["PC"],
            tags: ["turn-based"],
            rating: 4.4,
            metacritic: 83,
            multiplayer: false
          }
        ];
      },
      async resolveDeal(title) {
        resolveCalls += 1;
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: "tactics-deck",
              title: "Tactics Deck Verified",
              price: { amount: 14900, currency: "KRW" },
              regular: { amount: 29800, currency: "KRW" },
              cut: 50,
              genres: ["Strategy", "Tactics"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.4,
              metacritic: 83,
              metadataStatus: "rawg",
              steamDeckCompatibility: {
                status: "verified",
                details: [],
                source: "steam"
              }
            }
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 검증된 턴제 전술 게임",
      budget: 25000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(discoverCalls).toBe(1);
    expect(resolveCalls).toBe(1);
    expect(result.matches[0]).toMatchObject({ title: "Tactics Deck Verified" });
  });

  it("continues Steam Deck strategy sparse recovery past zero-discount tactics matches until it finds a discounted reviewed strategy candidate", async () => {
    const resolveCalls: string[] = [];

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles() {
        return [
          {
            title: "Free Tactics",
            genres: ["Strategy", "Tactics"],
            platforms: ["PC"],
            tags: ["turn-based"],
            rating: 4.5,
            metacritic: 84,
            multiplayer: false
          },
          {
            title: "The King is Watching",
            genres: ["Strategy"],
            platforms: ["PC"],
            tags: ["tactical", "roguelite"],
            rating: 4.36,
            metacritic: 80,
            multiplayer: false
          }
        ];
      },
      async resolveDeal(title) {
        resolveCalls.push(title);
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: title.toLowerCase().replace(/\s+/g, "-"),
              title,
              price: { amount: title === "The King is Watching" ? 9680 : 0, currency: "KRW" },
              regular: { amount: 14900, currency: "KRW" },
              cut: title === "The King is Watching" ? 35 : 0,
              genres: title === "The King is Watching" ? ["Strategy"] : ["Strategy", "Tactics"],
              platforms: ["PC"],
              multiplayer: false,
              rating: title === "The King is Watching" ? 4.36 : 4.5,
              metacritic: title === "The King is Watching" ? 80 : 84,
              metadataStatus: "rawg",
              steamDeckCompatibility: {
                status: "unknown",
                details: [],
                source: "steam"
              }
            }
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 평가 좋은 전략 게임",
      budget: 25000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(resolveCalls).toEqual(["Free Tactics", "The King is Watching"]);
    expect(result.matches[0]).toMatchObject({ title: "The King is Watching" });
  });

  it("recovers deckbuilding tails through card-first sparse recovery", async () => {
    const discoverCalls: Array<{ tags?: string[]; genres?: string[] }> = [];

    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "deponia",
            title: "Deponia",
            price: { amount: 1200, currency: "KRW" },
            regular: { amount: 12000, currency: "KRW" },
            cut: 90,
            genres: ["Indie", "Adventure", "Puzzle"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 3.8,
            metacritic: 74,
            metadataStatus: "rawg"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles(input) {
        const call: { tags?: string[]; genres?: string[] } = {};
        if (input.tags) {
          call.tags = input.tags;
        }
        if (input.genres) {
          call.genres = input.genres;
        }
        discoverCalls.push(call);

        if (discoverCalls.length === 1) {
          return [
            {
              title: "Card Tactics Express",
              genres: ["Card", "Deckbuilder", "Strategy"],
              platforms: ["PC"],
              tags: ["card game"],
              rating: 4.3,
              metacritic: 82,
              multiplayer: false
            }
          ];
        }

        return [];
      },
      async resolveDeal(title) {
        return {
          kind: "match" as const,
          title,
          matches: [
            {
              id: "card-tactics-express",
              title: "Card Tactics Express",
              price: { amount: 10900, currency: "KRW" },
              regular: { amount: 21800, currency: "KRW" },
              cut: 50,
              genres: ["Card", "Deckbuilder", "Strategy"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.3,
              metacritic: 82,
              metadataStatus: "rawg"
            }
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "카드 덱짜는 재미는 있는데 잡게임 느낌은 말고",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(discoverCalls).toEqual([{ tags: ["roguelike-deckbuilder"] }]);
    expect(result.matches[0]).toMatchObject({ title: "Card Tactics Express" });
  });

  it("salvages budget-constrained Steam Deck roguelike prompts by overlaying catalog metadata onto browse matches", async () => {
    let discoverCalls = 0;

    const service = new GameDealService(
      {
        async findDeals() {
          return [
            {
              id: "deck-runner",
              title: "Deck Runner: Portable Edition™",
              price: { amount: 11800, currency: "KRW" },
              regular: { amount: 23600, currency: "KRW" },
              cut: 50,
              genres: [],
              platforms: ["PC"],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckCompatibility: {
                status: "playable",
                details: [],
                source: "steam"
              }
            }
          ];
        },
        async enrichDeals(deals) {
          return {
            deals,
            warnings: ["Steam Deck 호환성 정보를 확인하지 못했습니다."]
          };
        },
        async discoverTitles(input) {
          discoverCalls += 1;
          expect(input.tags).toEqual(["roguelike", "roguelite"]);

          return [
            {
              title: "Deck Runner Portable Edition",
              genres: ["Action", "Roguelike"],
              platforms: ["PC"],
              tags: ["roguelike"],
              rating: 4.2,
              metacritic: 80,
              multiplayer: false
            }
          ];
        }
      },
      {
        recommendationTimeBudgetMs: 6_000,
        now: () => 0
      }
    );

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 하기 좋은 로그라이크",
      budget: 20_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(discoverCalls).toBe(1);
    expect(result.matches[0]).toMatchObject({ title: "Deck Runner: Portable Edition™" });
  });

  it("salvages Steam Deck roguelike prompts even when metadata-light browse deals are filtered before strict matching", async () => {
    let discoverCalls = 0;

    const service = new GameDealService(
      {
        async findDeals() {
          return [
            {
              id: "portable-rogue-runner",
              title: "Portable Rogue Runner Deluxe",
              price: { amount: 11_800, currency: "KRW" },
              regular: { amount: 23_600, currency: "KRW" },
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckCompatibility: {
                status: "playable",
                details: [],
                source: "steam"
              }
            }
          ];
        },
        async enrichDeals(deals) {
          return {
            deals,
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
            ]
          };
        },
        async discoverTitles(input) {
          discoverCalls += 1;
          expect(input.tags).toEqual(["roguelike", "roguelite"]);

          return [
            {
              title: "Portable Rogue Runner",
              genres: ["Action", "Roguelike"],
              platforms: ["PC"],
              tags: ["roguelike"],
              rating: 4.2,
              metacritic: 80,
              multiplayer: false
            }
          ];
        }
      },
      {
        recommendationTimeBudgetMs: 6_000,
        now: () => 0
      }
    );

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 하기 좋은 로그라이크",
      budget: 20_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(discoverCalls).toBe(1);
    expect(result.matches[0]).toMatchObject({
      title: "Portable Rogue Runner Deluxe",
      cut: 50,
      genres: expect.arrayContaining(["Roguelike"])
    });
  });

  it("salvages budget-constrained Steam Deck strategy prompts by overlaying catalog metadata onto browse matches", async () => {
    let discoverCalls = 0;

    const service = new GameDealService(
      {
        async findDeals() {
          return [
            {
              id: "deck-tactics",
              title: "Deck Tactics Complete",
              price: { amount: 14900, currency: "KRW" },
              regular: { amount: 29800, currency: "KRW" },
              cut: 50,
              genres: [],
              platforms: ["PC"],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckCompatibility: {
                status: "verified",
                details: [],
                source: "steam"
              }
            }
          ];
        },
        async enrichDeals(deals) {
          return {
            deals,
            warnings: ["Steam Deck 호환성 정보를 확인하지 못했습니다."]
          };
        },
        async discoverTitles(input) {
          discoverCalls += 1;
          expect(input.genres).toEqual(["strategy"]);

          return [
            {
              title: "Deck Tactics",
              genres: ["Strategy", "Tactics"],
              platforms: ["PC"],
              tags: ["turn-based"],
              rating: 4.4,
              metacritic: 83,
              multiplayer: false
            }
          ];
        }
      },
      {
        recommendationTimeBudgetMs: 6_000,
        now: () => 0
      }
    );

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 평가 좋은 전략 게임",
      budget: 20_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(discoverCalls).toBe(1);
    expect(result.matches[0]).toMatchObject({ title: "Deck Tactics Complete" });
  });

  it("salvages Steam Deck strategy prompts even when metadata-light browse deals are filtered before strict matching", async () => {
    let discoverCalls = 0;

    const service = new GameDealService(
      {
        async findDeals() {
          return [
            {
              id: "portable-tactics-complete",
              title: "Portable Tactics Complete",
              price: { amount: 14_900, currency: "KRW" },
              regular: { amount: 29_800, currency: "KRW" },
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckCompatibility: {
                status: "verified",
                details: [],
                source: "steam"
              }
            }
          ];
        },
        async enrichDeals(deals) {
          return {
            deals,
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "Steam Deck 호환성 정보를 확인하지 못했습니다."
            ]
          };
        },
        async discoverTitles(input) {
          discoverCalls += 1;
          expect(input.genres).toEqual(["strategy"]);

          return [
            {
              title: "Portable Tactics",
              genres: ["Strategy", "Tactics"],
              platforms: ["PC"],
              tags: ["turn-based"],
              rating: 4.4,
              metacritic: 83,
              multiplayer: false
            }
          ];
        }
      },
      {
        recommendationTimeBudgetMs: 6_000,
        now: () => 0
      }
    );

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 평가 좋은 전략 게임",
      budget: 20_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(discoverCalls).toBe(1);
    expect(result.matches[0]).toMatchObject({
      title: "Portable Tactics Complete",
      cut: 50,
      genres: expect.arrayContaining(["Strategy", "Tactics"])
    });
  });

  it("salvages Steam Deck strategy roguelike prompts from metadata-light raw browse candidates", async () => {
    let discoverCalls = 0;

    const service = new GameDealService(
      {
        async findDeals() {
          return [
            {
              id: "portable-rogue-tactics",
              title: "Portable Rogue Tactics Deluxe",
              price: { amount: 15_900, currency: "KRW" },
              regular: { amount: 31_800, currency: "KRW" },
              cut: 50,
              genres: [],
              platforms: [],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckCompatibility: {
                status: "playable",
                details: [],
                source: "steam"
              }
            }
          ];
        },
        async enrichDeals(deals) {
          return {
            deals,
            warnings: [
              "일부 메타데이터를 생략했습니다.",
              "Steam Deck 호환성 정보를 확인하지 못했습니다."
            ]
          };
        },
        async discoverTitles(input) {
          discoverCalls += 1;
          expect(input.tags).toEqual(["roguelike", "roguelite"]);
          expect(input.genres).toEqual(["strategy"]);

          return [
            {
              title: "Portable Rogue Tactics",
              genres: ["Strategy", "Tactics", "Roguelike"],
              platforms: ["PC"],
              tags: ["roguelike"],
              rating: 4.3,
              metacritic: 81,
              multiplayer: false
            }
          ];
        }
      },
      {
        recommendationTimeBudgetMs: 6_000,
        now: () => 0
      }
    );

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 할 만한 전략 로그라이크",
      budget: 20_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(discoverCalls).toBe(1);
    expect(result.matches[0]).toMatchObject({
      title: "Portable Rogue Tactics Deluxe",
      cut: 50,
      genres: expect.arrayContaining(["Strategy", "Roguelike"])
    });
  });

  it("salvages budget-constrained Steam Deck card roguelikes by overlaying card metadata onto browse matches", async () => {
    let discoverCalls = 0;

    const service = new GameDealService(
      {
        async findDeals() {
          return [
            {
              id: "card-runner",
              title: "Card Runner",
              price: { amount: 10900, currency: "KRW" },
              regular: { amount: 21800, currency: "KRW" },
              cut: 50,
              genres: [],
              platforms: ["PC"],
              multiplayer: false,
              metadataStatus: "missing",
              steamDeckCompatibility: {
                status: "unknown",
                details: [],
                source: "steam"
              }
            }
          ];
        },
        async enrichDeals(deals) {
          return {
            deals,
            warnings: ["Steam Deck 호환성 정보를 확인하지 못했습니다."]
          };
        },
        async discoverTitles(input) {
          discoverCalls += 1;
          expect(input.genres).toEqual(["card"]);

          return [
            {
              title: "Card Runner",
              genres: ["Card", "Deckbuilder", "Roguelike"],
              platforms: ["PC"],
              tags: ["card game", "roguelike-deckbuilder"],
              rating: 4.1,
              metacritic: 79,
              multiplayer: false
            }
          ];
        }
      },
      {
        recommendationTimeBudgetMs: 6_000,
        now: () => 0
      }
    );

    const result = await service.recommendSaleGames({
      preferences: "가볍게 할 카드 로그라이크",
      budget: 15_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(discoverCalls).toBe(1);
    expect(result.matches[0]).toMatchObject({ title: "Card Runner" });
  });

  it("salvages short deckbuilding prompts during ITAD 429 outages from discounted browse deals", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "aces-of-ruin-deluxe",
            title: "Aces of Ruin Deluxe",
            price: { amount: 10_900, currency: "KRW" },
            regular: { amount: 21_800, currency: "KRW" },
            cut: 50,
            genres: [],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: [
            "일부 메타데이터를 생략했습니다.",
            "ITAD request failed with 429",
            "가격 개요 정보를 가져오지 못해 일부 데이터만 표시합니다."
          ]
        };
      },
      async discoverTitles() {
        return [
          {
            title: "Aces of Ruin",
            genres: ["Card", "Deckbuilder", "Roguelike"],
            platforms: ["PC"],
            tags: ["card game", "roguelike-deckbuilder"],
            rating: 4.2,
            metacritic: 80,
            multiplayer: false
          }
        ];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "가볍게 할 카드 로그라이크",
      budget: 15_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({
      title: "Aces of Ruin Deluxe",
      cut: 50,
      genres: expect.arrayContaining(["Card", "Deckbuilder"])
    });
  });

  it("prefers two-axis action deckbuilder candidates over single-axis fillers", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "solo-action-filler",
            title: "Solo Action Story",
            price: { amount: 9_900, currency: "KRW" },
            regular: { amount: 19_800, currency: "KRW" },
            cut: 50,
            genres: ["Action", "Adventure"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 3.9,
            metadataStatus: "missing"
          },
          {
            id: "rogue-deck-assault",
            title: "Rogue Deck Assault",
            price: { amount: 13_500, currency: "KRW" },
            regular: { amount: 27_000, currency: "KRW" },
            cut: 50,
            genres: ["Action", "Card", "Deckbuilder", "Roguelike"],
            platforms: ["PC"],
            tags: ["deckbuilder", "card", "roguelike"],
            multiplayer: false,
            rating: 4.18,
            metacritic: 81,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: [
            "가격 개요 정보가 없어 제목만 확인했습니다.",
            "역대 최저가 정보를 가져오지 못했습니다."
          ]
        };
      },
      async discoverTitles() {
        return [];
      },
      async resolveDeal(title) {
        return { kind: "not-found" as const, title };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "action deckbuilder bargain",
      budget: 18_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({
      title: "Rogue Deck Assault",
      genres: expect.arrayContaining(["Action", "Card", "Deckbuilder"])
    });
  });

  it("salvages short deckbuilding prompts from metadata-light raw browse candidates", async () => {
    let discoverCalls = 0;

    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "pocket-arcana-deluxe",
            title: "Pocket Arcana Deluxe",
            price: { amount: 10_900, currency: "KRW" },
            regular: { amount: 21_800, currency: "KRW" },
            cut: 50,
            genres: [],
            platforms: [],
            multiplayer: false,
            metadataStatus: "missing",
            steamDeckCompatibility: {
              status: "unknown",
              details: [],
              source: "steam"
            }
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: [
            "일부 메타데이터를 생략했습니다.",
            "Steam Deck 호환성 정보를 확인하지 못했습니다."
          ]
        };
      },
      async discoverTitles() {
        discoverCalls += 1;
        return [
          {
            title: "Pocket Arcana",
            genres: ["Card", "Deckbuilder", "Roguelike"],
            platforms: ["PC"],
            tags: ["card game", "roguelike-deckbuilder"],
            rating: 4.2,
            metacritic: 80,
            multiplayer: false
          }
        ];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "가볍게 할 카드 로그라이크",
      budget: 15_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(discoverCalls).toBe(1);
    expect(result.matches[0]).toMatchObject({
      title: "Pocket Arcana Deluxe",
      cut: 50,
      genres: expect.arrayContaining(["Card", "Deckbuilder"])
    });
  });

  it("salvages Steam Deck deckbuilding prompts during ITAD 429 outages from unknown raw browse candidates", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "portable-deck-unknown-429",
            title: "Portable Arcana Deluxe",
            price: { amount: 10_900, currency: "KRW" },
            regular: { amount: 21_800, currency: "KRW" },
            cut: 50,
            genres: [],
            platforms: [],
            multiplayer: false,
            metadataStatus: "missing",
            steamDeckCompatibility: {
              status: "unknown",
              details: [],
              source: "steam"
            }
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: [
            "ITAD request failed with 429",
            "가격 개요 정보가 없어 제목만 확인했습니다.",
            "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
          ]
        };
      },
      async discoverTitles() {
        return [
          {
            title: "Portable Arcana",
            genres: ["Card", "Deckbuilder", "Roguelike"],
            platforms: ["PC"],
            tags: ["card", "deckbuilder", "roguelike-deckbuilder"],
            rating: 4.2,
            metacritic: 80,
            multiplayer: false
          }
        ];
      },
      async resolveDeal(title) {
        return { kind: "not-found" as const, title };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 가볍게 할 카드 덱빌딩",
      budget: 15_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({
      title: "Portable Arcana Deluxe",
      genres: expect.arrayContaining(["Card", "Deckbuilder"]),
      steamDeckCompatibility: expect.objectContaining({ status: "unknown" })
    });
  });

  it("keeps playable Steam Deck deckbuilders when browse genres only imply strategy", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "portable-arcana-clean",
            title: "Portable Arcana Deluxe",
            price: { amount: 10_900, currency: "KRW" },
            regular: { amount: 21_800, currency: "KRW" },
            cut: 50,
            genres: ["Card", "Deckbuilder", "Roguelike"],
            platforms: ["PC"],
            tags: ["card", "deckbuilder", "portable"],
            multiplayer: false,
            metadataStatus: "rawg",
            steamDeckCompatibility: {
              status: "playable",
              details: [],
              source: "steam"
            }
          },
          {
            id: "unsupported-deck-clean",
            title: "Unsupported Deck Rogue",
            price: { amount: 8_900, currency: "KRW" },
            regular: { amount: 17_800, currency: "KRW" },
            cut: 50,
            genres: ["Card", "Deckbuilder"],
            platforms: ["PC"],
            tags: ["card", "deckbuilder"],
            multiplayer: false,
            metadataStatus: "rawg",
            steamDeckCompatibility: {
              status: "unsupported",
              details: [],
              source: "steam"
            }
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱으로 잠깐씩 할 카드 덱빌딩",
      budget: 15_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      title: "Portable Arcana Deluxe",
      steamDeckCompatibility: expect.objectContaining({ status: "playable" })
    });
  });

  it("keeps metadata-light story filler empty during provider outage fallback", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "history-missing-deponia",
            title: "Deponia",
            price: { amount: 9_900, currency: "KRW" },
            regular: { amount: 19_800, currency: "KRW" },
            cut: 50,
            genres: ["Adventure", "Puzzle"],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing"
          },
          {
            id: "history-missing-ai-games",
            title: "AI Games",
            price: { amount: 7_500, currency: "KRW" },
            regular: { amount: 15_000, currency: "KRW" },
            cut: 50,
            genres: [],
            platforms: [],
            multiplayer: false,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: [
            "가격 개요 정보가 없어 제목만 확인했습니다.",
            "역대 최저가 정보를 가져오지 못했습니다."
          ]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "genre hybrid bargain, story filler 말고",
      budget: 18_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches).toEqual([]);
  });

  it("filters Steam Deck lifestyle story filler when a playable handheld candidate exists", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "portable-lounge-brawler-clean",
            title: "Portable Lounge Brawler",
            price: { amount: 12_900, currency: "KRW" },
            regular: { amount: 25_800, currency: "KRW" },
            cut: 50,
            genres: ["Action", "Casual"],
            platforms: ["PC"],
            tags: ["portable", "handheld", "short-session"],
            multiplayer: false,
            rating: 4.01,
            metadataStatus: "rawg",
            steamDeckCompatibility: {
              status: "playable",
              details: [],
              source: "steam"
            }
          },
          {
            id: "portable-lifestyle-deponia",
            title: "Deponia",
            price: { amount: 9_900, currency: "KRW" },
            regular: { amount: 19_800, currency: "KRW" },
            cut: 50,
            genres: ["Adventure", "Puzzle"],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "rawg",
            steamDeckCompatibility: {
              status: "unknown",
              details: [],
              source: "steam"
            }
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱으로 출퇴근길에 잠깐 할 세일 게임",
      budget: 20_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ title: "Portable Lounge Brawler" });
  });

  it("recovers playable Steam Deck lifestyle candidates from metadata-light browse results", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "portable-lifestyle-partial",
            title: "Portable Lounge Brawler",
            price: { amount: 12_900, currency: "KRW" },
            regular: { amount: 25_800, currency: "KRW" },
            cut: 50,
            genres: [],
            platforms: [],
            multiplayer: false,
            metadataStatus: "missing",
            steamDeckCompatibility: {
              status: "playable",
              details: [],
              source: "steam"
            }
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: [
            "일부 메타데이터를 생략했습니다.",
            "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
          ]
        };
      },
      async discoverTitles() {
        return [
          {
            title: "Portable Lounge Brawler",
            genres: ["Action", "Casual"],
            platforms: ["PC"],
            tags: ["portable", "handheld", "short-session"],
            rating: 4.01,
            metacritic: 77,
            multiplayer: false
          }
        ];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱으로 가볍게 즐길 handheld bargain",
      budget: 18_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      title: "Portable Lounge Brawler",
      steamDeckCompatibility: expect.objectContaining({ status: "playable" })
    });
  });

  it("lets simple social prompts run the full structured browse query set under the relaxed profile", async () => {
    let currentTime = 0;
    const calls: Array<string> = [];

    const service = new GameDealService(
      {
        async findDeals() {
          return [];
        },
        async enrichDeals(deals) {
          return deals;
        }
      },
      {
        recommendationTimeBudgetMs: 6_000,
        now: () => currentTime
      }
    ) as any;

    service.discoverDealsInternal = async (args: any) => {
      calls.push(args.genres?.join(",") ?? "base");
      currentTime += calls.length === 1 ? 2_000 : 400;
      return {
        matches: [],
        summary: "조건에 맞는 할인 게임을 찾지 못했습니다.",
        warnings: ["일부 메타데이터를 생략했습니다."]
      };
    };

    await service.recommendSaleGames({
      preferences: "친구랑 같이 할 게임",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(calls).toEqual(["base", "Action", "Casual", "Indie", "base"]);
  });

  it("keeps the tighter structured browse ceiling for exclusion-heavy multiplayer prompts", async () => {
    let currentTime = 0;
    const calls: Array<string> = [];

    const service = new GameDealService(
      {
        async findDeals() {
          return [];
        },
        async enrichDeals(deals) {
          return deals;
        }
      },
      {
        recommendationTimeBudgetMs: 6_000,
        now: () => currentTime
      }
    ) as any;

    service.discoverDealsInternal = async (args: any) => {
      calls.push(args.genres?.join(",") ?? "base");
      currentTime += calls.length === 1 ? 2_000 : 400;
      return {
        matches: [],
        summary: "조건에 맞는 할인 게임을 찾지 못했습니다.",
        warnings: ["일부 메타데이터를 생략했습니다."]
      };
    };

    await service.recommendSaleGames({
      preferences: "co-op game, not PvP, not racing",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(calls).toEqual(["base", "Action", "Casual"]);
  });

  it.each([
    "친구랑 같이 할 게임",
    "둘이서 하기 좋은 게임",
    "친구들이랑 웃기게 떠들면서 할 협동 할인 게임",
    "파티플레이로 하기 좋은 세일겜",
    "팀플하기 좋은 할인 게임",
    "co-op game for friends",
    "party game on sale",
    "친구와 같이 할 협동 게임",
    "2인으로 하기 좋은 액션 게임",
    "여럿이 같이 놀기 좋은 할인 게임"
  ])("salvages simple social prompt %s by overlaying metadata onto raw browse matches", async (preferences) => {
    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles() {
        return [
          {
            title: "Party Brawler Heroes",
            genres: ["Action", "Casual", "Party"],
            platforms: ["PC"],
            tags: ["multiplayer", "co-op"],
            rating: 4.2,
            metacritic: 80,
            multiplayer: true
          }
        ];
      }
    }) as any;

    service.discoverDealsInternal = async () => ({
      matches: [
        {
          id: "party-brawler-deluxe",
          title: "Party Brawler Heroes - Deluxe Edition",
          price: { amount: 9_900, currency: "KRW" },
          regular: { amount: 22_000, currency: "KRW" },
          cut: 55,
          genres: [],
          platforms: ["PC"],
          multiplayer: false,
          metadataStatus: "missing"
        }
      ],
      summary: "조건에 맞는 할인 게임을 찾았습니다.",
      warnings: ["일부 메타데이터를 생략했습니다.", "가격 개요 정보가 없어 제목만 확인했습니다."]
    });

    const result = await service.recommendSaleGames({
      preferences,
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({
      title: "Party Brawler Heroes - Deluxe Edition",
      multiplayer: true,
      cut: 55,
      genres: expect.arrayContaining(["Action", "Casual", "Party"])
    });
  });

  it("salvages social prompts during ITAD 429 outages from discounted browse deals with multiplayer evidence", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "teamplay-deluxe",
            title: "Teamplay Co-op Deluxe",
            price: { amount: 11_900, currency: "KRW" },
            regular: { amount: 23_800, currency: "KRW" },
            cut: 50,
            genres: [],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: [
            "일부 메타데이터를 생략했습니다.",
            "ITAD request failed with 429",
            "가격 개요 정보를 가져오지 못해 일부 데이터만 표시합니다."
          ]
        };
      },
      async discoverTitles() {
        return [
          {
            title: "Teamplay Co-op",
            genres: ["Action", "Casual"],
            platforms: ["PC"],
            tags: ["multiplayer", "co-op", "teamplay"],
            rating: 4.2,
            metacritic: 80,
            multiplayer: true
          }
        ];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "non-sweaty multiplayer sale for PC",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({
      title: "Teamplay Co-op Deluxe",
      multiplayer: true,
      cut: 50
    });
  });

  it("surfaces metadata-light multiplayer browse deals for simple social prompts before overlaying catalog data", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "party-brawler-deluxe",
            title: "Party Brawler Heroes - Deluxe Edition",
            price: { amount: 9_900, currency: "KRW" },
            regular: { amount: 22_000, currency: "KRW" },
            cut: 55,
            genres: [],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["일부 메타데이터를 생략했습니다."]
        };
      },
      async discoverTitles() {
        return [
          {
            title: "Party Brawler Heroes",
            genres: ["Action", "Casual", "Party"],
            platforms: ["PC"],
            tags: ["multiplayer", "co-op"],
            rating: 4.2,
            metacritic: 80,
            multiplayer: true
          }
        ];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "친구랑 같이 할 게임",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({
      title: "Party Brawler Heroes - Deluxe Edition",
      multiplayer: true,
      cut: 55,
      genres: expect.arrayContaining(["Action", "Casual", "Party"])
    });
  });

  it("does not revive non-multiplayer browse junk through the simple social overlay path", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async discoverTitles() {
        return [
          {
            title: "Cozy Story Grove",
            genres: ["Adventure", "Puzzle"],
            platforms: ["PC"],
            tags: ["story rich"],
            rating: 4.3,
            metacritic: 81,
            multiplayer: false
          }
        ];
      }
    }) as any;

    service.discoverDealsInternal = async () => ({
      matches: [
        {
          id: "cozy-story-grove",
          title: "Cozy Story Grove",
          price: { amount: 8_900, currency: "KRW" },
          regular: { amount: 17_800, currency: "KRW" },
          cut: 50,
          genres: [],
          platforms: ["PC"],
          multiplayer: false,
          metadataStatus: "missing"
        }
      ],
      summary: "조건에 맞는 할인 게임을 찾았습니다.",
      warnings: ["일부 메타데이터를 생략했습니다.", "가격 개요 정보가 없어 제목만 확인했습니다."]
    });

    const result = await service.recommendSaleGames({
      preferences: "친구랑 같이 할 게임",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches).toEqual([]);
  });

  it("does not keep non-multiplayer junk browse picks as final results for broader social prompts", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "deponia",
            title: "Deponia",
            price: { amount: 0, currency: "KRW" },
            regular: { amount: 12000, currency: "KRW" },
            cut: 100,
            genres: ["Indie", "Adventure", "RPG", "Puzzle"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 3.85,
            metacritic: 74,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["일부 메타데이터를 생략했습니다."]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "non-sweaty multiplayer sale for PC",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches).toEqual([]);
  });

  it("treats friend-gathering phrasing as social and does not keep non-social junk top picks", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "deponia",
            title: "Deponia",
            price: { amount: 9_900, currency: "KRW" },
            regular: { amount: 19_800, currency: "KRW" },
            cut: 50,
            genres: ["Indie", "Adventure", "Puzzle"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 3.85,
            metacritic: 74,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["일부 메타데이터를 생략했습니다."]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "친구 모임용으로 바로 설명 가능한 할인작",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches).toEqual([]);
  });

  it("does not keep party-sports outliers as top picks for strict party-hangout phrasing", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "racket-nx",
            title: "Racket: Nx",
            price: { amount: 10_500, currency: "KRW" },
            regular: { amount: 21_000, currency: "KRW" },
            cut: 50,
            genres: ["Indie", "Action", "Sports"],
            platforms: ["PC"],
            multiplayer: true,
            rating: 4.5,
            metacritic: 84,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["가격 개요 정보가 없어 제목만 확인했습니다."]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "party-friendly co-op on sale",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches).toEqual([]);
  });

  it("rescues strict generic-coop prompts from discounted multiplayer action browse candidates", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "arcade-link",
            title: "Arcade Link",
            price: { amount: 14_900, currency: "KRW" },
            regular: { amount: 29_800, currency: "KRW" },
            cut: 50,
            genres: ["Action"],
            platforms: ["PC"],
            multiplayer: true,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["일부 메타데이터를 생략했습니다.", "가격 개요 정보가 없어 제목만 확인했습니다."]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "non-sweaty multiplayer sale for PC",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Arcade Link", multiplayer: true, cut: 50 });
  });

  it("rescues strict party-hangout prompts from discounted multiplayer action browse candidates", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "couch-clash",
            title: "Couch Clash",
            price: { amount: 12_900, currency: "KRW" },
            regular: { amount: 25_800, currency: "KRW" },
            cut: 50,
            genres: ["Action"],
            platforms: ["PC"],
            multiplayer: true,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["일부 메타데이터를 생략했습니다.", "가격 개요 정보가 없어 제목만 확인했습니다."]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "party-friendly co-op on sale",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Couch Clash", multiplayer: true, cut: 50 });
  });

  it("reuses the same social rescue tier for mixed-language social prompts", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "duo-blitz",
            title: "Duo Blitz",
            price: { amount: 13_500, currency: "KRW" },
            regular: { amount: 27_000, currency: "KRW" },
            cut: 50,
            genres: ["Action"],
            platforms: ["PC"],
            multiplayer: true,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["일부 메타데이터를 생략했습니다.", "가격 개요 정보가 없어 제목만 확인했습니다."]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "friends-only fun bargain, not sports",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Duo Blitz", multiplayer: true, cut: 50 });
  });

  it("rescues structured generic-coop browse results from raw multiplayer action candidates when strict teamplay matches are absent", async () => {
    const service = new GameDealService({
      async findDeals(args) {
        if (args.genres?.[0] === "Action") {
          return [
            {
              id: "arcade-link",
              title: "Arcade Link",
              price: { amount: 14_900, currency: "KRW" },
              regular: { amount: 29_800, currency: "KRW" },
              cut: 50,
              genres: ["Action"],
              platforms: ["PC"],
              multiplayer: true,
              metadataStatus: "missing"
            }
          ];
        }

        return [];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["일부 메타데이터를 생략했습니다.", "가격 개요 정보가 없어 제목만 확인했습니다."]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "non-competitive multiplayer on sale",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Arcade Link", multiplayer: true, cut: 50 });
  });

  it("rescues structured party-hangout browse results from raw multiplayer action candidates when strict party matches are absent", async () => {
    const service = new GameDealService({
      async findDeals(args) {
        if (args.genres?.[0] === "Action") {
          return [
            {
              id: "couch-clash",
              title: "Couch Clash",
              price: { amount: 12_900, currency: "KRW" },
              regular: { amount: 25_800, currency: "KRW" },
              cut: 50,
              genres: ["Action"],
              platforms: ["PC"],
              multiplayer: true,
              metadataStatus: "missing"
            }
          ];
        }

        return [];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["일부 메타데이터를 생략했습니다.", "가격 개요 정보가 없어 제목만 확인했습니다."]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "party-friendly co-op on sale",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Couch Clash", multiplayer: true, cut: 50 });
  });

  it("reuses structured social rescue for budget-strict social phrasing", async () => {
    const service = new GameDealService({
      async findDeals(args) {
        if (args.genres?.[0] === "Action") {
          return [
            {
              id: "arcade-bash",
              title: "Arcade Bash",
              price: { amount: 14_900, currency: "KRW" },
              regular: { amount: 29_800, currency: "KRW" },
              cut: 50,
              genres: ["Action"],
              platforms: ["PC"],
              multiplayer: true,
              metadataStatus: "missing"
            }
          ];
        }

        return [];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["일부 메타데이터를 생략했습니다.", "가격 개요 정보가 없어 제목만 확인했습니다."]
        };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "15000원 이하 party game",
      budget: 15_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Arcade Bash", multiplayer: true, cut: 50 });
  });

  it("prefers generic teamplay browse candidates over party-sports picks for new social phrasing", async () => {
    const service = new GameDealService({
      async findDeals(args) {
        if (!args.genres || args.genres.length === 0) {
          return [];
        }

        if (args.genres[0] === "Action") {
          return [
            {
              id: "racket-nx",
              title: "Racket: Nx",
              price: { amount: 10_500, currency: "KRW" },
              regular: { amount: 21_000, currency: "KRW" },
              cut: 50,
              genres: ["Indie", "Action", "Sports"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.5,
              metacritic: 84,
              metadataStatus: "rawg"
            }
          ];
        }

        if (args.genres[0] === "Casual") {
          return [];
        }

        if (args.genres[0] === "Indie") {
          return [
            {
              id: "orbital-teamplay",
              title: "Orbital Teamplay Co-op",
              price: { amount: 14_900, currency: "KRW" },
              regular: { amount: 24_900, currency: "KRW" },
              cut: 40,
              genres: ["Indie", "Simulation"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.2,
              metacritic: 81,
              metadataStatus: "rawg"
            }
          ];
        }

        return [];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "teamplay 할인작인데 경쟁 냄새 적은 것",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Orbital Teamplay Co-op" });
  });

  it("prefers stronger party-hangout browse candidates over action-sports outliers", async () => {
    const service = new GameDealService({
      async findDeals(args) {
        if (!args.genres || args.genres.length === 0) {
          return [];
        }

        if (args.genres[0] === "Action") {
          return [
            {
              id: "racket-nx",
              title: "Racket: Nx",
              price: { amount: 10_500, currency: "KRW" },
              regular: { amount: 21_000, currency: "KRW" },
              cut: 50,
              genres: ["Indie", "Action", "Sports"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.5,
              metacritic: 84,
              metadataStatus: "rawg"
            }
          ];
        }

        if (args.genres[0] === "Casual") {
          return [
            {
              id: "party-brawler-heroes",
              title: "Party Brawler Heroes",
              price: { amount: 10_900, currency: "KRW" },
              regular: { amount: 21_900, currency: "KRW" },
              cut: 50,
              genres: ["Action", "Casual", "Party"],
              platforms: ["PC"],
              multiplayer: true,
              rating: 4.2,
              metacritic: 79,
              metadataStatus: "rawg"
            }
          ];
        }

        return [];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "hangout-friendly game deal for PC",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Party Brawler Heroes" });
  });

  it("uses the hybrid Steam Deck strategy roguelike sparse profile when both signals are present", async () => {
    let discoverCalls = 0;

    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "deck-strategy-rogue",
            title: "Deck Strategy Rogue",
            price: { amount: 15900, currency: "KRW" },
            regular: { amount: 31800, currency: "KRW" },
            cut: 50,
            genres: [],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing",
            steamDeckCompatibility: {
              status: "playable",
              details: [],
              source: "steam"
            }
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["Steam Deck 호환성 정보를 확인하지 못했습니다."]
        };
      },
      async discoverTitles(input) {
        discoverCalls += 1;
        expect(input.tags).toEqual(["roguelike", "roguelite"]);
        expect(input.genres).toEqual(["strategy"]);

        return [
          {
            title: "Deck Strategy Rogue",
            genres: ["Strategy", "Tactics", "Roguelike"],
            platforms: ["PC"],
            tags: ["roguelike"],
            rating: 4.3,
            metacritic: 82,
            multiplayer: false
          }
        ];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 할 만한 전략 로그라이크",
      budget: 20_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(discoverCalls).toBe(1);
    expect(result.matches[0]).toMatchObject({ title: "Deck Strategy Rogue" });
  });

  it("does not revive unsupported Steam Deck matches through matcher-based overlay", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "unsupported-deck-rogue",
            title: "Unsupported Deck Rogue",
            price: { amount: 8900, currency: "KRW" },
            regular: { amount: 17800, currency: "KRW" },
            cut: 50,
            genres: [],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing",
            steamDeckCompatibility: {
              status: "unsupported",
              details: [],
              source: "steam"
            }
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: ["Steam Deck 호환성 정보를 확인하지 못했습니다."]
        };
      },
      async discoverTitles() {
        return [
          {
            title: "Unsupported Deck Rogue",
            genres: ["Action", "Roguelike"],
            platforms: ["PC"],
            tags: ["roguelike"],
            rating: 4.2,
            metacritic: 80,
            multiplayer: false
          }
        ];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 하기 좋은 로그라이크",
      budget: 20_000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches).toEqual([]);
  });

  it("does not revive outage-time browse junk without usable prompt evidence", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "ai-games",
            title: "AI Games Collection",
            price: { amount: 4_900, currency: "KRW" },
            regular: { amount: 19_600, currency: "KRW" },
            cut: 75,
            genres: [],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return {
          deals,
          warnings: [
            "일부 메타데이터를 생략했습니다.",
            "ITAD request failed with 429",
            "가격 개요 정보를 가져오지 못해 일부 데이터만 표시합니다."
          ]
        };
      },
      async discoverTitles() {
        return [];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "teamplay 할인작인데 경쟁 냄새 적은 것",
      budget: 20_000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches).toEqual([]);
  });
});
