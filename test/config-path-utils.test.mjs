import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveConfig } from '../dist/config.js';
import { findProjectRoot, isWithinAllowedRoots, normalizeExistingPath } from '../dist/path-utils.js';

function mkdtemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'serena-openclaw-plugin-test-'));
}

test('resolveConfig applies defaults and sanitizes invalid values', () => {
  const config = resolveConfig({
    enabled: 0,
    command: '  ',
    args: ['--ok', 42, 'value'],
    env: { GOOD: 'yes', BAD: 123 },
    toolMode: 'nope',
    allowedRoots: [' ', '/tmp/project'],
    projectMarkers: ['.git', '', 'package.json'],
    idleTimeoutSec: 0,
    maxSessions: -1,
    startupTimeoutMs: 999,
    serenaToolAllowlist: ['find_symbol', 5],
    serenaToolDenylist: ['write_memory', false],
  });

  assert.equal(config.enabled, false);
  assert.equal(config.command, 'auto');
  assert.deepEqual(config.args, ['--ok', 'value']);
  assert.deepEqual(config.env, { GOOD: 'yes' });
  assert.equal(config.toolMode, 'normalized');
  assert.deepEqual(config.allowedRoots, ['/tmp/project']);
  assert.deepEqual(config.projectMarkers, ['.git', 'package.json']);
  assert.equal(config.idleTimeoutSec, 900);
  assert.equal(config.maxSessions, 6);
  assert.equal(config.startupTimeoutMs, 20000);
  assert.deepEqual(config.serenaToolAllowlist, ['find_symbol']);
  assert.deepEqual(config.serenaToolDenylist, ['write_memory']);
});

test('normalizeExistingPath resolves to canonical real path', () => {
  const root = mkdtemp();
  const nested = path.join(root, 'nested');
  fs.mkdirSync(nested);

  const actual = normalizeExistingPath(path.join(root, '.', 'nested', '..'));
  assert.equal(actual, fs.realpathSync.native(root));
});

test('findProjectRoot walks upward until marker is found', () => {
  const root = mkdtemp();
  const project = path.join(root, 'repo');
  const deep = path.join(project, 'src', 'feature');
  fs.mkdirSync(deep, { recursive: true });
  fs.writeFileSync(path.join(project, 'package.json'), '{}');
  fs.writeFileSync(path.join(deep, 'file.ts'), 'export {};');

  assert.equal(findProjectRoot(deep, ['package.json']), fs.realpathSync.native(project));
  assert.equal(findProjectRoot(path.join(deep, 'file.ts'), ['package.json']), fs.realpathSync.native(project));
});

test('isWithinAllowedRoots accepts descendants and rejects siblings', () => {
  const root = mkdtemp();
  const allowed = path.join(root, 'allowed');
  const child = path.join(allowed, 'child');
  const sibling = path.join(root, 'sibling');
  fs.mkdirSync(child, { recursive: true });
  fs.mkdirSync(sibling, { recursive: true });

  assert.equal(isWithinAllowedRoots(normalizeExistingPath(child), [allowed]), true);
  assert.equal(isWithinAllowedRoots(normalizeExistingPath(allowed), [allowed]), true);
  assert.equal(isWithinAllowedRoots(normalizeExistingPath(sibling), [allowed]), false);
  assert.equal(isWithinAllowedRoots(normalizeExistingPath(sibling), []), true);
});
