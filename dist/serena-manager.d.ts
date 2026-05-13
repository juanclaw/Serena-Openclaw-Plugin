import type { SerenaManagerStatus, SerenaPluginConfig, SerenaProjectSession } from "./types.js";
export type SerenaSessionFactory = (projectRoot: string, config: SerenaPluginConfig) => Promise<SerenaProjectSession>;
interface LoggerLike {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}
export declare class SerenaManager {
    private readonly config;
    private readonly logger;
    private readonly sessionFactory;
    private readonly sessions;
    constructor(config: SerenaPluginConfig, logger: LoggerLike, sessionFactory?: SerenaSessionFactory);
    activateProject(inputPath: string): Promise<SerenaProjectSession>;
    getSession(projectRoot: string): SerenaProjectSession | undefined;
    restartProject(inputPath: string): Promise<SerenaProjectSession>;
    disposeProject(projectRoot: string): Promise<void>;
    stopAll(): Promise<void>;
    status(): SerenaManagerStatus;
    private reapIdleSessions;
    private ensureCapacity;
}
export {};
