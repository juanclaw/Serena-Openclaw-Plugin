import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const defaultDeps = {
    createTransport(options) {
        return new StdioClientTransport(options);
    },
    createClient() {
        return new Client({
            name: "serena-openclaw-plugin",
            version: "0.1.0",
        }, {
            capabilities: {},
        });
    },
    now() {
        return Date.now();
    },
};
export async function createSerenaProjectSession(projectRoot, config) {
    return createSerenaProjectSessionWithDeps(projectRoot, config, defaultDeps);
}
export async function createSerenaProjectSessionWithDeps(projectRoot, config, deps) {
    const launchPlans = buildLaunchPlans(projectRoot, config);
    const failures = [];
    for (const plan of launchPlans) {
        let transport;
        let client;
        try {
            transport = deps.createTransport({
                command: plan.command,
                args: plan.args,
                cwd: plan.cwd,
                env: {
                    ...process.env,
                    ...config.env,
                    SERENA_PROJECT_ROOT: projectRoot,
                },
                stderr: "pipe",
            });
            client = deps.createClient();
            const activeTransport = transport;
            const activeClient = client;
            await withTimeout(activeClient.connect(activeTransport), config.startupTimeoutMs, `Timed out connecting to Serena MCP server via ${describePlan(plan)}`);
            const createdAt = deps.now();
            let toolNames = await listToolNames(activeClient);
            return {
                projectRoot,
                createdAt,
                lastUsedAt: createdAt,
                toolNames,
                async stop() {
                    await activeClient.close();
                    await activeTransport.close();
                },
                async listTools() {
                    toolNames = await listToolNames(activeClient);
                    return toolNames;
                },
                async callTool(name, args) {
                    const result = await activeClient.callTool({ name, arguments: args });
                    return result;
                },
            };
        }
        catch (error) {
            failures.push(`${describePlan(plan)} → ${formatLaunchError(error)}`);
            await Promise.allSettled([
                client?.close?.() ?? Promise.resolve(),
                transport?.close?.() ?? Promise.resolve(),
            ]);
        }
    }
    throw new Error(buildLaunchFailureMessage(config, failures));
}
async function listToolNames(client) {
    const response = await client.listTools();
    return (response.tools ?? []).map((tool) => tool.name).sort();
}
function buildLaunchPlans(projectRoot, config) {
    const cwd = config.cwd ?? projectRoot;
    const command = config.command.trim();
    if (command === "auto") {
        if (config.args.length > 0) {
            return [
                { command: "serena", args: config.args, cwd },
                { command: "uvx", args: config.args, cwd },
            ];
        }
        return [
            { command: "serena", args: directSerenaArgs(), cwd },
            { command: "uvx", args: uvxSerenaArgs(), cwd },
        ];
    }
    if (config.args.length > 0) {
        return [{ command, args: config.args, cwd }];
    }
    return [{ command, args: inferDefaultArgsForCommand(command), cwd }];
}
function directSerenaArgs() {
    return [
        "start-mcp-server",
        "--project-from-cwd",
        "--enable-web-dashboard",
        "false",
        "--open-web-dashboard",
        "false",
    ];
}
function uvxSerenaArgs() {
    return [
        "--from",
        "git+https://github.com/oraios/serena",
        "serena",
        ...directSerenaArgs(),
    ];
}
function inferDefaultArgsForCommand(command) {
    const base = path.basename(command).toLowerCase();
    return base === "uvx" || base === "uvx.exe" ? uvxSerenaArgs() : directSerenaArgs();
}
function describePlan(plan) {
    const renderedArgs = plan.args.length > 0 ? ` ${plan.args.join(" ")}` : "";
    return `${plan.command}${renderedArgs}`;
}
function formatLaunchError(error) {
    if (error instanceof Error) {
        const cause = typeof error.cause === "string"
            ? ` (cause: ${error.cause})`
            : "";
        return `${error.message}${cause}`;
    }
    return String(error);
}
function buildLaunchFailureMessage(config, failures) {
    const modeHint = config.command === "auto"
        ? "Tried automatic Serena launch detection."
        : `Configured Serena command: ${config.command}`;
    const argsHint = config.args.length > 0
        ? `Configured args: ${config.args.join(" ")}`
        : "No explicit args configured; plugin inferred startup arguments for the chosen launcher.";
    return [
        "Failed to start Serena MCP server.",
        modeHint,
        argsHint,
        "Tried:",
        ...failures.map((failure) => `- ${failure}`),
        "Fix by setting plugins.entries.serena-openclaw-plugin.config.command/args to a working Serena launcher for your environment.",
    ].join("\n");
}
async function withTimeout(promise, timeoutMs, message) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error(message)), timeoutMs);
            }),
        ]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
//# sourceMappingURL=mcp-session.js.map