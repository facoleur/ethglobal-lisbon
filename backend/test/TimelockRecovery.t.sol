// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {
    TimelockRecovery
} from "../src/TimelockRecovery.sol";

import {
    MockRecoveryAdapter
} from "./mocks/MockRecoveryAdapter.sol";

contract TimelockRecoveryTest is Test {
    TimelockRecovery internal recovery;
    MockRecoveryAdapter internal adapter;

    uint48 internal constant RECOVERY_DELAY = 3 days;
    uint96 internal constant MINIMUM_DEPOSIT = 0.1 ether;
    uint48 internal constant REVEAL_WINDOW = 1 days;

    address internal account = makeAddr("account");
    address internal owner = makeAddr("owner");
    address internal claimant = makeAddr("claimant");
    address internal newValidator = makeAddr("newValidator");
    address internal newOwner = makeAddr("newOwner");

    bytes32 internal salt = keccak256("secret-salt");

    function setUp() public {
        recovery = new TimelockRecovery(
        RECOVERY_DELAY,
        REVEAL_WINDOW,
        MINIMUM_DEPOSIT
    );

        adapter = new MockRecoveryAdapter();

        vm.prank(account);
        recovery.configureRecovery(address(adapter));

        adapter.setVetoer(account, owner);

        vm.deal(claimant, 10 ether);
    }

    function testConfiguration() public view {
        (
            address configuredAdapter,
            bool enabled
        ) = recovery.accountConfigs(account);

        assertEq(configuredAdapter, address(adapter));
        assertTrue(enabled);
    }
    function _validatorData()
    internal
    view
    returns (bytes memory)
{
    return abi.encode(newOwner);
}

function _commitment()
    internal
    view
    returns (bytes32)
{
    return recovery.computeCommitment(
        account,
        claimant,
        newValidator,
        _validatorData(),
        salt
    );
}

function _commitAndReveal() internal {
    bytes32 commitment = _commitment();
    bytes memory validatorData = _validatorData();

    vm.prank(claimant);
    recovery.commitRecovery{
        value: MINIMUM_DEPOSIT
    }(
        account,
        commitment
    );

    vm.prank(claimant);
    recovery.revealRecovery(
        account,
        newValidator,
        validatorData,
        salt
    );
}

function testCommitRecovery() public {
    bytes32 commitment = _commitment();

    vm.prank(claimant);
    recovery.commitRecovery{
        value: MINIMUM_DEPOSIT
    }(
        account,
        commitment
    );

    TimelockRecovery.Recovery memory request =
        recovery.getRecovery(account);

    assertEq(request.commitment, commitment);
    assertEq(request.claimant, claimant);
    assertEq(request.deposit, MINIMUM_DEPOSIT);

    assertEq(
        uint256(request.status),
        uint256(
            TimelockRecovery.RecoveryStatus.Committed
        )
    );

    assertEq(
        address(recovery).balance,
        MINIMUM_DEPOSIT
    );
}

function testRevealRecovery() public {
    _commitAndReveal();

    TimelockRecovery.Recovery memory request =
        recovery.getRecovery(account);

    assertEq(request.newValidator, newValidator);

    assertEq(
        keccak256(request.newValidatorData),
        keccak256(_validatorData())
    );

    assertEq(
        request.executableAt,
        block.timestamp + RECOVERY_DELAY
    );

    assertEq(
        uint256(request.status),
        uint256(
            TimelockRecovery.RecoveryStatus.Pending
        )
    );
    }
    function testRevealRevertsWithWrongSalt() public {
    bytes32 commitment = _commitment();

    vm.prank(claimant);
    recovery.commitRecovery{value: MINIMUM_DEPOSIT}(
        account,
        commitment
    );

    vm.prank(claimant);
    vm.expectRevert(
        TimelockRecovery.InvalidReveal.selector
    );

    recovery.revealRecovery(
        account,
        newValidator,
        _validatorData(),
        keccak256("wrong-salt")
    );
}
function testUnauthorizedAddressCannotVeto() public {
    _commitAndReveal();

    address attacker = makeAddr("attacker");

    vm.prank(attacker);
    vm.expectRevert(
        TimelockRecovery.Unauthorized.selector
    );

    recovery.vetoRecovery(account);
}
function testAuthorizedOwnerCanVeto() public {
    _commitAndReveal();

    vm.prank(owner);
    recovery.vetoRecovery(account);

    TimelockRecovery.Recovery memory request =
        recovery.getRecovery(account);

    assertEq(
        uint256(request.status),
        uint256(
            TimelockRecovery.RecoveryStatus.Vetoed
        )
    );
}
function testFinalizeRevertsBeforeDelay() public {
    _commitAndReveal();

    vm.expectRevert(
        TimelockRecovery.TooEarly.selector
    );

    recovery.finalizeRecovery(account);
}
function testFinalizeAfterDelay() public {
    _commitAndReveal();

    vm.warp(block.timestamp + RECOVERY_DELAY);

    recovery.finalizeRecovery(account);

    assertEq(adapter.lastRecoveredAccount(), account);
    assertEq(adapter.lastValidator(), newValidator);

    assertEq(
        keccak256(adapter.lastValidatorData()),
        keccak256(_validatorData())
    );

    TimelockRecovery.Recovery memory request =
        recovery.getRecovery(account);

    assertEq(
        uint256(request.status),
        uint256(
            TimelockRecovery.RecoveryStatus.Finalized
        )
    );
}

}
