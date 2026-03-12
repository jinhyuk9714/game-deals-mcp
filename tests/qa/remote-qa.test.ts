import { describe, expect, it } from "vitest";

import { QA_CASES, VARIANT_QA_CASES, summarizeQaResults } from "../../src/qa/remote-qa.js";

describe("remote QA helpers", () => {
  it("keeps the 20 canonical smoke prompts in the repo", () => {
    expect(QA_CASES).toHaveLength(20);
    expect(QA_CASES.filter((testCase) => testCase.category === "discover")).toHaveLength(5);
    expect(QA_CASES.filter((testCase) => testCase.category === "compare")).toHaveLength(5);
    expect(QA_CASES.filter((testCase) => testCase.category === "recommend")).toHaveLength(5);
    expect(QA_CASES.filter((testCase) => testCase.category === "explain")).toHaveLength(5);
  });

  it("keeps the 20 variant smoke prompts in the repo for broad-intent regression checks", () => {
    expect(VARIANT_QA_CASES).toHaveLength(20);
    expect(new Set(VARIANT_QA_CASES.map((testCase) => testCase.index)).size).toBe(20);
    expect(VARIANT_QA_CASES.map((testCase) => testCase.prompt)).toEqual(
      expect.arrayContaining([
        "2만5천원 밑으로 RPG 할인작 좀",
        "스팀덱에서 돌릴 수 있는 저렴한 할인겜부터 보여줘",
        "친구랑 같이 켜서 놀기 좋은 할인 게임 뭐 있어?",
        "리뷰 괜찮은 전략 세일겜, 너무 마이너한 건 말고"
      ])
    );
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
