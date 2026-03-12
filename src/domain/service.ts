import type { DealsEnrichment, DiscoverFilters, DealCandidate } from "./score.js";
import { filterJunkCandidates, scoreDealCandidates } from "./score.js";
import { formatKoreanPriceSummary, formatPrice } from "../presentation/summary.js";
import type { DealResolution, ResolveDealOptions } from "../providers/itad-client.js";

export interface SearchCandidate {
  id: string;
  title: string;
}

export interface CatalogCandidate {
  title: string;
  released?: string | null | undefined;
  genres: string[];
  platforms: string[];
  tags?: string[] | undefined;
  rating?: number | null | undefined;
  metacritic?: number | null | undefined;
  multiplayer: boolean;
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
  discoverTitles?(input: CatalogDiscoveryInput): Promise<CatalogCandidate[]>;
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
        try {
          const fallback = await this.resolveCatalogCandidates({
            country,
            filters: { ...args, country, preferredShops },
            tags: fallbackSignals.tags,
          rawgGenres: fallbackSignals.rawgGenres,
          excluded: new Set<string>(),
          preferredShops,
          maxMatches: 5,
          maxResolutions: 8
        });
          rankedDeals = applySteamDeckCompatibilityPreference(
            scoreDealCandidates(dedupeDeals([...rankedDeals, ...fallback.matches]), {
              ...args,
              preferredShops
            }),
            steamDeckRequest
          );
          warnings.push(...fallback.warnings);
        } catch (error) {
          warnings.push(
            toWarning(error, "추가 추천 후보를 보강하지 못해 일부 결과만 표시했습니다.")
          );
        }
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
    let attemptedTargetedRecovery = false;
    const hasStrongCatalogIntent =
      preferences.deckbuilding || hasActionRogueliteIntent(preferences.genres);

    const canUseCatalogFirst =
      hasStrongCatalogIntent &&
      this.providers.discoverTitles &&
      this.providers.resolveDeal &&
      (preferences.tags.length > 0 || preferences.rawgGenres.length > 0);

    if (canUseCatalogFirst) {
      try {
        const catalogMatches = await this.resolveCatalogCandidates({
          country,
          filters: discoverArgs,
          tags: preferences.tags,
          rawgGenres: preferences.rawgGenres,
          excluded,
          preferredShops,
          maxMatches: 3,
          maxResolutions: (preferredShops?.length ?? 0) > 0 ? 3 : 5
        });

        matches = applyRecommendationQualityGates(
          applySteamDeckCompatibilityPreference(catalogMatches.matches, steamDeckRequest),
          preferences
        );
        warnings.push(...catalogMatches.warnings);

        if (matches.length === 0) {
          attemptedTargetedRecovery = true;
          const recovery = await this.recoverRecommendationMatches({
            country,
            filters: discoverArgs,
            preferences,
            excluded,
            preferredShops,
            steamDeckRequest,
            skipPrimaryAttempt: true
          });

          matches = recovery.matches;
          warnings.push(...recovery.warnings);
        }
      } catch (error) {
        warnings.push(
          toWarning(error, "추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다.")
        );
      }
    }

    matches = applyRecommendationQualityGates(
      applySteamDeckCompatibilityPreference(matches, steamDeckRequest),
      preferences
    );

    if (matches.length === 0) {
      base = await this.discoverDeals(discoverArgs);
      matches = (base.matches as DealCandidate[]).filter(
        (deal) => !deal.genres.some((genre) => excluded.has(genre.trim().toLowerCase()))
      );
      warnings.push(...base.warnings);
      matches = applyRecommendationQualityGates(
        applySteamDeckCompatibilityPreference(matches, steamDeckRequest),
        preferences
      );
    }

