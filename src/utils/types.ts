import { PeerId } from "@libp2p/interface-peer-id";

export interface IUser {
    peerID: string;
    publicKey: string;
    signature: string;
    deposit: string;
}

export interface P2PInit {
    connection: any;
    peerID: string;
    nodePeerID: string;
}