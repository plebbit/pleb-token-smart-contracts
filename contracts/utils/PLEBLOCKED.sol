// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PlebLocked {
    string public constant name = "PLEBLOCKED";
    string public constant symbol = "PLEBLOCKED";
    uint8 public constant decimals = 18;

    // the locker contract
    ILocker public locker;

    constructor(ILocker _locker) {
        locker = _locker;
    }

    function balanceOf(address account) public view returns (uint256) {
        uint256 timeAmountCount = locker.timeAmountCount();
        uint256 balance;
        for (uint256 i = 0; i < timeAmountCount; i++) {
            balance += locker.balanceOf(i, account);
        }
        return balance;
    }

    function totalSupply() public view returns (uint256) {
        uint256 timeAmountCount = locker.timeAmountCount();
        uint256 supply;
        for (uint256 i = 0; i < timeAmountCount; i++) {
            supply += locker.totalSupply(i);
        }
        return supply;
    }
}

interface ILocker {
    function timeAmountCount() external view returns (uint256);
    function balanceOf(uint256 timeAmountIndex, address account) external view returns (uint256);
    function totalSupply(uint256 timeAmountIndex) external view returns (uint256);
}
