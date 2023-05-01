// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract PlebLp {
    using SafeMath for uint256;
    string public constant name = "PLEBLP";
    string public constant symbol = "PLEBLP";
    uint8 public constant decimals = 18;

    // the farm contract
    IFarm public farm;
    IToken public token;
    IToken public lpToken;

    constructor(IFarm _farm) {
        farm = _farm;
        token = IToken(farm.token());
        (address _lpToken, , ,) = farm.poolInfo(0);
        lpToken = IToken(_lpToken);
    }

    function balanceOf(address account) public view returns (uint256) {
        uint256 staking;
        uint256 notStaking;
        uint256 lpBalance = token.balanceOf(address(lpToken));
        if (lpBalance != 0) {
            uint256 lpAmount = lpToken.balanceOf(account);
            if (lpAmount != 0) {
                uint256 lpPercent = lpAmount.mul(1e12).div(lpToken.totalSupply());
                notStaking = lpBalance.mul(lpPercent).div(1e12);
            }
            (uint256 amount,) = farm.userInfo(0, account);
            if (amount != 0) {
                uint256 percent = amount.mul(1e12).div(lpToken.totalSupply());
                staking = lpBalance.mul(percent).div(1e12);
            }
        }
        uint256 pending = farm.pendingToken(0, account);
        return staking.add(notStaking).add(pending);
    }

    function totalSupply() public view returns (uint256) {
        uint256 lpBalance = token.balanceOf(address(lpToken));
        uint256 farmBalance = token.balanceOf(address(farm));
        return lpBalance.add(farmBalance);
    }
}

interface IFarm {
    function pendingToken(uint256 pid, address account) external view returns (uint256);
    function poolInfo(uint256 pid) external view returns (address, uint256, uint256, uint256);
    function userInfo(uint256 pid, address account) external view returns (uint256, uint256);
    function token() external view returns (address);
}

interface IToken {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}
