# serena-openclaw-plugin

Serena MCP integration for OpenClaw as a publishable plugin.

This plugin lets an OpenClaw agent use Serena as a first-class semantic coding backend instead of relying on ad-hoc shell commands. It is designed for people who want their agent to activate projects, inspect symbols, trace references, search semantically, and perform targeted code edits through a stable OpenClaw tool surface.

The plugin also ships its own bundled skill, `serena`, so users get both the capability layer and the recommended agent workflow from a single install.

## Who this is for

Use this plugin if you want:

- an OpenClaw agent to work semantically inside existing codebases
- project-scoped Serena session reuse instead of repeated one-off process launches
- a stable normalized tool surface for agent prompts and skills
- optional passthrough access to raw upstream Serena tools when needed
- safety controls like allowed roots, read-only mode, and upstream tool allow/deny lists

This is especially useful for agents that work across multi-file repositories where symbol-aware navigation is more reliable than brute-force file reading.

## What the plugin provides

Core capabilities:

- per-project Serena session management
- project-root detection from common repo markers
- allowed-root enforcement before activating a project
- session reuse, idle cleanup, and max-session eviction
- normalized OpenClaw tools for common Serena workflows
- optional passthrough tool for raw Serena MCP access
- optional read-only mode for browsing/analysis-only deployments
- launcher flexibility for different Serena install styles

## How it works

At a high level:

1. The agent calls `serena_activate_project` with any path inside a repo.
2. The plugin resolves the actual project root using configured marker files.
3. The plugin checks that the project root is inside `allowedRoots`.
4. The plugin either reuses an existing Serena session or starts a new one.
5. The agent uses normalized tools such as `serena_find_symbol` or `serena_find_references`.
6. When enabled, semantic edit tools can mutate code through Serena.

This means your agent does not have to manage Serena processes manually.

## Installation

### Option A: install from npm

```bash
openclaw plugins install serena-openclaw-plugin
```

### Option B: install from a local checkout

```bash
openclaw plugins install -l /path/to/serena-openclaw-plugin
```

After installation:

1. Enable the plugin in your OpenClaw config.
2. Configure its launcher and safety settings.
3. Restart the gateway.
4. Ask your agent to use the exposed Serena tools.
5. If plugin skills are enabled in OpenClaw, the bundled `serena` skill will load automatically with the plugin.

## Minimal OpenClaw configuration

Add an entry like this under `plugins.entries`:

```json5
{
  plugins: {
    entries: {
      "serena-openclaw-plugin": {
        enabled: true,
        config: {
          enabled: true,
          command: "auto",
          args: [],
          allowedRoots: ["/home/you/code", "/home/you/workspace"],
          reuseSessions: true,
          toolMode: "both",
          readOnly: false,
          startupTimeoutMs: 20000
        }
      }
    }
  }
}
```

Then restart OpenClaw:

```bash
openclaw gateway restart
```

## Serena launcher modes

Serena can be installed in different ways on different machines. This plugin is designed to handle that.

### 1. Recommended: automatic launcher detection

```json5
{
  command: "auto",
  args: []
}
```

This tries common Serena launch patterns in order:

1. `serena start-mcp-server ...`
2. `uvx --from git+https://github.com/oraios/serena serena start-mcp-server ...`

Use this for the best out-of-box experience when distributing the plugin to other people.

### 2. Serena installed on PATH

```json5
{
  command: "serena",
  args: []
}
```

Use this when Serena is already available as a normal executable on the machine.

### 3. Direct binary or virtualenv path

```json5
{
  command: "/path/to/serena",
  args: []
}
```

Use this when Serena lives in a specific virtual environment or custom install location.

### 4. Explicit uvx launcher

```json5
{
  command: "uvx",
  args: [
    "--from",
    "git+https://github.com/oraios/serena",
    "serena",
    "start-mcp-server",
    "--project-from-cwd",
    "--enable-web-dashboard",
    "false",
    "--open-web-dashboard",
    "false"
  ]
}
```

Use this when you want the launcher behavior to be completely explicit.

### Notes on `args`

If `args` is empty, the plugin infers sensible defaults for:

- `auto`
- `serena`
- a direct `/path/to/serena`
- `uvx`

If startup fails, the plugin returns a helpful error listing the launch plans it tried.

## Recommended safety configuration

For most people, these are sane defaults:

```json5
{
  allowedRoots: ["/home/you/code"],
  reuseSessions: true,
  readOnly: false,
  toolMode: "both",
  idleTimeoutSec: 900,
  maxSessions: 4,
  startupTimeoutMs: 20000
}
```

### If you want a safer analysis-only deployment

```json5
{
  allowedRoots: ["/home/you/code"],
  readOnly: true,
  toolMode: "normalized"
}
```

That lets the agent browse and inspect code semantically while blocking semantic edits and mutating passthrough calls.

## Configuration reference

- `enabled`
  - enable or disable the plugin
- `command`
  - Serena launcher command; use `auto` to try common launchers automatically
- `args`
  - optional Serena launcher arguments; inferred when empty for common launcher styles
- `cwd`
  - optional working directory override for starting Serena
- `env`
  - extra environment variables passed to the Serena process
- `autoStart`
  - reserved for future lifecycle behavior
- `reuseSessions`
  - reuse cached per-project Serena sessions when available
- `readOnly`
  - block mutating semantic edit tools and mutating passthrough tools
- `toolMode`
  - `normalized`, `passthrough`, or `both`
- `allowedRoots`
  - allow project activation only inside these approved roots
- `projectMarkers`
  - files used to detect the actual project root
- `idleTimeoutSec`
  - evict idle sessions after this many seconds
- `maxSessions`
  - maximum cached Serena project sessions
