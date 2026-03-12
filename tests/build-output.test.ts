import { existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("build output", () => {
  it("emits the stdio entrypoint at dist/index.js", () => {
    rmSync("dist", { recursive: true, force: true });

    execFileSync("npm", ["run", "build"], {
      cwd: process.cwd(),
      stdio: "pipe"
    });

    expect(existsSync("dist/index.js")).toBe(true);
  });
});
