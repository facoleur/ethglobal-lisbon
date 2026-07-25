// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Spike B probe: calls the RIP-7212/EIP-7951 P-256 verification precompile
/// via CALL (not STATICCALL) from a real transaction, and records the outcome.
/// Some precompile implementations answer a read-only `eth_call`/staticcall but
/// revert or misbehave in an actual state-changing transaction context, so this
/// probe exists specifically to rule that out.
contract P256Probe {
    event P256Result(address indexed precompile, bool success, bool valid);

    function probe(address precompile, bytes calldata input) external returns (bool success, bool valid) {
        bytes memory ret;
        (success, ret) = precompile.call(input);
        valid = success && ret.length == 32 && abi.decode(ret, (uint256)) == 1;
        emit P256Result(precompile, success, valid);
    }
}
