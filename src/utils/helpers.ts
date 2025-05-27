import P2P from "../lib/p2p";
import type { P2PInit } from "./types";

// Ugly implementation to solve 'No "exports" main defined in package.json' problem
const dynamicImport = async (packageName: string) => new Function(`return import('${packageName}')`)();

export async function initDynamicImports(libs: string[]) {
    return await Promise.all(libs.map(lib => dynamicImport(lib)));
}

// Initialize P2P connection
export async function p2pStarter(p2p: P2P): Promise<P2PInit> {
    return await p2p.init();
}
