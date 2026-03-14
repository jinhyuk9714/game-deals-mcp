import { existsSync, readFileSync, rmSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { RECOMMENDATION_AUDIT_CASES } from "../../src/qa/recommendation-audit.js";
import { DIVERSE_RECOMMENDATION_AUDIT_CASES } from "../../src/qa/diverse-recommendation-audit.js";
import {
  DEFAULT_ROTATING_RECOMMENDATION_AUDIT_CONCURRENCY,
  DEFAULT_ROTATING_RECOMMENDATION_AUDIT_OUTPUT,
  DEFAULT_ROTATING_RECOMMENDATION_AUDIT_TIMEOUT_MS,
  ROTATING_RECOMMENDATION_PROMPT_POOL,
  buildRotatingRecommendationAuditCases,
  defaultRotatingRecommendationAuditSeed,
  summarizeRotatingRecommendationAuditResults,
  runRotatingRecommendationAudit,
  isRotatingRecommendationAuditFlagged,
  type RotatingRecommendationAuditCase,
  type RotatingRecommendationAuditRun,
  type RotatingRecommendationAuditService
} from "../../src/qa/rotating-recommendation-audit.js";
import {
  parseArgs,
  runRotatingRecommendationAuditCli
} from "../../scripts/run-rotating-recommend-audit.js";

describe("rotating recommendation audit pool", () => {
  it("keeps 300 prompt pool entries across ten groups without overlapping fixed benchmarks", () => {
    expect(ROTATING_RECOMMENDATION_PROMPT_POOL).toHaveLength(300);
    expect(new Set(ROTATING_RECOMMENDATION_PROMPT_POOL.map((testCase) => testCase.caseId)).size).toBe(
      300
    );
    expect(
      new Set(ROTATING_RECOMMENDATION_PROMPT_POOL.map((testCase) => testCase.preferences)).size
    ).toBe(300);

    const counts = ROTATING_RECOMMENDATION_PROMPT_POOL.reduce<Record<string, number>>(
      (acc, testCase) => {
        acc[testCase.group] = (acc[testCase.group] ?? 0) + 1;
        return acc;
      },
      {}
    );

    expect(counts).toEqual({
      "steam-deck-lifestyle": 30,
      "deckbuilding-card": 30,
      "strategy-rating": 30,
      "multiplayer-social": 30,
      "action-roguelite": 30,
      "constraint-heavy": 30,
      "mixed-language": 30,
      "budget-strict": 30,
      "short-session": 30,
      "genre-hybrid": 30
    });

    const fixedPrompts = new Set(
      [...RECOMMENDATION_AUDIT_CASES, ...DIVERSE_RECOMMENDATION_AUDIT_CASES].map((testCase) =>
        testCase.preferences.toLowerCase()
      )
    );
    const overlapping = ROTATING_RECOMMENDATION_PROMPT_POOL.filter((testCase) =>
      fixedPrompts.has(testCase.preferences.toLowerCase())
    );

    expect(overlapping).toEqual([]);
  });
});

describe("rotating recommendation audit sampling", () => {
  it("samples deterministic 100-case runs by seed without replacement", () => {
    const seed = "2026-03-14";
    const first = buildRotatingRecommendationAuditCases(seed);
    const second = buildRotatingRecommendationAuditCases(seed);
    const third = buildRotatingRecommendationAuditCases("2026-03-15");

    expect(first).toHaveLength(100);
    expect(second).toEqual(first);
    expect(third).not.toEqual(first);
    expect(new Set(first.map((testCase) => testCase.caseId)).size).toBe(100);

    const counts = first.reduce<Record<string, number>>((acc, testCase) => {
      acc[testCase.group] = (acc[testCase.group] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts).toEqual({
      "steam-deck-lifestyle": 10,
      "deckbuilding-card": 10,
      "strategy-rating": 10,
      "multiplayer-social": 10,
      "action-roguelite": 10,
      "constraint-heavy": 10,
      "mixed-language": 10,
      "budget-strict": 10,
      "short-session": 10,
      "genre-hybrid": 10
    });
  });

  it("uses the local YYYY-MM-DD date string as the default seed", () => {
    expect(defaultRotatingRecommendationAuditSeed(new Date("2026-03-14T09:10:11+09:00"))).toBe(
      "2026-03-14"
    );
  });
});

describe("rotating recommendation audit flagging", () => {
  it("reuses diverse benchmark semantics for representative cases", () => {
    expect(
      isRotatingRecommendationAuditFlagged(
        {
          caseId: "multiplayer-social-01",
          index: 1,
          group: "multiplayer-social",
          preferences: "friends hangout deal, not PvP",
          budget: 19000,
          platforms: ["PC"],
          country: "KR"
        },
        {
          title: "Party Brawler Heroes",
          multiplayer: true,
          genres: ["Action", "Party"]
        }
      )
    ).toBe(false);

    expect(
      isRotatingRecommendationAuditFlagged(
        {
          caseId: "strategy-rating-01",
          index: 2,
          group: "strategy-rating",
          preferences: "well-reviewed tactics discount",
          budget: 25000,
          platforms: ["PC"],
          country: "KR"
        },
        {
          title: "Junk Bundle",
          multiplayer: false,
          genres: ["Adventure"]
        }
      )
    ).toBe(true);
  });
});

describe("rotating recommendation audit summary", () => {
  it("aggregates seeded results and keeps case ids", () => {
    const run = summarizeRotatingRecommendationAuditResults("2026-03-14", [
      {
        caseId: "multiplayer-social-01",
        index: 1,
        group: "multiplayer-social",
        preferences: "friends hangout deal, not PvP",
        budget: 19000,
        platforms: ["PC"],
        country: "KR",
        summary: "Party Brawler Heroes를 추천합니다.",
        warnings: [],
        matchCount: 1,
        topTitle: "Party Brawler Heroes",
        topMatch: {
          title: "Party Brawler Heroes",
          multiplayer: true,
          genres: ["Action", "Party"]
        },
        flagged: false,
        timeout: false
      },
      {
        caseId: "strategy-rating-01",
        index: 2,
        group: "strategy-rating",
        preferences: "well-reviewed tactics discount",
        budget: 25000,
        platforms: ["PC"],
        country: "KR",
        summary: "조건에 맞는 추천 할인 게임을 찾지 못했습니다.",
        warnings: [],
        matchCount: 0,
        topTitle: null,
        topMatch: null,
        flagged: true,
        timeout: true,
        error: "timeout:10"
      }
    ]);

    expect(run.seed).toBe("2026-03-14");
    expect(run.caseIds).toEqual(["multiplayer-social-01", "strategy-rating-01"]);
    expect(run.summary).toEqual({
      total: 2,
      zeroMatches: 1,
      flagged: 1,
      timeouts: 1,
      topCounts: [{ title: "Party Brawler Heroes", count: 1 }]
    });
  });
});

describe("runRotatingRecommendationAudit", () => {
  it("keeps running after timeout and upstream errors", async () => {
    const cases: RotatingRecommendationAuditCase[] = [
      {
        caseId: "steam-deck-lifestyle-01",
        index: 1,
        group: "steam-deck-lifestyle",
        preferences: "slow",
        budget: 22000,
        platforms: ["Steam Deck"],
        country: "KR"
      },
      {
        caseId: "strategy-rating-01",
        index: 2,
        group: "strategy-rating",
        preferences: "boom",
        budget: 25000,
        platforms: ["PC"],
        country: "KR"
      },
      {
        caseId: "action-roguelite-01",
        index: 3,
        group: "action-roguelite",
        preferences: "ok",
        budget: 19000,
        platforms: ["PC"],
        country: "KR"
      }
    ];

    const service: RotatingRecommendationAuditService = {
      async recommendSaleGames(args) {
        if (args.preferences === "slow") {
          return await new Promise(() => undefined);
        }

        if (args.preferences === "boom") {
          throw new Error("upstream exploded");
        }

        return {
          query: {},
          country: "KR",
          matches: [
            {
              id: "1",
              title: "BALL x PIT",
              price: { amount: 10000, currency: "KRW" },
              regular: { amount: 20000, currency: "KRW" },
              cut: 50,
              genres: ["Action", "Roguelike"],
              platforms: ["PC"],
              multiplayer: false,
              rating: 4.1,
              metacritic: 80,
              metadataStatus: "rawg"
            }
          ],
          summary: "BALL x PIT를 추천합니다.",
          sources: ["IsThereAnyDeal", "RAWG"],
          warnings: []
        };
      }
    };

    const run = await runRotatingRecommendationAudit(service, {
      seed: "2026-03-14",
      cases,
      timeoutMs: 10,
      concurrency: 2
    });

    expect(run.seed).toBe("2026-03-14");
    expect(run.caseIds).toEqual(cases.map((testCase) => testCase.caseId));
    expect(run.results.find((result) => result.preferences === "slow")).toMatchObject({
      timeout: true,
      flagged: true,
      topTitle: null
    });
    expect(run.results.find((result) => result.preferences === "boom")).toMatchObject({
      timeout: false,
      flagged: true,
      error: "upstream exploded"
    });
    expect(run.results.find((result) => result.preferences === "ok")).toMatchObject({
      timeout: false,
      flagged: false,
      topTitle: "BALL x PIT"
    });
  });
});

describe("run-rotating-recommend-audit CLI", () => {
  it("parses seed-aware defaults and writes an artifact via a stubbed runner", async () => {
    const now = new Date("2026-03-14T09:10:11+09:00");
    expect(parseArgs([], process.cwd(), now)).toEqual({
      output: path.resolve(DEFAULT_ROTATING_RECOMMENDATION_AUDIT_OUTPUT),
      concurrency: DEFAULT_ROTATING_RECOMMENDATION_AUDIT_CONCURRENCY,
      timeoutMs: DEFAULT_ROTATING_RECOMMENDATION_AUDIT_TIMEOUT_MS,
      seed: "2026-03-14"
    });

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "rotating-recommend-audit-"));
    const outputPath = path.join(tempDir, "audit.json");
    const report: RotatingRecommendationAuditRun = {
      seed: "2026-03-14",
      caseIds: ["multiplayer-social-01"],
      generatedAt: "2026-03-14T00:00:00.000Z",
      summary: {
        total: 1,
        zeroMatches: 0,
        flagged: 0,
        timeouts: 0,
        topCounts: [{ title: "Party Brawler Heroes", count: 1 }]
      },
      groups: {
        "steam-deck-lifestyle": { uniqueTopPicks: 0, topCounts: [], flagged: 0, timeouts: 0 },
        "deckbuilding-card": { uniqueTopPicks: 0, topCounts: [], flagged: 0, timeouts: 0 },
        "strategy-rating": { uniqueTopPicks: 0, topCounts: [], flagged: 0, timeouts: 0 },
        "multiplayer-social": {
          uniqueTopPicks: 1,
          topCounts: [{ title: "Party Brawler Heroes", count: 1 }],
          flagged: 0,
          timeouts: 0
        },
        "action-roguelite": { uniqueTopPicks: 0, topCounts: [], flagged: 0, timeouts: 0 },
        "constraint-heavy": { uniqueTopPicks: 0, topCounts: [], flagged: 0, timeouts: 0 },
        "mixed-language": { uniqueTopPicks: 0, topCounts: [], flagged: 0, timeouts: 0 },
        "budget-strict": { uniqueTopPicks: 0, topCounts: [], flagged: 0, timeouts: 0 },
        "short-session": { uniqueTopPicks: 0, topCounts: [], flagged: 0, timeouts: 0 },
        "genre-hybrid": { uniqueTopPicks: 0, topCounts: [], flagged: 0, timeouts: 0 }
      },
      results: []
    };
    const logs: string[] = [];

    try {
      await runRotatingRecommendationAuditCli({
        argv: [
          "--output",
          outputPath,
          "--concurrency",
          "2",
          "--timeout-ms",
          "3000",
          "--seed",
          "2026-03-14"
        ],
        cwd: tempDir,
        env: {},
        now,
        runAudit: async () => report,
        log: (line) => logs.push(line)
      });

      expect(existsSync(outputPath)).toBe(true);
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual(report);
      expect(logs).toHaveLength(1);
      expect(JSON.parse(logs[0]!)).toEqual({
        output: outputPath,
        concurrency: 2,
        timeoutMs: 3000,
        seed: "2026-03-14",
        summary: report.summary
      });

      const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
        scripts?: Record<string, string>;
      };
      expect(manifest.scripts?.["qa:recommend-rotating"]).toBe(
        "tsx scripts/run-rotating-recommend-audit.ts"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
