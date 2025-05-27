import type { Command } from "commander";

import JSONIO from "../utils/json";
import { colorize } from "../utils/colors";

export function configCommands(program: Command) {
    let currentConfig = JSONIO.getConfig();

    const config = program
        .command("config")
        .aliases(["cfg", "c"])
        .description("Manage configuration settings for the sui.direct CLI.");

    config
        .command("show")
        .description("Show current configuration settings")
        .action(() => {
            if (Object.keys(currentConfig).length === 0) {
                console.log(colorize.errorIcon("No configuration settings found."));
            } else {
                console.log("Current Configuration (config.json):\n");
                Object.entries(currentConfig).forEach(([key, value]) => {
                    console.log(
                        `${colorize.highlight(key)}: ${colorize.success(
                            typeof value === "string" ? value : JSON.stringify(value, null, 2),
                        )}`,
                    );
                });
            }

            return process.exit(0);
        });

    config
        .command("set")
        .description("Set a configuration setting")
        .option("-k, --key <string>", "Configuration key to set")
        .option("-v, --value <string>", "Value to set for the configuration key")
        .action(async options => {
            if (!options.key || !options.value) {
                console.log(
                    colorize.errorIcon(
                        `Please provide both a key and a value using ${colorize.warning("-k")} and ${colorize.warning("-v")} options.`,
                    ),
                );
                return process.exit(1);
            }

            currentConfig = {
                ...currentConfig,
                [options.key]: options.value,
            };
            JSONIO.setConfig(currentConfig);

            return process.exit(0);
        });
}
