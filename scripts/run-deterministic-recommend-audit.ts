#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_CONCURRENCY,
  DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_OUTPUT,
  DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_TIMEOUT_MS,
  runDeterministicRecommendationAudit,
  type DeterministicRecommendationAuditRun
} from "../src/qa/deterministic-recommendation-audit.js";

export interface DeterministicRecommendationAuditCliOptions {
  output: string;
  concurrency: number;
  timeoutMs: number;
}

export function parseArgs(
  args: string[],
  cwd = process.cwd()
): DeterministicRecommendationAuditCliOptions {
  let output = path.resolve(cwd, DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_OUTPUT);
  let concurrency = DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_CONCURRENCY;
  let timeoutMs = DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_TIMEOUT_MS;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--output" && args[index + 1]) {
      output = path.resolve(cwd, args[index + 1]!);
      index += 1;
      continue;
    }

    if (argument === "--concurrency" && args[index + 1]) {
      concurrency = parsePositiveInt(
        args[index + 1]!,
        DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_CONCURRENCY
      );
      index += 1;
      continue;
    }

    if (argument === "--timeout-ms" && args[index + 1]) {
      timeoutMs = parsePositiveInt(
        args[index + 1]!,
        DEFAULT_DETERMINISTIC_RECOMMENDATION_AUDIT_TIMEOUT_MS
      );
      index += 1;
    }
  }

  return { output, concurrency, timeoutMs };
}

export async function runDeterministicRecommendationAuditCli(options?: {
  argv?: string[];
  cwd?: string;
  runAudit?: (options: {
    concurrency: number;
    timeoutMs: number;
  }) => Promise<DeterministicRecommendationAuditRun>;
  log?: (line: string) => void;
}) {
  const cwd = options?.cwd ?? process.cwd();
  const cliOptions = parseArgs(options?.argv ?? process.argv.slice(2), cwd);
  const runAudit =
    options?.runAudit ??
    ((auditOptions: { concurrency: number; timeoutMs: number }) =>
      runDeterministicRecommendationAudit(undefined, auditOptions));
  const log = options?.log ?? console.log;
  const report = await runAudit({
    concurrency: cliOptions.concurrency,
    timeoutMs: cliOptions.timeoutMs
  });

  await mkdir(path.dirname(cliOptions.output), { recursive: true });
  await writeFile(cliOptions.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  log(
    JSON.stringify(
      {
        output: cliOptions.output,
        concurrency: cliOptions.concurrency,
        timeoutMs: cliOptions.timeoutMs,
        summary: report.summary
      },
      null,
      2
    )
  );

  return report;
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main() {
  await runDeterministicRecommendationAuditCli();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
