// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract TokenStorage {
    // put variables here
}

contract TokenV2 is 
    Initializable, 
    ERC20Upgradeable, 
    ERC20BurnableUpgradeable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable,
    TokenStorage
{
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant MIGRATOR_ROLE = keccak256("MIGRATOR_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize() initializer public {
        __ERC20_init("Plebbit", "PLEB");
        __ERC20Burnable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(UPGRADER_ROLE, msg.sender);
    }

    // if someone sends tokens to this contract, admin can send them back
    function recoverTokensSentToContract(ERC20Upgradeable _token, address _address, uint256 _amount) external onlyRole(MIGRATOR_ROLE) {
        _token.transfer(_address, _amount);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}
}
