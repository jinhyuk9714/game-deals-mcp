import { describe, expect, it } from "vitest";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createMcpServer } from "../src/server.js";
import { GameDealService } from "../src/domain/service.js";

describe("createMcpServer", () => {
  it("registers the four public MCP tools", async () => {
    const server = await createMcpServer();
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const tools = await client.listTools();

    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "compare_game_price",
      "discover_deals",
      "explain_deal_value",
      "recommend_sale_games"
    ]);
  });

  it('accepts "savings" as a discover_deals sort alias', async () => {
    const server = await createMcpServer({
      service: new GameDealService({
        async findDeals() {
          return [
            {
              id: "1",
              title: "Alias Test",
              price: { amount: 5000, currency: "KRW" },
              regular: { amount: 10000, currency: "KRW" },
              cut: 50,
              genres: ["Roguelike"],
              platforms: ["PC", "Steam Deck"],
              multiplayer: false
            }
          ];
        },
        async enrichDeals(deals) {
          return deals;
        },
        async resolveDeal() {
          return { kind: "not-found" as const, title: "" };
        }
      })
    });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const result = await client.callTool(
      {
        name: "discover_deals",
        arguments: { country: "KR", budget: 20000, platforms: ["steam"], sort: "savings" }
      },
      CallToolResultSchema
    );

    expect(result.structuredContent).toMatchObject({
      country: "KR",
      matches: [expect.objectContaining({ title: "Alias Test" })]
    });
  });

  it('accepts "price" as a discover_deals sort alias', async () => {
    const server = await createMcpServer({
      service: new GameDealService({
        async findDeals() {
          return [
            {
              id: "1",
              title: "Lowest First",
              price: { amount: 5000, currency: "KRW" },
              regular: { amount: 10000, currency: "KRW" },
              cut: 50,
              genres: ["Roguelike"],
              platforms: ["PC"],
              multiplayer: false
            }
          ];
        },
        async enrichDeals(deals) {
          return deals;
        },
        async resolveDeal() {
          return { kind: "not-found" as const, title: "" };
        }
      })
    });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const result = await client.callTool(
      {
        name: "discover_deals",
        arguments: { country: "KR", budget: 20000, platforms: ["pc"], sort: "price" }
      },
      CallToolResultSchema
    );

    expect(result.structuredContent).toMatchObject({
      country: "KR",
      matches: [expect.objectContaining({ title: "Lowest First" })]
    });
  });
});
