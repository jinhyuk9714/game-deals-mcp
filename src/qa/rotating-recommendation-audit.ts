import type { ConfigSource } from "../config.js";
import { createDefaultService } from "../server.js";
import type { CompareResult } from "../domain/service.js";
import type { DealCandidate } from "../domain/score.js";
import {
  classifyEvidenceFirstAuditResult,
  extractRecommendationEmptyReason,
  extractRecommendationMissingEvidence
} from "./evidence-first-audit.js";
import {
  isDiverseRecommendationAuditFlagged,
  type DiverseRecommendationAuditGroup,
  type DiverseRecommendationAuditGroupSummary,
  type DiverseRecommendationAuditSummary,
  type DiverseRecommendationAuditTopCount,
  type DiverseRecommendationAuditTopMatch
} from "./diverse-recommendation-audit.js";

export type RotatingRecommendationAuditGroup = DiverseRecommendationAuditGroup;
export type RotatingRecommendationAuditTopMatch = DiverseRecommendationAuditTopMatch;
export type RotatingRecommendationAuditTopCount = DiverseRecommendationAuditTopCount;
export type RotatingRecommendationAuditSummary = DiverseRecommendationAuditSummary;
export type RotatingRecommendationAuditGroupSummary = DiverseRecommendationAuditGroupSummary;

export interface RotatingRecommendationPromptPoolCase {
  caseId: string;
  group: RotatingRecommendationAuditGroup;
  preferences: string;
  budget?: number | undefined;
  platforms?: string[] | undefined;
  country: string;
}

export interface RotatingRecommendationAuditCase extends RotatingRecommendationPromptPoolCase {
  index: number;
}

export interface RotatingRecommendationAuditResult extends RotatingRecommendationAuditCase {
  summary: string;
  warnings: string[];
  matchCount: number;
  topTitle: string | null;
  topMatch: RotatingRecommendationAuditTopMatch | null;
  emptyReason?: string | undefined;
  missingEvidence?: string[] | undefined;
  groundlessRecommendation?: boolean | undefined;
  recoverableButMissed?: boolean | undefined;
  evidenceRejected?: boolean | undefined;
  flagged: boolean;
  timeout: boolean;
  error?: string | undefined;
}

export interface RotatingRecommendationAuditRun {
  seed: string;
  caseIds: string[];
  generatedAt: string;
  summary: RotatingRecommendationAuditSummary;
  groups: Record<RotatingRecommendationAuditGroup, RotatingRecommendationAuditGroupSummary>;
  results: RotatingRecommendationAuditResult[];
}

export interface RotatingRecommendationAuditService {
  recommendSaleGames(args: {
    preferences: string;
    budget?: number;
    platforms?: string[];
    country: string;
  }): Promise<CompareResult>;
}

export interface RotatingRecommendationAuditRunOptions {
  concurrency?: number | undefined;
  timeoutMs?: number | undefined;
  seed?: string | undefined;
  cases?: RotatingRecommendationAuditCase[] | undefined;
}

export const DEFAULT_ROTATING_RECOMMENDATION_AUDIT_CONCURRENCY = 4;
export const DEFAULT_ROTATING_RECOMMENDATION_AUDIT_TIMEOUT_MS = 15_000;
export const DEFAULT_ROTATING_RECOMMENDATION_AUDIT_OUTPUT =
  "artifacts/rotating-recommend-audit.json";

const ROTATING_RECOMMENDATION_AUDIT_GROUPS: RotatingRecommendationAuditGroup[] = [
  "steam-deck-lifestyle",
  "deckbuilding-card",
  "strategy-rating",
  "multiplayer-social",
  "action-roguelite",
  "constraint-heavy",
  "mixed-language",
  "budget-strict",
  "short-session",
  "genre-hybrid"
];

