import type {
  DealsEnrichment,
  DiscoverFilters,
  DealCandidate,
  PricePoint,
  StoreOffer,
  SteamDeckCompatibility
} from "./score.js";
import { filterJunkCandidates, scoreDealCandidates } from "./score.js";
import { formatKoreanPriceSummary, formatPrice } from "../presentation/summary.js";
import type { DealResolution, ResolveDealOptions } from "../providers/itad-client.js";
import { parseRecommendationIntent } from "./intent-lexicon.js";
import {
  applyRecommendationConstraintOverrides,
  applyRecommendationHardConstraints,
  parseRecommendationConstraints,
  type RecommendationConstraints
} from "./recommendation-constraints.js";
import {
  createRecommendationExecutionBudget,
  type RecommendationExecutionBudget
} from "./recommendation-execution-budget.js";
import {
  buildRecommendationCatalogMixPlan,
  filterRecommendationCatalogCandidates,
  splitRecommendationCatalogResolvedDeals
} from "./recommendation-candidate-mixer.js";
import {
  applyRecommendationDegradedMode,
  RECOMMENDATION_DEGRADED_MODE_WARNING
} from "./recommendation-degraded-mode.js";
import {
  buildRecommendationSparseRecoveryProfile,
  type RecommendationRecoveryKind,
  type RecommendationRecoveryProfile
} from "./recommendation-recovery-profile.js";
import {
  rankRecommendationRecoveryCandidates,
  type RecommendationRecoveryRankingProfile
} from "./recommendation-recovery-ranking.js";
import { applyRecommendationReranker } from "./recommendation-reranker.js";
import { findBestRecommendationTitleMatch } from "./recommendation-title-matcher.js";

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
  emptyReason?: RecommendationEmptyReason | undefined;
  missingEvidence?: string[] | undefined;
}
export interface CompareResult extends Record<string, unknown> {}

export type RecommendationEmptyReason =
  | "missing-price-evidence"
  | "missing-steam-deck-evidence"
  | "missing-social-metadata"
  | "missing-review-evidence"
  | "missing-deckbuilding-evidence"
  | "missing-genre-evidence";

export interface RecommendationPriceEvidence {
  source: "ITAD";
  current: PricePoint;
  regular: PricePoint;
  cut: number;
  historyLow?: PricePoint | undefined;
  stores?: StoreOffer[] | undefined;
}

export interface RecommendationPlatformEvidence {
  source: "ITAD" | "Steam";
  platforms: string[];
  steamDeckStatus?: SteamDeckCompatibility["status"] | undefined;
}

export interface RecommendationMetadataEvidence {
  source: "RAWG";
  genres: string[];
  tags?: string[] | undefined;
  rating?: number | null | undefined;
  metacritic?: number | null | undefined;
}

export interface RecommendationEvidence {
  priceEvidence: RecommendationPriceEvidence;
  platformEvidence: RecommendationPlatformEvidence;
  metadataEvidence?: RecommendationMetadataEvidence | undefined;
}

export type RecommendationEvidenceCompleteness =
  | "hard-facts-only"
  | "hard-facts-plus-metadata"
  | "partial";

export interface RecommendationMatch extends DealCandidate {
  tags?: string[] | undefined;
  evidence: RecommendationEvidence;
  matchedSignals: string[];
  missingEvidence: string[];
  recommendationReason: string;
  evidenceCompleteness: RecommendationEvidenceCompleteness;
}

type RecommendationTaggedDeal = DealCandidate & {
  tags?: string[] | undefined;
};

type RecommendationPreferences = ReturnType<typeof parsePreferenceSignals> & {
  multiplayer: boolean;
};

interface RecommendationEvidenceContext {
  rawPreferences: string;
  preferences: RecommendationPreferences;
  constraints: RecommendationConstraints;
  requestedPlatforms: string[];
  budget?: number | undefined;
  steamDeckRequest: boolean;
  socialProfile?: RecommendationSocialPromptProfile | undefined;
}

export interface CatalogDiscoveryInput {
  tags?: string[] | undefined;
  genres?: string[] | undefined;
  limit?: number | undefined;
}

interface BroadIntentSignals {
  cheapBrowse: boolean;
  avoidObscure: boolean;
  broadCoop: boolean;
  steamDeckBrowse: boolean;
  broadGenreBrowse: boolean;
  requestedGenres: string[];
}

type RecommendationSocialPromptProfile = "generic-coop" | "party-hangout";
type RecommendationSocialCandidateTier = "strict" | "rescue" | "reject";

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

interface GameDealServiceOptions {
  recommendationTimeBudgetMs?: number | undefined;
  now?: (() => number) | undefined;
}

export class GameDealService {
  constructor(
    private readonly providers: GameProviders,
    private readonly options: GameDealServiceOptions = {}
  ) {}

  async discoverDeals(args: DiscoverFilters & { country: string }): Promise<CompareResult> {
    return this.discoverDealsInternal(args);
  }

