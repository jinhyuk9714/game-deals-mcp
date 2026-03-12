import { describe, expect, it } from "vitest";

import { GameDataGateway } from "../../src/providers/game-data-gateway.js";

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
});
