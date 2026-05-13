export function registerSerenaCli(program, manager) {
    const root = program.command("serena").description("Inspect and control Serena plugin sessions");
    root
        .command("status")
        .description("Show current Serena plugin status")
        .action(() => {
        console.log(JSON.stringify(manager.status(), null, 2));
    });
    root
        .command("restart")
        .description("Restart Serena for a project path")
        .argument("<projectPath>", "Project path")
        .action(async (projectPath) => {
        const session = await manager.restartProject(projectPath);
        console.log(JSON.stringify({ projectRoot: session.projectRoot, toolNames: await session.listTools() }, null, 2));
    });
}
//# sourceMappingURL=cli.js.map