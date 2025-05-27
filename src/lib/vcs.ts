import { existsSync } from "fs";
import { join } from "path";

export default class VCS {
    static checkInitalized(path: string): boolean {
        return existsSync(join(path, "/.direct"));
    }
}