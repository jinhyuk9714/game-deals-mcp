import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_CONCURRENCY,
  DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_OUTPUT,
  DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_TIMEOUT_MS,
  DETERMINISTIC_RECOMMENDATION_AUDIT_CASES,
  runDeterministicRecommendationAudit,
  summarizeDeterministicRecommendationAuditResults,
  type DeterministicRecommendationAuditCase,
  type DeterministicRecommendationAuditRun
} from "../../src/qa/deterministic-recommendation-audit.js";
import {
  parseArgs,
  runDeterministicRecommendationAuditCli
} from "../../scripts/run-deterministic-recommend-audit.js";

describe("deterministic recommendation audit fixtures", () => {
  it("keeps 35 provider-backed cases across five stable groups", () => {
    expect(DETERMINISTIC_RECOMMENDATION_AUDIT_CASES).toHaveLength(35);
    expect(new Set(DETERMINISTIC_RECOMMENDATION_AUDIT_CASES.map((testCase) => testCase.caseId)).size).toBe(
      35
    );

    const counts = DETERMINISTIC_RECOMMENDATION_AUDIT_CASES.reduce<Record<string, number>>(
      (acc, testCase) => {
        acc[testCase.group] = (acc[testCase.group] ?? 0) + 1;
        return acc;
      },
      {}
    );

    expect(counts).toEqual({
      "local-guardrail": 7,
      "provider-outage": 7,
      "steam-deck-overlay": 7,
      "social-tiering": 7,
      "junk-suppression": 7
    });

    for (const testCase of DETERMINISTIC_RECOMMENDATION_AUDIT_CASES) {
      expect(testCase.preferences.length).toBeGreaterThan(0);
      expect(testCase.providers.findDeals.length).toBeGreaterThan(0);
      expect(testCase.expectation).toBeTruthy();
    }

    const socialCase = DETERMINISTIC_RECOMMENDATION_AUDIT_CASES.find(
      (testCase) => testCase.caseId === "social-generic-coop-rejects-racket-nx"
    );
    expect(socialCase?.expectation.forbiddenTopTitles).toContain("Racket: Nx");

    const outageCase = DETERMINISTIC_RECOMMENDATION_AUDIT_CASES.find(
      (testCase) => testCase.caseId === "outage-rawg-timeout-social-rescue"
    );
    expect(outageCase?.expectation.requiredWarnings).toContain("RAWG timeout");

    const steamDeckCase = DETERMINISTIC_RECOMMENDATION_AUDIT_CASES.find(
      (testCase) => testCase.caseId === "steam-deck-unknown-allowed-after-strict-zero"
    );
    expect(steamDeckCase?.expectation.forbiddenTopSignals).toContain("unsupported");
  });
});

describe("summarizeDeterministicRecommendationAuditResults", () => {
  it("aggregates top-pick concentration and flagged counts", () => {
    const run = summarizeDeterministicRecommendationAuditResults([
      {
        index: 1,
        caseId: "social-teamplay-rescue",
        group: "social-tiering",
        preferences: "teamplay 할인작인데 경쟁 냄새 적은 것",
        budget: 20_000,
        platforms: ["PC"],
        country: "KR",
        summary: "Orbital Teamplay Co-op를 추천합니다.",
        warnings: [],
        matchCount: 1,
        topTitle: "Orbital Teamplay Co-op",
        topMatch: {
          title: "Orbital Teamplay Co-op",
          multiplayer: true,
          genres: ["Action", "Casual"]
        },
        flagged: false,
        timeout: false
      },
      {
        index: 2,
        caseId: "junk-deponia",
        group: "junk-suppression",
        preferences: "party-friendly co-op on sale",
        budget: 20_000,
        platforms: ["PC"],
        country: "KR",
        summary: "",
        warnings: [],
        matchCount: 0,
        topTitle: null,
        topMatch: null,
        flagged: true,
        timeout: true,
        error: "timeout:10"
      }
    ]);

    expect(run.summary).toEqual({
      total: 2,
      zeroMatches: 1,
      flagged: 1,
      timeouts: 1,
      topCounts: [{ title: "Orbital Teamplay Co-op", count: 1 }]
    });

    expect(run.groups["social-tiering"]).toEqual({
      uniqueTopPicks: 1,
      topCounts: [{ title: "Orbital Teamplay Co-op", count: 1 }],
      flagged: 0,
      timeouts: 0
    });
  });
});

