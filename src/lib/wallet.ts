import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const SUI_ADDR = "0x2::sui::SUI";
const WAL_ADDR = "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL";

export default class Wallet {
    private client: SuiClient;
    private wallet: string | null = null;

    constructor(wallet?: string) {
        this.client = new SuiClient({
            url: getFullnodeUrl("mainnet"),
        });

        if (wallet) this.wallet = wallet;
    }

    async getBalance(wallet?: string) {
        if (!wallet && !this.wallet) throw new Error("Wallet address is required");
        const targetWallet = wallet || (this.wallet as string);

        const [SUI_BALANCE, WAL_BALANCE] = await Promise.all([
            this.client.getBalance({
                owner: targetWallet,
                coinType: SUI_ADDR,
            }),
            this.client.getBalance({
                owner: targetWallet,
                coinType: WAL_ADDR,
            }),
        ]);

        return {
            SUI: SUI_BALANCE,
            WAL: WAL_BALANCE,
        };
    }
}
