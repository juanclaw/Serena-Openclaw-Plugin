import { Type } from "@sinclair/typebox";
import type { SerenaManager } from "./serena-manager.js";
import type { SerenaPluginConfig } from "./types.js";

function json(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function requireWriteAllowed(config: SerenaPluginConfig) {
  if (config.readOnly) {
    throw new Error("Serena plugin is configured in read-only mode");
  }
}

async function requireSession(manager: SerenaManager, projectPath: string) {
  return manager.activateProject(projectPath);
}

export function registerSerenaTools(api: any, manager: SerenaManager, config: SerenaPluginConfig) {
  api.registerTool(
    {
      name: "serena_activate_project",
      description: "Start or attach to a Serena semantic coding session for a project path.",
      parameters: Type.Object({ projectPath: Type.String() }),
      async execute(_id: string, params: { projectPath: string }) {
        const session = await manager.activateProject(params.projectPath);
        const toolNames = await session.listTools();
        return json({ projectRoot: session.projectRoot, toolNames });
      },
    },
  );

  api.registerTool(
    {
      name: "serena_session_status",
      description: "Inspect cached Serena project sessions managed by the plugin.",
      parameters: Type.Object({}),
      async execute() {
        return json(manager.status());
      },
    },
  );

  const overviewParams = Type.Object({
    projectPath: Type.String(),
    relativePath: Type.String(),
    depth: Type.Optional(Type.Number()),
    maxAnswerChars: Type.Optional(Type.Number()),
  });

  const symbolParams = Type.Object({
    projectPath: Type.String(),
    namePath: Type.String(),
    relativePath: Type.Optional(Type.String()),
    depth: Type.Optional(Type.Number()),
    includeBody: Type.Optional(Type.Boolean()),
    includeInfo: Type.Optional(Type.Boolean()),
    substringMatching: Type.Optional(Type.Boolean()),
    maxAnswerChars: Type.Optional(Type.Number()),
  });

  const pathParams = Type.Object({
    projectPath: Type.String(),
    relativePath: Type.String(),
    maxAnswerChars: Type.Optional(Type.Number()),
  });

  api.registerTool(
    {
      name: "serena_project_overview",
      description: "Request a semantic symbol overview for a file in the active project.",
      parameters: overviewParams,
      async execute(_id: string, params: { projectPath: string; relativePath: string; depth?: number; maxAnswerChars?: number }) {
        const session = await requireSession(manager, params.projectPath);
        return json(await callNormalized(session, config, "get_symbols_overview", {
          relative_path: params.relativePath,
          depth: params.depth,
          max_answer_chars: params.maxAnswerChars,
        }));
      },
    },
  );

  api.registerTool(
    {
      name: "serena_find_symbol",
      description: "Find a symbol in the project using Serena semantic tools.",
      parameters: symbolParams,
      async execute(_id: string, params: any) {
        const session = await requireSession(manager, params.projectPath);
        return json(await callNormalized(session, config, "find_symbol", {
          name_path_pattern: params.namePath,
          relative_path: params.relativePath,
          depth: params.depth,
          include_body: params.includeBody,
          include_info: params.includeInfo,
          substring_matching: params.substringMatching,
          max_answer_chars: params.maxAnswerChars,
        }));
      },
    },
  );

  api.registerTool(
    {
      name: "serena_find_references",
      description: "Find references to a symbol using Serena semantic tools.",
      parameters: symbolParams,
      async execute(_id: string, params: any) {
        const session = await requireSession(manager, params.projectPath);
        return json(await callNormalized(session, config, "find_referencing_symbols", {
          name_path: params.namePath,
          relative_path: params.relativePath,
          max_answer_chars: params.maxAnswerChars,
        }));
      },
    },
  );

  api.registerTool(
    {
      name: "serena_search_pattern",
      description: "Search for a text or regex pattern via Serena.",
      parameters: Type.Object({
        projectPath: Type.String(),
        pattern: Type.String(),
        relativePath: Type.Optional(Type.String()),
        restrictToCodeFiles: Type.Optional(Type.Boolean()),
      }),
      async execute(_id: string, params: any) {
        const session = await requireSession(manager, params.projectPath);
        return json(await callNormalized(session, config, "search_for_pattern", {
          substring_pattern: params.pattern,
          relative_path: params.relativePath,
          restrict_search_to_code_files: params.restrictToCodeFiles,
        }));
      },
    },
  );

  api.registerTool(
    {
      name: "serena_read_symbol",
      description: "Read a symbol body or details from Serena.",
      parameters: symbolParams,
      async execute(_id: string, params: any) {
        const session = await requireSession(manager, params.projectPath);
        return json(await callNormalized(session, config, "find_symbol", {
          name_path_pattern: params.namePath,
          relative_path: params.relativePath,
          depth: params.depth,
          include_body: params.includeBody ?? true,
          include_info: params.includeInfo,
          substring_matching: params.substringMatching,
          max_answer_chars: params.maxAnswerChars,
        }));
      },
    },
  );

  api.registerTool(
    {
      name: "serena_read_file",
      description: "Read a file via Serena within the active project.",
      parameters: pathParams,
      async execute(_id: string, params: any) {
        const session = await requireSession(manager, params.projectPath);
        return json(await callNormalized(session, config, "read_file", {
          relative_path: params.relativePath,
          max_answer_chars: params.maxAnswerChars,
        }));
      },
    },
  );

  api.registerTool(
    {
      name: "serena_list_dir",
      description: "List a directory via Serena within the active project.",
      parameters: Type.Object({
        projectPath: Type.String(),
        relativePath: Type.Optional(Type.String()),
        recursive: Type.Optional(Type.Boolean()),
        maxAnswerChars: Type.Optional(Type.Number()),
      }),
      async execute(_id: string, params: any) {
        const session = await requireSession(manager, params.projectPath);
        return json(await callNormalized(session, config, "list_dir", {
          relative_path: params.relativePath,
          recursive: params.recursive,
          max_answer_chars: params.maxAnswerChars,
        }));
      },
    },
  );

  api.registerTool(
    {
      name: "serena_find_file",
      description: "Find files by name or pattern via Serena.",
      parameters: Type.Object({
        projectPath: Type.String(),
        fileMask: Type.String(),
        relativePath: Type.Optional(Type.String()),
      }),
      async execute(_id: string, params: any) {
        const session = await requireSession(manager, params.projectPath);
        return json(await callNormalized(session, config, "find_file", {
          file_mask: params.fileMask,
          relative_path: params.relativePath,
        }));
      },
    },
  );

  api.registerTool(
    {
      name: "serena_replace_symbol_body",
      description: "Replace the body of a symbol with semantic targeting.",
      parameters: Type.Object({
        projectPath: Type.String(),
        namePath: Type.String(),
        newBody: Type.String(),
        relativePath: Type.String(),
      }),
      async execute(_id: string, params: any) {
        requireWriteAllowed(config);
        const session = await requireSession(manager, params.projectPath);
        return json(await callNormalized(session, config, "replace_symbol_body", {
          name_path: params.namePath,
          relative_path: params.relativePath,
          body: params.newBody,
        }));
      },
    },
    { optional: true },
  );

  api.registerTool(
    {
      name: "serena_insert_after_symbol",
      description: "Insert code after a symbol using Serena semantic editing.",
      parameters: Type.Object({
        projectPath: Type.String(),
        namePath: Type.String(),
        snippet: Type.String(),
        relativePath: Type.String(),
      }),
      async execute(_id: string, params: any) {
        requireWriteAllowed(config);
        const session = await requireSession(manager, params.projectPath);
        return json(await callNormalized(session, config, "insert_after_symbol", {
          name_path: params.namePath,
          relative_path: params.relativePath,
          body: params.snippet,
        }));
      },
    },
    { optional: true },
  );

  api.registerTool(
    {
      name: "serena_insert_before_symbol",
      description: "Insert code before a symbol using Serena semantic editing.",
      parameters: Type.Object({
        projectPath: Type.String(),
        namePath: Type.String(),
        snippet: Type.String(),
        relativePath: Type.String(),
      }),
      async execute(_id: string, params: any) {
        requireWriteAllowed(config);
        const session = await requireSession(manager, params.projectPath);
        return json(await callNormalized(session, config, "insert_before_symbol", {
          name_path: params.namePath,
          relative_path: params.relativePath,
          body: params.snippet,
        }));
      },
    },
    { optional: true },
  );

  api.registerTool(
    {
      name: "serena_rename_symbol",
      description: "Rename a symbol using Serena semantic editing.",
      parameters: Type.Object({
        projectPath: Type.String(),
        namePath: Type.String(),
        newName: Type.String(),
        relativePath: Type.String(),
      }),
      async execute(_id: string, params: any) {
        requireWriteAllowed(config);
        const session = await requireSession(manager, params.projectPath);
        return json(await callNormalized(session, config, "rename_symbol", {
          name_path: params.namePath,
          relative_path: params.relativePath,
          new_name: params.newName,
        }));
      },
    },
    { optional: true },
  );

  api.registerTool(
    {
      name: "serena_replace_content",
      description: "Replace file content via Serena for non-symbol-scoped edits.",
      parameters: Type.Object({
        projectPath: Type.String(),
        relativePath: Type.String(),
        oldContent: Type.String(),
        newContent: Type.String(),
      }),
      async execute(_id: string, params: any) {
        requireWriteAllowed(config);
        const session = await requireSession(manager, params.projectPath);
        return json(await callNormalized(session, config, "replace_content", {
          relative_path: params.relativePath,
          old_content: params.oldContent,
          new_content: params.newContent,
        }));
      },
    },
    { optional: true },
  );

  api.registerTool(
    {
      name: "serena_create_text_file",
      description: "Create a text file via Serena within the active project.",
      parameters: Type.Object({
        projectPath: Type.String(),
        relativePath: Type.String(),
        content: Type.String(),
      }),
      async execute(_id: string, params: any) {
        requireWriteAllowed(config);
        const session = await requireSession(manager, params.projectPath);
        return json(await callNormalized(session, config, "create_text_file", {
          relative_path: params.relativePath,
          content: params.content,
        }));
      },
    },
    { optional: true },
  );

  api.registerTool(
    {
      name: "serena_execute_shell_command",
      description: "Execute a shell command via Serena in the active project context.",
      parameters: Type.Object({
        projectPath: Type.String(),
        command: Type.String(),
      }),
      async execute(_id: string, params: any) {
        requireWriteAllowed(config);
        const session = await requireSession(manager, params.projectPath);
        return json(await callNormalized(session, config, "execute_shell_command", {
          command: params.command,
        }));
      },
    },
    { optional: true },
  );

  if (config.toolMode === "passthrough" || config.toolMode === "both") {
    api.registerTool(
      {
        name: "serena_call_tool",
        description: "Call a raw Serena MCP tool by name for forward-compatible experimentation.",
        parameters: Type.Object({
          projectPath: Type.String(),
          toolName: Type.String(),
          toolArgs: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
        }),
        async execute(_id: string, params: any) {
          if (isDenied(config, params.toolName)) {
            throw new Error(`Denied Serena tool: ${params.toolName}`);
          }
          if (config.readOnly && looksLikeWriteTool(params.toolName)) {
            throw new Error("Read-only mode blocks mutating Serena tools");
          }
          const session = await requireSession(manager, params.projectPath);
          return json(await session.callTool(params.toolName, params.toolArgs ?? {}));
        },
      },
      { optional: true },
    );
  }
}

async function callNormalized(
  session: Awaited<ReturnType<typeof requireSession>>,
  config: SerenaPluginConfig,
  toolName: string,
  args: Record<string, unknown>,
) {
  if (isDenied(config, toolName)) {
    throw new Error(`Denied Serena tool: ${toolName}`);
  }
  return session.callTool(toolName, stripUndefined(args));
}

function isDenied(config: SerenaPluginConfig, toolName: string): boolean {
  if (config.serenaToolAllowlist.length > 0 && !config.serenaToolAllowlist.includes(toolName)) {
    return true;
  }
  return config.serenaToolDenylist.includes(toolName);
}

function looksLikeWriteTool(toolName: string): boolean {
  return /(replace|insert|write|edit|rename|delete|create)/i.test(toolName);
}

function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
