import { describe, expect, it } from "vitest";

import { applyRecommendationDegradedMode } from "../../src/domain/recommendation-degraded-mode.js";
import { parseRecommendationConstraints } from "../../src/domain/recommendation-constraints.js";
import type { DealCandidate } from "../../src/domain/score.js";

function createDeal(overrides: Partial<DealCandidate> & Pick<DealCandidate, "id" | "title">): DealCandidate {
  const { id, title, ...rest } = overrides;

  return {
    id,
    title,
    price: { amount: 10000, currency: "KRW" },
    regular: { amount: 20000, currency: "KRW" },
    cut: 50,
    genres: ["Strategy"],
    platforms: ["PC"],
    multiplayer: false,
    ...rest
  };
}

describe("applyRecommendationDegradedMode", () => {
  it("keeps strong strategy candidates alive during metadata instability", () => {
    const result = applyRecommendationDegradedMode({
      warnings: ["RAWG request failed with 502"],
      steamDeckRequest: false,
      constraints: parseRecommendationConstraints("평가 좋은 전략 게임"),
      preferences: {
        genres: ["Strategy"],
        rawgGenres: ["strategy"],
        platforms: [],
        tags: [],
        multiplayer: false,
        deckbuilding: false,
        highRating: true,
        shortSession: false
      },
      deals: [
        createDeal({
          id: "reviewed-strategy",
          title: "Reviewed Strategy Candidate",
          genres: ["Strategy", "Tactics"],
          rating: 4.4,
          metacritic: 84,
          metadataStatus: "missing"
        }),
        createDeal({
          id: "budget-strategy",
          title: "Budget Strategy Candidate",
          genres: ["Strategy"],
          rating: 2.9,
          metacritic: 58,
          metadataStatus: "rawg"
        }),
        createDeal({
          id: "reviewed-action",
          title: "Reviewed Action Candidate",
          genres: ["Action"],
          rating: 4.6,
          metacritic: 86,
          metadataStatus: "missing"
        })
      ]
    });

    expect(result.applied).toBe(true);
    expect(result.matches.map((deal) => deal.title)).toEqual(["Reviewed Strategy Candidate"]);
  });

  it("keeps deck or card evidence candidates for degraded deckbuilding prompts", () => {
    const result = applyRecommendationDegradedMode({
      warnings: ["일부 메타데이터를 생략했습니다."],
      steamDeckRequest: false,
      constraints: parseRecommendationConstraints("짧게 즐길 카드게임"),
      preferences: {
        genres: ["Strategy"],
        rawgGenres: ["card"],
        platforms: [],
        tags: ["roguelike-deckbuilder"],
        multiplayer: false,
        deckbuilding: true,
        highRating: false,
        shortSession: true
      },
      deals: [
        createDeal({
          id: "generic-strategy",
          title: "Generic Strategy Pick",
          genres: ["Strategy", "Roguelike"],
          rating: 4.4,
          metacritic: 82,
          metadataStatus: "rawg"
        }),
        createDeal({
          id: "card-pick",
          title: "Card Tactics Expedition",
          genres: ["Strategy", "Card"],
          rating: 4.2,
          metacritic: 80,
          metadataStatus: "missing"
        })
      ]
    });

    expect(result.applied).toBe(true);
    expect(result.matches.map((deal) => deal.title)).toEqual(["Card Tactics Expedition"]);
  });

  it("keeps only supported or unknown Steam Deck roguelikes in degraded mode", () => {
    const result = applyRecommendationDegradedMode({
      warnings: ["응답 시간을 맞추기 위해 일부 추천 후보 보강을 생략했습니다."],
      steamDeckRequest: true,
      constraints: parseRecommendationConstraints("스팀덱에서 하기 좋은 로그라이크"),
      preferences: {
        genres: ["Roguelike"],
        rawgGenres: [],
        platforms: ["Steam Deck"],
        tags: ["roguelike"],
        multiplayer: false,
        deckbuilding: false,
        highRating: false,
        shortSession: false
      },
      deals: [
        createDeal({
          id: "deck-playable",
          title: "Deck Playable Rogue",
          genres: ["Action", "Roguelike"],
          metadataStatus: "missing",
          steamDeckCompatibility: {
            status: "playable",
            details: [],
            source: "steam"
          }
        }),
        createDeal({
          id: "deck-unknown",
          title: "Deck Unknown Rogue",
          genres: ["Strategy", "Roguelike"],
          metadataStatus: "unavailable",
          steamDeckCompatibility: {
            status: "unknown",
            details: [],
            source: "steam"
          }
        }),
        createDeal({
          id: "deck-unsupported",
          title: "Deck Unsupported Rogue",
          genres: ["Strategy", "Roguelike"],
          metadataStatus: "missing",
          steamDeckCompatibility: {
            status: "unsupported",
            details: [],
            source: "steam"
          }
        })
      ]
    });

    expect(result.applied).toBe(true);
    expect(result.matches.map((deal) => deal.title)).toEqual([
      "Deck Playable Rogue",
      "Deck Unknown Rogue"
    ]);
  });

  it("stays inactive when there are no degraded-mode warnings", () => {
    const result = applyRecommendationDegradedMode({
      warnings: [],
      steamDeckRequest: true,
      constraints: parseRecommendationConstraints("스팀덱에서 하기 좋은 로그라이크"),
      preferences: {
        genres: ["Roguelike"],
        rawgGenres: [],
        platforms: ["Steam Deck"],
        tags: ["roguelike"],
        multiplayer: false,
        deckbuilding: false,
        highRating: false,
        shortSession: false
      },
      deals: [
        createDeal({
          id: "deck-playable",
          title: "Deck Playable Rogue",
          genres: ["Action", "Roguelike"],
          metadataStatus: "missing",
          steamDeckCompatibility: {
            status: "playable",
            details: [],
            source: "steam"
          }
        })
      ]
    });

    expect(result.applied).toBe(false);
    expect(result.matches).toEqual([]);
  });
});
