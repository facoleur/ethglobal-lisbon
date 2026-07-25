// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ITARRecovery} from "../../src/interfaces/ITARRecovery.sol";

/// @notice Minimal ERC-7579 account stand-in for Milestone A unit tests. Forwards
/// installModule/uninstallModule to the module's onInstall/onUninstall via a regular external
/// call, so that `msg.sender` inside the module is this mock account — matching the real Kernel
/// pattern — without pulling in a full `KernelFactory` deployment (Milestone E).
contract MockERC7579Account {
    function installModule(address module, bytes calldata initData) external payable {
        ITARRecovery(module).onInstall(initData);
    }

    function uninstallModule(address module, bytes calldata deInitData) external payable {
        ITARRecovery(module).onUninstall(deInitData);
    }
}
