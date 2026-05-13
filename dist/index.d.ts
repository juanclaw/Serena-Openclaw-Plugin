import { SerenaManager } from "./serena-manager.js";
import type { SerenaPluginConfig } from "./types.js";
interface LoggerLike {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}
export interface RegisterApi {
    pluginConfig: unknown;
    logger: LoggerLike;
    registerTool: (...args: any[]) => void;
    registerCli: (...args: any[]) => void;
    registerService: (...args: any[]) => void;
}
export interface RegisterDeps {
    createManager(config: SerenaPluginConfig, logger: LoggerLike): SerenaManager;
}
export declare function registerWith(api: RegisterApi, deps?: RegisterDeps): void;
export default function register(api: RegisterApi): void;
export {};