describe("runDeterministicRecommendationAudit", () => {
  it("uses provider fixtures, expectation signals, and produces deterministic results", async () => {
    const cases: DeterministicRecommendationAuditCase[] = [
      {
        index: 1,
        caseId: "steam-deck-overlay-pass",
        group: "steam-deck-overlay",
        preferences: "스팀덱에서 평가 좋은 전략 게임",
        budget: 20_000,
        platforms: ["Steam Deck"],
        country: "KR",
        providers: {
          findDeals: [
            {
              match: { genres: ["Strategy"], platforms: ["Steam Deck"] },
              result: [
                {
                  id: "portable-tactics-complete",
                  title: "Portable Tactics Complete",
                  price: { amount: 14_900, currency: "KRW" },
                  regular: { amount: 29_800, currency: "KRW" },
                  cut: 50,
                  genres: [],
                  platforms: [],
                  multiplayer: false,
                  metadataStatus: "missing",
                  steamDeckCompatibility: {
                    status: "verified",
                    details: [],
                    source: "steam"
                  }
                }
              ]
            }
          ],
          enrichDeals: [
            {
              matchTitles: ["Portable Tactics Complete"],
              result: {
                deals: [
                  {
                    id: "portable-tactics-complete",
                    title: "Portable Tactics Complete",
                    price: { amount: 14_900, currency: "KRW" },
                    regular: { amount: 29_800, currency: "KRW" },
                    cut: 50,
                    genres: [],
                    platforms: [],
                    multiplayer: false,
                    metadataStatus: "missing",
                    steamDeckCompatibility: {
                      status: "verified",
                      details: [],
                      source: "steam"
                    }
                  }
                ],
                warnings: [
                  "일부 메타데이터를 생략했습니다.",
                  "Steam Deck 호환성 정보를 확인하지 못했습니다."
                ]
              }
            }
          ],
          discoverTitles: [
            {
              match: { genres: ["strategy"] },
              result: [
                {
                  title: "Portable Tactics",
                  genres: ["Strategy", "Tactics"],
                  platforms: ["PC"],
                  tags: ["turn-based"],
                  rating: 4.4,
                  metacritic: 83,
                  multiplayer: false
                }
              ]
            }
          ]
        },
        expectation: {
          expectMatchCount: 1,
          maxMatchCount: 1,
          expectedTopTitle: "Portable Tactics Complete",
          requiredWarnings: ["일부 메타데이터를 생략했습니다."],
          expectedTopGenres: ["Strategy", "Tactics"],
          requiredTopSignals: ["strategy", "tactics", "verified"],
          forbiddenTopSignals: ["unsupported"]
        }
      },
      {
        index: 2,
        caseId: "junk-deponia-reject",
        group: "junk-suppression",
        preferences: "party-friendly co-op on sale",
        budget: 20_000,
        platforms: ["PC"],
        country: "KR",
        providers: {
          findDeals: [
            {
              match: { multiplayer: true, platforms: ["PC"] },
              result: [
                {
                  id: "deponia",
                  title: "Deponia",
                  price: { amount: 9_900, currency: "KRW" },
                  regular: { amount: 19_800, currency: "KRW" },
                  cut: 50,
                  genres: ["Indie", "Adventure", "Puzzle"],
                  platforms: ["PC"],
                  multiplayer: false,
                  metadataStatus: "missing"
                }
              ]
            }
          ],
          enrichDeals: []
        },
        expectation: {
          expectMatchCount: 0,
          forbiddenTopTitles: ["Deponia"]
        }
      }
    ];

    const first = await runDeterministicRecommendationAudit(cases, {
      concurrency: 2,
      timeoutMs: 100,
      now: new Date("2026-03-14T00:00:00.000Z")
    });
    const second = await runDeterministicRecommendationAudit(cases, {
      concurrency: 2,
      timeoutMs: 100,
      now: new Date("2026-03-14T00:00:00.000Z")
    });

    expect(first).toEqual(second);
    expect(first.results[0]).toMatchObject({
      flagged: false,
      topTitle: "Portable Tactics Complete"
    });
    expect(first.results[1]).toMatchObject({
      flagged: false,
      topTitle: null,
      matchCount: 0
    });
  });
});

describe("run-deterministic-recommend-audit CLI", () => {
  it("parses defaults and writes an artifact via a stubbed runner", async () => {
    expect(parseArgs([])).toEqual({
      output: path.resolve(DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_OUTPUT),
      concurrency: DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_CONCURRENCY,
      timeoutMs: DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_TIMEOUT_MS
    });

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "deterministic-recommend-audit-"));
    const outputPath = path.join(tempDir, "audit.json");
    const report: DeterministicRecommendationAuditRun = {
      generatedAt: "2026-03-14T00:00:00.000Z",
      summary: {
        total: 1,
        zeroMatches: 0,
        flagged: 0,
        timeouts: 0,
        topCounts: [{ title: "Portable Tactics Complete", count: 1 }]
      },
      groups: {
        "local-guardrail": { uniqueTopPicks: 0, topCounts: [], flagged: 0, timeouts: 0 },
        "provider-outage": { uniqueTopPicks: 0, topCounts: [], flagged: 0, timeouts: 0 },
        "steam-deck-overlay": {
          uniqueTopPicks: 1,
          topCounts: [{ title: "Portable Tactics Complete", count: 1 }],
          flagged: 0,
          timeouts: 0
        },
        "social-tiering": { uniqueTopPicks: 0, topCounts: [], flagged: 0, timeouts: 0 },
        "junk-suppression": { uniqueTopPicks: 0, topCounts: [], flagged: 0, timeouts: 0 }
      },
      results: []
    };
    const logs: string[] = [];

    try {
      await runDeterministicRecommendationAuditCli({
        argv: ["--output", outputPath, "--concurrency", "2", "--timeout-ms", "3000"],
        cwd: tempDir,
        runAudit: async () => report,
        log: (line) => logs.push(line)
      });

      expect(existsSync(outputPath)).toBe(true);
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual(report);
      expect(JSON.parse(logs[0]!)).toEqual({
        output: outputPath,
        concurrency: 2,
        timeoutMs: 3000,
        summary: report.summary
      });

      const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
        scripts?: Record<string, string>;
      };
      expect(manifest.scripts?.["qa:recommend-deterministic"]).toBe(
        "tsx scripts/run-deterministic-recommend-audit.ts"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
