# Game Deal Explorer MCP

`Game Deal Explorer MCP`는 단순히 "싼 게임"이 아니라 "지금 살 만한 할인 게임"을 찾도록 도와주는 Node.js stdio MCP 서버입니다. [IsThereAnyDeal](https://docs.isthereanydeal.com/)의 가격 데이터와 [RAWG](https://rawg.io/apidocs)의 게임 메타데이터를 함께 사용하며, 기본 시장은 `KR`이고 모든 툴에서 `country` override를 지원합니다.

저장소: [jinhyuk9714/game-deals-mcp](https://github.com/jinhyuk9714/game-deals-mcp)

## 무엇을 하는 MCP인가요

- `discover_deals`: 예산, 장르, 플랫폼, 멀티플레이 여부, 정렬 기준으로 현재 할인 게임을 찾습니다
- `compare_game_price`: 특정 게임의 현재 가격, 할인율, 판매처, 역대 최저가를 비교합니다
- `recommend_sale_games`: 구조화된 취향 입력을 바탕으로 할인 게임을 추천합니다
- `explain_deal_value`: 현재 할인 딜이 역대 최저가 기준으로 살 만한 수준인지 설명합니다

## 요구 사항

- Node.js `22+`
- `IsThereAnyDeal` API key
- `RAWG` API key

## 빠른 시작

의존성을 설치하고 `.env` 파일을 만듭니다.

```bash
npm install
cp .env.example .env
```

API 키는 아래에서 발급받을 수 있습니다.

- `IsThereAnyDeal`: [isthereanydeal.com/apps](https://isthereanydeal.com/apps/) 에서 앱 생성
- `RAWG`: [rawg.io/apidocs](https://rawg.io/apidocs) 에서 API 키 요청

발급받은 키를 `.env`에 넣습니다.

```bash
ITAD_API_KEY=your_isthereanydeal_api_key
RAWG_API_KEY=your_rawg_api_key
```

서버를 빌드하고 실행합니다.

```bash
npm run build
ITAD_API_KEY=... RAWG_API_KEY=... node dist/index.js
```

키가 없더라도 서버는 실행되지만, 툴 호출 시 실제 결과 대신 설정 안내 경고를 반환합니다.

## MCP 클라이언트 설정

### Codex

Codex 설정 파일에 아래 블록을 추가합니다.

```toml
[mcp_servers.game-deals-mcp]
command = "node"
args = ["/absolute/path/to/game-deals-mcp/dist/index.js"]
cwd = "/absolute/path/to/game-deals-mcp"
env = { ITAD_API_KEY = "your_isthereanydeal_api_key", RAWG_API_KEY = "your_rawg_api_key" }
```

두 개의 절대경로는 현재 로컬 프로젝트 경로로 바꿔 주세요.

### Claude Desktop

`claude_desktop_config.json`에 아래 서버를 추가합니다.

```json
{
  "mcpServers": {
    "game-deals-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/game-deals-mcp/dist/index.js"],
      "env": {
        "ITAD_API_KEY": "your_isthereanydeal_api_key",
        "RAWG_API_KEY": "your_rawg_api_key"
      }
    }
  }
}
```

`args`에는 이 저장소의 `dist/index.js` 절대경로를 넣으면 됩니다.

## 예시 입력

### `discover_deals`

```json
{
  "budget": 20000,
  "genres": ["Roguelike"],
  "platforms": ["Steam Deck"],
  "multiplayer": false,
  "sort": "best-value",
  "country": "KR"
}
```

### `compare_game_price`

```json
{
  "title": "Balatro",
  "country": "KR"
}
```

### `recommend_sale_games`

```json
{
  "preferences": "협동 로그라이크",
  "budget": 20000,
  "platforms": ["Steam Deck"],
  "excludeGenres": ["Puzzle"],
  "country": "KR"
}
```

### `explain_deal_value`

```json
{
  "title": "Hades II",
  "country": "KR"
}
```

## 바로 써볼 질문

MCP 클라이언트에서 이렇게 물어볼 수 있습니다.

1. `2만원 이하 스팀덱용 로그라이크 할인 게임 찾아줘`
2. `Balatro 지금 어디가 제일 싸고 역대 최저가랑 얼마나 차이나?`
3. `협동 플레이 가능한 할인 게임 중 살 만한 것만 골라줘`
4. `퍼즐 장르는 빼고 이번 주 할인 중 평 좋은 인디 게임 추천해줘`
5. `Hades II 현재 할인 딜이 바로 사도 될 수준인지 설명해줘`
6. `한국 가격 기준으로 지금 50% 이상 할인 중인 전략 게임 보여줘`

## 제한 사항

- `Steam Deck` 추천은 아직 공식 호환성 데이터가 아니라 `PC proxy` 기준으로 동작합니다.
- v1은 읽기 전용입니다. wishlist, alerting, account sync는 포함하지 않습니다.
- 가격은 API가 반환한 원본 통화 그대로 보여주며, 환율 변환은 하지 않습니다.
- RAWG 제목 매칭은 보수적으로 처리합니다. 신뢰도가 낮으면 메타데이터 없이 가격 정보만 반환합니다.

## 개발

```bash
npm test
npm run typecheck
npm run build
```

## 라이선스

MIT
