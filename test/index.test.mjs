import test from 'node:test';
import assert from 'node:assert/strict';

import register, { registerWith } from '../dist/index.js';

function makeApi(pluginConfig = {}) {
  const state = {
    tools: [],
    cli: [],
    services: [],
    logs: [],
  };

  const api = {
    pluginConfig,
    logger: {
      info(message) { state.logs.push(['info', message]); },
      warn(message) { state.logs.push(['warn', message]); },
      error(message) { state.logs.push(['error', message]); },
    },
    registerTool(definition, options) {
      state.tools.push({ definition, options });
    },
    registerCli(factory, options) {
      state.cli.push({ factory, options });
    },
    registerService(definition) {
      state.services.push(definition);
    },
  };

  return { api, state };
}

test('registerWith skips registration when plugin is disabled', () => {
  const { api, state } = makeApi({ enabled: false });

  registerWith(api, {
    createManager() {
      throw new Error('manager should not be created when disabled');
    },
  });

  assert.equal(state.tools.length, 0);
  assert.equal(state.cli.length, 0);
  assert.equal(state.services.length, 0);
  assert.deepEqual(state.logs, [['info', '[serena-openclaw-plugin] plugin disabled by config']]);
});

test('registerWith wires tools, CLI, and service lifecycle', async () => {
  const { api, state } = makeApi({ enabled: true });
  let stopAllCalls = 0;

  registerWith(api, {
    createManager() {
      return {
        stopAll: async () => { stopAllCalls += 1; },
        status: () => ({ enabled: true, sessionCount: 0, sessions: [] }),
        restartProject: async (projectPath) => ({
          projectRoot: projectPath,
          async listTools() { return ['find_symbol']; },
        }),
        activateProject: async (projectPath) => ({
          projectRoot: projectPath,
          toolNames: ['find_symbol'],
          async stop() {},
          async listTools() { return ['find_symbol']; },
          async callTool() { return null; },
        }),
      };
    },
  });

  assert.ok(state.tools.some(({ definition }) => definition.name === 'serena_activate_project'));
  assert.equal(state.cli.length, 1);
  assert.equal(state.cli[0].options.commands[0], 'serena');
  assert.equal(state.services.length, 1);
  assert.equal(state.services[0].id, 'serena-openclaw-plugin');

  await state.services[0].start();
  await state.services[0].stop();

  assert.equal(stopAllCalls, 1);
  assert.ok(state.logs.some((entry) => entry[1] === '[serena-openclaw-plugin] service ready'));
});

test('default export delegates to registerWith', () => {
  const { api, state } = makeApi({ enabled: false });
  register(api);
  assert.deepEqual(state.logs, [['info', '[serena-openclaw-plugin] plugin disabled by config']]);
});
