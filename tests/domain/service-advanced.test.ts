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
