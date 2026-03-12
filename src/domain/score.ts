export interface PricePoint {
  amount: number;
  currency: string;
}

export interface StoreOffer {
  store: string;
  price: PricePoint;
  regular?: PricePoint;
  cut?: number;
  url?: string | null;
}

export interface SteamDeckCompatibility {
  status: "verified" | "playable" | "unsupported" | "unknown";
  details: string[];
  steamAppId?: number | undefined;
  source: "steam";
}

export interface DealCandidate {
  id: string;
  title: string;
  price: PricePoint;
  regular: PricePoint;
  cut: number;
  genres: string[];
  platforms: string[];
  multiplayer: boolean;
  rating?: number | null | undefined;
  metacritic?: number | null | undefined;
  released?: string | null | undefined;
  historyLow?: PricePoint | null | undefined;
  stores?: StoreOffer[] | undefined;
  metadataStatus?: "itad" | "rawg" | "missing" | "unavailable" | undefined;
  steamDeckCompatibility?: SteamDeckCompatibility | undefined;
}

export interface DealsEnrichment {
  deals: DealCandidate[];
  warnings: string[];
}

export interface DiscoverFilters {
  budget?: number | undefined;
  genres?: string[] | undefined;
  platforms?: string[] | undefined;
  multiplayer?: boolean | undefined;
  sort?: "best-value" | "biggest-discount" | "lowest-price" | "highest-rating" | undefined;
  preferredShops?: number[] | undefined;
}

const EXCLUDED_TITLE_PATTERNS = [
  /\b(dlc|soundtrack|art ?book|bundle|season pass|expansion|supporter)\b/i,
  /\bost\b/i,
  /^3d puzzle\b/i,
  /^room football\b/i,
  /^how much items\b/i,
  /^archaeology\b/i,
  /^just move:/i,
  /top-?down 3d/i
] as const;

export function scoreDealCandidates(deals: DealCandidate[], filters: DiscoverFilters): DealCandidate[] {
  const requestedGenres = (filters.genres ?? []).map(normalizeFacet);
  const requestedPlatforms = (filters.platforms ?? []).map(normalizeFacet);

  return [...deals]
    .filter((deal) => !isJunkCandidate(deal))
    .filter((deal) => {
      if (typeof filters.budget === "number" && deal.price.amount > filters.budget) {
        return false;
      }

      if (
        requestedGenres.length > 0
      ) {
        if (deal.genres.length > 0) {
          if (!deal.genres.map(normalizeFacet).some((genre) => requestedGenres.includes(genre))) {
            return false;
          }
        } else if (deal.metadataStatus !== "unavailable") {
          return false;
        }
      }

      if (
        requestedPlatforms.length > 0
      ) {
        if (deal.platforms.length > 0) {
          if (
            !deal.platforms
              .map(normalizeFacet)
              .some((platform) => requestedPlatforms.includes(platform))
          ) {
            return false;
          }
        } else if (deal.metadataStatus !== "unavailable") {
          return false;
        }
      }

      if (typeof filters.multiplayer === "boolean" && deal.multiplayer !== filters.multiplayer) {
        return false;
      }

      return true;
    })
    .sort((left, right) => compareDeals(left, right, filters.sort ?? "best-value"));
}

export function filterJunkCandidates(deals: DealCandidate[]): DealCandidate[] {
  return deals.filter((deal) => !isJunkCandidate(deal));
}

function compareDeals(
  left: DealCandidate,
  right: DealCandidate,
  sort: NonNullable<DiscoverFilters["sort"]>
): number {
  switch (sort) {
    case "biggest-discount":
      return right.cut - left.cut || left.price.amount - right.price.amount;
    case "lowest-price":
      return left.price.amount - right.price.amount || right.cut - left.cut;
    case "highest-rating":
      return getRating(right) - getRating(left) || right.cut - left.cut;
    case "best-value":
    default:
      return getValueScore(right) - getValueScore(left) || left.price.amount - right.price.amount;
  }
}

function getValueScore(deal: DealCandidate): number {
  const userRating = Math.max(0, Math.min(100, (deal.rating ?? 0) * 20));
  const criticRating = Math.max(0, Math.min(100, deal.metacritic ?? 0));
  const discountScore = Math.min(75, deal.cut) * 0.35;
  const historyScore = getHistoryScore(deal);
  const multiplayerBonus = deal.multiplayer ? 3 : 0;
  const steamDeckBonus = getSteamDeckScore(deal.steamDeckCompatibility?.status);
  const metadataPenalty =
    deal.metadataStatus === "missing" ? 18 : deal.metadataStatus === "unavailable" ? 6 : 0;

  return (
    userRating * 0.55 +
    criticRating * 0.85 +
    discountScore +
    historyScore +
    multiplayerBonus -
    steamDeckBonus +
    steamDeckBonus * 2 -
    getTitlePenalty(deal.title) -
    metadataPenalty
  );
}

function getRating(deal: DealCandidate): number {
  const storeRating = (deal.rating ?? 0) * 20;
  return Math.max(storeRating, deal.metacritic ?? 0);
}

function normalizeFacet(value: string): string {
  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case "steam":
      return "pc";
    case "steamdeck":
    case "steam deck":
      return "pc";
    default:
      return normalized;
  }
}

function getHistoryScore(deal: DealCandidate): number {
  if (!deal.historyLow || deal.historyLow.amount <= 0 || deal.price.amount <= 0) {
    return -3;
  }

  if (deal.price.amount <= deal.historyLow.amount) {
    return 10;
  }

  const ratio = deal.price.amount / deal.historyLow.amount;

  if (ratio <= 1.1) {
    return 8;
  }

  if (ratio <= 1.25) {
    return 5;
  }

  if (ratio <= 1.5) {
    return 2;
  }

  return 0;
}

function getTitlePenalty(title: string): number {
  if (isExcludedTitle(title)) {
    return 30;
  }

  return /\bpack\b|\bdemo\b/i.test(title) ? 14 : 0;
}

function getSteamDeckScore(status?: SteamDeckCompatibility["status"]): number {
  switch (status) {
    case "verified":
      return 16;
    case "playable":
      return 8;
    case "unsupported":
      return -18;
    case "unknown":
      return 0;
    default:
      return 0;
  }
}

function isJunkCandidate(deal: DealCandidate): boolean {
  if (isExcludedTitle(deal.title)) {
    return true;
  }

  return false;
}

function isExcludedTitle(title: string): boolean {
  return EXCLUDED_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}
