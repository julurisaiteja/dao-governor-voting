// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GovernanceToken
 * @dev ERC20 token with ERC20Votes (snapshots + delegation).
 */
contract GovernanceToken is ERC20, ERC20Burnable, Ownable, ERC20Permit, ERC20Votes {
    uint256 public constant MAX_SUPPLY = 1_000_000e18;

    constructor()
        ERC20("Governance Token", "GOVT")
        ERC20Permit("Governance Token")
        Ownable(msg.sender)
    {
        _mint(msg.sender, MAX_SUPPLY);
    }

    // The following functions are overrides required by Solidity.

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