export const ROTATING_RECOMMENDATION_PROMPT_POOL: RotatingRecommendationPromptPoolCase[] = [
  ...buildPoolCases(
    "steam-deck-lifestyle",
    ["Steam Deck"],
    22_000,
    [
      "침대 맡에 두고 짧게 켜기 좋은 스팀덱 할인작",
      "손목 부담 적은 handheld 세일 게임",
      "버스에서 소리 없이 해도 되는 Steam Deck 세일작",
      "휴대용으로 글씨 잘 보이는 할인 게임",
      "스팀덱에서 배터리 빨리 안 닳을 것 같은 로그라이크",
      "컨트롤러만으로 막힘 없이 하는 handheld bargain",
      "눕겜용으로 복잡하지 않은 Steam Deck deal",
      "패드 조작이 자연스러운 휴대용 액션 세일작",
      "출근길 15분씩 하기 좋은 스팀덱 게임",
      "handheld에서 튜토리얼 짧은 할인작",
      "소파에서 편하게 즐길 Steam Deck tactics sale",
      "침대 옆 충전기 꽂고 돌리기 좋은 handheld game",
      "fan noise 적을 것 같은 portable bargain",
      "휴대용에서 UI 큰 세일 게임",
      "Steam Deck로 한두 run 하기 좋은 할인작",
      "기차에서 켜기 좋은 handheld roguelite deal",
      "패드만으로 메뉴 조작 쉬운 스팀덱 세일작",
      "손에 땀 안 나게 가볍게 돌릴 휴대용 게임",
      "portable game on sale for couch sessions",
      "Steam Deck-friendly game for sleepy nights",
      "low-friction handheld sale with readable UI",
      "battery-conscious Steam Deck deal",
      "quiet handheld game for late-night play",
      "portable tactics sale with clean text",
      "snackable Steam Deck roguelite on sale",
      "controller-first handheld bargain",
      "easy-to-read portable deckbuilder discount",
      "휴대용으로 멍때리며 하기 좋은 세일 게임",
      "스팀덱으로 카페에서 잠깐 하기 좋은 할인작",
      "lightweight handheld game for commuting breaks"
    ]
  ),
  ...buildPoolCases(
    "deckbuilding-card",
    ["PC"],
    18_000,
    [
      "카드 엔진 굴리는 맛이 분명한 할인작",
      "드로우 순환이 재미있는 deckbuilder 세일",
      "덱 압축과 제거가 중요한 카드 로그라이크",
      "짧은 run 안에 콤보 보는 카드 세일작",
      "build order보다 카드 연계가 중요한 할인 게임",
      "discard 활용이 재밌는 card battler bargain",
      "패를 쥐고 계산하는 맛 좋은 deckbuilding sale",
      "roguelike run인데 카드 선택 재미가 큰 게임",
      "combo line 깔끔한 deckbuilder on discount",
      "핸드 관리가 핵심인 세일 카드게임",
      "초반 카드 업그레이드 선택이 재밌는 할인작",
      "energy curve 보는 맛 있는 deckbuilder",
      "짧게 돌려도 카드 시너지가 남는 세일 게임",
      "deck thinning 재미있는 카드 세일작",
      "손패 꼬임을 풀어가는 재미 있는 할인 게임",
      "run-based card tactics bargain",
      "덱을 가볍게 굴리기 좋은 카드 로그라이트",
      "synergy-heavy deckbuilder with short fights",
      "카드 강화 루프가 선명한 세일작",
      "battler인데 텍스트 압박 덜한 card 할인작",
      "deck engine starts fast on this discount",
      "핸드 사이즈 조절 재미가 있는 카드 세일겜",
      "로그라이크 구조에 deckbuilding이 잘 붙은 할인작",
      "패 순서 계산이 맛있는 bargain deckbuilder",
      "card combo game with brisk runs",
      "덱을 다듬는 재미로 가는 세일 카드게임",
      "짧은 세션용 deckbuilder bargain",
      "핸드 관리 위주 카드 전투 세일작",
      "late-run deck growth가 좋은 할인 게임",
      "card-driven run builder on sale"
    ]
  ),
  ...buildPoolCases(
    "strategy-rating",
    ["PC"],
    25_000,
    [
      "평이 단단한 전략 할인 게임",
      "리뷰 믿고 살 만한 전술 세일작",
      "high-rated tactics game discount",
      "검증된 strategy bargain for PC",
      "평판 좋은 turn-based tactics sale",
      "메타 점수 괜찮은 전략 세일작",
      "유명한 전략 게임 할인 중인 것",
      "review strong tactics pick on sale",
      "너무 niche하지 않은 전술 할인작",
      "popular strategy game bargain",
      "검증된 턴제 전술 세일",
      "well-liked strategy discount with good reviews",
      "평가 안정적인 tactics 할인 게임",
      "평점 높은 전략작인데 접근성 괜찮은 것",
      "리뷰 평균 높은 strategy sale",
      "critic도 유저도 반응 좋은 전술 게임",
      "mainstream tactics bargain",
      "메타 괜찮고 너무 마이너하지 않은 전략작",
      "review-backed strategy deal",
      "전술 맛 있으면서 평가도 좋은 할인작",
      "trusted tactics sale for PC",
      "high-confidence strategy bargain",
      "유저 평이 좋고 전략성 분명한 세일작",
      "well-reviewed tactics game for shorter nights",
      "critical darling strategy discount",
      "메타와 유저 평 둘 다 괜찮은 전략 세일",
      "평균 이상 평점의 turn-based strategy sale",
      "안전하게 고를 수 있는 전략 할인 게임",
      "reliable tactics bargain under budget",
      "리뷰 탄탄한 전략 PC 세일작"
    ]
  ),
  ...buildPoolCases(
    "multiplayer-social",
    ["PC"],
    20_000,
    [
      "친구들이랑 수다 떨며 하기 좋은 할인 게임",
      "co-op discount for a loud friend group",
      "party-night bargain that is not about sweaty PvP",
      "둘이서 가볍게 붙잡기 좋은 세일 협동 게임",
      "친구 모임용으로 바로 설명 가능한 할인작",
      "shared-screen vibe 나는 multiplayer bargain",
      "hangout-friendly game deal for PC",
      "racing 빼고 웃으면서 할 팀플 세일작",
      "친구 네 명이 같이 켜기 좋은 할인 게임",
      "casual co-op sale for chill nights",
      "party energy 있는 multiplayer discount",
      "협동 위주로 떠들며 하기 좋은 세일겜",
      "friends-first co-op bargain",
      "무겁지 않게 같이 놀기 좋은 할인 게임",
      "teamplay 할인작인데 경쟁 냄새 적은 것",
      "shared laughs co-op game on sale",
      "친구 둘이서 바로 시작 가능한 세일작",
      "party-friendly multiplayer bargain",
      "같이 하면서 실수해도 웃기는 할인 게임",
      "group hangout discount with light teamwork",
      "로비에서 금방 떠들기 좋은 멀티 세일작",
      "친구집에서 바로 켜기 좋은 co-op bargain",
      "non-sweaty multiplayer sale for PC",
      "casual teamplay game discount",
      "소리 지르며 웃기 좋은 협동 세일작",
      "game night bargain for friends on one budget",
      "협동 느낌 강한 파티 할인 게임",
      "easy-entry multiplayer deal for a duo",
      "친구랑 타이밍 맞추며 하기 좋은 세일겜",
      "social co-op discount with low friction"
    ]
  ),
  ...buildPoolCases(
    "action-roguelite",
    ["PC"],
    19_000,
    [
      "손이 바쁘게 움직이는 액션 로그라이트 할인작",
      "real-time combat roguelite bargain",
      "총맛 괜찮은 roguelike 세일 게임",
      "읽기보다 싸우기가 많은 로그라이트",
      "fast dodge-heavy roguelite on sale",
      "근접 전투 손맛 좋은 할인 로그라이트",
      "run마다 액션 리듬이 선명한 bargain",
      "shoot-first roguelite discount",
      "회피와 공격 템포가 빠른 세일작",
      "arcade-action rogue bargain",
      "combo-driven combat roguelite sale",
      "총질 또는 베기 맛이 좋은 할인 로그라이크",
      "빠르게 restart하고 다시 도전할 액션 할인작",
      "twitchy roguelite bargain",
      "밀고 빠지는 전투가 중심인 세일작",
      "brawler roguelite on discount",
      "읽을 건 적고 전투는 빡센 로그라이트",
      "quick reflex rogue sale",
      "총알 뿌리기 좋은 할인 로그라이트",
      "hacky slashy roguelite bargain",
      "combat loop가 빠른 세일 roguelike",
      "full-action run-based deal",
      "실시간 전투 몰입감 있는 할인 로그라이트",
      "movement-heavy roguelite sale",
      "손맛 위주 one-more-run 할인작",
      "shooter-adjacent roguelite bargain",
      "판마다 전투 리듬이 확실한 세일 게임",
      "tempo-led action rogue deal",
      "회전 빠른 전투형 로그라이크 세일작",
      "PC action roguelite bargain with punch"
    ]
  ),
  ...buildPoolCases(
    "constraint-heavy",
    ["PC"],
    20_000,
    [
      "공포는 싫고 읽는 양도 적은 할인 게임",
      "카드 느낌은 빼고 액션성은 남는 로그라이트",
      "grand strategy는 아닌데 생각할 맛 있는 세일작",
      "친구용인데 PvP랑 sports는 피하고 싶은 할인 게임",
      "review good, not horror, not racing, still under budget",
      "too text-heavy 아니면서 tactics 맛 있는 세일작",
      "스토리보다 리플레이성이 앞서는 할인 게임",
      "턴제는 아닌데 로그라이크 느낌은 나는 세일작",
      "party vibe인데 racing만 아니면 좋겠는 할인 게임",
      "handheld friendly but not spooky bargain",
      "폭력성은 괜찮지만 점프 scare 없는 할인작",
      "brain-off는 아니어도 reading-heavy는 아닌 게임",
      "deckbuilder는 아니고 전투가 빠른 세일 로그라이트",
      "competitive 말고 협동 중심 세일 게임",
      "리뷰 좋고 filler 적은 할인작인데 너무 느리진 않은 것",
      "전략은 원하는데 운영 노동이 심하진 않은 세일작",
      "without horror and without sports, recommend a bargain",
      "카드 말고 tactics, 그리고 너무 어렵지 않은 세일겜",
      "long campaign 말고 한두 판 가능한 할인 게임",
      "친구들이랑 할 건데 sweaty하지 않은 bargain",
      "niche한 건 말고 평 좋고 텍스트 적은 세일작",
      "shooty하지만 PvP는 아닌 할인 로그라이트",
      "handheld 각은 있는데 Steam Deck 전용은 아닌 bargain",
      "스토리 압박 적고 시스템 재미 위주 세일작",
      "고어는 괜찮지만 horror 연출은 없는 할인 게임",
      "리뷰 좋고 session 짧은데 sports는 아닌 게임",
      "짧게 끝내도 만족감 있는 tactics bargain",
      "party 감성인데 경쟁 스트레스는 덜한 세일작",
      "deckbuilder 제외, turn-based 제외, action 중심 bargain",
      "under budget and not filler, give me a sale pick"
    ]
  ),
  ...buildPoolCases(
    "mixed-language",
    ["PC"],
    20_000,
    [
      "review 탄탄한 tactics deal for PC",
      "friends랑 할 chill co-op bargain",
      "Steam Deck vibe 말고 desktop card roguelike sale",
      "high-rated 전략 game on discount",
      "not PvP party bargain for friends",
      "short burst용 action roguelite 세일",
      "budget 안 넘는 strategy discount",
      "card synergies 좋은 할인 game",
      "handheld-friendly 느낌의 tactics sale",
      "sports 말고 casual multiplayer bargain",
      "well-liked 덱빌딩 sale",
      "funny co-op game 할인작",
      "review 좋은 action rogue bargain",
      "under budget 전술 sale",
      "friends hangout용 party deal",
      "too text-heavy 말고 card battler 세일",
      "Steam Deck-friendly 아닌 PC shooter roguelite",
      "highly rated 전략 bargain",
      "co-op but not sweaty 세일 game",
      "메타 괜찮은 tactics discount",
      "party-friendly 할인 game for a duo",
      "review-backed deckbuilder bargain",
      "turn-based 말고 shooty rogue 세일",
      "popular strategy 할인작",
      "light handheld 느낌 나는 PC deal",
      "friends-only fun bargain, not sports",
      "good review tactics 할인 game",
      "read less fight more 로그라이트 sale",
      "카드 재미 strong한 bargain game",
      "멀티 vibe 있는 casual discount"
    ]
  ),
  ...buildVariablePoolCases("budget-strict", [
    { preferences: "7000원 안쪽에 살 수 있는 card battler", budget: 7_000, platforms: ["PC"] },
    { preferences: "under 12000 KRW tactics bargain", budget: 12_000, platforms: ["PC"] },
    { preferences: "15000원 이내 co-op discount for friends", budget: 15_000, platforms: ["PC"] },
    { preferences: "budget 9000으로 잡는 action roguelite", budget: 9_000, platforms: ["PC"] },
    { preferences: "20000 이하로 고를 well-reviewed strategy sale", budget: 20_000, platforms: ["PC"] },
    { preferences: "under 8000 handheld-feel card game", budget: 8_000, platforms: ["Steam Deck"] },
    { preferences: "만원 초반으로 살 party bargain", budget: 13_000, platforms: ["PC"] },
    { preferences: "예산 11000 안에서 찾는 짧은 세션 게임", budget: 11_000, platforms: ["PC"] },
    { preferences: "cheap deckbuilder under 14000", budget: 14_000, platforms: ["PC"] },
    { preferences: "15000원 넘기지 않는 tactics sale", budget: 15_000, platforms: ["PC"] },
    { preferences: "8500원 예산의 카드 로그라이트", budget: 8_500, platforms: ["PC"] },
    { preferences: "co-op deal below 18000 KRW", budget: 18_000, platforms: ["PC"] },
    { preferences: "budget cap 10000 for an action rogue", budget: 10_000, platforms: ["PC"] },
    { preferences: "저렴하게 살 수 있는 high-rated strategy bargain", budget: 17_000, platforms: ["PC"] },
    { preferences: "handheld-friendly 세일작 12000 이내", budget: 12_000, platforms: ["Steam Deck"] },
    { preferences: "party night discount under 14000", budget: 14_000, platforms: ["PC"] },
    { preferences: "만원 이하로 끊는 짧은 run 게임", budget: 10_000, platforms: ["PC"] },
    { preferences: "예산 16000의 card deckbuilder sale", budget: 16_000, platforms: ["PC"] },
    { preferences: "under 13000 well-reviewed tactics game", budget: 13_000, platforms: ["PC"] },
    { preferences: "cheap co-op for two below 11000", budget: 11_000, platforms: ["PC"] },
    { preferences: "budget 9500 안쪽 shooter roguelite", budget: 9_500, platforms: ["PC"] },
    { preferences: "18000원 미만 review 좋은 strategy deal", budget: 18_000, platforms: ["PC"] },
    { preferences: "9000원 이하 card-focused sale", budget: 9_000, platforms: ["PC"] },
    { preferences: "협동 게임인데 15000원까지만", budget: 15_000, platforms: ["PC"] },
    { preferences: "under 20000 Korean-budget tactics bargain", budget: 20_000, platforms: ["PC"] },
    { preferences: "cheap handheld bargain within 10000", budget: 10_000, platforms: ["Steam Deck"] },
    { preferences: "예산 빡빡한 party 할인 게임", budget: 12_000, platforms: ["PC"] },
    { preferences: "action roguelite capped at 14000 KRW", budget: 14_000, platforms: ["PC"] },
    { preferences: "strategy sale under 19000, no overspend", budget: 19_000, platforms: ["PC"] },
    { preferences: "deckbuilder bargain with a 10500 budget", budget: 10_500, platforms: ["PC"] }
  ]),
  ...buildPoolCases(
    "short-session",
    ["PC"],
    18_000,
    [
      "한 판만 하고 끄기 편한 할인 게임",
      "퇴근 직후 15분 세션용 세일작",
      "quick hit bargain for busy weekdays",
      "잠깐 켜도 손맛 남는 할인 게임",
      "짧은 집중으로 끝내기 좋은 tactics sale",
      "coffee break용 card battler discount",
      "brain-off로 20분 미만 돌릴 세일작",
      "run 하나만 해도 만족감 있는 bargain",
      "schedule 빡빡한 날 켜기 좋은 할인 게임",
      "short loop co-op deal",
      "긴 튜토리얼 없이 바로 들어가는 세일작",
      "틈날 때 한두 판 할 수 있는 할인 게임",
      "quick session tactics bargain",
      "short burst action rogue sale",
      "짧은 판수로 끊어도 아쉬움 적은 세일작",
      "20-minute ceiling bargain",
      "퇴근 버스 기다리며 한 판 할 할인 게임",
      "save point 압박 덜한 짧은 세션 세일작",
      "run length 짧은 deckbuilder bargain",
      "pause-friendly co-op discount",
      "가볍게 켜고 끄는 handheld-feel bargain",
      "minute-friendly roguelite sale",
      "session compact한 strategy discount",
      "짧게 돌려도 빌드 맛이 있는 세일작",
      "low-commitment multiplayer bargain",
      "20분 안에 기승전결 있는 할인 게임",
      "잠깐 집중하고 끝내기 좋은 세일 액션작",
      "quick deck run bargain",
      "빠른 라운드 중심 tactics sale",
      "busy-night sale pick with short loops"
    ]
  ),
  ...buildPoolCases(
    "genre-hybrid",
    ["PC"],
    22_000,
    [
      "전술과 카드가 동시에 맛있는 할인작",
      "action roguelite with deckbuilding edges",
      "strategy roguelike hybrid bargain",
      "co-op brawler인데 run structure 있는 세일작",
      "RPG-lite tactics mix on discount",
      "party-action game with roguelite progression",
      "card plus tactics sale for PC",
      "shooting and deck synergy bargain",
      "strategy-heavy rogue discount",
      "casual co-op with survival-lite systems",
      "액션성과 카드 조합이 같이 있는 세일 게임",
      "turn-based tactics with roguelite runs",
      "brawler deckbuilder bargain",
      "전략과 로그라이트가 반반 섞인 할인작",
      "card tactics hybrid with short runs",
      "action tactics bargain for experimental tastes",
      "party roguelite sale",
      "survival-ish co-op discount with lighter pressure",
      "genre-mix tactics bargain",
      "shooty deckbuilder on sale for PC",
      "arcade action plus buildcraft hybrid deal",
      "전략성 있는 협동 액션 세일작",
      "casual tactics deckbuilder bargain",
      "roguelike loop with teamplay flavor",
      "RPG tactics card mashup sale",
      "hand management plus fast combat bargain",
      "co-op roguelite brawler discount",
      "light strategy hybrid on sale",
      "systems-heavy but not oppressive hybrid bargain",
      "party-capable action strategy mix deal"
    ]
  )
];

