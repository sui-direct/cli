import type { Command } from "commander";

import Auth from "../lib/auth";
import type P2P from "../lib/p2p";
import Remote from "../lib/remote";
import { IUser } from "../utils/types";
import { colorize } from "../utils/colors";
import { p2pStarter } from "../utils/helpers";

export function repositoryCommands(program: Command, p2p: P2P) {
    const repo = program
        .command("repository")
        .aliases(["repo", "r"])
        .description("Manage repositories released on sui.direct nodes.");

    repo.command("list")
        .description("List all repositories")
        .action(() => {
            p2pStarter(p2p).then(_ => {
                const authInstance = new Auth(_);
                (authInstance.getUser() as Promise<{ data: IUser; token: string }>)
                    .then(async user => {
                        const remote = new Remote(_);
                        const list = await remote.list(user.data.publicKey);

                        console.log(
                            colorize.successIcon(
                                `Successfully fetched ${list.length} repositories for user ${colorize.highlight(user.data.publicKey)}.\n`,
                            ),
                        );

                        for (const repo of list) {
                            console.log(
                                `${colorize.warning(repo.name)} - ${colorize.highlight(repo.blobID)}`,
                            );
                        }

                        return process.exit(0);
                    })
                    .catch(error => {
                        if (error) {
                            console.log(colorize.errorIcon("An error occurred."));
                            console.error(colorize.error(error));
                        }
                    })
                    .finally(() => {
                        process.exit(1);
                    });
            });
        });

    repo.command("rename")
        .description("Rename a repository")
        .option("--blob <string>", "Blob ID of the repository")
        .option("--id <string>", "ID of the repository")
        .option("-n, --name <string>", "New name for the repository")
        .action(options => {
            if (!options.name) {
                console.log(
                    colorize.errorIcon(
                        `Please provide a new name for the repository using ${colorize.warning("-n")} or ${colorize.warning("--name")} option.`,
                    ),
                );
            }
            if (!options.blob && !options.id) {
                console.log(
                    colorize.errorIcon(
                        `Please provide the blob ID or repository ID using ${colorize.warning("--blob")} or ${colorize.warning("--id")} option.`,
                    ),
                );
            }
            if (!options.name || (!options.blob && !options.id)) {
                return process.exit(1);
            }

            p2pStarter(p2p).then(_ => {
                const authInstance = new Auth(_);
                (authInstance.getUser() as Promise<{ data: IUser; token: string }>)
                    .then(async () => {
                        const remote = new Remote(_);
                        remote
                            .rename(options.name, options.blob, options.id)
                            .then(() => {
                                console.log(
                                    colorize.successIcon(
                                        `Successfully renamed the repository to ${colorize.highlight(options.name)}.`,
                                    ),
                                );
                            })
                            .catch(error => {
                                if (error) {
                                    console.log(colorize.errorIcon("An error occurred."));
                                    console.error(colorize.error(error));
                                }
                            })
                            .finally(() => {
                                process.exit(0);
                            });
                    })
                    .catch(error => {
                        if (error) {
                            console.log(colorize.errorIcon("An error occurred."));
                            console.error(colorize.error(error));
                        }
                    })
                    .finally(() => {
                        process.exit(0);
                    });
            });
        });

    repo.command("delete")
        .description("Delete a repository")
        .option("--blob <string>", "Blob ID of the repository")
        .option("-n, --name <string>", "Name of the repository")
        .action(options => {
            if (!options.name || !options.blob) {
                console.log(
                    colorize.errorIcon(
                        `Please provide the name and blob ID of the repository using ${colorize.warning("-n")} or ${colorize.warning("--name")} and ${colorize.warning("--blob")} options.`,
                    ),
                );
                return;
            }
        });
}
