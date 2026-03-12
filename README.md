# Game Deals MCP

`Game Deals MCP`는 지금 할인 중인 게임 가운데 실제로 살 만한 게임을 찾도록 도와주는 MCP 서버입니다. 가격 정보는 [IsThereAnyDeal](https://docs.isthereanydeal.com/)에서, 장르와 평점 같은 메타데이터는 [RAWG](https://rawg.io/apidocs)에서, `Steam Deck` 호환성 상태는 공식 Steam 데이터에서 확인합니다. 기본 국가는 `KR`이며, 각 툴에서 `country` 값을 따로 지정할 수 있습니다.

저장소: [jinhyuk9714/game-deals-mcp](https://github.com/jinhyuk9714/game-deals-mcp)

## 이 MCP로 할 수 있는 것

- `discover_deals`: 예산, 장르, 플랫폼, 멀티플레이 여부, 정렬 기준에 맞는 할인 게임을 찾습니다
- `compare_game_price`: 특정 게임의 현재 가격, 할인율, 판매처, 역대 최저가를 비교합니다
- `recommend_sale_games`: 취향과 예산에 맞는 할인 게임을 추천합니다
- `explain_deal_value`: 지금 사도 괜찮은 딜인지 역대 최저가 기준으로 설명합니다

`Steam Deck` 문맥의 검색과 추천에서는 가능한 경우 `Steam Deck Verified`, `Steam Deck Playable`, `Steam Deck 정보 없음` 같은 상태를 함께 반환합니다.

## 요구 사항

- Node.js `22+`
- `IsThereAnyDeal` API key
- `RAWG` API key

## 원격 MCP 배포

이 프로젝트는 `Cloudflare Workers` 기반 원격 MCP를 기본 경로로 사용합니다. 기존 `stdio` 실행은 그대로 유지하지만, 실제 사용자는 배포된 `workers.dev` URL에 붙는 쪽이 더 간단합니다. 원격 Worker는 request 간 상태를 저장하지 않는 sessionless stateless 구성이며, 서버 푸시형 기능보다 도구 호출 중심 사용에 맞춰져 있습니다.

먼저 의존성을 설치합니다.

```bash
npm install
```

API 키는 아래에서 받을 수 있습니다.

- `IsThereAnyDeal`: [isthereanydeal.com/apps](https://isthereanydeal.com/apps/) 에서 앱 생성
- `RAWG`: [rawg.io/apidocs](https://rawg.io/apidocs) 에서 API 키 발급

Cloudflare Workers에 런타임 시크릿을 넣습니다.

```bash
wrangler secret put ITAD_API_KEY
wrangler secret put RAWG_API_KEY
```

로컬에서 Worker를 미리 확인할 때는 아래처럼 실행합니다.

```bash
npm run dev:worker
```

실제 배포는 다음 명령으로 진행합니다.

```bash
npm run deploy:worker
```

배포가 끝나면 `https://game-deals-mcp.<your-workers-subdomain>.workers.dev` 형태의 주소가 생깁니다. MCP 클라이언트에는 이 주소 뒤에 `/mcp`를 붙여 사용하면 됩니다.

- 메타데이터: `GET /`
- 헬스체크: `GET /health`
- MCP 엔드포인트: `GET|POST|DELETE|OPTIONS /mcp`

현재 범위는 `MCP + health`만 포함합니다. `prompt`, `openapi`, 별도 REST API는 아직 제공하지 않습니다.

## GitHub Actions 자동 배포

`main` 브랜치에 푸시할 때 자동 배포하려면 GitHub 저장소 시크릿에 아래 값을 추가합니다.

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `ITAD_API_KEY`
- `RAWG_API_KEY`

워크플로우는 `.github/workflows/deploy-worker.yml` 에 들어 있습니다.

## 원격 MCP 연결

배포된 Worker는 인증 없이 공개할 수 있지만, 운영은 Cloudflare 쪽 rate limit 규칙을 전제로 합니다. 원격 연결에서는 별도 세션 헤더를 직접 다룰 필요가 없습니다.

### Codex

Codex에서는 CLI로 한 번 등록하는 방법을 가장 권장합니다.

```bash
codex mcp add game-deals-mcp --url https://game-deals-mcp.jinhyuk9714.workers.dev/mcp
```

직접 설정 파일을 수정하고 싶다면 `~/.codex/config.toml` 또는 프로젝트의 `.codex/config.toml`에 아래처럼 넣을 수도 있습니다.

```toml
[mcp_servers.game-deals-mcp]
url = "https://game-deals-mcp.jinhyuk9714.workers.dev/mcp"
```

### Claude

Claude에서는 Custom Connectors의 remote MCP 설정 화면에서 같은 `/mcp` URL을 넣으면 됩니다.

```text
https://game-deals-mcp.jinhyuk9714.workers.dev/mcp
```

## 로컬 실행

의존성을 설치하고 `.env` 파일을 만듭니다.

```bash
npm install
cp .env.example .env
```

API 키는 아래에서 받을 수 있습니다.

- `IsThereAnyDeal`: [isthereanydeal.com/apps](https://isthereanydeal.com/apps/) 에서 앱 생성
- `RAWG`: [rawg.io/apidocs](https://rawg.io/apidocs) 에서 API 키 발급

발급받은 키를 `.env`에 넣습니다.

```bash
ITAD_API_KEY=your_isthereanydeal_api_key
RAWG_API_KEY=your_rawg_api_key
```

stdio 서버를 빌드하고 실행합니다.

```bash
npm run build
ITAD_API_KEY=... RAWG_API_KEY=... node dist/index.js
```

키가 없어도 서버는 실행되지만, 툴을 호출하면 결과 대신 설정 안내 메시지를 돌려줍니다.

## npm으로 실행하기

패키지가 npm에 공개되면 로컬 빌드 없이 `npx`로 바로 실행할 수 있습니다.

```bash
npx -y game-deals-mcp
```

패키지 이름 충돌로 scoped 이름을 쓰게 되면 아래처럼 바꿔서 실행하면 됩니다.

```bash
npx -y @jinhyuk9714/game-deals-mcp
```

`npx`로 실행해도 API 키가 필요합니다. MCP 클라이언트 설정의 `env`에 `ITAD_API_KEY`, `RAWG_API_KEY`를 넣어 두면 됩니다.

## 로컬 MCP 클라이언트 설정

### Codex

로컬 저장소를 직접 실행할 때는 Codex 설정 파일에 아래 블록을 넣습니다.

```toml
[mcp_servers.game-deals-mcp]
command = "node"
args = ["/absolute/path/to/game-deals-mcp/dist/index.js"]
cwd = "/absolute/path/to/game-deals-mcp"
env = { ITAD_API_KEY = "your_isthereanydeal_api_key", RAWG_API_KEY = "your_rawg_api_key" }
```

두 개의 절대경로는 현재 로컬 프로젝트 경로에 맞게 바꿔 주세요.

npm 패키지로 실행할 때는 아래처럼 `npx`를 사용하면 됩니다.

```toml
[mcp_servers.game-deals-mcp]
command = "npx"
args = ["-y", "game-deals-mcp"]
env = { ITAD_API_KEY = "your_isthereanydeal_api_key", RAWG_API_KEY = "your_rawg_api_key" }
```

scoped 이름으로 배포됐다면 `args = ["-y", "@jinhyuk9714/game-deals-mcp"]`로 바꾸면 됩니다.

### Claude Desktop

로컬 저장소를 직접 실행할 때는 `claude_desktop_config.json`에 아래 서버를 추가합니다.

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

npm 패키지로 실행할 때는 아래처럼 `npx`를 사용하면 됩니다.

```json
{
  "mcpServers": {
    "game-deals-mcp": {
      "command": "npx",
      "args": ["-y", "game-deals-mcp"],
      "env": {
        "ITAD_API_KEY": "your_isthereanydeal_api_key",
        "RAWG_API_KEY": "your_rawg_api_key"
      }
    }
  }
}
```

scoped 이름으로 배포됐다면 `args`의 패키지 이름만 `@jinhyuk9714/game-deals-mcp`로 바꾸면 됩니다.

## 입력 예시

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

MCP 클라이언트에서 아래처럼 바로 써볼 수 있습니다.

1. `2만원 이하 스팀덱용 로그라이크 할인 게임 찾아줘`
2. `Balatro 지금 어디가 제일 싸고 역대 최저가랑 얼마나 차이나?`
3. `협동 플레이 가능한 할인 게임 중 살 만한 것만 골라줘`
4. `퍼즐 장르는 빼고 이번 주 할인 중 평 좋은 인디 게임 추천해줘`
5. `Hades II 현재 할인 딜이 바로 사도 될 수준인지 설명해줘`
6. `한국 가격 기준으로 지금 50% 이상 할인 중인 전략 게임 보여줘`

## 제한 사항

- `Steam Deck` 요청에서는 공식 Steam 호환성 정보를 우선 확인합니다. 확인하지 못한 게임은 `Steam Deck 정보 없음`으로 표시합니다.
- 공개 Worker는 인증 없이 열어 두는 구성이며, 운영 제어는 Cloudflare 쪽 보호 규칙을 전제로 합니다.
- v1은 조회 전용입니다. wishlist, alerting, account sync는 포함하지 않습니다.
- 가격은 API가 내려준 원본 통화 그대로 보여주며, 환율 변환은 하지 않습니다.
- RAWG 제목 매칭은 보수적으로 잡아 두었습니다. 신뢰도가 낮으면 메타데이터 없이 가격 정보만 반환합니다.

## 개발

```bash
npm test
npm run typecheck
npm run build
npm run dev:worker
```

## npm 배포 체크리스트

공개 npm 배포는 수동으로 진행합니다. 배포 전에 아래 순서로 확인하면 됩니다.

```bash
npm run build
npm test
npm pack --dry-run
```

그다음 임시 디렉터리에서 tarball 설치 스모크를 확인합니다.

```bash
tmpdir=$(mktemp -d)
npm pack --silent
mv game-deals-mcp-*.tgz "$tmpdir/"
cd "$tmpdir"
npm init -y >/dev/null
npm install ./game-deals-mcp-*.tgz
npx game-deals-mcp
```

마지막으로 npm 로그인 상태를 확인하고 publish 합니다.

```bash
npm whoami
npm publish
```

이름 충돌이 나면 패키지 이름을 `@jinhyuk9714/game-deals-mcp`로 바꾸고 아래처럼 다시 publish 하면 됩니다.

```bash
npm publish --access public
```

## 라이선스

MIT
