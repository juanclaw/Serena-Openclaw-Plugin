import type { SerenaManager } from "./serena-manager.js";
interface ProgramLike {
    command(name: string): {
        description(text: string): any;
        argument(spec: string, desc: string): any;
        action(fn: (...args: any[]) => any): any;
    };
}
export declare function registerSerenaCli(program: ProgramLike, manager: SerenaManager): void;
export {};
