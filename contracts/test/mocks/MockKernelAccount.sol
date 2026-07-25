// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IExecutor, IValidator} from "kernel/interfaces/IERC7579Modules.sol";
import {ExecMode} from "kernel/types/Types.sol";
import {ExecLib} from "kernel/utils/ExecLib.sol";

contract MockKernelAccount {
    address public executor;

    error UnauthorizedExecutor();

    function installValidator(address validator, bytes calldata validatorData) external {
        IValidator(validator).onInstall(validatorData);
    }

    function installExecutor(address newExecutor, bytes calldata executorData) external {
        executor = newExecutor;
        IExecutor(newExecutor).onInstall(executorData);
    }

    function executeFromExecutor(ExecMode mode, bytes calldata executionCalldata)
        external
        payable
        returns (bytes[] memory returnData)
    {
        if (msg.sender != executor) {
            revert UnauthorizedExecutor();
        }

        return ExecLib.execute(mode, executionCalldata);
    }
}
