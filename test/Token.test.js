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
    expect(error?.message).to.equal(`VM Exception while processing transaction: reverted with reason string '${revertString}'`)
  }
}

describe('Token', function () {
  it('deploys', async function () {
    const [owner, user1, user2, user3] = await ethers.getSigners()

    const TokenV1 = await ethers.getContractFactory('Token')

    // deploy initial proxy
    const tokenV1 = await upgrades.deployProxy(TokenV1, { kind: 'uups' })
    await tokenV1.deployed()
    console.log('proxy address:', tokenV1.address)
    console.log('owner address:', owner.address)

    // try to mint without minter role
    await expectRevert(
      tokenV1.mint('0x0000000000000000000000000000000000000001', '1'),
      'AccessControl: account 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 is missing role 0x600e5f1c60beb469a3fa6dd3814a4ae211cc6259a6d033bae218a742f2af01d3'
    )

    // add minter role
    const MIGRATOR_ROLE = await tokenV1.MIGRATOR_ROLE()
    console.log({MIGRATOR_ROLE})
    await tokenV1.grantRole(MIGRATOR_ROLE, owner.address)

    // 1 trillion
    const zeros = '000000000000000000'
    const totalSupply = ('1 000 000 000 000' + zeros).replaceAll(' ', '')

    // mint 1
    await tokenV1.mint(owner.address, totalSupply)
    expect((await tokenV1.totalSupply()).toString()).to.equal(totalSupply)

    // try minting from different user
    await expectRevert(
      tokenV1.connect(user1).mint('0x0000000000000000000000000000000000000001', '1'),
      'AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x600e5f1c60beb469a3fa6dd3814a4ae211cc6259a6d033bae218a742f2af01d3'
    )

    // migrate distribute
    const amount1 = ('1 000 000 000' + zeros).replaceAll(' ', '')
    const amount2 = ('2 000 000 000' + zeros).replaceAll(' ', '')
    const amount3 = ('3 000 000 000' + zeros).replaceAll(' ', '')
    await tokenV1.migrate([
      user1.address,
      user2.address,
      user3.address,
    ], [amount1, amount2, amount3])
    expect((await tokenV1.balanceOf(user1.address)).toString()).to.equal(amount1)
    expect((await tokenV1.balanceOf(user2.address)).toString()).to.equal(amount2)
    expect((await tokenV1.balanceOf(user3.address)).toString()).to.equal(amount3)

    const amounts = []
    const addresses = []
    while (addresses.length < 100) {
      let address = '000000000000000000000000000000000000000' + (addresses.length + 1)
      address = '0x' + address.slice(-40)
      addresses.push(address)
      amounts.push(('1 000 000 000' + zeros).replaceAll(' ', ''))
    }
    console.log((await tokenV1.estimateGas.migrate(addresses, amounts)).toString())

    // try to transfer
    await expectRevert(
      tokenV1.connect(user1).transfer(user2.address, '1'),
      'migration not finished'
    )
    await expectRevert(
      tokenV1.connect(user1).transferFrom(user1.address, user2.address, '1'),
      'migration not finished'
    )
    await expectRevert(
      tokenV1.connect(user1).transferFrom(owner.address, user2.address, '1'),
      'ERC20: insufficient allowance'
    )

    // set up lp and distribute it
    const weth = await upgrades.deployProxy(TokenV1, { kind: 'uups' })
    await weth.deployed()
    await weth.grantRole(MIGRATOR_ROLE, owner.address)
    await weth.mint(owner.address, '100' + zeros)
    const UniswapV2Pair = await ethers.getContractFactory('UniswapV2Pair')
    const uniswapV2Pair = await UniswapV2Pair.connect(owner).deploy()
    await uniswapV2Pair.initialize(weth.address, tokenV1.address)
    await tokenV1.approve(owner.address, '99999999999999999999999999999999999999999999')
    await weth.approve(owner.address, '99999999999999999999999999999999999999999999')
    await tokenV1.transferFrom(owner.address, uniswapV2Pair.address, ('100 000 000 000' + zeros).replaceAll(' ', ''))
    await weth.transferFrom(owner.address, uniswapV2Pair.address, '20' + zeros)
    await uniswapV2Pair.mint(owner.address)
    expect((await uniswapV2Pair.balanceOf(owner.address)).toString()).to.equal('1414213562373095048800688')
    expect((await uniswapV2Pair.totalSupply()).toString()).to.equal('1414213562373095048801688')
    await uniswapV2Pair.transfer(user1.address, '1' + zeros)

    //  upgrade token
    const TokenV2 = await ethers.getContractFactory('TokenV2')
    const tokenV2 = await upgrades.upgradeProxy(tokenV1.address, TokenV2)
    expect((await tokenV2.totalSupply()).toString()).to.equal(totalSupply)

    // try to mint, migrate, transfer
    expect(tokenV2.mint).to.equal(undefined)
    expect(tokenV2.migrate).to.equal(undefined)
    await tokenV2.connect(user1).transfer(user2.address, '1')
    await expectRevert(
      tokenV2.connect(user1).transferFrom(user1.address, user2.address, '1'),
      'ERC20: insufficient allowance'
    )
   })
})
