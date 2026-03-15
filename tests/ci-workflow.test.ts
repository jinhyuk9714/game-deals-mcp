import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("ci workflow", () => {
  it("defines the recommendation quality guardrail workflow", () => {
    const workflowPath = ".github/workflows/ci.yml";

    expect(existsSync(workflowPath)).toBe(true);

    const workflow = readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("name: CI");
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("- main");
    expect(workflow).toContain("runs-on: ubuntu-latest");
    expect(workflow).toContain("node-version: 22");
    expect(workflow).toContain("run: npm ci");
    expect(workflow).toContain("run: npm test");
    expect(workflow).toContain("run: npm run typecheck");
    expect(workflow).toContain("run: npm run qa:recommend-deterministic");
    expect(workflow).toContain("run: npm run qa:recommend-local");
    expect(workflow).toContain("uses: actions/upload-artifact@v4");
    expect(workflow).toContain("if: always()");
    expect(workflow).toContain("artifacts/deterministic-recommend-audit.json");
    expect(workflow).toContain("artifacts/local-recommend-audit.json");
    expect(workflow).not.toContain("qa:recommend-diverse");
    expect(workflow).not.toContain("qa:recommend-rotating");
  });
});
