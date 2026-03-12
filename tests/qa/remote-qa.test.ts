import { describe, expect, it } from "vitest";

import { QA_CASES, summarizeQaResults } from "../../src/qa/remote-qa.js";

describe("remote QA helpers", () => {
  it("keeps the 20 canonical smoke prompts in the repo", () => {
    expect(QA_CASES).toHaveLength(20);
    expect(QA_CASES.filter((testCase) => testCase.category === "discover")).toHaveLength(5);
    expect(QA_CASES.filter((testCase) => testCase.category === "compare")).toHaveLength(5);
    expect(QA_CASES.filter((testCase) => testCase.category === "recommend")).toHaveLength(5);
    expect(QA_CASES.filter((testCase) => testCase.category === "explain")).toHaveLength(5);
  });

  it("summarizes remote QA outcomes into the core rollout metrics", () => {
    const summary = summarizeQaResults([
      {
        index: 1,
        category: "recommend",
        prompt: "스팀덱에서 하기 좋은 할인 로그라이크 추천해줘",
        tool: "recommend_sale_games",
        arguments: { country: "KR" },
        isError: false,
        summary: "조건에 맞는 추천 할인 게임 1개를 찾았습니다.",
        warnings: ["일부 메타데이터를 생략했습니다."],
        matchCount: 1,
        topMatches: [{ title: "Broad Steam Roguelike" }]
      },
      {
        index: 2,
        category: "compare",
        prompt: "Balatro 지금 어디가 제일 싸?",
        tool: "compare_game_price",
        arguments: { country: "KR" },
        isError: true,
        summary: "가격 비교 정보를 가져오지 못했습니다.",
        warnings: [],
        matchCount: 0,
        topMatches: []
      },
      {
        index: 3,
        category: "discover",
        prompt: "2만원 이하 스팀덱용 로그라이크 할인 게임 찾아줘",
        tool: "discover_deals",
        arguments: { country: "KR" },
        isError: false,
        summary: "조건에 맞는 할인 게임을 찾지 못했습니다.",
        warnings: [
          "Too many subrequests by single Worker invocation",
          "Steam Deck 호환성 정보를 일부 확인하지 못했습니다.",
          "일부 메타데이터를 생략했습니다."
        ],
        matchCount: 0,
        topMatches: []
      }
    ]);

    expect(summary).toEqual({
      total: 3,
      transportErrors: 0,
      errorResults: 1,
      zeroMatches: 1,
      noisyWarnings: 1,
      tooManySubrequests: 1
    });
  });
});
