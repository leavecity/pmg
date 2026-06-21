import path from "node:path";
import { pathExists, readText } from "./fs.js";

export interface LayoutMarker {
  schemaVersion: number;
  layoutVersion: number;
}

export interface LayoutMarkerFinding {
  severity: "error" | "warning";
  path: string;
  message: string;
}

export const PMG_LAYOUT_PATH = ".pmg/layout.json";
export const TARGET_LAYOUT_VERSION = 1;
export const TARGET_LAYOUT_SCHEMA_VERSION = 1;

export function createLayoutMarker(): LayoutMarker {
  return {
    schemaVersion: TARGET_LAYOUT_SCHEMA_VERSION,
    layoutVersion: TARGET_LAYOUT_VERSION
  };
}

export async function readLayoutMarker(root: string): Promise<LayoutMarker | null> {
  const layoutPath = path.join(root, PMG_LAYOUT_PATH);

  if (!(await pathExists(layoutPath))) {
    return null;
  }

  return parseLayoutMarker(await readText(layoutPath));
}

export async function checkLayoutMarker(root: string): Promise<LayoutMarkerFinding[]> {
  const layoutPath = path.join(root, PMG_LAYOUT_PATH);

  if (!(await pathExists(layoutPath))) {
    return [{
      severity: "warning",
      path: PMG_LAYOUT_PATH,
      message: "PMG layout marker is missing; run pmg migrate before relying on layout compatibility"
    }];
  }

  let marker: LayoutMarker;
  try {
    marker = await readLayoutMarker(root) as LayoutMarker;
  } catch (error) {
    return [{
      severity: "error",
      path: PMG_LAYOUT_PATH,
      message: error instanceof Error ? error.message : String(error)
    }];
  }

  if (marker.schemaVersion !== TARGET_LAYOUT_SCHEMA_VERSION) {
    return [{
      severity: "error",
      path: PMG_LAYOUT_PATH,
      message: "PMG layout marker schemaVersion is unsupported"
    }];
  }

  if (marker.layoutVersion < TARGET_LAYOUT_VERSION) {
    return [{
      severity: "warning",
      path: PMG_LAYOUT_PATH,
      message: "PMG layout marker is older than this tool supports; run pmg migrate"
    }];
  }

  if (marker.layoutVersion > TARGET_LAYOUT_VERSION) {
    return [{
      severity: "error",
      path: PMG_LAYOUT_PATH,
      message: "PMG layout marker is newer than this tool supports"
    }];
  }

  return [];
}

function parseLayoutMarker(content: string): LayoutMarker {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid PMG layout marker JSON: ${message}`);
  }

  if (!isRecord(parsed)) {
    throw new Error("PMG layout marker must be a JSON object");
  }

  if (typeof parsed.schemaVersion !== "number") {
    throw new Error("PMG layout marker schemaVersion must be a number");
  }

  if (typeof parsed.layoutVersion !== "number") {
    throw new Error("PMG layout marker layoutVersion must be a number");
  }

  return {
    schemaVersion: parsed.schemaVersion,
    layoutVersion: parsed.layoutVersion
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
