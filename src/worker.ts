import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { ConfigSource } from "./config.js";
import { GameDealService } from "./domain/service.js";
import { createDefaultService, createMcpServer, MCP_SERVER_INFO } from "./server.js";

let cachedWorkerApp: Hono<{ Bindings: ConfigSource }> | undefined;
let cachedEnvKey: string | undefined;

interface CreateWorkerAppOptions {
  service?: GameDealService;
  env?: ConfigSource;
}

function createJsonErrorResponse(status: number, code: number, message: string) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code,
        message
      },
      id: null
    }),
    {
      status,
      headers: {
        "content-type": "application/json"
      }
    }
  );
}

function envKey(env: ConfigSource | undefined) {
  return `${env?.ITAD_API_KEY ?? ""}:${env?.RAWG_API_KEY ?? ""}`;
}

async function createRequestRuntime(service: GameDealService) {
  const transport = new WebStandardStreamableHTTPServerTransport();

  const server = await createMcpServer({ service });
  await server.connect(transport);

  return { server, transport };
}

export function createWorkerApp(options: CreateWorkerAppOptions = {}) {
  const service = options.service ?? createDefaultService(options.env);
  const app = new Hono<{ Bindings: ConfigSource }>();

  app.use(
    "/mcp",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Accept",
        "Content-Type",
        "Last-Event-ID",
        "Mcp-Protocol-Version",
        "Mcp-Session-Id"
      ],
      exposeHeaders: ["Mcp-Session-Id"],
      maxAge: 86400
    })
  );

  app.get("/", (c) =>
    c.json({
      name: MCP_SERVER_INFO.name,
      version: MCP_SERVER_INFO.version,
      transport: "streamable-http",
      endpoints: {
        health: "/health",
        mcp: "/mcp"
      }
    })
  );

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.options("/mcp", (c) => c.body(null, 204));

  app.on(["GET", "POST", "DELETE"], "/mcp", async (c) => {
    const runtime = await createRequestRuntime(service);
    return runtime.transport.handleRequest(c.req.raw);
  });

  return app;
}

function getOrCreateWorkerApp(env: ConfigSource) {
  const key = envKey(env);

  if (!cachedWorkerApp || cachedEnvKey !== key) {
    cachedEnvKey = key;
    cachedWorkerApp = createWorkerApp({ env });
  }

  return cachedWorkerApp;
}

export default {
  fetch(request: Request, env: ConfigSource, executionContext?: unknown) {
    return getOrCreateWorkerApp(env).fetch(request, env as never, executionContext as never);
  }
};
