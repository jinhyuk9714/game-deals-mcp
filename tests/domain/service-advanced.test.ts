import { describe, expect, it } from "vitest";

import { GameDealService } from "../../src/domain/service.js";

describe("GameDealService.compareGamePrice", () => {
  it("returns candidate choices when a title is ambiguous", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal() {
        return {
          kind: "ambiguous" as const,
          title: "Hades",
          candidates: [
            { id: "1", title: "Hades" },
            { id: "2", title: "Hades II" }
          ]
        };
      }
    });

    const result = await service.compareGamePrice({ title: "Hades", country: "KR" });

    expect(result.summary).toContain("여러 게임이 검색되었습니다");
    expect(result.matches).toEqual([
      { id: "1", title: "Hades" },
      { id: "2", title: "Hades II" }
    ]);
  });

  it("returns a friendly warning when title resolution fails", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal() {
        throw new Error("API keys are missing");
      }
    });

    const result = await service.compareGamePrice({ title: "Balatro", country: "KR" });

    expect(result.summary).toContain("가격 비교 정보를 가져오지 못했습니다");
    expect(result.warnings).toContain("API keys are missing");
  });
});

describe("GameDealService.discoverDeals", () => {
  it("requests Steam-only deals when the platform mentions Steam Deck", async () => {
    const service = new GameDealService({
      async findDeals(args) {
        expect(args.preferredShops).toEqual([61]);
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal() {
        return { kind: "not-found" as const, title: "" };
      }
    });

    await service.discoverDeals({
      country: "KR",
      budget: 20000,
      genres: ["Roguelike"],
      platforms: ["Steam Deck"],
      sort: "best-value"
    });
  });

  it("falls back to catalog candidates when filtered deal search comes back empty", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal(title) {
        if (title !== "Hades") {
          return { kind: "not-found" as const, title };
        }

        return {
          kind: "match" as const,
          title: "Hades",
          matches: [
            {
              id: "1",
              title: "Hades",
              price: { amount: 12600, currency: "KRW" },
              regular: { amount: 25000, currency: "KRW" },
              cut: 50,
              genres: ["Action", "Roguelike"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.8,
              metacritic: 93,
              metadataStatus: "rawg"
            }
          ]
        };
      },
      async discoverTitles() {
        return [
          {
            title: "Hades",
            released: "2020-09-17",
            genres: ["Action"],
            platforms: ["PC"],
            rating: 4.8,
            metacritic: 93,
            multiplayer: false
          }
        ];
      }
    });

    const result = await service.discoverDeals({
      country: "KR",
      budget: 20000,
      genres: ["Roguelike"],
      platforms: ["Steam Deck"],
      sort: "best-value"
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ title: "Hades" });
    expect(result.summary).toContain("Hades");
  });

  it("backfills catalog candidates when Steam-only deals return too few matches", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "1",
            title: "Shogun Showdown",
            price: { amount: 11080, currency: "KRW" },
            regular: { amount: 22175, currency: "KRW" },
            cut: 50,
            genres: ["Strategy", "Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.3,
            metacritic: null,
            metadataStatus: "rawg"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal(title) {
        if (title !== "Inscryption") {
          return { kind: "not-found" as const, title };
        }

        return {
          kind: "match" as const,
          title: "Inscryption",
          matches: [
            {
              id: "2",
              title: "Inscryption",
              price: { amount: 11820, currency: "KRW" },
              regular: { amount: 29571, currency: "KRW" },
              cut: 60,
              genres: ["Indie", "Strategy", "Adventure", "Roguelike"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.38,
              metacritic: 86,
              metadataStatus: "rawg"
            }
          ]
        };
      },
      async discoverTitles() {
        return [
          {
            title: "Inscryption",
            released: "2021-10-19",
            genres: ["Strategy", "Adventure"],
            platforms: ["PC"],
            rating: 4.38,
            metacritic: 86,
            multiplayer: false
          }
        ];
      }
    });

    const result = await service.discoverDeals({
      country: "KR",
      budget: 20000,
      genres: ["Roguelike"],
      platforms: ["Steam Deck"],
      sort: "best-value"
    });

    expect(result.matches).toHaveLength(2);
    expect(result.matches.map((match) => (match as { title: string }).title)).toContain("Inscryption");
  });

  it("filters out unsupported Steam Deck titles and keeps unknown ones only when results are sparse", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "1",
            title: "Verified Deck Game",
            price: { amount: 12000, currency: "KRW" },
            regular: { amount: 24000, currency: "KRW" },
            cut: 50,
            genres: ["Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.7,
            metacritic: 88,
            steamDeckCompatibility: {
              status: "verified",
              details: ["Interface text is legible"],
              steamAppId: 100,
              source: "steam"
            }
          },
          {
            id: "2",
            title: "Unknown Deck Game",
            price: { amount: 11000, currency: "KRW" },
            regular: { amount: 22000, currency: "KRW" },
            cut: 50,
            genres: ["Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.5,
            metacritic: 84,
            steamDeckCompatibility: {
              status: "unknown",
              details: [],
              source: "steam"
            }
          },
          {
            id: "3",
            title: "Unsupported Deck Game",
            price: { amount: 9000, currency: "KRW" },
            regular: { amount: 18000, currency: "KRW" },
            cut: 50,
            genres: ["Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.8,
            metacritic: 90,
            steamDeckCompatibility: {
              status: "unsupported",
              details: [],
              steamAppId: 300,
              source: "steam"
            }
          }
        ];
      },
      async enrichDeals(deals) {
        return { deals, warnings: ["Steam Deck 호환성 정보를 확인하지 못했습니다."] };
      },
      async resolveDeal() {
        return { kind: "not-found" as const, title: "" };
      }
    });

    const result = await service.discoverDeals({
      country: "KR",
      budget: 20000,
      genres: ["Roguelike"],
      platforms: ["Steam Deck"],
      sort: "best-value"
    });

    expect(result.matches.map((match) => (match as { title: string }).title)).toEqual([
      "Verified Deck Game",
      "Unknown Deck Game"
    ]);
    expect(result.summary).toContain("Steam Deck Verified");
    expect(result.summary).toContain("Steam Deck 정보 없음");
    expect(result.warnings).not.toContain("Steam Deck 호환성은 현재 PC 플랫폼 기준으로 근사해 추천합니다.");
  });
});

