import { Command } from "commander";

import VCS from "../lib/vcs";
import Auth from "../lib/auth";
import type P2P from "../lib/p2p";
import Remote from "../lib/remote";
import { directVCS } from "../utils/bin";
import { colorize } from "../utils/colors";
import { p2pStarter } from "../utils/helpers";
import type { IUser, P2PInit } from "../utils/types";

export function vcsCommands(program: Command, p2p: P2P) {
    program
        .command("push")
        .description("Push changes to the remote repository")
        .action(async () => {
            if (!VCS.checkInitalized(process.cwd())) {
                console.log(
                    colorize.errorIcon(
                        "This directory is not a valid Direct VCS repository. Please initialize it first using `direct init`.",
                    ),
                );
                return;
            }

            p2pStarter(p2p).then((_: P2PInit) => {
                const authInstance = new Auth(_);
                (authInstance.getUser() as Promise<{ data: IUser; token: string }>)
                    .then(async user => {
                        const remote = new Remote(_);
                        await remote.push(process.cwd());
                        return process.exit(0);
                    })
                    .catch(error => {
                        console.error(colorize.errorIcon("Failed to push changes"));
                        if (error) console.error(colorize.error(error as string));
                    })
                    .finally(() => {
                        process.exit(1);
                    });
            });
        });

    program
        .command("pull")
        .description("Pull changes from the remote repository")
        .action(() => {});

    program
        .command("clone")
        .description("Clone a remote repository")
        .option("-r, --id <string>", "Remote repository ID or blob ID")
        .action(options => {
            if (!options.id) {
                console.log(
                    colorize.errorIcon(
                        `Please provide a repository ID or blob ID using ${colorize.warning("-r")} or ${colorize.warning("--id")} option.`,
                    ),
                );
                return;
            }

            p2pStarter(p2p).then(async (_: P2PInit) => {
                const remote = new Remote(_);
                await remote.clone(options.id);
            });
        });

    // direct-vcs commands
    /**
     * std::cout << "Usage: direct <command> [options]\n\n"
              << "Commands:\n"
              << "  init                    Initialize a new repository\n"
              << "  commit -m <message>     Create a new commit\n"
              << "  branch <name>           Create a new branch\n"
              << "  switch <branch>         Switch to another branch\n"
              << "  merge <branch>          Merge specified branch into current branch\n"
              << "  status                  Show current branch and status\n";
     */
    program
        .command("init")
        .description("Initialize a new repository")
        .action(() => {
            directVCS("init");
            process.exit(0);
        });

    program
        .command("commit")
        .description("Create a new commit")
        .option("-m, --message <string>", "Commit message")
        .action(options => {
            if (!options.message) {
                console.log(
                    colorize.errorIcon(
                        `Please provide a commit message using ${colorize.warning("-m")} or ${colorize.warning("--message")} option.`,
                    ),
                );
                return;
            }
            directVCS(`commit -m "${options.message}"`);
            process.exit(0);
        });

    program
        .command("branch")
        .description("Create a new branch")
        .option("-n, --name <string>", "Name of the new branch")
        .action(options => {
            if (!options.name) {
                console.log(
                    colorize.errorIcon(
                        `Please provide a name for the new branch using ${colorize.warning("-n")} or ${colorize.warning("--name")} option.`,
                    ),
                );
                return;
            }
            directVCS(`branch "${options.name}"`);
            process.exit(0);
        });

    program
        .command("switch")
        .description("Switch to another branch")
        .option("-b, --branch <string>", "Name of the branch to switch to")
        .action(options => {
            if (!options.branch) {
                console.log(
                    colorize.errorIcon(
                        `Please provide a branch name to switch to using ${colorize.warning("-b")} or ${colorize.warning("--branch")} option.`,
                    ),
                );
                return;
            }
            directVCS(`switch "${options.branch}"`);
            process.exit(0);
        });

    program
        .command("merge")
        .description("Merge specified branch into current branch")
        .option("-b, --branch <string>", "Name of the branch to merge")
        .action(options => {
            if (!options.branch) {
                console.log(
                    colorize.errorIcon(
                        `Please provide a branch name to merge using ${colorize.warning("-b")} or ${colorize.warning("--branch")} option.`,
                    ),
                );
                return;
            }
            directVCS(`merge "${options.branch}"`);
            process.exit(0);
        });

    program
        .command("status")
        .description("Show current branch and status")
        .action(() => {
            directVCS("status");
            process.exit(0);
        });
}
