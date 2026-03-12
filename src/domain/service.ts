import type { DealsEnrichment, DiscoverFilters, DealCandidate } from "./score.js";
import { filterJunkCandidates, scoreDealCandidates } from "./score.js";
import { formatKoreanPriceSummary, formatPrice } from "../presentation/summary.js";
import type { DealResolution, ResolveDealOptions } from "../providers/itad-client.js";

export interface SearchCandidate {
  id: string;
  title: string;
}

export interface CompareResult {
  query: Record<string, unknown>;
  country: string;
  matches: unknown[];
  summary: string;
  sources: string[];
  warnings: string[];
}
export interface CompareResult extends Record<string, unknown> {}

export interface CatalogDiscoveryInput {
  tags?: string[] | undefined;
  genres?: string[] | undefined;
  limit?: number | undefined;
}

export interface GameProviders {
  findDeals(args: DiscoverFilters & { country: string }): Promise<DealCandidate[]>;
  enrichDeals(
    deals: DealCandidate[],
    options?: {
      includeSteamDeckCompatibility?: boolean;
      maxRawgLookups?: number;
      maxSteamLookups?: number;
    }
  ): Promise<DealCandidate[] | DealsEnrichment>;
  resolveDeal?(
    title: string,
    country: string,
    options?: ResolveDealOptions
  ): Promise<DealResolution>;
  discoverTitles?(input: CatalogDiscoveryInput): Promise<
    Array<{
      title: string;
      released?: string | null | undefined;
      genres: string[];
      platforms: string[];
      rating?: number | null | undefined;
      metacritic?: number | null | undefined;
      multiplayer: boolean;
    }>
  >;
}

export class GameDealService {
  constructor(private readonly providers: GameProviders) {}

  async discoverDeals(args: DiscoverFilters & { country: string }): Promise<CompareResult> {
    const country = args.country || "KR";
    const preferredShops = preferredShopsFromContext(args.platforms);
    const steamContext = (preferredShops?.length ?? 0) > 0;
    const steamDeckRequest = hasSteamDeckRequest(args.platforms);
    const query = {
      budget: args.budget,
      genres: args.genres ?? [],
      platforms: args.platforms ?? [],
      multiplayer: args.multiplayer,
      sort: args.sort ?? "best-value",
      country
    };

    let baseDeals: DealCandidate[];
    try {
      baseDeals = await this.providers.findDeals({ ...args, country, preferredShops });
    } catch (error) {
      return {
        query,
        country,
        matches: [],
        summary: "할인 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        sources: ["IsThereAnyDeal", "RAWG"],
        warnings: [toWarning(error, "IsThereAnyDeal 조회에 실패했습니다.")]
      };
    }

    const warnings: string[] = [];
    const candidateDeals = filterJunkCandidates(baseDeals);
    let deals = candidateDeals;

    try {
      const enrichmentOptions = {
        includeSteamDeckCompatibility: steamContext,
        maxRawgLookups: MAX_RAWG_ENRICHMENT,
        ...(steamContext ? { maxSteamLookups: MAX_STEAM_ENRICHMENT } : {})
      };
      const enrichment = normalizeEnrichmentResult(
        await this.providers.enrichDeals(candidateDeals, enrichmentOptions)
      );
      deals = enrichment.deals;
      warnings.push(...enrichment.warnings);
    } catch (error) {
      warnings.push(toWarning(error, "RAWG 메타데이터를 불러오지 못해 가격 정보만 표시했습니다."));
    }

    let rankedDeals = applySteamDeckCompatibilityPreference(
      scoreDealCandidates(deals, { ...args, preferredShops }),
      steamDeckRequest
    );

    if (rankedDeals.length < 5 && this.providers.discoverTitles && this.providers.resolveDeal) {
      const fallbackSignals = catalogSignalsFromFilters(args);
      if (fallbackSignals.tags.length > 0 || fallbackSignals.rawgGenres.length > 0) {
        const fallback = await this.resolveCatalogCandidates({
          country,
          filters: { ...args, country, preferredShops },
          tags: fallbackSignals.tags,
          rawgGenres: fallbackSignals.rawgGenres,
          excluded: new Set<string>(),
          preferredShops
        });
        rankedDeals = applySteamDeckCompatibilityPreference(
          scoreDealCandidates(dedupeDeals([...rankedDeals, ...fallback.matches]), {
            ...args,
            preferredShops
          }),
          steamDeckRequest
        );
        warnings.push(...fallback.warnings);
      }
    }

    return {
      query,
      country,
      matches: rankedDeals,
      summary: summarizeDeals(rankedDeals, query, warnings, steamDeckRequest),
      sources: steamContext ? ["IsThereAnyDeal", "RAWG", "Steam"] : ["IsThereAnyDeal", "RAWG"],
      warnings: uniqueWarnings(warnings)
    };
  }

