import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("build output", () => {
  it(
    "emits the stdio entrypoint at dist/index.js",
    () => {
      execFileSync("npm", ["run", "build"], {
        cwd: process.cwd(),
        stdio: "pipe"
      });

      expect(existsSync("dist/index.js")).toBe(true);
    },
    20_000
  );

  it(
    "preserves a node shebang in dist/index.js for the published bin entrypoint",
    () => {
      execFileSync("npm", ["run", "build"], {
        cwd: process.cwd(),
        stdio: "pipe"
      });

      const entrypoint = readFileSync("dist/index.js", "utf8");

      expect(entrypoint.startsWith("#!/usr/bin/env node\n")).toBe(true);
    },
    20_000
  );
});
