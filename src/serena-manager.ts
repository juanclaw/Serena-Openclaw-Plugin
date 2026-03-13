import { createSerenaProjectSession } from "./mcp-session.js";
import { findProjectRoot, isWithinAllowedRoots, normalizeExistingPath } from "./path-utils.js";
import type { SerenaManagerStatus, SerenaPluginConfig, SerenaProjectSession } from "./types.js";

export type SerenaSessionFactory = (
  projectRoot: string,
  config: SerenaPluginConfig,
) => Promise<SerenaProjectSession>;

interface LoggerLike {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export class SerenaManager {
  private readonly sessions = new Map<string, SerenaProjectSession>();

  constructor(
    private readonly config: SerenaPluginConfig,
    private readonly logger: LoggerLike,
    private readonly sessionFactory: SerenaSessionFactory = createSerenaProjectSession,
  ) {}

  async activateProject(inputPath: string): Promise<SerenaProjectSession> {
    this.reapIdleSessions();
    const canonicalInput = normalizeExistingPath(inputPath);
    const projectRoot = findProjectRoot(canonicalInput, this.config.projectMarkers);

    if (!isWithinAllowedRoots(projectRoot, this.config.allowedRoots)) {
      throw new Error(`Project root is outside allowedRoots: ${projectRoot}`);
    }

    if (this.config.reuseSessions) {
      const existing = this.sessions.get(projectRoot);
      if (existing) {
        existing.lastUsedAt = Date.now();
        return existing;
      }
    }

    await this.ensureCapacity();
    const session = await this.sessionFactory(projectRoot, this.config);
    this.sessions.set(projectRoot, session);
    this.logger.info(`[serena-openclaw-plugin] activated ${projectRoot}`);
    return session;
  }

  getSession(projectRoot: string): SerenaProjectSession | undefined {
    const normalized = normalizeExistingPath(projectRoot);
    const session = this.sessions.get(normalized);
    if (session) {
      session.lastUsedAt = Date.now();
    }
    return session;
  }

  async restartProject(inputPath: string): Promise<SerenaProjectSession> {
    const canonicalInput = normalizeExistingPath(inputPath);
    const projectRoot = findProjectRoot(canonicalInput, this.config.projectMarkers);
    await this.disposeProject(projectRoot);
    return this.activateProject(projectRoot);
  }

  async disposeProject(projectRoot: string): Promise<void> {
    const normalized = normalizeExistingPath(projectRoot);
    const session = this.sessions.get(normalized);
    if (!session) return;
    this.sessions.delete(normalized);
    await session.stop();
  }

  async stopAll(): Promise<void> {
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    await Promise.allSettled(sessions.map((session) => session.stop()));
  }

  status(): SerenaManagerStatus {
    const now = Date.now();
    return {
      enabled: this.config.enabled,
      sessionCount: this.sessions.size,
      sessions: [...this.sessions.values()].map((session) => ({
        projectRoot: session.projectRoot,
        toolNames: session.toolNames,
        ageSec: Math.floor((now - session.createdAt) / 1000),
        idleSec: Math.floor((now - session.lastUsedAt) / 1000),
      })),
    };
  }

  private reapIdleSessions(): void {
    const now = Date.now();
    for (const [projectRoot, session] of this.sessions.entries()) {
      const idleMs = now - session.lastUsedAt;
      if (idleMs > this.config.idleTimeoutSec * 1000) {
        this.sessions.delete(projectRoot);
        void session.stop();
      }
    }
  }

  private async ensureCapacity(): Promise<void> {
    while (this.sessions.size >= this.config.maxSessions) {
      const oldest = [...this.sessions.values()].sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0];
      if (!oldest) return;
      await this.disposeProject(oldest.projectRoot);
    }
  }
}
