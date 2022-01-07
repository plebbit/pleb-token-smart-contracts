const { ethers, upgrades } = require('hardhat')
const { expect } = require('chai')
const { MerkleTree } = require('merkletreejs')
const keccak256 = require('keccak256')

let totalSupply, balance

const expectRevert = async (promise, revertString) => {
  let error
  try {
    await promise
  }
  catch (e) {
    error = e
  }
  finally {
    expect(error.message).to.equal(`VM Exception while processing transaction: reverted with reason string '${revertString}'`)
  }
}

describe('Token', function () {
  it('deploys', async function () {
    const [owner, user1, user2, user3] = await ethers.getSigners();

    const Token = await ethers.getContractFactory('Token');
    const TokenV2 = await ethers.getContractFactory('TokenV2');

    // deploy initial proxy
    const proxy = await upgrades.deployProxy(Token, { kind: 'uups' });
    await proxy.deployed();
    console.log('proxy address:', proxy.address)
    console.log('owner address:', owner.address)

    // first implementation total supply
    totalSupply = (await proxy.totalSupply()).toString()
    expect(totalSupply).to.equal('0')
    expect(await proxy.name()).to.equal('PlebToken')
    expect(await proxy.symbol()).to.equal('PLEB')

    // upgrade
    const upgraded = await upgrades.upgradeProxy(proxy.address, TokenV2);

    // try to mint without minter role
    await expectRevert(
      upgraded.mint('0x0000000000000000000000000000000000000001', '1'),
      'AccessControl: account 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6'
    )

    // add minter role
    const MINTER_ROLE = await upgraded.MINTER_ROLE()
    await upgraded.grantRole(MINTER_ROLE, owner.address)

    // mint 1
    await upgraded.mint('0x0000000000000000000000000000000000000001', '1')
    totalSupply = (await upgraded.totalSupply()).toString()
    expect(totalSupply).to.equal('1')
    totalSupply = (await proxy.totalSupply()).toString()
    expect(totalSupply).to.equal('1')

    // try minting from different user
    await expectRevert(
      upgraded.connect(user1).mint('0x0000000000000000000000000000000000000001', '1'),
      'AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6'
    )

    // prepare to set airdrop merkle root
    const recipients = {[owner.address]: '10', [user1.address]: '20', [user2.address]: '30'}
    const elements = []
    for (recipientAddress in recipients) {
      const recipientAmount = recipients[recipientAddress]
      elements.push(ethers.utils.solidityPack(['address', 'uint256'], [recipientAddress, recipientAmount]))
    }
    const merkleTree = new MerkleTree(elements, keccak256, { hashLeaves: true, sortPairs: true });
    const root = merkleTree.getHexRoot();
    console.log({recipients, elements, root})
    expect(await upgraded.airdropMerkleRoot()).to.equal('0x0000000000000000000000000000000000000000000000000000000000000000')

    // try to claim airdrop before merkle root is set
    let leaf, proof
    leaf = keccak256(elements[1])
    proof = merkleTree.getHexProof(leaf);
    await expectRevert(
      upgraded.connect(user1).claimAirdrop('20', proof),
      'claimAirdrop: merkle proof invalid'
    )
    await expectRevert(
      upgraded.connect(user1).claimAirdrop('20', []),
      'claimAirdrop: merkle proof invalid'
    )

    // set airdrop merkle root
    await upgraded.setAirdropMerkleRoot(root)
    expect(await upgraded.airdropMerkleRoot()).to.equal(root)

    // try to claim airdrop with wrong amount
    leaf = keccak256(elements[1])
    proof = merkleTree.getHexProof(leaf);
    await expectRevert(
      upgraded.connect(user1).claimAirdrop('19', proof),
      'claimAirdrop: merkle proof invalid'
    )

    // try to claim airdrop with incorrect proof
    leaf = keccak256(elements[0])
    proof = merkleTree.getHexProof(leaf);
    await expectRevert(
      upgraded.connect(user1).claimAirdrop('20', proof),
      'claimAirdrop: merkle proof invalid'
    )

    // try to claim airdrop with correct proof
    leaf = keccak256(elements[1])
    proof = merkleTree.getHexProof(leaf);
    console.log({leaf: leaf.toString('hex'), proof})
    // check if airdrop is claimed
    expect(await upgraded.airdropIsClaimed(user1.address, '20', proof)).to.equal(false)
    await upgraded.connect(user1).claimAirdrop('20', proof)
    balance = (await upgraded.balanceOf(user1.address)).toString()
    expect(balance).to.equal('20')
    // check if airdrop is claimed
    expect(await upgraded.airdropIsClaimed(user1.address, '20', proof)).to.equal(true)

    // try to claim airdrop twice
    await expectRevert(
      upgraded.connect(user1).claimAirdrop('20', proof),
      'claimAirdrop: airdrop already claimed'
    )

    // try to claim airdrop with correct proof with other user
    leaf = keccak256(elements[2])
    proof = merkleTree.getHexProof(leaf);
    console.log({leaf: leaf.toString('hex'), proof})
    await upgraded.connect(user2).claimAirdrop('30', proof)
    balance = (await upgraded.balanceOf(user2.address)).toString()
    expect(balance).to.equal('30')

    // second implementation name
    expect(await proxy.name()).to.equal('PlebToken')
    expect(await proxy.symbol()).to.equal('PLEB')
    expect(await upgraded.name()).to.equal('PlebToken')
    expect(await upgraded.symbol()).to.equal('PLEB')
  });
});