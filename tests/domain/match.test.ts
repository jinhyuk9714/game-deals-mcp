import { describe, expect, it } from "vitest";

import { findBestRawgMatch, normalizeTitle } from "../../src/domain/match.js";

describe("normalizeTitle", () => {
  it("normalizes punctuation, case, and edition suffixes", () => {
    expect(normalizeTitle("Slay the Spire: Deluxe Edition")).toBe("slay the spire");
  });
});

describe("findBestRawgMatch", () => {
  it("prefers exact normalized title matches", () => {
    const result = findBestRawgMatch(
      { title: "Hades II", released: "2024-05-06" },
      [
        { title: "Hades 2", released: "2024-05-06" },
        { title: "Hades", released: "2020-09-17" }
      ]
    );

    expect(result.candidate?.title).toBe("Hades 2");
    expect(result.score).toBe(1);
  });

  it("rejects low confidence fuzzy matches", () => {
    const result = findBestRawgMatch(
      { title: "Dave the Diver", released: "2023-06-28" },
      [{ title: "Dredge", released: "2023-03-30" }]
    );

    expect(result.candidate).toBeNull();
    expect(result.score).toBeLessThan(0.82);
  });
});