  private async discoverDealsInternal(
    args: DiscoverFilters & { country: string },
    options?: {
      maxSteamLookups?: number;
      skipCatalogFallback?: boolean;
      maxRawgLookups?: number;
      collectRawCandidates?: ((deals: DealCandidate[]) => void) | undefined;
      allowDeckbuildingGenreFallback?: boolean;
      preferDeckbuildingSignal?: boolean;
      lenientFallbackMode?:
        | "none"
        | "genre-only"
        | "genre-and-platform"
        | "genre-platform-and-multiplayer";
    }
  ): Promise<CompareResult> {
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
    const broadIntentSignals = buildDiscoverBroadIntentSignals(args);
    const lenientFallbackMode = options?.lenientFallbackMode ?? "none";
    const allowLenientGenreFallback = lenientFallbackMode !== "none";
    const allowLenientPlatformFallback =
      lenientFallbackMode === "genre-and-platform" ||
      lenientFallbackMode === "genre-platform-and-multiplayer";
    const preferDeckbuildingSignal = Boolean(options?.preferDeckbuildingSignal);

    try {
      const enrichmentOptions = {
        includeSteamDeckCompatibility: steamContext,
        maxRawgLookups: options?.maxRawgLookups ?? MAX_RAWG_ENRICHMENT,
        ...(steamContext
          ? { maxSteamLookups: options?.maxSteamLookups ?? MAX_STEAM_ENRICHMENT }
          : {})
      };
      const enrichment = normalizeEnrichmentResult(
        await this.providers.enrichDeals(candidateDeals, enrichmentOptions)
      );
      deals = enrichment.deals;
      warnings.push(...enrichment.warnings);
    } catch (error) {
      warnings.push(toWarning(error, "RAWG 메타데이터를 불러오지 못해 가격 정보만 표시했습니다."));
    }

    options?.collectRawCandidates?.(
      deals.filter((deal) => deal.cut > 0 && !isRecommendationOverlayBrowseJunk(deal))
    );

    let rankedDeals = rankDiscoverDealsWithLenientFallback({
      deals,
      filters: args,
      preferredShops,
      steamDeckRequest,
      warnings,
      allowDeckbuildingGenreFallback: options?.allowDeckbuildingGenreFallback,
      preferDeckbuildingSignal,
      lenientFallbackMode
    });

    if (
      !options?.skipCatalogFallback &&
      rankedDeals.length === 0 &&
      steamDeckRequest &&
      hasRoguelikeIntent(args.genres ?? []) &&
      this.providers.discoverTitles &&
      this.providers.resolveDeal
    ) {
      try {
        const recovery = await this.recoverRecommendationMatches({
          country,
          filters: { ...args, country, preferredShops },
          preferences: {
            genres: ["Roguelike"],
            rawgGenres: [],
            platforms: args.platforms ?? [],
            tags: ["roguelike", "roguelite"],
            multiplayer: Boolean(args.multiplayer),
            deckbuilding: false,
            highRating: false,
            shortSession: false
          },
          excluded: new Set<string>(),
          preferredShops,
          steamDeckRequest,
          skipPrimaryAttempt: false
        });
        rankedDeals = applySteamDeckCompatibilityPreference(
          scoreDealCandidates(dedupeDeals([...rankedDeals, ...recovery.matches]), {
            ...args,
            preferredShops
          }),
          steamDeckRequest
          );
        warnings.push(...recovery.warnings);
      } catch (error) {
        warnings.push(
          toWarning(error, "추가 추천 후보를 보강하지 못해 일부 결과만 표시했습니다.")
        );
      }
    }

    if (
      !options?.skipCatalogFallback &&
      rankedDeals.length < 5 &&
      this.providers.discoverTitles &&
      this.providers.resolveDeal
    ) {
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
          rankedDeals = rankDiscoverDealsWithLenientFallback({
            deals: dedupeDeals([...rankedDeals, ...fallback.matches]),
            filters: args,
            preferredShops,
            steamDeckRequest,
            warnings,
            preferDeckbuildingSignal,
            lenientFallbackMode
          });
          warnings.push(...fallback.warnings);
        } catch (error) {
          warnings.push(
            toWarning(error, "추가 추천 후보를 보강하지 못해 일부 결과만 표시했습니다.")
          );
        }
      }
    }

    rankedDeals = applyBroadIntentRanking(rankedDeals, broadIntentSignals);

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
    const constraints = parseRecommendationConstraints(args.preferences);
    const parsedPreferences = parsePreferenceSignals(args.preferences, constraints);
    const multiplayer =
      parsedPreferences.multiplayer ||
      constraints.coopMode.length > 0 ||
      /협동|co-?op|멀티|teamplay|multiplayer/i.test(args.preferences);
    const preferences = {
      ...parsedPreferences,
      multiplayer
    };
    const effectivePlatforms = uniqueValues([...(args.platforms ?? []), ...preferences.platforms]);
    const preferredShops = preferredShopsFromContext(effectivePlatforms, args.preferences);
    const steamDeckRequest = hasSteamDeckRequest(effectivePlatforms);
    const executionProfile = buildRecommendationExecutionProfile({
      rawPreferences: args.preferences,
      preferences,
      constraints,
      steamDeckRequest
    });
    const executionBudget = createRecommendationExecutionBudget({
      totalMs: this.options.recommendationTimeBudgetMs ?? executionProfile.totalBudgetMs,
      now: this.options.now
    });
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
    const broadIntentSignals = buildRecommendationBroadIntentSignals(
      args.preferences,
      preferences,
      effectivePlatforms,
      multiplayer
    );
    const socialPromptProfile = buildRecommendationSocialPromptProfile({
      rawPreferences: args.preferences,
      multiplayer,
      constraints
    });
    const simpleSocialPrompt = executionProfile.simpleSocialPrompt;
    const strictSocialProfile = shouldUseStrictSocialPromptProfile({
      rawPreferences: args.preferences,
      constraints,
      socialProfile: socialPromptProfile
    });
    const effectiveSocialProfile =
      strictSocialProfile || !simpleSocialPrompt ? socialPromptProfile ?? undefined : undefined;
    const effectiveSocialGuardrailProfile =
      strictSocialProfile || !simpleSocialPrompt ? socialPromptProfile : null;
    const strictDeckCuePrompt =
      !steamDeckRequest &&
      constraints.deckPreference !== "avoid" &&
      hasRecommendationDeckCuePrompt(args.preferences);
    let base: CompareResult | null = null;
    let matches: DealCandidate[] = [];
    let degradedCandidates: DealCandidate[] = [];
    let rawBrowseCandidates: DealCandidate[] = [];
    let rawSteamDeckOverlayBrowseCandidates: DealCandidate[] = [];
    let rawSocialBrowseCandidates: DealCandidate[] = [];
    const warnings: string[] = [];
    let attemptedTargetedRecovery = false;
    let sparseRecoveryApplied = false;
    const nonSteamHighRatingStrategyRequest =
      !steamDeckRequest &&
      preferences.highRating &&
      preferences.rawgGenres.includes("strategy");
    const hasStrongCatalogIntent =
      preferences.deckbuilding ||
      hasActionRogueliteIntent(preferences.genres) ||
      nonSteamHighRatingStrategyRequest;
    const genericSteamRoguelikeRequest =
      steamDeckRequest &&
      hasRoguelikeIntent(preferences.genres) &&
      !preferences.deckbuilding &&
      !hasActionRogueliteIntent(preferences.genres);
    const preferSteamDeckBrowseFirst = steamDeckRequest && !hasStrongCatalogIntent;
    const strategyBrowseRawgBudget =
      !steamDeckRequest &&
      preferences.highRating &&
      preferences.rawgGenres.includes("strategy")
        ? RECOMMENDATION_STRATEGY_RAWG_ENRICHMENT
        : executionProfile.baseBrowseRawgLookups;

    const canUseCatalogFirst =
      hasStrongCatalogIntent &&
      this.providers.discoverTitles &&
      this.providers.resolveDeal &&
      (preferences.tags.length > 0 || preferences.rawgGenres.length > 0);

    const applyHardConstraints = (deals: DealCandidate[]): DealCandidate[] =>
      applyRecommendationHardConstraints(deals, constraints);
    const mergeDegradedCandidates = (incoming: DealCandidate[]): void => {
      degradedCandidates = mergeRecommendationCandidates(
        degradedCandidates,
        applyHardConstraints(incoming)
      );
    };
    const mergeRawBrowseCandidates = (incoming: DealCandidate[]): void => {
      rawBrowseCandidates = mergeRecommendationCandidates(
        rawBrowseCandidates,
        incoming.filter(
          (deal) =>
            deal.cut > 0 &&
            !deal.genres.some((genre) => excluded.has(genre.trim().toLowerCase())) &&
            !isRecommendationOverlayBrowseJunk(deal)
        )
      );
    };
    const mergeRawSteamDeckOverlayBrowseCandidates = (incoming: DealCandidate[]): void => {
      rawSteamDeckOverlayBrowseCandidates = mergeRecommendationCandidates(
        rawSteamDeckOverlayBrowseCandidates,
        incoming.filter((deal) => deal.cut > 0 && !isRecommendationOverlayBrowseJunk(deal))
      );
    };
    const mergeRawSocialBrowseCandidates = (incoming: DealCandidate[]): void => {
      if (!socialPromptProfile) {
        return;
      }

      rawSocialBrowseCandidates = mergeRecommendationCandidates(
        rawSocialBrowseCandidates,
        incoming.filter((deal) =>
          matchesRecommendationRawSocialBrowseCandidate(deal, {
            requestedPlatforms: effectivePlatforms,
            budget: args.budget,
            constraints,
            socialProfile: effectiveSocialProfile
          })
        )
      );
    };
    const applyRequiredConstraintSignalGates = (deals: DealCandidate[]): DealCandidate[] => {
      let filtered = [...deals];

      if (strictDeckCuePrompt) {
        const deckbuildingMatches = filtered.filter(hasDeckbuildingEvidence);
        filtered = deckbuildingMatches.length > 0 ? deckbuildingMatches : [];
      }

      return filtered;
    };
    const finalizeRecommendationMatches = (deals: DealCandidate[]): DealCandidate[] =>
      applyRecommendationSocialPromptGuardrail(
        applySteamDeckHandheldPromptGuardrail(
          applySteamDeckLifestyleStoryFillerGuardrail(
            applyRecommendationQualityGates(
              applyRequiredConstraintSignalGates(
                applySteamDeckCompatibilityPreference(applyHardConstraints(deals), steamDeckRequest)
              ),
              preferences
            ),
            {
              rawPreferences: args.preferences,
              preferences,
              constraints,
              steamDeckRequest
            }
          ),
          {
            rawPreferences: args.preferences,
            preferences,
            constraints,
            steamDeckRequest,
            warnings
          }
        ),
        {
          socialProfile: effectiveSocialGuardrailProfile,
          requestedPlatforms: effectivePlatforms,
          budget: args.budget,
          constraints,
          allowRescueTier: hasSocialEvidenceRescueSignal(warnings)
        }
      );
    const runSparseRecoveryProfile = async (
      profile: RecommendationRecoveryProfile
    ): Promise<{ matches: DealCandidate[]; warnings: string[]; applied: boolean }> => {
      if (!executionBudget || executionBudget.has(MIN_RECOMMENDATION_RECOVERY_BUDGET_MS)) {
        const recovery = await this.recoverSparseRecommendationMatches({
          profile,
          rawPreferences: args.preferences,
          country,
          filters: discoverArgs,
          preferences,
          constraints,
          excluded,
          preferredShops,
          steamDeckRequest,
          simpleSocialPrompt,
          socialPromptProfile: effectiveSocialProfile,
          executionBudget
        });

        return {
          matches: recovery.matches,
          warnings: recovery.warnings,
          applied: recovery.matches.length > 0
        };
      }

      if (
        executionBudget.has(executionProfile.lastChanceRecoveryMinMs) &&
        supportsLastChanceSparseRecovery(profile.kind)
      ) {
        const recovery = await this.recoverSparseRecommendationMatches({
          profile: buildLastChanceSparseRecoveryProfile(profile, simpleSocialPrompt),
          rawPreferences: args.preferences,
          country,
          filters: discoverArgs,
          preferences,
            constraints,
            excluded,
            preferredShops,
            steamDeckRequest,
            simpleSocialPrompt,
            socialPromptProfile: effectiveSocialProfile,
            executionBudget
          });

        return {
          matches: recovery.matches,
          warnings: [
            ...takeBudgetWarning(executionBudget, "recommendation-recovery"),
            ...recovery.warnings
          ],
          applied: recovery.matches.length > 0
        };
      }

      return {
        matches: [],
        warnings: takeBudgetWarning(executionBudget, "recommendation-recovery"),
        applied: false
      };
    };
    const shouldCollectRawSteamDeckOverlayBrowseCandidates =
      steamDeckRequest &&
      (hasRoguelikeIntent(preferences.genres) ||
        preferences.rawgGenres.includes("strategy") ||
        constraints.strategySignal);
    const shouldCollectRawOverlayBrowseCandidates =
      shouldCollectRawSteamDeckOverlayBrowseCandidates ||
      nonSteamHighRatingStrategyRequest ||
      preferences.deckbuilding ||
      constraints.deckPreference === "required" ||
      constraints.deckSignal;

    if (canUseCatalogFirst) {
      try {
        const strategyRecoveryRankingProfile = nonSteamHighRatingStrategyRequest
          ? buildRecommendationRecoveryRankingProfile(
              "non-steam-strategy-rating",
              args.preferences,
              preferences,
              constraints
            )
          : null;
        const catalogMatches = await this.resolveCatalogCandidates({
          country,
          filters: discoverArgs,
          tags: preferences.tags,
          rawgGenres: preferences.rawgGenres,
          excluded,
          preferredShops,
          executionBudget,
          skipWarningKey: "recommendation-recovery",
          maxMatches: nonSteamHighRatingStrategyRequest ? 2 : 3,
          maxResolutions: nonSteamHighRatingStrategyRequest
            ? 6
            : (preferredShops?.length ?? 0) > 0
              ? 3
              : 5,
          catalogLimit: nonSteamHighRatingStrategyRequest ? 8 : undefined,
          candidateSorter: strategyRecoveryRankingProfile
            ? (candidates) =>
                rankRecommendationRecoveryCandidates(candidates, strategyRecoveryRankingProfile)
            : undefined,
          acceptedDealFilter: strategyRecoveryRankingProfile
            ? (deal) =>
                matchesSparseRecoveryDeal(
                  deal,
                  "non-steam-strategy-rating",
                  constraints,
                  preferences,
                  false
                )
            : undefined
        });

        matches = finalizeRecommendationMatches(catalogMatches.matches);
        mergeDegradedCandidates(catalogMatches.matches);
        warnings.push(...catalogMatches.warnings);

        if (matches.length === 0) {
          if (nonSteamHighRatingStrategyRequest) {
            attemptedTargetedRecovery = true;
          } else {
            attemptedTargetedRecovery = true;
            if (!executionBudget || executionBudget.has(MIN_RECOMMENDATION_RECOVERY_BUDGET_MS)) {
              const recovery = await this.recoverRecommendationMatches({
                country,
                filters: discoverArgs,
                preferences,
                excluded,
                preferredShops,
                steamDeckRequest,
                skipPrimaryAttempt: true,
                executionBudget
              });

              matches = recovery.matches;
              mergeDegradedCandidates(recovery.matches);
              warnings.push(...recovery.warnings);
            } else {
              warnings.push(...takeBudgetWarning(executionBudget, "recommendation-recovery"));
            }
          }
        }
      } catch (error) {
        warnings.push(
          toWarning(error, "추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다.")
        );
      }
    }

    matches = finalizeRecommendationMatches(matches);

    if (matches.length === 0 && preferSteamDeckBrowseFirst) {
      if (executionBudget.has(executionProfile.baseBrowseMinMs)) {
        base = await this.discoverDealsInternal(discoverArgs, {
          maxSteamLookups: RECOMMENDATION_STEAM_ENRICHMENT,
          ...(shouldCollectRawOverlayBrowseCandidates
            ? {
                collectRawCandidates: (deals) => {
                  mergeRawBrowseCandidates(deals);
                  if (shouldCollectRawSteamDeckOverlayBrowseCandidates) {
                    mergeRawSteamDeckOverlayBrowseCandidates(deals);
                  }
                }
              }
            : {}),
          skipCatalogFallback:
            steamDeckRequest ||
            (hasStrongCatalogIntent &&
              executionBudget.remainingMs() < MIN_BASE_BROWSE_CATALOG_FALLBACK_BUDGET_MS),
          allowDeckbuildingGenreFallback:
            preferences.deckbuilding || constraints.deckPreference === "required",
          preferDeckbuildingSignal: strictDeckCuePrompt,
          lenientFallbackMode: simpleSocialPrompt
            ? "genre-platform-and-multiplayer"
            : "genre-only"
        });
        mergeRawSocialBrowseCandidates(base.matches as DealCandidate[]);
        matches = (base.matches as DealCandidate[]).filter(
          (deal) => !deal.genres.some((genre) => excluded.has(genre.trim().toLowerCase()))
        );
        mergeRawBrowseCandidates(matches);
        mergeDegradedCandidates(matches);
        warnings.push(...base.warnings);

        matches = finalizeRecommendationMatches(matches);
      } else {
        warnings.push(...takeBudgetWarning(executionBudget, "recommendation-browse"));
      }
    }

    let pendingSparseRecoveryProfile =
      this.providers.discoverTitles && this.providers.resolveDeal
        ? buildRecommendationSparseRecoveryProfile({
            currentMatches: matches,
            preferences,
            constraints,
            steamDeckRequest,
            simpleSocialPrompt
          })
        : null;
    const pendingSparseRecoveryKind = pendingSparseRecoveryProfile?.kind ?? null;
    let sparseRecoveryAttempted = false;

    if (
      matches.length === 0 &&
      genericSteamRoguelikeRequest &&
      !attemptedTargetedRecovery &&
      pendingSparseRecoveryKind == null
    ) {
      try {
        attemptedTargetedRecovery = true;
        if (!executionBudget || executionBudget.has(MIN_GENERIC_STEAM_RECOVERY_BUDGET_MS)) {
          const recovery = await this.recoverRecommendationMatches({
            country,
            filters: discoverArgs,
            preferences,
            excluded,
            preferredShops,
            steamDeckRequest,
            skipPrimaryAttempt: false,
            executionBudget
          });

          matches = recovery.matches;
          mergeDegradedCandidates(recovery.matches);
          warnings.push(...recovery.warnings);
        } else {
          warnings.push(...takeBudgetWarning(executionBudget, "recommendation-recovery"));
        }
      } catch (error) {
        warnings.push(
          toWarning(error, "추가 추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다.")
        );
      }
    }

    if (
      matches.length === 0 &&
      !steamDeckRequest &&
      simpleSocialPrompt &&
      pendingSparseRecoveryProfile?.kind === "broad-multiplayer"
    ) {
      try {
        sparseRecoveryAttempted = true;
        const recovery = await runSparseRecoveryProfile(pendingSparseRecoveryProfile);
        matches = finalizeRecommendationMatches(
          mergeRecommendationCandidates(matches, recovery.matches)
        );
        mergeDegradedCandidates(recovery.matches);
        warnings.push(...recovery.warnings);
        sparseRecoveryApplied = recovery.applied;
      } catch (error) {
        warnings.push(
          toWarning(error, "추가 추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다.")
        );
      }
    }

    if (matches.length === 0 && !preferSteamDeckBrowseFirst) {
      if (executionBudget.has(executionProfile.baseBrowseMinMs)) {
        base = await this.discoverDealsInternal(discoverArgs, {
          ...(strategyBrowseRawgBudget ? { maxRawgLookups: strategyBrowseRawgBudget } : {}),
          maxSteamLookups: RECOMMENDATION_STEAM_ENRICHMENT,
          ...(shouldCollectRawOverlayBrowseCandidates
            ? {
                collectRawCandidates: (deals) => {
                  mergeRawBrowseCandidates(deals);
                  if (shouldCollectRawSteamDeckOverlayBrowseCandidates) {
                    mergeRawSteamDeckOverlayBrowseCandidates(deals);
                  }
                }
              }
            : {}),
          skipCatalogFallback:
            steamDeckRequest ||
            (hasStrongCatalogIntent &&
              executionBudget.remainingMs() < MIN_BASE_BROWSE_CATALOG_FALLBACK_BUDGET_MS),
          allowDeckbuildingGenreFallback:
            preferences.deckbuilding || constraints.deckPreference === "required",
          preferDeckbuildingSignal: strictDeckCuePrompt,
          lenientFallbackMode: simpleSocialPrompt
            ? "genre-platform-and-multiplayer"
            : "genre-only"
        });
        mergeRawSocialBrowseCandidates(base.matches as DealCandidate[]);
        matches = (base.matches as DealCandidate[]).filter(
          (deal) => !deal.genres.some((genre) => excluded.has(genre.trim().toLowerCase()))
        );
        mergeRawBrowseCandidates(matches);
        mergeDegradedCandidates(matches);
        warnings.push(...base.warnings);

        matches = finalizeRecommendationMatches(matches);
      } else {
        warnings.push(...takeBudgetWarning(executionBudget, "recommendation-browse"));
      }
    }

    if (matches.length === 0 && !attemptedTargetedRecovery && pendingSparseRecoveryKind == null) {
      try {
        attemptedTargetedRecovery = true;
        if (!executionBudget || executionBudget.has(MIN_RECOMMENDATION_RECOVERY_BUDGET_MS)) {
          const recovery = await this.recoverRecommendationMatches({
            country,
            filters: discoverArgs,
            preferences,
            excluded,
            preferredShops,
            steamDeckRequest,
            skipPrimaryAttempt: false,
            executionBudget
          });

          matches = recovery.matches;
          mergeDegradedCandidates(recovery.matches);
          warnings.push(...recovery.warnings);
        } else {
          warnings.push(...takeBudgetWarning(executionBudget, "recommendation-recovery"));
        }
      } catch (error) {
        warnings.push(
          toWarning(error, "추가 추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다.")
        );
      }
    }

    if (
      this.providers.discoverTitles &&
      this.providers.resolveDeal &&
      shouldAttemptShapeAwareRecovery({
        rawPreferences: args.preferences,
        currentMatches: matches,
        preferences,
        constraints
      })
    ) {
      try {
        if (!executionBudget || executionBudget.has(MIN_RECOMMENDATION_RECOVERY_BUDGET_MS)) {
          const recovery = await this.recoverShapeAwareRecommendationMatches({
            rawPreferences: args.preferences,
            currentMatches: matches,
            country,
            filters: discoverArgs,
            preferences,
            constraints,
            excluded,
            preferredShops,
            executionBudget
          });

          matches = finalizeRecommendationMatches(
            mergeRecommendationCandidates(matches, recovery.matches)
          );
          mergeDegradedCandidates(recovery.matches);
          warnings.push(...recovery.warnings);
        } else {
          warnings.push(...takeBudgetWarning(executionBudget, "recommendation-recovery"));
        }
      } catch (error) {
        warnings.push(
          toWarning(error, "추가 추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다.")
        );
      }
    }

    if (this.providers.discoverTitles && this.providers.resolveDeal) {
      const sparseRecoveryProfile =
        sparseRecoveryAttempted && pendingSparseRecoveryProfile?.kind === "broad-multiplayer"
          ? null
          : pendingSparseRecoveryProfile ??
            buildRecommendationSparseRecoveryProfile({
              currentMatches: matches,
              preferences,
              constraints,
              steamDeckRequest,
              simpleSocialPrompt
            });

      if (sparseRecoveryProfile) {
        try {
          const recovery = await runSparseRecoveryProfile(sparseRecoveryProfile);
          matches = finalizeRecommendationMatches(
            mergeRecommendationCandidates(matches, recovery.matches)
          );
          mergeDegradedCandidates(recovery.matches);
          warnings.push(...recovery.warnings);
          sparseRecoveryApplied = recovery.applied;
        } catch (error) {
          warnings.push(
            toWarning(error, "추가 추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다.")
          );
        }
      }
    }

    if (matches.length === 0 && !steamDeckRequest && preferences.multiplayer) {
      try {
        if (executionBudget.has(executionProfile.structuredBrowseMinMs)) {
          const browseRecovery = await this.recoverStructuredMultiplayerBrowseMatches({
            rawPreferences: args.preferences,
            country,
            budget: args.budget,
            platforms: effectivePlatforms,
            constraints,
            executionBudget,
            maxRawgLookups: executionProfile.structuredBrowseRawgLookups,
            maxQueriesWhenTight: executionProfile.structuredBrowseTightQueryLimit,
            fullBrowseMinMs: executionProfile.structuredBrowseFullMinMs,
            socialProfile: effectiveSocialProfile
          });

          mergeRawSocialBrowseCandidates(browseRecovery.rawMatches);
          matches = finalizeRecommendationMatches(
            mergeRecommendationCandidates(matches, browseRecovery.matches)
          );
          mergeDegradedCandidates(browseRecovery.matches);
          warnings.push(...browseRecovery.warnings);
        } else {
          warnings.push(...takeBudgetWarning(executionBudget, "recommendation-recovery"));
        }
      } catch (error) {
        warnings.push(
          toWarning(error, "추가 추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다.")
        );
      }
    }

    const sparseOverlayProfile = buildRecommendationSparseRecoveryProfile({
      currentMatches: matches,
      preferences,
      constraints,
      steamDeckRequest,
      simpleSocialPrompt
    });
    const providerOutageProfile = hasRecommendationProviderOutageWarning(warnings);
    const useRawStrategyOverlayBase =
      nonSteamHighRatingStrategyRequest &&
      hasNonSteamStrategyOverlayRecoverySignal(warnings) &&
      rawBrowseCandidates.length > 0;
    const useRawSimpleSocialOverlayBase =
      socialPromptProfile &&
      hasSimpleSocialOverlayRecoverySignal(warnings) &&
      rawSocialBrowseCandidates.length > 0;
    const useRawSteamDeckOverlayBase =
      hasWarningTriggeredSteamDeckMetadataRecoverySignal(warnings) &&
      rawSteamDeckOverlayBrowseCandidates.length > 0 &&
      sparseOverlayProfile !== null &&
      isWarningTriggeredSteamDeckOverlayKind(sparseOverlayProfile.kind);
    const useRawDeckbuildingOverlayBase =
      rawBrowseCandidates.length > 0 &&
      sparseOverlayProfile?.kind === "deckbuilding-card" &&
      (hasMetadataOmissionWarning(warnings) ||
        hasWarningTriggeredSteamDeckMetadataRecoverySignal(warnings));
    const useRawProviderOutageOverlayBase =
      providerOutageProfile &&
      rawBrowseCandidates.length > 0 &&
      sparseOverlayProfile !== null &&
      (sparseOverlayProfile.kind === "deckbuilding-card" ||
        sparseOverlayProfile.kind === "non-steam-strategy-rating" ||
        isSteamDeckSparseRecoveryKind(sparseOverlayProfile.kind));
    const effectiveSparseOverlayProfile =
      useRawSteamDeckOverlayBase && sparseOverlayProfile
        ? widenSteamDeckOverlayProfile(sparseOverlayProfile)
        : sparseOverlayProfile;
    const overlayBaseMatches = useRawStrategyOverlayBase
        ? rawBrowseCandidates
      : useRawSimpleSocialOverlayBase
        ? rawSocialBrowseCandidates
        : useRawSteamDeckOverlayBase
          ? rawSteamDeckOverlayBrowseCandidates
        : useRawDeckbuildingOverlayBase
          ? rawBrowseCandidates
        : useRawProviderOutageOverlayBase
          ? rawBrowseCandidates
        : degradedCandidates;
    const providerOutageOverlayRequired =
      providerOutageProfile &&
      effectiveSparseOverlayProfile !== null &&
      shouldAttemptProviderOutageOverlay({
        matches,
        kind: effectiveSparseOverlayProfile.kind,
        constraints,
        preferences,
        steamDeckRequest,
        socialProfile: effectiveSocialProfile
      });

    if (
      (matches.length === 0 || providerOutageOverlayRequired) &&
      overlayBaseMatches.length > 0 &&
      this.providers.discoverTitles &&
        (!steamDeckRequest ||
          hasWarningTriggeredSteamDeckMetadataRecoverySignal(warnings) ||
          useRawStrategyOverlayBase ||
          useRawSimpleSocialOverlayBase ||
          useRawSteamDeckOverlayBase ||
          useRawDeckbuildingOverlayBase ||
          useRawProviderOutageOverlayBase)
    ) {
      if (effectiveSparseOverlayProfile) {
        try {
          if (executionBudget.has(executionProfile.metadataOverlayMinMs)) {
            const overlay = await this.overlaySparseRecoveryCatalogMetadata({
              profile: effectiveSparseOverlayProfile,
              baseMatches: overlayBaseMatches,
              filters: discoverArgs,
              constraints,
              preferences,
              steamDeckRequest,
              socialProfile: effectiveSocialProfile,
              executionBudget
            });

            const overlayMatches = providerOutageProfile
              ? overlay.matches.filter((deal) =>
                  matchesProviderOutageOverlayDeal(deal, {
                    kind: effectiveSparseOverlayProfile.kind,
                    constraints,
                    preferences,
                    steamDeckRequest,
                    requestedPlatforms: effectivePlatforms,
                    budget: args.budget,
                    socialProfile: effectiveSocialProfile
                  })
                )
              : overlay.matches;
            const overlaidMatches = providerOutageOverlayRequired
              ? mergeRecommendationCandidates(overlayMatches, matches)
              : mergeRecommendationCandidates(matches, overlayMatches);
            const strictOverlayMatches = finalizeRecommendationMatches(overlaidMatches);
            matches =
              strictOverlayMatches.length === 0 &&
              shouldApplyWarningTriggeredSteamDeckOverlayFallback({
                steamDeckRequest,
                warnings: [...warnings, ...overlay.warnings],
                kind: effectiveSparseOverlayProfile.kind
              })
                ? applyWarningTriggeredSteamDeckOverlayFallback({
                    matches: overlaidMatches,
                    kind: effectiveSparseOverlayProfile.kind,
                    filters: discoverArgs,
                    preferences,
                    constraints
                  }).slice(0, effectiveSparseOverlayProfile.maxMatches)
                : strictOverlayMatches;
            mergeDegradedCandidates(overlayMatches);
            warnings.push(...overlay.warnings);
          } else {
            warnings.push(...takeBudgetWarning(executionBudget, "recommendation-recovery"));
          }
        } catch (error) {
          warnings.push(
            toWarning(error, "추가 추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다.")
          );
        }
      }
    }

    if (
      matches.length === 0 &&
      strictSocialProfile &&
      effectiveSocialProfile &&
      hasSocialEvidenceRescueSignal(warnings)
    ) {
      const richSocialRescue = recoverRichSocialPromptMatches({
        deals: mergeRecommendationCandidates(rawSocialBrowseCandidates, degradedCandidates),
        requestedPlatforms: effectivePlatforms,
        budget: args.budget,
        constraints,
        socialProfile: effectiveSocialProfile
      });

      if (richSocialRescue.length > 0) {
        matches = richSocialRescue;
      }
    }

    if (
      matches.length === 0 &&
      shouldApplyRawNonSteamStrategyOutageRescue({
        nonSteamHighRatingStrategyRequest,
        warnings,
        rawBrowseCandidates
      })
    ) {
      matches = finalizeRecommendationMatches(
        recoverRawNonSteamStrategyOutageMatches({
          deals: rawBrowseCandidates,
          filters: discoverArgs,
          constraints,
          preferences
        })
      );
    }

    if (matches.length > 0 && !sparseRecoveryApplied) {
      try {
        if (executionBudget.has(executionProfile.mixingMinMs)) {
          const mixed = await this.mixRecommendationCatalogCandidates({
            currentMatches: matches,
            rawPreferences: args.preferences,
            preferences,
            platforms: effectivePlatforms,
            constraints,
            country,
            preferredShops,
            executionBudget
          });

          matches = applyRecommendationQualityGates(
            applyRequiredConstraintSignalGates(
              applySteamDeckCompatibilityPreference(
                applyRecommendationHardConstraints(mixed.matches, constraints),
                steamDeckRequest
              )
            ),
            preferences
          );
          mergeDegradedCandidates(mixed.matches);
          warnings.push(...mixed.warnings);
        } else {
          warnings.push(...takeBudgetWarning(executionBudget, "recommendation-mixing"));
        }
      } catch (error) {
        warnings.push(
          toWarning(error, "추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다.")
        );
      }
    }

    if (matches.length === 0) {
      const degraded = applyRecommendationDegradedMode({
        deals: degradedCandidates,
        warnings,
        preferences,
        steamDeckRequest,
        constraints
      });

      if (degraded.applied && degraded.matches.length > 0) {
        matches = degraded.matches;
        warnings.push(RECOMMENDATION_DEGRADED_MODE_WARNING);
      }
    }

    if (matches.length === 0) {
      const emptyBase =
        base ??
        ({
          summary: "조건에 맞는 할인 게임을 찾지 못했습니다.",
          warnings
        } as CompareResult);
      const noRecommendation = buildNoRecommendationOutcome({
        base: emptyBase,
        preferences,
        constraints,
        steamDeckRequest,
        socialProfile: effectiveSocialProfile
      });

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
        summary: noRecommendation.summary,
        sources: ["IsThereAnyDeal", "RAWG"],
        warnings: uniqueWarnings(warnings),
        emptyReason: noRecommendation.emptyReason,
        missingEvidence: noRecommendation.missingEvidence
      };
    }

    matches = applyBroadIntentRanking(matches, broadIntentSignals);
    matches = applyRecommendationReranker(matches, {
      rawPreferences: args.preferences,
      preferences,
      platforms: effectivePlatforms,
      constraints
    });

    const evidenceMatches = buildEvidenceFirstRecommendationMatches({
      deals: matches,
      rawPreferences: args.preferences,
      preferences,
      constraints,
      requestedPlatforms: effectivePlatforms,
      budget: args.budget,
      steamDeckRequest,
      socialProfile: effectiveSocialProfile
    });
    const top = evidenceMatches[0];
    if (!top) {
      const noRecommendation = buildNoRecommendationOutcome({
        base: base ?? ({ summary: "", warnings } as CompareResult),
        preferences,
        constraints,
        steamDeckRequest,
        socialProfile: effectiveSocialProfile
      });

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
        summary: noRecommendation.summary,
        sources: base?.sources ?? ["IsThereAnyDeal", "RAWG"],
        warnings: uniqueWarnings(warnings),
        emptyReason: noRecommendation.emptyReason,
        missingEvidence: noRecommendation.missingEvidence
      };
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
      matches: evidenceMatches,
      summary: buildRecommendationSummary(top),
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
    tags?: string[] | undefined;
    rawgGenres?: string[] | undefined;
    excluded: Set<string>;
    preferredShops?: number[] | undefined;
    candidateFilter?: ((candidate: CatalogCandidate) => boolean) | undefined;
    candidateSorter?: ((candidates: CatalogCandidate[]) => CatalogCandidate[]) | undefined;
    acceptedDealFilter?: ((deal: DealCandidate) => boolean) | undefined;
    stopAfterAcceptedMatch?: boolean | undefined;
    executionBudget?: RecommendationExecutionBudget | undefined;
    skipWarningKey?: string | undefined;
    maxMatches?: number | undefined;
    maxResolutions?: number | undefined;
    catalogLimit?: number | undefined;
    seenCandidateKeys?: Set<string> | undefined;
  }): Promise<{ matches: DealCandidate[]; warnings: string[]; resolvedCount: number }> {
    if (!this.providers.discoverTitles || !this.providers.resolveDeal) {
      return { matches: [], warnings: [], resolvedCount: 0 };
    }

    if (args.executionBudget && !args.executionBudget.has(MIN_RESOLVE_DEAL_BUDGET_MS)) {
      return {
        matches: [],
        warnings: takeBudgetWarning(args.executionBudget, args.skipWarningKey ?? "catalog-resolution"),
        resolvedCount: 0
      };
    }

    const catalog = await this.providers.discoverTitles({
      tags: args.tags,
      genres: args.rawgGenres,
      limit: args.catalogLimit ?? 12
    });

    const warnings: string[] = [];
    const filteredCatalog = filterCatalogCandidates(catalog).filter((candidate) => {
      if (!(args.candidateFilter?.(candidate) ?? true)) {
        return false;
      }

      if (!args.seenCandidateKeys) {
        return true;
      }

      const key = candidate.title.trim().toLowerCase();
      if (args.seenCandidateKeys.has(key)) {
        return false;
      }

      args.seenCandidateKeys.add(key);
      return true;
    });
    const rankedCatalog = args.candidateSorter ? args.candidateSorter(filteredCatalog) : filteredCatalog;
    const matches: DealCandidate[] = [];
    let resolvedCount = 0;

    for (const candidate of rankedCatalog.slice(0, args.maxResolutions ?? MAX_CATALOG_RESOLUTIONS)) {
      if (args.executionBudget && !args.executionBudget.has(MIN_RESOLVE_DEAL_BUDGET_MS)) {
        warnings.push(...takeBudgetWarning(args.executionBudget, args.skipWarningKey ?? "catalog-resolution"));
        break;
      }

      let resolution: DealResolution;
      resolvedCount += 1;
      try {
        resolution = await this.providers.resolveDeal!(candidate.title, args.country, {
          preferredShops: args.preferredShops,
          dealsOnly: (args.preferredShops?.length ?? 0) > 0
        });
      } catch (error) {
        warnings.push(
          toWarning(
            error,
            `추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다: ${candidate.title}`
          )
        );
        continue;
      }

      warnings.push(...(resolution.warnings ?? []));

      if (resolution.kind !== "match") {
        continue;
      }

      const acceptedMatches = (resolution.matches ?? [])
        .filter(
          (deal) =>
            deal.cut > 0 &&
            !deal.genres.some((genre) => args.excluded.has(genre.trim().toLowerCase()))
        )
        .map((deal) => mergeCatalogMetadata(deal, candidate, args.tags))
        .filter((deal) => (args.acceptedDealFilter?.(deal) ?? true));

      matches.push(...acceptedMatches);
      const viableMatches = scoreDealCandidates(dedupeDeals(matches), args.filters).slice(
        0,
        args.maxMatches ?? Number.POSITIVE_INFINITY
      );

      if (
        acceptedMatches.length > 0 &&
        ((args.stopAfterAcceptedMatch && viableMatches.length > 0) ||
          ((args.maxMatches ?? 0) > 0 && viableMatches.length >= args.maxMatches!))
      ) {
        break;
      }
    }

    return {
      matches: scoreDealCandidates(dedupeDeals(matches), args.filters).slice(
        0,
        args.maxMatches ?? Number.POSITIVE_INFINITY
      ),
      warnings,
      resolvedCount
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
    executionBudget?: RecommendationExecutionBudget | undefined;
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
    const minimumBudget = broadSteamRoguelikeRecovery
      ? MIN_GENERIC_STEAM_RECOVERY_BUDGET_MS
      : MIN_RECOMMENDATION_RECOVERY_BUDGET_MS;

    if (args.executionBudget && !args.executionBudget.has(minimumBudget)) {
      return {
        matches: [],
        warnings: takeBudgetWarning(args.executionBudget, "recommendation-recovery")
      };
    }

    if (broadSteamRoguelikeRecovery) {
      const broadRecovery = await this.recoverBroadSteamRoguelikeDeals(args);
      warnings.push(...broadRecovery.warnings);

      if (broadRecovery.matches.length > 0) {
        return broadRecovery;
      }
    }

    for (const recoverySignals of recoveryAttempts) {
      const recovered = await this.resolveCatalogCandidates({
        country: args.country,
        filters: args.filters,
        tags: recoverySignals.tags,
        rawgGenres: recoverySignals.rawgGenres,
        excluded: args.excluded,
        preferredShops: args.preferredShops,
        executionBudget: args.executionBudget,
        skipWarningKey: "recommendation-recovery",
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

  private async recoverShapeAwareRecommendationMatches(args: {
    rawPreferences: string;
    currentMatches: DealCandidate[];
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
    constraints: RecommendationConstraints;
    excluded: Set<string>;
    preferredShops?: number[] | undefined;
    executionBudget?: RecommendationExecutionBudget | undefined;
  }): Promise<{ matches: DealCandidate[]; warnings: string[] }> {
    const warnings: string[] = [];
    let matches: DealCandidate[] = [];

    if (
      shouldAttemptActionRecovery(args.currentMatches, args.preferences, args.constraints)
    ) {
      const recovered = await this.resolveCatalogCandidates({
        country: args.country,
        filters: args.filters,
        tags: ["roguelike", "roguelite"],
        rawgGenres: ["action"],
        excluded: args.excluded,
        preferredShops: args.preferredShops,
        executionBudget: args.executionBudget,
        skipWarningKey: "recommendation-recovery",
        maxMatches: 2,
        maxResolutions: 4,
        catalogLimit: 8,
        candidateFilter: (candidate) =>
          matchesActionRecoveryCandidate(candidate, args.constraints)
      });

      warnings.push(...recovered.warnings);
      matches = mergeRecommendationCandidates(
        matches,
        recovered.matches.filter((deal) => matchesActionRecoveryDeal(deal, args.constraints))
      );
    }

    return { matches, warnings };
  }

  private async recoverSparseRecommendationMatches(args: {
    profile: RecommendationRecoveryProfile;
    rawPreferences: string;
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
    constraints: RecommendationConstraints;
    excluded: Set<string>;
    preferredShops?: number[] | undefined;
    steamDeckRequest: boolean;
    simpleSocialPrompt?: boolean | undefined;
    socialPromptProfile?: RecommendationSocialPromptProfile | null | undefined;
    executionBudget?: RecommendationExecutionBudget | undefined;
  }): Promise<{ matches: DealCandidate[]; warnings: string[] }> {
    const warnings: string[] = [];
    let matches: DealCandidate[] = [];
    let remainingResolutions = args.profile.maxResolutions;
    const seenCandidateKeys = new Set<string>();
    const rankingProfile: RecommendationRecoveryRankingProfile = {
      ...buildRecommendationRecoveryRankingProfile(
        args.profile.kind,
        args.rawPreferences,
        args.preferences,
        args.constraints,
        args.filters.platforms ?? args.preferences.platforms,
        args.simpleSocialPrompt,
        args.socialPromptProfile ?? undefined
      ),
      shortSession: args.preferences.shortSession
    };

    for (const query of args.profile.queries.slice(0, args.profile.maxDiscoverCalls)) {
      if (remainingResolutions <= 0) {
        break;
      }

      const recovered = await this.resolveCatalogCandidates({
        country: args.country,
        filters: args.filters,
        tags: query.tags,
        rawgGenres: query.rawgGenres,
        excluded: args.excluded,
        preferredShops: args.preferredShops,
        executionBudget: args.executionBudget,
        skipWarningKey: "recommendation-recovery",
        maxMatches: args.profile.maxMatches,
        maxResolutions: remainingResolutions,
        catalogLimit: query.limit,
        seenCandidateKeys,
        candidateSorter: (candidates) =>
          rankRecommendationRecoveryCandidates(candidates, rankingProfile),
        acceptedDealFilter: (deal) =>
          matchesSparseRecoveryDeal(
            deal,
            args.profile.kind,
            args.constraints,
            args.preferences,
            args.steamDeckRequest,
            args.socialPromptProfile ?? undefined
          ),
        stopAfterAcceptedMatch: isDiscountSeekingSparseRecoveryKind(args.profile.kind),
        candidateFilter: (candidate) =>
          matchesSparseRecoveryCandidate(
            candidate,
            args.profile.kind,
            args.constraints,
            args.filters.platforms ?? args.preferences.platforms,
            args.socialPromptProfile ?? undefined
          )
      });

      warnings.push(...recovered.warnings);
      remainingResolutions = Math.max(0, remainingResolutions - recovered.resolvedCount);
      matches = mergeRecommendationCandidates(matches, recovered.matches);

      if (recovered.matches.length > 0 && isDiscountSeekingSparseRecoveryKind(args.profile.kind)) {
        break;
      }

      if (dedupeDeals(matches).length >= args.profile.maxMatches) {
        break;
      }
    }

    return {
      matches: finalizeSparseRecoveryMatches(
        matches,
        args.profile.kind,
        args.filters,
        args.preferences,
        args.steamDeckRequest
      ).slice(0, args.profile.maxMatches),
      warnings
    };
  }

  private async overlaySparseRecoveryCatalogMetadata(args: {
    profile: RecommendationRecoveryProfile;
    baseMatches: DealCandidate[];
    filters: DiscoverFilters & { country: string };
    constraints: RecommendationConstraints;
    preferences: {
      shortSession: boolean;
      platforms: string[];
    };
    steamDeckRequest: boolean;
    socialProfile?: RecommendationSocialPromptProfile | null | undefined;
    executionBudget?: RecommendationExecutionBudget | undefined;
  }): Promise<{ matches: DealCandidate[]; warnings: string[] }> {
    if (!this.providers.discoverTitles) {
      return { matches: [], warnings: [] };
    }

    const warnings: string[] = [];
    const seenCandidateKeys = new Set<string>();
    const usedBaseKeys = new Set<string>();
    let matches: DealCandidate[] = [];

    for (const query of args.profile.queries.slice(0, args.profile.maxDiscoverCalls)) {
      if (args.executionBudget && !args.executionBudget.has(MIN_CATALOG_METADATA_OVERLAY_BUDGET_MS)) {
        warnings.push(...takeBudgetWarning(args.executionBudget, "recommendation-recovery"));
        break;
      }

      const catalog = await this.providers.discoverTitles({
        tags: query.tags,
        genres: query.rawgGenres,
        limit: query.limit
      });

      for (const candidate of filterCatalogCandidates(catalog)) {
        if (
          !matchesSparseRecoveryCandidate(
            candidate,
            args.profile.kind,
            args.constraints,
            args.filters.platforms ?? args.preferences.platforms,
            args.socialProfile ?? undefined
          )
        ) {
          continue;
        }

        const key = candidate.title.trim().toLowerCase();
        if (seenCandidateKeys.has(key)) {
          continue;
        }

        seenCandidateKeys.add(key);
        const availableBaseMatches = args.baseMatches.filter(
          (deal) => !usedBaseKeys.has(getRecommendationRecoveryDealKey(deal))
        );
        const titleMatch = findBestRecommendationTitleMatch(candidate.title, availableBaseMatches);
        if (!titleMatch) {
          continue;
        }

        const baseMatch = titleMatch.candidate;
        const merged = mergeCatalogMetadata(baseMatch, candidate, query.tags);
        if (
          !matchesSparseRecoveryDeal(
            merged,
            args.profile.kind,
            args.constraints,
            args.preferences,
            args.steamDeckRequest,
            args.socialProfile ?? undefined
          )
        ) {
          continue;
        }

        usedBaseKeys.add(getRecommendationRecoveryDealKey(baseMatch));
        matches = mergeRecommendationCandidates(matches, [merged]);
        if (dedupeDeals(matches).length >= 1) {
          break;
        }
      }

      if (dedupeDeals(matches).length >= 1) {
        break;
      }
    }

    return {
      matches: finalizeSparseRecoveryMatches(
        matches,
        args.profile.kind,
        args.filters,
        args.preferences,
        args.steamDeckRequest
      ).slice(0, args.profile.maxMatches),
      warnings
    };
  }

  private async recoverStructuredMultiplayerBrowseMatches(args: {
    rawPreferences: string;
    country: string;
    budget?: number | undefined;
    platforms: string[];
    constraints: RecommendationConstraints;
    executionBudget?: RecommendationExecutionBudget | undefined;
    maxRawgLookups: number;
    maxQueriesWhenTight: number;
    fullBrowseMinMs: number;
    socialProfile?: RecommendationSocialPromptProfile | null | undefined;
  }): Promise<{ matches: DealCandidate[]; rawMatches: DealCandidate[]; warnings: string[] }> {
    const warnings: string[] = [];
    let matches: DealCandidate[] = [];
    let rawMatches: DealCandidate[] = [];
    const queries = buildStructuredMultiplayerBrowseQueries(
      args.rawPreferences,
      args.constraints,
      args.socialProfile ?? undefined
    );
    const limitedQueries =
      args.executionBudget && !args.executionBudget.has(args.fullBrowseMinMs)
        ? queries.slice(0, args.maxQueriesWhenTight)
        : queries;

    for (const query of limitedQueries) {
      if (args.executionBudget && !args.executionBudget.has(MIN_RECOMMENDATION_BASE_BROWSE_BUDGET_MS)) {
        warnings.push(...takeBudgetWarning(args.executionBudget, "recommendation-recovery"));
        break;
      }

      const browse = await this.discoverDealsInternal(
        {
          country: args.country,
          budget: args.budget,
          platforms: args.platforms,
          multiplayer: true,
          sort: query.sort,
          ...(query.genres ? { genres: query.genres } : {})
        },
        {
          skipCatalogFallback: true,
          lenientFallbackMode:
            args.maxQueriesWhenTight > 2
              ? "genre-platform-and-multiplayer"
              : "genre-and-platform",
          maxRawgLookups: args.maxRawgLookups
        }
      );

      rawMatches = mergeRecommendationCandidates(rawMatches, browse.matches as DealCandidate[]);
      warnings.push(...browse.warnings);

      const accepted = rankStructuredMultiplayerBrowseDeals(
        (browse.matches as DealCandidate[]).filter((deal) =>
          matchesStructuredMultiplayerBrowseDeal(deal, {
            requestedPlatforms: args.platforms,
            budget: args.budget,
            constraints: args.constraints,
            partyPrompt: query.mode === "party",
            reviewBacked: args.constraints.qualityIntent.includes("review-backed"),
            socialProfile: args.socialProfile ?? undefined
          })
        ),
        {
          partyPrompt: query.mode === "party",
          reviewBacked: args.constraints.qualityIntent.includes("review-backed"),
          nonCompetitive:
            args.constraints.coopMode.includes("non-competitive") ||
            args.constraints.excludeGenres.includes("pvp"),
          excludeRacingOrSports:
            args.constraints.excludeGenres.includes("racing") ||
            args.constraints.excludeGenres.includes("sports"),
          budget: args.budget,
          socialProfile: args.socialProfile ?? undefined
        }
      );

      if (accepted.length === 0) {
        continue;
      }

      matches = mergeRecommendationCandidates(matches, accepted.slice(0, 2));
      break;
    }

    if (
      matches.length === 0 &&
      args.socialProfile &&
      hasSocialEvidenceRescueSignal(warnings)
    ) {
      matches = recoverStructuredMultiplayerBrowseSocialMatches({
        deals: rawMatches,
        requestedPlatforms: args.platforms,
        budget: args.budget,
        constraints: args.constraints,
        reviewBacked: args.constraints.qualityIntent.includes("review-backed"),
        socialProfile: args.socialProfile
      });
    }

    return { matches: dedupeDeals(matches).slice(0, 2), rawMatches, warnings };
  }

  private async recoverBroadSteamRoguelikeDeals(args: {
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
    executionBudget?: RecommendationExecutionBudget | undefined;
  }): Promise<{ matches: DealCandidate[]; warnings: string[] }> {
    const broadFilters: DiscoverFilters & { country: string } = {
      ...args.filters,
      genres: undefined
    };

    const baseDeals = await this.providers.findDeals({
      ...broadFilters,
      country: args.country,
      preferredShops: args.preferredShops
    });
    const warnings: string[] = [];
    const candidateDeals = filterJunkCandidates(baseDeals);

    if (candidateDeals.length === 0) {
      return { matches: [], warnings };
    }
    const discountedTitles = new Set(
      candidateDeals.map((deal) => normalizeTitleKey(deal.title)).filter(Boolean)
    );
    const recovered = await this.resolveCatalogCandidates({
      country: args.country,
      filters: args.filters,
      tags: ["roguelike", "roguelite"],
      rawgGenres: [],
      excluded: args.excluded,
      preferredShops: args.preferredShops,
      executionBudget: args.executionBudget,
      skipWarningKey: "recommendation-recovery",
      maxMatches: 3,
      maxResolutions: 4,
      candidateFilter: (candidate) =>
        discountedTitles.has(normalizeTitleKey(candidate.title)) &&
        catalogCandidateMatchesRecoveryIntent(candidate, args.preferences)
    });

    warnings.push(...recovered.warnings);

    return {
      matches: applyRecommendationQualityGates(
        applySteamDeckCompatibilityPreference(recovered.matches, args.steamDeckRequest).filter(
          (deal) => matchesDealRecoveryIntent(deal, args.preferences)
        ),
        args.preferences
      ),
      warnings
    };
  }

  private async mixRecommendationCatalogCandidates(args: {
    currentMatches: DealCandidate[];
    rawPreferences: string;
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
    platforms: string[];
    constraints: RecommendationConstraints;
    country: string;
    preferredShops?: number[] | undefined;
    executionBudget?: RecommendationExecutionBudget | undefined;
  }): Promise<{ matches: DealCandidate[]; warnings: string[] }> {
    if (!this.providers.discoverTitles || !this.providers.resolveDeal) {
      return { matches: args.currentMatches, warnings: [] };
    }

    const { signals, profiles } = buildRecommendationCatalogMixPlan({
      rawPreferences: args.rawPreferences,
      preferences: args.preferences,
      platforms: args.platforms,
      currentMatches: args.currentMatches,
      constraints: args.constraints
    });

    if (profiles.length === 0) {
      return { matches: args.currentMatches, warnings: [] };
    }

    const warnings: string[] = [];
    let combinedMatches = [...args.currentMatches];

    for (const profile of profiles) {
      if (args.executionBudget && !args.executionBudget.has(MIN_RESOLVE_DEAL_BUDGET_MS)) {
        warnings.push(...takeBudgetWarning(args.executionBudget, "recommendation-mixing"));
        return { matches: combinedMatches, warnings };
      }

      let catalog: CatalogCandidate[];

      try {
        catalog = await this.providers.discoverTitles({
          tags: profile.tags,
          genres: profile.rawgGenres,
          limit: profile.limit
        });
      } catch (error) {
        warnings.push(
          toWarning(error, "추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다.")
        );
        continue;
      }

      const candidateQueue = filterRecommendationCatalogCandidates(
        filterCatalogCandidates(catalog),
        profile,
        signals,
        args.constraints
      ).slice(0, profile.maxResolutions);

      if (candidateQueue.length === 0) {
        continue;
      }

      const accepted: DealCandidate[] = [];
      const unknownFallback: DealCandidate[] = [];

      for (const candidate of candidateQueue) {
        if (args.executionBudget && !args.executionBudget.has(MIN_RESOLVE_DEAL_BUDGET_MS)) {
          warnings.push(...takeBudgetWarning(args.executionBudget, "recommendation-mixing"));
          return {
            matches: appendRecommendationMixAdditions(combinedMatches, accepted, unknownFallback, profile),
            warnings
          };
        }

        let resolution: DealResolution;

        try {
          resolution = await this.providers.resolveDeal(candidate.title, args.country, {
            preferredShops: args.preferredShops,
            dealsOnly: (args.preferredShops?.length ?? 0) > 0
          });
        } catch (error) {
          warnings.push(
            toWarning(
              error,
              `추천 후보를 보강하는 중 일부 메타데이터를 생략했습니다: ${candidate.title}`
            )
          );
          continue;
        }

        warnings.push(...(resolution.warnings ?? []));

        if (resolution.kind !== "match") {
          continue;
        }

        const resolvedDeals = (resolution.matches ?? []).map((deal) =>
          mergeCatalogMetadata(deal, candidate, profile.tags)
        );
        const buckets = splitRecommendationCatalogResolvedDeals(
          resolvedDeals,
          profile,
          signals,
          args.constraints
        );

        accepted.push(...buckets.accepted);
        unknownFallback.push(...buckets.unknownFallback);

        if (dedupeDeals(accepted).length >= profile.maxMatches) {
          break;
        }
      }

      combinedMatches = appendRecommendationMixAdditions(
        combinedMatches,
        accepted,
        unknownFallback,
        profile
      );
    }

    return {
      matches: combinedMatches,
      warnings
    };
  }
}

function summarizeDeals(
  deals: DealCandidate[],
  query: { genres?: unknown; platforms?: unknown },
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

function hasMetadataOmissionWarning(warnings: string[]): boolean {
  return warnings.some((warning) => /메타데이터.*생략/i.test(warning));
}

function hasRecommendationProviderOutageWarning(warnings: string[]): boolean {
  return warnings.some(
    (warning) =>
      warning.includes("ITAD request failed with 429") ||
      warning.includes("가격 개요 정보를 가져오지 못해") ||
      warning.includes("역대 최저가 정보를 가져오지 못해") ||
      warning.includes("가격 개요 정보가 없어 제목만 확인했습니다.")
  );
}

function hasRecommendationRawgTimeoutWarning(warnings: string[]): boolean {
  return warnings.some((warning) => {
    const normalized = warning.trim();
    return (
      normalized.includes("RAWG timeout") ||
      normalized.includes("RAWG request failed") ||
      normalized.includes("RAWG 메타데이터를 일부 불러오지 못했습니다")
    );
  });
}

function hasNonSteamStrategyOverlayRecoverySignal(warnings: string[]): boolean {
  return (
    hasMetadataOmissionWarning(warnings) ||
    hasRecommendationProviderOutageWarning(warnings)
  );
}

function hasSimpleSocialOverlayRecoverySignal(warnings: string[]): boolean {
  return (
    hasMetadataOmissionWarning(warnings) ||
    hasRecommendationProviderOutageWarning(warnings)
  );
}

function hasSocialEvidenceRescueSignal(warnings: string[]): boolean {
  return hasSimpleSocialOverlayRecoverySignal(warnings);
}

function shouldApplyRawNonSteamStrategyOutageRescue(args: {
  nonSteamHighRatingStrategyRequest: boolean;
  warnings: string[];
  rawBrowseCandidates: DealCandidate[];
}): boolean {
  return (
    args.nonSteamHighRatingStrategyRequest &&
    args.rawBrowseCandidates.length > 0 &&
    hasMetadataOmissionWarning(args.warnings) &&
    hasRecommendationProviderOutageWarning(args.warnings) &&
    hasRecommendationRawgTimeoutWarning(args.warnings)
  );
}

function isRecommendationOverlayBrowseJunk(deal: DealCandidate): boolean {
  return /\b(bundle|collection|course|tutorial|certification|e-?learning|music|sfx|asset pack|royalty free|demo|ai games?)\b/i.test(
    deal.title
  );
}

function matchesRecommendationRawSocialBrowseCandidate(
  deal: DealCandidate,
  options: {
    requestedPlatforms: string[];
    budget?: number | undefined;
    constraints: RecommendationConstraints;
    socialProfile?: RecommendationSocialPromptProfile | undefined;
  }
): boolean {
  if (deal.cut <= 0 || !deal.multiplayer || isRecommendationOverlayBrowseJunk(deal)) {
    return false;
  }

  if (typeof options.budget === "number" && deal.price.amount > options.budget) {
    return false;
  }

  if (
    options.requestedPlatforms.length > 0 &&
    deal.platforms.length > 0 &&
    !matchesRequestedPlatforms(deal.platforms, options.requestedPlatforms)
  ) {
    return false;
  }

  if (
    (options.constraints.excludeGenres.includes("pvp") ||
      options.constraints.coopMode.includes("non-competitive")) &&
    hasPvPDealEvidence(deal)
  ) {
    return false;
  }

  if (
    (options.constraints.excludeGenres.includes("racing") ||
      options.constraints.excludeGenres.includes("sports")) &&
    hasRacingOrSportsShape(deal)
  ) {
    return false;
  }

  return (
    !options.socialProfile ||
    classifyRecommendationSocialCandidateTier(deal, options.socialProfile) !== "reject"
  );
}

function applyRecommendationSocialPromptGuardrail(
  deals: DealCandidate[],
  options: {
    socialProfile: RecommendationSocialPromptProfile | null;
    requestedPlatforms: string[];
    budget?: number | undefined;
    constraints: RecommendationConstraints;
    allowRescueTier?: boolean | undefined;
  }
): DealCandidate[] {
  const socialProfile = options.socialProfile;
  if (!socialProfile) {
    return deals;
  }

  const strict: DealCandidate[] = [];
  const rescue: DealCandidate[] = [];

  for (const deal of deals) {
    if (deal.cut <= 0 || isRecommendationOverlayBrowseJunk(deal) || !deal.multiplayer) {
      continue;
    }

    if (typeof options.budget === "number" && deal.price.amount > options.budget) {
      continue;
    }

    if (
      options.requestedPlatforms.length > 0 &&
      deal.platforms.length > 0 &&
      !matchesRequestedPlatforms(deal.platforms, options.requestedPlatforms)
    ) {
      continue;
    }

    if (
      (options.constraints.excludeGenres.includes("pvp") ||
        options.constraints.coopMode.includes("non-competitive")) &&
      hasPvPDealEvidence(deal)
    ) {
      continue;
    }

    if (
      (options.constraints.excludeGenres.includes("racing") ||
        options.constraints.excludeGenres.includes("sports")) &&
      hasRacingOrSportsShape(deal)
    ) {
      continue;
    }

    const tier = classifyRecommendationSocialCandidateTier(deal, socialProfile);

    if (tier === "strict") {
      strict.push(deal);
      continue;
    }

    if (tier === "rescue") {
      rescue.push(deal);
    }
  }

  if (strict.length > 0) {
    return strict;
  }

  return options.allowRescueTier ? rescue : [];
}

function rankDiscoverDealsWithLenientFallback(args: {
  deals: DealCandidate[];
  filters: DiscoverFilters;
  preferredShops?: number[] | undefined;
  steamDeckRequest: boolean;
  warnings: string[];
  allowDeckbuildingGenreFallback?: boolean | undefined;
  preferDeckbuildingSignal?: boolean | undefined;
  lenientFallbackMode:
    | "none"
    | "genre-only"
    | "genre-and-platform"
    | "genre-platform-and-multiplayer";
}): DealCandidate[] {
  let rankedDeals = applySteamDeckCompatibilityPreference(
    scoreDealCandidates(args.deals, { ...args.filters, preferredShops: args.preferredShops }),
    args.steamDeckRequest
  );

  if (args.preferDeckbuildingSignal) {
    const deckbuildingPreferredDeals = applySteamDeckCompatibilityPreference(
      scoreDealCandidates(args.deals, {
        ...args.filters,
        genres: undefined,
        preferredShops: args.preferredShops
      }).filter(hasDeckbuildingEvidence),
      args.steamDeckRequest
    );

    rankedDeals = deckbuildingPreferredDeals.length > 0 ? deckbuildingPreferredDeals : [];
  }

  if (
    rankedDeals.length === 0 &&
    args.lenientFallbackMode !== "none" &&
    (args.filters.genres?.length ?? 0) > 0
  ) {
    const requestedGenres = new Set(
      (args.filters.genres ?? []).map((genre) => genre.trim().toLowerCase())
    );
    rankedDeals = applySteamDeckCompatibilityPreference(
      scoreDealCandidates(args.deals, {
        ...args.filters,
        genres: undefined,
        preferredShops: args.preferredShops
      }).filter(
        (deal) =>
          deal.genres.length === 0 ||
          deal.genres.some((genre) => requestedGenres.has(genre.trim().toLowerCase())) ||
          (args.allowDeckbuildingGenreFallback &&
            matchesRequestedDeckbuildingHybridGenres(deal, args.filters.genres ?? []))
      ),
      args.steamDeckRequest
    );
  }

  if (
    rankedDeals.length === 0 &&
    args.steamDeckRequest &&
    hasWarningTriggeredSteamDeckMetadataRecoverySignal(args.warnings) &&
    (args.filters.platforms?.length ?? 0) > 0
  ) {
    rankedDeals = applySteamDeckCompatibilityPreference(
      scoreDealCandidates(args.deals, {
        ...args.filters,
        platforms: undefined,
        genres:
          args.allowDeckbuildingGenreFallback && (args.filters.genres?.length ?? 0) > 0
            ? undefined
            : args.filters.genres,
        preferredShops: args.preferredShops
      }).filter(
        (deal) =>
          getDeckCompatibilityStatus(deal) !== "unsupported" &&
          ((args.filters.genres?.length ?? 0) === 0 ||
            matchesProviderOutageRequestedGenres(deal, args.filters.genres ?? []) ||
            (args.allowDeckbuildingGenreFallback &&
              matchesRequestedDeckbuildingHybridGenres(deal, args.filters.genres ?? [])))
      ),
      args.steamDeckRequest
    );
  }

  if (
    rankedDeals.length === 0 &&
    args.lenientFallbackMode === "genre-and-platform" &&
    hasMetadataOmissionWarning(args.warnings) &&
    ((args.filters.genres?.length ?? 0) > 0 || (args.filters.platforms?.length ?? 0) > 0)
  ) {
    const requestedGenres = new Set(
      (args.filters.genres ?? []).map((genre) => genre.trim().toLowerCase())
    );
    rankedDeals = applySteamDeckCompatibilityPreference(
      scoreDealCandidates(args.deals, {
        ...args.filters,
        genres: undefined,
        platforms: undefined,
        preferredShops: args.preferredShops
      }).filter(
        (deal) =>
          (requestedGenres.size === 0 ||
            deal.genres.length === 0 ||
            deal.genres.some((genre) => requestedGenres.has(genre.trim().toLowerCase()))) &&
          ((args.filters.platforms?.length ?? 0) === 0 ||
            deal.platforms.length === 0 ||
            matchesRequestedPlatforms(deal.platforms, args.filters.platforms ?? []))
      ),
      args.steamDeckRequest
    );
  }

  if (
    rankedDeals.length === 0 &&
    args.lenientFallbackMode === "genre-platform-and-multiplayer" &&
    hasMetadataOmissionWarning(args.warnings) &&
    (args.filters.multiplayer === true ||
      (args.filters.genres?.length ?? 0) > 0 ||
      (args.filters.platforms?.length ?? 0) > 0)
  ) {
    const requestedGenres = new Set(
      (args.filters.genres ?? []).map((genre) => genre.trim().toLowerCase())
    );
    rankedDeals = applySteamDeckCompatibilityPreference(
      scoreDealCandidates(args.deals, {
        ...args.filters,
        genres: undefined,
        platforms: undefined,
        multiplayer: undefined,
        preferredShops: args.preferredShops
      }).filter(
        (deal) =>
          (requestedGenres.size === 0 ||
            deal.genres.length === 0 ||
            deal.genres.some((genre) => requestedGenres.has(genre.trim().toLowerCase()))) &&
          ((args.filters.platforms?.length ?? 0) === 0 ||
            deal.platforms.length === 0 ||
            matchesRequestedPlatforms(deal.platforms, args.filters.platforms ?? []))
      ),
      args.steamDeckRequest
    );
  }

  if (
    rankedDeals.length === 0 &&
    hasRecommendationProviderOutageWarning(args.warnings)
  ) {
    rankedDeals = applySteamDeckCompatibilityPreference(
      scoreDealCandidates(args.deals, {
        ...args.filters,
        genres: undefined,
        platforms: undefined,
        multiplayer: undefined,
        preferredShops: args.preferredShops
      }).filter((deal) =>
        matchesProviderOutageBrowseCandidate(deal, {
          filters: args.filters,
          steamDeckRequest: args.steamDeckRequest
        })
      ),
      args.steamDeckRequest
    );
  }

  if (rankedDeals.length > 0 && hasRecommendationProviderOutageWarning(args.warnings)) {
    rankedDeals = rankedDeals.filter((deal) =>
      matchesProviderOutageBrowseCandidate(deal, {
        filters: args.filters,
        steamDeckRequest: args.steamDeckRequest
      })
    );
  }

  return rankedDeals;
}

function matchesProviderOutageBrowseCandidate(
  deal: DealCandidate,
  options: {
    filters: DiscoverFilters;
    steamDeckRequest: boolean;
  }
): boolean {
  if (
    deal.cut <= 0 ||
    deal.price.amount <= 0 ||
    isRecommendationOverlayBrowseJunk(deal) ||
    isMetadataLightStoryFiller(deal)
  ) {
    return false;
  }

  if (
    typeof options.filters.budget === "number" &&
    deal.price.amount > options.filters.budget
  ) {
    return false;
  }

  if (
    (options.filters.platforms?.length ?? 0) > 0 &&
    deal.platforms.length > 0 &&
    !matchesRequestedRecommendationPlatforms(
      deal.platforms,
      options.filters.platforms ?? [],
      options.steamDeckRequest
    )
  ) {
    return false;
  }

  if (
    options.filters.multiplayer === true &&
    !(
      deal.multiplayer ||
      hasExplicitCoopDealEvidence(deal) ||
      hasLocalSocialDealEvidence(deal) ||
      hasStrongPartyDealEvidence(deal)
    )
  ) {
    return false;
  }

  const requestedGenres = options.filters.genres ?? [];
  if (
    requestedGenres.length > 0 &&
    !matchesProviderOutageRequestedGenres(deal, requestedGenres)
  ) {
    return false;
  }

  return true;
}

function matchesProviderOutageRequestedGenres(
  deal: DealCandidate,
  requestedGenres: string[]
): boolean {
  if (requestedGenres.length === 0) {
    return true;
  }

  return requestedGenres.some((genre) => {
    const normalized = genre.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    if (deal.genres.some((value) => value.trim().toLowerCase() === normalized)) {
      return true;
    }

    const values = `${deal.title} ${deal.genres.join(" ")}`;
    switch (normalized) {
      case "strategy":
        return /\b(strategy|strategic|tactics?|tactical|turn-?based)\b/i.test(values) || /전략|전술|턴제/.test(values);
      case "card":
        return /\b(card|deck|deckbuilder|deckbuilding|battler|hand)\b/i.test(values) || /카드|덱/.test(values);
      case "action":
        return /\b(action|shooter|brawler|combat|arcade)\b/i.test(values) || /액션|슈터|전투/.test(values);
      case "casual":
        return /\b(casual|party|arcade|fun)\b/i.test(values) || /캐주얼|파티/.test(values);
      case "roguelike":
      case "roguelite":
        return /\b(roguelike|roguelite)\b/i.test(values) || /로그라이트|로그라이크/.test(values);
      default:
        return new RegExp(`\\b${escapeRecommendationRegex(normalized)}\\b`, "i").test(values);
    }
  });
}

function matchesRequestedRecommendationPlatforms(
  candidatePlatforms: string[],
  requestedPlatforms: string[],
  steamDeckRequest: boolean
): boolean {
  if (matchesRequestedPlatforms(candidatePlatforms, requestedPlatforms)) {
    return true;
  }

  if (!steamDeckRequest) {
    return false;
  }

  return candidatePlatforms.some((platform) => normalizePlatform(platform) === "pc");
}

function applySteamDeckHandheldPromptGuardrail(
  deals: DealCandidate[],
  args: {
    rawPreferences: string;
    preferences: {
      genres: string[];
      deckbuilding: boolean;
      highRating: boolean;
      shortSession: boolean;
    };
    constraints: RecommendationConstraints;
    steamDeckRequest: boolean;
    warnings: string[];
  }
): DealCandidate[] {
  if (!shouldApplySteamDeckHandheldPromptGuardrail(args)) {
    return deals;
  }

  const accepted = deals.filter((deal) => matchesSteamDeckHandheldPromptDeal(deal, args));
  const supported = accepted.filter((deal) => {
    const status = getDeckCompatibilityStatus(deal);
    return status === "verified" || status === "playable";
  });

  if (supported.length > 0) {
    return supported;
  }

  return hasWarningTriggeredSteamDeckMetadataRecoverySignal(args.warnings)
    ? accepted.filter((deal) => getDeckCompatibilityStatus(deal) === "unknown")
    : [];
}

function applySteamDeckLifestyleStoryFillerGuardrail(
  deals: DealCandidate[],
  args: {
    rawPreferences: string;
    preferences: {
      genres: string[];
      deckbuilding: boolean;
      highRating: boolean;
      shortSession: boolean;
    };
    constraints: RecommendationConstraints;
    steamDeckRequest: boolean;
  }
): DealCandidate[] {
  if (!shouldApplySteamDeckLifestyleStoryFillerGuardrail(args)) {
    return deals;
  }

  return deals.filter(
    (deal) =>
      !isMetadataLightStoryFiller(deal) &&
      !hasStoryAdventurePuzzleBrowseFiller(deal) &&
      !hasLikelySingleplayerBrowseBias(deal)
  );
}

function shouldApplySteamDeckHandheldPromptGuardrail(args: {
  rawPreferences: string;
  preferences: {
    genres: string[];
    deckbuilding: boolean;
    highRating: boolean;
    shortSession: boolean;
  };
  constraints: RecommendationConstraints;
  steamDeckRequest: boolean;
  warnings: string[];
}): boolean {
  if (
    !args.steamDeckRequest ||
    args.preferences.highRating ||
    args.constraints.strategySignal ||
    !hasWarningTriggeredSteamDeckMetadataRecoverySignal(args.warnings)
  ) {
    return false;
  }

  return (
    args.preferences.deckbuilding ||
    hasRoguelikeIntent(args.preferences.genres) ||
    args.preferences.shortSession ||
    /\b(handheld|portable|pad)\b/i.test(args.rawPreferences) ||
    /핸드헬드|휴대용|휴대기|패드|출퇴근|스팀덱/.test(args.rawPreferences)
  );
}

function shouldApplySteamDeckLifestyleStoryFillerGuardrail(args: {
  rawPreferences: string;
  preferences: {
    genres: string[];
    deckbuilding: boolean;
    highRating: boolean;
    shortSession: boolean;
  };
  constraints: RecommendationConstraints;
  steamDeckRequest: boolean;
}): boolean {
  if (!args.steamDeckRequest || args.preferences.highRating || args.constraints.strategySignal) {
    return false;
  }

  return (
    args.preferences.shortSession ||
    /\b(handheld|portable|pad|commute|travel)\b/i.test(args.rawPreferences) ||
    /핸드헬드|휴대용|휴대기|패드|출퇴근|가볍게|잠깐/.test(args.rawPreferences)
  );
}

function matchesSteamDeckHandheldPromptDeal(
  deal: DealCandidate,
  args: {
    preferences: {
      genres: string[];
      deckbuilding: boolean;
      shortSession: boolean;
    };
  }
): boolean {
  if (getDeckCompatibilityStatus(deal) === "unsupported") {
    return false;
  }

  if (
    isMetadataLightStoryFiller(deal) ||
    hasStoryAdventurePuzzleBrowseFiller(deal) ||
    hasLikelySingleplayerBrowseBias(deal)
  ) {
    return false;
  }

  if (args.preferences.deckbuilding && !hasDeckbuildingEvidence(deal)) {
    return false;
  }

  if (
    hasRoguelikeIntent(args.preferences.genres) &&
    !hasRoguelikeDealEvidence(deal) &&
    !hasPortableHandheldDealEvidence(deal)
  ) {
    return false;
  }

  if (
    !hasPortableHandheldDealEvidence(deal) &&
    !hasRoguelikeDealEvidence(deal) &&
    !hasDeckbuildingEvidence(deal)
  ) {
    return false;
  }

  if (
    args.preferences.shortSession &&
    !hasShortSessionSparseShape(deal) &&
    !hasPortableHandheldDealEvidence(deal)
  ) {
    return false;
  }

  return true;
}

function hasPortableHandheldDealEvidence(deal: DealCandidate): boolean {
  const values = `${deal.title} ${deal.genres.join(" ")}`;
  return (
    /\b(portable|handheld|steam deck|deck ready|commute|travel|short-session)\b/i.test(values) ||
    /휴대|핸드헬드|출퇴근|스팀덱/.test(values) ||
    hasShortSessionSparseShape(deal)
  );
}

function isMetadataLightStoryFiller(deal: DealCandidate): boolean {
  if (deal.metadataStatus !== "missing" && deal.metadataStatus !== "unavailable") {
    return false;
  }

  if (!hasStoryAdventurePuzzleBrowseFiller(deal) && !hasLikelySingleplayerBrowseBias(deal)) {
    return false;
  }

  return (
    !hasRoguelikeDealEvidence(deal) &&
    !hasDeckbuildingEvidence(deal) &&
    !hasActionDealEvidence(deal) &&
    !hasExplicitCoopDealEvidence(deal) &&
    !hasBroadCoopFriendlyShape(deal)
  );
}

function normalizeEnrichmentResult(result: DealCandidate[] | DealsEnrichment): DealsEnrichment {
  if (Array.isArray(result)) {
    return { deals: result, warnings: [] };
  }

  return result;
}

function parsePreferenceSignals(
  preferences: string,
  constraints?: RecommendationConstraints
): {
  genres: string[];
  rawgGenres: string[];
  platforms: string[];
  tags: string[];
  multiplayer: boolean;
  deckbuilding: boolean;
  highRating: boolean;
  shortSession: boolean;
} {
  const intent = parseRecommendationIntent(preferences);
  return constraints ? applyRecommendationConstraintOverrides(intent, constraints) : intent;
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

function buildEvidenceFirstRecommendationMatches(args: {
  deals: DealCandidate[];
  rawPreferences: string;
  preferences: RecommendationPreferences;
  constraints: RecommendationConstraints;
  requestedPlatforms: string[];
  budget?: number | undefined;
  steamDeckRequest: boolean;
  socialProfile?: RecommendationSocialPromptProfile | undefined;
}): RecommendationMatch[] {
  const context: RecommendationEvidenceContext = {
    rawPreferences: args.rawPreferences,
    preferences: args.preferences,
    constraints: args.constraints,
    requestedPlatforms: args.requestedPlatforms,
    budget: args.budget,
    steamDeckRequest: args.steamDeckRequest,
    socialProfile: args.socialProfile
  };

  return args.deals
    .map((deal) => buildRecommendationMatchEvidence(toRecommendationTaggedDeal(deal), context))
    .filter((match): match is RecommendationMatch => match !== null)
    .sort(compareEvidenceFirstRecommendationMatches);
}

function buildRecommendationMatchEvidence(
  deal: RecommendationTaggedDeal,
  context: RecommendationEvidenceContext
): RecommendationMatch | null {
  const priceEvidence = buildRecommendationPriceEvidence(deal);
  if (!priceEvidence) {
    return null;
  }

  if (typeof context.budget === "number" && deal.price.amount > context.budget) {
    return null;
  }

  if (!matchesEvidenceRequestedPlatforms(deal, context.requestedPlatforms, context.steamDeckRequest)) {
    return null;
  }

  if (isRecommendationEvidenceJunk(deal)) {
    return null;
  }

  const matchedSignals = getRecommendationMatchedSignals(deal, context);
  const requiredSignals = getRecommendationRequiredSignals(context);
  const missingEvidence = requiredSignals.filter((signal) => !matchedSignals.includes(signal));

  if (context.steamDeckRequest) {
    const deckStatus = getDeckCompatibilityStatus(deal);
    if (deckStatus !== "verified" && deckStatus !== "playable") {
      return null;
    }
  }

  if (context.constraints.excludeGameplay.includes("turn-based") && hasTurnBasedDealEvidence(deal)) {
    return null;
  }

  if (context.constraints.excludeGenres.includes("card/deckbuilder") && hasDeckbuildingEvidence(deal)) {
    return null;
  }

  if (context.constraints.excludeGenres.includes("strategy") && hasStrategyRecoveryDealEvidence(deal)) {
    return null;
  }

  if (
    (context.constraints.excludeGenres.includes("racing") ||
      context.constraints.excludeGenres.includes("sports")) &&
    hasRacingOrSportsShape(deal)
  ) {
    return null;
  }

  if (context.constraints.excludeGenres.includes("pvp") && hasPvPDealEvidence(deal)) {
    return null;
  }

  if (context.constraints.excludeGenres.includes("horror") && hasHorrorDealEvidence(deal)) {
    return null;
  }

  if (
    context.constraints.avoidComplexity.includes("reading-heavy") &&
    hasReadingHeavyDealEvidence(deal)
  ) {
    return null;
  }

  if (
    (context.constraints.avoidComplexity.includes("long-session") ||
      context.constraints.avoidComplexity.includes("complex-strategy")) &&
    (hasLongSessionDealEvidence(deal) || hasHeavyStrategyDealEvidence(deal))
  ) {
    return null;
  }

  if (
    requiresApproachableStrategyEvidence(context) &&
    hasStrategyRecoveryDealEvidence(deal) &&
    !hasTacticsDealEvidence(deal)
  ) {
    return null;
  }

  if (context.constraints.qualityIntent.includes("not-filler") && hasStoryAdventurePuzzleBrowseFiller(deal)) {
    return null;
  }

  if (requiresStrongActionRogueliteShape(context) && !hasStrongActionRogueliteStyleEvidence(deal)) {
    return null;
  }

  if (isBuildcraftHybridPrompt(context) && !context.preferences.multiplayer && deal.multiplayer) {
    return null;
  }

  if (
    requiresNonDeckStrategyRoguelikeHybrid(context) &&
    hasDeckbuildingEvidence(deal) &&
    !hasTacticsDealEvidence(deal)
  ) {
    return null;
  }

  if (
    context.preferences.highRating &&
    !hasStrongReviewSignal(deal)
  ) {
    return null;
  }

  if (requiresStrategyRatingEvidence(context) && !hasStrategyRatingEvidence(deal)) {
    return null;
  }

  if (
    context.preferences.highRating &&
    context.constraints.strategyPreference === "required" &&
    hasHeavyStrategyDealEvidence(deal) &&
    !hasTacticsDealEvidence(deal)
  ) {
    return null;
  }

  if (requiresDeckbuildingEvidence(context) && !hasDeckbuildingEvidence(deal)) {
    return null;
  }

  if (context.preferences.multiplayer && !hasAcceptedMultiplayerEvidence(deal, context.socialProfile)) {
    return null;
  }

  if (
    context.preferences.genres.length > 1 &&
    !matchesEvidenceRequestedGenres(deal, context.preferences, context)
  ) {
    return null;
  }

  if (missingEvidence.length > 0) {
    return null;
  }

  const metadataEvidence = buildRecommendationMetadataEvidence(deal);
  const evidenceCompleteness = buildRecommendationEvidenceCompleteness(
    priceEvidence,
    metadataEvidence
  );
  const platformEvidence = buildRecommendationPlatformEvidence(deal, context.steamDeckRequest);
  const recommendationReason = buildRecommendationReason({
    deal,
    priceEvidence,
    platformEvidence,
    metadataEvidence,
    matchedSignals
  });

  return {
    ...deal,
    tags: getRecommendationDealTags(deal),
    evidence: {
      priceEvidence,
      platformEvidence,
      metadataEvidence
    },
    matchedSignals,
    missingEvidence,
    recommendationReason,
    evidenceCompleteness
  };
}

function compareEvidenceFirstRecommendationMatches(
  left: RecommendationMatch,
  right: RecommendationMatch
): number {
  const signalDelta = right.matchedSignals.length - left.matchedSignals.length;
  if (signalDelta !== 0) {
    return signalDelta;
  }

  const completenessDelta =
    getRecommendationEvidenceCompletenessScore(right.evidenceCompleteness) -
    getRecommendationEvidenceCompletenessScore(left.evidenceCompleteness);
  if (completenessDelta !== 0) {
    return completenessDelta;
  }

  const reviewDelta = getRecommendationReviewStrength(right) - getRecommendationReviewStrength(left);
  if (reviewDelta !== 0) {
    return reviewDelta;
  }

  const cutDelta = right.cut - left.cut;
  if (cutDelta !== 0) {
    return cutDelta;
  }

  const historyDelta = getRecommendationHistoryStrength(right) - getRecommendationHistoryStrength(left);
  if (historyDelta !== 0) {
    return historyDelta;
  }

  return left.price.amount - right.price.amount || left.title.localeCompare(right.title);
}

function buildRecommendationSummary(top: RecommendationMatch): string {
  return `${top.title}를 추천합니다. ${top.recommendationReason}.`;
}

function buildRecommendationReason(args: {
  deal: RecommendationTaggedDeal;
  priceEvidence: RecommendationPriceEvidence;
  platformEvidence: RecommendationPlatformEvidence;
  metadataEvidence?: RecommendationMetadataEvidence | undefined;
  matchedSignals: string[];
}): string {
  const parts = [
    `${args.priceEvidence.cut}% 할인`,
    `현재가 ${formatPrice(args.priceEvidence.current.amount, args.priceEvidence.current.currency)}`
  ];

  const primaryStore = args.priceEvidence.stores?.[0]?.store?.trim();
  if (primaryStore) {
    parts.push(`${primaryStore} 판매`);
  }

  if (args.platformEvidence.steamDeckStatus) {
    parts.push(deckCompatibilityLabel(args.platformEvidence.steamDeckStatus));
  } else if (args.platformEvidence.platforms.length > 0) {
    parts.push(`${args.platformEvidence.platforms[0]} 지원`);
  }

  if ((args.metadataEvidence?.genres.length ?? 0) > 0) {
    parts.push(`장르 ${args.metadataEvidence?.genres.slice(0, 2).join("/")}`);
  }

  if (typeof args.metadataEvidence?.rating === "number" && args.metadataEvidence.rating > 0) {
    parts.push(`평점 ${args.metadataEvidence.rating.toFixed(1)}`);
  } else if (
    typeof args.metadataEvidence?.metacritic === "number" &&
    args.metadataEvidence.metacritic > 0
  ) {
    parts.push(`메타크리틱 ${args.metadataEvidence.metacritic}`);
  }

  if (args.matchedSignals.length > 0) {
    parts.push(`충족 신호 ${args.matchedSignals.slice(0, 3).join(", ")}`);
  }

  return parts.join(", ");
}

function buildRecommendationPriceEvidence(
  deal: RecommendationTaggedDeal
): RecommendationPriceEvidence | null {
  if (
    !Number.isFinite(deal.price.amount) ||
    !Number.isFinite(deal.regular.amount) ||
    deal.cut <= 0
  ) {
    return null;
  }

  return {
    source: "ITAD",
    current: deal.price,
    regular: deal.regular,
    cut: deal.cut,
    historyLow: deal.historyLow ?? undefined,
    stores: deal.stores
  };
}

function buildRecommendationPlatformEvidence(
  deal: RecommendationTaggedDeal,
  steamDeckRequest: boolean
): RecommendationPlatformEvidence {
  const deckStatus = getDeckCompatibilityStatus(deal);

  if (steamDeckRequest || deal.steamDeckCompatibility) {
    return {
      source: "Steam",
      platforms: deal.platforms,
      steamDeckStatus: deckStatus
    };
  }

  return {
    source: "ITAD",
    platforms: deal.platforms
  };
}

function buildRecommendationMetadataEvidence(
  deal: RecommendationTaggedDeal
): RecommendationMetadataEvidence | undefined {
  const tags = getRecommendationDealTags(deal);
  const hasGenres = deal.genres.length > 0;
  const hasTags = tags.length > 0;
  const hasRatings =
    (typeof deal.rating === "number" && deal.rating > 0) ||
    (typeof deal.metacritic === "number" && deal.metacritic > 0);

  if (!hasGenres && !hasTags && !hasRatings) {
    return undefined;
  }

  return {
    source: "RAWG",
    genres: deal.genres,
    tags,
    rating: deal.rating,
    metacritic: deal.metacritic
  };
}

function buildRecommendationEvidenceCompleteness(
  priceEvidence: RecommendationPriceEvidence,
  metadataEvidence?: RecommendationMetadataEvidence | undefined
): RecommendationEvidenceCompleteness {
  if (
    metadataEvidence &&
    (metadataEvidence.genres.length > 0 ||
      (metadataEvidence.tags?.length ?? 0) > 0 ||
      typeof metadataEvidence.rating === "number" ||
      typeof metadataEvidence.metacritic === "number")
  ) {
    return "hard-facts-plus-metadata";
  }

  if (priceEvidence.current.currency && priceEvidence.regular.currency) {
    return "hard-facts-only";
  }

  return "partial";
}

function getRecommendationEvidenceCompletenessScore(
  completeness: RecommendationEvidenceCompleteness
): number {
  switch (completeness) {
    case "hard-facts-plus-metadata":
      return 2;
    case "hard-facts-only":
      return 1;
    case "partial":
    default:
      return 0;
  }
}

function getRecommendationReviewStrength(deal: RecommendationTaggedDeal): number {
  return (deal.metacritic ?? 0) * 2 + (deal.rating ?? 0) * 20;
}

function getRecommendationHistoryStrength(deal: RecommendationTaggedDeal): number {
  if (!deal.historyLow || deal.historyLow.amount <= 0 || deal.price.amount <= 0) {
    return 0;
  }

  if (deal.price.amount <= deal.historyLow.amount) {
    return 2;
  }

  const ratio = deal.price.amount / deal.historyLow.amount;
  if (ratio <= 1.1) {
    return 1;
  }

  return 0;
}

function toRecommendationTaggedDeal(deal: DealCandidate): RecommendationTaggedDeal {
  return deal as RecommendationTaggedDeal;
}

function getRecommendationDealTags(deal: RecommendationTaggedDeal): string[] {
  return deal.tags?.filter((tag) => tag.trim().length > 0) ?? [];
}

function getRecommendationSignalHaystack(deal: RecommendationTaggedDeal): string {
  return `${deal.title} ${deal.genres.join(" ")} ${getRecommendationDealTags(deal).join(" ")}`.toLowerCase();
}

function getRecommendationRequiredSignals(context: RecommendationEvidenceContext): string[] {
  const requiredSignals = new Set<string>();

  if (context.steamDeckRequest) {
    requiredSignals.add("steam-deck");
  }

  if (context.preferences.highRating) {
    requiredSignals.add("high-rating");
  }

  if (requiresStrategyRatingEvidence(context)) {
    requiredSignals.add("strategy");
  }

  if (requiresExplicitTacticsEvidence(context)) {
    requiredSignals.add("tactics");
  }

  if (requiresDeckbuildingEvidence(context)) {
    requiredSignals.add("deckbuilder");
  }

  if (requiresActionEvidence(context)) {
    requiredSignals.add("action");
  }

  if (requiresRoguelikeEvidence(context)) {
    requiredSignals.add("roguelike");
  }

  if (context.preferences.multiplayer) {
    requiredSignals.add("multiplayer");
  }

  if (requiresShortSessionEvidence(context)) {
    requiredSignals.add("short-session");
  }

  if (context.preferences.genres.length > 1) {
    for (const genre of context.preferences.genres) {
      const normalized = normalizeEvidenceSignal(genre);

      if (
        context.preferences.deckbuilding &&
        (normalized === "strategy" || normalized === "card" || normalized === "deckbuilder")
      ) {
        continue;
      }

      requiredSignals.add(normalized);
    }
  }

  return [...requiredSignals];
}

function getRecommendationMatchedSignals(
  deal: RecommendationTaggedDeal,
  context: RecommendationEvidenceContext
): string[] {
  const signals = new Set<string>();
  const haystack = getRecommendationSignalHaystack(deal);

  if (hasStrategyRecoveryDealEvidence(deal)) {
    signals.add("strategy");
  }

  if (hasTacticsDealEvidence(deal)) {
    signals.add("tactics");
  }

  if (hasDeckbuildingEvidence(deal)) {
    signals.add("deckbuilder");
    if (/\b(card|cards?)\b/i.test(haystack)) {
      signals.add("card");
    }
  }

  if (hasRoguelikeDealEvidence(deal)) {
    signals.add("roguelike");
  }

  if (hasActionDealEvidence(deal)) {
    signals.add("action");
  }

  if (deal.multiplayer) {
    signals.add("multiplayer");
  }

  if (hasExplicitCoopDealEvidence(deal) || hasLocalSocialDealEvidence(deal)) {
    signals.add("co-op");
    signals.add("teamplay");
  }

  if (hasStrongPartyDealEvidence(deal)) {
    signals.add("party");
  }

  const deckStatus = getDeckCompatibilityStatus(deal);
  if (deckStatus === "verified" || deckStatus === "playable") {
    signals.add("steam-deck");
  }

  if (hasStrongReviewSignal(deal)) {
    signals.add("high-rating");
  }

  if (hasShortSessionEvidence(deal)) {
    signals.add("short-session");
  }

  for (const genre of context.preferences.genres) {
    if (matchesEvidenceGenreSignal(deal, genre)) {
      signals.add(normalizeEvidenceSignal(genre));
    }
  }

  return [...signals];
}

function normalizeEvidenceSignal(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function requiresExplicitTacticsEvidence(context: RecommendationEvidenceContext): boolean {
  if (context.constraints.excludeGameplay.includes("turn-based")) {
    return false;
  }

  return /\b(tactics?|tactical|turn-?based)\b|턴제/i.test(context.rawPreferences);
}

function requiresActionEvidence(context: RecommendationEvidenceContext): boolean {
  const hasRequiredDeckCue = context.constraints.deckPreference === "required";
  const explicitActionCue =
    /\b(action|shooty|shooter|shooting|arcade|hack|slash|reflex)\b|액션|손맛|슈터|총질|빠른|템포/i.test(
      context.rawPreferences
    );
  const combatCue = /\b(combat|fight|fights)\b|전투/i.test(context.rawPreferences);

  return (
    explicitActionCue ||
    (context.constraints.actionBias && !hasRequiredDeckCue) ||
    (combatCue && !hasRequiredDeckCue)
  );
}

function requiresRoguelikeEvidence(context: RecommendationEvidenceContext): boolean {
  return (
    context.preferences.genres.some((genre) => /roguelike/i.test(genre)) ||
    /\b(roguelike|roguelite|rogue)\b|로그라이크|로그라이트/i.test(context.rawPreferences)
  );
}

function requiresShortSessionEvidence(context: RecommendationEvidenceContext): boolean {
  const wantsShortSession =
    context.preferences.shortSession || context.constraints.preferSession.includes("short");
  if (!wantsShortSession) {
    return false;
  }

  if (
    context.steamDeckRequest &&
    /\b(steam ?deck|handheld|portable|pad)\b|스팀덱|핸드헬드|휴대용|패드/i.test(context.rawPreferences) &&
    !/\b(short session|quick|pick-?up|short-run)\b|짧게|잠깐|짬짬이|한 ?판/i.test(
      context.rawPreferences
    )
  ) {
    return false;
  }

  return true;
}

function matchesEvidenceRequestedPlatforms(
  deal: RecommendationTaggedDeal,
  requestedPlatforms: string[],
  steamDeckRequest: boolean
): boolean {
  if (steamDeckRequest) {
    const deckStatus = getDeckCompatibilityStatus(deal);
    return deckStatus === "verified" || deckStatus === "playable";
  }

  if (requestedPlatforms.length === 0) {
    return true;
  }

  if (deal.platforms.length === 0) {
    return false;
  }

  return matchesRequestedPlatforms(deal.platforms, requestedPlatforms);
}

function requiresStrategyRatingEvidence(context: RecommendationEvidenceContext): boolean {
  return (
    context.preferences.highRating &&
    (context.preferences.rawgGenres.includes("strategy") ||
      context.constraints.strategyPreference === "required")
  );
}

function hasStrategyRatingEvidence(deal: RecommendationTaggedDeal): boolean {
  return (
    (hasStrategyRecoveryDealEvidence(deal) || hasTacticsDealEvidence(deal)) &&
    hasStrongReviewSignal(deal)
  );
}

function requiresDeckbuildingEvidence(context: RecommendationEvidenceContext): boolean {
  return context.preferences.deckbuilding || context.constraints.deckPreference === "required";
}

function hasAcceptedMultiplayerEvidence(
  deal: RecommendationTaggedDeal,
  socialProfile?: RecommendationSocialPromptProfile | undefined
): boolean {
  if (!deal.multiplayer) {
    return false;
  }

  if (hasPvPDealEvidence(deal) || hasRacingOrSportsShape(deal)) {
    return false;
  }

  if (socialProfile === "party-hangout") {
    return hasStrongPartyDealEvidence(deal);
  }

  return (
    hasExplicitCoopDealEvidence(deal) ||
    hasLocalSocialDealEvidence(deal) ||
    hasStrongPartyDealEvidence(deal)
  );
}

function matchesEvidenceRequestedGenres(
  deal: RecommendationTaggedDeal,
  preferences: RecommendationPreferences,
  context: RecommendationEvidenceContext
): boolean {
  const filteredGenres = preferences.genres.filter((genre) => {
    const normalized = genre.trim().toLowerCase();

    if (normalized === "action" && !requiresActionEvidence(context)) {
      return false;
    }

    if ((normalized === "roguelike" || normalized === "roguelite") && !requiresRoguelikeEvidence(context)) {
      return false;
    }

    return true;
  });

  if (preferences.deckbuilding) {
    return matchesRequestedDeckbuildingHybridGenres(deal, filteredGenres);
  }

  return filteredGenres.every((genre) => matchesEvidenceGenreSignal(deal, genre));
}

function matchesEvidenceGenreSignal(deal: RecommendationTaggedDeal, genre: string): boolean {
  const normalized = genre.trim().toLowerCase();
  const haystack = getRecommendationSignalHaystack(deal);

  switch (normalized) {
    case "strategy":
      return hasStrategyRecoveryDealEvidence(deal);
    case "tactics":
      return hasTacticsDealEvidence(deal);
    case "action":
      return hasActionDealEvidence(deal);
    case "roguelike":
    case "roguelite":
      return hasRoguelikeDealEvidence(deal);
    case "card":
    case "deckbuilder":
      return hasDeckbuildingEvidence(deal);
    default:
      return new RegExp(`\\b${escapeRecommendationRegex(normalized)}\\b`, "i").test(haystack);
  }
}

function hasTacticsIntent(value: string): boolean {
  return /전술|tactics?|tactical|turn-?based|턴제/i.test(value);
}

function isRecommendationEvidenceJunk(deal: RecommendationTaggedDeal): boolean {
  if (isRecommendationOverlayBrowseJunk(deal)) {
    return true;
  }

  const haystack = getRecommendationSignalHaystack(deal);
  const hasMetadataEvidence =
    deal.genres.length > 0 ||
    getRecommendationDealTags(deal).length > 0 ||
    typeof deal.rating === "number" ||
    typeof deal.metacritic === "number";

  if (!hasMetadataEvidence && /\b(bundle|collection|course|demo|ai games?)\b/i.test(haystack)) {
    return true;
  }

  return false;
}

function buildNoRecommendationOutcome(args: {
  base: CompareResult;
  preferences: RecommendationPreferences;
  constraints: RecommendationConstraints;
  steamDeckRequest: boolean;
  socialProfile?: RecommendationSocialPromptProfile | undefined;
}): {
  summary: string;
  emptyReason: RecommendationEmptyReason;
  missingEvidence: string[];
} {
  const missingEvidence = buildNoRecommendationMissingEvidence(args);
  const emptyReason = inferNoRecommendationEmptyReason(args, missingEvidence);
  const reason = buildNoRecommendationReason(emptyReason);
  const extras = missingEvidence.filter((entry) => !reason.includes(entry));

  return {
    summary:
      extras.length > 0
        ? `조건에 맞는 추천 할인 게임을 찾지 못했습니다. ${reason} 추가로 ${extras.join(", ")}를 확인하지 못해 추천을 비웠습니다.`
        : `조건에 맞는 추천 할인 게임을 찾지 못했습니다. ${reason}`,
    emptyReason,
    missingEvidence
  };
}

function buildNoRecommendationMissingEvidence(args: {
  base: CompareResult;
  preferences: RecommendationPreferences;
  constraints: RecommendationConstraints;
  steamDeckRequest: boolean;
  socialProfile?: RecommendationSocialPromptProfile | undefined;
}): string[] {
  const missing: string[] = [];
  const summary = normalizeText(args.base.summary ?? "");
  const warnings = (args.base.warnings ?? []).map((warning) => normalizeText(warning));
  const haystack = `${summary}\n${warnings.join("\n")}`;

  if (
    args.steamDeckRequest ||
    /\bsteam ?deck\b|스팀덱|핸드헬드|휴대용|portable|handheld|pad|패드/.test(haystack)
  ) {
    missing.push("Steam Deck verified/playable 근거");
  }

  if (
    args.preferences.highRating ||
    args.constraints.strategySignal ||
    args.preferences.genres.some((genre) => /strategy|tactics/i.test(genre))
  ) {
    missing.push("RAWG 장르·평점 근거");
  }

  if (args.preferences.deckbuilding || args.constraints.deckPreference === "required") {
    missing.push("RAWG 카드·덱빌딩 메타데이터");
  }

  if (args.socialProfile || args.preferences.multiplayer) {
    missing.push("RAWG 멀티플레이/co-op 메타데이터");
  }

  if (
    /가격 개요 정보가 없어 제목만 확인했습니다|현재 할인 가격을 찾지 못했습니다|가격 개요 정보를 가져오지 못했습니다|역대 최저가 정보를 가져오지 못했습니다/.test(
      haystack
    )
  ) {
    missing.push("ITAD 현재가/할인율 근거");
  }

  if (missing.length === 0) {
    missing.push("RAWG 장르 메타데이터");
  }

  return uniqueValues(missing);
}

function inferNoRecommendationEmptyReason(
  args: {
    preferences: RecommendationPreferences;
    constraints: RecommendationConstraints;
    steamDeckRequest: boolean;
    socialProfile?: RecommendationSocialPromptProfile | undefined;
  },
  missingEvidence: string[]
): RecommendationEmptyReason {
  if (
    args.steamDeckRequest &&
    missingEvidence.includes("Steam Deck verified/playable 근거")
  ) {
    return "missing-steam-deck-evidence";
  }

  if (
    (args.preferences.highRating || args.constraints.strategySignal) &&
    missingEvidence.includes("RAWG 장르·평점 근거")
  ) {
    return "missing-review-evidence";
  }

  if (
    (args.socialProfile || args.preferences.multiplayer) &&
    missingEvidence.includes("RAWG 멀티플레이/co-op 메타데이터")
  ) {
    return "missing-social-metadata";
  }

  if (
    (args.preferences.deckbuilding || args.constraints.deckPreference === "required") &&
    missingEvidence.includes("RAWG 카드·덱빌딩 메타데이터")
  ) {
    return "missing-deckbuilding-evidence";
  }

  if (missingEvidence.includes("ITAD 현재가/할인율 근거")) {
    return "missing-price-evidence";
  }

  return "missing-genre-evidence";
}

function buildNoRecommendationReason(emptyReason: RecommendationEmptyReason): string {
  switch (emptyReason) {
    case "missing-steam-deck-evidence":
      return "Steam Deck Verified/Playable 근거를 확인하지 못해 추천을 비웠습니다.";
    case "missing-review-evidence":
      return "RAWG 장르·평점 근거를 확인하지 못해 추천을 비웠습니다.";
    case "missing-social-metadata":
      return "RAWG 멀티플레이·co-op 메타데이터 근거를 확인하지 못해 추천을 비웠습니다.";
    case "missing-deckbuilding-evidence":
      return "RAWG 카드·덱빌딩 메타데이터 근거를 확인하지 못해 추천을 비웠습니다.";
    case "missing-price-evidence":
      return "ITAD 현재가·할인율 근거를 확인하지 못해 추천을 비웠습니다.";
    case "missing-genre-evidence":
    default:
      return "RAWG 장르 메타데이터 근거를 확인하지 못해 추천을 비웠습니다.";
  }
}

function normalizeText(value: string): string {
  return value.toLowerCase();
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
  requestedTags?: string[]
): DealCandidate {
  const metadataStatus =
    deal.metadataStatus && deal.metadataStatus !== "missing" && deal.metadataStatus !== "unavailable"
      ? deal.metadataStatus
      : "rawg";

  return {
    ...deal,
    genres: mergeStrings(deal.genres, candidate.genres, inferCatalogGenres(candidate, requestedTags)),
    platforms: mergeStrings(deal.platforms, candidate.platforms),
    rating: deal.rating ?? candidate.rating,
    metacritic: deal.metacritic ?? candidate.metacritic,
    multiplayer: deal.multiplayer || candidate.multiplayer,
    released: deal.released ?? candidate.released,
    metadataStatus
  };
}

function inferCatalogGenres(candidate: CatalogCandidate, requestedTags?: string[]): string[] {
  const genres = new Set<string>();
  const normalizedTags = [...(requestedTags ?? []), ...(candidate.tags ?? [])].map((tag) =>
    tag.toLowerCase()
  );
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

function mergeRecommendationCandidates(
  current: DealCandidate[],
  incoming: DealCandidate[]
): DealCandidate[] {
  if (incoming.length === 0) {
    return current;
  }

  return dedupeDeals([...current, ...incoming]);
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

function hasWarningTriggeredSteamDeckMetadataRecoverySignal(warnings: string[]): boolean {
  return (
    warnings.some(isRecommendationMetadataWarning) ||
    warnings.some(isRecommendationSteamDeckWarning) ||
    hasRecommendationProviderOutageWarning(warnings)
  );
}

function isRecommendationMetadataWarning(warning: string): boolean {
  const normalized = warning.trim();
  return (
    normalized.includes("RAWG 보강 한도") ||
    normalized.includes("메타데이터를 생략") ||
    normalized.includes("RAWG 메타데이터를 불러오지 못해 가격 정보만 표시했습니다.")
  );
}

function isRecommendationSteamDeckWarning(warning: string): boolean {
  const normalized = warning.trim();
  return (
    normalized.includes("Steam Deck 호환성 정보를 확인하지 못했습니다") ||
    normalized.includes("Steam Deck 호환성 정보를 일부 확인하지 못했습니다") ||
    normalized.includes("Steam Deck 호환성 보강 한도")
  );
}

function shouldApplyWarningTriggeredSteamDeckOverlayFallback(args: {
  steamDeckRequest: boolean;
  warnings: string[];
  kind: RecommendationRecoveryKind;
}): boolean {
  return (
    args.steamDeckRequest &&
    isSteamDeckSparseRecoveryKind(args.kind) &&
    hasWarningTriggeredSteamDeckMetadataRecoverySignal(args.warnings)
  );
}

function shouldAttemptProviderOutageOverlay(args: {
  matches: DealCandidate[];
  kind: RecommendationRecoveryKind;
  constraints: RecommendationConstraints;
  preferences: {
    shortSession: boolean;
  };
  steamDeckRequest: boolean;
  socialProfile?: RecommendationSocialPromptProfile | undefined;
}): boolean {
  if (args.matches.length === 0) {
    return true;
  }

  return !args.matches.some((deal) =>
    matchesProviderOutageOverlayDeal(deal, {
      kind: args.kind,
      constraints: args.constraints,
      preferences: args.preferences,
      steamDeckRequest: args.steamDeckRequest,
      socialProfile: args.socialProfile
    })
  );
}

function matchesProviderOutageOverlayDeal(
  deal: DealCandidate,
  options: {
    kind: RecommendationRecoveryKind;
    constraints: RecommendationConstraints;
    preferences: {
      shortSession: boolean;
    };
    steamDeckRequest: boolean;
    requestedPlatforms?: string[] | undefined;
    budget?: number | undefined;
    socialProfile?: RecommendationSocialPromptProfile | undefined;
  }
): boolean {
  if (deal.cut <= 0 || deal.price.amount <= 0 || isRecommendationOverlayBrowseJunk(deal)) {
    return false;
  }

  if (
    typeof options.budget === "number" &&
    deal.price.amount > options.budget
  ) {
    return false;
  }

  if (
    (options.requestedPlatforms?.length ?? 0) > 0 &&
    deal.platforms.length > 0 &&
    !matchesRequestedRecommendationPlatforms(
      deal.platforms,
      options.requestedPlatforms ?? [],
      options.steamDeckRequest
    )
  ) {
    return false;
  }

  return matchesSparseRecoveryDeal(
    deal,
    options.kind,
    options.constraints,
    options.preferences,
    options.steamDeckRequest,
    options.socialProfile
  );
}

function recoverRawNonSteamStrategyOutageMatches(args: {
  deals: DealCandidate[];
  filters: DiscoverFilters;
  constraints: RecommendationConstraints;
  preferences: {
    shortSession: boolean;
  };
}): DealCandidate[] {
  const narrowed = dedupeDeals(args.deals).filter((deal) =>
    matchesProviderOutageOverlayDeal(deal, {
      kind: "non-steam-strategy-rating",
      constraints: args.constraints,
      preferences: args.preferences,
      steamDeckRequest: false,
      requestedPlatforms: args.filters.platforms,
      budget: args.filters.budget
    })
  );

  return finalizeSparseRecoveryMatches(
    narrowed,
    "non-steam-strategy-rating",
    args.filters,
    args.preferences,
    false
  );
}

function isSteamDeckSparseRecoveryKind(kind: RecommendationRecoveryKind): boolean {
  return (
    kind === "steam-deck-roguelike" ||
    kind === "steam-deck-strategy-roguelike" ||
    kind === "steam-deck-strategy" ||
    kind === "deckbuilding-card"
  );
}

function isWarningTriggeredSteamDeckOverlayKind(kind: RecommendationRecoveryKind): boolean {
  return (
    kind === "steam-deck-roguelike" ||
    kind === "steam-deck-strategy" ||
    kind === "steam-deck-strategy-roguelike"
  );
}

function widenSteamDeckOverlayProfile(
  profile: RecommendationRecoveryProfile
): RecommendationRecoveryProfile {
  if (!isWarningTriggeredSteamDeckOverlayKind(profile.kind)) {
    return profile;
  }

  return {
    ...profile,
    queries: profile.queries.map((query) => ({
      ...query,
      limit: Math.max(query.limit, 16)
    }))
  };
}

function applyWarningTriggeredSteamDeckOverlayFallback(args: {
  matches: DealCandidate[];
  kind: RecommendationRecoveryKind;
  filters: DiscoverFilters;
  preferences: {
    shortSession: boolean;
  };
  constraints: RecommendationConstraints;
}): DealCandidate[] {
  const narrowed = dedupeDeals(args.matches).filter((deal) => {
    if (getDeckCompatibilityStatus(deal) === "unsupported") {
      return false;
    }

    switch (args.kind) {
      case "steam-deck-roguelike":
        return (
          hasRoguelikeDealEvidence(deal) &&
          (!args.preferences.shortSession || hasShortSessionSparseShape(deal))
        );
      case "steam-deck-strategy-roguelike":
        return (
          hasStrongReviewSignal(deal) &&
          hasRoguelikeDealEvidence(deal) &&
          hasStrategyRecoveryDealEvidence(deal) &&
          (!args.preferences.shortSession || hasShortSessionSparseShape(deal))
        );
      case "steam-deck-strategy":
        return (
          hasStrongReviewSignal(deal) &&
          hasStrategyRecoveryDealEvidence(deal) &&
          (!args.preferences.shortSession || hasShortSessionSparseShape(deal))
        );
      case "deckbuilding-card":
        return (
          hasDeckbuildingEvidence(deal) &&
          (!args.constraints.excludeGenres.includes("strategy") || !hasHeavyStrategyDealEvidence(deal))
        );
      case "broad-multiplayer":
        return false;
    }
  });

  return finalizeSparseRecoveryMatches(
    narrowed,
    args.kind,
    args.filters,
    args.preferences,
    true
  );
}

function recoverRichSocialPromptMatches(args: {
  deals: DealCandidate[];
  requestedPlatforms: string[];
  budget?: number | undefined;
  constraints: RecommendationConstraints;
  socialProfile: RecommendationSocialPromptProfile;
}): DealCandidate[] {
  const rescueConstraints: RecommendationConstraints = {
    ...args.constraints,
    excludeGenres: uniqueValues([
      ...args.constraints.excludeGenres,
      "racing",
      "sports"
    ]) as RecommendationConstraints["excludeGenres"]
  };
  const reviewBacked = args.constraints.qualityIntent.includes("review-backed");
  const partyPrompt = args.socialProfile === "party-hangout";
  const rankOptions = {
    partyPrompt,
    reviewBacked,
    nonCompetitive:
      args.constraints.coopMode.includes("non-competitive") ||
      args.constraints.excludeGenres.includes("pvp"),
    excludeRacingOrSports: true,
    budget: args.budget,
    socialProfile: args.socialProfile
  } as const;
  const classify = (deal: DealCandidate) =>
    classifyStructuredMultiplayerBrowseDealTier(deal, {
      requestedPlatforms: args.requestedPlatforms,
      budget: args.budget,
      constraints: rescueConstraints,
      partyPrompt,
      reviewBacked,
      socialProfile: args.socialProfile
    });

  const strict = rankStructuredMultiplayerBrowseDeals(
    args.deals.filter((deal) => classify(deal) === "strict"),
    rankOptions
  );

  if (strict.length > 0) {
    return strict.slice(0, 2);
  }

  return rankStructuredMultiplayerBrowseDeals(
    args.deals.filter((deal) => classify(deal) === "rescue"),
    rankOptions
  ).slice(0, 2);
}

function takeBudgetWarning(
  budget: RecommendationExecutionBudget | undefined,
  key: string
): string[] {
  if (!budget) {
    return [];
  }

  const warning = budget.skipWithWarning(key);
  return warning ? [warning] : [];
}

function buildRecommendationExecutionProfile(args: {
  rawPreferences: string;
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
  constraints: RecommendationConstraints;
  steamDeckRequest: boolean;
}): {
  totalBudgetMs: number;
  baseBrowseMinMs: number;
  mixingMinMs: number;
  metadataOverlayMinMs: number;
  lastChanceRecoveryMinMs: number;
  baseBrowseRawgLookups: number;
  structuredBrowseMinMs: number;
  structuredBrowseFullMinMs: number;
  structuredBrowseRawgLookups: number;
  structuredBrowseTightQueryLimit: number;
  simpleSocialPrompt: boolean;
} {
  if (args.steamDeckRequest) {
    return {
      totalBudgetMs: DEFAULT_RECOMMENDATION_TIME_BUDGET_MS,
      baseBrowseMinMs: MIN_RECOMMENDATION_BASE_BROWSE_BUDGET_MS,
      mixingMinMs: MIN_RECOMMENDATION_MIX_BUDGET_MS,
      metadataOverlayMinMs: MIN_CATALOG_METADATA_OVERLAY_BUDGET_MS,
      lastChanceRecoveryMinMs: MIN_RESOLVE_DEAL_BUDGET_MS,
      baseBrowseRawgLookups: MAX_RAWG_ENRICHMENT,
      structuredBrowseMinMs: MIN_MULTIPLAYER_STRUCTURED_BROWSE_BUDGET_MS,
      structuredBrowseFullMinMs: MIN_MULTIPLAYER_STRUCTURED_BROWSE_FULL_BUDGET_MS,
      structuredBrowseRawgLookups: RECOMMENDATION_MULTIPLAYER_BROWSE_RAWG_ENRICHMENT,
      structuredBrowseTightQueryLimit: 2,
      simpleSocialPrompt: false
    };
  }

  const isMixedLanguage = /[a-z]/i.test(args.rawPreferences) && /[가-힣]/.test(args.rawPreferences);
  const simpleSocialPrompt = isSimpleSocialRecommendationPrompt({
    rawPreferences: args.rawPreferences,
    preferences: args.preferences,
    constraints: args.constraints,
    isMixedLanguage
  });
  const timeoutSensitive =
    !simpleSocialPrompt &&
    (args.constraints.excludeGenres.length > 0 ||
      args.constraints.avoidComplexity.length > 0 ||
      args.constraints.qualityIntent.length > 0 ||
      args.constraints.coopMode.length > 0 ||
      isMixedLanguage ||
      args.preferences.shortSession ||
      args.preferences.genres.length >= 2 ||
      args.preferences.rawgGenres.length >= 2 ||
      args.preferences.tags.length >= 2);

  if (simpleSocialPrompt) {
    return {
      totalBudgetMs: DEFAULT_SIMPLE_NON_STEAM_RECOMMENDATION_TIME_BUDGET_MS,
      baseBrowseMinMs: MIN_RECOMMENDATION_BASE_BROWSE_BUDGET_MS,
      mixingMinMs: MIN_SIMPLE_SOCIAL_RECOMMENDATION_MIX_BUDGET_MS,
      metadataOverlayMinMs: MIN_SIMPLE_SOCIAL_METADATA_OVERLAY_BUDGET_MS,
      lastChanceRecoveryMinMs: MIN_SIMPLE_SOCIAL_LAST_CHANCE_RECOVERY_BUDGET_MS,
      baseBrowseRawgLookups: RECOMMENDATION_NON_STEAM_BROWSE_RAWG_ENRICHMENT,
      structuredBrowseMinMs: MIN_SIMPLE_MULTIPLAYER_STRUCTURED_BROWSE_BUDGET_MS,
      structuredBrowseFullMinMs: MIN_SIMPLE_SOCIAL_STRUCTURED_BROWSE_FULL_BUDGET_MS,
      structuredBrowseRawgLookups: RECOMMENDATION_MULTIPLAYER_BROWSE_RAWG_ENRICHMENT,
      structuredBrowseTightQueryLimit: 4,
      simpleSocialPrompt: true
    };
  }

  return {
    totalBudgetMs: timeoutSensitive
      ? DEFAULT_NON_STEAM_RECOMMENDATION_TIME_BUDGET_MS
      : DEFAULT_SIMPLE_NON_STEAM_RECOMMENDATION_TIME_BUDGET_MS,
    baseBrowseMinMs: MIN_RECOMMENDATION_BASE_BROWSE_BUDGET_MS,
    mixingMinMs: timeoutSensitive
      ? MIN_NON_STEAM_RECOMMENDATION_MIX_BUDGET_MS
      : MIN_RECOMMENDATION_MIX_BUDGET_MS,
    metadataOverlayMinMs: timeoutSensitive
      ? MIN_NON_STEAM_METADATA_OVERLAY_BUDGET_MS
      : MIN_CATALOG_METADATA_OVERLAY_BUDGET_MS,
    lastChanceRecoveryMinMs: timeoutSensitive
      ? MIN_NON_STEAM_LAST_CHANCE_RECOVERY_BUDGET_MS
      : MIN_RESOLVE_DEAL_BUDGET_MS,
    baseBrowseRawgLookups: timeoutSensitive
      ? RECOMMENDATION_TIGHT_NON_STEAM_BROWSE_RAWG_ENRICHMENT
      : RECOMMENDATION_NON_STEAM_BROWSE_RAWG_ENRICHMENT,
    structuredBrowseMinMs: timeoutSensitive
      ? MIN_MULTIPLAYER_STRUCTURED_BROWSE_BUDGET_MS
      : MIN_SIMPLE_MULTIPLAYER_STRUCTURED_BROWSE_BUDGET_MS,
    structuredBrowseFullMinMs: MIN_MULTIPLAYER_STRUCTURED_BROWSE_FULL_BUDGET_MS,
    structuredBrowseRawgLookups: RECOMMENDATION_MULTIPLAYER_BROWSE_RAWG_ENRICHMENT,
    structuredBrowseTightQueryLimit: 2,
    simpleSocialPrompt: false
  };
}

function appendRecommendationMixAdditions(
  combinedMatches: DealCandidate[],
  accepted: DealCandidate[],
  unknownFallback: DealCandidate[],
  profile: ReturnType<typeof buildRecommendationCatalogMixPlan>["profiles"][number]
): DealCandidate[] {
  const additions =
    profile.kind === "steam-deck-overlay" && dedupeDeals(accepted).length === 0
      ? dedupeDeals(unknownFallback).slice(0, profile.maxMatches)
      : dedupeDeals(accepted).slice(0, profile.maxMatches);

  if (additions.length === 0) {
    return combinedMatches;
  }

  return dedupeDeals([...combinedMatches, ...additions]);
}

const DEFAULT_RECOMMENDATION_TIME_BUDGET_MS = 12_000;
const DEFAULT_NON_STEAM_RECOMMENDATION_TIME_BUDGET_MS = 10_000;
const DEFAULT_SIMPLE_NON_STEAM_RECOMMENDATION_TIME_BUDGET_MS = 14_000;
const MIN_GENERIC_STEAM_RECOVERY_BUDGET_MS = 4_500;
const MIN_RECOMMENDATION_RECOVERY_BUDGET_MS = 3_500;
const MIN_RECOMMENDATION_MIX_BUDGET_MS = 2_000;
const MIN_NON_STEAM_RECOMMENDATION_MIX_BUDGET_MS = 2_500;
const MIN_SIMPLE_SOCIAL_RECOMMENDATION_MIX_BUDGET_MS = 1_200;
const MIN_RESOLVE_DEAL_BUDGET_MS = 1_200;
const MIN_CATALOG_METADATA_OVERLAY_BUDGET_MS = 600;
const MIN_NON_STEAM_METADATA_OVERLAY_BUDGET_MS = 2_500;
const MIN_SIMPLE_SOCIAL_METADATA_OVERLAY_BUDGET_MS = 600;
const MIN_NON_STEAM_LAST_CHANCE_RECOVERY_BUDGET_MS = 2_500;
const MIN_SIMPLE_SOCIAL_LAST_CHANCE_RECOVERY_BUDGET_MS = 1_200;
const MIN_RECOMMENDATION_BASE_BROWSE_BUDGET_MS = 2_500;
const MIN_BASE_BROWSE_CATALOG_FALLBACK_BUDGET_MS = 3_000;
const MIN_SIMPLE_MULTIPLAYER_STRUCTURED_BROWSE_BUDGET_MS = 2_000;
const MIN_MULTIPLAYER_STRUCTURED_BROWSE_BUDGET_MS = 2_500;
const MIN_MULTIPLAYER_STRUCTURED_BROWSE_FULL_BUDGET_MS = 5_000;
const MIN_SIMPLE_SOCIAL_STRUCTURED_BROWSE_FULL_BUDGET_MS = 2_500;
const MAX_RAWG_ENRICHMENT = 12;
const MAX_STEAM_ENRICHMENT = 8;
const RECOMMENDATION_STEAM_ENRICHMENT = 4;
const RECOMMENDATION_NON_STEAM_BROWSE_RAWG_ENRICHMENT = 6;
const RECOMMENDATION_TIGHT_NON_STEAM_BROWSE_RAWG_ENRICHMENT = 4;
const RECOMMENDATION_STRATEGY_RAWG_ENRICHMENT = 6;
const RECOMMENDATION_MULTIPLAYER_BROWSE_RAWG_ENRICHMENT = 6;
const MAX_CATALOG_RESOLUTIONS = 8;

function isSimpleSocialRecommendationPrompt(args: {
  rawPreferences: string;
  preferences: {
    genres: string[];
    rawgGenres: string[];
    tags: string[];
    multiplayer: boolean;
    deckbuilding: boolean;
    highRating: boolean;
    shortSession: boolean;
  };
  constraints: RecommendationConstraints;
  isMixedLanguage: boolean;
}): boolean {
  return (
    args.preferences.multiplayer &&
    !args.preferences.deckbuilding &&
    !args.preferences.highRating &&
    !args.preferences.shortSession &&
    !args.constraints.actionBias &&
    args.constraints.excludeGenres.length === 0 &&
    args.constraints.excludeGameplay.length === 0 &&
    args.constraints.avoidComplexity.length === 0 &&
    args.constraints.qualityIntent.length === 0 &&
    !args.isMixedLanguage &&
    args.preferences.genres.length <= 1 &&
    args.preferences.rawgGenres.length <= 1 &&
    args.preferences.tags.length <= 1
  );
}

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
  const genericRoguelikeIntent =
    hasRoguelikeIntent(preferences.genres) &&
    !preferences.deckbuilding &&
    !hasActionRogueliteIntent(preferences.genres);

  if (preferences.genres.length > 1) {
    filtered = filtered.filter((deal) =>
      preferences.deckbuilding
        ? matchesRequestedDeckbuildingHybridGenres(deal, preferences.genres)
        : matchesAllRequestedGenres(deal, preferences.genres)
    );
  }

  if (preferences.multiplayer) {
    filtered = filtered.filter((deal) => deal.multiplayer);
  }

  if (preferences.deckbuilding) {
    const deckbuildingMatches = filtered.filter(hasDeckbuildingEvidence);
    filtered = deckbuildingMatches.length > 0 ? deckbuildingMatches : [];
  }

  if (genericRoguelikeIntent) {
    const roguelikeMatches = filtered.filter(
      (deal) =>
        hasRoguelikeDealEvidence(deal) &&
        hasStrongReviewSignal(deal) &&
        deal.metadataStatus !== "missing" &&
        deal.metadataStatus !== "unavailable"
    );
    filtered = roguelikeMatches.length > 0 ? roguelikeMatches : [];
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

function buildDiscoverBroadIntentSignals(filters: DiscoverFilters): BroadIntentSignals {
  const requestedGenres = (filters.genres ?? []).map((genre) => genre.trim()).filter(Boolean);
  const normalizedGenres = requestedGenres.map((genre) => genre.toLowerCase());
  const steamDeckRequest = hasSteamDeckRequest(filters.platforms);
  const cheapBrowse =
    filters.sort === "lowest-price" ||
    typeof filters.budget === "number" && filters.budget <= 10_000;
  const avoidObscure = filters.sort === "highest-rating";
  const broadCoop =
    filters.multiplayer === true &&
    !normalizedGenres.includes("racing") &&
    !normalizedGenres.includes("sports");
  const broadGenreBrowse =
    requestedGenres.length === 1 &&
    (normalizedGenres[0] === "rpg" || normalizedGenres[0] === "strategy");

  return {
    cheapBrowse,
    avoidObscure,
    broadCoop,
    steamDeckBrowse: steamDeckRequest && cheapBrowse,
    broadGenreBrowse,
    requestedGenres
  };
}

function buildRecommendationBroadIntentSignals(
  rawPreferences: string,
  preferences: {
    genres: string[];
    highRating: boolean;
  },
  platforms: string[],
  multiplayer: boolean
): BroadIntentSignals {
  const requestedGenres = preferences.genres;
  const normalizedGenres = requestedGenres.map((genre) => genre.trim().toLowerCase());
  const broadCoop =
    multiplayer &&
    !normalizedGenres.includes("racing") &&
    !normalizedGenres.includes("sports");
  const broadGenreBrowse =
    requestedGenres.length === 1 &&
    (normalizedGenres[0] === "rpg" || normalizedGenres[0] === "strategy");
  const cheapBrowse = /저렴|가성비|싸게|할인가만|밑으로|안쪽/i.test(rawPreferences);

  return {
    cheapBrowse,
    avoidObscure: preferences.highRating,
    broadCoop,
    steamDeckBrowse: hasSteamDeckRequest(platforms) && cheapBrowse,
    broadGenreBrowse,
    requestedGenres
  };
}

function buildRecommendationSocialPromptProfile(args: {
  rawPreferences: string;
  multiplayer: boolean;
  constraints: RecommendationConstraints;
}): RecommendationSocialPromptProfile | null {
  if (!args.multiplayer) {
    return null;
  }

  if (
    args.constraints.coopMode.includes("party") ||
    /party|party-friendly|party night|hangout|game night|shared-?screen|friends-?first|친구\s*모임(?:용)?|웃으면서|떠들면서|웃긴|chill co-?op/i.test(
      args.rawPreferences
    )
  ) {
    return "party-hangout";
  }

  return "generic-coop";
}

function shouldUseStrictSocialPromptProfile(args: {
  rawPreferences: string;
  constraints: RecommendationConstraints;
  socialProfile: RecommendationSocialPromptProfile | null;
}): boolean {
  if (!args.socialProfile) {
    return false;
  }

  if (args.constraints.coopMode.includes("non-competitive")) {
    return true;
  }

  return /party-friendly|party night|hangout|game night|shared-?screen|friends-?first|friends-?only|non-?sweaty|teamplay|친구\s*모임(?:용)?|모임용/i.test(
    args.rawPreferences
  );
}

function buildRecommendationRecoveryRankingProfile(
  kind: RecommendationRecoveryKind,
  rawPreferences: string,
  preferences: {
    shortSession: boolean;
  },
  constraints: RecommendationConstraints,
  requestedPlatforms: string[] = [],
  simpleSocialPrompt = false,
  socialProfile?: RecommendationSocialPromptProfile | undefined
): RecommendationRecoveryRankingProfile {
  return {
    kind,
    shortSession: preferences.shortSession,
    tacticsPrompt: /전술|tactics|turn-?based|턴제/i.test(rawPreferences),
    partyPrompt:
      socialProfile === "party-hangout" ||
      /파티|party|party-friendly|party night|hangout|웃긴|떠들|같이 웃으면서|friends?/i.test(
        rawPreferences
      ),
    socialProfile,
    nonCompetitive:
      constraints.coopMode.includes("non-competitive") ||
      constraints.excludeGenres.includes("pvp"),
    excludeRacingOrSports:
      constraints.excludeGenres.includes("racing") ||
      constraints.excludeGenres.includes("sports"),
    requestedPlatforms,
    simpleSocialPrompt,
    avoidComplexity: constraints.avoidComplexity,
    qualityIntent: constraints.qualityIntent
  };
}

function applyBroadIntentRanking(
  deals: DealCandidate[],
  signals: BroadIntentSignals
): DealCandidate[] {
  if (
    deals.length <= 1 ||
    (!signals.cheapBrowse &&
      !signals.avoidObscure &&
      !signals.broadCoop &&
      !signals.steamDeckBrowse &&
      !signals.broadGenreBrowse)
  ) {
    return deals;
  }

  const originalOrder = new Map(
    deals.map((deal, index) => [deal.id || normalizeTitleKey(deal.title), index])
  );

  return [...deals].sort((left, right) => {
    const scoreDifference =
      getBroadIntentRankingScore(right, signals) - getBroadIntentRankingScore(left, signals);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return (
      (originalOrder.get(left.id || normalizeTitleKey(left.title)) ?? 0) -
      (originalOrder.get(right.id || normalizeTitleKey(right.title)) ?? 0)
    );
  });
}

function getBroadIntentRankingScore(deal: DealCandidate, signals: BroadIntentSignals): number {
  const reviewScore = Math.max((deal.rating ?? 0) * 20, deal.metacritic ?? 0);
  const hasReview = hasStrongReviewSignal(deal);
  const hasCriticScore = (deal.metacritic ?? 0) >= 75;
  const metadataKnown = deal.metadataStatus !== "missing" && deal.metadataStatus !== "unavailable";
  const isFree = deal.price.amount <= 0;
  const isUltraCheap = deal.price.amount > 0 && deal.price.amount <= 1000;
  const deckStatus = getDeckCompatibilityStatus(deal);

  let score = reviewScore;

  if (metadataKnown) {
    score += 80;
  } else {
    score -= 80;
  }

  if (signals.broadGenreBrowse || signals.avoidObscure || signals.steamDeckBrowse) {
    score += hasReview ? 90 : -120;
  }

  if (signals.avoidObscure) {
    score += hasCriticScore ? 120 : -60;
  }

  if (signals.broadGenreBrowse && matchesAllRequestedGenres(deal, signals.requestedGenres)) {
    score += 45;
  }

  if (signals.broadCoop) {
    score += deal.multiplayer ? 120 : -240;
    score += hasBroadCoopFriendlyShape(deal) ? 40 : 0;
    score -= hasUnrequestedRacingOrSports(deal, signals.requestedGenres) ? 110 : 0;
  }

  if (signals.steamDeckBrowse) {
    switch (deckStatus) {
      case "verified":
        score += 140;
        break;
      case "playable":
        score += 110;
        break;
      case "unknown":
        score -= 40;
        break;
      case "unsupported":
        score -= 220;
        break;
    }
  }

  if (signals.cheapBrowse || signals.broadGenreBrowse || signals.avoidObscure || signals.steamDeckBrowse) {
    if (isFree) {
      score -= 220;
    }

    if (isUltraCheap) {
      score -= 120;
    }

    if ((deal.rating ?? 0) === 0 && (deal.metacritic ?? 0) === 0) {
      score -= 160;
    }
  }

  score += Math.min(deal.cut, 75) * 0.3;
  score -= deal.price.amount / 500;

  return score;
}

function hasDeckbuildingEvidence(deal: DealCandidate): boolean {
  return /\b(deck|deckbuilder|deckbuilding|card|cards|hand)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")} ${getRecommendationDealTags(
      deal as RecommendationTaggedDeal
    ).join(" ")}`
  );
}

function hasRecommendationDeckCuePrompt(rawPreferences: string): boolean {
  return /\b(deck|deckbuilder|deckbuilding|card|cards|hand)\b/i.test(rawPreferences) || /덱|카드|손패/.test(rawPreferences);
}

function hasStrongReviewSignal(deal: DealCandidate): boolean {
  return (deal.rating ?? 0) >= 4 || (deal.metacritic ?? 0) >= 75;
}

function matchesAllRequestedGenres(deal: DealCandidate, requestedGenres: string[]): boolean {
  const normalizedGenres = new Set(deal.genres.map((genre) => genre.trim().toLowerCase()));

  return requestedGenres.every((genre) => normalizedGenres.has(genre.trim().toLowerCase()));
}

function matchesRequestedDeckbuildingHybridGenres(
  deal: DealCandidate,
  requestedGenres: string[]
): boolean {
  if (!hasDeckbuildingEvidence(deal)) {
    return false;
  }

  return requestedGenres.every((genre) => {
    const normalized = genre.trim().toLowerCase();
    if (!normalized) {
      return true;
    }

    if (normalized === "strategy") {
      return true;
    }

    if (normalized === "action") {
      return hasActionDealEvidence(deal);
    }

    if (normalized === "card" || normalized === "deckbuilder") {
      return hasDeckbuildingEvidence(deal);
    }

    if (normalized === "roguelike" || normalized === "roguelite") {
      return hasRoguelikeDealEvidence(deal);
    }

    return deal.genres.some((value) => value.trim().toLowerCase() === normalized);
  });
}

function hasActionDealEvidence(deal: DealCandidate): boolean {
  return /\b(action|combat|shooter|shooting|hack|slash|brawler|arcade)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")} ${getRecommendationDealTags(
      deal as RecommendationTaggedDeal
    ).join(" ")}`
  );
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

function matchesDealRecoveryIntent(
  deal: DealCandidate,
  preferences: {
    genres: string[];
    deckbuilding: boolean;
  }
): boolean {
  const actionRogueliteIntent = hasActionRogueliteIntent(preferences.genres);
  const genericRoguelikeIntent =
    hasRoguelikeIntent(preferences.genres) && !preferences.deckbuilding && !actionRogueliteIntent;

  if (preferences.deckbuilding && !hasDeckbuildingEvidence(deal)) {
    return false;
  }

  if (actionRogueliteIntent && !hasActionRogueliteDealEvidence(deal)) {
    return false;
  }

  if (genericRoguelikeIntent) {
    if (!hasRoguelikeDealEvidence(deal)) {
      return false;
    }

    if (!hasStrongReviewSignal(deal)) {
      return false;
    }
  }

  return true;
}

function shouldAttemptShapeAwareRecovery(args: {
  rawPreferences: string;
  currentMatches: DealCandidate[];
  preferences: {
    genres: string[];
    multiplayer: boolean;
  };
  constraints: RecommendationConstraints;
}): boolean {
  return shouldAttemptActionRecovery(args.currentMatches, args.preferences, args.constraints);
}

function shouldAttemptPartyRecovery(
  rawPreferences: string,
  currentMatches: DealCandidate[],
  preferences: {
    multiplayer: boolean;
  },
  constraints: RecommendationConstraints
): boolean {
  const explicitPartyPrompt =
    constraints.coopMode.includes("party") ||
    constraints.coopMode.includes("non-competitive") ||
    /party|friends?|with friends|play together|친구(?:들이)?랑|여럿이|같이 놀기|떠들/i.test(
      rawPreferences
    );
  if (!preferences.multiplayer || !explicitPartyPrompt) {
    return false;
  }

  const top = currentMatches[0];
  return !top || !matchesPartyRecoveryDeal(top, constraints);
}

function shouldAttemptActionRecovery(
  currentMatches: DealCandidate[],
  preferences: {
    genres: string[];
  },
  constraints: RecommendationConstraints
): boolean {
  const actionRecoveryIntent =
    hasRoguelikeIntent(preferences.genres) &&
    (constraints.actionBias ||
      constraints.excludeGenres.includes("card/deckbuilder") ||
      constraints.excludeGenres.includes("strategy") ||
      constraints.excludeGameplay.includes("turn-based"));
  if (!actionRecoveryIntent) {
    return false;
  }

  const top = currentMatches[0];
  return !top || !matchesActionRecoveryDeal(top, constraints);
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

function hasActionRogueliteDealEvidence(deal: DealCandidate): boolean {
  const normalizedGenres = new Set(deal.genres.map((genre) => genre.trim().toLowerCase()));

  return normalizedGenres.has("action") && normalizedGenres.has("roguelike");
}

function hasRoguelikeDealEvidence(deal: DealCandidate): boolean {
  const taggedValues = getRecommendationDealTags(deal as RecommendationTaggedDeal);
  return (
    deal.genres.some((genre) => {
      const normalized = genre.trim().toLowerCase();
      return normalized === "roguelike" || normalized === "roguelite";
    }) ||
    taggedValues.some((tag) => {
      const normalized = tag.trim().toLowerCase();
      return normalized.includes("roguelike") || normalized.includes("roguelite");
    })
  );
}

function hasShortSessionEvidence(deal: RecommendationTaggedDeal): boolean {
  const values = `${deal.title} ${deal.genres.join(" ")} ${getRecommendationDealTags(deal).join(" ")}`;
  return (
    /\b(action|arcade|roguelike|roguelite|card|deckbuilder|short-run|pick-?up|snackable|brisk|quick)\b/i.test(
      values
    ) &&
    !hasStoryAdventurePuzzleBrowseFiller(deal) &&
    !hasReadingHeavyDealEvidence(deal) &&
    !hasLongSessionDealEvidence(deal) &&
    !hasHeavyStrategyDealEvidence(deal)
  );
}

function requiresApproachableStrategyEvidence(context: RecommendationEvidenceContext): boolean {
  return (
    context.constraints.strategyPreference === "required" &&
    context.constraints.avoidComplexity.includes("complex-strategy")
  );
}

function requiresStrongActionRogueliteShape(context: RecommendationEvidenceContext): boolean {
  return (
    requiresActionEvidence(context) &&
    requiresRoguelikeEvidence(context) &&
    (context.constraints.qualityIntent.includes("not-filler") ||
      (context.constraints.excludeGenres.includes("card/deckbuilder") &&
        context.constraints.excludeGameplay.includes("turn-based")))
  );
}

function hasStrongActionRogueliteStyleEvidence(deal: DealCandidate): boolean {
  const values = `${deal.title} ${deal.genres.join(" ")} ${getRecommendationDealTags(
    deal as RecommendationTaggedDeal
  ).join(" ")}`;

  return /\b(arcade|combat|shooter|shooting|hack|slash|real-time|fast|tempo)\b/i.test(values);
}

function isBuildcraftHybridPrompt(context: RecommendationEvidenceContext): boolean {
  return /\bbuildcraft\b/i.test(context.rawPreferences);
}

function requiresNonDeckStrategyRoguelikeHybrid(
  context: RecommendationEvidenceContext
): boolean {
  return (
    requiresRoguelikeEvidence(context) &&
    context.constraints.strategyPreference === "required" &&
    !requiresDeckbuildingEvidence(context)
  );
}

function hasHorrorDealEvidence(deal: DealCandidate): boolean {
  return /\b(horror|공포)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")} ${getRecommendationDealTags(
      deal as RecommendationTaggedDeal
    ).join(" ")}`
  );
}

function hasBroadCoopFriendlyShape(deal: DealCandidate): boolean {
  const normalizedGenres = new Set(deal.genres.map((genre) => genre.trim().toLowerCase()));
  return (
    normalizedGenres.has("action") ||
    normalizedGenres.has("casual") ||
    normalizedGenres.has("arcade") ||
    normalizedGenres.has("party")
  );
}

function hasUnrequestedRacingOrSports(deal: DealCandidate, requestedGenres: string[]): boolean {
  const normalizedGenres = new Set(deal.genres.map((genre) => genre.trim().toLowerCase()));
  const requested = new Set(requestedGenres.map((genre) => genre.trim().toLowerCase()));

  return (
    (normalizedGenres.has("racing") || normalizedGenres.has("sports")) &&
    !requested.has("racing") &&
    !requested.has("sports")
  );
}

function hasCatalogReviewSignal(candidate: CatalogCandidate): boolean {
  return (candidate.rating ?? 0) >= 4 || (candidate.metacritic ?? 0) >= 75;
}

function matchesPartyRecoveryCandidate(
  candidate: CatalogCandidate,
  constraints: RecommendationConstraints
): boolean {
  return (
    candidate.multiplayer &&
    hasCatalogReviewSignal(candidate) &&
    hasPartyRecoveryCandidateShape(candidate) &&
    (!constraints.excludeGenres.includes("racing") && !constraints.excludeGenres.includes("sports")
      ? true
      : !hasRacingOrSportsCandidateShape(candidate)) &&
    (!constraints.excludeGenres.includes("pvp") || !hasPvPCandidateEvidence(candidate))
  );
}

function matchesPartyRecoveryDeal(
  deal: DealCandidate,
  constraints: RecommendationConstraints
): boolean {
  return (
    deal.multiplayer &&
    hasBroadCoopFriendlyShape(deal) &&
    (!constraints.excludeGenres.includes("racing") && !constraints.excludeGenres.includes("sports")
      ? true
      : !hasRacingOrSportsShape(deal)) &&
    (!constraints.excludeGenres.includes("pvp") || !hasPvPDealEvidence(deal))
  );
}

function matchesActionRecoveryCandidate(
  candidate: CatalogCandidate,
  constraints: RecommendationConstraints
): boolean {
  if (!hasActionRogueliteCandidateEvidence(candidate)) {
    return false;
  }

  if (constraints.excludeGenres.includes("card/deckbuilder") && hasDeckbuildingCandidateEvidence(candidate)) {
    return false;
  }

  if (constraints.excludeGenres.includes("strategy") && hasStrategyCandidateEvidence(candidate)) {
    return false;
  }

  if (constraints.excludeGameplay.includes("turn-based") && hasTurnBasedCandidateEvidence(candidate)) {
    return false;
  }

  return true;
}

function matchesActionRecoveryDeal(
  deal: DealCandidate,
  constraints: RecommendationConstraints
): boolean {
  if (!hasActionRogueliteDealEvidence(deal)) {
    return false;
  }

  if (constraints.excludeGenres.includes("card/deckbuilder") && hasDeckbuildingEvidence(deal)) {
    return false;
  }

  if (constraints.excludeGenres.includes("strategy") && deal.genres.some((genre) => genre.trim().toLowerCase() === "strategy")) {
    return false;
  }

  if (constraints.excludeGameplay.includes("turn-based") && hasTurnBasedDealEvidence(deal)) {
    return false;
  }

  return true;
}

function supportsLastChanceSparseRecovery(kind: RecommendationRecoveryKind): boolean {
  return (
    kind === "broad-multiplayer" ||
    kind === "steam-deck-roguelike" ||
    kind === "steam-deck-strategy-roguelike" ||
    kind === "steam-deck-strategy" ||
    kind === "deckbuilding-card" ||
    kind === "non-steam-strategy-rating"
  );
}

function isDiscountSeekingSparseRecoveryKind(kind: RecommendationRecoveryKind): boolean {
  return (
    kind === "broad-multiplayer" ||
    kind === "steam-deck-roguelike" ||
    kind === "steam-deck-strategy-roguelike" ||
    kind === "steam-deck-strategy" ||
    kind === "deckbuilding-card" ||
    kind === "non-steam-strategy-rating"
  );
}

function buildLastChanceSparseRecoveryProfile(
  profile: RecommendationRecoveryProfile,
  simpleSocialPrompt = false
): RecommendationRecoveryProfile {
  return {
    ...profile,
    queries: profile.queries.slice(0, 1),
    maxDiscoverCalls: 1,
    maxResolutions: Math.min(
      profile.maxResolutions,
      isSteamDeckSparseRecoveryKind(profile.kind) ||
        profile.kind === "non-steam-strategy-rating" ||
        profile.kind === "broad-multiplayer"
        ? profile.kind === "broad-multiplayer" && simpleSocialPrompt
          ? 6
          : 4
        : 2
    ),
    maxMatches: 1
  };
}

function matchesSparseRecoveryCandidate(
  candidate: CatalogCandidate,
  kind: RecommendationRecoveryKind,
  constraints: RecommendationConstraints,
  requestedPlatforms: string[] = [],
  socialProfile?: RecommendationSocialPromptProfile | undefined
): boolean {
  switch (kind) {
    case "broad-multiplayer":
      return socialProfile
        ? candidate.multiplayer &&
            matchesRequestedPlatforms(candidate.platforms, requestedPlatforms) &&
            matchesSocialPromptCandidateShape(candidate, socialProfile) &&
            (!constraints.excludeGenres.includes("racing") ||
              !hasRacingOrSportsCandidateShape(candidate)) &&
            (!constraints.excludeGenres.includes("sports") ||
              !hasRacingOrSportsCandidateShape(candidate)) &&
            (!(constraints.excludeGenres.includes("pvp") ||
              constraints.coopMode.includes("non-competitive")) ||
              !hasPvPCandidateEvidence(candidate)) &&
            (!constraints.qualityIntent.includes("review-backed") || hasCatalogReviewSignal(candidate))
        : candidate.multiplayer &&
            matchesRequestedPlatforms(candidate.platforms, requestedPlatforms) &&
            (!requiresPartyRecoveryShape(constraints) ||
              hasPartyRecoveryCandidateShape(candidate) ||
              hasExplicitCoopCandidateEvidence(candidate)) &&
            (!constraints.excludeGenres.includes("racing") ||
              !hasRacingOrSportsCandidateShape(candidate)) &&
            (!constraints.excludeGenres.includes("sports") ||
              !hasRacingOrSportsCandidateShape(candidate)) &&
            (!(constraints.excludeGenres.includes("pvp") ||
              constraints.coopMode.includes("non-competitive")) ||
              !hasPvPCandidateEvidence(candidate)) &&
            (!constraints.qualityIntent.includes("review-backed") || hasCatalogReviewSignal(candidate));
    case "steam-deck-roguelike":
      return hasRoguelikeCandidateEvidence(candidate);
    case "steam-deck-strategy-roguelike":
      return (
        hasRoguelikeCandidateEvidence(candidate) &&
        hasStrategyCandidateEvidence(candidate) &&
        hasCatalogReviewSignal(candidate)
      );
    case "steam-deck-strategy":
      return hasStrategyCandidateEvidence(candidate) && hasCatalogReviewSignal(candidate);
    case "non-steam-strategy-rating":
      return (
        hasStrategyCandidateEvidence(candidate) &&
        hasCatalogReviewSignal(candidate) &&
        (!constraints.excludeGenres.includes("strategy") || !hasStrategyCandidateEvidence(candidate)) &&
        (!constraints.avoidComplexity.includes("complex-strategy") ||
          !hasHeavyStrategyCandidateEvidence(candidate) ||
          hasTacticsCandidateEvidence(candidate)) &&
        (!constraints.avoidComplexity.includes("reading-heavy") ||
          !hasReadingHeavyCandidateEvidence(candidate)) &&
        (!constraints.avoidComplexity.includes("long-session") ||
          !hasLongSessionCandidateEvidence(candidate))
      );
    case "deckbuilding-card":
      return (
        hasDeckbuildingCandidateEvidence(candidate) &&
        (!constraints.excludeGenres.includes("strategy") || !hasHeavyStrategyCandidateEvidence(candidate))
      );
  }
}

function matchesSparseRecoveryDeal(
  deal: DealCandidate,
  kind: RecommendationRecoveryKind,
  constraints: RecommendationConstraints,
  preferences: {
    shortSession: boolean;
  },
  steamDeckRequest: boolean,
  socialProfile?: RecommendationSocialPromptProfile | undefined
): boolean {
  switch (kind) {
    case "broad-multiplayer":
      return socialProfile
        ? deal.multiplayer &&
            matchesSocialPromptDealShape(deal, socialProfile) &&
            (!constraints.excludeGenres.includes("racing") || !hasRacingOrSportsShape(deal)) &&
            (!constraints.excludeGenres.includes("sports") || !hasRacingOrSportsShape(deal)) &&
            (!(constraints.excludeGenres.includes("pvp") ||
              constraints.coopMode.includes("non-competitive")) ||
              !hasPvPDealEvidence(deal)) &&
            (!constraints.qualityIntent.includes("review-backed") || hasStrongReviewSignal(deal))
        : deal.multiplayer &&
            (!requiresPartyRecoveryShape(constraints) || hasBroadCoopFriendlyShape(deal)) &&
            (!constraints.excludeGenres.includes("racing") || !hasRacingOrSportsShape(deal)) &&
            (!constraints.excludeGenres.includes("sports") || !hasRacingOrSportsShape(deal)) &&
            (!(constraints.excludeGenres.includes("pvp") ||
              constraints.coopMode.includes("non-competitive")) ||
              !hasPvPDealEvidence(deal)) &&
            (!constraints.qualityIntent.includes("review-backed") || hasStrongReviewSignal(deal));
    case "steam-deck-roguelike":
      return (
        getDeckCompatibilityStatus(deal) !== "unsupported" &&
        hasRoguelikeDealEvidence(deal) &&
        (!preferences.shortSession || hasShortSessionSparseShape(deal))
      );
    case "steam-deck-strategy-roguelike":
      return (
        getDeckCompatibilityStatus(deal) !== "unsupported" &&
        hasStrongReviewSignal(deal) &&
        hasRoguelikeDealEvidence(deal) &&
        hasStrategyRecoveryDealEvidence(deal) &&
        (!preferences.shortSession || hasShortSessionSparseShape(deal))
      );
    case "steam-deck-strategy":
      return (
        getDeckCompatibilityStatus(deal) !== "unsupported" &&
        hasStrongReviewSignal(deal) &&
        hasStrategyRecoveryDealEvidence(deal) &&
        (!preferences.shortSession || hasShortSessionSparseShape(deal))
      );
    case "non-steam-strategy-rating":
      return (
        hasStrongReviewSignal(deal) &&
        hasStrategyRecoveryDealEvidence(deal) &&
        !(
          (constraints.excludeGenres.includes("strategy") || constraints.strategyPreference === "avoid") &&
          hasStrategyRecoveryDealEvidence(deal)
        ) &&
        (!constraints.avoidComplexity.includes("complex-strategy") ||
          !hasHeavyStrategyDealEvidence(deal) ||
          hasTacticsDealEvidence(deal)) &&
        (!constraints.avoidComplexity.includes("reading-heavy") ||
          !hasReadingHeavyDealEvidence(deal)) &&
        (!constraints.avoidComplexity.includes("long-session") ||
          !hasLongSessionDealEvidence(deal))
      );
    case "deckbuilding-card":
      return (
        hasDeckbuildingEvidence(deal) &&
        (!constraints.excludeGenres.includes("strategy") || !hasHeavyStrategyDealEvidence(deal)) &&
        (!steamDeckRequest || getDeckCompatibilityStatus(deal) !== "unsupported")
      );
  }
}

function finalizeSparseRecoveryMatches(
  matches: DealCandidate[],
  kind: RecommendationRecoveryKind,
  filters: DiscoverFilters,
  preferences: {
    shortSession: boolean;
  },
  steamDeckRequest: boolean
): DealCandidate[] {
  const ranked = scoreDealCandidates(
    dedupeDeals(matches),
    kind === "deckbuilding-card" ? { ...filters, genres: undefined } : filters
  );

  if (
    kind === "steam-deck-roguelike" ||
    kind === "steam-deck-strategy-roguelike" ||
    kind === "steam-deck-strategy" ||
    (kind === "deckbuilding-card" && steamDeckRequest)
  ) {
    const supported = ranked.filter((deal) => {
      const status = getDeckCompatibilityStatus(deal);
      return status === "verified" || status === "playable";
    });
    const unknown = ranked.filter((deal) => getDeckCompatibilityStatus(deal) === "unknown");

    return supported.length > 0 ? [...supported, ...unknown] : unknown;
  }

  if (kind === "broad-multiplayer" && preferences.shortSession) {
    return [...ranked].sort((left, right) => {
      const delta = getShortSessionScore(right) - getShortSessionScore(left);
      return delta !== 0 ? delta : 0;
    });
  }

  if (kind === "non-steam-strategy-rating" && preferences.shortSession) {
    return [...ranked].sort((left, right) => {
      const delta = getShortSessionScore(right) - getShortSessionScore(left);
      return delta !== 0 ? delta : 0;
    });
  }

  return ranked;
}

function hasPartyRecoveryCandidateShape(candidate: CatalogCandidate): boolean {
  const normalizedGenres = new Set(candidate.genres.map((genre) => genre.trim().toLowerCase()));
  const normalizedTags = new Set((candidate.tags ?? []).map((tag) => tag.trim().toLowerCase()));

  return (
    normalizedGenres.has("action") ||
    normalizedGenres.has("casual") ||
    normalizedGenres.has("arcade") ||
    normalizedGenres.has("party") ||
    normalizedTags.has("party")
  );
}

function hasExplicitCoopCandidateEvidence(candidate: CatalogCandidate): boolean {
  const values = `${candidate.title} ${candidate.genres.join(" ")} ${(candidate.tags ?? []).join(" ")}`.toLowerCase();
  return /\b(co-?op|coop|cooperative|teamplay|team-based|multiplayer)\b/.test(values);
}

function hasLocalSocialCandidateEvidence(candidate: CatalogCandidate): boolean {
  const values = `${candidate.title} ${candidate.genres.join(" ")} ${(candidate.tags ?? []).join(" ")}`.toLowerCase();
  return /\b(local[ -]?co-?op|couch[ -]?co-?op|split[ -]?screen|same[ -]?screen|shared[ -]?screen|cooperative)\b/.test(
    values
  );
}

function hasStrongPartyCandidateEvidence(candidate: CatalogCandidate): boolean {
  const values = `${candidate.title} ${candidate.genres.join(" ")} ${(candidate.tags ?? []).join(" ")}`.toLowerCase();
  return /\b(party|casual|arcade|brawler|fun|hangout|co-?op|coop)\b/.test(values);
}

function matchesSocialPromptCandidateShape(
  candidate: CatalogCandidate,
  socialProfile: RecommendationSocialPromptProfile
): boolean {
  if (socialProfile === "party-hangout") {
    return hasStrongPartyCandidateEvidence(candidate);
  }

  return (
    hasExplicitCoopCandidateEvidence(candidate) ||
    hasLocalSocialCandidateEvidence(candidate) ||
    hasStrongPartyCandidateEvidence(candidate)
  );
}

function requiresPartyRecoveryShape(constraints: RecommendationConstraints): boolean {
  return constraints.coopMode.includes("party");
}

function hasRacingOrSportsCandidateShape(candidate: CatalogCandidate): boolean {
  const normalizedGenres = new Set(candidate.genres.map((genre) => genre.trim().toLowerCase()));
  return normalizedGenres.has("racing") || normalizedGenres.has("sports");
}

function hasRacingOrSportsShape(deal: DealCandidate): boolean {
  const normalizedGenres = new Set(deal.genres.map((genre) => genre.trim().toLowerCase()));
  return normalizedGenres.has("racing") || normalizedGenres.has("sports");
}

function hasPvPCandidateEvidence(candidate: CatalogCandidate): boolean {
  const values = `${candidate.title} ${candidate.genres.join(" ")} ${(candidate.tags ?? []).join(" ")}`.toLowerCase();
  return /\b(pvp|versus|vs|competitive|battle royale)\b/.test(values);
}

function hasPvPDealEvidence(deal: DealCandidate): boolean {
  const values = `${deal.title} ${deal.genres.join(" ")}`.toLowerCase();
  return /\b(pvp|versus|vs|competitive|battle royale)\b/.test(values);
}

function hasLocalSocialDealEvidence(deal: DealCandidate): boolean {
  const values = `${deal.title} ${deal.genres.join(" ")}`.toLowerCase();
  return /\b(local[ -]?co-?op|couch[ -]?co-?op|split[ -]?screen|same[ -]?screen|shared[ -]?screen|cooperative)\b/.test(
    values
  );
}

function hasStrongPartyDealEvidence(deal: DealCandidate): boolean {
  return /\b(party|casual|arcade|brawler|fun|hangout|co-?op|coop)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasSocialRescueDealEvidence(deal: DealCandidate): boolean {
  return /\b(action|casual|arcade|party|brawler|fun|hangout|co-?op|coop)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function classifyRecommendationSocialCandidateTier(
  deal: DealCandidate,
  socialProfile: RecommendationSocialPromptProfile
): RecommendationSocialCandidateTier {
  if (!deal.multiplayer) {
    return "reject";
  }

  if (hasStoryAdventurePuzzleBrowseFiller(deal) || hasLikelySingleplayerBrowseBias(deal)) {
    return "reject";
  }

  if (socialProfile === "party-hangout") {
    if (hasRacingOrSportsShape(deal) || hasPvPDealEvidence(deal)) {
      return "reject";
    }

    if (hasStrongPartyDealEvidence(deal)) {
      return "strict";
    }

    if (hasSocialRescueDealEvidence(deal)) {
      return "rescue";
    }

    return "reject";
  }

  if (hasExplicitCoopDealEvidence(deal) || hasLocalSocialDealEvidence(deal)) {
    return "strict";
  }

  if (
    hasStrongPartyDealEvidence(deal) &&
    hasBroadCoopFriendlyShape(deal) &&
    !hasRacingOrSportsShape(deal) &&
    !hasPvPDealEvidence(deal)
  ) {
    return "strict";
  }

  if (hasSocialRescueDealEvidence(deal) || hasBroadCoopFriendlyShape(deal)) {
    return "rescue";
  }

  return "reject";
}

function matchesSocialPromptDealShape(
  deal: DealCandidate,
  socialProfile: RecommendationSocialPromptProfile
): boolean {
  return classifyRecommendationSocialCandidateTier(deal, socialProfile) !== "reject";
}

function hasStrategyCandidateEvidence(candidate: CatalogCandidate): boolean {
  return /\b(strategy|strategic|tactics?|tactical|turn-?based)\b/i.test(
    `${candidate.title} ${candidate.genres.join(" ")} ${(candidate.tags ?? []).join(" ")}`
  );
}

function hasTacticsCandidateEvidence(candidate: CatalogCandidate): boolean {
  return /\b(tactics?|tactical|turn-?based)\b/i.test(
    `${candidate.title} ${candidate.genres.join(" ")} ${(candidate.tags ?? []).join(" ")}`
  );
}

function hasStrategyRecoveryDealEvidence(deal: DealCandidate): boolean {
  return hasStrategyCandidateEvidence({
    title: deal.title,
    genres: deal.genres,
    platforms: deal.platforms,
    tags: [],
    rating: deal.rating,
    metacritic: deal.metacritic,
    multiplayer: deal.multiplayer
  });
}

function hasTurnBasedCandidateEvidence(candidate: CatalogCandidate): boolean {
  return /\b(turn-?based)\b/i.test(
    `${candidate.title} ${candidate.genres.join(" ")} ${(candidate.tags ?? []).join(" ")}`
  );
}

function hasReadingHeavyCandidateEvidence(candidate: CatalogCandidate): boolean {
  return /\b(text-heavy|reading-heavy|story rich|visual novel|narrative)\b/i.test(
    `${candidate.title} ${candidate.genres.join(" ")} ${(candidate.tags ?? []).join(" ")}`
  );
}

function hasLongSessionCandidateEvidence(candidate: CatalogCandidate): boolean {
  return /\b(grand strategy|4x|simulation|management|wargame|campaign)\b/i.test(
    `${candidate.title} ${candidate.genres.join(" ")} ${(candidate.tags ?? []).join(" ")}`
  );
}

function hasTurnBasedDealEvidence(deal: DealCandidate): boolean {
  const values = `${deal.title} ${deal.genres.join(" ")} ${getRecommendationDealTags(
    deal as RecommendationTaggedDeal
  ).join(" ")}`;
  return /\b(turn-?based)\b/i.test(values) || /턴제/.test(values);
}

function hasHeavyStrategyCandidateEvidence(candidate: CatalogCandidate): boolean {
  return /\b(grand strategy|4x|simulation|management|wargame)\b/i.test(
    `${candidate.title} ${candidate.genres.join(" ")} ${(candidate.tags ?? []).join(" ")}`
  );
}

function hasHeavyStrategyDealEvidence(deal: DealCandidate): boolean {
  return /\b(grand strategy|4x|simulation|management|wargame)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")} ${getRecommendationDealTags(
      deal as RecommendationTaggedDeal
    ).join(" ")}`
  );
}

function hasTacticsDealEvidence(deal: DealCandidate): boolean {
  return /\b(tactics?|tactical|turn-?based)\b/i.test(`${deal.title} ${deal.genres.join(" ")}`) ||
    /전술|턴제/.test(`${deal.title} ${deal.genres.join(" ")}`);
}

function hasReadingHeavyDealEvidence(deal: DealCandidate): boolean {
  return /\b(text-heavy|reading-heavy|story rich|visual novel|narrative)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")} ${getRecommendationDealTags(
      deal as RecommendationTaggedDeal
    ).join(" ")}`
  );
}

function hasLongSessionDealEvidence(deal: DealCandidate): boolean {
  return /\b(grand strategy|4x|simulation|management|wargame|campaign)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")} ${getRecommendationDealTags(
      deal as RecommendationTaggedDeal
    ).join(" ")}`
  );
}

function hasShortSessionSparseShape(deal: DealCandidate): boolean {
  return /\b(action|casual|arcade|party|roguelike|card|deckbuilder)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")} ${getRecommendationDealTags(
      deal as RecommendationTaggedDeal
    ).join(" ")}`
  );
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

function buildStructuredMultiplayerBrowseQueries(
  rawPreferences: string,
  constraints: RecommendationConstraints,
  socialProfile?: RecommendationSocialPromptProfile | undefined
): Array<{
  genres?: string[] | undefined;
  sort: "best-value" | "highest-rating";
  mode: "party" | "generic";
}> {
  const partyPrompt =
    socialProfile === "party-hangout" ||
    constraints.coopMode.includes("party") ||
    /파티|party|party-friendly|party night|hangout|웃긴|떠들|같이 웃으면서|friends?/i.test(
      rawPreferences
    );

  return [
    { genres: ["Action"], sort: "best-value", mode: partyPrompt ? "party" : "generic" },
    { genres: ["Casual"], sort: "best-value", mode: partyPrompt ? "party" : "generic" },
    { genres: ["Indie"], sort: "best-value", mode: partyPrompt ? "party" : "generic" },
    { sort: "highest-rating", mode: "generic" }
  ];
}

function matchesStructuredMultiplayerBrowseDeal(
  deal: DealCandidate,
  options: {
    requestedPlatforms: string[];
    budget?: number | undefined;
    constraints: RecommendationConstraints;
    partyPrompt: boolean;
    reviewBacked: boolean;
    socialProfile?: RecommendationSocialPromptProfile | undefined;
  }
): boolean {
  return classifyStructuredMultiplayerBrowseDealTier(deal, options) === "strict";
}

function classifyStructuredMultiplayerBrowseDealTier(
  deal: DealCandidate,
  options: {
    requestedPlatforms: string[];
    budget?: number | undefined;
    constraints: RecommendationConstraints;
    partyPrompt: boolean;
    reviewBacked: boolean;
    socialProfile?: RecommendationSocialPromptProfile | undefined;
  }
): RecommendationSocialCandidateTier {
  if (deal.cut <= 0 || !deal.multiplayer) {
    return "reject";
  }

  if (
    typeof options.budget === "number" &&
    deal.price.amount > options.budget
  ) {
    return "reject";
  }

  if (
    options.requestedPlatforms.length > 0 &&
    deal.platforms.length > 0 &&
    !matchesRequestedPlatforms(deal.platforms, options.requestedPlatforms)
  ) {
    return "reject";
  }

  if (
    (options.constraints.excludeGenres.includes("pvp") ||
      options.constraints.coopMode.includes("non-competitive")) &&
    hasPvPDealEvidence(deal)
  ) {
    return "reject";
  }

  if (
    (options.constraints.excludeGenres.includes("racing") ||
      options.constraints.excludeGenres.includes("sports")) &&
    hasRacingOrSportsShape(deal)
  ) {
    return "reject";
  }

  if (options.reviewBacked && !hasStrongReviewSignal(deal)) {
    return "reject";
  }

  if (options.partyPrompt) {
    return classifyRecommendationSocialCandidateTier(
      deal,
      options.socialProfile ?? "party-hangout"
    );
  }

  if (!options.socialProfile) {
    return hasGenericCoopBrowseShape(deal) ? "strict" : "reject";
  }

  if (options.socialProfile === "generic-coop") {
    if (hasExplicitCoopDealEvidence(deal) || hasLocalSocialDealEvidence(deal)) {
      return "strict";
    }

    return matchesSocialPromptDealShape(deal, options.socialProfile) ? "rescue" : "reject";
  }

  return classifyRecommendationSocialCandidateTier(deal, options.socialProfile);
}

function recoverStructuredMultiplayerBrowseSocialMatches(args: {
  deals: DealCandidate[];
  requestedPlatforms: string[];
  budget?: number | undefined;
  constraints: RecommendationConstraints;
  reviewBacked: boolean;
  socialProfile: RecommendationSocialPromptProfile;
}): DealCandidate[] {
  const strict = rankStructuredMultiplayerBrowseDeals(
    args.deals.filter(
      (deal) =>
        classifyStructuredMultiplayerBrowseDealTier(deal, {
          requestedPlatforms: args.requestedPlatforms,
          budget: args.budget,
          constraints: args.constraints,
          partyPrompt: args.socialProfile === "party-hangout",
          reviewBacked: args.reviewBacked,
          socialProfile: args.socialProfile
        }) === "strict"
    ),
    {
      partyPrompt: args.socialProfile === "party-hangout",
      reviewBacked: args.reviewBacked,
      nonCompetitive:
        args.constraints.coopMode.includes("non-competitive") ||
        args.constraints.excludeGenres.includes("pvp"),
      excludeRacingOrSports:
        args.constraints.excludeGenres.includes("racing") ||
        args.constraints.excludeGenres.includes("sports"),
      budget: args.budget,
      socialProfile: args.socialProfile
    }
  );

  if (strict.length > 0) {
    return strict.slice(0, 2);
  }

  return rankStructuredMultiplayerBrowseDeals(
    args.deals.filter(
      (deal) =>
        classifyStructuredMultiplayerBrowseDealTier(deal, {
          requestedPlatforms: args.requestedPlatforms,
          budget: args.budget,
          constraints: args.constraints,
          partyPrompt: args.socialProfile === "party-hangout",
          reviewBacked: args.reviewBacked,
          socialProfile: args.socialProfile
        }) === "rescue"
    ),
    {
      partyPrompt: args.socialProfile === "party-hangout",
      reviewBacked: args.reviewBacked,
      nonCompetitive:
        args.constraints.coopMode.includes("non-competitive") ||
        args.constraints.excludeGenres.includes("pvp"),
      excludeRacingOrSports:
        args.constraints.excludeGenres.includes("racing") ||
        args.constraints.excludeGenres.includes("sports"),
      budget: args.budget,
      socialProfile: args.socialProfile
    }
  ).slice(0, 2);
}

function rankStructuredMultiplayerBrowseDeals(
  deals: DealCandidate[],
  options: {
    partyPrompt: boolean;
    reviewBacked: boolean;
    nonCompetitive: boolean;
    excludeRacingOrSports: boolean;
    budget?: number | undefined;
    socialProfile?: RecommendationSocialPromptProfile | undefined;
  }
): DealCandidate[] {
  return [...deals].sort((left, right) => {
    const delta =
      getStructuredMultiplayerBrowseScore(right, options) -
      getStructuredMultiplayerBrowseScore(left, options);
    return delta !== 0 ? delta : left.title.localeCompare(right.title);
  });
}

function getStructuredMultiplayerBrowseScore(
  deal: DealCandidate,
  options: {
    partyPrompt: boolean;
    reviewBacked: boolean;
    nonCompetitive: boolean;
    excludeRacingOrSports: boolean;
    budget?: number | undefined;
    socialProfile?: RecommendationSocialPromptProfile | undefined;
  }
): number {
  let score = 0;

  if (deal.multiplayer) {
    score += 140;
  }

  if (hasExplicitCoopDealEvidence(deal)) {
    score += options.partyPrompt ? 50 : 90;
  }

  if (
    (options.socialProfile &&
      matchesSocialPromptDealShape(deal, options.socialProfile)) ||
    (!options.socialProfile && hasGenericCoopBrowseShape(deal))
  ) {
    score += 70;
  }

  if (options.partyPrompt && hasStrongPartyDealEvidence(deal)) {
    score += 120;
  }

  if (
    options.socialProfile === "generic-coop" &&
    hasStrongPartyDealEvidence(deal) &&
    !hasExplicitCoopDealEvidence(deal) &&
    !hasLocalSocialDealEvidence(deal)
  ) {
    score -= 90;
  }

  if (hasStoryAdventurePuzzleBrowseFiller(deal)) {
    score -= options.partyPrompt ? 260 : 120;
  }

  if (hasLikelySingleplayerBrowseBias(deal)) {
    score -= options.partyPrompt ? 180 : 80;
  }

  if (options.excludeRacingOrSports && hasRacingOrSportsShape(deal)) {
    score -= 260;
  }

  if (options.nonCompetitive && hasPvPDealEvidence(deal)) {
    score -= 280;
  }

  if (options.reviewBacked) {
    score += hasStrongReviewSignal(deal) ? 120 : -140;
  } else if (hasStrongReviewSignal(deal)) {
    score += 50;
  }

  if (
    typeof options.budget === "number" &&
    deal.price.amount <= options.budget
  ) {
    score += deal.price.amount <= options.budget * 0.6 ? 35 : 15;
  }

  return score;
}

function hasExplicitCoopDealEvidence(deal: DealCandidate): boolean {
  return /\b(co-?op|coop|cooperative|teamplay|team-based|multiplayer)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasPartyOrFunBrowseShape(deal: DealCandidate): boolean {
  return /\b(party|brawler|fun|hangout|arcade|casual|action|co-?op|coop)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")}`
  );
}

