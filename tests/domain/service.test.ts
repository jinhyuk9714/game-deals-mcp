import { describe, expect, it } from "vitest";

import { GameDealService } from "../../src/domain/service.js";

describe("GameDealService.discoverDeals", () => {
  it("returns partial data and warns when only one source succeeds", async () => {
    const service = new GameDealService({
      async findDeals() {
        return [
          {
            id: "deal-1",
            title: "Balatro",
            price: { amount: 15000, currency: "KRW" },
            regular: { amount: 17000, currency: "KRW" },
            cut: 12,
            genres: ["Strategy", "Roguelike"],
            platforms: ["PC"],
            multiplayer: false,
            rating: null,
            metacritic: null
          }
        ];
      },
      async enrichDeals() {
        throw new Error("RAWG unavailable");
      }
    });

    const result = await service.discoverDeals({ country: "KR", sort: "best-value" });

    expect(result.country).toBe("KR");
    expect(result.matches).toHaveLength(1);
    expect(result.warnings).toEqual([
      expect.stringContaining("RAWG 메타데이터를 불러오지 못해 가격 정보만 표시했습니다.")
    ]);
    expect(result.summary).toContain("Balatro");
  });
});