  async compareGamePrice(args: { title: string; country: string }): Promise<CompareResult> {
    return this.handleResolution(args, (deal) => {
      if (!hasPriceOverview(deal)) {
        return `${deal.title} 가격 개요 정보를 찾지 못했습니다. 제목은 확인됐지만 현재 판매 가격은 비어 있습니다.`;
      }

      const storesSummary =
        deal.stores && deal.stores.length > 0
          ? ` 판매처 ${deal.stores.length}곳 기준 최저가는 ${deal.stores[0]?.store}입니다.`
          : "";

      const historySummary = deal.historyLow
        ? ` 역대 최저가는 ${formatPrice(deal.historyLow.amount, deal.historyLow.currency)}입니다.`
        : "";

      return `${deal.title} 현재 최저가는 ${formatPrice(deal.price.amount, deal.price.currency)}이며 정가 대비 ${deal.cut}% 할인 중입니다.${storesSummary}${historySummary}`;
    });
  }

  async recommendSaleGames(args: {
    preferences: string;
    budget?: number;
    platforms?: string[];
    excludeGenres?: string[];
    country: string;
  }): Promise<CompareResult> {
    const country = args.country || "KR";
    const preferences = parsePreferenceSignals(args.preferences);
    const multiplayer = preferences.multiplayer || /협동|co-?op|멀티/i.test(args.preferences);
    const effectivePlatforms = uniqueValues([...(args.platforms ?? []), ...preferences.platforms]);
    const preferredShops = preferredShopsFromContext(effectivePlatforms, args.preferences);
    const steamDeckRequest = hasSteamDeckRequest(effectivePlatforms);
    const discoverArgs: DiscoverFilters & { country: string } = {
      country,
      sort: "best-value",
      preferredShops
    };

    if (typeof args.budget === "number") {
      discoverArgs.budget = args.budget;
    }

    if (effectivePlatforms.length > 0) {
      discoverArgs.platforms = effectivePlatforms;
    }

    if (preferences.genres.length > 0) {
      discoverArgs.genres = preferences.genres;
    }

    if (multiplayer) {
      discoverArgs.multiplayer = true;
    }

    const excluded = new Set((args.excludeGenres ?? []).map((genre) => genre.trim().toLowerCase()));
    let base: CompareResult | null = null;
    let matches: DealCandidate[] = [];
    const warnings: string[] = [];

    const canUseCatalogFirst =
      (preferredShops?.length ?? 0) > 0 &&
      this.providers.discoverTitles &&
      this.providers.resolveDeal &&
      (preferences.tags.length > 0 || preferences.rawgGenres.length > 0);

    if (canUseCatalogFirst) {
      const catalogMatches = await this.resolveCatalogCandidates({
        country,
        filters: discoverArgs,
        tags: preferences.tags,
        rawgGenres: preferences.rawgGenres,
        excluded,
        preferredShops
      });

      matches = catalogMatches.matches;
      warnings.push(...catalogMatches.warnings);
    }

    if (matches.length === 0) {
      base = await this.discoverDeals(discoverArgs);
      matches = (base.matches as DealCandidate[]).filter(
        (deal) => !deal.genres.some((genre) => excluded.has(genre.trim().toLowerCase()))
      );
      warnings.push(...base.warnings);
    }

    matches = applySteamDeckCompatibilityPreference(matches, steamDeckRequest);

    if (matches.length === 0) {
      const emptyBase =
        base ??
        ({
          summary: "조건에 맞는 할인 게임을 찾지 못했습니다.",
          warnings
        } as CompareResult);

      return {
        query: {
          preferences: args.preferences,
          budget: args.budget,
          platforms: effectivePlatforms,
          excludeGenres: args.excludeGenres ?? [],
          country
        },
        country,
        matches: [],
        summary: buildNoRecommendationSummary(emptyBase),
        sources: ["IsThereAnyDeal", "RAWG"],
        warnings: uniqueWarnings(warnings)
      };
    }

    const top = matches[0];
    if (!top) {
      return {
        query: {
          preferences: args.preferences,
          budget: args.budget,
          platforms: effectivePlatforms,
          excludeGenres: args.excludeGenres ?? [],
          country
        },
        country,
        matches: [],
        summary: buildNoRecommendationSummary(base ?? ({ summary: "", warnings } as CompareResult)),
        sources: base?.sources ?? ["IsThereAnyDeal", "RAWG"],
        warnings: uniqueWarnings(warnings)
      };
    }
    const reasons = [
      `${top.cut}% 할인`,
      `현재가 ${formatPrice(top.price.amount, top.price.currency)}`
    ];

    if (top.multiplayer || multiplayer) {
      reasons.push("협동 플레이 지원");
    }

    if (effectivePlatforms.length > 0 && top.platforms.length > 0) {
      reasons.push(`${pickPreferredPlatform(top.platforms, effectivePlatforms)} 지원`);
    }

    const deckStatus = getDeckCompatibilityStatus(top);
    if (steamDeckRequest) {
      if (deckStatus === "verified" || deckStatus === "playable") {
        reasons.push(deckCompatibilityLabel(deckStatus));
      }
    }

    return {
      query: {
        preferences: args.preferences,
        budget: args.budget,
        platforms: effectivePlatforms,
        excludeGenres: args.excludeGenres ?? [],
        country
      },
      country,
      matches,
      summary:
        deckStatus === "unknown" && steamDeckRequest
          ? `${top.title}를 추천합니다. ${reasons.join(", ")} 조건과 잘 맞습니다. Steam Deck 호환성 정보는 아직 확인하지 못했습니다.`
          : `${top.title}를 추천합니다. ${reasons.join(", ")} 조건과 잘 맞습니다.`,
      sources: base?.sources ?? ["IsThereAnyDeal", "RAWG", "Steam"],
      warnings: uniqueWarnings(warnings)
    };
  }

