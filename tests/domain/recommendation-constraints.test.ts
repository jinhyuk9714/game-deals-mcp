import { describe, expect, it } from "vitest";

import { parseRecommendationConstraints } from "../../src/domain/recommendation-constraints.js";

describe("parseRecommendationConstraints", () => {
  it("parses card exclusions as a hard avoid", () => {
    const result = parseRecommendationConstraints("카드 말고 액션 로그라이트");

    expect(result.excludeGenres).toContain("card/deckbuilder");
    expect(result.deckPreference).toBe("avoid");
  });

  it("parses racing and sports exclusions for co-op prompts", () => {
    const result = parseRecommendationConstraints("레이싱이나 스포츠는 말고 친구랑 같이 할 게임");

    expect(result.excludeGenres).toEqual(
      expect.arrayContaining(["racing", "sports"])
    );
    expect(result.coopMode).toContain("coop");
  });

  it("parses complex-strategy avoidance without losing tactics intent", () => {
    const result = parseRecommendationConstraints("복잡한 전략은 말고 검증된 전술 게임");

    expect(result.avoidComplexity).toContain("complex-strategy");
    expect(result.strategyPreference).toBe("required");
    expect(result.qualityIntent).toContain("review-backed");
  });

  it("parses non-competitive co-op requests", () => {
    const result = parseRecommendationConstraints("경쟁 말고 친구랑 가볍게 협동");

    expect(result.excludeGenres).toContain("pvp");
    expect(result.coopMode).toEqual(
      expect.arrayContaining(["coop", "non-competitive"])
    );
    expect(result.preferSession).toContain("short");
  });

  it("treats party shorthand and hangout language as party-friendly co-op signals", () => {
    const result = parseRecommendationConstraints("파티용인데 레이싱은 말고 웃긴 게임");
    const hangout = parseRecommendationConstraints("friends hangout game, not PvP");

    expect(result.coopMode).toContain("party");
    expect(result.excludeGenres).toContain("racing");
    expect(hangout.coopMode).toEqual(expect.arrayContaining(["party", "non-competitive"]));
    expect(hangout.excludeGenres).toContain("pvp");
  });

  it("parses newer social phrasing into reusable party and non-competitive constraints", () => {
    const nonSweaty = parseRecommendationConstraints("non-sweaty multiplayer sale for PC");
    const gameNight = parseRecommendationConstraints("game night bargain for friends");
    const chill = parseRecommendationConstraints("shared-screen chill co-op discount");
    const gathering = parseRecommendationConstraints("친구들 모였을 때 바로 켜기 좋은 할인 게임");

    expect(nonSweaty.coopMode).toContain("non-competitive");
    expect(nonSweaty.excludeGenres).toContain("pvp");
    expect(gameNight.coopMode).toEqual(expect.arrayContaining(["coop", "party"]));
    expect(chill.coopMode).toEqual(expect.arrayContaining(["coop", "party"]));
    expect(gathering.coopMode).toEqual(expect.arrayContaining(["coop", "party"]));
    expect(gathering.preferSession).toContain("short");
  });

  it("parses review-backed and not-filler quality requests", () => {
    const result = parseRecommendationConstraints("리뷰 좋고 filler 아닌 짧은 카드게임");

    expect(result.qualityIntent).toEqual(
      expect.arrayContaining(["review-backed", "not-filler"])
    );
    expect(result.deckPreference).toBe("required");
    expect(result.preferSession).toContain("short");
  });

  it("treats filler도 말고 phrasing as a not-filler quality constraint", () => {
    const result = parseRecommendationConstraints("카드 말고 액션 로그라이트, filler도 말고");

    expect(result.qualityIntent).toContain("not-filler");
  });

  it("parses natural reading-heavy avoidance variants", () => {
    const result = parseRecommendationConstraints("리뷰 좋은 전략 게임인데 읽을 거 너무 많은 건 말고");

    expect(result.avoidComplexity).toContain("reading-heavy");
    expect(result.qualityIntent).toContain("review-backed");
    expect(result.strategyPreference).toBe("required");
  });

  it("keeps strategy intent when only grand strategy is excluded", () => {
    const result = parseRecommendationConstraints("전략은 좋은데 grand strategy 말고 할인 중인 것");

    expect(result.strategyPreference).toBe("required");
    expect(result.excludeGenres).not.toContain("strategy");
    expect(result.avoidComplexity).toContain("complex-strategy");
  });

  it("treats buildcraft and systems-heavy hybrid phrasing as actionable constraints", () => {
    const buildcraft = parseRecommendationConstraints("arcade action plus buildcraft hybrid deal");
    const systems = parseRecommendationConstraints("systems-heavy but not oppressive hybrid bargain");

    expect(buildcraft.deckPreference).toBe("required");
    expect(systems.strategyPreference).toBe("required");
    expect(systems.avoidComplexity).toContain("complex-strategy");
  });

  it.each([
    "fast roguelite, not turn-based",
    "turn-based 말고 빠른 로그라이트",
    "strategy 느낌은 말고 손맛 좋은 로그라이트"
  ])("captures gameplay exclusions and action bias for %s", (preferences) => {
    const result = parseRecommendationConstraints(preferences);

    expect(result.excludeGameplay).toContain("turn-based");
    expect(result.actionBias).toBe(true);
  });

  it.each([
    "카드 말고 액션 로그라이트",
    "덱빌딩은 빼고 손맛 좋은 로그라이크",
    "레이싱이나 스포츠는 말고 친구랑 같이 할 게임",
    "pvp 말고 친구들이랑 떠들면서 할 게임",
    "복잡한 전략은 말고 검증된 전술 게임",
    "읽을 거 많은 건 말고 전술 위주 전략 게임",
    "리뷰 좋은 것만 있는 짧은 카드게임",
    "filler 아닌 덱빌딩 로그라이트",
    "핸드헬드에서 글자 너무 많은 건 말고 할 게임",
    "스팀덱에서 짧게 할 로그라이트",
    "친구랑 같이 경쟁 말고 가볍게 할 게임",
    "파티용인데 레이싱은 말고 웃긴 게임",
    "well-reviewed tactics game, not grand strategy",
    "short session card battler, not horror",
    "co-op game, not PvP, not racing",
    "popular strategy game without heavy reading",
    "action roguelite, not card stuff",
    "deckbuilder ok, but not filler",
    "턴제 전술인데 너무 복잡한 건 말고",
    "친구 둘이서 할 게임인데 스포츠는 말고"
  ])("captures at least one actionable constraint for %s", (preferences) => {
    const result = parseRecommendationConstraints(preferences);

    expect(
        result.excludeGenres.length +
        result.excludeGameplay.length +
        result.avoidComplexity.length +
        result.preferSession.length +
        result.coopMode.length +
        result.qualityIntent.length
    ).toBeGreaterThan(0);
  });
});
