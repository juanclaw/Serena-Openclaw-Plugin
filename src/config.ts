import type { SerenaPluginConfig } from "./types.js";

const DEFAULT_MARKERS = [
  ".git",
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "Makefile",
];

export function resolveConfig(value: unknown): SerenaPluginConfig {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  return {
    enabled: raw.enabled === undefined ? true : Boolean(raw.enabled),
    command: typeof raw.command === "string" && raw.command.trim() ? raw.command.trim() : "auto",
    args: Array.isArray(raw.args)
      ? raw.args.filter((item): item is string => typeof item === "string")
      : [],
    cwd: typeof raw.cwd === "string" && raw.cwd.trim() ? raw.cwd.trim() : undefined,
    env: readStringMap(raw.env),
    autoStart: raw.autoStart === undefined ? true : Boolean(raw.autoStart),
    reuseSessions: raw.reuseSessions === undefined ? true : Boolean(raw.reuseSessions),
    readOnly: raw.readOnly === undefined ? false : Boolean(raw.readOnly),
    toolMode: raw.toolMode === "normalized" || raw.toolMode === "passthrough" || raw.toolMode === "both"
      ? raw.toolMode
      : "normalized",
    allowedRoots: Array.isArray(raw.allowedRoots)
      ? raw.allowedRoots.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    projectMarkers: Array.isArray(raw.projectMarkers)
      ? raw.projectMarkers.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : DEFAULT_MARKERS,
    idleTimeoutSec: asPositiveInt(raw.idleTimeoutSec, 900, 30),
    maxSessions: asPositiveInt(raw.maxSessions, 6, 1),
    startupTimeoutMs: asPositiveInt(raw.startupTimeoutMs, 20000, 1000),
    serenaToolAllowlist: Array.isArray(raw.serenaToolAllowlist)
      ? raw.serenaToolAllowlist.filter((item): item is string => typeof item === "string")
      : [],
    serenaToolDenylist: Array.isArray(raw.serenaToolDenylist)
      ? raw.serenaToolDenylist.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function readStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      out[key] = entry;
    }
  }
  return out;
}

function asPositiveInt(value: unknown, fallback: number, min: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min ? value : fallback;
}
