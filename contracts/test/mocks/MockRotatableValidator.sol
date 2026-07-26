// SPDX-License-Identifier: MIT
// Shared by V1 and V2 tests — see `MockERC7579Account.sol` for why `^0.8.23` (not `^0.8.28`) is
// the range that works for both.
pragma solidity ^0.8.23;

/// @notice Test double for `finalizeRecovery`'s rotation target. Milestone C tests the
/// `TARRecoveryExecutor` state machine against this trivial mock, not a real validator — neither
/// `ECDSAValidator` nor Kernel's stock `WebAuthnValidator` expose a rotation function, and the
/// real `TARWebAuthnValidator` (Milestone D) is built separately.
contract MockRotatableValidator {
    mapping(address account => uint256 pubKeyX) public currentPubKeyX;
    mapping(address account => uint256 pubKeyY) public currentPubKeyY;

    /// @dev `msg.sender` is the account itself: `finalizeRecovery` reaches this function via
    /// `addressToRecover.executeFromExecutor(...)`, executed by the target account.
    function setNewOwner(uint256 newPubKeyX, uint256 newPubKeyY) external {
        currentPubKeyX[msg.sender] = newPubKeyX;
        currentPubKeyY[msg.sender] = newPubKeyY;
    }
}
