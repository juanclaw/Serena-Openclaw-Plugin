import { resolveConfig } from "./config.js";
import { registerSerenaCli } from "./cli.js";
import { SerenaManager } from "./serena-manager.js";
import { registerSerenaTools } from "./toolkit.js";
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

const defaultDeps: RegisterDeps = {
  createManager(config, logger) {
    return new SerenaManager(config, logger);
  },
};

export function registerWith(api: RegisterApi, deps: RegisterDeps = defaultDeps) {
  const config = resolveConfig(api.pluginConfig);

  if (!config.enabled) {
    api.logger.info("[serena-openclaw-plugin] plugin disabled by config");
    return;
  }

  const manager = deps.createManager(config, api.logger);

  registerSerenaTools(api, manager, config);

  api.registerCli(
    ({ program }: any) => registerSerenaCli(program, manager),
    { commands: ["serena"] },
  );

  api.registerService({
    id: "serena-openclaw-plugin",
    start: async () => {
      api.logger.info("[serena-openclaw-plugin] service ready");
    },
    stop: async () => {
      await manager.stopAll();
    },
  });
}

export default function register(api: RegisterApi) {
  return registerWith(api);
}
