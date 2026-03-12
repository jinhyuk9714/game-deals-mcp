# Game Deal Explorer MCP

`Game Deal Explorer MCP` is a Node.js stdio MCP server for finding discounted games that are actually worth buying, not just cheap. It combines price data from [IsThereAnyDeal](https://docs.isthereanydeal.com/) with game metadata from [RAWG](https://rawg.io/apidocs), defaults to the `KR` market, and supports country overrides for every tool.

Repository: [jinhyuk9714/game-deals-mcp](https://github.com/jinhyuk9714/game-deals-mcp)

## What It Does

- `discover_deals`: search current discounts by budget, genre, platform, multiplayer, and sort order
- `compare_game_price`: compare one game's current price, discount, store offers, and historical low
- `recommend_sale_games`: turn structured preferences into sale recommendations
- `explain_deal_value`: explain whether the current deal looks good versus the historical low

## Requirements

- Node.js `22+`
- `IsThereAnyDeal` API key
- `RAWG` API key

## Quick Start

Install dependencies and create your env file:

```bash
npm install
cp .env.example .env
```

Get your API keys:

- `IsThereAnyDeal`: create an app at [isthereanydeal.com/apps](https://isthereanydeal.com/apps/)
- `RAWG`: request a key at [rawg.io/apidocs](https://rawg.io/apidocs)

Add them to `.env`:

```bash
ITAD_API_KEY=your_isthereanydeal_api_key
RAWG_API_KEY=your_rawg_api_key
```

Build and run the server:

```bash
npm run build
ITAD_API_KEY=... RAWG_API_KEY=... node dist/index.js
```

If the keys are missing, the server still starts and exposes the tools, but tool calls return setup warnings instead of fake results.

## MCP Client Setup

### Codex

Add this block to your Codex config:

```toml
[mcp_servers.game-deals-mcp]
command = "node"
args = ["/absolute/path/to/game-deals-mcp/dist/index.js"]
cwd = "/absolute/path/to/game-deals-mcp"
env = { ITAD_API_KEY = "your_isthereanydeal_api_key", RAWG_API_KEY = "your_rawg_api_key" }
```

Replace both absolute paths with your local project path.

### Claude Desktop

Add this server to `claude_desktop_config.json`:

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

Use the absolute path to this repository's `dist/index.js`.

## Example Tool Inputs

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

## Limitations

- `Steam Deck` recommendations currently use a `PC proxy`, not official Deck compatibility data.
- v1 is read-only. There is no wishlist, alerting, or account sync.
- Prices are shown in the source currency returned by the API. There is no FX conversion.
- RAWG title matching is conservative. If confidence is low, the server returns price data without metadata enrichment.

## Development

```bash
npm test
npm run typecheck
npm run build
```

## License

MIT
