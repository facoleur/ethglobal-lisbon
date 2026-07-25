// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ExecMode} from "kernel/types/Types.sol";

/// @notice Minimal Kernel v0.3.1 interface needed by the TAR executor.
interface IKernelExecutorAccount {
    function executeFromExecutor(ExecMode execMode, bytes calldata executionCalldata)
        external
        payable
        returns (bytes[] memory returnData);
}