function hasGenericCoopBrowseShape(deal: DealCandidate): boolean {
  return hasExplicitCoopDealEvidence(deal) || hasBroadCoopFriendlyShape(deal);
}

function hasStoryAdventurePuzzleBrowseFiller(deal: DealCandidate): boolean {
  return /\b(adventure|puzzle|story|narrative)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")} ${getRecommendationDealTags(
      deal as RecommendationTaggedDeal
    ).join(" ")}`
  );
}

function hasLikelySingleplayerBrowseBias(deal: DealCandidate): boolean {
  return /\b(singleplayer|story rich|story-rich|narrative|solo)\b/i.test(
    `${deal.title} ${deal.genres.join(" ")} ${getRecommendationDealTags(
      deal as RecommendationTaggedDeal
    ).join(" ")}`
  );
}

function matchesRequestedPlatforms(candidatePlatforms: string[], requestedPlatforms: string[]): boolean {
  if (requestedPlatforms.length === 0 || candidatePlatforms.length === 0) {
    return true;
  }

  const requested = new Set(requestedPlatforms.map((platform) => normalizePlatform(platform)));
  return candidatePlatforms.some((platform) => requested.has(normalizePlatform(platform)));
}

function normalizeTitleKey(value: string): string {
  return value.trim().toLowerCase();
}

function escapeRecommendationRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRecommendationRecoveryDealKey(deal: DealCandidate): string {
  return deal.id || normalizeTitleKey(deal.title);
}
