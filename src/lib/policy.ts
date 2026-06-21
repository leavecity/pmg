import path from "node:path";
import { pathExists, readText } from "./fs.js";

export type PolicyMode = "conservative" | "balanced" | "autonomous";

export interface PmgPolicy {
  schemaVersion: number;
  mode: PolicyMode;
  automation: {
    doctorFix: "dry-run-only" | "manual" | "enabled";
    memoryCleanup: "proposal-required" | "automatic";
    conflictResolution: "manual" | "proposal-required";
  };
}

export interface PolicyReadResult {
  path: string;
  source: "file" | "default";
  policy: PmgPolicy;
}

const DEFAULT_POLICY: PmgPolicy = {
  schemaVersion: 1,
  mode: "conservative",
  automation: {
    doctorFix: "dry-run-only",
    memoryCleanup: "proposal-required",
    conflictResolution: "manual"
  }
};

export async function readPmgPolicy(root: string): Promise<PolicyReadResult> {
  const policyPath = path.join(root, ".pmg", "policy.json");

  if (!(await pathExists(policyPath))) {
    return {
      path: ".pmg/policy.json",
      source: "default",
      policy: DEFAULT_POLICY
    };
  }

  const parsed = JSON.parse(await readText(policyPath)) as Partial<PmgPolicy>;

  return {
    path: ".pmg/policy.json",
    source: "file",
    policy: normalizePolicy(parsed)
  };
}

function normalizePolicy(policy: Partial<PmgPolicy>): PmgPolicy {
  return {
    schemaVersion: policy.schemaVersion ?? DEFAULT_POLICY.schemaVersion,
    mode: normalizeMode(policy.mode),
    automation: {
      doctorFix: policy.automation?.doctorFix ?? DEFAULT_POLICY.automation.doctorFix,
      memoryCleanup: policy.automation?.memoryCleanup ?? DEFAULT_POLICY.automation.memoryCleanup,
      conflictResolution: policy.automation?.conflictResolution ?? DEFAULT_POLICY.automation.conflictResolution
    }
  };
}

function normalizeMode(mode: unknown): PolicyMode {
  if (mode === "conservative" || mode === "balanced" || mode === "autonomous") {
    return mode;
  }

  return DEFAULT_POLICY.mode;
}
