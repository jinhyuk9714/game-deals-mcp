import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("evidence-first documentation", () => {
  it("documents recommend_sale_games evidence-first response fields in README and reference docs", () => {
    const readme = readFileSync("README.md", "utf8");
    const referencePath = "docs/reference/recommend-sale-games-evidence.md";

    expect(existsSync(referencePath)).toBe(true);

    const reference = readFileSync(referencePath, "utf8");

    for (const keyword of [
      "recommend_sale_games",
      "evidence",
      "matchedSignals",
      "missingEvidence",
      "recommendationReason",
      "evidenceCompleteness",
      "emptyReason",
      "ITAD",
      "Steam",
      "RAWG"
    ]) {
      expect(readme).toContain(keyword);
      expect(reference).toContain(keyword);
    }
  });
});
