import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { SerenaPluginConfig, SerenaProjectSession } from "./types.js";
export interface SerenaSessionDeps {
    createTransport(options: ConstructorParameters<typeof StdioClientTransport>[0]): {
        close(): Promise<void>;
    };
    createClient(): {
        connect(transport: unknown): Promise<unknown>;
        close(): Promise<void>;
        listTools(): Promise<{
            tools?: Array<{
                name: string;
            }>;
        }>;
        callTool(request: {
            name: string;
            arguments: Record<string, unknown>;
        }): Promise<unknown>;
    };
    now(): number;
}
export declare function createSerenaProjectSession(projectRoot: string, config: SerenaPluginConfig): Promise<SerenaProjectSession>;
export declare function createSerenaProjectSessionWithDeps(projectRoot: string, config: SerenaPluginConfig, deps: SerenaSessionDeps): Promise<SerenaProjectSession>;
