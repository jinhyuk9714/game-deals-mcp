# Game Deal Explorer MCP

`Game Deal Explorer MCP`는 지금 할인 중인 게임 가운데 실제로 살 만한 게임을 찾도록 도와주는 Node.js stdio MCP 서버입니다. 가격 정보는 [IsThereAnyDeal](https://docs.isthereanydeal.com/)에서, 장르와 평점 같은 메타데이터는 [RAWG](https://rawg.io/apidocs)에서 가져옵니다. `Steam Deck` 관련 요청에서는 공식 Steam 호환성 상태도 함께 확인합니다. 기본 국가는 `KR`이며, 각 툴에서 `country` 값을 따로 지정할 수 있습니다.

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

## 빠른 시작

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

서버를 빌드하고 실행합니다.

```bash
npm run build
ITAD_API_KEY=... RAWG_API_KEY=... node dist/index.js
```

키가 없어도 서버는 실행되지만, 툴을 호출하면 결과 대신 설정 안내 메시지를 돌려줍니다.

## npm으로 실행하기

패키지가 npm에 공개되면 로컬 빌드 없이 `npx`로 바로 실행할 수 있습니다.

```bash
npx -y game-deal-explorer-mcp
```

패키지 이름 충돌로 scoped 이름을 쓰게 되면 아래처럼 바꿔서 실행하면 됩니다.

```bash
npx -y @jinhyuk9714/game-deal-explorer-mcp
```

`npx`로 실행해도 API 키가 필요합니다. MCP 클라이언트 설정의 `env`에 `ITAD_API_KEY`, `RAWG_API_KEY`를 넣어 두면 됩니다.

## MCP 클라이언트 설정

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
args = ["-y", "game-deal-explorer-mcp"]
env = { ITAD_API_KEY = "your_isthereanydeal_api_key", RAWG_API_KEY = "your_rawg_api_key" }
```

scoped 이름으로 배포됐다면 `args = ["-y", "@jinhyuk9714/game-deal-explorer-mcp"]`로 바꾸면 됩니다.

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
      "args": ["-y", "game-deal-explorer-mcp"],
      "env": {
        "ITAD_API_KEY": "your_isthereanydeal_api_key",
        "RAWG_API_KEY": "your_rawg_api_key"
      }
    }
  }
}
```

scoped 이름으로 배포됐다면 `args`의 패키지 이름만 `@jinhyuk9714/game-deal-explorer-mcp`로 바꾸면 됩니다.

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
- v1은 조회 전용입니다. wishlist, alerting, account sync는 포함하지 않습니다.
- 가격은 API가 내려준 원본 통화 그대로 보여주며, 환율 변환은 하지 않습니다.
- RAWG 제목 매칭은 보수적으로 잡아 두었습니다. 신뢰도가 낮으면 메타데이터 없이 가격 정보만 반환합니다.

## 개발

```bash
npm test
npm run typecheck
npm run build
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
mv game-deal-explorer-mcp-*.tgz "$tmpdir/"
cd "$tmpdir"
npm init -y >/dev/null
npm install ./game-deal-explorer-mcp-*.tgz
npx game-deal-explorer-mcp
```

마지막으로 npm 로그인 상태를 확인하고 publish 합니다.

```bash
npm whoami
npm publish
```

이름 충돌이 나면 패키지 이름을 `@jinhyuk9714/game-deal-explorer-mcp`로 바꾸고 아래처럼 다시 publish 하면 됩니다.

```bash
npm publish --access public
```

## 라이선스

MIT
