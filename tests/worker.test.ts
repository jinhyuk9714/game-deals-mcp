import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { GameDealService } from "../src/domain/service.js";
import { createWorkerApp } from "../src/worker.js";

describe("createWorkerApp", () => {
  const stubService = new GameDealService({
    async findDeals() {
      return [];
    },
    async enrichDeals(deals) {
      return deals;
    },
    async resolveDeal() {
      return { kind: "not-found" as const, title: "" };
    }
  });

  it("returns health and root metadata endpoints", async () => {
    const app = createWorkerApp({ service: stubService });

    const root = await app.request("https://example.com/");
    const health = await app.request("https://example.com/health");

    expect(root.status).toBe(200);
    await expect(root.json()).resolves.toMatchObject({
      name: "game-deals-mcp",
      endpoints: {
        health: "/health",
        mcp: "/mcp"
      }
    });

    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ status: "ok" });
  });

  it("rejects sessionless non-initialize POST requests", async () => {
    const app = createWorkerApp({ service: stubService });

    const response = await app.request("https://example.com/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {}
      })
    });

    expect(response.status).toBe(200);
  });

  it("handles initialize without issuing an MCP session header", async () => {
    const app = createWorkerApp({ service: stubService });

    const initResponse = await app.request("https://example.com/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: {
            name: "worker-test",
            version: "1.0.0"
          }
        }
      })
    });

    expect(initResponse.status).toBe(200);
    expect(initResponse.headers.get("mcp-session-id")).toBeNull();
  });

  it("supports SDK clients even when each request hits a fresh worker instance", async () => {
    const client = new Client({ name: "worker-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL("https://example.com/mcp"), {
      fetch: async (input, init) => {
        const request = input instanceof Request ? input : new Request(input, init);

        return createWorkerApp({ service: stubService }).fetch(request);
      }
    });

    await client.connect(transport as Parameters<Client["connect"]>[0]);

    const tools = await client.listTools();

    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "compare_game_price",
      "discover_deals",
      "explain_deal_value",
      "recommend_sale_games"
    ]);
  });

  it("handles CORS preflight for public remote MCP usage", async () => {
    const app = createWorkerApp({ service: stubService });

    const response = await app.request("https://example.com/mcp", {
      method: "OPTIONS",
      headers: {
        origin: "https://claude.ai",
        "access-control-request-method": "POST"
      }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
