import ora from "ora";
import { join } from "path";
import { createReadStream, rmSync } from "fs";

import P2P from "./p2p";
import { colorize } from "../utils/colors";
import type { P2PInit } from "../utils/types";
import { initDynamicImports } from "../utils/helpers";
import { zipFolderIgnoringGitignore } from "../utils/zip";

export default class Remote extends P2P {
    constructor(_: P2PInit) {
        super();

        this.connection = _.connection;
        this.nodePeerID = _.nodePeerID;
        this.peerID = _.peerID;
    }

    async pull(path: string) {}

    async push(path: string) {
        const pushStream = await this.connection.newStream(this.PUSH_PROTOCOL);

        const [[{ source }], { name: zipName }] = await Promise.all([
            initDynamicImports(["stream-to-it"]),
            zipFolderIgnoringGitignore(path),
        ]);

        const spinner = ora(`Pushing to repository`).start();
        const zipPath = join(path, zipName);

        try {
            const fileStream = createReadStream(zipPath);
            const source_ = source(fileStream);

            await pushStream.sink(source_);
            const response = await this.parseChunk(pushStream);

            if (response?.status === false)
                throw new Error(response.message || "An error occurred while pushing.");

            console.log("\n")
            console.log(colorize.successIcon("Pushed successfully!"));
            console.log(
                `\nBlob ID: ${colorize.highlight(response.blobId)}\nRepository ID: ${colorize.highlight(response.id)}`,
            );
        } catch (err) {
            console.error(colorize.errorIcon("Failed to push"));
            console.error(colorize.error(err as unknown as string));
        } finally {
            spinner.stop();

            try {
                rmSync(zipPath, { force: true });
            } catch (e) {
                // Ignore cleanup errors
                console.warn("Failed to clean up zip file:", e);
            }
        }
    }

    async clone() {}

    async rename(newName: string, blobId?: string, id?: string) {
        const renameStream = await this.connection.newStream(this.RENAME_PROTOCOL);

        const message = JSON.stringify({
            name: newName,
            blobId,
            id,
        });

        await this.sink(renameStream, message);

        const response = await this.parseChunk(renameStream);

        if (response?.status === false) {
            throw new Error(response.message || "An error occurred while renaming.");
        }

        return response;
    }
}
