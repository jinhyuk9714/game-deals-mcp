import { describe, expect, it } from "vitest";

import { rankRecommendationRecoveryCandidates } from "../../src/domain/recommendation-recovery-ranking.js";

describe("rankRecommendationRecoveryCandidates", () => {
  it("prefers local-coop multiplayer candidates over generic console-first action picks", () => {
    const ranked = rankRecommendationRecoveryCandidates(
      [
        {
          title: "Arcade Stadium Collection",
          genres: ["Action"],
          platforms: ["PlayStation 4"],
          tags: [],
          rating: 4.3,
          metacritic: 81,
          multiplayer: true
        },
        {
          title: "Orbital Crew",
          genres: ["Simulation"],
          platforms: ["PC"],
          tags: [],
          rating: 4.1,
          metacritic: 78,
          multiplayer: true
        }
      ],
      {
        kind: "broad-multiplayer",
        shortSession: false,
        partyPrompt: false,
        nonCompetitive: false,
        excludeRacingOrSports: false,
        qualityIntent: [],
        requestedPlatforms: ["PC"],
        simpleSocialPrompt: true
      }
    );

    expect(ranked[0]?.title).toBe("Orbital Crew");
  });

  it("prefers explicit teamplay candidates over party-sports or junk picks for generic social prompts", () => {
    const ranked = rankRecommendationRecoveryCandidates(
      [
        {
          title: "AI Games",
          genres: ["Indie"],
          platforms: ["PC"],
          tags: [],
          rating: 4.3,
          metacritic: 80,
          multiplayer: false
        },
        {
          title: "Racket: Nx",
          genres: ["Action", "Sports"],
          platforms: ["PC"],
          tags: [],
          rating: 4.5,
          metacritic: 84,
          multiplayer: true
        },
        {
          title: "Orbital Teamplay Co-op",
          genres: ["Simulation"],
          platforms: ["PC"],
          tags: ["cooperative", "teamplay"],
          rating: 4.1,
          metacritic: 78,
          multiplayer: true
        }
      ],
      {
        kind: "broad-multiplayer",
        shortSession: false,
        partyPrompt: false,
        socialProfile: "generic-coop",
        nonCompetitive: true,
        excludeRacingOrSports: false,
        qualityIntent: [],
        requestedPlatforms: ["PC"],
        simpleSocialPrompt: false
      }
    );

    expect(ranked.map((candidate) => candidate.title)).toEqual([
      "Orbital Teamplay Co-op",
      "Racket: Nx",
      "AI Games"
    ]);
  });
});
