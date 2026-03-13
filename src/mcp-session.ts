import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { SerenaPluginConfig, SerenaProjectSession } from "./types.js";

interface LaunchPlan {
  command: string;
  args: string[];
  cwd?: string;
}

export interface SerenaSessionDeps {
  createTransport(options: ConstructorParameters<typeof StdioClientTransport>[0]): {
    close(): Promise<void>;
  };
  createClient(): {
    connect(transport: unknown): Promise<unknown>;
    close(): Promise<void>;
    listTools(): Promise<{ tools?: Array<{ name: string }> }>;
    callTool(request: { name: string; arguments: Record<string, unknown> }): Promise<unknown>;
  };
  now(): number;
}

const defaultDeps: SerenaSessionDeps = {
  createTransport(options) {
    return new StdioClientTransport(options);
  },
  createClient() {
    return new Client(
      {
        name: "serena-openclaw-plugin",
        version: "0.1.0",
      },
      {
        capabilities: {},
      },
    );
  },
  now() {
    return Date.now();
  },
};

export async function createSerenaProjectSession(
  projectRoot: string,
  config: SerenaPluginConfig,
): Promise<SerenaProjectSession> {
  return createSerenaProjectSessionWithDeps(projectRoot, config, defaultDeps);
}

export async function createSerenaProjectSessionWithDeps(
  projectRoot: string,
  config: SerenaPluginConfig,
  deps: SerenaSessionDeps,
): Promise<SerenaProjectSession> {
  const launchPlans = buildLaunchPlans(projectRoot, config);
  const failures: string[] = [];

  for (const plan of launchPlans) {
    let transport: ReturnType<SerenaSessionDeps["createTransport"]> | undefined;
    let client: ReturnType<SerenaSessionDeps["createClient"]> | undefined;

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
        async callTool(name: string, args: Record<string, unknown>) {
          const result = await activeClient.callTool({ name, arguments: args });
          return result;
        },
      };
    } catch (error) {
      failures.push(`${describePlan(plan)} → ${formatLaunchError(error)}`);
      await Promise.allSettled([
        client?.close?.() ?? Promise.resolve(),
        transport?.close?.() ?? Promise.resolve(),
      ]);
    }
  }

  throw new Error(buildLaunchFailureMessage(config, failures));
}

async function listToolNames(client: SerenaSessionDeps["createClient"] extends (...args: any[]) => infer T ? T : never): Promise<string[]> {
  const response = await client.listTools();
  return (response.tools ?? []).map((tool) => tool.name).sort();
}

function buildLaunchPlans(projectRoot: string, config: SerenaPluginConfig): LaunchPlan[] {
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

function directSerenaArgs(): string[] {
  return [
    "start-mcp-server",
    "--project-from-cwd",
    "--enable-web-dashboard",
    "false",
    "--open-web-dashboard",
    "false",
  ];
}

function uvxSerenaArgs(): string[] {
  return [
    "--from",
    "git+https://github.com/oraios/serena",
    "serena",
    ...directSerenaArgs(),
  ];
}

function inferDefaultArgsForCommand(command: string): string[] {
  const base = path.basename(command).toLowerCase();
  return base === "uvx" || base === "uvx.exe" ? uvxSerenaArgs() : directSerenaArgs();
}

function describePlan(plan: LaunchPlan): string {
  const renderedArgs = plan.args.length > 0 ? ` ${plan.args.join(" ")}` : "";
  return `${plan.command}${renderedArgs}`;
}

function formatLaunchError(error: unknown): string {
  if (error instanceof Error) {
    const cause = typeof (error as Error & { cause?: unknown }).cause === "string"
      ? ` (cause: ${(error as Error & { cause?: string }).cause})`
      : "";
    return `${error.message}${cause}`;
  }
  return String(error);
}

function buildLaunchFailureMessage(config: SerenaPluginConfig, failures: string[]): string {
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