  async explainDealValue(args: { title: string; country: string }): Promise<CompareResult> {
    return this.handleResolution(args, (deal) => {
      if (!hasPriceOverview(deal)) {
        return `${deal.title} 가격 개요 정보를 찾지 못해 딜 가치를 판단하기 어렵습니다.`;
      }

      if (!deal.historyLow) {
        return `${deal.title} 현재가는 ${formatPrice(deal.price.amount, deal.price.currency)}입니다. 아직 역대 최저가 정보가 충분하지 않습니다.`;
      }

      if (deal.price.amount <= deal.historyLow.amount) {
        return `${deal.title}는 현재 역대 최저가 ${formatPrice(deal.price.amount, deal.price.currency)}입니다.`;
      }

      const ratio = deal.price.amount / deal.historyLow.amount;
      if (ratio <= 1.1) {
        return `${deal.title}는 현재 ${formatPrice(deal.price.amount, deal.price.currency)}로 역대 최저가에 근접했습니다. 역대 최저가는 ${formatPrice(deal.historyLow.amount, deal.historyLow.currency)}입니다.`;
      }

      return `${deal.title}는 현재 ${formatPrice(deal.price.amount, deal.price.currency)}이며 역대 최저가 ${formatPrice(deal.historyLow.amount, deal.historyLow.currency)}보다 비쌉니다. 급하지 않다면 더 기다려볼 만합니다.`;
    });
  }

