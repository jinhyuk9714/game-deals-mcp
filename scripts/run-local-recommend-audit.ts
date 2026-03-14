#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_RECOMMENDATION_AUDIT_CONCURRENCY,
  DEFAULT_RECOMMENDATION_AUDIT_OUTPUT,
  DEFAULT_RECOMMENDATION_AUDIT_TIMEOUT_MS,
  runLocalRecommendationAudit,
  type RecommendationAuditRun
} from "../src/qa/recommendation-audit.js";
import type { ConfigSource } from "../src/config.js";

export interface LocalRecommendationAuditCliOptions {
  output: string;
  concurrency: number;
  timeoutMs: number;
}

export function parseArgs(
  args: string[],
  cwd = process.cwd()
): LocalRecommendationAuditCliOptions {
  let output = path.resolve(cwd, DEFAULT_RECOMMENDATION_AUDIT_OUTPUT);
  let concurrency = DEFAULT_RECOMMENDATION_AUDIT_CONCURRENCY;
  let timeoutMs = DEFAULT_RECOMMENDATION_AUDIT_TIMEOUT_MS;

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
        DEFAULT_RECOMMENDATION_AUDIT_CONCURRENCY
      );
      index += 1;
      continue;
    }

    if (argument === "--timeout-ms" && args[index + 1]) {
      timeoutMs = parsePositiveInt(
        args[index + 1]!,
        DEFAULT_RECOMMENDATION_AUDIT_TIMEOUT_MS
      );
      index += 1;
    }
  }

  return { output, concurrency, timeoutMs };
}

export async function runLocalRecommendationAuditCli(options?: {
  argv?: string[];
  cwd?: string;
  env?: ConfigSource;
  runAudit?: (
    env: ConfigSource,
    options: { concurrency: number; timeoutMs: number }
  ) => Promise<RecommendationAuditRun>;
  log?: (line: string) => void;
}) {
  const cwd = options?.cwd ?? process.cwd();
  const cliOptions = parseArgs(options?.argv ?? process.argv.slice(2), cwd);
  const env = loadAuditEnv(cwd, options?.env ?? process.env);
  const runAudit =
    options?.runAudit ??
    ((nextEnv: ConfigSource, auditOptions: { concurrency: number; timeoutMs: number }) =>
      runLocalRecommendationAudit(nextEnv, auditOptions));
  const log = options?.log ?? console.log;
  const report = await runAudit(env, {
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

export function loadAuditEnv(
  cwd: string,
  env: ConfigSource = process.env
): ConfigSource {
  const envPath = path.resolve(cwd, ".env");

  if (!existsSync(envPath)) {
    return env;
  }

  return {
    ...parseDotEnv(readFileSync(envPath, "utf8")),
    ...env
  };
}

function parseDotEnv(source: string): ConfigSource {
  const parsed: ConfigSource = {};

  for (const line of source.split(/\r?\n/u)) {
    const normalized = line.trim();
    if (!normalized || normalized.startsWith("#")) {
      continue;
    }

    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    let value = normalized.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main() {
  await runLocalRecommendationAuditCli();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