describe("GameDealService.recommendSaleGames", () => {
  it("filters excluded genres and explains why the remaining game fits", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "1",
            title: "Co-op Deckbuilder",
            price: { amount: 18000, currency: "KRW" },
            regular: { amount: 36000, currency: "KRW" },
            cut: 50,
            genres: ["Strategy", "Roguelike"],
            platforms: ["PC", "Steam Deck"],
            multiplayer: true,
            rating: 4.7,
            metacritic: 86
          },
          {
            id: "2",
            title: "Puzzle Game",
            price: { amount: 15000, currency: "KRW" },
            regular: { amount: 30000, currency: "KRW" },
            cut: 50,
            genres: ["Puzzle"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.3,
            metacritic: 74
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
      preferences: "협동 로그라이크",
      budget: 20000,
      excludeGenres: ["Puzzle"],
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches).toHaveLength(1);
    expect(result.summary).toContain("Co-op Deckbuilder");
    expect(result.summary).toContain("협동");
  });

  it("parses structured preferences like steam deck roguelikes before ranking", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "1",
            title: "Deckbuilder Roguelike",
            price: { amount: 18000, currency: "KRW" },
            regular: { amount: 36000, currency: "KRW" },
            cut: 50,
            genres: ["Roguelike", "Strategy"],
            platforms: ["PC", "Steam Deck"],
            multiplayer: false,
            rating: 4.8,
            metacritic: 88
          },
          {
            id: "2",
            title: "Desktop Puzzle",
            price: { amount: 9000, currency: "KRW" },
            regular: { amount: 18000, currency: "KRW" },
            cut: 50,
            genres: ["Puzzle"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.1,
            metacritic: 72
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
      preferences: "스팀덱용 로그라이크",
      budget: 20000,
      country: "KR"
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ title: "Deckbuilder Roguelike" });
    expect(result.summary).toContain("Deckbuilder Roguelike");
    expect(result.summary).toContain("Steam Deck");
  });

  it("falls back to catalog candidate discovery when broad deal search is empty", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal(title) {
        if (title !== "Hades") {
          return { kind: "not-found" as const, title };
        }

        return {
          kind: "match" as const,
          title: "Hades",
          matches: [
            {
              id: "1",
              title: "Hades",
              price: { amount: 12600, currency: "KRW" },
              regular: { amount: 25000, currency: "KRW" },
              cut: 50,
              genres: ["Action", "Roguelike"],
              platforms: ["PC", "Steam Deck"],
              multiplayer: false,
              rating: 4.8,
              metacritic: 93,
              metadataStatus: "rawg"
            }
          ]
        };
      },
      async discoverTitles() {
        return [
          {
            title: "Hades",
            released: "2020-09-17",
            genres: ["Action", "Roguelike"],
            platforms: ["PC", "Steam Deck"],
            rating: 4.8,
            metacritic: 93,
            multiplayer: false
          }
        ];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱용 로그라이크",
      budget: 20000,
      country: "KR"
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ title: "Hades" });
    expect(result.summary).toContain("Hades");
  });

  it("prefers catalog-first Steam sale candidates over broad deal noise", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "noise-1",
            title: "Cheap Unknown",
            price: { amount: 1200, currency: "KRW" },
            regular: { amount: 12000, currency: "KRW" },
            cut: 90,
            genres: ["Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: null,
            metacritic: null,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal(title, _country, options) {
        expect(options?.preferredShops).toEqual([61]);

        if (title !== "Inscryption") {
          return { kind: "not-found" as const, title };
        }

        return {
          kind: "match" as const,
          title: "Inscryption",
          matches: [
            {
              id: "inscryption",
              title: "Inscryption",
              price: { amount: 11820, currency: "KRW" },
              regular: { amount: 29571, currency: "KRW" },
              cut: 60,
              genres: ["Indie", "Strategy", "Adventure", "Roguelike"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.38,
              metacritic: 86,
              historyLow: { amount: 6600, currency: "KRW" },
              metadataStatus: "rawg"
            }
          ]
        };
      },
      async discoverTitles() {
        return [
          {
            title: "Inscryption",
            released: "2021-10-19",
            genres: ["Strategy", "Adventure"],
            platforms: ["PC"],
            rating: 4.38,
            metacritic: 86,
            multiplayer: false
          }
        ];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱용 로그라이크",
      budget: 20000,
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Inscryption" });
  });

  it("filters junk sale titles before choosing the top recommendation", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "junk-1",
            title: "Just Move:Clean City Messy Battle",
            price: { amount: 870, currency: "KRW" },
            regular: { amount: 17400, currency: "KRW" },
            cut: 95,
            genres: ["Action"],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing"
          },
          {
            id: "real-1",
            title: "Deckbuilder Roguelike",
            price: { amount: 11820, currency: "KRW" },
            regular: { amount: 29571, currency: "KRW" },
            cut: 60,
            genres: ["Roguelike", "Strategy"],
            platforms: ["PC", "Steam Deck"],
            multiplayer: false,
            rating: 4.8,
            metacritic: 88,
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
      preferences: "짧게 하기 좋은 덱빌딩 게임",
      budget: 15000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Deckbuilder Roguelike" });
    expect(result.summary).toContain("Deckbuilder Roguelike");
  });

  it("prefers card or deck grounded candidates for deckbuilding recommendations", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "generic-strategy",
            title: "Strategy Roguelike Deluxe",
            price: { amount: 7900, currency: "KRW" },
            regular: { amount: 15800, currency: "KRW" },
            cut: 50,
            genres: ["Strategy", "Roguelike"],
            platforms: ["PC", "Steam Deck"],
            multiplayer: false,
            rating: 4.9,
            metacritic: 90,
            metadataStatus: "rawg"
          },
          {
            id: "real-deckbuilder",
            title: "Card Deckbuilder Expedition",
            price: { amount: 11800, currency: "KRW" },
            regular: { amount: 23600, currency: "KRW" },
            cut: 50,
            genres: ["Strategy", "Roguelike"],
            platforms: ["PC", "Steam Deck"],
            multiplayer: false,
            rating: 4.4,
            metacritic: 82,
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
      preferences: "짧게 하기 좋은 덱빌딩 할인 게임",
      budget: 15000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Card Deckbuilder Expedition" });
    expect(result.summary).toContain("Card Deckbuilder Expedition");
  });

  it("requires multi-genre intent matches for action roguelite recommendations", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "action-only",
            title: "Trailblazers",
            price: { amount: 1763, currency: "KRW" },
            regular: { amount: 44080, currency: "KRW" },
            cut: 96,
            genres: ["Action"],
            platforms: ["PC"],
            multiplayer: true,
            rating: 3.17,
            metadataStatus: "rawg"
          },
          {
            id: "action-roguelite",
            title: "Action Roguelite Hero",
            price: { amount: 8900, currency: "KRW" },
            regular: { amount: 17800, currency: "KRW" },
            cut: 50,
            genres: ["Action", "Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.2,
            metacritic: 80,
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
      preferences: "가볍게 즐길 액션 로그라이트 추천해줘",
      budget: 15000,
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Action Roguelite Hero" });
    expect(result.matches.map((match) => (match as { title: string }).title)).toEqual([
      "Action Roguelite Hero"
    ]);
  });

  it("returns fewer-but-better results for high-rating strategy requests", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "thin-strategy-1",
            title: "Budget Strategy One",
            price: { amount: 3900, currency: "KRW" },
            regular: { amount: 39000, currency: "KRW" },
            cut: 90,
            genres: ["Strategy"],
            platforms: ["PC", "Steam Deck"],
            multiplayer: false,
            rating: null,
            metacritic: null,
            metadataStatus: "missing"
          },
          {
            id: "thin-strategy-2",
            title: "Budget Strategy Two",
            price: { amount: 5200, currency: "KRW" },
            regular: { amount: 26000, currency: "KRW" },
            cut: 80,
            genres: ["Strategy"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 2.8,
            metacritic: 54,
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
      preferences: "평가 좋은 전략 할인 게임 추천해줘",
      budget: 10000,
      country: "KR"
    });

    expect(result.matches).toHaveLength(0);
    expect(result.summary).toContain("조건에 맞는 추천 할인 게임을 찾지 못했습니다.");
  });

  it("limits catalog resolution fan-out for Steam-first recommendations", async () => {
    let resolveCount = 0;

    const service = new GameDealService({
      async findDeals() {
        return [];
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
              price: { amount: 9000, currency: "KRW" },
              regular: { amount: 18000, currency: "KRW" },
              cut: 50,
              genres: ["Roguelike", "Strategy"],
              platforms: ["PC", "Steam Deck"],
              multiplayer: false,
              rating: 4.0,
              metacritic: 80,
              metadataStatus: "rawg"
            }
          ]
        };
      },
      async discoverTitles() {
        return Array.from({ length: 12 }, (_, index) => ({
          title: `Candidate ${index + 1}`,
          released: "2024-01-01",
          genres: ["Roguelike", "Strategy"],
          platforms: ["PC", "Steam Deck"],
          rating: 4.0,
          metacritic: 80,
          multiplayer: false
        }));
      }
    });

    await service.recommendSaleGames({
      preferences: "스팀덱용 로그라이크",
      budget: 20000,
      country: "KR"
    });

    expect(resolveCount).toBe(8);
  });

  it("deduplicates already compacted Steam Deck warnings in recommendation results", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "1",
            title: "Deck Verified Pick",
            price: { amount: 14000, currency: "KRW" },
            regular: { amount: 28000, currency: "KRW" },
            cut: 50,
            genres: ["Roguelike"],
            platforms: ["PC", "Steam Deck"],
            multiplayer: false,
            rating: 4.6,
            metacritic: 85,
            metadataStatus: "rawg",
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
            "RAWG 보강 한도 때문에 일부 메타데이터를 생략했습니다.",
            "Steam Deck 호환성 정보를 확인하지 못했습니다.",
            "Steam Deck 호환성 보강 한도 때문에 일부 정보를 생략했습니다.",
            "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
          ]
        };
      },
      async resolveDeal() {
        return { kind: "not-found" as const, title: "" };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱용 로그라이크 추천해줘",
      budget: 20000,
      country: "KR"
    });

    expect(result.warnings).toEqual([
      "일부 메타데이터를 생략했습니다.",
      "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
    ]);
  });
});