export function defaultRotatingRecommendationAuditSeed(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildRotatingRecommendationAuditCases(
  seed = defaultRotatingRecommendationAuditSeed()
): RotatingRecommendationAuditCase[] {
  const rng = createSeededRandom(seed);
  const sampledCases = ROTATING_RECOMMENDATION_AUDIT_GROUPS.flatMap((group) =>
    pickWithoutReplacement(
      ROTATING_RECOMMENDATION_PROMPT_POOL.filter((testCase) => testCase.group === group),
      10,
      rng
    )
  );

  return sampledCases.map((testCase, index) => ({
    ...testCase,
    index: index + 1
  }));
}

export function isRotatingRecommendationAuditFlagged(
  testCase: RotatingRecommendationAuditCase,
  topMatch: RotatingRecommendationAuditTopMatch | null
): boolean {
  return isDiverseRecommendationAuditFlagged(
    {
      index: testCase.index,
      group: testCase.group,
      preferences: testCase.preferences,
      budget: testCase.budget,
      platforms: testCase.platforms,
      country: testCase.country
    },
    topMatch
  );
}

export async function runRotatingRecommendationAudit(
  service: RotatingRecommendationAuditService,
  options: RotatingRecommendationAuditRunOptions = {}
): Promise<RotatingRecommendationAuditRun> {
  const seed = options.seed ?? defaultRotatingRecommendationAuditSeed();
  const cases = options.cases ?? buildRotatingRecommendationAuditCases(seed);
  const concurrency = normalizePositiveInt(
    options.concurrency,
    DEFAULT_ROTATING_RECOMMENDATION_AUDIT_CONCURRENCY
  );
  const timeoutMs = normalizePositiveInt(
    options.timeoutMs,
    DEFAULT_ROTATING_RECOMMENDATION_AUDIT_TIMEOUT_MS
  );
  const results = new Array<RotatingRecommendationAuditResult>(cases.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(cases.length, 1)) },
    async () => {
      while (true) {
        const current = cursor;
        cursor += 1;
        if (current >= cases.length) {
          return;
        }

        results[current] = await runRotatingRecommendationAuditCase(
          service,
          cases[current]!,
          timeoutMs
        );
      }
    }
  );

  await Promise.all(workers);

  const summary = summarizeRotatingRecommendationAuditResults(seed, results);

  return {
    seed,
    caseIds: summary.caseIds,
    generatedAt: new Date().toISOString(),
    summary: summary.summary,
    groups: summary.groups,
    results
  };
}

