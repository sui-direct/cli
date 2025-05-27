#!/usr/bin/env node

import { homedir } from "os";
import { Command } from "commander";
import { existsSync, mkdirSync } from "fs";

import P2P from "./lib/p2p";

// Commands
import { vcsCommands } from "./commands/vcs";
import { p2pStarter } from "./utils/helpers";
import { authCommands } from "./commands/auth";
import { configCommands } from "./commands/config";
import { repositoryCommands } from "./commands/repository";

const program = new Command();
const p2p = new P2P();

p2pStarter(p2p);

// Set CLI metadata
program
    .name("direct")
    .description("Decentralized version control system on SUI blockchain")
    .version("0.0.1");

// Register commands
configCommands(program);
vcsCommands(program, p2p);
authCommands(program, p2p);
repositoryCommands(program, p2p);

program.parse();

// .sui-direct directory
if (!existsSync(`${homedir()}/.sui-direct`)) {
    mkdirSync(`${homedir()}/.sui-direct`);
}
