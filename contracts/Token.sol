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

contract Token is 
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

    // needed to mint the initial supply
    function mint(address to, uint256 amount) public onlyRole(MIGRATOR_ROLE) {
        _mint(to, amount);
    }

    // needed to migrate distribute the initial supply to everyone
    function migrate(address[] memory _addresses, uint256[] memory _amounts) public onlyRole(MIGRATOR_ROLE) {
        uint256 i = 0;
        while (i < _addresses.length) {
            _transfer(msg.sender,  _addresses[i], _amounts[i]);
            i++;
        }
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        if (hasRole(MIGRATOR_ROLE, recipient) || hasRole(MIGRATOR_ROLE, msg.sender)) {
            return super.transfer(recipient, amount);
        }
        revert("migration not finished");
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
        if (hasRole(MIGRATOR_ROLE, recipient) || hasRole(MIGRATOR_ROLE, sender)) {
            return super.transferFrom(sender, recipient, amount);
        }
        revert("migration not finished");
        return true;
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}
}
