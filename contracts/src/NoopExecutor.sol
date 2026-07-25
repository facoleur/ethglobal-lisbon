// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IModule} from "kernel/interfaces/IERC7579Modules.sol";

/// @notice Dummy ERC-7579 executor (module type 2) used only to validate the
/// Kernel installModule/uninstallModule mechanics. It performs no action of its own.
contract NoopExecutor is IModule {
    mapping(address account => bool installed) public installed;

    function onInstall(bytes calldata) external payable override {
        if (installed[msg.sender]) revert AlreadyInitialized(msg.sender);
        installed[msg.sender] = true;
    }

    function onUninstall(bytes calldata) external payable override {
        if (!installed[msg.sender]) revert NotInitialized(msg.sender);
        delete installed[msg.sender];
    }

    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == 2;
    }

    function isInitialized(address smartAccount) external view override returns (bool) {
        return installed[smartAccount];
    }
}
