# Release Notes — 0.1.0

`serena-openclaw-plugin` brings Serena MCP into OpenClaw as a proper plugin.

## Highlights

- first-class Serena project activation inside OpenClaw
- normalized semantic coding tools for agents
- safer operator controls via allowed roots, read-only mode, and upstream tool allow/deny lists
- per-project session reuse with idle and capacity eviction
- publish-ready npm/OpenClaw plugin structure
- bundled `serena` skill shipped with the plugin
- automated test coverage and CI

## Validation completed

- `npm run check`
- `npm test`
- `npm run pack:check`
- local plugin link install via `openclaw plugins install -l`

## Recommended post-publish verification

- install from npm in a clean OpenClaw environment
- verify one real Serena activation end-to-end
- confirm README commands match the final published package name
