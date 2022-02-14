pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Farm is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    struct PoolInfo {
        IERC20 lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accTokenPerShare;
    }

    IToken public token;

    uint256 public bonusEndBlock;
    uint256 public tokenPerBlock;
    uint256 public bonusMultiplier;

    PoolInfo[] public poolInfo;
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    mapping (address => bool) private poolIsAdded;
    uint256 public totalAllocPoint = 0;
    uint256 public startBlock;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        IToken _token,
        uint256 _tokenPerBlock,
        uint256 _bonusMultiplier,
        uint256 _startBlock,
        uint256 _bonusEndBlock
    ) {
        token = _token;
        tokenPerBlock = _tokenPerBlock;
        bonusMultiplier = _bonusMultiplier;
        startBlock = _startBlock;
        bonusEndBlock = _bonusEndBlock;
    }

    function setTokenPerBlock(uint256 _tokenPerBlock) public onlyOwner {
        tokenPerBlock = _tokenPerBlock;
    }

    function setBonusMultiplier(uint256 _bonusMultiplier) public onlyOwner {
        bonusMultiplier = _bonusMultiplier;
    }

    function setStartBlock(uint256 _startBlock) public onlyOwner {
        startBlock = _startBlock;
    }

    function setBonusEndBlock(uint256 _bonusEndBlock) public onlyOwner {
        bonusEndBlock = _bonusEndBlock;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // add pool 
    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) public onlyOwner {
    	require(poolIsAdded[address(_lpToken)] == false, 'add: cannot add duplicate pool');
        poolIsAdded[address(_lpToken)] = true;

        if (_withUpdate) {
            updatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accTokenPerShare: 0
        }));
    }

    // update pool allocation point
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            updatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    // reward multiplier _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_to <= bonusEndBlock) {
            uint256 timeAdjustedBonusMultiplier = bonusMultiplier.mul(getPercentBonusTimeLeft());
            if (timeAdjustedBonusMultiplier < 1e12) {
                timeAdjustedBonusMultiplier = 1e12;
            }
            return _to.sub(_from).mul(timeAdjustedBonusMultiplier);
        } else if (_from >= bonusEndBlock) {
            return _to.sub(_from).mul(1e12);
        } else {
            uint256 timeAdjustedBonusMultiplier = bonusMultiplier.mul(getPercentBonusTimeLeft());
            if (timeAdjustedBonusMultiplier < 1e12) {
                timeAdjustedBonusMultiplier = 1e12;
            }
            return bonusEndBlock.sub(_from).mul(timeAdjustedBonusMultiplier).add(
                _to.sub(bonusEndBlock).mul(1e12)
            );
        }
    }

    // bonus reduces linearly with time
    function getPercentBonusTimeLeft() public view returns (uint256) {
        if (block.number < startBlock || bonusEndBlock < startBlock) {
            return 1e12;
        }
        /*
        uint256 totalBonusTime = bonusEndBlock.sub(startBlock);
        uint256 bonusTimeElapsed = block.number.sub(startBlock);
        uint256 percentBonusTimeElapsed = bonusTimeElapsed.mul(1e12).div(totalBonusTime);
        if (uint256(1e12) < percentBonusTimeElapsed) {
            return 0;
        }
        uint256 percentBonusTimeLeft = uint256(1e12).sub(percentBonusTimeElapsed);
        return percentBonusTimeLeft;
        */
        uint256 percentBonusTimeElapsed = block.number.sub(startBlock).mul(1e12).div(bonusEndBlock.sub(startBlock));
        if (uint256(1e12) < percentBonusTimeElapsed) {
            return 0;
        }
        return uint256(1e12).sub(percentBonusTimeElapsed);
    }

    // view pending tokens
    function pendingToken(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accTokenPerShare = pool.accTokenPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 tokenReward = multiplier.mul(tokenPerBlock).div(1e12).mul(pool.allocPoint).div(totalAllocPoint);
            accTokenPerShare = accTokenPerShare.add(tokenReward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accTokenPerShare).div(1e12).sub(user.rewardDebt);
    }

    // update pools reward variables
    function updatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // update pool reward variables
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 tokenReward = multiplier.mul(tokenPerBlock).div(1e12).mul(pool.allocPoint).div(totalAllocPoint);

        token.mint(address(this), tokenReward);
        pool.accTokenPerShare = pool.accTokenPerShare.add(tokenReward.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    // deposit lp tokens
    function deposit(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
            safeTokenTransfer(msg.sender, pending);
        }
        pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
        user.amount = user.amount.add(_amount);
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // withdraw lp tokens
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: cannot withdraw more than earned");
        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
        safeTokenTransfer(msg.sender, pending);
        user.amount = user.amount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);
        pool.lpToken.safeTransfer(address(msg.sender), _amount);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // withdraw lp tokens without rewards
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    function safeTokenTransfer(address _to, uint256 _amount) internal {
        uint256 tokenBal = token.balanceOf(address(this));
        if (_amount > tokenBal) {
            token.transfer(_to, tokenBal);
        } else {
            token.transfer(_to, _amount);
        }
    }
}

interface IToken {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function mint(address to, uint256 amount) external;
}
