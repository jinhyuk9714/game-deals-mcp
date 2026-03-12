export interface TitleCandidate {
  title: string;
  released?: string | null | undefined;
}

const ROMAN_NUMERALS = new Map<string, string>([
  ["x", "10"],
  ["ix", "9"],
  ["viii", "8"],
  ["vii", "7"],
  ["vi", "6"],
  ["v", "5"],
  ["iv", "4"],
  ["iii", "3"],
  ["ii", "2"],
  ["i", "1"]
]);

const EDITION_SUFFIXES = [
  "game of the year edition",
  "goty edition",
  "digital deluxe edition",
  "deluxe edition",
  "ultimate edition",
  "definitive edition",
  "complete edition",
  "collector s edition",
  "collectors edition",
  "anniversary edition",
  "remastered",
  "remaster"
];

export function normalizeTitle(title: string): string {
  let normalized = title.trim().toLowerCase();

  normalized = normalized.replace(/['’]/g, "");
  normalized = normalized.replace(/[:\-_/()[\],.!?]+/g, " ");

  for (const suffix of EDITION_SUFFIXES) {
    normalized = normalized.replace(new RegExp(`\\b${suffix}$`), "");
  }

  normalized = normalized.replace(/\b([ivx]+)\b/g, (roman) => ROMAN_NUMERALS.get(roman) ?? roman);
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

export function findBestRawgMatch<T extends TitleCandidate>(
  source: TitleCandidate,
  candidates: T[]
): { candidate: T | null; score: number } {
  const sourceTitle = normalizeTitle(source.title);
  const sourceYear = getReleaseYear(source.released);

  let bestCandidate: T | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const candidateTitle = normalizeTitle(candidate.title);
    const candidateYear = getReleaseYear(candidate.released);

    if (candidateTitle === sourceTitle) {
      return { candidate, score: 1 };
    }

    const score = diceCoefficient(sourceTitle, candidateTitle);
    const isAcceptableYear =
      sourceYear === null || candidateYear === null || Math.abs(sourceYear - candidateYear) <= 1;

    if (score >= 0.82 && isAcceptableYear && score > bestScore) {
      bestCandidate = candidate;
      bestScore = score;
    }
  }

  return { candidate: bestCandidate, score: bestScore };
}

function getReleaseYear(released?: string | null): number | null {
  if (!released) {
    return null;
  }

  const year = Number.parseInt(released.slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

function diceCoefficient(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left.length === 1 || right.length === 1) {
    return 0;
  }

  const leftBigrams = buildBigrams(left);
  const rightBigrams = buildBigrams(right);
  let overlap = 0;

  for (const [bigram, count] of leftBigrams) {
    overlap += Math.min(count, rightBigrams.get(bigram) ?? 0);
  }

  return (2 * overlap) / (left.length - 1 + right.length - 1);
}

function buildBigrams(value: string): Map<string, number> {
  const map = new Map<string, number>();

  for (let index = 0; index < value.length - 1; index += 1) {
    const bigram = value.slice(index, index + 2);
    map.set(bigram, (map.get(bigram) ?? 0) + 1);
  }

  return map;
}
