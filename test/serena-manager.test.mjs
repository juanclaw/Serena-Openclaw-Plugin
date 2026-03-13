import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SerenaManager } from '../dist/serena-manager.js';

function mkProject(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `serena-openclaw-plugin-${name}-`));
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  return root;
}

function makeConfig(overrides = {}) {
  return {
    enabled: true,
    command: 'uvx',
    args: [],
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

function makeLogger() {
  return {
    info() {},
    warn() {},
    error() {},
  };
}

test('SerenaManager reuses existing session for same project root', async () => {
  const projectRoot = mkProject('reuse');
  let created = 0;

  const manager = new SerenaManager(makeConfig(), makeLogger(), async (root) => {
    const now = Date.now();
    return {
      projectRoot: root,
      createdAt: now + ++created,
      lastUsedAt: now,
      toolNames: ['find_symbol'],
      async stop() {},
      async listTools() { return ['find_symbol']; },
      async callTool() { return null; },
    };
  });

  const first = await manager.activateProject(projectRoot);
  const second = await manager.activateProject(projectRoot);

  assert.equal(first, second);
  assert.equal(created, 1);
});

test('SerenaManager evicts least recently used session when at capacity', async () => {
  const stopCalls = [];
  const roots = [mkProject('a'), mkProject('b'), mkProject('c')];
  let tick = 0;
  const baseTime = Date.now();

  const manager = new SerenaManager(makeConfig({ maxSessions: 2 }), makeLogger(), async (root) => ({
    projectRoot: root,
    createdAt: baseTime + ++tick,
    lastUsedAt: baseTime + tick,
    toolNames: [],
    async stop() { stopCalls.push(root); },
    async listTools() { return []; },
    async callTool() { return null; },
  }));

  await manager.activateProject(roots[0]);
  await manager.activateProject(roots[1]);
  const reused = await manager.getSession(roots[0]);
  assert.ok(reused);
  reused.lastUsedAt = Date.now() + 1000;

  await manager.activateProject(roots[2]);

  assert.deepEqual(stopCalls, [roots[1]]);
  assert.equal(manager.getSession(roots[1]), undefined);
  assert.ok(manager.getSession(roots[0]));
  assert.ok(manager.getSession(roots[2]));
});

test('SerenaManager reaps idle sessions before activating a new one', async () => {
  const projectRoot = mkProject('idle');
  let stopped = 0;

  const manager = new SerenaManager(makeConfig({ idleTimeoutSec: 1 }), makeLogger(), async (root) => ({
    projectRoot: root,
    createdAt: Date.now() - 10_000,
    lastUsedAt: Date.now() - 10_000,
    toolNames: [],
    async stop() { stopped += 1; },
    async listTools() { return []; },
    async callTool() { return null; },
  }));

  await manager.activateProject(projectRoot);
  const session = manager.getSession(projectRoot);
  session.lastUsedAt = Date.now() - 10_000;

  await manager.activateProject(mkProject('fresh'));

  assert.equal(stopped, 1);
  assert.equal(manager.getSession(projectRoot), undefined);
});


test('SerenaManager rejects projects outside allowedRoots', async () => {
  const allowed = mkProject('allowed-parent');
  const outside = mkProject('outside');

  const manager = new SerenaManager(makeConfig({ allowedRoots: [allowed] }), makeLogger(), async (root) => ({
    projectRoot: root,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    toolNames: [],
    async stop() {},
    async listTools() { return []; },
    async callTool() { return null; },
  }));

  await assert.rejects(() => manager.activateProject(outside), /outside allowedRoots/);
});
