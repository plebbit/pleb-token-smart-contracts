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

contract TokenV3 is 
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

    // pause transfers while rebasing 
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override { 
        super._beforeTokenTransfer(from, to, amount); 
        require(hasRole(MIGRATOR_ROLE, _msgSender()), "transfers paused, rebase in progress, try again in a few minutes");
    }

    function rebaseTo210M(address[] calldata holders) external onlyRole(MIGRATOR_ROLE) {
        uint256 len = holders.length;
        for (uint256 i; i < len; ) {
            address holder = holders[i];
            uint256 previousBalance = balanceOf(holder);
            if (previousBalance != 0) {
                // 140556113986173 is ~0.000140556113986173, to convert total supply from 1.5T to 210M
                uint256 burnAmount = previousBalance - (previousBalance * 140556113986173 / 1e18);
                if (burnAmount != 0) {
                    _burn(holder, burnAmount);
                }
            }
            unchecked { ++i; }
        }
    }

    // call sync after all rebase are finished
    // must be called before unpausing transfers or someone can extract the LP
    function syncUniswapV2Pair() public {
        IUniswapV2Pair(0xBc628F41b8f791F8527fbC6563fBB0d786B33c84).sync();
    }

    // if rebase total supply is slightly smaller than 210M, mint a small amount to reach 210M
    function setTotalSupplyTo210M() external onlyRole(MIGRATOR_ROLE) {
        uint256 target = 210_000_000 * 1e18;
        uint256 current = totalSupply();
        if (current < target) {
            uint256 mintAmount = target - current;
            _mint(_msgSender(), mintAmount);
        }
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}
}

interface IUniswapV2Pair {
    function sync() external;
}