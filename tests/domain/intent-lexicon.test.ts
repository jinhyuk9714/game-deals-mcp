import { describe, expect, it } from "vitest";

import { parseRecommendationIntent } from "../../src/domain/intent-lexicon.js";

describe("parseRecommendationIntent", () => {
  it.each([
    "친구랑 같이 할 게임",
    "둘이서 하기 좋은 게임",
    "2인으로 즐길 게임",
    "친구 모임용으로 바로 설명 가능한 할인작",
    "파티플레이로 웃긴 게임",
    "팀플 가능한 할인 게임",
    "party game on sale",
    "파티용인데 레이싱은 말고 웃긴 게임",
    "party-friendly co-op",
    "friends hangout game, not PvP",
    "non-sweaty multiplayer sale for PC",
    "friends-first co-op bargain",
    "game night bargain for friends",
    "shared-screen party deal",
    "chill co-op discount",
    "여럿이 같이 놀기 좋은 할인 게임",
    "well-reviewed party co-op, not sports",
    "친구들 모였을 때 바로 켜기 좋은 할인 게임"
  ])("marks %s as multiplayer intent", (preferences) => {
    const result = parseRecommendationIntent(preferences);

    expect(result.multiplayer).toBe(true);
  });

  it.each([
    "핸드헬드에서 하기 좋은 로그라이크",
    "휴대용으로 가볍게 즐길 로그라이트",
    "휴대기로 할 만한 덱빌딩",
    "패드로 돌리기 편한 로그라이크"
  ])("maps %s to Steam Deck platform intent", (preferences) => {
    const result = parseRecommendationIntent(preferences);

    expect(result.platforms).toContain("Steam Deck");
  });

  it.each([
    "잠깐씩 즐길 카드게임",
    "한 판씩 돌리기 좋은 카드 배틀러",
    "손패 굴리는 게임 추천"
  ])("treats %s as deckbuilding intent", (preferences) => {
    const result = parseRecommendationIntent(preferences);

    expect(result.deckbuilding).toBe(true);
    expect(result.rawgGenres).toContain("card");
    expect(result.tags).toContain("roguelike-deckbuilder");
  });

  it("treats tactics language as strategy intent", () => {
    const result = parseRecommendationIntent("검증된 전술 게임");

    expect(result.genres).toContain("Strategy");
    expect(result.highRating).toBe(true);
  });

  it.each([
    "전투 위주 로그라이트",
    "핵앤슬래시 로그라이크",
    "슈팅 로그라이트",
    "combat-heavy roguelike",
    "슈터 로그라이트",
    "fast roguelite, not turn-based",
    "빠른 템포인데 strategy 느낌은 말고"
  ])("treats %s as action roguelite intent", (preferences) => {
    const result = parseRecommendationIntent(preferences);

    expect(result.genres).toContain("Action");
  });

  it.each([
    "잠깐씩 즐길 카드게임",
    "한 판씩 돌리기 좋은 카드 배틀러",
    "출퇴근할 때 하기 좋은 덱빌딩",
    "casual strategy hybrid game"
  ])("marks %s as short-session intent", (preferences) => {
    const result = parseRecommendationIntent(preferences);

    expect(result.shortSession).toBe(true);
  });

  it("treats buildcraft phrasing as deckbuilding intent", () => {
    const result = parseRecommendationIntent("arcade action plus buildcraft hybrid deal");

    expect(result.deckbuilding).toBe(true);
    expect(result.rawgGenres).toContain("card");
  });

  it("treats systems-heavy phrasing as strategy intent", () => {
    const result = parseRecommendationIntent("systems-heavy but not oppressive hybrid bargain");

    expect(result.genres).toContain("Strategy");
  });
});
