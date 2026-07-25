import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, sepoliaRpcUrl } from "@/lib/kernel/config";

export function createBroadcasterWalletClient(privateKey: Hex) {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain,
    transport: http(sepoliaRpcUrl),
  });
}
