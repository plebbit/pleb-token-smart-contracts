pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Locker is Ownable {
    // a time + amount pool
    struct TimeAmount {
        uint256 time;
        uint256 amount;
    }

    // the token to lock
    IERC20 public token;

    // the pools
    TimeAmount[] public timeAmounts;

    // the balance of each address in each pool
    mapping (uint256 => mapping (address => uint256)) public balanceOf;

    // total supply in each pool
    mapping (uint256 => uint256) public totalSupply;

    // locker is open for new lockings
    bool public isLocking = true;

    modifier requireIsLocking {
      require(isLocking, 'locker: locking closed');
      _;
    }

    event Lock(address indexed _address, uint256 indexed _timeAmountIndex, uint256 _amount);
    event Unlock(address indexed _address, uint256 indexed _timeAmountIndex, uint256 _amount);

    constructor(IERC20 _token, TimeAmount[] memory _timeAmounts) {
        token = _token;
        uint256 i = 0;
        while (i < _timeAmounts.length) {
            timeAmounts.push(_timeAmounts[i++]);
        }
    }

    // if someone sends wrong tokens to this contract, owner can send them back
    function recoverWrongTokensSentToContract(IERC20 _token, address _address, uint256 _balance) public onlyOwner {
        require(token != _token, 'locker: only recover wrong tokens');
        _token.transfer(_address, _balance);
    }

    // edit pool
    function setTimeAmount(uint256 _timeAmountIndex, TimeAmount memory _timeAmounts) public onlyOwner {
        timeAmounts[_timeAmountIndex] = _timeAmounts;
    }

    // add pool
    function addTimeAmount(TimeAmount memory _timeAmounts) public onlyOwner {
        timeAmounts.push(_timeAmounts);
    }

    // close depositing
    function setIsLocking(bool _isLocking) public onlyOwner {
        isLocking = _isLocking;
    }

    function lock(uint256 _timeAmountIndex, uint256 _amount) public requireIsLocking {
        require(_timeAmountIndex < timeAmounts.length, 'locker: _timeAmountIndex does not exist');
        TimeAmount memory timeAmount = timeAmounts[_timeAmountIndex];
        require(_amount >= timeAmount.amount, 'locker: _amount smaller than timeAmount.amount');

        // transfer the token
        token.transferFrom(msg.sender, address(this), _amount);
        balanceOf[_timeAmountIndex][msg.sender] = _amount;
        emit Lock(msg.sender, _timeAmountIndex, _amount);

        // update total supply
        totalSupply[_timeAmountIndex] += _amount;
    }

    // lock without approving
    function lockWithPermit(uint256 _timeAmountIndex, uint256 _amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public {
        token.permit(address(msg.sender), address(this), _amount, deadline, v, r, s);
        lock(_timeAmountIndex, _amount);
    }

    function unlock(uint256 _timeAmountIndex) public {
        require(_timeAmountIndex < timeAmounts.length, 'locker: _timeAmountIndex does not exist');
        uint256 balance = balanceOf[_timeAmountIndex][msg.sender];
        require(balance > 0, 'locker: _timeAmountIndex balance is 0');
        TimeAmount memory timeAmount = timeAmounts[_timeAmountIndex];
        require(block.timestamp > timeAmount.time, 'locker: lock time not elapsed');

        // transfer the token
        balanceOf[_timeAmountIndex][msg.sender] = 0;
        token.transfer(msg.sender, balance);
        emit Unlock(msg.sender, _timeAmountIndex, balance);

        // update total supply
        totalSupply[_timeAmountIndex] -= balance;
    }

    // how much time left until a pool unlocks
    function timeLeft(uint256 _timeAmountIndex) public view returns (uint256) {
        require(_timeAmountIndex < timeAmounts.length, 'locker: _timeAmountIndex does not exist');
        if (block.timestamp > timeAmounts[_timeAmountIndex].time) {
            return 0;
        }
        return timeAmounts[_timeAmountIndex].time - block.timestamp;
    }

    function timeAmountCount() public view returns (uint256) {
        return timeAmounts.length;
    }
}

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external;
}
