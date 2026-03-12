import { describe, expect, it } from "vitest";

import { scoreDealCandidates } from "../../src/domain/score.js";

describe("scoreDealCandidates", () => {
  it("filters by budget, platform, genre, and multiplayer and sorts by best value", () => {
    const ranked = scoreDealCandidates(
      [
        {
          id: "1",
          title: "Co-op Deckbuilder",
          price: { amount: 18000, currency: "KRW" },
          regular: { amount: 36000, currency: "KRW" },
          cut: 50,
          genres: ["Indie", "Strategy", "Roguelike"],
          platforms: ["PC", "Steam Deck"],
          multiplayer: true,
          rating: 4.7,
          metacritic: 86
        },
        {
          id: "2",
          title: "Expensive Solo RPG",
          price: { amount: 32000, currency: "KRW" },
          regular: { amount: 64000, currency: "KRW" },
          cut: 50,
          genres: ["RPG"],
          platforms: ["PC"],
          multiplayer: false,
          rating: 4.9,
          metacritic: 92
        }
      ],
      {
        budget: 20000,
        genres: ["Roguelike"],
        platforms: ["Steam Deck"],
        multiplayer: true,
        sort: "best-value"
      }
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.title).toBe("Co-op Deckbuilder");
  });

  it("sorts by lowest price when requested", () => {
    const ranked = scoreDealCandidates(
      [
        {
          id: "1",
          title: "Game A",
          price: { amount: 25000, currency: "KRW" },
          regular: { amount: 50000, currency: "KRW" },
          cut: 50,
          genres: ["Action"],
          platforms: ["PC"],
          multiplayer: false,
          rating: 4.2,
          metacritic: 80
        },
        {
          id: "2",
          title: "Game B",
          price: { amount: 12000, currency: "KRW" },
          regular: { amount: 24000, currency: "KRW" },
          cut: 50,
          genres: ["Action"],
          platforms: ["PC"],
          multiplayer: false,
          rating: 4.0,
          metacritic: 78
        }
      ],
      { sort: "lowest-price" }
    );

    expect(ranked.map((deal) => deal.title)).toEqual(["Game B", "Game A"]);
  });

  it("treats steam as a platform alias for PC and Steam Deck candidates", () => {
    const ranked = scoreDealCandidates(
      [
        {
          id: "1",
          title: "Deck Friendly Roguelike",
          price: { amount: 15000, currency: "KRW" },
          regular: { amount: 30000, currency: "KRW" },
          cut: 50,
          genres: ["Roguelike"],
          platforms: ["PC", "Steam Deck"],
          multiplayer: false,
          rating: 4.6,
          metacritic: 85
        }
      ],
      { platforms: ["steam"], sort: "best-value" }
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.title).toBe("Deck Friendly Roguelike");
  });

  it("treats steam deck as a PC proxy when deck compatibility data is unavailable", () => {
    const ranked = scoreDealCandidates(
      [
        {
          id: "1",
          title: "PC Roguelike",
          price: { amount: 15000, currency: "KRW" },
          regular: { amount: 30000, currency: "KRW" },
          cut: 50,
          genres: ["Roguelike"],
          platforms: ["PC"],
          multiplayer: false,
          rating: 4.6,
          metacritic: 85,
          metadataStatus: "rawg"
        }
      ],
      { platforms: ["Steam Deck"], sort: "best-value" }
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.title).toBe("PC Roguelike");
  });

  it("drops metadata-missing deals for filtered searches but keeps temporarily unavailable ones", () => {
    const ranked = scoreDealCandidates(
      [
        {
          id: "1",
          title: "Known Roguelike",
          price: { amount: 10000, currency: "KRW" },
          regular: { amount: 20000, currency: "KRW" },
          cut: 50,
          genres: ["Roguelike"],
          platforms: ["PC", "Steam Deck"],
          multiplayer: false,
          metadataStatus: "rawg"
        },
        {
          id: "2",
          title: "Unknown Cheap Thing",
          price: { amount: 100, currency: "KRW" },
          regular: { amount: 1000, currency: "KRW" },
          cut: 90,
          genres: [],
          platforms: [],
          multiplayer: false,
          metadataStatus: "missing"
        },
        {
          id: "3",
          title: "Metadata Temporarily Unavailable",
          price: { amount: 5000, currency: "KRW" },
          regular: { amount: 10000, currency: "KRW" },
          cut: 50,
          genres: [],
          platforms: [],
          multiplayer: false,
          metadataStatus: "unavailable"
        }
      ],
      { genres: ["Roguelike"], platforms: ["Steam Deck"], sort: "lowest-price" }
    );

    expect(ranked.map((deal) => deal.title)).toEqual([
      "Metadata Temporarily Unavailable",
      "Known Roguelike"
    ]);
  });

  it("ranks strong reviewed picks above obscure discount-heavy titles for best-value", () => {
    const ranked = scoreDealCandidates(
      [
        {
          id: "1",
          title: "Space Rangers HD: A War Apart",
          price: { amount: 2228, currency: "KRW" },
          regular: { amount: 16500, currency: "KRW" },
          cut: 86,
          genres: ["Strategy", "RPG", "Roguelike"],
          platforms: ["PC"],
          multiplayer: false,
          rating: 4.37,
          metacritic: 68,
          metadataStatus: "rawg"
        },
        {
          id: "2",
          title: "Inscryption",
          price: { amount: 11820, currency: "KRW" },
          regular: { amount: 29571, currency: "KRW" },
          cut: 60,
          genres: ["Strategy", "Adventure", "Roguelike"],
          platforms: ["PC"],
          multiplayer: false,
          rating: 4.38,
          metacritic: 86,
          historyLow: { amount: 6600, currency: "KRW" },
          metadataStatus: "rawg"
        }
      ],
      { sort: "best-value", genres: ["Roguelike"], platforms: ["Steam Deck"] }
    );

    expect(ranked.map((deal) => deal.title)).toEqual([
      "Inscryption",
      "Space Rangers HD: A War Apart"
    ]);
  });

  it("prefers verified Steam Deck titles over playable and unknown titles for best-value", () => {
    const ranked = scoreDealCandidates(
      [
        {
          id: "1",
          title: "Unknown Deck Game",
          price: { amount: 9000, currency: "KRW" },
          regular: { amount: 18000, currency: "KRW" },
          cut: 50,
          genres: ["Roguelike"],
          platforms: ["PC"],
          multiplayer: false,
          rating: 4.6,
          metacritic: 84,
          steamDeckCompatibility: {
            status: "unknown",
            details: [],
            source: "steam"
          }
        },
        {
          id: "2",
          title: "Playable Deck Game",
          price: { amount: 9500, currency: "KRW" },
          regular: { amount: 19000, currency: "KRW" },
          cut: 50,
          genres: ["Roguelike"],
          platforms: ["PC"],
          multiplayer: false,
          rating: 4.5,
          metacritic: 82,
          steamDeckCompatibility: {
            status: "playable",
            details: [],
            source: "steam"
          }
        },
        {
          id: "3",
          title: "Verified Deck Game",
          price: { amount: 10000, currency: "KRW" },
          regular: { amount: 20000, currency: "KRW" },
          cut: 50,
          genres: ["Roguelike"],
          platforms: ["PC"],
          multiplayer: false,
          rating: 4.4,
          metacritic: 80,
          steamDeckCompatibility: {
            status: "verified",
            details: [],
            source: "steam"
          }
        }
      ],
      { sort: "best-value", genres: ["Roguelike"], platforms: ["Steam Deck"] }
    );

    expect(ranked.map((deal) => deal.title)).toEqual([
      "Verified Deck Game",
      "Playable Deck Game",
      "Unknown Deck Game"
    ]);
  });
});
