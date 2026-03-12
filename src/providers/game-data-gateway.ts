import { findBestRawgMatch } from "../domain/match.js";
import type { DealCandidate, DealsEnrichment, DiscoverFilters } from "../domain/score.js";
import type { CatalogDiscoveryInput, GameProviders } from "../domain/service.js";
import {
  IsThereAnyDealClient,
  type DealResolution,
  type ResolveDealOptions
} from "./itad-client.js";
import { RawgClient } from "./rawg-client.js";

export class GameDataGateway implements GameProviders {
  constructor(
    private readonly itad: IsThereAnyDealClient,
    private readonly rawg: RawgClient
  ) {}

  async findDeals(args: DiscoverFilters & { country: string }): Promise<DealCandidate[]> {
    return this.itad.findDeals(args);
  }

  async enrichDeals(deals: DealCandidate[]): Promise<DealsEnrichment> {
    const results = await Promise.all(
      deals.map(async (deal) => {
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
      })
    );

    return {
      deals: results.map((result) => result.deal),
      warnings: results.flatMap((result) => (result.warning ? [result.warning] : []))
    };
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

    const enriched = await this.enrichDeals(resolution.matches);

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

function toWarning(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return `${fallback} (${error.message})`;
  }

  return fallback;
}
