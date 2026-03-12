import type { DiscoverFilters, DealCandidate, PricePoint, StoreOffer } from "../domain/score.js";
import { TtlCache } from "../cache/ttl-cache.js";

export interface DealResolution {
  kind: "match" | "ambiguous" | "not-found";
  title: string;
  matches?: DealCandidate[];
  candidates?: Array<{ id: string; title: string }>;
  warnings?: string[];
}

export interface ResolveDealOptions {
  preferredShops?: number[] | undefined;
  dealsOnly?: boolean | undefined;
}

interface ItadClientOptions {
  apiKey: string;
  fetch?: typeof fetch;
  baseUrl?: string;
  cache?: TtlCache<string, unknown>;
}

export class IsThereAnyDealClient {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly cache: TtlCache<string, unknown>;

  constructor(options: ItadClientOptions) {
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetch ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://api.isthereanydeal.com";
    this.cache = options.cache ?? new TtlCache<string, unknown>();
  }

  async findDeals(args: DiscoverFilters & { country: string }): Promise<DealCandidate[]> {
    const url = new URL("/deals/v2", this.baseUrl);

    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("country", args.country);
    url.searchParams.set("limit", "100");
    url.searchParams.set("sort", mapSortToItad(args.sort));

    if (typeof args.budget === "number") {
      url.searchParams.set("priceTo", String(args.budget));
    }

    if ((args.preferredShops?.length ?? 0) > 0) {
      url.searchParams.set("shops", args.preferredShops!.join(","));
    }

    const response = await this.getJson<DealsResponse>(url, 600_000);
    return (response.list ?? []).filter(isDiscoverableDeal).map(mapDealRow);
  }

  async resolveDeal(
    title: string,
    country: string,
    options: ResolveDealOptions = {}
  ): Promise<DealResolution> {
    const searchUrl = new URL("/games/lookup/v1", this.baseUrl);

    searchUrl.searchParams.set("key", this.apiKey);
    searchUrl.searchParams.set("title", title);

    const search = await this.getJson<LookupResponse>(searchUrl, 600_000);
    const found = normalizeLookupResults(search);

    if (found.length === 0) {
      return {
        kind: "not-found",
        title
      };
    }

    if (found.length > 1) {
      return {
        kind: "ambiguous",
        title,
        candidates: found.map((item) => ({ id: item.id, title: item.title }))
      };
    }

    const matched = found[0]!;
    const warnings: string[] = [];

    if ((options.preferredShops?.length ?? 0) > 0) {
      let pricesEntry: PricesEntry | undefined;

      try {
        pricesEntry = await this.fetchPrices(matched.id, country, options);
      } catch (error) {
        warnings.push(
          toWarning(error, "상점별 할인 가격을 가져오지 못해 제목만 확인했습니다.")
        );
      }

      const parsed = mapResolvedPriceDeal(matched, pricesEntry, country);
      if ((parsed.stores?.length ?? 0) === 0) {
        warnings.push("지정한 상점 범위에서 현재 할인 가격을 찾지 못했습니다.");
      }

      return {
        kind: "match",
        title: parsed.title,
        matches: [parsed],
        warnings
      };
    }

    let overviewEntry: OverviewEntry | undefined;
    let historyEntry: HistoryLowEntry | undefined;

    try {
      overviewEntry = await this.fetchOverview(matched.id, country);
    } catch (error) {
      warnings.push(toWarning(error, "가격 개요 정보를 가져오지 못해 일부 데이터만 표시합니다."));
    }

    try {
      historyEntry = await this.fetchHistoryLow(matched.id, country);
    } catch (error) {
      warnings.push(toWarning(error, "역대 최저가 정보를 가져오지 못해 현재 가격만 표시합니다."));
    }

    const parsed = mapResolvedDeal(matched, overviewEntry, historyEntry, country);

    if (!overviewEntry?.current) {
      warnings.push("가격 개요 정보가 없어 제목만 확인했습니다.");
    }

    return {
      kind: "match",
      title: parsed.title,
      matches: [parsed],
      warnings
    };
  }

  private async fetchOverview(id: string, country: string): Promise<OverviewEntry | undefined> {
    const url = new URL("/games/overview/v2", this.baseUrl);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("country", country);

    const response = await this.getJson<OverviewResponse>(url, 900_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([id])
    });

