# Changelog

## 0.1.7

### Changed

- Ship `dist/` in the repository so ClawHub `package publish --family code-plugin` can package the plugin from a clean GitHub checkout without invoking the local TypeScript compiler.
- Drop the `prepare: "npm run build"` lifecycle script. ClawHub publish runs `npm pack` inside a temp checkout that has no devDependencies, so `prepare → tsc` was failing with `'tsc' is not recognized`. `prepublishOnly` is removed for the same reason; build remains available as a manual `npm run build`.

## 0.1.6

### Changed

- Align skill layout with OpenClaw's standard convention. The manifest now points at a `./skills` container, with each skill in its own subdirectory keyed by skill id (`skills/serena/SKILL.md`). Fixes runtime "plugin skill name collision" warnings against other plugins that follow the same convention.
- `package.json` `files` now ships the whole `skills` directory (and `CHANGELOG.md`).

## 0.1.5

### Changed

- Bump `openclaw.compat.pluginApi` and `builtWithOpenClawVersion` to `2026.5.7` so the plugin loads on OpenClaw 2026.5.7 runtimes. `minGatewayVersion` left at `2026.3.13` since no new APIs are consumed.
- Declare all 18 registered tools under `contracts.tools` in `openclaw.plugin.json`. Starting with the 2026.5.x runtime, plugins must declare their tool surface in the manifest before runtime `registerTool` calls are accepted.

## 0.1.0

Initial public release candidate.

### Added

- OpenClaw plugin manifest and npm packaging for Serena integration
- normalized Serena tool surface for project activation, overview, symbol lookup, references, pattern search, and symbol reads
- semantic edit tools for replace/insert flows
- optional passthrough tool for raw Serena MCP access
- per-project session manager with reuse, idle eviction, and capacity eviction
- allowed-roots enforcement and project-root detection
- read-only mode plus allowlist/denylist controls for upstream Serena tools
- CLI commands for Serena status and restart flows
- automated tests for config parsing, path safety, manager lifecycle, toolkit gating, MCP session wiring, and plugin registration
- GitHub Actions CI for typecheck, tests, and package inspection

### Notes

- Package is intended for OpenClaw 2026.1.0+
- Final publish should still be validated once in a clean OpenClaw environment
