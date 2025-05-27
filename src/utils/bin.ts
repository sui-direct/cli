import { join } from "path";
import { exec } from "child_process";

const extension = process.platform === "win32" ? "exe" : "bin";
export const directVCSPath = join(__dirname, "../..", "bin", `vcs.${extension}`);

export const directVCS = (command: string) => {
    exec(`${directVCSPath} ${command}`, (error, stdout, stderr) => {
        if (error) {
            console.error(error.message);
            return;
        }
        if (stderr) {
            console.error(stderr);
            return;
        }
        console.log(stdout);
    });
};
