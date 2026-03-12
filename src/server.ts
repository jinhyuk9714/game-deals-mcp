import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { ConfigSource } from "./config.js";
import { readConfig } from "./config.js";
import { GameDealService } from "./domain/service.js";
import { TtlCache } from "./cache/ttl-cache.js";
import { GameDataGateway } from "./providers/game-data-gateway.js";
import { IsThereAnyDealClient } from "./providers/itad-client.js";
import { RawgClient } from "./providers/rawg-client.js";
import { SteamStoreClient } from "./providers/steam-store-client.js";
import {
  callCompareGamePriceTool,
  callDiscoverDealsTool,
  callExplainDealValueTool,
  callRecommendSaleGamesTool
} from "./tools/handlers.js";

export const MCP_SERVER_INFO = {
  name: "game-deal-explorer-mcp",
  version: "0.1.0"
} as const;

export async function createMcpServer(options?: {
  service?: GameDealService;
  env?: ConfigSource;
}) {
  const server = new McpServer(
    MCP_SERVER_INFO,
    {
      capabilities: {
        logging: {}
      }
    }
  );

  const service = options?.service ?? createDefaultService(options?.env);

  server.registerTool(
    "discover_deals",
    {
      description: "조건에 맞는 현재 할인 게임을 추천합니다.",
      inputSchema: z.object({
        budget: z.number().optional(),
        genres: z.array(z.string()).optional(),
        platforms: z.array(z.string()).optional(),
        multiplayer: z.boolean().optional(),
        sort: z
          .enum([
            "best-value",
            "biggest-discount",
            "lowest-price",
            "highest-rating",
            "savings",
            "price"
          ])
          .optional(),
        country: z.string().optional()
      })
    },
    (args) => callDiscoverDealsTool(service, args)
  );

  server.registerTool(
    "compare_game_price",
    {
      description: "특정 게임의 현재 가격과 역대 최저가를 비교합니다.",
      inputSchema: z.object({
        title: z.string(),
        country: z.string().optional()
      })
    },
    (args) => callCompareGamePriceTool(service, args)
  );

  server.registerTool(
    "recommend_sale_games",
    {
      description: "예산과 취향을 바탕으로 할인 중인 게임을 추천합니다.",
      inputSchema: z.object({
        preferences: z.string(),
        budget: z.number().optional(),
        platforms: z.array(z.string()).optional(),
        excludeGenres: z.array(z.string()).optional(),
        country: z.string().optional()
      })
    },
    (args) => callRecommendSaleGamesTool(service, args)
  );

  server.registerTool(
    "explain_deal_value",
    {
      description: "현재 할인 딜이 살 만한 수준인지 설명합니다.",
      inputSchema: z.object({
        title: z.string(),
        country: z.string().optional()
      })
    },
    (args) => callExplainDealValueTool(service, args)
  );

  return server;
}

export function createDefaultService(env?: ConfigSource) {
  const config = readConfig(env);

  if (!config.ITAD_API_KEY || !config.RAWG_API_KEY) {
    return new GameDealService({
      async findDeals() {
        throw new Error("ITAD_API_KEY와 RAWG_API_KEY를 설정한 뒤 다시 시도해 주세요.");
      },
      async enrichDeals(deals) {
        return deals;
      },
      async resolveDeal() {
        throw new Error("ITAD_API_KEY와 RAWG_API_KEY를 설정한 뒤 다시 시도해 주세요.");
      }
    });
  }

  const sharedCache = new TtlCache<string, unknown>();
  const gateway = new GameDataGateway(
    new IsThereAnyDealClient({
      apiKey: config.ITAD_API_KEY,
      cache: sharedCache
    }),
    new RawgClient({
      apiKey: config.RAWG_API_KEY,
      cache: sharedCache
    }),
    new SteamStoreClient({
      cache: sharedCache
    })
  );

  return new GameDealService(gateway);
}
