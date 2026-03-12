#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_REMOTE_MCP_URL,
  getQaCases,
  type QaFixtureName,
  runRemoteQa
} from "../src/qa/remote-qa.js";

interface CliOptions {
  url: string;
  output: string;
  fixture: QaFixtureName;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await runRemoteQa(options.url, getQaCases(options.fixture));

  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        output: options.output,
        url: options.url,
        fixture: options.fixture,
        summary: report.summary
      },
      null,
      2
    )
  );

  process.exit(0);
}

function parseArgs(args: string[]): CliOptions {
  let url = process.env.REMOTE_MCP_URL || DEFAULT_REMOTE_MCP_URL;
  let output = path.resolve("artifacts/remote-qa.json");
  let fixture: QaFixtureName = "canonical";

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--url" && args[index + 1]) {
      url = args[index + 1]!;
      index += 1;
      continue;
    }

    if (argument === "--output" && args[index + 1]) {
      output = path.resolve(args[index + 1]!);
      index += 1;
      continue;
    }

    if (argument === "--fixture" && args[index + 1]) {
      const value = args[index + 1]!;
      fixture = value === "variant" ? "variant" : "canonical";
      index += 1;
    }
  }

  if (fixture === "variant" && output === path.resolve("artifacts/remote-qa.json")) {
    output = path.resolve("artifacts/remote-qa-variant.json");
  }

  return { url, output, fixture };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