    if (matches.length === 0 && !attemptedTargetedRecovery) {
      try {
        const recovery = await this.recoverRecommendationMatches({
          country,
          filters: discoverArgs,
          preferences,
          excluded,
          preferredShops,
          steamDeckRequest,
          skipPrimaryAttempt: false
        });

        matches = recovery.matches;
        warnings.push(...recovery.warnings);
      } catch (error) {
        warnings.push(
          toWarning(error, "추가 추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다.")
        );
      }
    }

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
    candidateFilter?: ((candidate: CatalogCandidate) => boolean) | undefined;
    maxMatches?: number | undefined;
    maxResolutions?: number | undefined;
    catalogLimit?: number | undefined;
  }): Promise<{ matches: DealCandidate[]; warnings: string[] }> {
    if (!this.providers.discoverTitles || !this.providers.resolveDeal) {
      return { matches: [], warnings: [] };
    }

    const catalog = await this.providers.discoverTitles({
      tags: args.tags,
      genres: args.rawgGenres,
      limit: args.catalogLimit ?? 12
    });

    const warnings: string[] = [];
    const filteredCatalog = filterCatalogCandidates(catalog).filter(
      (candidate) => args.candidateFilter?.(candidate) ?? true
    );
    const matches: DealCandidate[] = [];

    for (const candidate of filteredCatalog.slice(0, args.maxResolutions ?? MAX_CATALOG_RESOLUTIONS)) {
      const resolution = await this.providers.resolveDeal!(candidate.title, args.country, {
        preferredShops: args.preferredShops,
        dealsOnly: (args.preferredShops?.length ?? 0) > 0
      });

      warnings.push(...(resolution.warnings ?? []));

      if (resolution.kind !== "match") {
        continue;
      }

      matches.push(
        ...((resolution.matches ?? [])
          .filter(
            (deal) =>
              deal.cut > 0 &&
              !deal.genres.some((genre) => args.excluded.has(genre.trim().toLowerCase()))
          )
          .map((deal) => mergeCatalogMetadata(deal, candidate, args.tags)))
      );

      if ((args.maxMatches ?? 0) > 0 && dedupeDeals(matches).length >= args.maxMatches!) {
        break;
      }
    }

    return {
      matches: scoreDealCandidates(dedupeDeals(matches), args.filters).slice(
        0,
        args.maxMatches ?? Number.POSITIVE_INFINITY
      ),
      warnings
    };
  }

  private async recoverRecommendationMatches(args: {
    country: string;
    filters: DiscoverFilters & { country: string };
    preferences: {
      genres: string[];
      rawgGenres: string[];
      platforms: string[];
      tags: string[];
      multiplayer: boolean;
      deckbuilding: boolean;
      highRating: boolean;
      shortSession: boolean;
    };
    excluded: Set<string>;
    preferredShops?: number[] | undefined;
    steamDeckRequest: boolean;
    skipPrimaryAttempt: boolean;
  }): Promise<{ matches: DealCandidate[]; warnings: string[] }> {
    if (!this.providers.discoverTitles || !this.providers.resolveDeal) {
      return { matches: [], warnings: [] };
    }

    const recoveryAttempts = buildRecommendationRecoveryAttempts(
      args.preferences,
      args.skipPrimaryAttempt
    );
    if (recoveryAttempts.length === 0) {
      return { matches: [], warnings: [] };
    }

    const warnings: string[] = [];
    const steamOnly = (args.preferredShops?.length ?? 0) > 0;
    const broadSteamRoguelikeRecovery =
      steamOnly &&
      hasRoguelikeIntent(args.preferences.genres) &&
      !args.preferences.deckbuilding &&
      !hasActionRogueliteIntent(args.preferences.genres);
    const maxResolutions = broadSteamRoguelikeRecovery ? 8 : steamOnly ? 3 : 5;

    for (const recoverySignals of recoveryAttempts) {
      const recovered = await this.resolveCatalogCandidates({
        country: args.country,
        filters: args.filters,
        tags: recoverySignals.tags,
        rawgGenres: recoverySignals.rawgGenres,
        excluded: args.excluded,
        preferredShops: args.preferredShops,
        maxMatches: 3,
        maxResolutions,
        candidateFilter: (candidate) =>
          catalogCandidateMatchesRecoveryIntent(candidate, args.preferences)
      });

      warnings.push(...recovered.warnings);

      const matches = applyRecommendationQualityGates(
        applySteamDeckCompatibilityPreference(recovered.matches, args.steamDeckRequest),
        args.preferences
      );

      if (matches.length > 0) {
        return {
          matches,
          warnings
        };
      }
    }

    return { matches: [], warnings };
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
  deckbuilding: boolean;
  highRating: boolean;
  shortSession: boolean;
} {
  const genres = new Set<string>();
  const rawgGenres = new Set<string>();
  const platforms = new Set<string>();
  const tags = new Set<string>();
  const deckbuilding = /덱빌딩|deck ?build|deckbuilder|card battler/i.test(preferences);
  const highRating = /평가 좋은|평 좋은|호평|high[- ]rated|highly rated|well-reviewed/i.test(preferences);
  const shortSession = /짧게|가볍게|부담 없이|quick|short session|pick-?up/i.test(preferences);

  if (/로그라이크|로그라이트|roguelike|roguelite/i.test(preferences)) {
    genres.add("Roguelike");
    tags.add("roguelike");
    tags.add("roguelite");
  }

  if (deckbuilding) {
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
    multiplayer: /협동|co-?op|coop|멀티/i.test(preferences),
    deckbuilding,
    highRating,
    shortSession
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
  candidate: CatalogCandidate,
  requestedTags: string[]
): DealCandidate {
  return {
    ...deal,
    genres: mergeStrings(deal.genres, candidate.genres, inferCatalogGenres(candidate, requestedTags)),
    platforms: mergeStrings(deal.platforms, candidate.platforms),
    rating: deal.rating ?? candidate.rating,
    metacritic: deal.metacritic ?? candidate.metacritic,
    multiplayer: deal.multiplayer || candidate.multiplayer,
    released: deal.released ?? candidate.released,
    metadataStatus: deal.metadataStatus ?? "rawg"
  };
}

function inferCatalogGenres(candidate: CatalogCandidate, requestedTags: string[]): string[] {
  const genres = new Set<string>();
  const normalizedTags = [...requestedTags, ...(candidate.tags ?? [])].map((tag) => tag.toLowerCase());
  const normalizedGenres = candidate.genres.map((genre) => genre.toLowerCase());

  for (const tag of normalizedTags) {
    if (tag === "roguelike" || tag === "roguelite") {
      genres.add("Roguelike");
    }

    if (
      tag === "roguelike-deckbuilder" ||
      tag.includes("deckbuilder") ||
      tag.includes("card battler") ||
      tag.includes("card game")
    ) {
      genres.add("Deckbuilder");
      genres.add("Card");
    }
  }

  if (normalizedGenres.some((genre) => genre === "card")) {
    genres.add("Card");
    genres.add("Deckbuilder");
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
  const hasMetadataWarning =
    hasSubrequestWarning ||
    warnings.some((warning) => warning.includes("RAWG 보강 한도")) ||
    warnings.some((warning) => warning.includes("메타데이터를 생략"));
  const hasSteamDeckWarning =
    warnings.some((warning) => warning.includes("Steam Deck 호환성 정보를 확인하지 못했습니다")) ||
    warnings.some((warning) => warning.includes("Steam Deck 호환성 보강 한도"));

  if (hasMetadataWarning) {
    const message = "일부 메타데이터를 생략했습니다.";
    unique.push(message);
    seen.add(message);
  }

  if (hasSteamDeckWarning) {
    const message = "Steam Deck 호환성 정보를 일부 확인하지 못했습니다.";
    unique.push(message);
    seen.add(message);
  }

  for (const warning of warnings) {
    const normalized = warning.trim();
    if (
      !normalized ||
      normalized.includes("Too many subrequests by single Worker invocation") ||
      normalized.includes("RAWG 보강 한도") ||
      normalized.includes("메타데이터를 생략") ||
      normalized.includes("Steam Deck 호환성 정보를 확인하지 못했습니다") ||
      normalized.includes("Steam Deck 호환성 보강 한도") ||
      normalized.includes("지정한 상점 범위에서 현재 할인 가격을 찾지 못했습니다") ||
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

function buildRecommendationRecoveryAttempts(preferences: {
  genres: string[];
  rawgGenres: string[];
  tags: string[];
  deckbuilding: boolean;
}, skipPrimaryAttempt: boolean): Array<{
  tags: string[];
  rawgGenres: string[];
}> {
  const attempts: Array<{
    tags: string[];
    rawgGenres: string[];
  }> = [];
  const seen = new Set<string>();
  const pushAttempt = (tags: string[], rawgGenres: string[]) => {
    const normalizedTags = uniqueValues(tags);
    const normalizedGenres = uniqueValues(rawgGenres);

    if (normalizedTags.length === 0 && normalizedGenres.length === 0) {
      return;
    }

    const key = JSON.stringify({ tags: normalizedTags, rawgGenres: normalizedGenres });
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    attempts.push({
      tags: normalizedTags,
      rawgGenres: normalizedGenres
    });
  };

  if (preferences.deckbuilding) {
    if (!skipPrimaryAttempt) {
      pushAttempt(["roguelike-deckbuilder"], ["card"]);
    }
    pushAttempt(["roguelike-deckbuilder"], []);
    pushAttempt([], ["card"]);
  }

  if (hasActionRogueliteIntent(preferences.genres)) {
    if (!skipPrimaryAttempt) {
      pushAttempt(["roguelike", "roguelite"], ["action"]);
    }
    pushAttempt(["roguelike", "roguelite"], []);
  }

  if (hasRoguelikeIntent(preferences.genres)) {
    pushAttempt(["roguelike", "roguelite"], []);
  }

  return attempts;
}

function pickPreferredPlatform(platforms: string[], requested: string[]): string {
  const matched = platforms.find((platform) =>
    requested.some((request) => normalizePlatform(platform) === normalizePlatform(request))
  );

  return matched ?? platforms[0] ?? "PC";
}

function applyRecommendationQualityGates(
  deals: DealCandidate[],
  preferences: {
    genres: string[];
    deckbuilding: boolean;
    highRating: boolean;
    shortSession: boolean;
    multiplayer: boolean;
  }
): DealCandidate[] {
  let filtered = [...deals];

  if (preferences.genres.length > 1) {
    filtered = filtered.filter((deal) => matchesAllRequestedGenres(deal, preferences.genres));
  }

  if (preferences.multiplayer) {
    filtered = filtered.filter((deal) => deal.multiplayer);
  }

  if (preferences.deckbuilding) {
    const deckbuildingMatches = filtered.filter(hasDeckbuildingEvidence);
    filtered = deckbuildingMatches.length > 0 ? deckbuildingMatches : [];
  }

  if (preferences.highRating) {
    filtered = filtered.filter(hasStrongReviewSignal);
  }

  if (preferences.shortSession) {
    filtered = filtered.sort((left, right) => {
      const leftScore = getShortSessionScore(left);
      const rightScore = getShortSessionScore(right);
      return rightScore - leftScore;
    });
  }

  return filtered;
}

function hasDeckbuildingEvidence(deal: DealCandidate): boolean {
  return /\b(deck|deckbuilder|deckbuilding|card|cards|hand)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasStrongReviewSignal(deal: DealCandidate): boolean {
  return (deal.rating ?? 0) >= 4 || (deal.metacritic ?? 0) >= 75;
}

function matchesAllRequestedGenres(deal: DealCandidate, requestedGenres: string[]): boolean {
  const normalizedGenres = new Set(deal.genres.map((genre) => genre.trim().toLowerCase()));

  return requestedGenres.every((genre) => normalizedGenres.has(genre.trim().toLowerCase()));
}

function hasActionRogueliteIntent(genres: string[]): boolean {
  const normalizedGenres = new Set(genres.map((genre) => genre.trim().toLowerCase()));
  return normalizedGenres.has("action") && normalizedGenres.has("roguelike");
}

function hasRoguelikeIntent(genres: string[]): boolean {
  return genres.some((genre) => genre.trim().toLowerCase() === "roguelike");
}

function catalogCandidateMatchesRecoveryIntent(
  candidate: CatalogCandidate,
  preferences: {
    genres: string[];
    deckbuilding: boolean;
  }
): boolean {
  const actionRogueliteIntent = hasActionRogueliteIntent(preferences.genres);
  const genericRoguelikeIntent =
    hasRoguelikeIntent(preferences.genres) && !preferences.deckbuilding && !actionRogueliteIntent;

  if (preferences.deckbuilding && !hasDeckbuildingCandidateEvidence(candidate)) {
    return false;
  }

  if (actionRogueliteIntent && !hasActionRogueliteCandidateEvidence(candidate)) {
    return false;
  }

  if (genericRoguelikeIntent) {
    if (!hasRoguelikeCandidateEvidence(candidate)) {
      return false;
    }

    if (!hasCatalogReviewSignal(candidate)) {
      return false;
    }
  }

  return true;
}

function hasDeckbuildingCandidateEvidence(candidate: CatalogCandidate): boolean {
  const values = `${candidate.title} ${candidate.genres.join(" ")} ${(candidate.tags ?? []).join(" ")}`;
  return /\b(deck|deckbuilder|deckbuilding|card|cards|hand)\b/i.test(values);
}

function hasActionRogueliteCandidateEvidence(candidate: CatalogCandidate): boolean {
  const normalizedGenres = new Set(candidate.genres.map((genre) => genre.trim().toLowerCase()));
  const normalizedTags = new Set((candidate.tags ?? []).map((tag) => tag.trim().toLowerCase()));

  const hasAction =
    normalizedGenres.has("action") || [...normalizedTags].some((tag) => tag.includes("action"));
  const hasRoguelike =
    normalizedGenres.has("roguelike") ||
    normalizedGenres.has("roguelite") ||
    [...normalizedTags].some((tag) => tag.includes("roguelike") || tag.includes("roguelite"));

  return hasAction && hasRoguelike;
}

function hasRoguelikeCandidateEvidence(candidate: CatalogCandidate): boolean {
  const normalizedGenres = new Set(candidate.genres.map((genre) => genre.trim().toLowerCase()));
  const normalizedTags = new Set((candidate.tags ?? []).map((tag) => tag.trim().toLowerCase()));

  return (
    normalizedGenres.has("roguelike") ||
    normalizedGenres.has("roguelite") ||
    [...normalizedTags].some((tag) => tag.includes("roguelike") || tag.includes("roguelite"))
  );
}

function hasCatalogReviewSignal(candidate: CatalogCandidate): boolean {
  return (candidate.rating ?? 0) >= 4 || (candidate.metacritic ?? 0) >= 75;
}

function getShortSessionScore(deal: DealCandidate): number {
  const titleBonus = /\b(deck|card|arcade|survivor|survivors|roguelike|roguelite)\b/i.test(deal.title)
    ? 2
    : 0;
  const priceBonus = deal.price.amount <= 12000 ? 1 : 0;
  return titleBonus + priceBonus;
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
