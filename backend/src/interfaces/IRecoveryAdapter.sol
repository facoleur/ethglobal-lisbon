// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRecoveryAdapter {
    /// Vérifie si `caller` possède le droit de veto pour `account`.
    function canVeto(
        address account,
        address caller
    ) external view returns (bool);

    /// Remplace l'authentification du smart account.
    function applyRecovery(
        address account,
        address newValidator,
        bytes calldata newValidatorData
    ) external;
}
