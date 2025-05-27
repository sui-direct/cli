import { homedir } from "os";
import prompts from "prompts";
import { isValidSuiAddress } from "@mysten/sui/utils";
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";

import P2P from "./p2p";
import { colorize } from "../utils/colors";
import type { P2PInit } from "../utils/types";

export default class Auth extends P2P {
    constructor(_: P2PInit) {
        super();

        this.connection = _.connection;
        this.nodePeerID = _.nodePeerID;
        this.peerID = _.peerID;
    }

    static async waitUntilAuthenticated(stream: any, token: string) {
        // Send token message
        await stream.sink(JSON.stringify({ token }));

        // Wait for server to acknowledge token validation
        const ackChunk = await stream.source.next();
        const ack = JSON.parse(ackChunk.value.toString());

        if (ack.status !== true) {
            throw new Error(ack.message || "Token validation failed on server.");
        }
    }

    async getUser() {
        return new Promise(async (resolve, reject) => {
            const unauthenticated = () => {
                console.log(colorize.errorIcon("You must be logged in to perform this action."));
                return reject();
            };

            const tokenDir = `${homedir()}/.sui-direct/TOKEN`;
            if (!existsSync(tokenDir)) return unauthenticated();

            const token = readFileSync(tokenDir, "utf-8");
            if (!token) return unauthenticated();

            const stream = await this.connection.newStream(this.VALIDATE_PROTOCOL);
            const message = JSON.stringify({
                token,
                peerID: this.peerID!.toString(),
            });

            await this.sink(stream, message);

            const response = await this.parseChunk(stream);

            if (response?.expired) {
                this.logout();
                console.log(colorize.errorIcon("Session is expired. Please login again."));
                return reject(response.error);
            }
            if (response?.status !== "ok") {
                return unauthenticated();
            }

            return resolve({
                data: response.decoded.data,
                token,
            });
        });
    }

    async login(publicKey?: string) {
        // Get nonce from node
        const nonceStream = await this.connection.newStream(this.NONCE_PROTOCOL);
        const nonceMessage = JSON.stringify({
            peerID: this.peerID!.toString(),
        });

        await this.sink(nonceStream, nonceMessage);

        const response = await this.parseChunk(nonceStream);

        if (!response?.nonce) {
            console.error(colorize.errorIcon("Failed to get nonce from node."));
            return;
        }

        // Get public key
        if (!publicKey) {
            const publicKeyInput = await prompts({
                type: "text",
                name: "publicKey",
                message: "Please enter your SUI wallet address",
                validate: (value: string) =>
                    isValidSuiAddress(value) && value.trim() ? true : "Invalid SUI address",
            });

            publicKey = publicKeyInput.publicKey;

            if (!publicKey) {
                console.error(colorize.errorIcon("Public key is required to authenticate."));
                return;
            }
        }

        // Instructions
        console.log("\n");
        console.log("Please go to the following URL to sign a message:");
        console.log(
            `${colorize.warning(`https://sui.direct/sign?nonce=${response.nonce}`)}${colorize.reset()}\n\n`,
        );
        console.log("If you are using CLI wallet, please sign the message below:\n");
        console.log(
            `${colorize.highlight(`Welcome to sui.direct!\n\nSign this message to authenticate in the CLI.\n\nNonce: ${response.nonce}`)}${colorize.reset()}`,
        );

        let validated = false;
        let token: string;

        while (!validated) {
            const signatureInput = await prompts({
                type: "text",
                name: "signature",
                message: "Paste the signature here",
                validate: (value: string) => (value.length > 0 ? true : "Signature cannot be empty"),
            });

            const signature = signatureInput.signature;
            if (signature === "exit" || signature === "quit") {
                console.log(colorize.error("Good bye!"));
                return;
            }

            // Send the signature to the node for validation
            const signatureStream = await this.connection.newStream(this.SIGNATURE_PROTOCOL);
            const signatureMessage = JSON.stringify({
                peerID: this.peerID!.toString(),
                publicKey: publicKey,
                signature: signature,
            });

            await this.sink(signatureStream, signatureMessage);

            const signatureResponse = await this.parseChunk(signatureStream);
            if (signatureResponse?.error) {
                console.log(colorize.errorIcon(signatureResponse.error));
            } else {
                token = signatureResponse.token;
                validated = true;
            }
        }

        // Store the token
        writeFileSync(`${homedir()}/.sui-direct/TOKEN`, token!, {
            encoding: "utf-8",
            flag: "w+",
        });

        console.log(colorize.successIcon("Successfully authenticated."));
    }

    logout() {
        try {
            rmSync(`${homedir()}/.sui-direct/TOKEN`);
        } catch (e) {
            // Ignore errors
        }
    }
}