    return (response.prices ?? []).find((entry) => entry.id === id);
  }

  private async fetchHistoryLow(id: string, country: string): Promise<HistoryLowEntry | undefined> {
    const url = new URL("/games/historylow/v1", this.baseUrl);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("country", country);

    const response = await this.getJson<HistoryLowResponse>(url, 900_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([id])
    });

    return response.find((entry) => entry.id === id);
  }

  private async fetchPrices(
    id: string,
    country: string,
    options: ResolveDealOptions
  ): Promise<PricesEntry | undefined> {
    const url = new URL("/games/prices/v3", this.baseUrl);
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("country", country);

    if ((options.preferredShops?.length ?? 0) > 0) {
      url.searchParams.set("shops", options.preferredShops!.join(","));
    }

    if (options.dealsOnly) {
      url.searchParams.set("deals", "true");
    }

    const response = await this.getJson<PricesResponse>(url, 900_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([id])
    });

    return response.find((entry) => entry.id === id);
  }

  private async getJson<T>(url: URL, ttlMs: number, init?: RequestInit): Promise<T> {
    const cacheKey = buildCacheKey(url, init);

    return this.cache.getOrLoad(cacheKey, ttlMs, async () => {
      const response = await this.fetchImpl(url, init);

      if (!response.ok) {
        throw new Error(`ITAD request failed with ${response.status}`);
      }

      return (await response.json()) as T;
    }) as Promise<T>;
  }
}

interface DealsResponse {
  list?: Array<{
    id?: string;
    title?: string;
    type?: string;
    game?: {
      id?: string;
      title?: string;
      genres?: Array<{ name?: string } | string>;
      platforms?: Array<{ name?: string } | string>;
    };
    deal?: {
      price?: { amount?: number; currency?: string };
      regular?: { amount?: number; currency?: string };
      cut?: number;
    };
  }>;
}

type LookupResponse =
  | {
      found: true;
      game: {
        id: string;
        title: string;
      };
    }
  | {
      found: false;
      alternatives?: Array<{ id: string; title: string }>;
    }
  | {
      found?: Array<{ id: string; title: string }>;
      results?: Array<{ id: string; title: string }>;
      id?: string;
      title?: string;
    };

interface PriceOffer {
  shop?: { name?: string };
  price?: { amount?: number; currency?: string };
  regular?: { amount?: number; currency?: string };
  cut?: number;
  url?: string | null;
}

function mapSortToItad(sort?: DiscoverFilters["sort"]): string {
  switch (sort) {
    case "lowest-price":
      return "price";
    case "biggest-discount":
    case "best-value":
    case "highest-rating":
    default:
      return "-cut";
  }
}

type DealRow = NonNullable<DealsResponse["list"]>[number];

function mapDealRow(row: DealRow): DealCandidate {
  const title = row?.title ?? row?.game?.title ?? "Unknown Game";
  const id = row?.game?.id ?? row?.id ?? title;
  const price = {
    amount: row?.deal?.price?.amount ?? 0,
    currency: row?.deal?.price?.currency ?? "USD"
  };
  const regular = {
    amount: row?.deal?.regular?.amount ?? price.amount,
    currency: row?.deal?.regular?.currency ?? price.currency
  };

  return {
    id,
    title,
    price,
    regular,
    cut: row?.deal?.cut ?? calculateCut(price.amount, regular.amount),
    genres: mapNamedValues(row?.game?.genres),
    platforms: mapNamedValues(row?.game?.platforms),
    multiplayer: false,
    metadataStatus:
      mapNamedValues(row?.game?.genres).length > 0 || mapNamedValues(row?.game?.platforms).length > 0
        ? "itad"
        : "missing"
  };
}

function mapResolvedDeal(
  found: { id: string; title: string },
  overview: OverviewEntry | undefined,
  history: HistoryLowEntry | undefined,
  fallbackCountry: string
): DealCandidate {
  const current = overview?.current;
  const currentStore = current ? mapStoreOffer(current) : null;
  const stores = currentStore ? [currentStore] : [];
  const price = currentStore?.price ?? { amount: 0, currency: getDefaultCurrency(fallbackCountry) };
  const regular =
    currentStore?.regular ?? {
      amount: price.amount,
      currency: price.currency
    };
  const lowPrice = toPricePoint(history?.low?.price) ?? toPricePoint(overview?.lowest?.price);

  return {
    id: found.id,
    title: found.title,
    price,
    regular,
    cut: currentStore?.cut ?? calculateCut(price.amount, regular.amount),
    genres: [],
    platforms: [],
    multiplayer: false,
    historyLow: lowPrice,
    stores
  };
}

function calculateCut(price: number, regular: number): number {
  if (price <= 0 || regular <= 0 || regular <= price) {
    return 0;
  }

  return Math.round(((regular - price) / regular) * 100);
}

function normalizeLookupResults(response: LookupResponse): Array<{ id: string; title: string }> {
  if ("found" in response && response.found === true) {
    return response.game?.id && response.game?.title
      ? [{ id: response.game.id, title: response.game.title }]
      : [];
  }

  if ("id" in response && typeof response.id === "string" && typeof response.title === "string") {
    return [{ id: response.id, title: response.title }];
  }

  if ("alternatives" in response && Array.isArray(response.alternatives)) {
    return response.alternatives;
  }

  if (Array.isArray(response.found)) {
    return response.found;
  }

  return "results" in response ? response.results ?? [] : [];
}

