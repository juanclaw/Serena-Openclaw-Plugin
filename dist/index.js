import { resolveConfig } from "./config.js";
import { registerSerenaCli } from "./cli.js";
import { SerenaManager } from "./serena-manager.js";
import { registerSerenaTools } from "./toolkit.js";
const defaultDeps = {
    createManager(config, logger) {
        return new SerenaManager(config, logger);
    },
};
export function registerWith(api, deps = defaultDeps) {
    const config = resolveConfig(api.pluginConfig);
    if (!config.enabled) {
        api.logger.info("[serena-openclaw-plugin] plugin disabled by config");
        return;
    }
    const manager = deps.createManager(config, api.logger);
    registerSerenaTools(api, manager, config);
    api.registerCli(({ program }) => registerSerenaCli(program, manager), { commands: ["serena"] });
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
export default function register(api) {
    return registerWith(api);
}
//# sourceMappingURL=index.js.map