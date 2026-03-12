import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

export type QaCategory = "discover" | "compare" | "recommend" | "explain";
export type QaTool =
  | "discover_deals"
  | "compare_game_price"
  | "recommend_sale_games"
  | "explain_deal_value";

export interface QaCase {
  index: number;
  category: QaCategory;
  prompt: string;
  tool: QaTool;
  arguments: Record<string, unknown>;
}

export interface QaTopMatch {
  title: string;
  cut?: number | undefined;
  price?: { amount?: number; currency?: string } | undefined;
  firstStore?: string | undefined;
  deck?: string | undefined;
  multiplayer?: boolean | undefined;
  rating?: number | null | undefined;
  metacritic?: number | null | undefined;
  genres?: string[] | undefined;
}

export interface QaResult extends QaCase {
  isError: boolean;
  summary: string;
  warnings: string[];
  matchCount: number;
  topMatches: QaTopMatch[];
  transportError?: boolean | undefined;
}

export interface QaSummary {
  total: number;
  transportErrors: number;
  errorResults: number;
  zeroMatches: number;
  noisyWarnings: number;
  tooManySubrequests: number;
}

export interface RemoteQaRun {
  generatedAt: string;
  url: string;
  summary: QaSummary;
  results: QaResult[];
}

export const DEFAULT_REMOTE_MCP_URL = "https://game-deals-mcp.jinhyuk9714.workers.dev/mcp";
const QA_CASE_TIMEOUT_MS = 20_000;

export const QA_CASES: QaCase[] = [
  {
    index: 1,
    category: "discover",
    prompt: "2만원 이하 스팀덱용 로그라이크 할인 게임 찾아줘",
    tool: "discover_deals",
    arguments: {
      budget: 20000,
      genres: ["Roguelike"],
      platforms: ["Steam Deck"],
      sort: "best-value",
      country: "KR"
    }
  },
  {
    index: 2,
    category: "discover",
    prompt: "1만원 이하 멀티플레이 액션 할인 게임 찾아줘",
    tool: "discover_deals",
    arguments: {
      budget: 10000,
      genres: ["Action"],
      multiplayer: true,
      platforms: ["PC"],
      sort: "biggest-discount",
      country: "KR"
    }
  },
  {
    index: 3,
    category: "discover",
    prompt: "평가 좋은 전략 할인 게임 추천해줘",
    tool: "discover_deals",
    arguments: {
      budget: 15000,
      genres: ["Strategy"],
      platforms: ["PC"],
      sort: "highest-rating",
      country: "KR"
    }
  },
  {
    index: 4,
    category: "discover",
    prompt: "스팀덱에서 저렴하게 살 수 있는 할인 게임 보여줘",
    tool: "discover_deals",
    arguments: {
      budget: 8000,
      platforms: ["Steam Deck"],
      sort: "lowest-price",
      country: "KR"
    }
  },
  {
    index: 5,
    category: "discover",
    prompt: "2만5천원 이하 RPG 할인 게임 찾아줘",
    tool: "discover_deals",
    arguments: {
      budget: 25000,
      genres: ["RPG"],
      platforms: ["PC"],
      sort: "best-value",
      country: "KR"
    }
  },
  {
    index: 6,
    category: "compare",
    prompt: "Balatro 지금 어디가 제일 싸?",
    tool: "compare_game_price",
    arguments: {
      title: "Balatro",
      country: "KR"
    }
  },
  {
    index: 7,
    category: "compare",
    prompt: "Dead Cells 가격 비교해줘",
    tool: "compare_game_price",
    arguments: {
      title: "Dead Cells",
      country: "KR"
    }
  },
  {
    index: 8,
    category: "compare",
    prompt: "Slay the Spire 가격 비교해줘",
    tool: "compare_game_price",
    arguments: {
      title: "Slay the Spire",
      country: "KR"
    }
  },
  {
    index: 9,
    category: "compare",
    prompt: "Into the Breach 가격 비교해줘",
    tool: "compare_game_price",
    arguments: {
      title: "Into the Breach",
      country: "KR"
    }
  },
  {
    index: 10,
    category: "compare",
    prompt: "Hades 가격 비교해줘",
    tool: "compare_game_price",
    arguments: {
      title: "Hades",
      country: "KR"
    }
  },
  {
    index: 11,
    category: "recommend",
    prompt: "스팀덱에서 하기 좋은 할인 로그라이크 추천해줘",
    tool: "recommend_sale_games",
    arguments: {
      preferences: "스팀덱에서 하기 좋은 로그라이크/로그라이트 위주",
      budget: 20000,
      platforms: ["Steam Deck"],
      country: "KR"
    }
  },
  {
    index: 12,
    category: "recommend",
    prompt: "평가 좋은 전략 할인 게임 추천해줘",
    tool: "recommend_sale_games",
    arguments: {
      preferences: "전략 게임 좋아하고, 할인폭보다 평가 좋은 작품 우선",
      budget: 25000,
      platforms: ["PC"],
      country: "KR"
    }
  },
  {
    index: 13,
    category: "recommend",
    prompt: "친구와 같이 할 협동 할인 게임 추천해줘",
    tool: "recommend_sale_games",
    arguments: {
      preferences: "친구와 같이 할 협동 게임",
      budget: 20000,
      platforms: ["PC"],
      country: "KR"
    }
  },
  {
    index: 14,
    category: "recommend",
    prompt: "짧게 하기 좋은 덱빌딩 할인 게임 추천해줘",
    tool: "recommend_sale_games",
    arguments: {
      preferences: "짧게 하기 좋은 덱빌딩 게임",
      budget: 15000,
      platforms: ["Steam Deck"],
      country: "KR"
    }
  },
  {
    index: 15,
    category: "recommend",
    prompt: "가볍게 즐길 액션 로그라이트 추천해줘",
    tool: "recommend_sale_games",
    arguments: {
      preferences: "가볍게 즐길 액션 로그라이트",
      budget: 18000,
      platforms: ["PC"],
      country: "KR"
    }
  },
  {
    index: 16,
    category: "explain",
    prompt: "Balatro 지금 사도 될까?",
    tool: "explain_deal_value",
    arguments: {
      title: "Balatro",
      country: "KR"
    }
  },
  {
    index: 17,
    category: "explain",
    prompt: "Dead Cells 지금 할인 괜찮아?",
    tool: "explain_deal_value",
    arguments: {
      title: "Dead Cells",
      country: "KR"
    }
  },
  {
    index: 18,
    category: "explain",
    prompt: "Slay the Spire 이번 딜 살 만해?",
    tool: "explain_deal_value",
    arguments: {
      title: "Slay the Spire",
      country: "KR"
    }
  },
  {
    index: 19,
    category: "explain",
    prompt: "Into the Breach 지금 사도 괜찮아?",
    tool: "explain_deal_value",
    arguments: {
      title: "Into the Breach",
      country: "KR"
    }
  },
  {
    index: 20,
    category: "explain",
    prompt: "Vampire Survivors 이번 할인은 어떤 편이야?",
    tool: "explain_deal_value",
    arguments: {
      title: "Vampire Survivors",
      country: "KR"
    }
  }
];

