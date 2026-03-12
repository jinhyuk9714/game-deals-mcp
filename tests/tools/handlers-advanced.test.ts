import { describe, expect, it } from "vitest";

import { GameDealService } from "../../src/domain/service.js";
import {
  callCompareGamePriceTool,
  callExplainDealValueTool,
  callRecommendSaleGamesTool
} from "../../src/tools/handlers.js";

describe("advanced tool handlers", () => {
  const service = new GameDealService({
    async findDeals() {
      return [
        {
          id: "1",
          title: "Balatro",
          price: { amount: 12000, currency: "KRW" },
          regular: { amount: 17000, currency: "KRW" },
          cut: 29,
          genres: ["Strategy", "Roguelike"],
          platforms: ["PC", "Steam Deck"],
          multiplayer: false,
          rating: 4.8,
          metacritic: 90,
          historyLow: { amount: 11000, currency: "KRW" }
        }
      ];
    },
    async enrichDeals(deals) {
      return deals;
    },
    async resolveDeal(title) {
      return {
        kind: "match" as const,
        title,
        matches: [
          {
            id: "1",
            title: "Balatro",
            price: { amount: 12000, currency: "KRW" },
            regular: { amount: 17000, currency: "KRW" },
            cut: 29,
            genres: ["Strategy", "Roguelike"],
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

  it("wraps compare_game_price output in MCP content", async () => {
    const result = await callCompareGamePriceTool(service, { title: "Balatro", country: "KR" });

    expect(result.structuredContent.query).toEqual({ title: "Balatro", country: "KR" });
    expect(result.content[0]?.type).toBe("text");
  });

  it("wraps recommend_sale_games output in MCP content", async () => {
    const result = await callRecommendSaleGamesTool(service, {
      preferences: "로그라이크",
      budget: 20000,
      country: "KR"
    });

    expect(result.structuredContent.country).toBe("KR");
    expect(result.content[0]?.text).toContain("Balatro");
  });

  it("wraps explain_deal_value output in MCP content", async () => {
    const result = await callExplainDealValueTool(service, { title: "Balatro", country: "KR" });

    expect(result.structuredContent.summary).toContain("역대 최저가");
  });
});
