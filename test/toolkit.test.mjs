import test from 'node:test';
import assert from 'node:assert/strict';

import { registerSerenaTools } from '../dist/toolkit.js';

function makeApi() {
  const tools = new Map();
  return {
    tools,
    registerTool(definition) {
      tools.set(definition.name, definition);
    },
  };
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
    toolMode: 'both',
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

function makeManager(callLog) {
  return {
    async activateProject(projectPath) {
      return {
        projectRoot: projectPath,
        toolNames: ['find_symbol'],
        async stop() {},
        async listTools() { return ['find_symbol']; },
        async callTool(name, args) {
          callLog.push({ name, args });
          return { ok: true, name, args };
        },
      };
    },
    status() {
      return { enabled: true, sessionCount: 0, sessions: [] };
    },
  };
}

async function execute(api, name, params) {
  const tool = api.tools.get(name);
  assert.ok(tool, `Tool ${name} should be registered`);
  return tool.execute('test', params);
}

test('normalized tool strips undefined params before calling Serena', async () => {
  const api = makeApi();
  const calls = [];
  registerSerenaTools(api, makeManager(calls), makeConfig());

  await execute(api, 'serena_find_symbol', {
    projectPath: '/repo',
    namePath: 'register',
    includeBody: true,
    relativePath: undefined,
  });

  assert.deepEqual(calls, [{
    name: 'find_symbol',
    args: {
      name_path_pattern: 'register',
      include_body: true,
    },
  }]);
});

test('read-only mode blocks semantic write tools and raw mutating tools', async () => {
  const api = makeApi();
  const calls = [];
  registerSerenaTools(api, makeManager(calls), makeConfig({ readOnly: true }));

  await assert.rejects(
    () => execute(api, 'serena_replace_symbol_body', {
      projectPath: '/repo',
      namePath: 'register',
      relativePath: 'src/index.ts',
      newBody: 'return 1;',
    }),
    /read-only mode/i,
  );

  await assert.rejects(
    () => execute(api, 'serena_call_tool', {
      projectPath: '/repo',
      toolName: 'write_memory',
      toolArgs: {},
    }),
    /read-only mode blocks mutating Serena tools/i,
  );

  assert.equal(calls.length, 0);
});

test('allowlist and denylist gate normalized and passthrough tools', async () => {
  const api = makeApi();
  const calls = [];
  registerSerenaTools(api, makeManager(calls), makeConfig({
    serenaToolAllowlist: ['find_symbol'],
    serenaToolDenylist: ['read_file'],
  }));

  await execute(api, 'serena_find_symbol', {
    projectPath: '/repo',
    namePath: 'register',
  });

  await assert.rejects(
    () => execute(api, 'serena_search_pattern', {
      projectPath: '/repo',
      pattern: 'register',
    }),
    /Denied Serena tool: search_for_pattern/,
  );

  await assert.rejects(
    () => execute(api, 'serena_read_file', {
      projectPath: '/repo',
      relativePath: 'src/index.ts',
    }),
    /Denied Serena tool: read_file/,
  );

  await assert.rejects(
    () => execute(api, 'serena_call_tool', {
      projectPath: '/repo',
      toolName: 'read_file',
      toolArgs: {},
    }),
    /Denied Serena tool: read_file/,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'find_symbol');
});

test('new normalized wrappers map to the expected Serena upstream tools', async () => {
  const api = makeApi();
  const calls = [];
  registerSerenaTools(api, makeManager(calls), makeConfig());

  await execute(api, 'serena_read_file', {
    projectPath: '/repo',
    relativePath: 'src/index.ts',
    maxAnswerChars: 1000,
  });
  await execute(api, 'serena_list_dir', {
    projectPath: '/repo',
    relativePath: 'src',
    recursive: true,
  });
  await execute(api, 'serena_find_file', {
    projectPath: '/repo',
    fileMask: 'toolkit',
    relativePath: 'src',
  });
  await execute(api, 'serena_insert_before_symbol', {
    projectPath: '/repo',
    namePath: 'register',
    relativePath: 'src/index.ts',
    snippet: '// before',
  });
  await execute(api, 'serena_rename_symbol', {
    projectPath: '/repo',
    namePath: 'register',
    relativePath: 'src/index.ts',
    newName: 'registerPlugin',
  });
  await execute(api, 'serena_replace_content', {
    projectPath: '/repo',
    relativePath: 'src/index.ts',
    oldContent: 'old',
    newContent: 'new',
  });
  await execute(api, 'serena_create_text_file', {
    projectPath: '/repo',
    relativePath: 'notes.txt',
    content: 'hello',
  });
  await execute(api, 'serena_execute_shell_command', {
    projectPath: '/repo',
    command: 'pwd',
  });

  assert.deepEqual(calls, [
    { name: 'read_file', args: { relative_path: 'src/index.ts', max_answer_chars: 1000 } },
    { name: 'list_dir', args: { relative_path: 'src', recursive: true } },
    { name: 'find_file', args: { file_mask: 'toolkit', relative_path: 'src' } },
    { name: 'insert_before_symbol', args: { name_path: 'register', relative_path: 'src/index.ts', body: '// before' } },
    { name: 'rename_symbol', args: { name_path: 'register', relative_path: 'src/index.ts', new_name: 'registerPlugin' } },
    { name: 'replace_content', args: { relative_path: 'src/index.ts', old_content: 'old', new_content: 'new' } },
    { name: 'create_text_file', args: { relative_path: 'notes.txt', content: 'hello' } },
    { name: 'execute_shell_command', args: { command: 'pwd' } },
  ]);
});