export async function runLocalRotatingRecommendationAudit(
  env: ConfigSource = process.env,
  options: RotatingRecommendationAuditRunOptions = {}
): Promise<RotatingRecommendationAuditRun> {
  const service = createDefaultService(env);
  return runRotatingRecommendationAudit(service, options);
}

export function summarizeRotatingRecommendationAuditResults(
  seed: string,
  results: RotatingRecommendationAuditResult[]
): {
  seed: string;
  caseIds: string[];
  summary: RotatingRecommendationAuditSummary;
  groups: Record<RotatingRecommendationAuditGroup, RotatingRecommendationAuditGroupSummary>;
} {
  const topCounts = countTopTitles(results);
  const groups = Object.fromEntries(
    ROTATING_RECOMMENDATION_AUDIT_GROUPS.map((group) => {
      const groupResults = results.filter((result) => result.group === group);
      const groupTopCounts = countTopTitles(groupResults);

      return [
        group,
        {
          uniqueTopPicks: groupTopCounts.length,
          topCounts: groupTopCounts,
          flagged: groupResults.filter((result) => result.flagged).length,
          groundlessRecommendations: groupResults.filter(
            (result) => result.groundlessRecommendation
          ).length,
          recoverableButMissed: groupResults.filter(
            (result) => result.recoverableButMissed
          ).length,
          evidenceRejected: groupResults.filter((result) => result.evidenceRejected).length,
          timeouts: groupResults.filter((result) => result.timeout).length
        } satisfies RotatingRecommendationAuditGroupSummary
      ];
    })
  ) as Record<RotatingRecommendationAuditGroup, RotatingRecommendationAuditGroupSummary>;

  return {
    seed,
    caseIds: results.map((result) => result.caseId),
    summary: {
      total: results.length,
      zeroMatches: results.filter((result) => result.matchCount === 0).length,
      flagged: results.filter((result) => result.flagged).length,
      groundlessRecommendations: results.filter(
        (result) => result.groundlessRecommendation
      ).length,
      recoverableButMissed: results.filter((result) => result.recoverableButMissed).length,
      evidenceRejected: results.filter((result) => result.evidenceRejected).length,
      timeouts: results.filter((result) => result.timeout).length,
      topCounts
    },
    groups
  };
}

