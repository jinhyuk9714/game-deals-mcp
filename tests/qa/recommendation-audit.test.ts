import { existsSync, readFileSync, rmSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_RECOMMENDATION_AUDIT_CONCURRENCY,
  DEFAULT_RECOMMENDATION_AUDIT_OUTPUT,
  DEFAULT_RECOMMENDATION_AUDIT_TIMEOUT_MS,
  RECOMMENDATION_AUDIT_CASES,
  isRecommendationAuditFlagged,
  summarizeRecommendationAuditResults,
  runRecommendationAudit,
  type RecommendationAuditCase,
  type RecommendationAuditRun,
  type RecommendationAuditService
} from "../../src/qa/recommendation-audit.js";
import {
  parseArgs,
  runLocalRecommendationAuditCli
} from "../../scripts/run-local-recommend-audit.js";

describe("local recommendation audit fixtures", () => {
  it("keeps the 50 recommend prompts grouped into five stable buckets", () => {
    expect(RECOMMENDATION_AUDIT_CASES).toHaveLength(50);
    expect(new Set(RECOMMENDATION_AUDIT_CASES.map((testCase) => testCase.index)).size).toBe(50);
    expect(
      new Set(RECOMMENDATION_AUDIT_CASES.map((testCase) => testCase.preferences)).size
    ).toBe(50);

    const counts = RECOMMENDATION_AUDIT_CASES.reduce<Record<string, number>>((acc, testCase) => {
      acc[testCase.group] = (acc[testCase.group] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts).toEqual({
      "steam-deck": 10,
      "deckbuilding-short": 10,
      "strategy-rating": 10,
      multiplayer: 10,
      "action-roguelite": 10
    });
  });
});

describe("local recommendation audit flagging", () => {
  it("classifies representative top matches by group intent", () => {
    expect(
      isRecommendationAuditFlagged("multiplayer", {
        title: "Party Brawler Heroes",
        multiplayer: true,
        genres: ["Action", "Casual", "Party"]
      })
    ).toBe(false);

    expect(
      isRecommendationAuditFlagged("deckbuilding-short", {
        title: "Card Deckbuilder Expedition",
        genres: ["Strategy", "Card", "Deckbuilder"]
      })
    ).toBe(false);

    expect(
      isRecommendationAuditFlagged("strategy-rating", {
        title: "Tactics Breakthrough",
        genres: ["Strategy", "Tactics"],
        rating: 4.6,
        metacritic: 74
      })
    ).toBe(false);

    expect(
      isRecommendationAuditFlagged("action-roguelite", {
        title: "BALL x PIT",
        genres: ["Action", "Roguelike"]
      })
    ).toBe(false);

    expect(
      isRecommendationAuditFlagged("steam-deck", {
        title: "Unknown Deck Strategy",
        genres: ["Strategy"],
        steamDeckStatus: "unknown"
      })
    ).toBe(true);

    expect(
      isRecommendationAuditFlagged("steam-deck", {
        title: "Unsupported Deck Game",
        genres: ["Strategy"],
        steamDeckStatus: "unsupported"
      })
    ).toBe(true);
  });
});

describe("local recommendation audit summary", () => {
  it("distinguishes policy-empty results from strict-evidence failures", () => {
    const run = summarizeRecommendationAuditResults([
      {
        index: 1,
        group: "multiplayer",
        preferences: "친구랑 같이 할 게임",
        budget: 20000,
        platforms: ["PC"],
        country: "KR",
        summary: "Party Brawler Heroes를 추천합니다.",
        warnings: [],
        matchCount: 3,
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
        group: "multiplayer",
        preferences: "친구와 같이 할 협동 게임",
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
        index: 3,
        group: "strategy-rating",
        preferences: "검증된 전술 게임",
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

    expect(run.groups.multiplayer).toEqual({
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

describe("runRecommendationAudit", () => {
  it("continues after timeout and error results", async () => {
    const cases: RecommendationAuditCase[] = [
      {
        index: 1,
        group: "multiplayer",
        preferences: "slow",
        budget: 20000,
        platforms: ["PC"],
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
        budget: 18000,
        platforms: ["PC"],
        country: "KR"
      }
    ];

    const service: RecommendationAuditService = {
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

    const run = await runRecommendationAudit(service, cases, {
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

  it("treats empty results with official-evidence rejection reasons as non-flagged", async () => {
    const service: RecommendationAuditService = {
      async recommendSaleGames() {
        return {
          query: {},
          country: "KR",
          matches: [],
          summary:
            "조건에 맞는 추천 할인 게임을 찾지 못했습니다. Steam Deck Verified/Playable 근거를 확인하지 못해 추천을 비웠습니다.",
          sources: ["IsThereAnyDeal", "Steam"],
          warnings: ["Steam Deck 호환성 정보를 일부 확인하지 못했습니다."],
          emptyReason: "missing-steam-deck-evidence",
          missingEvidence: ["Steam Deck verified/playable 근거"]
        };
      }
    };

    const run = await runRecommendationAudit(
      service,
      [
        {
          index: 1,
          group: "steam-deck",
          preferences: "스팀덱에서 하기 좋은 로그라이크",
          budget: 20000,
          platforms: ["Steam Deck"],
          country: "KR"
        }
      ],
      { timeoutMs: 100, concurrency: 1 }
    );

    expect(run.results[0]).toMatchObject({
      matchCount: 0,
      topTitle: null,
      emptyReason: "missing-steam-deck-evidence",
      evidenceRejected: true,
      flagged: false
    });
    expect(run.summary).toMatchObject({
      zeroMatches: 1,
      flagged: 0,
      evidenceRejected: 1,
      recoverableButMissed: 0
    });
  });
});

describe("run-local-recommend-audit CLI", () => {
  it("parses defaults and writes an artifact via a stubbed audit runner", async () => {
    expect(parseArgs([])).toEqual({
      output: path.resolve(DEFAULT_RECOMMENDATION_AUDIT_OUTPUT),
      concurrency: DEFAULT_RECOMMENDATION_AUDIT_CONCURRENCY,
      timeoutMs: DEFAULT_RECOMMENDATION_AUDIT_TIMEOUT_MS
    });

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "recommend-audit-"));
    const outputPath = path.join(tempDir, "audit.json");
    const report: RecommendationAuditRun = {
      generatedAt: "2026-03-13T00:00:00.000Z",
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
        "steam-deck": {
          uniqueTopPicks: 0,
          topCounts: [],
          flagged: 0,
          groundlessRecommendations: 0,
          recoverableButMissed: 0,
          evidenceRejected: 0,
          timeouts: 0
        },
        "deckbuilding-short": {
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
        multiplayer: {
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
        }
      },
      results: []
    };
    const logs: string[] = [];

    try {
      await runLocalRecommendationAuditCli({
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
      expect(manifest.scripts?.["qa:recommend-local"]).toBe(
        "tsx scripts/run-local-recommend-audit.ts"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
