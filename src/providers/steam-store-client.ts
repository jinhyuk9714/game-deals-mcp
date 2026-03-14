import { TtlCache } from "../cache/ttl-cache.js";
import type { DealCandidate, DealsEnrichment, SteamDeckCompatibility } from "../domain/score.js";
import { bindFetchImplementation } from "./fetch-impl.js";

interface SteamStoreClientOptions {
  fetch?: typeof fetch;
  baseUrl?: string;
  cache?: TtlCache<string, unknown>;
  lookupTimeoutMs?: number;
  concurrency?: number;
}

interface SteamSearchResponse {
  results_html?: string;
}

interface DeckCompatibilityPayload {
  appid?: number;
  resolved_category?: number;
  resolved_items?: Array<{ loc_token?: string }>;
}

export class SteamStoreClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly cache: TtlCache<string, unknown>;
  private readonly lookupTimeoutMs: number;
  private readonly concurrency: number;

  constructor(options: SteamStoreClientOptions = {}) {
    this.fetchImpl = bindFetchImplementation(options.fetch);
    this.baseUrl = options.baseUrl ?? "https://store.steampowered.com";
    this.cache = options.cache ?? new TtlCache<string, unknown>();
    this.lookupTimeoutMs = normalizePositiveInt(options.lookupTimeoutMs, 2_500);
    this.concurrency = normalizePositiveInt(options.concurrency, 2);
  }

  async enrichDeals(deals: DealCandidate[]): Promise<DealsEnrichment> {
    const results = new Array<{ deal: DealCandidate; warning?: string }>(deals.length);
    let cursor = 0;

    const workers = Array.from(
      { length: Math.min(this.concurrency, Math.max(deals.length, 1)) },
      async () => {
        while (true) {
          const current = cursor;
          cursor += 1;

          if (current >= deals.length) {
            return;
          }

          results[current] = await this.enrichDeal(deals[current]!);
        }
      }
    );

    await Promise.all(workers);

    return {
      deals: results.map((result) => result.deal),
      warnings: results.flatMap((result) => (result.warning ? [result.warning] : []))
    };
  }

  private async enrichDeal(deal: DealCandidate): Promise<{ deal: DealCandidate; warning?: string }> {
    try {
      const budget = createLookupBudget(this.lookupTimeoutMs);
      const compatibility = await this.resolveCompatibility(deal, budget);
      const warning =
        compatibility.status === "unknown"
          ? "Steam Deck 호환성 정보를 확인하지 못했습니다."
          : undefined;

      return {
        deal: {
          ...deal,
          steamDeckCompatibility: compatibility
        },
        ...(warning ? { warning } : {})
      };
    } catch {
      return {
        deal: {
          ...deal,
          steamDeckCompatibility: {
            status: "unknown",
            details: [],
            source: "steam"
          } satisfies SteamDeckCompatibility
        },
        warning: "Steam Deck 호환성 정보를 확인하지 못했습니다."
      };
    }
  }

  private async resolveCompatibility(
    deal: DealCandidate,
    budget: LookupBudget
  ): Promise<SteamDeckCompatibility> {
    const appId = (await this.resolveAppId(deal, budget)) ?? undefined;

    if (!appId) {
      return {
        status: "unknown",
        details: [],
        source: "steam"
      };
    }

    const html = await this.fetchText(
      new URL(`/app/${appId}/?cc=kr&l=koreana`, this.baseUrl),
      600_000,
      budget
    );
    const payload = extractDeckCompatibility(html);

    if (!payload) {
      return {
        status: "unknown",
        details: [],
        steamAppId: appId,
        source: "steam"
      };
    }

    return {
      status: mapDeckStatus(payload.resolved_category),
      details: (payload.resolved_items ?? [])
        .map((item) => item.loc_token)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .map(formatDeckDetail),
      steamAppId: payload.appid ?? appId,
      source: "steam"
    };
  }

  private async resolveAppId(deal: DealCandidate, budget: LookupBudget): Promise<number | null> {
    for (const offer of deal.stores ?? []) {
      if (offer.store.toLowerCase() !== "steam") {
        continue;
      }

      const appId = extractSteamAppId(offer.url);
      if (appId) {
        return appId;
      }

      const redirectedAppId = await this.resolveRedirectedSteamAppId(offer.url, budget);
      if (redirectedAppId) {
        return redirectedAppId;
      }
    }

    const searchUrl = new URL("/search/results/", this.baseUrl);
    searchUrl.searchParams.set("term", deal.title);
    searchUrl.searchParams.set("start", "0");
    searchUrl.searchParams.set("count", "5");
    searchUrl.searchParams.set("cc", "kr");
    searchUrl.searchParams.set("l", "koreana");
    searchUrl.searchParams.set("infinite", "1");

    const response = await this.fetchJson<SteamSearchResponse>(searchUrl, 600_000, budget);
    return findBestSteamSearchMatch(response.results_html ?? "", deal.title);
  }

  private async resolveRedirectedSteamAppId(
    url: string | null | undefined,
    budget: LookupBudget
  ): Promise<number | null> {
    if (!url) {
      return null;
    }

    const firstLocation = await this.fetchRedirectLocation(url, budget);
    const directAppId = extractSteamAppId(firstLocation);
    if (directAppId) {
      return directAppId;
    }

    if (firstLocation) {
      const secondLocation = await this.fetchRedirectLocation(firstLocation, budget);
      return extractSteamAppId(secondLocation);
    }

    return null;
  }

  private async fetchJson<T>(url: URL, ttlMs: number, budget: LookupBudget): Promise<T> {
    return this.withLookupDeadline(
      this.cache.getOrLoad(url.toString(), ttlMs, async () => {
        const response = await this.fetchWithBudget(url, budget, {
          headers: buildSteamHeaders()
        });
        if (!response.ok) {
          throw new Error(`Steam request failed with ${response.status}`);
        }

        return (await response.json()) as T;
      }) as Promise<T>,
      budget
    );
  }

  private async fetchText(url: URL, ttlMs: number, budget: LookupBudget): Promise<string> {
    return this.withLookupDeadline(
      this.cache.getOrLoad(url.toString(), ttlMs, async () => {
        const response = await this.fetchWithBudget(url, budget, {
          headers: buildSteamHeaders()
        });
        if (!response.ok) {
          throw new Error(`Steam request failed with ${response.status}`);
        }

        return await response.text();
      }) as Promise<string>,
      budget
    );
  }

  private async fetchRedirectLocation(
    url: string,
    budget: LookupBudget,
    ttlMs = 600_000
  ): Promise<string | null> {
    const cacheKey = `steam-redirect:${url}`;

    return this.withLookupDeadline(
      this.cache.getOrLoad(cacheKey, ttlMs, async () => {
        const response = await this.fetchWithBudget(url, budget, {
          headers: buildSteamHeaders(),
          redirect: "manual"
        });

        return response.headers.get("location");
      }) as Promise<string | null>,
      budget
    );
  }

  private async withLookupDeadline<T>(promise: Promise<T>, budget: LookupBudget): Promise<T> {
    const remainingMs = getRemainingLookupMs(budget);
    if (remainingMs <= 0) {
      throw new SteamLookupTimeoutError();
    }

    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new SteamLookupTimeoutError()), remainingMs);

      void promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  private async fetchWithBudget(
    input: URL | string,
    budget: LookupBudget,
    init: RequestInit
  ): Promise<Response> {
    const remainingMs = getRemainingLookupMs(budget);
    if (remainingMs <= 0) {
      throw new SteamLookupTimeoutError();
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remainingMs);

    try {
      return await this.fetchImpl(input, {
        ...init,
        signal: controller.signal
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new SteamLookupTimeoutError();
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

interface LookupBudget {
  deadlineAt: number;
}

class SteamLookupTimeoutError extends Error {
  constructor() {
    super("Steam lookup timed out");
    this.name = "SteamLookupTimeoutError";
  }
}

function extractSteamAppId(url?: string | null): number | null {
  if (!url) {
    return null;
  }

  const match = url.match(/\/app\/(\d+)\//);
  return match ? Number(match[1]) : null;
}

function findBestSteamSearchMatch(html: string, title: string): number | null {
  const candidates = [...html.matchAll(/href="https:\/\/store\.steampowered\.com\/app\/(\d+)\/[^"]*".*?<span class="title">([^<]+)<\/span>/g)]
    .map((match) => ({
      appId: Number(match[1]),
      title: decodeHtml(match[2] ?? "")
    }))
    .filter((candidate) => candidate.title.length > 0);

  const normalizedTitle = normalizeTitle(title);
  const exact = candidates.find((candidate) => normalizeTitle(candidate.title) === normalizedTitle);
  if (exact) {
    return exact.appId;
  }

  const near = candidates.find((candidate) => {
    const candidateTitle = normalizeTitle(candidate.title);
    return candidateTitle.includes(normalizedTitle) || normalizedTitle.includes(candidateTitle);
  });

  return near?.appId ?? null;
}

function extractDeckCompatibility(html: string): DeckCompatibilityPayload | null {
  const match = html.match(/data-deckcompatibility="([^"]+)"/);
  if (!match?.[1]) {
    return null;
  }

  return JSON.parse(decodeHtml(match[1])) as DeckCompatibilityPayload;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "")
    .trim();
}

function mapDeckStatus(category?: number): SteamDeckCompatibility["status"] {
  switch (category) {
    case 3:
      return "verified";
    case 2:
      return "playable";
    case 1:
      return "unsupported";
    default:
      return "unknown";
  }
}

function createLookupBudget(timeoutMs: number): LookupBudget {
  return {
    deadlineAt: Date.now() + timeoutMs
  };
}

function getRemainingLookupMs(budget: LookupBudget): number {
  return budget.deadlineAt - Date.now();
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function formatDeckDetail(token: string): string {
  const cleaned = token
    .replace(/^#SteamDeckVerified_TestResult_/, "")
    .replace(/^#SteamOS_TestResult_/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function buildSteamHeaders(): Record<string, string> {
  return {
    "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    referer: "https://store.steampowered.com/"
  };
}