  private async handleResolution(
    args: { title: string; country: string },
    formatMatch: (deal: DealCandidate) => string
  ): Promise<CompareResult> {
    const country = args.country || "KR";

    if (!this.providers.resolveDeal) {
      return {
        query: { title: args.title, country },
        country,
        matches: [],
        summary: "제목 기반 조회 기능이 아직 연결되지 않았습니다.",
        sources: ["IsThereAnyDeal", "RAWG"],
        warnings: ["resolveDeal provider가 설정되지 않았습니다."]
      };
    }

    let resolution: DealResolution;
    try {
      resolution = await this.providers.resolveDeal(args.title, country);
    } catch (error) {
      return {
        query: { title: args.title, country },
        country,
        matches: [],
        summary: "가격 비교 정보를 가져오지 못했습니다. API 설정과 네트워크 상태를 확인해 주세요.",
        sources: ["IsThereAnyDeal", "RAWG"],
        warnings: [error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."]
      };
    }

    if (resolution.kind === "not-found") {
      return {
        query: { title: args.title, country },
        country,
        matches: [],
        summary: `${args.title}에 해당하는 게임을 찾지 못했습니다.`,
        sources: ["IsThereAnyDeal", "RAWG"],
        warnings: []
      };
    }

    if (resolution.kind === "ambiguous") {
      return {
        query: { title: args.title, country },
        country,
        matches: resolution.candidates ?? [],
        summary: "여러 게임이 검색되었습니다. 정확한 제목으로 다시 요청해 주세요.",
        sources: ["IsThereAnyDeal", "RAWG"],
        warnings: []
      };
    }

    const match = resolution.matches?.[0];
    if (!match) {
      return {
        query: { title: args.title, country },
        country,
        matches: [],
        summary: `${args.title} 상세 정보를 불러오지 못했습니다.`,
        sources: ["IsThereAnyDeal", "RAWG"],
        warnings: []
      };
    }

    return {
      query: { title: args.title, country },
      country,
      matches: resolution.matches ?? [],
      summary: formatMatch(match),
      sources: ["IsThereAnyDeal", "RAWG"],
      warnings: resolution.warnings ?? []
    };
  }

  private async resolveCatalogCandidates(args: {
    country: string;
    filters: DiscoverFilters & { country: string };
    tags: string[];
    rawgGenres: string[];
    excluded: Set<string>;
    preferredShops?: number[] | undefined;
  }): Promise<{ matches: DealCandidate[]; warnings: string[] }> {
    if (!this.providers.discoverTitles || !this.providers.resolveDeal) {
      return { matches: [], warnings: [] };
    }

    const catalog = await this.providers.discoverTitles({
      tags: args.tags,
      genres: args.rawgGenres,
      limit: 12
    });

    const warnings: string[] = [];
    const inferredGenres = discoveryTagsToGenres(args.tags);
    const resolutions = await Promise.all(
      filterCatalogCandidates(catalog).slice(0, MAX_CATALOG_RESOLUTIONS).map(async (candidate) => {
        const resolution = await this.providers.resolveDeal!(candidate.title, args.country, {
          preferredShops: args.preferredShops,
          dealsOnly: (args.preferredShops?.length ?? 0) > 0
        });
        warnings.push(...(resolution.warnings ?? []));
        return { candidate, resolution };
      })
    );

    const matches = dedupeDeals(
      resolutions.flatMap(({ candidate, resolution }) =>
        resolution.kind === "match"
          ? (resolution.matches ?? []).filter(
              (deal) =>
                deal.cut > 0 &&
                !deal.genres.some((genre) => args.excluded.has(genre.trim().toLowerCase()))
            ).map((deal) => mergeCatalogMetadata(deal, candidate, inferredGenres))
          : []
      )
    );

    return {
      matches: scoreDealCandidates(matches, args.filters),
      warnings
    };
  }
}

function summarizeDeals(
  deals: DealCandidate[],
  query: Record<string, unknown>,
  warnings: string[],
  steamDeckRequest: boolean
): string {
  if (deals.length === 0) {
    const hasMetadataRisk =
      warnings.some((warning) => warning.includes("메타데이터")) &&
      (Array.isArray(query.genres) && query.genres.length > 0
        ? true
        : Array.isArray(query.platforms) && query.platforms.length > 0);

    if (hasMetadataRisk) {
      return "조건에 맞는 할인 게임을 찾지 못했습니다. 일부 게임은 메타데이터가 부족해 필터를 완전히 확인하지 못했습니다.";
    }

    return "조건에 맞는 할인 게임을 찾지 못했습니다.";
  }

  const highlights = deals.slice(0, 3).map((deal) =>
    formatKoreanPriceSummary(
      deal.title,
      deal.price.amount,
      deal.price.currency,
      steamDeckRequest ? deckCompatibilityLabel(getDeckCompatibilityStatus(deal)) : undefined
    )
  );

  return `조건에 맞는 할인 게임 ${deals.length}개를 찾았습니다. ${highlights.join(" / ")}`;
}

function toWarning(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return `${fallback} (${error.message})`;
  }