export async function runRemoteQa(url = DEFAULT_REMOTE_MCP_URL): Promise<RemoteQaRun> {
  const results: QaResult[] = [];

  for (const testCase of QA_CASES) {
    results.push(await runQaCase(url, testCase));
  }

  return {
    generatedAt: new Date().toISOString(),
    url,
    summary: summarizeQaResults(results),
    results
  };
}

async function runQaCase(url: string, testCase: QaCase): Promise<QaResult> {
  const client = new Client({ name: "game-deals-mcp-qa", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(url));

  try {
    const result = await withTimeout(
      (async () => {
        await client.connect(transport as Parameters<Client["connect"]>[0]);
        return client.callTool(
          {
            name: testCase.tool,
            arguments: testCase.arguments
          },
          CallToolResultSchema
        );
      })(),
      QA_CASE_TIMEOUT_MS,
      `QA case ${testCase.index} timed out`
    );

    const structured = normalizeStructuredContent(result.structuredContent);
    const matches = Array.isArray(structured.matches) ? structured.matches : [];

    return {
      ...testCase,
      isError: Boolean(result.isError),
      summary: typeof structured.summary === "string" ? structured.summary : "",
      warnings: Array.isArray(structured.warnings)
        ? structured.warnings.filter((warning): warning is string => typeof warning === "string")
        : [],
      matchCount: matches.length,
      topMatches: matches.slice(0, 3).map(toTopMatch)
    };
  } catch (error) {
    return {
      ...testCase,
      isError: true,
      summary: error instanceof Error ? error.message : "알 수 없는 전송 오류가 발생했습니다.",
      warnings: [],
      matchCount: 0,
      topMatches: [],
      transportError: true
    };
  } finally {
    void transport.close().catch(() => {});
    void client.close().catch(() => {});
  }
}

export function summarizeQaResults(results: QaResult[]): QaSummary {
  return {
    total: results.length,
    transportErrors: results.filter((result) => result.transportError).length,
    errorResults: results.filter((result) => result.isError && !result.transportError).length,
    zeroMatches: results.filter(
      (result) => !result.isError && !result.transportError && result.matchCount === 0
    ).length,
    noisyWarnings: results.filter((result) => result.warnings.length >= 3).length,
    tooManySubrequests: results.filter((result) =>
      result.warnings.some((warning) => warning.includes("Too many subrequests"))
    ).length
  };
}

function normalizeStructuredContent(
  value: unknown
): Record<string, unknown> & { matches?: unknown[]; warnings?: unknown[]; summary?: unknown } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown> & {
      matches?: unknown[];
      warnings?: unknown[];
      summary?: unknown;
    };
  }

  return {};
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function toTopMatch(match: unknown): QaTopMatch {
  if (!match || typeof match !== "object" || Array.isArray(match)) {
    return { title: "unknown" };
  }

  const candidate = match as Record<string, unknown>;
  const stores = Array.isArray(candidate.stores) ? candidate.stores : [];
  const firstStore = stores[0];
  const firstStoreName =
    firstStore && typeof firstStore === "object" && !Array.isArray(firstStore)
      ? (firstStore as Record<string, unknown>).store
      : undefined;
  const deckCompatibility = candidate.steamDeckCompatibility;
  const deckStatus =
    deckCompatibility && typeof deckCompatibility === "object" && !Array.isArray(deckCompatibility)
      ? (deckCompatibility as Record<string, unknown>).status
      : undefined;

  return {
    title: typeof candidate.title === "string" ? candidate.title : "unknown",
    cut: typeof candidate.cut === "number" ? candidate.cut : undefined,
    price:
      candidate.price && typeof candidate.price === "object" && !Array.isArray(candidate.price)
        ? (candidate.price as { amount?: number; currency?: string })
        : undefined,
    firstStore: typeof firstStoreName === "string" ? firstStoreName : undefined,
    deck: typeof deckStatus === "string" ? deckStatus : undefined,
    multiplayer: typeof candidate.multiplayer === "boolean" ? candidate.multiplayer : undefined,
    rating: typeof candidate.rating === "number" ? candidate.rating : null,
    metacritic: typeof candidate.metacritic === "number" ? candidate.metacritic : null,
    genres: Array.isArray(candidate.genres)
      ? candidate.genres.filter((genre): genre is string => typeof genre === "string")
      : undefined
  };
}
