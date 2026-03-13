# Changelog

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
