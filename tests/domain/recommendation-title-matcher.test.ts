import { describe, expect, it } from "vitest";

import { findBestRecommendationTitleMatch } from "../../src/domain/recommendation-title-matcher.js";

describe("recommendation-title-matcher", () => {
  it("matches titles despite trademark and subtitle punctuation differences", () => {
    const match = findBestRecommendationTitleMatch("The Last of Us™ Remastered", [
      { title: "The Last of Us Remastered" }
    ]);

    expect(match).toMatchObject({
      candidate: {
        title: "The Last of Us Remastered"
      }
    });
  });

  it("prefers the candidate with the strongest token overlap", () => {
    const match = findBestRecommendationTitleMatch("Deck Strategy Rogue", [
      { title: "Deck Strategy" },
      { title: "Deck Strategy Rogue Tactics" }
    ]);

    expect(match).toMatchObject({
      candidate: {
        title: "Deck Strategy Rogue Tactics"
      }
    });
  });

  it("rejects low-confidence matches", () => {
    const match = findBestRecommendationTitleMatch("Deck Strategy Rogue", [
      { title: "Cozy Grove" },
      { title: "Trailblazers" }
    ]);

    expect(match).toBeNull();
  });
});
