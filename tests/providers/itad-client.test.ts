import { describe, expect, it, vi } from "vitest";

import { IsThereAnyDealClient } from "../../src/providers/itad-client.js";

describe("IsThereAnyDealClient.findDeals", () => {
  it("calls the deals endpoint with KR defaults and parses deal rows", async () => {
    const fetchMock = vi.fn(async (input: URL | string | Request) => {
      expect(String(input)).toContain("/deals/v2");
      expect(String(input)).toContain("country=KR");
      expect(String(input)).toContain("sort=-cut");

      return new Response(
        JSON.stringify({
          list: [
            {
              id: "deal-1",
              game: { id: "game-1", title: "Balatro" },
              deal: {
                price: { amount: 12000, currency: "KRW" },
                regular: { amount: 17000, currency: "KRW" },
                cut: 29
              }
            }
          ]
        }),
        { status: 200 }
      );
    });

    const client = new IsThereAnyDealClient({
      apiKey: "test-key",
      fetch: fetchMock
    });

    await expect(client.findDeals({ country: "KR", sort: "biggest-discount" })).resolves.toMatchObject([
      {
        id: "game-1",
        title: "Balatro",
        price: { amount: 12000, currency: "KRW" },
        cut: 29
      }
    ]);
  });

  it("parses the live deals v2 row shape with top-level titles", async () => {
    const client = new IsThereAnyDealClient({
      apiKey: "test-key",
      fetch: vi.fn(async () =>
        new Response(
          JSON.stringify({
            list: [
              {
                id: "0195311f-eb83-70a2-aa15-5c4787aed6e3",
                title: "BrightGunner",
                deal: {
                  price: { amount: 0, currency: "KRW" },
                  regular: { amount: 10200, currency: "KRW" },
                  cut: 100
                }
              }
            ]
          }),
          { status: 200 }
        )
      )
    });

    await expect(client.findDeals({ country: "KR", sort: "lowest-price" })).resolves.toMatchObject([
      {
        id: "0195311f-eb83-70a2-aa15-5c4787aed6e3",
        title: "BrightGunner",
        price: { amount: 0, currency: "KRW" },
        regular: { amount: 10200, currency: "KRW" },
        cut: 100
      }
    ]);
  });

  it("adds Steam shop scope when preferred shops are supplied", async () => {
    const fetchMock = vi.fn(async (input: URL | string | Request) => {
      expect(String(input)).toContain("/deals/v2");
      expect(String(input)).toContain("shops=61");

      return new Response(JSON.stringify({ list: [] }), { status: 200 });
    });

    const client = new IsThereAnyDealClient({
      apiKey: "test-key",
      fetch: fetchMock
    });

    await client.findDeals({
      country: "KR",
      sort: "best-value",
      preferredShops: [61]
    });
  });
});