- `startupTimeoutMs`
  - timeout for establishing a Serena MCP session
- `serenaToolAllowlist`
  - when non-empty, allow only these upstream Serena tools
- `serenaToolDenylist`
  - always deny these upstream Serena tools

## Bundled skill

This plugin ships a bundled skill named `serena` under `skills/serena/`.

That means users do not need a separate skill repo or separate `.skill` package to get the recommended Serena workflow guidance. When plugin skills are enabled, OpenClaw can load the bundled skill alongside the plugin tools.

Use the bundled skill when you want another agent to:

- prefer Serena for existing multi-file codebases
- activate the project before semantic reads or edits
- inspect symbols and references before changing code
- prefer normalized Serena tools before passthrough

## Tool surface exposed to agents

### Normalized tools

These are the main tools other agents and skills should use first:

- `serena_activate_project`
- `serena_project_overview`
- `serena_find_symbol`
- `serena_find_references`
- `serena_search_pattern`
- `serena_read_symbol`
- `serena_read_file`
- `serena_list_dir`
- `serena_find_file`
- `serena_replace_symbol_body`
- `serena_insert_after_symbol`
- `serena_insert_before_symbol`
- `serena_rename_symbol`
- `serena_replace_content`
- `serena_create_text_file`
- `serena_execute_shell_command`
- `serena_session_status`

### Passthrough tool

- `serena_call_tool`

Use passthrough when upstream Serena exposes a capability that has not been normalized yet.

## Typical agent workflow

A clean workflow for another agent or skill looks like this:

1. Activate the project:
   - `serena_activate_project`
2. Understand structure:
   - `serena_project_overview`
   - `serena_find_symbol`
3. Trace usage:
   - `serena_find_references`
   - `serena_search_pattern`
4. Read the exact code needed:
   - `serena_read_symbol`
   - `serena_read_file`
5. Make targeted edits if allowed:
   - `serena_replace_symbol_body`
   - `serena_insert_before_symbol`
   - `serena_insert_after_symbol`
   - `serena_rename_symbol`
6. Use `serena_call_tool` only when a normalized tool does not cover the needed Serena feature.

## End-to-end example

Suppose an agent needs to inspect a TypeScript repository and update one function.

### Step 1: activate the project

```json
{
  "projectPath": "/home/you/code/my-repo"
}
```

Tool:
- `serena_activate_project`

### Step 2: find the symbol

```json
{
  "projectPath": "/home/you/code/my-repo",
  "namePath": "register",
  "substringMatching": true,
  "includeInfo": true
}
```

Tool:
- `serena_find_symbol`

### Step 3: inspect references

```json
{
  "projectPath": "/home/you/code/my-repo",
  "namePath": "register",
  "relativePath": "src/index.ts"
}
```

Tool:
- `serena_find_references`

### Step 4: read the body

```json
{
  "projectPath": "/home/you/code/my-repo",
  "namePath": "register",
  "relativePath": "src/index.ts",
  "includeBody": true
}
```

Tool:
- `serena_read_symbol`

### Step 5: replace the symbol body

```json
{
  "projectPath": "/home/you/code/my-repo",
  "namePath": "register",
  "relativePath": "src/index.ts",
  "newBody": "// new implementation here"
}
```

Tool:
- `serena_replace_symbol_body`

## How to integrate this with the bundled skill or another agent

If you are building another skill, or prompting another agent on top of this plugin, guide it like this:

- prefer Serena tools for existing multi-file projects
- activate the project before semantic reads or edits
- prefer normalized tools before raw passthrough
- use symbol-scoped tools before whole-file content replacement
- use `readOnly: true` when the environment should not mutate code
- restrict `allowedRoots` to the directories the agent should be allowed to touch

A good instruction pattern is:

> Use Serena on the target repo. Start with `serena_activate_project`, then use `serena_find_symbol`, `serena_find_references`, and `serena_read_symbol` to narrow scope before editing.

## Troubleshooting

### Serena does not start

Check:

- whether `command` is correct
- whether Serena is installed on PATH or at the configured path
- whether `args` are appropriate for your launcher style
- whether `startupTimeoutMs` is too low for the machine/network

Try `command: "auto"` first if you are unsure.

### The agent cannot activate a repo

Check:

- the path really exists
- the repo root is inside `allowedRoots`
- `projectMarkers` includes at least one file present in the repo root

### Edits are blocked

Check:

- whether `readOnly` is enabled
- whether `serenaToolAllowlist` excludes the needed upstream tool
- whether `serenaToolDenylist` blocks the needed upstream tool

### Some Serena feature is missing as a named tool

Use:

- `serena_call_tool`

That gives access to raw upstream Serena tools when `toolMode` is `passthrough` or `both`.

## Local development

```bash
npm install
npm run check
npm test
npm run pack:check
```

## Verified local Serena command on this machine

The installed local Serena binary was found at:

```bash
/home/opc/serena/.venv/bin/serena
```

A live MCP activation test against this plugin repository succeeded with:

```bash
/home/opc/serena/.venv/bin/serena start-mcp-server --project-from-cwd --enable-web-dashboard false --open-web-dashboard false
```

## Design notes

### Why both normalized and passthrough modes?

A stable OpenClaw-facing API is better for agents and documentation. But Serena evolves quickly, so passthrough keeps experimentation possible without forcing a plugin release for every new upstream tool.

### Why read-only mode?

It gives operators a simple safety switch: semantic navigation and search remain available, but semantic edits and obviously mutating passthrough tools are blocked.

### Why ship a bundled skill with the plugin?

The plugin provides capability. The bundled `serena` skill provides operating discipline and usage heuristics. Shipping both together keeps the workflow guidance aligned with the actual tool surface and gives users a better one-install experience.
