export interface RecommendationExecutionBudget {
  remainingMs(): number;
  has(minMs: number): boolean;
  skipWithWarning(key: string): string | null;
}

interface RecommendationExecutionBudgetOptions {
  totalMs?: number | undefined;
  now?: (() => number) | undefined;
}

const DEFAULT_RECOMMENDATION_EXECUTION_BUDGET_MS = 12_000;
const BUDGET_SKIP_WARNING = "응답 시간을 맞추기 위해 일부 추천 후보 보강을 생략했습니다.";

export function createRecommendationExecutionBudget(
  options: RecommendationExecutionBudgetOptions = {}
): RecommendationExecutionBudget {
  const now = options.now ?? (() => Date.now());
  const deadlineAt = now() + normalizePositiveInt(options.totalMs, DEFAULT_RECOMMENDATION_EXECUTION_BUDGET_MS);
  const warnedKeys = new Set<string>();

  return {
    remainingMs() {
      return Math.max(0, deadlineAt - now());
    },
    has(minMs: number) {
      return deadlineAt - now() >= minMs;
    },
    skipWithWarning(key: string) {
      if (warnedKeys.has(key)) {
        return null;
      }

      warnedKeys.add(key);
      return BUDGET_SKIP_WARNING;
    }
  };
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}
