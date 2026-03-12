import type { GameDealService } from "../domain/service.js";

export async function callDiscoverDealsTool(
  service: GameDealService,
  args: Record<string, unknown>
) {
  const input = {
    country: stringOrDefault(args.country, "KR"),
    sort: sortOrDefault(args.sort)
  } as {
    country: string;
    sort: "best-value" | "biggest-discount" | "lowest-price" | "highest-rating";
    budget?: number;
    genres?: string[];
    platforms?: string[];
    multiplayer?: boolean;
  };

  const budget = numberOrUndefined(args.budget);
  const genres = stringArrayOrUndefined(args.genres);
  const platforms = stringArrayOrUndefined(args.platforms);
  const multiplayer = booleanOrUndefined(args.multiplayer);

  if (typeof budget === "number") {
    input.budget = budget;
  }

  if (genres) {
    input.genres = genres;
  }

  if (platforms) {
    input.platforms = platforms;
  }

  if (typeof multiplayer === "boolean") {
    input.multiplayer = multiplayer;
  }

  const result = await service.discoverDeals(input);

  return wrapToolResult(result);
}

export async function callCompareGamePriceTool(
  service: GameDealService,
  args: Record<string, unknown>
) {
  const result = await service.compareGamePrice({
    title: stringOrDefault(args.title, ""),
    country: stringOrDefault(args.country, "KR")
  });

  return wrapToolResult(result);
}

export async function callRecommendSaleGamesTool(
  service: GameDealService,
  args: Record<string, unknown>
) {
  const input = {
    preferences: stringOrDefault(args.preferences, ""),
    country: stringOrDefault(args.country, "KR")
  } as {
    preferences: string;
    country: string;
    budget?: number;
    platforms?: string[];
    excludeGenres?: string[];
  };

  const budget = numberOrUndefined(args.budget);
  const platforms = stringArrayOrUndefined(args.platforms);
  const excludeGenres = stringArrayOrUndefined(args.excludeGenres);

  if (typeof budget === "number") {
    input.budget = budget;
  }

  if (platforms) {
    input.platforms = platforms;
  }

  if (excludeGenres) {
    input.excludeGenres = excludeGenres;
  }

  const result = await service.recommendSaleGames(input);

  return wrapToolResult(result);
}

export async function callExplainDealValueTool(
  service: GameDealService,
  args: Record<string, unknown>
) {
  const result = await service.explainDealValue({
    title: stringOrDefault(args.title, ""),
    country: stringOrDefault(args.country, "KR")
  });

  return wrapToolResult(result);
}

function wrapToolResult(result: Awaited<ReturnType<GameDealService["discoverDeals"]>>) {
  return {
    content: [{ type: "text" as const, text: result.summary }],
    structuredContent: result
  };
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function stringArrayOrUndefined(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function sortOrDefault(value: unknown):
  | "best-value"
  | "biggest-discount"
  | "lowest-price"
  | "highest-rating" {
  if (value === "savings") {
    return "biggest-discount";
  }

  if (value === "price") {
    return "lowest-price";
  }

  return value === "biggest-discount" ||
    value === "lowest-price" ||
    value === "highest-rating" ||
    value === "best-value"
    ? value
    : "best-value";
}
