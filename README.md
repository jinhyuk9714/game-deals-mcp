# game-deals-mcp

`game-deals-mcp`는 할인 중인 게임을 가격과 공식/준공식 메타데이터 근거로 추천하는 TypeScript MCP 서버입니다. `IsThereAnyDeal`, Steam Store, RAWG 정보를 조합해 "싸다"보다 "왜 추천했는지 설명할 수 있다"에 초점을 둡니다.

## 문제의식

게임 할인 정보는 가격, 플랫폼 호환성, 장르, 평점, 역대 최저가가 서로 다른 source에 나뉘어 있습니다. 이 프로젝트는 LLM이 게임을 추천할 때 가격 근거와 취향 근거를 함께 반환하도록 MCP tool surface를 설계했습니다.

## 제공 도구

- `discover_deals`: 예산, 장르, 플랫폼, 멀티플레이 여부, 정렬 기준으로 할인 게임을 검색합니다.
- `compare_game_price`: 특정 게임의 현재 가격, 할인율, 판매처, 역대 최저가를 비교합니다.
- `recommend_sale_games`: 취향과 예산에 맞는 할인 게임을 evidence-first 방식으로 추천합니다.
- `explain_deal_value`: 지금 구매할 만한 딜인지 역대 최저가 기준으로 설명합니다.

## 추천 근거 정책

`recommend_sale_games`는 evidence-first 계약을 따릅니다.

- `ITAD`: 현재가, 정상가, 할인율, 판매처, 역대 최저가
- `Steam`: Steam Deck Verified/Playable 같은 공식 호환성 근거
- `RAWG`: 장르, 태그, 평점, 메타크리틱 등 메타데이터

공식 근거가 부족하면 결과를 비울 수 있습니다. `Steam Deck unknown`, title-only match, metadata-only match, weak overlay 후보는 strict recommendation evidence로 사용하지 않습니다. 상세 계약은 `docs/reference/recommend-sale-games-evidence.md`에 정리되어 있습니다.

## 원격 연결

Cloudflare Workers 기반 원격 MCP 주소:

```text
https://game-deals-mcp.jinhyuk9714.workers.dev/mcp
```

Codex:

```bash
codex mcp add game-deals-mcp --url https://game-deals-mcp.jinhyuk9714.workers.dev/mcp
```

Claude Desktop 등 원격 MCP URL을 받는 클라이언트에는 같은 URL을 등록하면 됩니다.

헬스체크와 MCP route:

- `GET /`
- `GET /health`
- `GET|POST|DELETE|OPTIONS /mcp`

## 로컬 실행

요구 사항:

- Node.js 22+
- `ITAD_API_KEY`
- `RAWG_API_KEY`

```bash
npm install
cp .env.example .env
npm run build
ITAD_API_KEY=... RAWG_API_KEY=... node dist/index.js
```

npm 패키지로 실행하는 경로도 준비되어 있습니다.

```bash
npx -y game-deals-mcp
```

로컬 MCP 클라이언트 설정 예시:

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

## Worker 배포

```bash
npm run dev:worker
wrangler secret put ITAD_API_KEY
wrangler secret put RAWG_API_KEY
npm run deploy:worker
```

GitHub Actions 자동 배포를 사용하려면 저장소 secret에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ITAD_API_KEY`, `RAWG_API_KEY`가 필요합니다.

관련 workflow:

- `.github/workflows/deploy-worker.yml`
- `.github/workflows/ci.yml`

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Runtime | Node.js 22+, TypeScript |
| MCP/HTTP | `@modelcontextprotocol/sdk`, Hono |
| Validation | Zod |
| Deployment | Cloudflare Workers, Wrangler |
| Quality | Vitest, TypeScript typecheck, recommendation audit scripts |

## 프로젝트 구조

```text
src/
├── domain/        # 추천 후보 구성, 제약, 랭킹, 점수화
├── providers/     # ITAD, RAWG, Steam Store client
├── tools/         # MCP tool handler
├── qa/            # recommendation audit harness
├── server.ts      # Worker/HTTP server
└── index.ts       # stdio entrypoint
scripts/           # local/remote QA 실행 스크립트
artifacts/         # audit 결과 샘플
tests/             # domain, provider, tool, worker 회귀 테스트
```

## 검증

```bash
npm test
npm run typecheck
npm run qa:recommend-deterministic
npm run qa:recommend-local
npm run build
```

`deterministic`와 `local` audit는 CI hard gate로 쓰고, `diverse`와 `rotating` audit는 관찰 지표로 둡니다. 가격은 provider가 내려준 원본 통화 그대로 표시하며 환율 변환은 하지 않습니다.

## 라이선스

MIT
