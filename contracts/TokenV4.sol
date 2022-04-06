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
    BitMapsUpgradeable.BitMap internal claimedAirdrop2;
    bytes32 public airdropMerkleRoot2;
    BitMapsUpgradeable.BitMap internal claimedAirdrop3;
    bytes32 public airdropMerkleRoot3;
    BitMapsUpgradeable.BitMap internal claimedAirdrop4;
    bytes32 public airdropMerkleRoot4;
}

contract TokenV4 is 
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

    function claimAirdrop2(uint256 amount, bytes32[] calldata merkleProof) external {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        (bool valid, uint256 index) = MerkleProofUpgradeable.verify(merkleProof, airdropMerkleRoot2, leaf);
        require(valid, "claimAirdrop2: merkle proof invalid");
        require(!claimedAirdrop2.get(index), "claimAirdrop2: airdrop already claimed");
        claimedAirdrop2.set(index);

        _mint(msg.sender, amount);
        emit ClaimAirdrop(msg.sender, amount);
    }

    function claimAirdrop3(uint256 amount, bytes32[] calldata merkleProof) external {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        (bool valid, uint256 index) = MerkleProofUpgradeable.verify(merkleProof, airdropMerkleRoot3, leaf);
        require(valid, "claimAirdrop3: merkle proof invalid");
        require(!claimedAirdrop3.get(index), "claimAirdrop3: airdrop already claimed");
        claimedAirdrop3.set(index);

        _mint(msg.sender, amount);
        emit ClaimAirdrop(msg.sender, amount);
    }

    function claimAirdrop4(uint256 amount, bytes32[] calldata merkleProof) external {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        (bool valid, uint256 index) = MerkleProofUpgradeable.verify(merkleProof, airdropMerkleRoot4, leaf);
        require(valid, "claimAirdrop4: merkle proof invalid");
        require(!claimedAirdrop4.get(index), "claimAirdrop4: airdrop already claimed");
        claimedAirdrop4.set(index);

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

    function airdropIsClaimed2(address recipient, uint256 amount, bytes32[] calldata merkleProof) external view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(recipient, amount));
        (, uint256 index) = MerkleProofUpgradeable.verify(merkleProof, airdropMerkleRoot2, leaf);
        if (claimedAirdrop2.get(index)) {
            return true;
        }
        else {
            return false;
        }
    }

    function airdropIsClaimed3(address recipient, uint256 amount, bytes32[] calldata merkleProof) external view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(recipient, amount));
        (, uint256 index) = MerkleProofUpgradeable.verify(merkleProof, airdropMerkleRoot3, leaf);
        if (claimedAirdrop3.get(index)) {
            return true;
        }
        else {
            return false;
        }
    }

    function airdropIsClaimed4(address recipient, uint256 amount, bytes32[] calldata merkleProof) external view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(recipient, amount));
        (, uint256 index) = MerkleProofUpgradeable.verify(merkleProof, airdropMerkleRoot4, leaf);
        if (claimedAirdrop4.get(index)) {
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

    function setAirdropMerkleRoot2(bytes32 _merkleRoot) external onlyRole(MINTER_ROLE) {
        airdropMerkleRoot2 = _merkleRoot;
        emit AirdropMerkleRootChanged(_merkleRoot);
    }

    function setAirdropMerkleRoot3(bytes32 _merkleRoot) external onlyRole(MINTER_ROLE) {
        airdropMerkleRoot3 = _merkleRoot;
        emit AirdropMerkleRootChanged(_merkleRoot);
    }

    function setAirdropMerkleRoot4(bytes32 _merkleRoot) external onlyRole(MINTER_ROLE) {
        airdropMerkleRoot4 = _merkleRoot;
        emit AirdropMerkleRootChanged(_merkleRoot);
    }

    // migrate locker that had a bug
    function migrateLocker() external onlyRole(MINTER_ROLE) {
        _transfer(
            0x88467491BBBaff6833Ab6cd81F04c94a2281f0c6, 
            0x7DB134260b0BE15d5C2Ec8d9246fD51765BF69fc, 
            balanceOf(0x88467491BBBaff6833Ab6cd81F04c94a2281f0c6)
        );
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
