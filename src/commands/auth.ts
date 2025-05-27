import type { Command } from "commander";

import Auth from "../lib/auth";
import type P2P from "../lib/p2p";
import Wallet from "../lib/wallet";
import { colorize } from "../utils/colors";
import type { IUser } from "../utils/types";
import { p2pStarter } from "../utils/helpers";

export function authCommands(program: Command, p2p: P2P) {
    const auth = program.command("auth");

    auth.command("login")
        .description("Login to the service")
        .option("-w, --wallet <string>", "Wallet address of your SUI wallet")
        .action(async options => {
            p2pStarter(p2p)
                .then(async _ => {
                    const authInstance = new Auth(_);
                    await authInstance.login(options?.wallet);
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

    auth.command("logout")
        .description("Logout from the service")
        .action(async () => {
            p2pStarter(p2p).then(_ => {
                const authInstance = new Auth(_);
                (authInstance.getUser() as Promise<{ data: IUser; token: string }>)
                    .then(async () => {
                        authInstance.logout();
                        console.log(colorize.successIcon("Successfully logged out."));
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

    auth.command("balance")
        .description("Check account balance")
        .action(() => {
            p2pStarter(p2p).then(_ => {
                const authInstance = new Auth(_);
                (authInstance.getUser() as Promise<{ data: IUser; token: string }>)
                    .then(async user => {
                        const wallet = new Wallet(user.data.deposit);
                        const { WAL, SUI } = await wallet.getBalance();

                        const normalizedSUI = Number(SUI.totalBalance) / 1e9;
                        const normalizedWAL = Number(WAL.totalBalance) / 1e9;

                        console.log(`Coin balances of ${colorize.warning(user.data.deposit)}\n`);
                        console.log(
                            `SUI: ${colorize.highlight(normalizedSUI.toString())}\n` +
                                `WAL: ${colorize.highlight(normalizedWAL.toString())}`,
                        );

                        process.exit(1);
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
}
