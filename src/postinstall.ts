import { join } from "path";
import { get } from "https";
import type { IncomingMessage } from "http";
import { chmodSync, createWriteStream } from "fs";

import { colorize } from "./utils/colors";
import { Linux, MacOS, Windows } from "./utils/os";

const binDir = join(__dirname, "..", "bin");
const dest = join(binDir, "vcs.exe");
const file = createWriteStream(dest);

const installation = (res: IncomingMessage) => {
    if (["4", "5", undefined].includes(res.statusCode?.toString()?.[0])) {
        console.log(
            colorize.errorIcon(
                "Could not download direct-vcs. Please check your internet connection or try again later.",
            ),
        );
        process.exit(1);
    }

    res.pipe(file);
    file.on("finish", () => {
        file.close();
        chmodSync(dest, 0o755);
        console.log(colorize.successIcon("direct-vcs installed successfully!"));
    });
};

// Install version control
Windows(() => {
    get("https://github.com/sui-direct/vcs/releases/download/v0.1.0/direct.exe", installation);
});
Linux(() => {
    get("https://github.com/sui-direct/vcs/releases/download/v0.1.0/direct.bin", installation);
});
MacOS(() => {
    get("https://github.com/sui-direct/vcs/releases/download/v0.1.0/direct.bin", installation);
});