describe("IsThereAnyDealClient.resolveDeal", () => {
  it("uses lookup, overview, and history-low endpoints for exact title resolution", async () => {
    const fetchMock = vi
      .fn(async (input: URL | string | Request, init?: RequestInit) => {
        const value = String(input);

        if (value.includes("/games/lookup/v1")) {
          return new Response(
            JSON.stringify({
              found: true,
              game: {
                id: "646570",
                title: "Slay the Spire"
              }
            }),
            { status: 200 }
          );
        }

        if (value.includes("/games/overview/v2")) {
          expect(init?.method).toBe("POST");
          expect(init?.body).toBe(JSON.stringify(["646570"]));

          return new Response(
            JSON.stringify({
              prices: [
                {
                  id: "646570",
                  current: {
                    shop: { name: "Steam" },
                    price: { amount: 6750, currency: "KRW" },
                    regular: { amount: 27000, currency: "KRW" },
                    cut: 75,
                    url: "https://example.com/slay-the-spire"
                  },
                  lowest: {
                    shop: { name: "Steam" },
                    price: { amount: 6750, currency: "KRW" },
                    regular: { amount: 27000, currency: "KRW" },
                    cut: 75
                  }
                }
              ]
            }),
            { status: 200 }
          );
        }

        expect(value).toContain("/games/historylow/v1");
        expect(init?.method).toBe("POST");
        expect(init?.body).toBe(JSON.stringify(["646570"]));

        return new Response(
          JSON.stringify([
            {
              id: "646570",
              low: {
                shop: { name: "Steam" },
                price: { amount: 5400, currency: "KRW" },
                regular: { amount: 27000, currency: "KRW" },
                cut: 80
              }
            }
          ]),
          { status: 200 }
        );
      });

    const client = new IsThereAnyDealClient({
      apiKey: "test-key",
      fetch: fetchMock
    });

    const result = await client.resolveDeal("Slay the Spire", "KR");

    expect(result.kind).toBe("match");
    expect(fetchMock.mock.calls[0]?.[0].toString()).toContain("/games/lookup/v1");
    expect(result).toMatchObject({
      kind: "match",
      title: "Slay the Spire",
      matches: [
        {
          id: "646570",
          title: "Slay the Spire",
          price: { amount: 6750, currency: "KRW" },
          cut: 75,
          historyLow: { amount: 5400, currency: "KRW" },
          stores: [
            {
              store: "Steam",
              price: { amount: 6750, currency: "KRW" }
            }
          ]
        }
      ]
    });
  });

  it("returns ambiguous candidates instead of choosing one arbitrarily", async () => {
    const fetchMock = vi.fn(async (input: URL | string | Request) => {
      expect(String(input)).toContain("/games/lookup/v1");

      return new Response(
        JSON.stringify({
          results: [
            { id: "1", title: "Hades" },
            { id: "2", title: "Hades II" }
          ]
        }),
        { status: 200 }
      );
    });

    const client = new IsThereAnyDealClient({
      apiKey: "test-key",
      fetch: fetchMock
    });

    await expect(client.resolveDeal("Hades", "KR")).resolves.toEqual({
      kind: "ambiguous",
      title: "Hades",
      candidates: [
        { id: "1", title: "Hades" },
        { id: "2", title: "Hades II" }
      ]
    });
  });

  it("uses prices v3 for Steam-only catalog verification", async () => {
    const fetchMock = vi.fn(async (input: URL | string | Request, init?: RequestInit) => {
      const value = String(input);

      if (value.includes("/games/lookup/v1")) {
        return new Response(
          JSON.stringify({
            found: true,
            game: {
              id: "646570",
              title: "Slay the Spire"
            }
          }),
          { status: 200 }
        );
      }

      expect(value).toContain("/games/prices/v3");
      expect(value).toContain("shops=61");
      expect(value).toContain("deals=true");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify(["646570"]));

      return new Response(
        JSON.stringify([
          {
            id: "646570",
            historyLow: {
              all: { amount: 5400, amountInt: 5400, currency: "KRW" },
              y1: { amount: 5400, amountInt: 5400, currency: "KRW" },
              m3: { amount: 6750, amountInt: 6750, currency: "KRW" }
            },
            deals: [
              {
                shop: { id: 61, name: "Steam" },
                price: { amount: 6750, amountInt: 6750, currency: "KRW" },
                regular: { amount: 27000, amountInt: 27000, currency: "KRW" },
                cut: 75,
                voucher: null,
                storeLow: { amount: 6750, amountInt: 6750, currency: "KRW" },
                flag: "H",
                drm: [],
                platforms: [],
                timestamp: "2026-03-12T09:00:00+09:00",
                expiry: null,
                url: "https://example.com/slay-the-spire-steam"
              }
            ]
          }
        ]),
        { status: 200 }
      );
    });

    const client = new IsThereAnyDealClient({
      apiKey: "test-key",
      fetch: fetchMock
    });

    const result = await client.resolveDeal("Slay the Spire", "KR", {
      preferredShops: [61],
      dealsOnly: true
    });

    expect(result).toMatchObject({
      kind: "match",
      matches: [
        {
          title: "Slay the Spire",
          price: { amount: 6750, currency: "KRW" },
          cut: 75,
          historyLow: { amount: 5400, currency: "KRW" },
          stores: [{ store: "Steam" }]
        }
      ]
    });
  });
});
