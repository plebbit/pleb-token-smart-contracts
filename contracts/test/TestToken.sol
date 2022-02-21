pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    address public owner;
    address public minter;
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        owner = msg.sender;
    }

    function mint(address to, uint256 amount) public {
        require(msg.sender == owner || msg.sender == minter, "mint: not allowed");
        _mint(to, amount);
    }

    function setMinter(address _minter) public {
        require(msg.sender == owner, "setMinter: not allowed");
        minter = _minter;
    }

    function burn(address to, uint256 amount) public {
        require(msg.sender == owner, "burn: not allowed");
        _burn(to, amount);
    }
}
