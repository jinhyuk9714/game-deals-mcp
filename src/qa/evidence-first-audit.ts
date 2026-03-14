import type { CompareResult } from "../domain/service.js";

export interface EvidenceFirstAuditClassification {
  flagged: boolean;
  groundlessRecommendation: boolean;
  recoverableButMissed: boolean;
  evidenceRejected: boolean;
}

export function extractRecommendationEmptyReason(response: CompareResult): string | undefined {
  return typeof response.emptyReason === "string" && response.emptyReason.length > 0
    ? response.emptyReason
    : undefined;
}

export function extractRecommendationMissingEvidence(response: CompareResult): string[] {
  return Array.isArray(response.missingEvidence)
    ? response.missingEvidence.filter((value): value is string => typeof value === "string")
    : [];
}

export function classifyEvidenceFirstAuditResult(args: {
  topMatch: unknown | null;
  invalidRecommendation: boolean;
  emptyReason?: string | undefined;
}): EvidenceFirstAuditClassification {
  if (args.topMatch) {
    return {
      flagged: args.invalidRecommendation,
      groundlessRecommendation: args.invalidRecommendation,
      recoverableButMissed: false,
      evidenceRejected: false
    };
  }

  if (typeof args.emptyReason === "string" && args.emptyReason.length > 0) {
    return {
      flagged: false,
      groundlessRecommendation: false,
      recoverableButMissed: false,
      evidenceRejected: true
    };
  }

  return {
    flagged: true,
    groundlessRecommendation: false,
    recoverableButMissed: true,
    evidenceRejected: false
  };
}
