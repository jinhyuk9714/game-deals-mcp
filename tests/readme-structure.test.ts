import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("README landing structure", () => {
  it("keeps the landing-page section order for first-time users", () => {
    const readme = readFileSync("README.md", "utf8");

    const sections = [
      "## 빠르게 시작하기",
      "## 무슨 일을 하는 MCP인가",
      "## 추천 근거 정책",
      "## 원격 연결",
      "## 로컬 실행",
      "## 툴 입력 예시",
      "## 배포",
      "## 개발",
      "## 라이선스"
    ];

    let previousIndex = -1;

    for (const section of sections) {
      const index = readme.indexOf(section);

      expect(index, `missing section ${section}`).toBeGreaterThan(-1);
      expect(index, `section ${section} is out of order`).toBeGreaterThan(previousIndex);

      previousIndex = index;
    }
  });
});
