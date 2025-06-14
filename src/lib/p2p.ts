/* Communication with Node */
import { join } from "path";
import { rmSync } from "fs";
import { type Libp2p } from "libp2p";
import { toString } from "uint8arrays/to-string";
import type { PrivateKey } from "@libp2p/interface";
import { fromString } from "uint8arrays/from-string";
import type { PeerId } from "@libp2p/interface-peer-id";

import JSONIO from "../utils/json";
import { P2PInit } from "../utils/types";
import { colorize } from "../utils/colors";
import { initDynamicImports } from "../utils/helpers";

async function imports() {
    const [
        { createLibp2p },
        { tcp },
        // { ping },
        // { kadDHT },
        { identify },
        { noise },
        { yamux },
        { multiaddr },
        { createFromJSON, createEd25519PeerId },
        { privateKeyFromProtobuf },
    ] = await initDynamicImports([
        "libp2p",
        "@libp2p/tcp",
        // "@libp2p/ping",
        // "@libp2p/kad-dht",
        "@libp2p/identify",
        "@chainsafe/libp2p-noise",
        "@chainsafe/libp2p-yamux",
        "@multiformats/multiaddr",
        "@libp2p/peer-id-factory",
        "@libp2p/crypto/keys",
    ]);

    return {
        createLibp2p,
        tcp,
        // ping,
        // kadDHT,
        identify,
        noise,
        yamux,
        multiaddr,
        createFromJSON,
        createEd25519PeerId,
        privateKeyFromProtobuf,
    };
}

export default class P2P {
    protected config: any;
    public nodePeerID: string = "";
    public peerID: PeerId | string | null = null;
    private peerPrivKey: PrivateKey | null = null;

    protected libp2p: Libp2p<any> | null = null;
    protected connection: any = null;

    // Protocols
    protected HANDSHAKE_PROTOCOL: string = "/handshake/1.0.0";
    protected NONCE_PROTOCOL: string = "/nonce/1.0.0";
    protected SIGNATURE_PROTOCOL: string = "/signature/1.0.0";
    protected VALIDATE_PROTOCOL: string = "/validate/1.0.0";
    protected PUSH_PROTOCOL: string = "/push/1.0.0";
    protected PULL_PROTOCOL: string = "/pull/1.0.0";
    protected RENAME_PROTOCOL: string = "/rename/1.0.0";

    constructor() {
        this.config = JSONIO.getConfig();
    }

    async sink(stream: any, data: string) {
        await stream.sink(
            (async function* () {
                yield fromString(data);
            })(),
        );
    }

    async parseChunk(stream: any) {
        let data = "";
        for await (const chunk of stream.source) {
            data += toString(chunk.subarray());
        }
        try {
            return JSON.parse(data);
        } catch (e) {
            return data;
        }
    }

    async generatePeerID(): Promise<void> {
        if (this.peerID) return;

        const config = JSONIO.getConfig();
        const { createFromJSON, privateKeyFromProtobuf, createEd25519PeerId } = await imports();

        if (config?.peerID) {
            this.peerID = await createFromJSON(config.peerID);
            this.peerPrivKey = await privateKeyFromProtobuf(Buffer.from(config.peerID.privKey, "base64"));
        } else {
            this.peerID = (await createEd25519PeerId()) as PeerId;
            this.peerPrivKey = await privateKeyFromProtobuf(this.peerID.privateKey);

            JSONIO.setConfig({
                ...config,
                peerID: {
                    id: this.peerID.toString(),
                    privKey: Buffer.from(this.peerID.privateKey!).toString("base64"),
                    pubKey: Buffer.from(this.peerID.publicKey!).toString("base64"),
                },
            });
        }
    }

    async getNodePeerID() {
        const req = await fetch(`${this.config.nodehttp}/peer-id`);
        this.nodePeerID = (await req.json())?.id;

        if (!this.nodePeerID) return null;
        return this.nodePeerID;
    }

    async init(): Promise<P2PInit> {
        if (this.libp2p && this.connection)
            return {
                peerID: this.peerID!.toString(),
                nodePeerID: this.nodePeerID,
                connection: this.connection,
            };

        return new Promise(async (resolve, reject) => {
            const { createLibp2p, tcp, identify, noise, yamux, multiaddr } = await imports();

            await this.generatePeerID();
            const nodePeerID = this.nodePeerID || (await this.getNodePeerID());

            if (!nodePeerID) {
                console.log(colorize.errorIcon("Node is offline or not reachable."));
                return reject();
            }

            this.libp2p = (await createLibp2p({
                privateKey: this.peerPrivKey,
                addresses: {
                    listen: [],
                },
                transports: [tcp()],
                connectionEncrypters: [noise()],
                streamMuxers: [yamux()],
                services: {
                    identify: identify(),
                },
            })) as Libp2p<any>;

            await this.libp2p.start();

            // Node address
            const ip = this.config.node.split("//")[1].split(":")[0];
            const port = this.config.node.split("//")[1].split(":")[1];

            const remoteAddr = multiaddr(`/ip4/${ip}/tcp/${port}/p2p/${nodePeerID}`);
            this.connection = await this.libp2p.dial(remoteAddr);

            // Handshake
            const stream = await this.connection.newStream(this.HANDSHAKE_PROTOCOL);
            await this.sink(stream, JSON.stringify({ peerID: this.peerID!.toString() }));

            // Listen for incoming messages
            const response = await this.parseChunk(stream);

            if (response?.status !== "ok") {
                console.error(colorize.errorIcon("Failed to connect to node."));
                return reject();
            }

            return resolve({
                peerID: this.peerID!.toString(),
                nodePeerID: this.nodePeerID,
                connection: this.connection,
            });
        });
    }

    // Helper method to receive streamed content
    protected async receiveStreamedContent(stream: any): Promise<Buffer> {
        const chunks: Buffer[] = [];
        let totalSize = 0;

        for await (const chunk of stream.source) {
            console.log(totalSize);
            let buffer: Buffer;

            // Handle different chunk types
            if (chunk.constructor.name === "Uint8ArrayList") {
                if (chunk.bufs && chunk.bufs.length > 0) {
                    buffer = Buffer.concat(chunk.bufs);
                } else {
                    buffer = Buffer.from(chunk.slice());
                }
            } else if (chunk instanceof Buffer) {
                buffer = chunk;
            } else if (chunk instanceof Uint8Array) {
                buffer = Buffer.from(chunk);
            } else {
                buffer = Buffer.from(chunk);
            }

            totalSize += buffer.length;
            chunks.push(buffer);
        }

        return Buffer.concat(chunks);
    }

    // Helper method to process cloned content
    protected async processClonedContent(id: string, zipBuffer: Buffer): Promise<void> {
        const [{ writeFileSync }, { extractZipToFolder }] = await Promise.all([
            import("fs").then(fs => ({ writeFileSync: fs.writeFileSync })),
            import("../utils/zip").then(zipModule => ({
                extractZipToFolder: zipModule.extractZipToFolder,
            })),
        ]);

        // Create temporary zip file
        const tempZipPath = join(process.cwd(), `${id}-temp.zip`);
        writeFileSync(tempZipPath, zipBuffer);

        // Extract to target directory
        const extractPath = join(process.cwd(), id);
        await extractZipToFolder(tempZipPath, extractPath);

        try {
            rmSync(tempZipPath, { force: true });
        } catch (e) {
            console.log(colorize.warning("Failed to clean up temporary zip file"));
            console.error(e);
        }
    }
}
