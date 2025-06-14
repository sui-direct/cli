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