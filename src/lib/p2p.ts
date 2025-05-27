/* Communication with Node */
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
    protected CLONE_PROTOCOL: string = "/clone/1.0.0";
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
}
