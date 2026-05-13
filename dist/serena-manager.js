import { createSerenaProjectSession } from "./mcp-session.js";
import { findProjectRoot, isWithinAllowedRoots, normalizeExistingPath } from "./path-utils.js";
export class SerenaManager {
    config;
    logger;
    sessionFactory;
    sessions = new Map();
    constructor(config, logger, sessionFactory = createSerenaProjectSession) {
        this.config = config;
        this.logger = logger;
        this.sessionFactory = sessionFactory;
    }
    async activateProject(inputPath) {
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
    getSession(projectRoot) {
        const normalized = normalizeExistingPath(projectRoot);
        const session = this.sessions.get(normalized);
        if (session) {
            session.lastUsedAt = Date.now();
        }
        return session;
    }
    async restartProject(inputPath) {
        const canonicalInput = normalizeExistingPath(inputPath);
        const projectRoot = findProjectRoot(canonicalInput, this.config.projectMarkers);
        await this.disposeProject(projectRoot);
        return this.activateProject(projectRoot);
    }
    async disposeProject(projectRoot) {
        const normalized = normalizeExistingPath(projectRoot);
        const session = this.sessions.get(normalized);
        if (!session)
            return;
        this.sessions.delete(normalized);
        await session.stop();
    }
    async stopAll() {
        const sessions = [...this.sessions.values()];
        this.sessions.clear();
        await Promise.allSettled(sessions.map((session) => session.stop()));
    }
    status() {
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
    reapIdleSessions() {
        const now = Date.now();
        for (const [projectRoot, session] of this.sessions.entries()) {
            const idleMs = now - session.lastUsedAt;
            if (idleMs > this.config.idleTimeoutSec * 1000) {
                this.sessions.delete(projectRoot);
                void session.stop();
            }
        }
    }
    async ensureCapacity() {
        while (this.sessions.size >= this.config.maxSessions) {
            const oldest = [...this.sessions.values()].sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0];
            if (!oldest)
                return;
            await this.disposeProject(oldest.projectRoot);
        }
    }
}
//# sourceMappingURL=serena-manager.js.map