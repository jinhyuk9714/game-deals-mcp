import { describe, expect, it, vi } from "vitest";

import { RawgClient } from "../../src/providers/rawg-client.js";

describe("RawgClient.searchGames", () => {
  it("queries RAWG search and maps metadata fields", async () => {
    const fetchMock = vi.fn(async (input: URL | string | Request) => {
      expect(String(input)).toContain("/api/games");
      expect(String(input)).toContain("search=balatro");

      return new Response(
        JSON.stringify({
          results: [
            {
              name: "Balatro",
              released: "2024-02-20",
              rating: 4.6,
              metacritic: 90,
              genres: [{ name: "Strategy" }, { name: "Indie" }],
              platforms: [{ platform: { name: "PC" } }, { platform: { name: "macOS" } }],
              tags: [{ name: "Singleplayer" }]
            }
          ]
        }),
        { status: 200 }
      );
    });

    const client = new RawgClient({
      apiKey: "rawg-key",
      fetch: fetchMock
    });

    await expect(client.searchGames("balatro")).resolves.toEqual([
      {
        title: "Balatro",
        released: "2024-02-20",
        genres: ["Strategy", "Indie"],
        platforms: ["PC", "macOS"],
        tags: ["Singleplayer"],
        rating: 4.6,
        metacritic: 90,
        multiplayer: false
      }
    ]);
  });

  it("can discover catalog candidates by tag filters", async () => {
    const fetchMock = vi.fn(async (input: URL | string | Request) => {
      expect(String(input)).toContain("/api/games");
      expect(String(input)).toContain("tags=roguelike%2Croguelite");

      return new Response(
        JSON.stringify({
          results: [
            {
              name: "Hades",
              released: "2020-09-17",
              rating: 4.7,
              metacritic: 93,
              genres: [{ name: "Action" }, { name: "Indie" }],
              platforms: [{ platform: { name: "PC" } }, { platform: { name: "PlayStation 5" } }],
              tags: [{ name: "Roguelike" }]
            }
          ]
        }),
        { status: 200 }
      );
    });

    const client = new RawgClient({
      apiKey: "rawg-key",
      fetch: fetchMock
    });

    await expect(client.discoverGames({ tags: ["roguelike", "roguelite"], limit: 1 })).resolves.toEqual([
      {
        title: "Hades",
        released: "2020-09-17",
        genres: ["Action", "Indie"],
        platforms: ["PC", "PlayStation 5"],
        tags: ["Roguelike"],
        rating: 4.7,
        metacritic: 93,
        multiplayer: false
      }
    ]);
  });

  it("aborts slow RAWG requests after the configured timeout", async () => {
    const fetchMock = vi.fn((_input: URL | string | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("aborted by signal"));
        });
      });
    });

    const client = new RawgClient({
      apiKey: "rawg-key",
      fetch: fetchMock as typeof fetch,
      requestTimeoutMs: 20
    });

    await expect(client.searchGames("slow game")).rejects.toThrow(
      "RAWG request failed with timeout"
    );
  });
});