async function runRotatingRecommendationAuditCase(
  service: RotatingRecommendationAuditService,
  testCase: RotatingRecommendationAuditCase,
  timeoutMs: number
): Promise<RotatingRecommendationAuditResult> {
  try {
    const request: {
      preferences: string;
      budget?: number;
      platforms?: string[];
      country: string;
    } = {
      preferences: testCase.preferences,
      country: testCase.country
    };

    if (typeof testCase.budget === "number") {
      request.budget = testCase.budget;
    }

    if (testCase.platforms) {
      request.platforms = testCase.platforms;
    }

    const response = await withTimeout(service.recommendSaleGames(request), timeoutMs);
    const matches = Array.isArray(response.matches) ? response.matches : [];
    const topMatch = toAuditTopMatch(matches[0]);
    const emptyReason = extractRecommendationEmptyReason(response);
    const classification = classifyEvidenceFirstAuditResult({
      topMatch,
      invalidRecommendation: isRotatingRecommendationAuditFlagged(testCase, topMatch),
      emptyReason
    });

    return {
      ...testCase,
      summary: response.summary,
      warnings: response.warnings ?? [],
      matchCount: matches.length,
      topTitle: topMatch?.title ?? null,
      topMatch,
      emptyReason,
      missingEvidence: extractRecommendationMissingEvidence(response),
      groundlessRecommendation: classification.groundlessRecommendation,
      recoverableButMissed: classification.recoverableButMissed,
      evidenceRejected: classification.evidenceRejected,
      flagged: classification.flagged,
      timeout: false
    };
  } catch (error) {
    return {
      ...testCase,
      summary: "",
      warnings: [],
      matchCount: 0,
      topTitle: null,
      topMatch: null,
      groundlessRecommendation: false,
      recoverableButMissed: true,
      evidenceRejected: false,
      flagged: true,
      timeout: isTimeoutError(error),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function toAuditTopMatch(value: unknown): RotatingRecommendationAuditTopMatch | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const deal = value as Partial<DealCandidate>;
  if (typeof deal.title !== "string" || deal.title.length === 0) {
    return null;
  }

  return {
    title: deal.title,
    cut: typeof deal.cut === "number" ? deal.cut : undefined,
    price: deal.price,
    multiplayer: typeof deal.multiplayer === "boolean" ? deal.multiplayer : undefined,
    rating: typeof deal.rating === "number" ? deal.rating : deal.rating ?? undefined,
    metacritic:
      typeof deal.metacritic === "number" ? deal.metacritic : deal.metacritic ?? undefined,
    genres: Array.isArray(deal.genres) ? deal.genres : undefined,
    platforms: Array.isArray(deal.platforms) ? deal.platforms : undefined,
    tags: Array.isArray((deal as { tags?: unknown }).tags)
      ? (((deal as { tags?: unknown }).tags as string[]) ?? undefined)
      : undefined,
    steamDeckStatus: deal.steamDeckCompatibility?.status ?? null,
    matchedSignals: Array.isArray((deal as { matchedSignals?: unknown }).matchedSignals)
      ? (((deal as { matchedSignals?: unknown }).matchedSignals as string[]) ?? undefined)
      : undefined,
    missingEvidence: Array.isArray((deal as { missingEvidence?: unknown }).missingEvidence)
      ? (((deal as { missingEvidence?: unknown }).missingEvidence as string[]) ?? undefined)
      : undefined,
    recommendationReason:
      typeof (deal as { recommendationReason?: unknown }).recommendationReason === "string"
        ? ((deal as { recommendationReason?: string }).recommendationReason ?? undefined)
        : undefined,
    evidenceCompleteness:
      typeof (deal as { evidenceCompleteness?: unknown }).evidenceCompleteness === "string"
        ? ((deal as { evidenceCompleteness?: string }).evidenceCompleteness ?? undefined)
        : undefined,
    priceEvidenceSource:
      typeof (deal as { evidence?: { priceEvidence?: { source?: unknown } } }).evidence?.priceEvidence
        ?.source === "string"
        ? ((deal as { evidence?: { priceEvidence?: { source?: string } } }).evidence?.priceEvidence
            ?.source ?? undefined)
        : undefined,
    platformEvidenceSource:
      typeof (deal as { evidence?: { platformEvidence?: { source?: unknown } } }).evidence
        ?.platformEvidence?.source === "string"
        ? ((deal as {
            evidence?: { platformEvidence?: { source?: string } };
          }).evidence?.platformEvidence?.source ?? undefined)
        : undefined,
    metadataEvidenceSource:
      typeof (deal as { evidence?: { metadataEvidence?: { source?: unknown } } }).evidence
        ?.metadataEvidence?.source === "string"
        ? ((deal as {
            evidence?: { metadataEvidence?: { source?: string } };
          }).evidence?.metadataEvidence?.source ?? undefined)
        : undefined
  };
}

function countTopTitles(results: RotatingRecommendationAuditResult[]): RotatingRecommendationAuditTopCount[] {
  const counts = new Map<string, number>();

  for (const result of results) {
    if (!result.topTitle) {
      continue;
    }

    counts.set(result.topTitle, (counts.get(result.topTitle) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => {
      const countDifference = right[1] - left[1];
      if (countDifference !== 0) {
        return countDifference;
      }

      return left[0].localeCompare(right[0]);
    })
    .map(([title, count]) => ({ title, count }));
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("timeout:");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout:${timeoutMs}`)), timeoutMs)
    )
  ]);
}

function buildPoolCases(
  group: RotatingRecommendationAuditGroup,
  platforms: string[],
  budget: number,
  preferences: string[]
): RotatingRecommendationPromptPoolCase[] {
  return preferences.map((value, index) => ({
    caseId: `${group}-${String(index + 1).padStart(2, "0")}`,
    group,
    preferences: value,
    budget,
    platforms,
    country: "KR"
  }));
}

function buildVariablePoolCases(
  group: RotatingRecommendationAuditGroup,
  cases: Array<{ preferences: string; budget: number; platforms: string[] }>
): RotatingRecommendationPromptPoolCase[] {
  return cases.map((value, index) => ({
    caseId: `${group}-${String(index + 1).padStart(2, "0")}`,
    group,
    preferences: value.preferences,
    budget: value.budget,
    platforms: value.platforms,
    country: "KR"
  }));
}

function pickWithoutReplacement<T>(values: T[], count: number, random: () => number): T[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }

  return shuffled.slice(0, count);
}

function createSeededRandom(seed: string): () => number {
  let state = 1779033703 ^ seed.length;

  for (let index = 0; index < seed.length; index += 1) {
    state = Math.imul(state ^ seed.charCodeAt(index), 3432918353);
    state = (state << 13) | (state >>> 19);
  }

  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    const value = (state ^= state >>> 16) >>> 0;
    return value / 4294967296;
  };
}
