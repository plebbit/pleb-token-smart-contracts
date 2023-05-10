// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/BitMapsUpgradeable.sol";
import "./MerkleProofUpgradeable.sol";

contract TokenStorage {
    BitMapsUpgradeable.BitMap internal claimedAirdrop;
    bytes32 public airdropMerkleRoot;
}

contract TokenV2 is 
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

    function claimAirdrop(uint256 amount, bytes32[] calldata merkleProof) external {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        (bool valid, uint256 index) = MerkleProofUpgradeable.verify(merkleProof, airdropMerkleRoot, leaf);
        require(valid, "claimAirdrop: merkle proof invalid");
        require(!claimedAirdrop.get(index), "claimAirdrop: airdrop already claimed");
        claimedAirdrop.set(index);

        _mint(msg.sender, amount);
        emit ClaimAirdrop(msg.sender, amount);
    }

    function airdropIsClaimed(address recipient, uint256 amount, bytes32[] calldata merkleProof) external view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(recipient, amount));
        (, uint256 index) = MerkleProofUpgradeable.verify(merkleProof, airdropMerkleRoot, leaf);
        if (claimedAirdrop.get(index)) {
            return true;
        }
        else {
            return false;
        }
    }

    function setAirdropMerkleRoot(bytes32 _merkleRoot) external onlyRole(MINTER_ROLE) {
        airdropMerkleRoot = _merkleRoot;
        emit AirdropMerkleRootChanged(_merkleRoot);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}
}
