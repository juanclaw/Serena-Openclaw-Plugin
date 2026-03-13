# Architecture

## Intent

This plugin turns Serena into a reusable OpenClaw capability instead of a one-off local trick.

## Boundaries

### Plugin responsibilities

- own Serena process/session lifecycle
- validate project paths against allowed roots
- cache/reuse per-project Serena sessions
- expose stable OpenClaw agent tools
- offer a CLI surface for inspection and restart
- provide future-compatible raw passthrough when needed

### Skill responsibilities

- decide when Serena should be used
- teach the agent to prefer semantic navigation over brute-force file reading
- define fallback behavior when Serena is unavailable or unsuitable
- keep editing discipline consistent across projects and users

## Session model

One Serena session is associated with one resolved project root.

Lifecycle policy:

1. Agent activates a project path.
2. Plugin resolves the project root using marker files.
3. Plugin enforces `allowedRoots`.
4. Existing cached session is reused when allowed.
5. Idle sessions expire after `idleTimeoutSec`.
6. Oldest sessions are evicted when `maxSessions` is reached.

## Tool layers

### Normalized OpenClaw tools

These are the long-term public contract for agents:

- `serena_activate_project`
- `serena_project_overview`
- `serena_find_symbol`
- `serena_find_references`
- `serena_search_pattern`
- `serena_read_symbol`
- `serena_replace_symbol_body`
- `serena_insert_after_symbol`
- `serena_session_status`

### Raw passthrough tool

`serena_call_tool` exists to preserve compatibility with upstream Serena tool evolution.

Use it when:

- a new Serena release adds a tool the plugin has not normalized yet
- you want to experiment before promoting a capability to the stable surface

Avoid using passthrough as the default workflow in agent guidance.

## Safety model

- only allow activation within configured `allowedRoots`
- read-only mode blocks mutating tool calls
- explicit allow/deny lists can narrow exposed Serena upstream tools
- plugin tools are optional in OpenClaw, so operators must opt in

## Publishability

The repository follows OpenClaw plugin conventions:

- `openclaw.plugin.json` at the plugin root
- npm package with `openclaw.extensions`
- runtime code isolated under `src/`
- no workspace-specific assumptions beyond user-provided config

## Future roadmap

### Near-term

- improve error mapping and diagnostics
- add structured telemetry for startup failures and slow calls
- optionally normalize more Serena tools such as `rename_symbol` and `insert_before_symbol`
- add one clean-room install verification against a fresh OpenClaw environment

### Verified so far

- local Serena binary discovery succeeded on this machine
- stdio MCP session startup succeeded
- upstream tool discovery succeeded
- live `find_symbol` invocation succeeded against this plugin repository

### Mid-term

- dynamic normalization from upstream tool metadata
- repo-local overrides
- richer project activation heuristics
- better language-server health diagnostics

### Long-term

- deeper OpenClaw/Serena workflow integration
- advanced safe refactor flows
- optional project memory bridging when Serena capabilities support it
