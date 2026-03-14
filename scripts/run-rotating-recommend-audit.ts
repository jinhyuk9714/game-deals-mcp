#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_ROTATING_RECOMMENDATION_AUDIT_CONCURRENCY,
  DEFAULT_ROTATING_RECOMMENDATION_AUDIT_OUTPUT,
  DEFAULT_ROTATING_RECOMMENDATION_AUDIT_TIMEOUT_MS,
  defaultRotatingRecommendationAuditSeed,
  runLocalRotatingRecommendationAudit,
  type RotatingRecommendationAuditRun
} from "../src/qa/rotating-recommendation-audit.js";
import type { ConfigSource } from "../src/config.js";
import { loadAuditEnv } from "./run-local-recommend-audit.js";

export interface RotatingRecommendationAuditCliOptions {
  output: string;
  concurrency: number;
  timeoutMs: number;
  seed: string;
}

export function parseArgs(
  args: string[],
  cwd = process.cwd(),
  now = new Date()
): RotatingRecommendationAuditCliOptions {
  let output = path.resolve(cwd, DEFAULT_ROTATING_RECOMMENDATION_AUDIT_OUTPUT);
  let concurrency = DEFAULT_ROTATING_RECOMMENDATION_AUDIT_CONCURRENCY;
  let timeoutMs = DEFAULT_ROTATING_RECOMMENDATION_AUDIT_TIMEOUT_MS;
  let seed = defaultRotatingRecommendationAuditSeed(now);

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
        DEFAULT_ROTATING_RECOMMENDATION_AUDIT_CONCURRENCY
      );
      index += 1;
      continue;
    }

    if (argument === "--timeout-ms" && args[index + 1]) {
      timeoutMs = parsePositiveInt(
        args[index + 1]!,
        DEFAULT_ROTATING_RECOMMENDATION_AUDIT_TIMEOUT_MS
      );
      index += 1;
      continue;
    }

    if (argument === "--seed" && args[index + 1]) {
      seed = args[index + 1]!;
      index += 1;
    }
  }

  return { output, concurrency, timeoutMs, seed };
}

export async function runRotatingRecommendationAuditCli(options?: {
  argv?: string[];
  cwd?: string;
  env?: ConfigSource;
  now?: Date;
  runAudit?: (
    env: ConfigSource,
    options: { concurrency: number; timeoutMs: number; seed: string }
  ) => Promise<RotatingRecommendationAuditRun>;
  log?: (line: string) => void;
}) {
  const cwd = options?.cwd ?? process.cwd();
  const cliOptions = parseArgs(options?.argv ?? process.argv.slice(2), cwd, options?.now);
  const env = loadAuditEnv(cwd, options?.env ?? process.env);
  const runAudit =
    options?.runAudit ??
    ((nextEnv: ConfigSource, auditOptions: { concurrency: number; timeoutMs: number; seed: string }) =>
      runLocalRotatingRecommendationAudit(nextEnv, auditOptions));
  const log = options?.log ?? console.log;
  const report = await runAudit(env, {
    concurrency: cliOptions.concurrency,
    timeoutMs: cliOptions.timeoutMs,
    seed: cliOptions.seed
  });

  await mkdir(path.dirname(cliOptions.output), { recursive: true });
  await writeFile(cliOptions.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  log(
    JSON.stringify(
      {
        output: cliOptions.output,
        concurrency: cliOptions.concurrency,
        timeoutMs: cliOptions.timeoutMs,
        seed: cliOptions.seed,
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
  await runRotatingRecommendationAuditCli();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
