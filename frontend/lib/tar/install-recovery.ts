import {
  encodeFunctionData,
  type Address,
  type Hex,
} from "viem";

import { kernelModuleAbi } from "@/lib/tar/abi";
import {
  encodeKernelExecutorInitData,
  encodeTarExecutorData,
  MODULE_TYPE_EXECUTOR,
} from "@/lib/tar/encoding";

type UserOperationCall = {
  to: Address;
  value: bigint;
  data: Hex;
};

type SmartAccountSender = {
  sendUserOperation(args: {
    calls: UserOperationCall[];
  }): Promise<Hex>;
};

export async function installTarRecovery(args: {
  client: SmartAccountSender;
  kernelAccount: Address;
  timelockRecovery: Address;
  validator: Address;
  vetoer: Address;
}): Promise<Hex> {
  const executorData = encodeTarExecutorData({
    validator: args.validator,
    vetoer: args.vetoer,
  });

  const initData =
    encodeKernelExecutorInitData(executorData);

  const installCall = encodeFunctionData({
    abi: kernelModuleAbi,
    functionName: "installModule",
    args: [
      MODULE_TYPE_EXECUTOR,
      args.timelockRecovery,
      initData,
    ],
  });

  return args.client.sendUserOperation({
    calls: [
      {
        to: args.kernelAccount,
        value: 0n,
        data: installCall,
      },
    ],
  });
}
