import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("publish package metadata", () => {
  it("is configured for public npm publishing", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
      private?: boolean;
      license?: string;
      repository?: unknown;
      homepage?: string;
      bugs?: unknown;
      author?: string;
    };

    expect(manifest.private).not.toBe(true);
    expect(manifest.license).toBe("MIT");
    expect(manifest.repository).toBeTruthy();
    expect(manifest.homepage).toBeTruthy();
    expect(manifest.bugs).toBeTruthy();
    expect(manifest.author).toBeTruthy();
  });
});

describe("publish package contents", () => {
  it("packs only runtime files for npm", () => {
    rmSync("dist", { recursive: true, force: true });

    execFileSync("npm", ["run", "build"], {
      cwd: process.cwd(),
      stdio: "pipe"
    });

    const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
      cwd: process.cwd(),
      stdio: "pipe",
      encoding: "utf8"
    });

    const packResult = JSON.parse(output) as Array<{
      files: Array<{ path: string }>;
    }>;
    const packedPaths = new Set(packResult[0]?.files.map((file) => file.path));

    expect(packedPaths.has("dist/index.js")).toBe(true);
    expect(packedPaths.has("README.md")).toBe(true);
    expect(packedPaths.has("LICENSE")).toBe(true);
    expect(packedPaths.has("package.json")).toBe(true);
    expect(packedPaths.has(".env.example")).toBe(true);

    expect([...packedPaths].some((path) => path.startsWith("src/"))).toBe(false);
    expect([...packedPaths].some((path) => path.startsWith("tests/"))).toBe(false);
    expect(packedPaths.has("tsconfig.json")).toBe(false);
    expect(packedPaths.has("tsconfig.build.json")).toBe(false);
    expect(packedPaths.has("vitest.config.ts")).toBe(false);
  });
});
