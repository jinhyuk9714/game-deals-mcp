import type { TitleCandidate } from "../domain/match.js";
import { TtlCache } from "../cache/ttl-cache.js";
import { bindFetchImplementation } from "./fetch-impl.js";

export interface RawgMetadata extends TitleCandidate {
  genres: string[];
  platforms: string[];
  tags: string[];
  rating?: number | null;
  metacritic?: number | null;
  multiplayer: boolean;
}

interface RawgClientOptions {
  apiKey: string;
  fetch?: typeof fetch;
  baseUrl?: string;
  cache?: TtlCache<string, unknown>;
}

export class RawgClient {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly cache: TtlCache<string, unknown>;

  constructor(options: RawgClientOptions) {
    this.apiKey = options.apiKey;
    this.fetchImpl = bindFetchImplementation(options.fetch);
    this.baseUrl = options.baseUrl ?? "https://api.rawg.io/api";
    this.cache = options.cache ?? new TtlCache<string, unknown>();
  }

  async searchGames(query: string): Promise<RawgMetadata[]> {
    const url = this.createGamesUrl();
    url.searchParams.set("search", query);
    url.searchParams.set("search_exact", "true");
    url.searchParams.set("page_size", "5");

    return this.fetchGames(url);
  }

  async discoverGames(args: {
    tags?: string[] | undefined;
    genres?: string[] | undefined;
    limit?: number | undefined;
  }): Promise<RawgMetadata[]> {
    const url = this.createGamesUrl();
    url.searchParams.set("page_size", String(args.limit ?? 12));
    url.searchParams.set("ordering", "-rating");

    if ((args.tags ?? []).length > 0) {
      url.searchParams.set("tags", args.tags!.join(","));
    }

    if ((args.genres ?? []).length > 0) {
      url.searchParams.set("genres", args.genres!.join(","));
    }

    return this.fetchGames(url);
  }

  private createGamesUrl(): URL {
    const url = new URL("games", ensureTrailingSlash(this.baseUrl));
    url.searchParams.set("key", this.apiKey);
    return url;
  }

  private async fetchGames(url: URL): Promise<RawgMetadata[]> {
    const response = (await this.cache.getOrLoad(url.toString(), 600_000, async () => {
      const request = await this.fetchImpl(url);
      if (!request.ok) {
        throw new Error(`RAWG request failed with ${request.status}`);
      }

      return (await request.json()) as RawgResponse;
    })) as RawgResponse;

    return (response.results ?? []).map((item) => ({
      title: item.name,
      released: item.released ?? null,
      genres: (item.genres ?? []).map((genre) => genre.name),
      platforms: (item.platforms ?? []).map((platform) => platform.platform.name),
      tags: (item.tags ?? []).map((tag) => tag.name),
      rating: item.rating ?? null,
      metacritic: item.metacritic ?? null,
      multiplayer: inferMultiplayer(item.tags, item.genres)
    }));
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

interface RawgResponse {
  results?: Array<{
    name: string;
    released?: string | null;
    rating?: number | null;
    metacritic?: number | null;
    genres?: Array<{ name: string }>;
    platforms?: Array<{ platform: { name: string } }>;
    tags?: Array<{ name: string }>;
  }>;
}

function inferMultiplayer(
  tags?: Array<{ name: string }>,
  genres?: Array<{ name: string }>
): boolean {
  const values = [...(tags ?? []), ...(genres ?? [])].map((entry) => entry.name.toLowerCase());
  return values.some(
    (value) =>
      value.includes("multiplayer") ||
      value.includes("co-op") ||
      value.includes("coop") ||
      value.includes("online co op")
  );
}
