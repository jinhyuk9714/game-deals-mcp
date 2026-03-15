# Game Deals MCP

`Game Deals MCP`는 할인 중인 게임을 가격과 공식 메타데이터 근거로 추천해 주는 MCP 서버입니다. 가격은 `ITAD`, `Steam Deck` 호환성은 공식 `Steam`, 장르·태그·평점은 `RAWG`를 기준으로 확인합니다. coverage보다 “왜 이 게임을 추천했는지 설명 가능한가”를 우선합니다.

저장소: [jinhyuk9714/game-deals-mcp](https://github.com/jinhyuk9714/game-deals-mcp)

## 빠르게 시작하기

가장 빠른 시작 경로는 원격 Worker에 바로 연결하는 방식입니다.

### 원격 MCP 바로 연결

Codex:

```bash
codex mcp add game-deals-mcp --url https://game-deals-mcp.jinhyuk9714.workers.dev/mcp
```

Claude:

```text
https://game-deals-mcp.jinhyuk9714.workers.dev/mcp
```

### 로컬에서 바로 실행

```bash
npm install
cp .env.example .env
npm run build
ITAD_API_KEY=... RAWG_API_KEY=... node dist/index.js
```

필수 키:

- `ITAD_API_KEY`
- `RAWG_API_KEY`

키 발급:

- `ITAD`: [isthereanydeal.com/apps](https://isthereanydeal.com/apps/)
- `RAWG`: [rawg.io/apidocs](https://rawg.io/apidocs)

## 무슨 일을 하는 MCP인가

이 MCP는 “싸게 파는 게임”이 아니라 “지금 할인 중이고, 근거를 설명할 수 있는 게임”을 찾는 데 맞춰져 있습니다.

제공 툴:

- `discover_deals`: 예산, 장르, 플랫폼, 멀티플레이 여부, 정렬 기준으로 할인 게임을 찾습니다.
- `compare_game_price`: 특정 게임의 현재 가격, 할인율, 판매처, 역대 최저가를 비교합니다.
- `recommend_sale_games`: 취향과 예산에 맞는 할인 게임을 evidence-first 방식으로 추천합니다.
- `explain_deal_value`: 지금 사도 괜찮은 딜인지 역대 최저가 기준으로 설명합니다.

바로 써볼 질문:

1. `2만원 이하 스팀덱용 로그라이크 할인 게임 찾아줘`
2. `Balatro 지금 어디가 제일 싸고 역대 최저가랑 얼마나 차이나?`
3. `협동 플레이 가능한 할인 게임 중 살 만한 것만 골라줘`
4. `퍼즐은 빼고 평 좋은 인디 할인작 추천해줘`
5. `Hades II 현재 할인 딜이 바로 사도 될 수준인지 설명해줘`

## 추천 근거 정책

`recommend_sale_games`는 evidence-first 계약을 따릅니다.

provider 역할:

- `ITAD`: 현재가, 정상가, 할인율, 판매처, 역대 최저가 같은 가격 근거
- `Steam`: `Steam Deck Verified`, `Steam Deck Playable` 같은 공식 호환성 근거
- `RAWG`: 장르, 태그, 평점, 메타크리틱 같은 메타데이터 근거

accepted match는 `structuredContent.matches[*]`에 아래 필드를 포함할 수 있습니다.

- `evidence`
- `matchedSignals`
- `missingEvidence`
- `recommendationReason`
- `evidenceCompleteness`

empty response는 아래 필드를 포함할 수 있습니다.

- `emptyReason`
- `missingEvidence`

핵심 규칙:

- `recommend_sale_games`는 official evidence가 부족하면 결과를 비울 수 있습니다.
- `Steam Deck unknown`은 strict recommendation evidence로 쓰지 않습니다.
- title-only, metadata-only, weak overlay 후보는 strict recommendation evidence로 쓰지 않습니다.
- accepted match는 가능한 한 `ITAD` 가격 근거와 intent-specific `Steam` 또는 `RAWG` 근거를 함께 보여 줍니다.

빠른 예시:

```json
{
  "matches": [
    {
      "title": "Reviewed Tactics Reserve",
      "evidence": {
        "priceEvidence": { "source": "ITAD", "cut": 50 },
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

```json
{
  "matches": [],
  "emptyReason": "missing-steam-deck-evidence",
  "missingEvidence": ["Steam Deck verified/playable 근거"]
}
```

상세 계약은 [recommend-sale-games-evidence.md](https://github.com/jinhyuk9714/game-deals-mcp/blob/main/docs/reference/recommend-sale-games-evidence.md)에서 볼 수 있습니다.

## 원격 연결

배포된 Worker:

```text
https://game-deals-mcp.jinhyuk9714.workers.dev/mcp
```

메타데이터 및 헬스체크:

- `GET /`
- `GET /health`
- `GET|POST|DELETE|OPTIONS /mcp`

### Codex

CLI로 등록:

```bash
codex mcp add game-deals-mcp --url https://game-deals-mcp.jinhyuk9714.workers.dev/mcp
```

직접 설정:

```toml
[mcp_servers.game-deals-mcp]
url = "https://game-deals-mcp.jinhyuk9714.workers.dev/mcp"
```

### Claude

Custom Connectors에 아래 URL을 넣으면 됩니다.

```text
https://game-deals-mcp.jinhyuk9714.workers.dev/mcp
```

## 로컬 실행

요구 사항:

- Node.js `22+`
- `ITAD_API_KEY`
- `RAWG_API_KEY`

### 저장소에서 실행

```bash
npm install
cp .env.example .env
```

`.env`:

```bash
ITAD_API_KEY=your_isthereanydeal_api_key
RAWG_API_KEY=your_rawg_api_key
```

실행:

```bash
npm run build
ITAD_API_KEY=... RAWG_API_KEY=... node dist/index.js
```

### npm 패키지로 실행

```bash
npx -y game-deals-mcp
```

scoped 이름으로 배포되면:

```bash
npx -y @jinhyuk9714/game-deals-mcp
```

### 로컬 MCP 클라이언트 설정

Codex:

```toml
[mcp_servers.game-deals-mcp]
command = "node"
args = ["/absolute/path/to/game-deals-mcp/dist/index.js"]
cwd = "/absolute/path/to/game-deals-mcp"
env = { ITAD_API_KEY = "your_isthereanydeal_api_key", RAWG_API_KEY = "your_rawg_api_key" }
```

Claude Desktop:

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

## 툴 입력 예시

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

## 배포

이 프로젝트는 `Cloudflare Workers` 기반 원격 MCP를 기본 경로로 사용합니다.

로컬 Worker 확인:

```bash
npm run dev:worker
```

시크릿 설정:

```bash
wrangler secret put ITAD_API_KEY
wrangler secret put RAWG_API_KEY
```

배포:

```bash
npm run deploy:worker
```

GitHub Actions 자동 배포를 쓰려면 저장소 시크릿에 아래 값을 추가합니다.

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `ITAD_API_KEY`
- `RAWG_API_KEY`

관련 workflow:

- [deploy-worker.yml](/Users/sungjh/Projects/daiso/.github/workflows/deploy-worker.yml)
- [ci.yml](/Users/sungjh/Projects/daiso/.github/workflows/ci.yml)

## 개발

자주 쓰는 명령:

```bash
npm test
npm run typecheck
npm run qa:recommend-deterministic
npm run qa:recommend-local
npm run build
npm run dev:worker
```

메모:

- `deterministic`와 `local` audit는 CI hard gate입니다.
- `diverse`, `rotating` audit는 observational 참고 지표입니다.
- 가격은 API가 내려준 원본 통화 그대로 보여 주며, 환율 변환은 하지 않습니다.

### npm 배포 체크리스트

```bash
npm run build
npm test
npm pack --dry-run
```

tarball 스모크:

```bash
tmpdir=$(mktemp -d)
npm pack --silent
mv game-deals-mcp-*.tgz "$tmpdir/"
cd "$tmpdir"
npm init -y >/dev/null
npm install ./game-deals-mcp-*.tgz
npx game-deals-mcp
```

publish:

```bash
npm whoami
npm publish
```

scoped publish:

```bash
npm publish --access public
```

## 라이선스

MIT
