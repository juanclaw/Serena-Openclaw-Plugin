export type ToolMode = "normalized" | "passthrough" | "both";

export interface SerenaPluginConfig {
  enabled: boolean;
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
  autoStart: boolean;
  reuseSessions: boolean;
  readOnly: boolean;
  toolMode: ToolMode;
  allowedRoots: string[];
  projectMarkers: string[];
  idleTimeoutSec: number;
  maxSessions: number;
  startupTimeoutMs: number;
  serenaToolAllowlist: string[];
  serenaToolDenylist: string[];
}

export interface SerenaProjectSession {
  projectRoot: string;
  createdAt: number;
  lastUsedAt: number;
  toolNames: string[];
  stop(): Promise<void>;
  listTools(): Promise<string[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface SerenaManagerStatus {
  enabled: boolean;
  sessionCount: number;
  sessions: Array<{
    projectRoot: string;
    toolNames: string[];
    ageSec: number;
    idleSec: number;
  }>;
}
