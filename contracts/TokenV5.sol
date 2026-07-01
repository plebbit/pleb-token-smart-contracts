// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract TokenStorage {
    // put variables here
    bool internal migrating;
}

contract TokenV5 is 
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
        __ERC20_init("Bitsocial", "BSO");
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

    // rebrand from plebbit to bitsocial
    function name() public view virtual override returns (string memory) {
        return "Bitsocial";
    }

    // rebrand from plebbit to bitsocial
    function symbol() public view virtual override returns (string memory) {
        return "BSO";
    }

    function migrateLp(
        address router,
        address pair,
        address token0,
        address token1
    ) external onlyRole(MIGRATOR_ROLE) {
        uint256 pairBalance = balanceOf(pair);
        uint256 reserve = 100 * 1e18;
        require(pairBalance > reserve, "lp too small to migrate");

        uint256 amount = pairBalance - reserve;
        _transfer(pair, address(this), amount);
        IPair(pair).sync();

        _approve(address(this), router, amount);
        address[] memory path = new address[](2);
        path[0] = token0;
        path[1] = token1;

        migrating = true;
        IRouter(router).swapExactTokensForTokens(
            amount, 
            0, 
            path,
            msg.sender,
            block.timestamp
        );
        migrating = false;
    }

    function migrate(address[] calldata addresses) external onlyRole(MIGRATOR_ROLE) {
        for (uint256 i = 0; i < addresses.length; i++) {
            uint256 bal = balanceOf(addresses[i]);
            if (bal > 0) {
                _burn(addresses[i], bal);
            }
        }
    }

    function burn(uint256 amount) public override {
        revert("token migrated");
    }

    function burnFrom(address account, uint256 amount) public override {
        revert("token migrated");
    }

    function transfer(address recipient, uint256 amount)
        public
        override
        returns (bool)
    {
        revert("token migrated");
    }

    function transferFrom(address sender, address recipient, uint256 amount)
        public
        override
        returns (bool)
    {
        if (migrating) {
            return super.transferFrom(sender, recipient, amount);
        }
        revert("token migrated");
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}
}

interface IPair {
    function sync() external;
}

interface IRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}