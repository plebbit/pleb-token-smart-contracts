// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

// this PLEB token is being migrated from the AVAX token 0x625fc9bb971bb305a2ad63252665dcfe9098bee9
// development started on Sep 16, 2021 https://github.com/plebbit/whitepaper/discussions/2

// project name: plebbit
// websites: plebbitapp.eth.limo, plebbitapp.eth.link, plebchan.eth.limo, plebchan.eth.link, plebbit.eth.limo, plebbit.eth.link
// telegram: t.me/plebbit
// twitter: twitter.com/getplebbit
// github: github.com/plebbit

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

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}
}