  return fallback;
}

function normalizeEnrichmentResult(result: DealCandidate[] | DealsEnrichment): DealsEnrichment {
  if (Array.isArray(result)) {
    return { deals: result, warnings: [] };
  }

  return result;
}

function parsePreferenceSignals(preferences: string): {
  genres: string[];
  rawgGenres: string[];
  platforms: string[];
  tags: string[];
  multiplayer: boolean;
} {
  const genres = new Set<string>();
  const rawgGenres = new Set<string>();
  const platforms = new Set<string>();
  const tags = new Set<string>();

  if (/로그라이크|로그라이트|roguelike|roguelite/i.test(preferences)) {
    genres.add("Roguelike");
    tags.add("roguelike");
    tags.add("roguelite");
  }

  if (/덱빌딩|deck ?build|deckbuilder|card battler/i.test(preferences)) {
    genres.add("Strategy");
    rawgGenres.add("card");
    tags.add("roguelike-deckbuilder");
  }

  if (/전략|strategy|tactics/i.test(preferences)) {
    genres.add("Strategy");
    rawgGenres.add("strategy");
  }

  if (/액션|action/i.test(preferences)) {
    genres.add("Action");
    rawgGenres.add("action");
  }

  if (/스팀덱|steam ?deck/i.test(preferences)) {
    platforms.add("Steam Deck");
  }

  if (/\bpc\b|스팀(?!덱)|\bsteam\b/i.test(preferences)) {
    platforms.add("PC");
  }

  return {
    genres: [...genres],
    rawgGenres: [...rawgGenres],
    platforms: [...platforms],
    tags: [...tags],
    multiplayer: /협동|co-?op|coop|멀티/i.test(preferences)
  };
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) {
      continue;
    }

    seen.add(trimmed.toLowerCase());
    unique.push(trimmed);
  }

  return unique;
}

function buildNoRecommendationSummary(base: CompareResult): string {
  return base.summary.includes("메타데이터")
    ? "조건에 맞는 추천 할인 게임을 찾지 못했습니다. 일부 게임은 메타데이터가 부족했습니다."
    : "조건에 맞는 추천 할인 게임을 찾지 못했습니다.";
}

function hasPriceOverview(deal: DealCandidate): boolean {
  return deal.price.amount > 0 || (deal.stores?.length ?? 0) > 0;
}

function hasSteamDeckRequest(platforms?: string[]): boolean {
  return (platforms ?? []).some((platform) => /steam ?deck|스팀덱/i.test(platform));
}

function getDeckCompatibilityStatus(
  deal: DealCandidate
): NonNullable<DealCandidate["steamDeckCompatibility"]>["status"] {
  return deal.steamDeckCompatibility?.status ?? "unknown";
}

function deckCompatibilityLabel(
  status: NonNullable<DealCandidate["steamDeckCompatibility"]>["status"]
): string {
  switch (status) {
    case "verified":
      return "Steam Deck Verified";
    case "playable":
      return "Steam Deck Playable";
    case "unsupported":
      return "Steam Deck 미지원";
    case "unknown":
    default:
      return "Steam Deck 정보 없음";
  }
}

function applySteamDeckCompatibilityPreference(
  deals: DealCandidate[],
  steamDeckRequest: boolean
): DealCandidate[] {
  if (!steamDeckRequest) {
    return deals;
  }

  const supported = deals.filter((deal) => {
    const status = getDeckCompatibilityStatus(deal);
    return status === "verified" || status === "playable";
  });
  const unknown = deals.filter((deal) => getDeckCompatibilityStatus(deal) === "unknown");

  return supported.length >= 5 ? supported : [...supported, ...unknown];
}

