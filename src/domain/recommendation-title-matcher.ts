export interface RecommendationTitleMatch<T extends { title: string }> {
  candidate: T;
  score: number;
  overlapCount: number;
}

const TITLE_NOISE_TOKENS = new Set([
  "the",
  "a",
  "an"
]);

export function findBestRecommendationTitleMatch<T extends { title: string }>(
  title: string,
  candidates: T[]
): RecommendationTitleMatch<T> | null {
  const sourceTokens = tokenizeRecommendationTitle(title);
  if (sourceTokens.length === 0) {
    return null;
  }

  let best: RecommendationTitleMatch<T> | null = null;

  for (const candidate of candidates) {
    const candidateTokens = tokenizeRecommendationTitle(candidate.title);
    if (candidateTokens.length === 0) {
      continue;
    }

    const overlapCount = countTokenOverlap(sourceTokens, candidateTokens);
    const score = overlapCount / Math.max(sourceTokens.length, candidateTokens.length);

    if (!passesRecommendationTitleMatchThreshold(sourceTokens, candidateTokens, overlapCount, score)) {
      continue;
    }

    if (
      !best ||
      score > best.score ||
      (score === best.score && overlapCount > best.overlapCount) ||
      (score === best.score &&
        overlapCount === best.overlapCount &&
        candidate.title.localeCompare(best.candidate.title) < 0)
    ) {
      best = {
        candidate,
        score,
        overlapCount
      };
    }
  }

  return best;
}

function tokenizeRecommendationTitle(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[™®©]/g, " ")
    .replace(/[:/\\|+_-]/g, " ")
    .replace(/[’'"]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !TITLE_NOISE_TOKENS.has(token));
}

function countTokenOverlap(left: string[], right: string[]): number {
  const rightTokens = new Set(right);
  let overlap = 0;

  for (const token of new Set(left)) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap;
}

function passesRecommendationTitleMatchThreshold(
  sourceTokens: string[],
  candidateTokens: string[],
  overlapCount: number,
  score: number
): boolean {
  if (overlapCount === 0) {
    return false;
  }

  if (sourceTokens.length === 1 && candidateTokens.length === 1) {
    return overlapCount === 1;
  }

  if (overlapCount >= 3 && score >= 0.6) {
    return true;
  }

  return overlapCount >= 2 && score >= 2 / 3;
}
