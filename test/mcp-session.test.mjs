import test from 'node:test';
import assert from 'node:assert/strict';

import { createSerenaProjectSessionWithDeps } from '../dist/mcp-session.js';

function makeConfig(overrides = {}) {
  return {
    enabled: true,
    command: 'uvx',
    args: ['serena', 'start-mcp-server'],
    cwd: undefined,
    env: {},
    autoStart: true,
    reuseSessions: true,
    readOnly: false,
    toolMode: 'normalized',
    allowedRoots: [],
    projectMarkers: ['package.json'],
    idleTimeoutSec: 900,
    maxSessions: 6,
    startupTimeoutMs: 20000,
    serenaToolAllowlist: [],
    serenaToolDenylist: [],
    ...overrides,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('createSerenaProjectSessionWithDeps wires cwd/env and sorts tool names', async () => {
  const captured = { transportOptions: null, callTool: null, closed: [] };
  const deps = {
    createTransport(options) {
      captured.transportOptions = options;
      return {
        async close() {
          captured.closed.push('transport');
        },
      };
    },
    createClient() {
      return {
        async connect() {},
        async close() {
          captured.closed.push('client');
        },
        async listTools() {
          return { tools: [{ name: 'zeta' }, { name: 'alpha' }] };
        },
        async callTool(request) {
          captured.callTool = request;
          return { ok: true, request };
        },
      };
    },
    now() {
      return 123456;
    },
  };

  const session = await createSerenaProjectSessionWithDeps('/repo', makeConfig({ env: { EXTRA: '1' } }), deps);

  assert.equal(captured.transportOptions.command, 'uvx');
  assert.deepEqual(captured.transportOptions.args, ['serena', 'start-mcp-server']);
  assert.equal(captured.transportOptions.cwd, '/repo');
  assert.equal(captured.transportOptions.stderr, 'pipe');
  assert.equal(captured.transportOptions.env.SERENA_PROJECT_ROOT, '/repo');
  assert.equal(captured.transportOptions.env.EXTRA, '1');

  assert.equal(session.projectRoot, '/repo');
  assert.equal(session.createdAt, 123456);
  assert.equal(session.lastUsedAt, 123456);
  assert.deepEqual(session.toolNames, ['alpha', 'zeta']);
  assert.deepEqual(await session.listTools(), ['alpha', 'zeta']);

  const result = await session.callTool('find_symbol', { name_path: 'register' });
  assert.deepEqual(captured.callTool, {
    name: 'find_symbol',
    arguments: { name_path: 'register' },
  });
  assert.equal(result.ok, true);

  await session.stop();
  assert.deepEqual(captured.closed, ['client', 'transport']);
});

test('createSerenaProjectSessionWithDeps honors explicit config.cwd', async () => {
  let cwd;
  const deps = {
    createTransport(options) {
      cwd = options.cwd;
      return { async close() {} };
    },
    createClient() {
      return {
        async connect() {},
        async close() {},
        async listTools() { return { tools: [] }; },
        async callTool() { return null; },
      };
    },
    now() {
      return 1;
    },
  };

  await createSerenaProjectSessionWithDeps('/repo', makeConfig({ cwd: '/custom-cwd' }), deps);
  assert.equal(cwd, '/custom-cwd');
});

test('createSerenaProjectSessionWithDeps auto-detects a direct serena launcher when args are omitted', async () => {
  const attempts = [];
  const deps = {
    createTransport(options) {
      attempts.push({ command: options.command, args: options.args });
      return { async close() {} };
    },
    createClient() {
      return {
        async connect() {},
        async close() {},
        async listTools() { return { tools: [] }; },
        async callTool() { return null; },
      };
    },
    now() {
      return 5;
    },
  };

  await createSerenaProjectSessionWithDeps('/repo', makeConfig({ command: 'serena', args: [] }), deps);
  assert.deepEqual(attempts, [{
    command: 'serena',
    args: ['start-mcp-server', '--project-from-cwd', '--enable-web-dashboard', 'false', '--open-web-dashboard', 'false'],
  }]);
});

test('createSerenaProjectSessionWithDeps auto mode falls back from serena to uvx', async () => {
  const attempts = [];
  let call = 0;
  const deps = {
    createTransport(options) {
      attempts.push({ command: options.command, args: options.args });
      return { async close() {} };
    },
    createClient() {
      call += 1;
      return {
        async connect() {
          if (call === 1) {
            throw new Error('spawn serena ENOENT');
          }
        },
        async close() {},
        async listTools() { return { tools: [] }; },
        async callTool() { return null; },
      };
    },
    now() {
      return 6;
    },
  };

  await createSerenaProjectSessionWithDeps('/repo', makeConfig({ command: 'auto', args: [] }), deps);
  assert.deepEqual(attempts, [
    { command: 'serena', args: ['start-mcp-server', '--project-from-cwd', '--enable-web-dashboard', 'false', '--open-web-dashboard', 'false'] },
    { command: 'uvx', args: ['--from', 'git+https://github.com/oraios/serena', 'serena', 'start-mcp-server', '--project-from-cwd', '--enable-web-dashboard', 'false', '--open-web-dashboard', 'false'] },
  ]);
});

test('createSerenaProjectSessionWithDeps reports helpful launch failures', async () => {
  const deps = {
    createTransport() {
      return { async close() {} };
    },
    createClient() {
      return {
        async connect() {
          throw new Error('spawn failed');
        },
        async close() {},
        async listTools() { return { tools: [] }; },
        async callTool() { return null; },
      };
    },
    now() {
      return 7;
    },
  };

  await assert.rejects(
    () => createSerenaProjectSessionWithDeps('/repo', makeConfig({ command: 'auto', args: [] }), deps),
    /Failed to start Serena MCP server[\s\S]*Tried automatic Serena launch detection[\s\S]*Fix by setting plugins\.entries\.serena-openclaw-plugin\.config\.command\/args/,
  );
});

test('createSerenaProjectSessionWithDeps times out stalled connects', async () => {
  const stalled = deferred();
  const deps = {
    createTransport() {
      return { async close() {} };
    },
    createClient() {
      return {
        connect() { return stalled.promise; },
        async close() {},
        async listTools() { return { tools: [] }; },
        async callTool() { return null; },
      };
    },
    now() {
      return 1;
    },
  };

  await assert.rejects(
    () => createSerenaProjectSessionWithDeps('/repo', makeConfig({ startupTimeoutMs: 10 }), deps),
    /Timed out connecting to Serena MCP server/,
  );

  stalled.resolve();
});

test('createSerenaProjectSessionWithDeps handles empty tool lists', async () => {
  const deps = {
    createTransport() {
      return { async close() {} };
    },
    createClient() {
      return {
        async connect() {},
        async close() {},
        async listTools() { return {}; },
        async callTool() { return null; },
      };
    },
    now() {
      return 2;
    },
  };

  const session = await createSerenaProjectSessionWithDeps('/repo', makeConfig(), deps);
  assert.deepEqual(session.toolNames, []);
  assert.deepEqual(await session.listTools(), []);
});

test('createSerenaProjectSessionWithDeps surfaces tool listing failures during startup', async () => {
  const deps = {
    createTransport() {
      return { async close() {} };
    },
    createClient() {
      return {
        async connect() {},
        async close() {},
        async listTools() {
          throw new Error('tool discovery failed');
        },
        async callTool() { return null; },
      };
    },
    now() {
      return 3;
    },
  };

  await assert.rejects(
    () => createSerenaProjectSessionWithDeps('/repo', makeConfig({ command: 'serena', args: ['start-mcp-server'] }), deps),
    /tool discovery failed/,
  );
});

test('createSerenaProjectSessionWithDeps surfaces tool call failures', async () => {
  const deps = {
    createTransport() {
      return { async close() {} };
    },
    createClient() {
      return {
        async connect() {},
        async close() {},
        async listTools() { return { tools: [] }; },
        async callTool() {
          throw new Error('upstream call failed');
        },
      };
    },
    now() {
      return 4;
    },
  };

  const session = await createSerenaProjectSessionWithDeps('/repo', makeConfig(), deps);
  await assert.rejects(() => session.callTool('find_symbol', {}), /upstream call failed/);
});
