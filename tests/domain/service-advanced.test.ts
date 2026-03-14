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
  it("demotes free or ultra-cheap filler below reviewed RPG picks for broad best-value browse queries", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "free-rpg",
            title: "Deponia",
            price: { amount: 0, currency: "KRW" },
            regular: { amount: 22000, currency: "KRW" },
            cut: 100,
            genres: ["Indie", "Adventure", "RPG", "Puzzle"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 3.85,
            metacritic: 74,
            metadataStatus: "rawg"
          },
          {
            id: "low-quality-rpg",
            title: "The Book of Legends",
            price: { amount: 881, currency: "KRW" },
            regular: { amount: 22000, currency: "KRW" },
            cut: 96,
            genres: ["Indie", "Adventure", "RPG"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 2,
            metacritic: null,
            metadataStatus: "rawg"
          },
          {
            id: "representative-rpg",
            title: "Chained Echoes",
            price: { amount: 15400, currency: "KRW" },
            regular: { amount: 22000, currency: "KRW" },
            cut: 30,
            genres: ["RPG", "Indie"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.2,
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

    const result = await service.discoverDeals({
      country: "KR",
      budget: 25000,
      genres: ["RPG"],
      platforms: ["PC"],
      sort: "best-value"
    });

    expect(result.matches[0]).toMatchObject({ title: "Chained Echoes" });
    expect(result.matches[0]).not.toMatchObject({ title: "Deponia" });
  });

  it("prefers reviewed Steam Deck compatible bargains over unknown metadata fillers in cheap browse queries", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "free-steam-deck",
            title: "Deponia",
            price: { amount: 0, currency: "KRW" },
            regular: { amount: 22000, currency: "KRW" },
            cut: 100,
            genres: ["Adventure", "RPG"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 3.85,
            metacritic: 74,
            metadataStatus: "rawg",
            steamDeckCompatibility: {
              status: "unknown",
              details: [],
              source: "steam"
            }
          },
          {
            id: "filler-one",
            title: "Abduction Bit",
            price: { amount: 550, currency: "KRW" },
            regular: { amount: 1100, currency: "KRW" },
            cut: 50,
            genres: ["Action"],
            platforms: ["PC"],
            multiplayer: true,
            rating: 0,
            metacritic: null,
            metadataStatus: "missing",
            steamDeckCompatibility: {
              status: "unknown",
              details: [],
              source: "steam"
            }
          },
          {
            id: "verified-bargain",
            title: "Verified Bargain",
            price: { amount: 4400, currency: "KRW" },
            regular: { amount: 22000, currency: "KRW" },
            cut: 80,
            genres: ["Action", "Indie"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.2,
            metacritic: 80,
            metadataStatus: "rawg",
            steamDeckCompatibility: {
              status: "verified",
              details: ["Runs well on Steam Deck"],
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

    const result = await service.discoverDeals({
      country: "KR",
      budget: 8000,
      platforms: ["Steam Deck"],
      sort: "lowest-price"
    });

    expect(result.matches[0]).toMatchObject({ title: "Verified Bargain" });
    expect(result.matches.slice(0, 3).map((match) => (match as { title: string }).title)).toEqual(
      expect.arrayContaining(["Verified Bargain"])
    );
  });

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
            tags: ["Roguelike", "Deckbuilder"],
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

  it("recovers Steam Deck roguelike discovery results from broader Steam sale titles when strict search is empty", async () => {
    const findDealsCalls: Array<{
      genres: string[] | undefined;
      preferredShops: number[] | undefined;
    }> = [];
    const resolvedTitles: string[] = [];
    let discoverTitleCalls = 0;

    const service = new GameDealService({
      async findDeals(args) {
        findDealsCalls.push({
          genres: args.genres,
          preferredShops: args.preferredShops
        });

        if (args.genres?.includes("Roguelike")) {
          return [];
        }

        return [
          {
            id: "broad-sale",
            title: "The King is Watching",
            price: { amount: 9680, currency: "KRW" },
            regular: { amount: 14900, currency: "KRW" },
            cut: 35,
            genres: [],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing"
          },
          {
            id: "noise-sale",
            title: "Cheap Non-Roguelike",
            price: { amount: 3900, currency: "KRW" },
            regular: { amount: 7800, currency: "KRW" },
            cut: 50,
            genres: [],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal(title) {
        resolvedTitles.push(title);

        if (title !== "The King is Watching") {
          return { kind: "not-found" as const, title };
        }

        return {
          kind: "match" as const,
          title: "The King is Watching",
          matches: [
            {
              id: "the-king-is-watching",
              title: "The King is Watching",
              price: { amount: 9680, currency: "KRW" },
              regular: { amount: 14900, currency: "KRW" },
              cut: 35,
              genres: ["Strategy", "Indie", "Roguelike"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.36,
              metacritic: null,
              steamDeckCompatibility: {
                status: "playable",
                details: ["Works on Steam Deck"],
                steamAppId: 2753900,
                source: "steam"
              },
              metadataStatus: "rawg"
            }
          ]
        };
      },
      async discoverTitles() {
        discoverTitleCalls += 1;

        if (discoverTitleCalls === 1) {
          return [];
        }

        return [
          {
            title: "Hades",
            released: "2020-09-17",
            genres: ["Action", "RPG"],
            platforms: ["PC"],
            tags: ["Roguelike", "Roguelite"],
            rating: 4.42,
            metacritic: 93,
            multiplayer: false
          },
          {
            title: "The King is Watching",
            released: "2025-07-21",
            genres: ["Strategy", "Indie"],
            platforms: ["PC"],
            tags: ["Roguelike", "Roguelite"],
            rating: 4.36,
            metacritic: null,
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
    expect(result.matches[0]).toMatchObject({ title: "The King is Watching" });
    expect(findDealsCalls).toEqual([
      { genres: ["Roguelike"], preferredShops: [61] },
      { genres: undefined, preferredShops: [61] }
    ]);
    expect(discoverTitleCalls).toBe(3);
    expect(resolvedTitles).toEqual([
      "Hades",
      "The King is Watching",
      "Hades",
      "The King is Watching"
    ]);
  });
});

describe("GameDealService.recommendSaleGames", () => {
  it("prefers broad co-op crowd-pleasers over racing or sports outliers", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "trailblazers",
            title: "Trailblazers",
            price: { amount: 1776, currency: "KRW" },
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
            genres: ["Action", "Casual", "Indie"],
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
      },
      async resolveDeal() {
        return { kind: "not-found" as const, title: "" };
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "친구랑 같이 켜서 놀기 좋은 할인 게임 뭐 있어?",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Party Brawler Heroes" });
  });

  it("demotes obscure high-rating strategy picks below stronger reviewed strategy candidates", async () => {
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
            id: "known-strategy",
            title: "Into the Breach",
            price: { amount: 5420, currency: "KRW" },
            regular: { amount: 15500, currency: "KRW" },
            cut: 65,
            genres: ["Strategy", "Indie", "Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.2,
            metacritic: 89,
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
      preferences: "리뷰 괜찮은 전략 세일겜, 너무 마이너한 건 말고",
      budget: 25000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Into the Breach" });
  });

  it("rejects Steam Deck matches without official compatibility evidence even when other filters fit", async () => {
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

    expect(result.matches).toHaveLength(0);
    expect(result.summary).toContain("추천 할인 게임을 찾지 못했습니다");
  });

  it("rejects Steam Deck roguelikes without verified or playable evidence", async () => {
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

    expect(result.matches).toHaveLength(0);
    expect(result.summary).toContain("추천 할인 게임을 찾지 못했습니다");
  });

  it("does not surface catalog fallback for Steam Deck when official deck evidence is missing", async () => {
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

    expect(result.matches).toHaveLength(0);
    expect(result.summary).toContain("추천 할인 게임을 찾지 못했습니다");
  });

  it("keeps Steam catalog candidates out when deck evidence is missing", async () => {
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
            tags: ["Roguelike", "Deckbuilder"],
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

    expect(result.matches).toHaveLength(0);
    expect(result.summary).toContain("추천 할인 게임을 찾지 못했습니다");
  });

  it("still rejects Steam Deck deckbuilding picks without official deck evidence after junk filtering", async () => {
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

    expect(result.matches).toHaveLength(0);
    expect(result.summary).toContain("추천 할인 게임을 찾지 못했습니다");
  });

  it("rejects Steam Deck deckbuilding recommendations without official compatibility evidence", async () => {
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

    expect(result.matches).toHaveLength(0);
    expect(result.summary).toContain("추천 할인 게임을 찾지 못했습니다");
  });

  it("recovers non-Steam deckbuilding requests from catalog candidates with deckbuilder tags", async () => {
    const resolveOptions: Array<unknown> = [];

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal(title, _country, options) {
        resolveOptions.push(options ?? null);

        if (title !== "Monster Train") {
          return { kind: "not-found" as const, title };
        }

        return {
          kind: "match" as const,
          title: "Monster Train",
          matches: [
            {
              id: "monster-train",
              title: "Monster Train",
              price: { amount: 9150, currency: "KRW" },
              regular: { amount: 30500, currency: "KRW" },
              cut: 70,
              genres: ["Strategy", "Roguelike"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.4,
              metacritic: 86,
              metadataStatus: "rawg"
            }
          ]
        };
      },
      async discoverTitles(input) {
        if (!input.tags?.includes("roguelike-deckbuilder")) {
          return [];
        }

        return [
          {
            title: "Monster Train",
            released: "2020-05-21",
            genres: ["Strategy", "Roguelike"],
            platforms: ["PC"],
            rating: 4.4,
            metacritic: 86,
            multiplayer: false,
            tags: ["Roguelike", "Roguelike-Deckbuilder", "Card Battler"]
          }
        ];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "짧게 하기 좋은 덱빌딩 할인 게임",
      budget: 15000,
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Monster Train" });
    expect(result.summary).toContain("Monster Train");
    expect(resolveOptions).toContainEqual(expect.not.objectContaining({ dealsOnly: true }));
  });

  it("retries deckbuilding recovery with broader catalog signals when the strict query is empty", async () => {
    const discoverCalls: Array<{ tags: string[] | undefined; genres: string[] | undefined }> = [];

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal(title) {
        if (title !== "Slay the Spire") {
          return { kind: "not-found" as const, title };
        }

        return {
          kind: "match" as const,
          title: "Slay the Spire",
          matches: [
            {
              id: "slay-the-spire",
              title: "Slay the Spire",
              price: { amount: 6750, currency: "KRW" },
              regular: { amount: 27000, currency: "KRW" },
              cut: 75,
              genres: ["Strategy", "Card"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.7,
              metacritic: 89,
              steamDeckCompatibility: {
                status: "playable",
                details: ["Runs well on Steam Deck"],
                steamAppId: 646570,
                source: "steam"
              },
              metadataStatus: "rawg"
            }
          ]
        };
      },
      async discoverTitles(input) {
        discoverCalls.push({ tags: input.tags, genres: input.genres });

        if (
          input.tags?.includes("roguelike-deckbuilder") &&
          input.genres?.includes("card")
        ) {
          return [];
        }

        if (input.tags?.includes("roguelike-deckbuilder")) {
          return [
            {
              title: "Slay the Spire",
              released: "2019-01-23",
              genres: ["Strategy", "Card"],
              platforms: ["PC"],
              tags: ["Singleplayer", "Deckbuilder"],
              rating: 4.7,
              metacritic: 89,
              multiplayer: false
            }
          ];
        }

        return [];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "짧게 하기 좋은 덱빌딩 게임",
      budget: 15000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ title: "Slay the Spire" });
    expect(discoverCalls).toEqual(
      expect.arrayContaining([
        { tags: ["roguelike-deckbuilder"], genres: ["card"] },
        { tags: ["roguelike-deckbuilder"], genres: [] }
      ])
    );
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

  it("recovers non-Steam action roguelite requests from catalog candidates", async () => {
    const resolveOptions: Array<unknown> = [];

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
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal(title, _country, options) {
        resolveOptions.push(options ?? null);

        if (title !== "Warm Snow") {
          return { kind: "not-found" as const, title };
        }

        return {
          kind: "match" as const,
          title: "Warm Snow",
          matches: [
            {
              id: "warm-snow",
              title: "Warm Snow",
              price: { amount: 14000, currency: "KRW" },
              regular: { amount: 20000, currency: "KRW" },
              cut: 30,
              genres: ["Action", "Roguelike"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.3,
              metacritic: 79,
              metadataStatus: "rawg"
            }
          ]
        };
      },
      async discoverTitles() {
        return [
          {
            title: "Warm Snow",
            released: "2022-01-19",
            genres: ["Action"],
            platforms: ["PC"],
            rating: 4.3,
            metacritic: 79,
            multiplayer: false,
            tags: ["Roguelike", "Action"]
          }
        ];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "가볍게 즐길 액션 로그라이트 추천해줘",
      budget: 18000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Warm Snow" });
    expect(result.matches.map((match) => (match as { title: string }).title)).toEqual(["Warm Snow"]);
    expect(resolveOptions).toContainEqual(expect.not.objectContaining({ dealsOnly: true }));
  });

  it("recovers Steam Deck roguelike recommendations from catalog candidates when no sale-title recovery path exists", async () => {
    let discoverCallCount = 0;

    const service = new GameDealService({
      async findDeals() {
        return [];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal(title) {
        if (title !== "The King is Watching") {
          return { kind: "not-found" as const, title };
        }

        return {
          kind: "match" as const,
          title: "The King is Watching",
          matches: [
            {
              id: "the-king-is-watching",
              title: "The King is Watching",
              price: { amount: 9680, currency: "KRW" },
              regular: { amount: 14892, currency: "KRW" },
              cut: 35,
              genres: ["Strategy"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.36,
              metacritic: null,
              steamDeckCompatibility: {
                status: "playable",
                details: ["Works on Steam Deck"],
                steamAppId: 2753900,
                source: "steam"
              },
              metadataStatus: "rawg"
            }
          ]
        };
      },
      async discoverTitles() {
        discoverCallCount += 1;

        return [
          {
            title: "The King is Watching",
            released: "2025-07-21",
            genres: ["Strategy"],
            platforms: ["PC"],
            tags: ["Roguelike", "Singleplayer"],
            rating: 4.36,
            metacritic: null,
            multiplayer: false
          }
        ];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 하기 좋은 로그라이크/로그라이트 위주",
      budget: 20000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ title: "The King is Watching" });
    expect(discoverCallCount).toBe(1);
  });

  it("does not start warning-triggered Steam Deck metadata recovery when metadata warnings are absent", async () => {
    let discoverCallCount = 0;

    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "deck-runner",
            title: "Deck Runner",
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
        return deals;
      },
      async discoverTitles() {
        discoverCallCount += 1;
        return [
          {
            title: "Deck Runner",
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

    expect(discoverCallCount).toBe(0);
    expect(result.matches).toEqual([]);
  });

  it("recovers generic Steam Deck roguelike recommendations from broader Steam deals when strict genre search is empty", async () => {
    const findDealsCalls: Array<{
      genres: string[] | undefined;
      preferredShops: number[] | undefined;
    }> = [];
    const resolvedTitles: string[] = [];
    let discoverTitleCalls = 0;

    const service = new GameDealService({
      async findDeals(args) {
        findDealsCalls.push({
          genres: args.genres,
          preferredShops: args.preferredShops
        });

        if (args.genres?.includes("Roguelike")) {
          return [];
        }

        return [
          {
            id: "broad-sale",
            title: "The King is Watching",
            price: { amount: 9680, currency: "KRW" },
            regular: { amount: 14900, currency: "KRW" },
            cut: 35,
            genres: [],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing"
          },
          {
            id: "broad-noise",
            title: "Cheap Non-Roguelike",
            price: { amount: 3900, currency: "KRW" },
            regular: { amount: 7800, currency: "KRW" },
            cut: 50,
            genres: [],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal(title) {
        resolvedTitles.push(title);

        if (title !== "The King is Watching") {
          return { kind: "not-found" as const, title };
        }

        return {
          kind: "match" as const,
          title: "The King is Watching",
          matches: [
            {
              id: "the-king-is-watching",
              title: "The King is Watching",
              price: { amount: 9680, currency: "KRW" },
              regular: { amount: 14900, currency: "KRW" },
              cut: 35,
              genres: ["Strategy", "Indie", "Roguelike"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.36,
              metacritic: null,
              steamDeckCompatibility: {
                status: "playable",
                details: ["Works on Steam Deck"],
                steamAppId: 2753900,
                source: "steam"
              },
              metadataStatus: "rawg"
            }
          ]
        };
      },
      async discoverTitles() {
        discoverTitleCalls += 1;

        if (discoverTitleCalls === 1) {
          return [];
        }

        return [
          {
            title: "Hades",
            released: "2020-09-17",
            genres: ["Action", "RPG"],
            platforms: ["PC"],
            tags: ["Roguelike", "Roguelite"],
            rating: 4.42,
            metacritic: 93,
            multiplayer: false
          },
          {
            title: "The King is Watching",
            released: "2025-07-21",
            genres: ["Strategy", "Indie"],
            platforms: ["PC"],
            tags: ["Roguelike", "Roguelite", "deckbuilding"],
            rating: 4.36,
            metacritic: null,
            multiplayer: false
          }
        ];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 하기 좋은 로그라이크/로그라이트 위주",
      budget: 20000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ title: "The King is Watching" });
    expect(findDealsCalls).toEqual([
      { genres: ["Roguelike"], preferredShops: [61] }
    ]);
    expect(discoverTitleCalls).toBe(2);
    expect(resolvedTitles).toEqual(["Hades", "The King is Watching"]);
  });

  it("keeps Steam Deck roguelike recovery alive when one catalog resolution fails", async () => {
    const resolvedTitles: string[] = [];

    const service = new GameDealService({
      async findDeals(args) {
        if (args.genres?.includes("Roguelike")) {
          return [];
        }

        return [
          {
            id: "broad-sale",
            title: "Broken Candidate",
            price: { amount: 8700, currency: "KRW" },
            regular: { amount: 14500, currency: "KRW" },
            cut: 40,
            genres: [],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing"
          },
          {
            id: "broad-sale-2",
            title: "The King is Watching",
            price: { amount: 9680, currency: "KRW" },
            regular: { amount: 14900, currency: "KRW" },
            cut: 35,
            genres: [],
            platforms: ["PC"],
            multiplayer: false,
            metadataStatus: "missing"
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal(title) {
        resolvedTitles.push(title);

        if (title === "Broken Candidate") {
          throw new Error("temporary upstream failure");
        }

        if (title !== "The King is Watching") {
          return { kind: "not-found" as const, title };
        }

        return {
          kind: "match" as const,
          title: "The King is Watching",
          matches: [
            {
              id: "the-king-is-watching",
              title: "The King is Watching",
              price: { amount: 9680, currency: "KRW" },
              regular: { amount: 14900, currency: "KRW" },
              cut: 35,
              genres: ["Strategy", "Indie", "Roguelike"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.36,
              metacritic: null,
              steamDeckCompatibility: {
                status: "playable",
                details: ["Works on Steam Deck"],
                steamAppId: 2753900,
                source: "steam"
              },
              metadataStatus: "rawg"
            }
          ]
        };
      },
      async discoverTitles() {
        return [
          {
            title: "Broken Candidate",
            released: "2025-01-01",
            genres: ["Strategy"],
            platforms: ["PC"],
            tags: ["Roguelike", "Roguelite"],
            rating: 4.1,
            metacritic: 80,
            multiplayer: false
          },
          {
            title: "The King is Watching",
            released: "2025-07-21",
            genres: ["Strategy", "Indie"],
            platforms: ["PC"],
            tags: ["Roguelike", "Roguelite"],
            rating: 4.36,
            metacritic: null,
            multiplayer: false
          }
        ];
      }
    });

    const result = await service.recommendSaleGames({
      preferences: "스팀덱에서 하기 좋은 로그라이크/로그라이트 위주",
      budget: 20000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ title: "The King is Watching" });
    expect(resolvedTitles).toEqual(["Broken Candidate", "The King is Watching"]);
  });

  it("returns fewer-but-better results for high-rating strategy requests", async () => {
    const highRatingService = new GameDealService({
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

    const result = await highRatingService.recommendSaleGames({
      preferences: "평가 좋은 전략 할인 게임 추천해줘",
      budget: 10000,
      country: "KR"
    });

    expect(result.matches).toHaveLength(0);
    expect(result.summary).toContain("조건에 맞는 추천 할인 게임을 찾지 못했습니다.");
    expect(result.emptyReason).toBe("missing-review-evidence");
    expect(result.summary).toContain("RAWG 장르·평점 근거");
    expect(result.missingEvidence).toContain("RAWG 장르·평점 근거");
  });

  it("caps sparse Steam roguelike catalog resolution fan-out once enough matches are found", async () => {
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

    expect(resolveCount).toBe(1);
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

describe("GameDealService.recommendSaleGames evidence-first contracts", () => {
  it("adds structured evidence to accepted recommendation matches", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "1",
            title: "Reviewed Tactics Reserve",
            price: { amount: 15900, currency: "KRW" },
            regular: { amount: 31800, currency: "KRW" },
            cut: 50,
            genres: ["Strategy", "Tactics"],
            platforms: ["PC"],
            multiplayer: false,
            rating: 4.4,
            metacritic: 84,
            historyLow: { amount: 14900, currency: "KRW" },
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
      preferences: "평가 좋은 전략 할인 게임",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({
      title: "Reviewed Tactics Reserve",
      evidence: {
        priceEvidence: {
          source: "ITAD",
          current: { amount: 15900, currency: "KRW" },
          regular: { amount: 31800, currency: "KRW" },
          cut: 50,
          historyLow: { amount: 14900, currency: "KRW" }
        },
        platformEvidence: {
          source: "ITAD",
          platforms: ["PC"]
        },
        metadataEvidence: {
          source: "RAWG",
          genres: ["Strategy", "Tactics"],
          rating: 4.4,
          metacritic: 84
        }
      },
      matchedSignals: expect.arrayContaining(["strategy", "tactics", "high-rating"]),
      recommendationReason: expect.any(String)
    });
  });

  it("rejects Steam Deck unknown candidates when no verified or playable evidence exists", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "1",
            title: "Unknown Deck Roguelike",
            price: { amount: 12000, currency: "KRW" },
            regular: { amount: 24000, currency: "KRW" },
            cut: 50,
            genres: ["Action", "Roguelike"],
            platforms: ["PC", "Steam Deck"],
            multiplayer: false,
            rating: 4.2,
            metacritic: 80,
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
      preferences: "스팀덱에서 하기 좋은 로그라이크",
      budget: 20000,
      platforms: ["Steam Deck"],
      country: "KR"
    });

    expect(result.matches).toEqual([]);
    expect(result.summary).toContain("조건에 맞는 추천 할인 게임을 찾지 못했습니다.");
    expect(result.emptyReason).toBe("missing-steam-deck-evidence");
    expect(result.summary).toContain("Steam Deck Verified/Playable 근거");
    expect(result.missingEvidence).toContain("Steam Deck verified/playable 근거");
  });
});