interface OverviewEntry {
  id?: string;
  current?: PriceOffer;
  lowest?: PriceOffer;
}

interface OverviewResponse {
  prices?: OverviewEntry[];
}

interface HistoryLowEntry {
  id?: string;
  low?: PriceOffer;
}

type HistoryLowResponse = HistoryLowEntry[];

interface PricesEntry {
  id?: string;
  historyLow?: {
    all?: { amount?: number; currency?: string };
    y1?: { amount?: number; currency?: string };
    m3?: { amount?: number; currency?: string };
  };
  deals?: Array<{
    shop?: { id?: number; name?: string };
    price?: { amount?: number; currency?: string };
    regular?: { amount?: number; currency?: string };
    cut?: number;
    url?: string | null;
  }>;
}

type PricesResponse = PricesEntry[];

function mapStoreOffer(offer: PriceOffer): StoreOffer {
  const price = toPricePoint(offer.price) ?? { amount: 0, currency: "USD" };
  const regular =
    toPricePoint(offer.regular) ?? {
      amount: price.amount,
      currency: price.currency
    };

  return {
    store: offer.shop?.name ?? "Unknown Store",
    price,
    regular,
    cut: offer.cut ?? calculateCut(price.amount, regular.amount),
    url: offer.url ?? null
  };
}

function mapResolvedPriceDeal(
  found: { id: string; title: string },
  pricesEntry: PricesEntry | undefined,
  fallbackCountry: string
): DealCandidate {
  const currentStore = pickBestPriceOffer(pricesEntry?.deals);
  const stores = (pricesEntry?.deals ?? []).map(mapPricesStoreOffer);
  const price = currentStore?.price ?? { amount: 0, currency: getDefaultCurrency(fallbackCountry) };
  const regular =
    currentStore?.regular ?? {
      amount: price.amount,
      currency: price.currency
    };

  return {
    id: found.id,
    title: found.title,
    price,
    regular,
    cut: currentStore?.cut ?? calculateCut(price.amount, regular.amount),
    genres: [],
    platforms: [],
    multiplayer: false,
    historyLow:
      toPricePoint(pricesEntry?.historyLow?.all) ??
      toPricePoint(pricesEntry?.historyLow?.y1) ??
      toPricePoint(pricesEntry?.historyLow?.m3),
    stores
  };
}

function pickBestPriceOffer(
  deals?: PricesEntry["deals"]
): { price: PricePoint; regular: PricePoint; cut: number; url?: string | null } | null {
  type ResolvedPriceOffer = {
    price: PricePoint;
    regular: PricePoint;
    cut: number;
    url: string | null;
  };

  const ranked = (deals ?? [])
    .map((deal) => {
      const price = toPricePoint(deal.price);
      if (!price) {
        return null;
      }

      const regular =
        toPricePoint(deal.regular) ?? {
          amount: price.amount,
          currency: price.currency
        };

      return {
        price,
        regular,
        cut: deal.cut ?? calculateCut(price.amount, regular.amount),
        url: deal.url ?? null
      } satisfies ResolvedPriceOffer;
    })
    .filter((deal): deal is ResolvedPriceOffer => deal !== null)
    .sort((left, right) => left.price.amount - right.price.amount || right.cut - left.cut);

  return ranked[0] ?? null;
}

function mapPricesStoreOffer(offer: NonNullable<PricesEntry["deals"]>[number]): StoreOffer {
  const price = toPricePoint(offer.price) ?? { amount: 0, currency: "USD" };
  const regular =
    toPricePoint(offer.regular) ?? {
      amount: price.amount,
      currency: price.currency
    };

  return {
    store: offer.shop?.name ?? "Unknown Store",
    price,
    regular,
    cut: offer.cut ?? calculateCut(price.amount, regular.amount),
    url: offer.url ?? null
  };
}

function toPricePoint(value?: { amount?: number; currency?: string }): PricePoint | null {
  if (typeof value?.amount !== "number") {
    return null;
  }

  return {
    amount: value.amount,
    currency: value.currency ?? "USD"
  };
}

function mapNamedValues(values?: Array<{ name?: string } | string>): string[] {
  return (values ?? [])
    .map((value) => (typeof value === "string" ? value : value.name))
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function getDefaultCurrency(country: string): string {
  return country === "KR" ? "KRW" : "USD";
}

function buildCacheKey(url: URL, init?: RequestInit): string {
  const method = init?.method ?? "GET";
  const body = typeof init?.body === "string" ? init.body : "";
  return `${method}:${url.toString()}:${body}`;
}

function isDiscoverableDeal(row: DealRow): boolean {
  return row.type ? row.type === "game" : true;
}

function toWarning(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return `${fallback} (${error.message})`;
  }

  return fallback;
}
