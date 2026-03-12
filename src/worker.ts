import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { ConfigSource } from "./config.js";
import { GameDealService } from "./domain/service.js";
import { createDefaultService, createMcpServer, MCP_SERVER_INFO } from "./server.js";

const MCP_SESSION_HEADER = "mcp-session-id";
const defaultSessions = new Map<string, WorkerSession>();

let cachedWorkerApp: Hono<{ Bindings: ConfigSource }> | undefined;
let cachedEnvKey: string | undefined;

interface WorkerSession {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
}

interface CreateWorkerAppOptions {
  service?: GameDealService;
  env?: ConfigSource;
  sessionStore?: Map<string, WorkerSession>;
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

async function createSessionRuntime(
  service: GameDealService,
  sessions: Map<string, WorkerSession>
) {
  let runtime: WorkerSession | undefined;

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized(sessionId) {
      if (runtime) {
        sessions.set(sessionId, runtime);
      }
    },
    onsessionclosed(sessionId) {
      sessions.delete(sessionId);
    }
  });

  const server = await createMcpServer({ service });
  runtime = { server, transport };
  await server.connect(transport);

  return runtime;
}

export function createWorkerApp(options: CreateWorkerAppOptions = {}) {
  const service = options.service ?? createDefaultService(options.env);
  const sessions = options.sessionStore ?? new Map<string, WorkerSession>();
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
    const request = c.req.raw;
    const sessionId = request.headers.get(MCP_SESSION_HEADER);

    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        return createJsonErrorResponse(404, -32001, "Session not found");
      }

      return session.transport.handleRequest(request);
    }

    const runtime = await createSessionRuntime(service, sessions);
    return runtime.transport.handleRequest(request);
  });

  return app;
}

function getOrCreateWorkerApp(env: ConfigSource) {
  const key = envKey(env);

  if (!cachedWorkerApp || cachedEnvKey !== key) {
    defaultSessions.clear();
    cachedEnvKey = key;
    cachedWorkerApp = createWorkerApp({
      env,
      sessionStore: defaultSessions
    });
  }

  return cachedWorkerApp;
}

export default {
  fetch(request: Request, env: ConfigSource, executionContext?: unknown) {
    return getOrCreateWorkerApp(env).fetch(request, env as never, executionContext as never);
  }
};
