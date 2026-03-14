import { findBestRawgMatch } from "../domain/match.js";
import type { DealCandidate, DealsEnrichment, DiscoverFilters } from "../domain/score.js";
import type { CatalogDiscoveryInput, GameProviders } from "../domain/service.js";
import {
  IsThereAnyDealClient,
  type DealResolution,
  type ResolveDealOptions
} from "./itad-client.js";
import { RawgClient } from "./rawg-client.js";
import { SteamStoreClient } from "./steam-store-client.js";

export class GameDataGateway implements GameProviders {
  constructor(
    private readonly itad: IsThereAnyDealClient,
    private readonly rawg: RawgClient,
    private readonly steam?: SteamStoreClient
  ) {}

  async findDeals(args: DiscoverFilters & { country: string }): Promise<DealCandidate[]> {
    return this.itad.findDeals(args);
  }

  async enrichDeals(
    deals: DealCandidate[],
    options?: {
      includeSteamDeckCompatibility?: boolean;
      maxRawgLookups?: number;
      maxSteamLookups?: number;
    }
  ): Promise<DealsEnrichment> {
    const maxRawgLookups = options?.maxRawgLookups ?? deals.length;
    const rawgEligibleDeals = deals.slice(0, maxRawgLookups);
    const skippedRawgDeals = deals.slice(maxRawgLookups);
    const rawgResults = await mapWithConcurrency(rawgEligibleDeals, DEFAULT_RAWG_ENRICHMENT_CONCURRENCY, async (deal) => {
      try {
        const candidates = await this.rawg.searchGames(deal.title);
        const bestMatch = findBestRawgMatch(
          { title: deal.title, released: deal.released ?? null },
          candidates
        );

        if (!bestMatch.candidate) {
          return {
            deal: {
              ...deal,
              metadataStatus: deal.metadataStatus ?? "missing"
            }
          };
        }

        return {
          deal: {
            ...deal,
            genres: bestMatch.candidate.genres.length > 0 ? bestMatch.candidate.genres : deal.genres,
            platforms:
              bestMatch.candidate.platforms.length > 0
                ? bestMatch.candidate.platforms
                : deal.platforms,
            rating: bestMatch.candidate.rating ?? deal.rating,
            metacritic: bestMatch.candidate.metacritic ?? deal.metacritic,
            multiplayer: bestMatch.candidate.multiplayer ?? deal.multiplayer,
            released: bestMatch.candidate.released ?? deal.released,
            metadataStatus: "rawg" as const
          }
        };
      } catch (error) {
        return {
          deal: {
            ...deal,
            metadataStatus: "unavailable" as const
          },
          warning: toWarning(error, `RAWG 메타데이터를 일부 불러오지 못했습니다: ${deal.title}`)
        };
      }
    });

    let enriched: DealsEnrichment = {
      deals: [...rawgResults.map((result) => result.deal), ...skippedRawgDeals],
      warnings: rawgResults.flatMap((result) => (result.warning ? [result.warning] : []))
    };

    if (skippedRawgDeals.length > 0) {
      enriched.warnings.push("RAWG 보강 한도 때문에 일부 메타데이터를 생략했습니다.");
    }

    if (options?.includeSteamDeckCompatibility && this.steam) {
      const maxSteamLookups = options.maxSteamLookups ?? enriched.deals.length;
      const steamEligibleDeals = enriched.deals.slice(0, maxSteamLookups);
      const skippedSteamDeals = enriched.deals.slice(maxSteamLookups);
      const steamEnriched = await this.steam.enrichDeals(steamEligibleDeals);
      enriched = {
        deals: [...steamEnriched.deals, ...skippedSteamDeals],
        warnings: [
          ...enriched.warnings,
          ...steamEnriched.warnings,
          ...(skippedSteamDeals.length > 0
            ? ["Steam Deck 호환성 보강 한도 때문에 일부 정보를 생략했습니다."]
            : [])
        ]
      };
    }

    return enriched;
  }

  async resolveDeal(
    title: string,
    country: string,
    options?: ResolveDealOptions
  ): Promise<DealResolution> {
    const resolution = await this.itad.resolveDeal(title, country, options);

    if (resolution.kind !== "match" || !resolution.matches) {
      return resolution;
    }

    const enriched = await this.enrichDeals(resolution.matches, {
      includeSteamDeckCompatibility: (options?.preferredShops?.includes(61) ?? false)
    });

    return {
      ...resolution,
      matches: enriched.deals,
      warnings: [...(resolution.warnings ?? []), ...enriched.warnings]
    };
  }

  async discoverTitles(input: CatalogDiscoveryInput) {
    return this.rawg.discoverGames({
      tags: input.tags,
      genres: input.genres,
      limit: input.limit
    });
  }
}

const DEFAULT_RAWG_ENRICHMENT_CONCURRENCY = 3;

function toWarning(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return `${fallback} (${error.message})`;
  }

  return fallback;
}

async function mapWithConcurrency<Input, Output>(
  values: Input[],
  concurrency: number,
  mapper: (value: Input, index: number) => Promise<Output>
): Promise<Output[]> {
  const results = new Array<Output>(values.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(Math.max(concurrency, 1), values.length) }, async () => {
    while (true) {
      const current = cursor;
      cursor += 1;

      if (current >= values.length) {
        return;
      }

      results[current] = await mapper(values[current]!, current);
    }
  });

  await Promise.all(workers);

  return results;
}
