import { describe, expect, it } from "vitest";

import { GameDataGateway } from "../../src/providers/game-data-gateway.js";
import type { DealCandidate } from "../../src/domain/score.js";

describe("GameDataGateway.enrichDeals", () => {
  it("keeps partial results when one RAWG lookup fails", async () => {
    const gateway = new GameDataGateway(
      {} as never,
      {
        async searchGames(title: string) {
          if (title === "Broken Game") {
            throw new Error("RAWG exploded");
          }

          return [
            {
              title: "Balatro",
              released: "2024-02-20",
              genres: ["Roguelike", "Strategy"],
              platforms: ["PC", "Steam Deck"],
              rating: 4.8,
              metacritic: 90,
              multiplayer: false
            }
          ];
        }
      } as never
    );

    const result = await gateway.enrichDeals([
      {
        id: "1",
        title: "Balatro",
        price: { amount: 16500, currency: "KRW" },
        regular: { amount: 16500, currency: "KRW" },
        cut: 0,
        genres: [],
        platforms: [],
        multiplayer: false
      },
      {
        id: "2",
        title: "Broken Game",
        price: { amount: 5000, currency: "KRW" },
        regular: { amount: 10000, currency: "KRW" },
        cut: 50,
        genres: [],
        platforms: [],
        multiplayer: false
      }
    ]);

    expect(result.deals).toHaveLength(2);
    expect(result.deals[0]).toMatchObject({
      title: "Balatro",
      genres: ["Roguelike", "Strategy"],
      platforms: ["PC", "Steam Deck"]
    });
    expect(result.deals[1]).toMatchObject({
      title: "Broken Game",
      genres: [],
      platforms: []
    });
    expect(result.warnings).toEqual([expect.stringContaining("Broken Game")]);
  });

  it("limits RAWG and Steam enrichment to the configured budgets", async () => {
    let rawgCalls = 0;
    let steamBatchSize = 0;

    const gateway = new GameDataGateway(
      {} as never,
      {
        async searchGames(title: string) {
          rawgCalls += 1;
          return [
            {
              title,
              released: "2024-01-01",
              genres: ["Roguelike"],
              platforms: ["PC", "Steam Deck"],
              rating: 4.0,
              metacritic: 80,
              multiplayer: false
            }
          ];
        }
      } as never,
      {
        async enrichDeals(deals: DealCandidate[]) {
          steamBatchSize = deals.length;
          return {
            deals: deals.map((deal: DealCandidate) => ({
              ...deal,
              steamDeckCompatibility: {
                status: "verified" as const,
                details: [],
                source: "steam" as const
              }
            })),
            warnings: []
          };
        }
      } as never
    );

    const deals = Array.from({ length: 15 }, (_, index) => ({
      id: String(index + 1),
      title: `Game ${index + 1}`,
      price: { amount: 10000, currency: "KRW" as const },
      regular: { amount: 20000, currency: "KRW" as const },
      cut: 50,
      genres: ["Roguelike"],
      platforms: ["PC"],
      multiplayer: false
    }));

    const result = await gateway.enrichDeals(deals, {
      includeSteamDeckCompatibility: true,
      maxRawgLookups: 12,
      maxSteamLookups: 8
    });

    expect(rawgCalls).toBe(12);
    expect(steamBatchSize).toBe(8);
    expect(result.deals).toHaveLength(15);
    expect(result.warnings).toEqual([
      "RAWG 보강 한도 때문에 일부 메타데이터를 생략했습니다.",
      "Steam Deck 호환성 보강 한도 때문에 일부 정보를 생략했습니다."
    ]);
  });
});
