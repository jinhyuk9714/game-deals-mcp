import { describe, expect, it, vi } from "vitest";

import { SteamStoreClient } from "../../src/providers/steam-store-client.js";

describe("SteamStoreClient.enrichDeals", () => {
  it("parses Steam Deck compatibility from a Steam store page", async () => {
    const fetchMock = vi.fn(async (input: URL | string | Request) => {
      const url = String(input);
      expect(url).toContain("/app/588650/");

      return new Response(
        `<div id="application_config" data-deckcompatibility="{&quot;appid&quot;:588650,&quot;resolved_category&quot;:3,&quot;resolved_items&quot;:[{&quot;loc_token&quot;:&quot;#SteamDeckVerified_TestResult_DefaultControllerConfigFullyFunctional&quot;},{&quot;loc_token&quot;:&quot;#SteamDeckVerified_TestResult_InterfaceTextIsLegible&quot;}]}"></div>`,
        { status: 200 }
      );
    });

    const client = new SteamStoreClient({
      fetch: fetchMock
    });

    const result = await client.enrichDeals([
      {
        id: "1",
        title: "Dead Cells",
        price: { amount: 10320, currency: "KRW" },
        regular: { amount: 25800, currency: "KRW" },
        cut: 60,
        genres: ["Action", "Roguelike"],
        platforms: ["PC"],
        multiplayer: false,
        stores: [
          {
            store: "Steam",
            price: { amount: 10320, currency: "KRW" },
            url: "https://store.steampowered.com/app/588650/Dead_Cells/"
          }
        ]
      }
    ]);

    expect(result.deals[0]).toMatchObject({
      title: "Dead Cells",
      steamDeckCompatibility: {
        status: "verified",
        steamAppId: 588650,
        source: "steam"
      }
    });
    expect(result.deals[0]?.steamDeckCompatibility?.details).toEqual([
      "Default controller config fully functional",
      "Interface text is legible"
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("falls back to Steam search when no Steam app id is present on the deal", async () => {
    const fetchMock = vi.fn(async (input: URL | string | Request) => {
      const url = String(input);

      if (url.includes("/search/results/")) {
        return new Response(
          JSON.stringify({
            success: 1,
            results_html:
              '<a href="https://store.steampowered.com/app/2379780/Balatro/"><span class="title">Balatro</span></a>'
          }),
          { status: 200 }
        );
      }

      expect(url).toContain("/app/2379780/");
      return new Response(
        `<div id="application_config" data-deckcompatibility="{&quot;appid&quot;:2379780,&quot;resolved_category&quot;:2,&quot;resolved_items&quot;:[{&quot;loc_token&quot;:&quot;#SteamDeckVerified_TestResult_InterfaceTextIsLegible&quot;}]}"></div>`,
        { status: 200 }
      );
    });

    const client = new SteamStoreClient({
      fetch: fetchMock
    });

    const result = await client.enrichDeals([
      {
        id: "1",
        title: "Balatro",
        price: { amount: 16500, currency: "KRW" },
        regular: { amount: 16500, currency: "KRW" },
        cut: 0,
        genres: ["Roguelike"],
        platforms: ["PC"],
        multiplayer: false
      }
    ]);

    expect(result.deals[0]).toMatchObject({
      steamDeckCompatibility: {
        status: "playable",
        steamAppId: 2379780,
        source: "steam"
      }
    });
  });

  it("resolves Steam app ids through ITAD redirect links before falling back to search", async () => {
    const fetchMock = vi.fn(async (input: URL | string | Request, init?: RequestInit) => {
      const url = String(input);

      if (url === "https://itad.link/example" && init?.redirect === "manual") {
        return new Response(null, {
          status: 302,
          headers: { location: "https://isthereanydeal.com/link/example" }
        });
      }

      if (url === "https://isthereanydeal.com/link/example" && init?.redirect === "manual") {
        return new Response(null, {
          status: 302,
          headers: { location: "https://store.steampowered.com/app/2753900/The_King_is_Watching/" }
        });
      }

      expect(url).toContain("/app/2753900/");
      return new Response(
        `<div id="application_config" data-deckcompatibility="{&quot;appid&quot;:2753900,&quot;resolved_category&quot;:3,&quot;resolved_items&quot;:[{&quot;loc_token&quot;:&quot;#SteamDeckVerified_TestResult_InterfaceTextIsLegible&quot;}]}"></div>`,
        { status: 200 }
      );
    });

    const client = new SteamStoreClient({
      fetch: fetchMock
    });

    const result = await client.enrichDeals([
      {
        id: "1",
        title: "The King is Watching",
        price: { amount: 9680, currency: "KRW" },
        regular: { amount: 14900, currency: "KRW" },
        cut: 35,
        genres: ["Strategy", "Roguelike"],
        platforms: ["PC"],
        multiplayer: false,
        stores: [
          {
            store: "Steam",
            price: { amount: 9680, currency: "KRW" },
            url: "https://itad.link/example"
          }
        ]
      }
    ]);

    expect(result.deals[0]).toMatchObject({
      title: "The King is Watching",
      steamDeckCompatibility: {
        status: "verified",
        steamAppId: 2753900,
        source: "steam"
      }
    });
  });

  it("marks compatibility as unknown when no official Steam data can be found", async () => {
    const client = new SteamStoreClient({
      fetch: vi.fn(async (input: URL | string | Request) => {
        const url = String(input);

        if (url.includes("/search/results/")) {
          return new Response(JSON.stringify({ success: 1, results_html: "" }), { status: 200 });
        }

        throw new Error(`unexpected call: ${url}`);
      })
    });

    const result = await client.enrichDeals([
      {
        id: "1",
        title: "Unknown Deck Game",
        price: { amount: 10000, currency: "KRW" },
        regular: { amount: 20000, currency: "KRW" },
        cut: 50,
        genres: ["Action"],
        platforms: ["PC"],
        multiplayer: false
      }
    ]);

    expect(result.deals[0]).toMatchObject({
      steamDeckCompatibility: {
        status: "unknown",
        source: "steam"
      }
    });
    expect(result.warnings).toEqual([expect.stringContaining("Steam Deck 호환성 정보를 확인하지 못했습니다.")]);
  });
});
