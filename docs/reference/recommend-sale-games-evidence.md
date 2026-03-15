# recommend_sale_games Evidence-First Contract

`recommend_sale_games`는 “빈 결과를 줄이기 위한 약한 추정”보다 “공식 API 근거로 설명 가능한 추천”을 우선합니다. accepted match는 provider-backed evidence를 가져야 하고, evidence가 부족하면 `emptyReason`과 `missingEvidence`를 포함한 empty response를 반환할 수 있습니다.

## Provider 역할

- `ITAD`
  - 현재가, 정상가, 할인율, 역대 최저가, 판매처를 담당합니다.
  - accepted match는 항상 `evidence.priceEvidence.source = "ITAD"`를 가집니다.
- `Steam`
  - `Steam Deck Verified` / `Steam Deck Playable` 같은 공식 Steam Deck 호환성 근거를 담당합니다.
  - Steam Deck 추천은 `evidence.platformEvidence.source = "Steam"` 또는 Steam에서 확인된 동등한 official evidence가 필요합니다.
- `RAWG`
  - 장르, 태그, 평점, 메타크리틱 같은 메타데이터를 담당합니다.
  - `strategy`, `roguelike`, `deckbuilder`, `co-op`, `high-rating` 같은 intent axis는 가능한 한 `RAWG` 근거로 검증합니다.

## Acceptance contract

accepted `matches[*]`는 아래 필드를 포함할 수 있습니다.

- `evidence`
  - `priceEvidence`
  - `platformEvidence`
  - `metadataEvidence`
- `matchedSignals`
- `missingEvidence`
- `recommendationReason`
- `evidenceCompleteness`

공통 acceptance 기준:

- `ITAD` 현재가가 존재해야 합니다.
- `cut > 0` 이어야 합니다.
- 예산과 플랫폼 제약을 충족해야 합니다.

intent별 추가 기준:

- `strategy-rating`
  - `RAWG` 기반 `Strategy` 또는 `Tactics` evidence
  - `rating >= 4` 또는 `metacritic >= 75`
- `deckbuilding-card`
  - `RAWG` 기반 `deck`, `card`, `deckbuilder` evidence
- `multiplayer-social`
  - `multiplayer === true`
  - `RAWG` 또는 provider-backed `co-op`, `teamplay`, `party` evidence
- `steam-deck-*`
  - `Steam Deck Verified` 또는 `Steam Deck Playable` evidence
- `genre-hybrid`
  - 요청한 축 2개 이상이 모두 `matchedSignals`에 포함

## Rejection contract

다음 후보는 strict recommendation evidence로 취급하지 않습니다.

- `Steam Deck unknown`
- `Steam Deck unsupported`
- title-only candidate
- metadata-only candidate
- weak overlay candidate
- `bundle`, `course`, `demo`, `collection`
- `AI shovelware`

이 경우 추천이 비워질 수 있고, 응답에는 `emptyReason`과 `missingEvidence`가 붙을 수 있습니다.

대표 `emptyReason` 예시:

- `missing-price-evidence`
- `missing-steam-deck-evidence`
- `missing-social-metadata`
- `missing-review-evidence`
- `missing-deckbuilding-evidence`
- `missing-genre-evidence`

## Response contract

### accepted response

```json
{
  "matches": [
    {
      "title": "Reviewed Tactics Reserve",
      "evidence": {
        "priceEvidence": {
          "source": "ITAD",
          "current": { "amount": 15900, "currency": "KRW" },
          "regular": { "amount": 31800, "currency": "KRW" },
          "cut": 50
        },
        "platformEvidence": {
          "source": "ITAD",
          "platforms": ["PC"]
        },
        "metadataEvidence": {
          "source": "RAWG",
          "genres": ["Strategy", "Tactics"],
          "rating": 4.4,
          "metacritic": 84
        }
      },
      "matchedSignals": ["strategy", "tactics", "high-rating"],
      "missingEvidence": [],
      "recommendationReason": "ITAD 가격 근거와 RAWG 장르·평점 근거가 모두 확인돼 조건을 충족합니다.",
      "evidenceCompleteness": "hard-facts-plus-metadata"
    }
  ]
}
```

### empty response

```json
{
  "matches": [],
  "summary": "조건에 맞는 추천 할인 게임을 찾지 못했습니다. Steam Deck Verified/Playable 근거를 확인하지 못해 추천을 비웠습니다.",
  "emptyReason": "missing-steam-deck-evidence",
  "missingEvidence": ["Steam Deck verified/playable 근거"]
}
```

## Notes for integrators

- `matchedSignals`는 추천 문장에서 실제로 충족한 축을 보여줍니다.
- `missingEvidence`는 왜 후보가 reject 되었는지 설명합니다.
- `recommendationReason`는 사람에게 보여 주기 위한 짧은 설명입니다.
- `evidenceCompleteness`는 `hard-facts-only`, `hard-facts-plus-metadata`, `partial` 중 하나입니다.
- `emptyReason`이 있으면 추천 누락이 아니라 evidence-first 정책상 정상 reject일 수 있습니다.
