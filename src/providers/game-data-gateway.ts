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
    options?: { includeSteamDeckCompatibility?: boolean }
  ): Promise<DealsEnrichment> {
    const rawgResults: Array<{ deal: DealCandidate; warning?: string }> = [];

    for (const deal of deals) {
      try {
        const candidates = await this.rawg.searchGames(deal.title);
        const bestMatch = findBestRawgMatch(
          { title: deal.title, released: deal.released ?? null },
          candidates
        );

        if (!bestMatch.candidate) {
          rawgResults.push({
            deal: {
              ...deal,
              metadataStatus: deal.metadataStatus ?? "missing"
            }
          });
          continue;
        }

        rawgResults.push({
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
        });
      } catch (error) {
        rawgResults.push({
          deal: {
            ...deal,
            metadataStatus: "unavailable" as const
          },
          warning: toWarning(error, `RAWG 메타데이터를 일부 불러오지 못했습니다: ${deal.title}`)
        });
      }
    }

    let enriched: DealsEnrichment = {
      deals: rawgResults.map((result) => result.deal),
      warnings: rawgResults.flatMap((result) => (result.warning ? [result.warning] : []))
    };

    if (options?.includeSteamDeckCompatibility && this.steam) {
      const steamEnriched = await this.steam.enrichDeals(enriched.deals);
      enriched = {
        deals: steamEnriched.deals,
        warnings: [...enriched.warnings, ...steamEnriched.warnings]
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

function toWarning(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return `${fallback} (${error.message})`;
  }

  return fallback;
}