describe("GameDealService.warning compaction", () => {
  it("compacts noisy success warnings down to short summary warnings", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "1",
            title: "Deck Verified Pick",
            price: { amount: 14000, currency: "KRW" },
            regular: { amount: 28000, currency: "KRW" },
            cut: 50,
            genres: ["Roguelike"],
            platforms: ["PC", "Steam Deck"],
            multiplayer: false,
            rating: 4.6,
            metacritic: 85,
            metadataStatus: "rawg",
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
            "RAWG 보강 한도 때문에 일부 메타데이터를 생략했습니다.",
            "Steam Deck 호환성 정보를 확인하지 못했습니다.",
            "Steam Deck 호환성 보강 한도 때문에 일부 정보를 생략했습니다.",
            "Steam Deck 호환성 정보를 확인하지 못했습니다.",
            "지정한 상점 범위에서 현재 할인 가격을 찾지 못했습니다."
          ]
        };
      },
      async resolveDeal() {
        return { kind: "not-found" as const, title: "" };
      }
    });

    const result = await service.discoverDeals({
      country: "KR",
      budget: 20000,
      genres: ["Roguelike"],
      platforms: ["Steam Deck"],
      sort: "best-value"
    });

    expect(result.matches).toHaveLength(1);
    expect(result.warnings).toEqual([
      "일부 메타데이터를 생략했습니다.",
      "Steam Deck 호환성 정보를 일부 확인하지 못했습니다."
    ]);
  });
});

describe("GameDealService.explainDealValue", () => {
  it("describes when the current deal is near the historical low", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal() {
        return {
          kind: "match" as const,
          title: "Balatro",
          matches: [
            {
              id: "1",
              title: "Balatro",
              price: { amount: 12000, currency: "KRW" },
              regular: { amount: 17000, currency: "KRW" },
              cut: 29,
              genres: ["Strategy"],
              platforms: ["PC", "Steam Deck"],
              multiplayer: false,
              rating: 4.8,
              metacritic: 90,
              historyLow: { amount: 11000, currency: "KRW" }
            }
          ]
        };
      }
    });

    const result = await service.explainDealValue({ title: "Balatro", country: "KR" });

    expect(result.summary).toContain("역대 최저가에 근접");
    expect(result.summary).toContain("12,000원");
  });
});
