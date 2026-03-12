# Game Deal Explorer MCP

`Game Deal Explorer MCP` is a public Node.js stdio MCP server that helps Korean users decide which discounted games are worth buying right now.

It combines:

- `IsThereAnyDeal` for current price, discount rate, store comparison, and historical low data
- `RAWG` for genres, platforms, ratings, and basic game metadata

The default market is `KR`, and all tools allow a `country` override.

## Features

- `discover_deals`: find discounted games by budget, genre, platform, multiplayer, and sort order
- `compare_game_price`: compare a specific game's current price, discount, and historical low
- `recommend_sale_games`: recommend sale games from structured preferences instead of free-form search
- `explain_deal_value`: explain whether the current deal is close to the historical low

## Requirements

- Node.js `22+`
- An `IsThereAnyDeal` API key
- A `RAWG` API key

Official docs:

- [IsThereAnyDeal API docs](https://docs.isthereanydeal.com/)
- [RAWG API docs](https://rawg.io/apidocs)

## Install

```bash
npm install
cp .env.example .env
```

Fill in your keys:

```bash
ITAD_API_KEY=your_isthereanydeal_api_key
RAWG_API_KEY=your_rawg_api_key
```

Build the server:

```bash
npm run build
```

Run it locally:

```bash
ITAD_API_KEY=... RAWG_API_KEY=... node dist/index.js
```

## Claude Desktop / Codex Config

Add this MCP server to your client config:

```json
{
  "mcpServers": {
    "game-deal-explorer": {
      "command": "node",
      "args": ["/absolute/path/to/game-deal-explorer-mcp/dist/index.js"],
      "env": {
        "ITAD_API_KEY": "your_isthereanydeal_api_key",
        "RAWG_API_KEY": "your_rawg_api_key"
      }
    }
  }
}
```

If the API keys are missing, the server still starts and exposes the tools, but tool calls return a friendly setup warning instead of fake results.

## Tool Inputs

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

## Example Prompts

Try these in your MCP client:

1. `2만원 이하 스팀덱용 로그라이크 할인 게임 찾아줘`
2. `Balatro 지금 어디가 제일 싸고 역대 최저가랑 얼마나 차이나?`
3. `협동 플레이 가능한 할인 게임 중 살 만한 것만 골라줘`
4. `퍼즐 장르는 빼고 이번 주 할인 중 평 좋은 인디 게임 추천해줘`
5. `Hades II 현재 할인 딜이 바로 사도 될 수준인지 설명해줘`
6. `한국 가격 기준으로 지금 50% 이상 할인 중인 전략 게임 보여줘`

## Development

Run the test suite:

```bash
npm test
```

Run a typecheck:

```bash
npm run typecheck
```

Build production output:

```bash
npm run build
```

## Notes

- This project is read-only in v1. There is no wishlist, alerting, or account sync.
- Currency values are shown in the source currency returned by the API. v1 does not convert exchange rates.
- RAWG matching is conservative. If title confidence is low, the server returns price data without metadata enrichment.
