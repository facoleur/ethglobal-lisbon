// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {ExecMode} from "kernel/types/Types.sol";
import {ExecLib} from "kernel/utils/ExecLib.sol";
import {ITARRecovery} from "../../src/interfaces/ITARRecovery.sol";

/// @notice Minimal ERC-7579 account stand-in for Milestone A/B unit tests. Forwards
/// installModule/uninstallModule to the module's onInstall/onUninstall via a regular external
/// call, so that `msg.sender` inside the module is this mock account — matching the real Kernel
/// pattern — without pulling in a full `KernelFactory` deployment (Milestone E).
///
/// Milestone B additions: `executeFromExecutor` (single-call only, mirrors what
/// `TARRecoveryExecutor.finalizeRecovery` sends via `ExecLib`) and `isValidSignature` (ERC-1271,
/// raw hash checked against a single ECDSA `owner` — no EIP-191 prefix, matching how
/// `challengeRecovery`'s `rejectHash` is meant to be signed).
contract MockERC7579Account is IERC1271 {
    address public immutable owner;

    constructor(address _owner) {
        owner = _owner;
    }

    receive() external payable {}

    function installModule(address module, bytes calldata initData) external payable {
        ITARRecovery(module).onInstall(initData);
    }

    function uninstallModule(address module, bytes calldata deInitData) external payable {
        ITARRecovery(module).onUninstall(deInitData);
    }

    function executeFromExecutor(ExecMode, bytes calldata executionCalldata)
        external
        payable
        returns (bytes[] memory returnData)
    {
        (address target, uint256 value, bytes calldata callData) = ExecLib.decodeSingle(executionCalldata);
        (bool success, bytes memory result) = target.call{value: value}(callData);
        require(success, "executeFromExecutor: call failed");
        returnData = new bytes[](1);
        returnData[0] = result;
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        (address signer,,) = ECDSA.tryRecover(hash, signature);
        return signer == owner ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
    }
}
