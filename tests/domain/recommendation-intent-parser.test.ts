import { describe, expect, it } from "vitest";

import type { DealCandidate } from "../../src/domain/score.js";
import { GameDealService } from "../../src/domain/service.js";

function buildDeal(
  overrides: Partial<DealCandidate> & Pick<DealCandidate, "id" | "title">
): DealCandidate {
  return {
    id: overrides.id,
    title: overrides.title,
    price: overrides.price ?? { amount: 9900, currency: "KRW" },
    regular: overrides.regular ?? { amount: 19800, currency: "KRW" },
    cut: overrides.cut ?? 50,
    genres: overrides.genres ?? [],
    platforms: overrides.platforms ?? ["PC"],
    multiplayer: overrides.multiplayer ?? false,
    rating: overrides.rating ?? 4.2,
    metacritic: overrides.metacritic ?? 80,
    released: overrides.released,
    historyLow: overrides.historyLow,
    stores: overrides.stores,
    metadataStatus: overrides.metadataStatus ?? "rawg",
    steamDeckCompatibility: overrides.steamDeckCompatibility
  };
}

describe("GameDealService recommendation intent parser regressions", () => {
  it.each(["친구랑 같이 할 게임", "둘이서 하기 좋은 게임"])(
    "treats %s as multiplayer intent before ranking bargains",
    async (preferences) => {
      const service = new GameDealService({
        async findDeals() {
          return [
            buildDeal({
              id: "free-filler",
              title: "Deponia",
              price: { amount: 0, currency: "KRW" },
              regular: { amount: 22000, currency: "KRW" },
              cut: 100,
              genres: ["Adventure", "RPG"],
              multiplayer: false,
              rating: 3.85,
              metacritic: 74
            }),
            buildDeal({
              id: "party-brawler",
              title: "Party Brawler Heroes",
              genres: ["Action", "Casual", "Indie"],
              multiplayer: true,
              rating: 4.05,
              metacritic: 78
            })
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
        preferences,
        budget: 20000,
        country: "KR"
      });

      expect(result.matches[0]).toMatchObject({
        title: "Party Brawler Heroes",
        multiplayer: true
      });
    }
  );

  it.each([
    "핸드헬드에서 하기 좋은 로그라이크",
    "휴대용으로 가볍게 즐길 로그라이트",
    "패드로 돌리기 편한 로그라이크",
    "휴대용 pc에서 할 전략 게임"
  ])("maps %s to Steam Deck search context", async (preferences) => {
    const findDealsCalls: Array<{
      genres: string[] | undefined;
      platforms: string[] | undefined;
      preferredShops: number[] | undefined;
    }> = [];

    const service = new GameDealService({
      async findDeals(args) {
        findDealsCalls.push({
          genres: args.genres,
          platforms: args.platforms,
          preferredShops: args.preferredShops
        });

        return [
          buildDeal({
            id: "deck-playable",
            title: "Deck Ready Tactics",
            genres: ["Strategy", "Roguelike"],
            steamDeckCompatibility: {
              status: "playable",
              details: ["Runs on Steam Deck"],
              source: "steam"
            }
          }),
          buildDeal({
            id: "unknown-filler",
            title: "Unknown Bargain",
            price: { amount: 0, currency: "KRW" },
            regular: { amount: 22000, currency: "KRW" },
            cut: 100,
            genres: ["Strategy", "Roguelike"],
            rating: 3.2,
            metacritic: 65,
            steamDeckCompatibility: {
              status: "unknown",
              details: [],
              source: "steam"
            }
          })
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
      preferences,
      budget: 20000,
      country: "KR"
    });

    expect(findDealsCalls[0]?.preferredShops).toEqual([61]);
    expect(findDealsCalls[0]?.platforms).toContain("Steam Deck");
    expect(result.matches[0]).toMatchObject({ title: "Deck Ready Tactics" });
  });

  it.each(["잠깐씩 즐길 카드게임", "한 판씩 돌리기 좋은 카드 배틀러"])(
    "treats %s as deckbuilding intent instead of falling back to free fillers",
    async (preferences) => {
      const service = new GameDealService({
        async findDeals() {
          return [
            buildDeal({
              id: "free-filler",
              title: "Deponia",
              price: { amount: 0, currency: "KRW" },
              regular: { amount: 22000, currency: "KRW" },
              cut: 100,
              genres: ["Adventure", "RPG", "Puzzle"],
              rating: 3.85,
              metacritic: 74
            }),
            buildDeal({
              id: "card-deckbuilder",
              title: "Card Deckbuilder Expedition",
              genres: ["Strategy", "Card", "Roguelike"],
              rating: 4.4,
              metacritic: 82
            })
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
        preferences,
        budget: 15000,
        country: "KR"
      });

      expect(result.matches[0]).toMatchObject({ title: "Card Deckbuilder Expedition" });
    }
  );

  it("treats 검증된 전술 게임 as strategy intent", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          buildDeal({
            id: "free-filler",
            title: "Deponia",
            price: { amount: 0, currency: "KRW" },
            regular: { amount: 22000, currency: "KRW" },
            cut: 100,
            genres: ["Adventure", "RPG", "Puzzle"],
            rating: 3.85,
            metacritic: 74
          }),
          buildDeal({
            id: "reviewed-strategy",
            title: "Into the Breach",
            price: { amount: 5420, currency: "KRW" },
            regular: { amount: 15500, currency: "KRW" },
            cut: 65,
            genres: ["Strategy", "Indie", "Roguelike"],
            rating: 4.2,
            metacritic: 89
          })
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
      preferences: "검증된 전술 게임",
      budget: 25000,
      country: "KR"
    });

    expect(result.matches[0]).toMatchObject({ title: "Into the Breach" });
  });

  it.each([
    "전투 위주 로그라이트",
    "핵앤슬래시 로그라이크",
    "슈팅 로그라이트",
    "combat-heavy roguelike"
  ])("treats %s as action roguelite intent", async (preferences) => {
    const service = new GameDealService({
      async findDeals() {
        return [
          buildDeal({
            id: "card-roguelike",
            title: "Inscryption",
            price: { amount: 10285, currency: "KRW" },
            regular: { amount: 28571, currency: "KRW" },
            cut: 64,
            genres: ["Strategy", "Adventure", "Roguelike", "Deckbuilder", "Card"],
            rating: 4.38,
            metacritic: 86
          }),
          buildDeal({
            id: "action-roguelite",
            title: "Action Roguelite Hero",
            price: { amount: 8900, currency: "KRW" },
            regular: { amount: 17800, currency: "KRW" },
            cut: 50,
            genres: ["Action", "Roguelike"],
            rating: 4.2,
            metacritic: 80
          })
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
      preferences,
      budget: 18000,
      country: "KR"
    });

    expect(result.matches.map((match) => (match as { title: string }).title)).toEqual([
      "Action Roguelite Hero"
    ]);
  });
});
