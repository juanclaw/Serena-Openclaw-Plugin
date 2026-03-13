# Publishing guide

## Package identity

Current package name:

- `serena-openclaw-plugin`

Stable plugin id:

- `serena-openclaw-plugin`

Before publishing, confirm the final npm scope is really the one you want. Changing npm package name later is much more annoying than changing docs now.

## Release checklist

### Code quality

1. Run `npm ci`.
2. Run `npm run check`.
3. Run `npm test`.
4. Run `npm run pack:check`.
5. Confirm `.github/workflows/ci.yml` is green on the target branch.

### Runtime validation

6. Validate one local install through OpenClaw using a linked or packed package.
7. Confirm the config schema still matches runtime config parsing.
8. Confirm normalized tool names still match Serena upstream behavior.
9. Verify at least one real Serena MCP startup using your intended default command.

### Release hygiene

10. Review `README.md` for the final package name, install command, and bundled skill guidance.
11. Review `openclaw.plugin.json` labels/schema and bundled `skills` paths for correctness.
12. Confirm `LICENSE`, package version, and changelog/release notes are ready.
13. If you have a public repository, add correct `repository`, `homepage`, and `bugs` fields to `package.json`.

## Local install test

Example dev install once the package is built:

```bash
openclaw plugins install -l /path/to/serena-openclaw-plugin
```

Then configure:

```json5
{
  plugins: {
    entries: {
      "serena-openclaw-plugin": {
        enabled: true,
        config: {
          command: "/absolute/path/to/serena",
          args: [
            "start-mcp-server",
            "--project-from-cwd",
            "--enable-web-dashboard",
            "false",
            "--open-web-dashboard",
            "false"
          ],
          allowedRoots: ["/path/to/code"],
          toolMode: "both"
        }
      }
    }
  }
}
```

Restart the gateway after config changes.

## Package inspection

Use this before publishing to inspect what will actually ship:

```bash
npm run pack:check
```

For a real tarball:

```bash
npm pack
```

## npm publish

When ready:

```bash
npm publish --access public
```

If publishing under a personal or organization scope, ensure that scope exists and is configured in npm first.
