import { describe, expect, it } from "vitest";

import { GameDealService } from "../../src/domain/service.js";
import { callDiscoverDealsTool } from "../../src/tools/handlers.js";

describe("callDiscoverDealsTool", () => {
  it("returns the common MCP response shape", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "deal-1",
            title: "Balatro",
            price: { amount: 12000, currency: "KRW" },
            regular: { amount: 17000, currency: "KRW" },
            cut: 29,
            genres: ["Strategy", "Roguelike"],
            platforms: ["PC", "Steam Deck"],
            multiplayer: false,
            rating: 4.8,
            metacritic: 90
          }
        ];
      },
      async enrichDeals(deals) {
        return deals;
      }
    });

    const result = await callDiscoverDealsTool(service, {
      budget: 20000,
      genres: ["Roguelike"],
      platforms: ["Steam Deck"],
      multiplayer: false,
      sort: "best-value",
      country: "KR"
    });

    expect(result.structuredContent).toMatchObject({
      query: {
        budget: 20000,
        country: "KR"
      },
      country: "KR",
      summary: expect.any(String),
      sources: expect.arrayContaining(["IsThereAnyDeal", "RAWG"]),
      warnings: expect.any(Array)
    });
    expect(result.content[0]?.type).toBe("text");
  });
});
