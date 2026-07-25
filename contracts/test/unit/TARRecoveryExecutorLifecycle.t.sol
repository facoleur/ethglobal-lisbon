// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IModule} from "kernel/interfaces/IERC7579Modules.sol";
import {TARRecoveryExecutor} from "../../src/TARRecoveryExecutor.sol";
import {ITARRecovery} from "../../src/interfaces/ITARRecovery.sol";
import {MockERC7579Account} from "../mocks/MockERC7579Account.sol";
import {MockRotatableValidator} from "../mocks/MockRotatableValidator.sol";

/// @notice Module skeleton, config lifecycle and ERC-7579 boilerplate (Milestone A). Business
/// logic (commit-reveal, challenge, finalize) is covered separately in
/// `TARRecoveryExecutor.t.sol` (Milestone B/C) — a mock account/validator pair is still needed
/// here only because the constructor and mock account now require them.
contract TARRecoveryExecutorLifecycleTest is Test {
    // RecoveryStatus enum mirrored here to build calldata/assert values without exposing the
    // enum itself outside the contract.
    uint8 constant STATUS_NONE = 0;
    uint8 constant STATUS_REVEALED = 1;

    // `recoveries` is the 3rd state variable declared in TARRecoveryExecutor (slot 2, after
    // `configs` and `pendingCommitments`); `status` is the 6th field of `RecoveryRequest`
    // (offset 5 slots into the struct — each field takes its own slot, none pack together).
    uint256 constant RECOVERIES_BASE_SLOT = 2;
    uint256 constant STATUS_FIELD_OFFSET = 5;

    TARRecoveryExecutor executor;
    MockERC7579Account account;

    uint256 constant LOCK_VALUE = 1 ether;
    uint256 constant LOCK_TIME = 3 days;

    function setUp() external {
        executor = new TARRecoveryExecutor(address(new MockRotatableValidator()));
        account = new MockERC7579Account(address(0xBEEF));
    }

    function _install(uint256 lockValue, uint256 lockTime) internal {
        account.installModule(address(executor), abi.encode(lockValue, lockTime));
    }

    // ---------------------------------------------------------------------
    // onInstall
    // ---------------------------------------------------------------------

    function test_onInstall_validParams_setsConfigAndEmits() external {
        vm.expectEmit(true, false, false, true, address(executor));
        emit ITARRecovery.RecoveryParamsUpdated(address(account), LOCK_VALUE, LOCK_TIME);
        _install(LOCK_VALUE, LOCK_TIME);

        (uint256 lockValue, uint256 lockTime) = executor.configs(address(account));
        assertEq(lockValue, LOCK_VALUE);
        assertEq(lockTime, LOCK_TIME);
        assertTrue(executor.isInitialized(address(account)));
    }

    function test_onInstall_calledTwice_reverts() external {
        _install(LOCK_VALUE, LOCK_TIME);

        vm.expectRevert(abi.encodeWithSelector(IModule.AlreadyInitialized.selector, address(account)));
        _install(LOCK_VALUE, LOCK_TIME);
    }

    function test_onInstall_zeroLockValue_reverts() external {
        vm.expectRevert(ITARRecovery.InvalidRecoveryParams.selector);
        _install(0, LOCK_TIME);
    }

    function test_onInstall_zeroLockTime_reverts() external {
        vm.expectRevert(ITARRecovery.InvalidRecoveryParams.selector);
        _install(LOCK_VALUE, 0);
    }

    // ---------------------------------------------------------------------
    // updateRecoveryParams
    // ---------------------------------------------------------------------

    function test_updateRecoveryParams_notInitialized_reverts() external {
        vm.prank(address(account));
        vm.expectRevert(abi.encodeWithSelector(IModule.NotInitialized.selector, address(account)));
        executor.updateRecoveryParams(LOCK_VALUE, LOCK_TIME);
    }

    function test_updateRecoveryParams_validAfterInstall_updatesConfigAndEmits() external {
        _install(LOCK_VALUE, LOCK_TIME);

        uint256 newLockValue = 2 ether;
        uint256 newLockTime = 7 days;

        vm.expectEmit(true, false, false, true, address(executor));
        emit ITARRecovery.RecoveryParamsUpdated(address(account), newLockValue, newLockTime);
        vm.prank(address(account));
        executor.updateRecoveryParams(newLockValue, newLockTime);

        (uint256 lockValue, uint256 lockTime) = executor.configs(address(account));
        assertEq(lockValue, newLockValue);
        assertEq(lockTime, newLockTime);
    }

    // ---------------------------------------------------------------------
    // onUninstall
    // ---------------------------------------------------------------------

    function test_onUninstall_notInitialized_reverts() external {
        vm.expectRevert(abi.encodeWithSelector(IModule.NotInitialized.selector, address(account)));
        account.uninstallModule(address(executor), "");
    }

    function test_onUninstall_activeRecoveryRevealed_reverts() external {
        _install(LOCK_VALUE, LOCK_TIME);

        // Milestone B doesn't exist yet: simulate a Revealed recovery by writing the `status`
        // field of `recoveries[account]` directly in storage.
        bytes32 statusSlot =
            bytes32(uint256(keccak256(abi.encode(address(account), RECOVERIES_BASE_SLOT))) + STATUS_FIELD_OFFSET);
        vm.store(address(executor), statusSlot, bytes32(uint256(STATUS_REVEALED)));

        vm.expectRevert(abi.encodeWithSelector(ITARRecovery.ActiveRecoveryExists.selector, address(account)));
        account.uninstallModule(address(executor), "");
    }

    function test_onUninstall_nominal_clearsConfigAndRecovery() external {
        _install(LOCK_VALUE, LOCK_TIME);

        account.uninstallModule(address(executor), "");

        (uint256 lockValue, uint256 lockTime) = executor.configs(address(account));
        assertEq(lockValue, 0);
        assertEq(lockTime, 0);
        assertFalse(executor.isInitialized(address(account)));

        (,,,,, TARRecoveryExecutor.RecoveryStatus status) = _recoveryOf(address(account));
        assertEq(uint8(status), STATUS_NONE);
    }

    // ---------------------------------------------------------------------
    // isModuleType / isInitialized
    // ---------------------------------------------------------------------

    function test_isModuleType_executorTypeIsTrue_othersAreFalse() external view {
        assertTrue(executor.isModuleType(2));
        assertFalse(executor.isModuleType(1));
        assertFalse(executor.isModuleType(3));
        assertFalse(executor.isModuleType(4));
        assertFalse(executor.isModuleType(0));
    }

    function _recoveryOf(address addressToRecover)
        internal
        view
        returns (
            address broadcasterAddress,
            uint256 newPubKeyX,
            uint256 newPubKeyY,
            uint256 stakedValue,
            uint256 revealTimestamp,
            TARRecoveryExecutor.RecoveryStatus status
        )
    {
        return executor.recoveries(addressToRecover);
    }
}
