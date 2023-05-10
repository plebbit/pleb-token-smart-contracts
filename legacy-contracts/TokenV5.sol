pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/BitMapsUpgradeable.sol";

contract TokenStorage {
    BitMapsUpgradeable.BitMap internal claimedAirdrop;
    bytes32 public airdropMerkleRoot;
    BitMapsUpgradeable.BitMap internal claimedAirdrop2;
    bytes32 public airdropMerkleRoot2;
    BitMapsUpgradeable.BitMap internal claimedAirdrop3;
    bytes32 public airdropMerkleRoot3;
    BitMapsUpgradeable.BitMap internal claimedAirdrop4;
    bytes32 public airdropMerkleRoot4;
}

contract TokenV5 is 
    Initializable, 
    ERC20Upgradeable, 
    ERC20BurnableUpgradeable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable,
    TokenStorage
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function initialize() initializer public {
        __ERC20_init("", "");
        __ERC20Burnable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
        _setupRole(UPGRADER_ROLE, msg.sender);
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    using BitMapsUpgradeable for BitMapsUpgradeable.BitMap;
    event ClaimAirdrop(address indexed claimant, uint256 amount);
    event AirdropMerkleRootChanged(bytes32 merkleRoot);

    // helper function to help migrate liquidity
    function migrate(address from, address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _transfer(from, to, amount);
    }

    function burn(uint256 amount) public override {
        revert("token migrated to ethereum");
    }

    function burnFrom(address account, uint256 amount) public override {
        revert("token migrated to ethereum");
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        if (recipient == 0x3d0e5A9453BA51516eF688FB82d9F5f601FF6C11) || sender == 0x3d0e5A9453BA51516eF688FB82d9F5f601FF6C11) {
            return super.transfer(recipient, amount);
        }
        revert("token migrated to ethereum");
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
        if (recipient == 0x3d0e5A9453BA51516eF688FB82d9F5f601FF6C11) || sender == 0x3d0e5A9453BA51516eF688FB82d9F5f601FF6C11) {
            return super.transferFrom(sender, recipient, amount);
        }
        revert("token migrated to ethereum");
        return true;
    }

    // if someone sends tokens to this contract, minter can send them back
    function recoverTokensSentToContract(ERC20Upgradeable _token, address _address, uint256 _amount) external onlyRole(MINTER_ROLE) {
        _token.transfer(_address, _amount);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}
}
