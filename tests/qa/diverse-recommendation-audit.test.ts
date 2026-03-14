import { existsSync, readFileSync, rmSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { RECOMMENDATION_AUDIT_CASES } from "../../src/qa/recommendation-audit.js";
import {
  DEFAULT_DIVERSE_RECOMMENDATION_AUDIT_CONCURRENCY,
  DEFAULT_DIVERSE_RECOMMENDATION_AUDIT_OUTPUT,
  DEFAULT_DIVERSE_RECOMMENDATION_AUDIT_TIMEOUT_MS,
  DIVERSE_RECOMMENDATION_AUDIT_CASES,
  isDiverseRecommendationAuditFlagged,
  summarizeDiverseRecommendationAuditResults,
  runDiverseRecommendationAudit,
  type DiverseRecommendationAuditCase,
  type DiverseRecommendationAuditRun,
  type DiverseRecommendationAuditService
} from "../../src/qa/diverse-recommendation-audit.js";
import {
  parseArgs,
  runDiverseRecommendationAuditCli
} from "../../scripts/run-diverse-recommend-audit.js";

describe("diverse recommendation audit fixtures", () => {
  it("keeps 100 prompts grouped into ten stable buckets without overlapping local 50 prompts", () => {
    expect(DIVERSE_RECOMMENDATION_AUDIT_CASES).toHaveLength(100);
    expect(new Set(DIVERSE_RECOMMENDATION_AUDIT_CASES.map((testCase) => testCase.index)).size).toBe(
      100
    );
    expect(
      new Set(DIVERSE_RECOMMENDATION_AUDIT_CASES.map((testCase) => testCase.preferences)).size
    ).toBe(100);

    const counts = DIVERSE_RECOMMENDATION_AUDIT_CASES.reduce<Record<string, number>>(
      (acc, testCase) => {
        acc[testCase.group] = (acc[testCase.group] ?? 0) + 1;
        return acc;
      },
      {}
    );

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

    const localPrompts = new Set(
      RECOMMENDATION_AUDIT_CASES.map((testCase) => testCase.preferences.toLowerCase())
    );
    const overlapping = DIVERSE_RECOMMENDATION_AUDIT_CASES.filter((testCase) =>
      localPrompts.has(testCase.preferences.toLowerCase())
    );
    expect(overlapping).toEqual([]);
  });
});

describe("diverse recommendation audit flagging", () => {
  it("classifies representative top matches by benchmark intent", () => {
    expect(
      isDiverseRecommendationAuditFlagged(
        {
          index: 1,
          group: "steam-deck-lifestyle",
          preferences: "배터리 부담 적은 Steam Deck game on sale",
          budget: 22000,
          platforms: ["Steam Deck"],
          country: "KR"
        },
        {
          title: "BALL x PIT",
          genres: ["Action", "Roguelike"],
          steamDeckStatus: "unknown"
        }
      )
    ).toBe(true);

    expect(
      isDiverseRecommendationAuditFlagged(
        {
          index: 2,
          group: "deckbuilding-card",
          preferences: "deckbuilder on sale with strong runs",
          budget: 18000,
          platforms: ["PC"],
          country: "KR"
        },
        {
          title: "Monster Train",
          genres: ["Strategy", "Card", "Deckbuilder"],
          rating: 4.4
        }
      )
    ).toBe(false);

    expect(
      isDiverseRecommendationAuditFlagged(
        {
          index: 3,
          group: "strategy-rating",
          preferences: "well-reviewed strategy game on sale",
          budget: 25000,
          platforms: ["PC"],
          country: "KR"
        },
        {
          title: "Shining Force III",
          genres: ["Strategy", "Tactics"],
          rating: 4.2,
          metacritic: 82
        }
      )
    ).toBe(false);

    expect(
      isDiverseRecommendationAuditFlagged(
        {
          index: 4,
          group: "multiplayer-social",
          preferences: "hangout game for friends, not PvP",
          budget: 20000,
          platforms: ["PC"],
          country: "KR"
        },
        {
          title: "Party Brawler Heroes",
          genres: ["Action", "Party"],
          multiplayer: true,
          rating: 4.1
        }
      )
    ).toBe(false);

    expect(
      isDiverseRecommendationAuditFlagged(
        {
          index: 5,
          group: "action-roguelite",
          preferences: "turn-based 말고 action roguelite",
          budget: 19000,
          platforms: ["PC"],
          country: "KR"
        },
        {
          title: "BALL x PIT",
          genres: ["Action", "Roguelike"],
          rating: 4.3
        }
      )
    ).toBe(false);

    expect(
      isDiverseRecommendationAuditFlagged(
        {
          index: 6,
          group: "budget-strict",
          preferences: "under 15000 KRW co-op game",
          budget: 15000,
          platforms: ["PC"],
          country: "KR"
        },
        {
          title: "Over Budget Co-op",
          genres: ["Action", "Party"],
          multiplayer: true,
          price: { amount: 18000, currency: "KRW" }
        }
      )
    ).toBe(true);

    expect(
      isDiverseRecommendationAuditFlagged(
        {
          index: 7,
          group: "constraint-heavy",
          preferences: "friends용인데 PvP 말고 sports도 말고",
          budget: 20000,
          platforms: ["PC"],
          country: "KR"
        },
        {
          title: "Competitive Sports Arena",
          genres: ["Sports", "Action"],
          multiplayer: true
        }
      )
    ).toBe(true);
  });
});

describe("diverse recommendation audit summary", () => {
  it("tracks evidence-rejected zero matches separately from strict-evidence failures", () => {
    const run = summarizeDiverseRecommendationAuditResults([
      {
        index: 1,
        group: "multiplayer-social",
        preferences: "party-friendly co-op on sale",
        budget: 20000,
        platforms: ["PC"],
        country: "KR",
        summary: "Party Brawler Heroes를 추천합니다.",
        warnings: [],
        matchCount: 2,
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
        index: 2,
        group: "multiplayer-social",
        preferences: "non-competitive multiplayer on sale",
        budget: 20000,
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
        index: 3,
        group: "strategy-rating",
        preferences: "well-reviewed strategy game on sale",
        budget: 25000,
        platforms: ["PC"],
        country: "KR",
        summary: "조건에 맞는 추천 할인 게임을 찾지 못했습니다.",
        warnings: [],
        matchCount: 0,
        topTitle: null,
        topMatch: null,
        emptyReason: "missing-review-evidence",
        missingEvidence: ["RAWG 장르·평점 근거"],
        groundlessRecommendation: false,
        recoverableButMissed: false,
        evidenceRejected: true,
        flagged: false,
        timeout: true,
        error: "timeout:50"
      }
    ]);

    expect(run.summary).toEqual({
      total: 3,
      zeroMatches: 1,
      flagged: 0,
      groundlessRecommendations: 0,
      recoverableButMissed: 0,
      evidenceRejected: 1,
      timeouts: 1,
      topCounts: [{ title: "Party Brawler Heroes", count: 2 }]
    });

    expect(run.groups["multiplayer-social"]).toEqual({
      uniqueTopPicks: 1,
      topCounts: [{ title: "Party Brawler Heroes", count: 2 }],
      flagged: 0,
      groundlessRecommendations: 0,
      recoverableButMissed: 0,
      evidenceRejected: 0,
      timeouts: 0
    });

    expect(run.groups["strategy-rating"]).toEqual({
      uniqueTopPicks: 0,
      topCounts: [],
      flagged: 0,
      groundlessRecommendations: 0,
      recoverableButMissed: 0,
      evidenceRejected: 1,
      timeouts: 1
    });
  });
});

describe("runDiverseRecommendationAudit", () => {
  it("continues after timeout and error results", async () => {
    const cases: DiverseRecommendationAuditCase[] = [
      {
        index: 1,
        group: "steam-deck-lifestyle",
        preferences: "slow",
        budget: 22000,
        platforms: ["Steam Deck"],
        country: "KR"
      },
      {
        index: 2,
        group: "strategy-rating",
        preferences: "boom",
        budget: 25000,
        platforms: ["PC"],
        country: "KR"
      },
      {
        index: 3,
        group: "action-roguelite",
        preferences: "ok",
        budget: 19000,
        platforms: ["PC"],
        country: "KR"
      }
    ];

    const service: DiverseRecommendationAuditService = {
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

    const run = await runDiverseRecommendationAudit(service, cases, {
      timeoutMs: 10,
      concurrency: 2
    });

    expect(run.results).toHaveLength(3);
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
    expect(run.summary.timeouts).toBe(1);
    expect(run.summary.flagged).toBe(2);
  });

  it("keeps evidence-rejected empty results unflagged when official proof is missing", async () => {
    const service: DiverseRecommendationAuditService = {
      async recommendSaleGames() {
        return {
          query: {},
          country: "KR",
          matches: [],
          summary:
            "조건에 맞는 추천 할인 게임을 찾지 못했습니다. RAWG 멀티플레이·co-op 메타데이터 근거를 확인하지 못해 추천을 비웠습니다.",
          sources: ["IsThereAnyDeal", "RAWG"],
          warnings: ["가격 개요 정보가 없어 제목만 확인했습니다."],
          emptyReason: "missing-social-metadata",
          missingEvidence: ["RAWG 멀티플레이/co-op 메타데이터"]
        };
      }
    };

    const run = await runDiverseRecommendationAudit(
      service,
      [
        {
          index: 1,
          group: "multiplayer-social",
          preferences: "hangout game for friends, not PvP",
          budget: 20000,
          platforms: ["PC"],
          country: "KR"
        }
      ],
      { timeoutMs: 100, concurrency: 1 }
    );

    expect(run.results[0]).toMatchObject({
      matchCount: 0,
      emptyReason: "missing-social-metadata",
      evidenceRejected: true,
      flagged: false
    });
    expect(run.summary).toMatchObject({
      zeroMatches: 1,
      flagged: 0,
      evidenceRejected: 1
    });
  });
});

describe("run-diverse-recommend-audit CLI", () => {
  it("parses defaults and writes an artifact via a stubbed audit runner", async () => {
    expect(parseArgs([])).toEqual({
      output: path.resolve(DEFAULT_DIVERSE_RECOMMENDATION_AUDIT_OUTPUT),
      concurrency: DEFAULT_DIVERSE_RECOMMENDATION_AUDIT_CONCURRENCY,
      timeoutMs: DEFAULT_DIVERSE_RECOMMENDATION_AUDIT_TIMEOUT_MS
    });

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "diverse-recommend-audit-"));
    const outputPath = path.join(tempDir, "audit.json");
    const report: DiverseRecommendationAuditRun = {
      generatedAt: "2026-03-14T00:00:00.000Z",
      summary: {
        total: 1,
        zeroMatches: 0,
        flagged: 0,
        groundlessRecommendations: 0,
        recoverableButMissed: 0,
        evidenceRejected: 0,
        timeouts: 0,
        topCounts: [{ title: "Party Brawler Heroes", count: 1 }]
      },
      groups: {
        "steam-deck-lifestyle": {
          uniqueTopPicks: 0,
          topCounts: [],
          flagged: 0,
          groundlessRecommendations: 0,
          recoverableButMissed: 0,
          evidenceRejected: 0,
          timeouts: 0
        },
        "deckbuilding-card": {
          uniqueTopPicks: 0,
          topCounts: [],
          flagged: 0,
          groundlessRecommendations: 0,
          recoverableButMissed: 0,
          evidenceRejected: 0,
          timeouts: 0
        },
        "strategy-rating": {
          uniqueTopPicks: 0,
          topCounts: [],
          flagged: 0,
          groundlessRecommendations: 0,
          recoverableButMissed: 0,
          evidenceRejected: 0,
          timeouts: 0
        },
        "multiplayer-social": {
          uniqueTopPicks: 1,
          topCounts: [{ title: "Party Brawler Heroes", count: 1 }],
          flagged: 0,
          groundlessRecommendations: 0,
          recoverableButMissed: 0,
          evidenceRejected: 0,
          timeouts: 0
        },
        "action-roguelite": {
          uniqueTopPicks: 0,
          topCounts: [],
          flagged: 0,
          groundlessRecommendations: 0,
          recoverableButMissed: 0,
          evidenceRejected: 0,
          timeouts: 0
        },
        "constraint-heavy": {
          uniqueTopPicks: 0,
          topCounts: [],
          flagged: 0,
          groundlessRecommendations: 0,
          recoverableButMissed: 0,
          evidenceRejected: 0,
          timeouts: 0
        },
        "mixed-language": {
          uniqueTopPicks: 0,
          topCounts: [],
          flagged: 0,
          groundlessRecommendations: 0,
          recoverableButMissed: 0,
          evidenceRejected: 0,
          timeouts: 0
        },
        "budget-strict": {
          uniqueTopPicks: 0,
          topCounts: [],
          flagged: 0,
          groundlessRecommendations: 0,
          recoverableButMissed: 0,
          evidenceRejected: 0,
          timeouts: 0
        },
        "short-session": {
          uniqueTopPicks: 0,
          topCounts: [],
          flagged: 0,
          groundlessRecommendations: 0,
          recoverableButMissed: 0,
          evidenceRejected: 0,
          timeouts: 0
        },
        "genre-hybrid": {
          uniqueTopPicks: 0,
          topCounts: [],
          flagged: 0,
          groundlessRecommendations: 0,
          recoverableButMissed: 0,
          evidenceRejected: 0,
          timeouts: 0
        }
      },
      results: []
    };
    const logs: string[] = [];

    try {
      await runDiverseRecommendationAuditCli({
        argv: ["--output", outputPath, "--concurrency", "2", "--timeout-ms", "3000"],
        cwd: tempDir,
        env: {},
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
        summary: report.summary
      });

      const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
        scripts?: Record<string, string>;
      };
      expect(manifest.scripts?.["qa:recommend-diverse"]).toBe(
        "tsx scripts/run-diverse-recommend-audit.ts"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
