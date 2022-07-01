//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./Configurable.sol";

contract Whitelist is Configurable {
    bytes32 private _whitelistMRoot;

    modifier senderFromWhitelist(bytes32[] memory proof) {
        require(
            MerkleProof.verify(
                proof,
                _whitelistMRoot,
                keccak256(abi.encodePacked(msg.sender))
            ),
            "Whitelist: no access"
        );
        _;
    }

    /// @notice Returns whitelist root
    function getWhitelist() external view returns (bytes32) {
        return _whitelistMRoot;
    }

    /// @notice Allows to change whitelist root
    function setWhitelist(bytes32 mroot) public onlyRole(CONFIGURATOR_ROLE) {
        _whitelistMRoot = mroot;
    }
}