function preferredShopsFromContext(
  platforms?: string[],
  preferences?: string
): number[] | undefined {
  const steamPattern = /steam ?deck|스팀덱|스팀(?!덱)|\bsteam\b/i;
  const platformSignal = (platforms ?? []).some((platform) => steamPattern.test(platform));
  const preferenceSignal = preferences ? steamPattern.test(preferences) : false;

  return platformSignal || preferenceSignal ? [61] : undefined;
}

function mergeCatalogMetadata(
  deal: DealCandidate,
  candidate: {
    genres: string[];
    platforms: string[];
    rating?: number | null | undefined;
    metacritic?: number | null | undefined;
    multiplayer: boolean;
    released?: string | null | undefined;
  },
  inferredGenres: string[]
): DealCandidate {
  return {
    ...deal,
    genres: mergeStrings(deal.genres, candidate.genres, inferredGenres),
    platforms: mergeStrings(deal.platforms, candidate.platforms),
    rating: deal.rating ?? candidate.rating,
    metacritic: deal.metacritic ?? candidate.metacritic,
    multiplayer: deal.multiplayer || candidate.multiplayer,
    released: deal.released ?? candidate.released,
    metadataStatus: deal.metadataStatus ?? "rawg"
  };
}

function discoveryTagsToGenres(tags: string[]): string[] {
  const genres = new Set<string>();

  for (const tag of tags) {
    if (tag === "roguelike" || tag === "roguelite") {
      genres.add("Roguelike");
    }
  }

  return [...genres];
}

function mergeStrings(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const group of groups) {
    for (const value of group) {
      const trimmed = value.trim();
      if (!trimmed) {
        continue;
      }

      const key = trimmed.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(trimmed);
    }
  }

  return merged;
}

function dedupeDeals(deals: DealCandidate[]): DealCandidate[] {
  const seen = new Set<string>();
  const unique: DealCandidate[] = [];

  for (const deal of deals) {
    const key = deal.id || deal.title.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(deal);
  }

  return unique;
}

function uniqueWarnings(warnings: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  const hasSubrequestWarning = warnings.some((warning) =>
    warning.includes("Too many subrequests by single Worker invocation")
  );

  if (hasSubrequestWarning) {
    unique.push("Worker 한도 때문에 일부 메타데이터를 생략했습니다.");
  }

  for (const warning of warnings) {
    const normalized = warning.trim();
    if (
      !normalized ||
      normalized.includes("Too many subrequests by single Worker invocation") ||
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
}

const MAX_RAWG_ENRICHMENT = 12;
const MAX_STEAM_ENRICHMENT = 8;
const MAX_CATALOG_RESOLUTIONS = 8;

function filterCatalogCandidates<
  T extends {
    title: string;
  }
>(candidates: T[]): T[] {
  return candidates.filter((candidate) => !/^(3d puzzle|room football|how much items|archaeology)\b/i.test(candidate.title));
}

function catalogSignalsFromFilters(filters: DiscoverFilters): {
  tags: string[];
  rawgGenres: string[];
} {
  const tags = new Set<string>();
  const rawgGenres = new Set<string>();

  for (const genre of filters.genres ?? []) {
    const normalized = genre.trim().toLowerCase();

    if (normalized === "roguelike" || normalized === "roguelite") {
      tags.add("roguelike");
      tags.add("roguelite");
      continue;
    }

    if (normalized === "strategy") {
      rawgGenres.add("strategy");
      continue;
    }

    if (normalized === "action") {
      rawgGenres.add("action");
    }
  }

  return {
    tags: [...tags],
    rawgGenres: [...rawgGenres]
  };
}

function pickPreferredPlatform(platforms: string[], requested: string[]): string {
  const matched = platforms.find((platform) =>
    requested.some((request) => normalizePlatform(platform) === normalizePlatform(request))
  );

  return matched ?? platforms[0] ?? "PC";
}

function normalizePlatform(value: string): string {
  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case "steam":
      return "pc";
    case "steamdeck":
    case "steam deck":
      return "steam deck";
    default:
      return normalized;
  }
}
