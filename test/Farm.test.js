const { ethers } = require('hardhat')
const assert = require('assert')

const zeros = '000000000000000000'

const expectRevert = async (promise, revertString) => {
  let error
  try {
    await promise
  }
  catch (e) {
    error = e
  }
  finally {
    assert.equal(error?.message, `VM Exception while processing transaction: reverted with reason string '${revertString}'`)
  }
}

const advanceBlockTo = async (newBlockNumber) => {
  const blockNumber = await ethers.provider.getBlockNumber()
  assert(newBlockNumber > blockNumber, `can't advance from block ${blockNumber} to previous block ${newBlockNumber}`)
  let blocksToMine = newBlockNumber - blockNumber
  while (blocksToMine--) {
    await ethers.provider.send('evm_mine')
  }
}

const deployToken = async () => {
  [owner] = await ethers.getSigners()
  const Token = await ethers.getContractFactory('TokenV3')
  const token = await upgrades.deployProxy(Token, { kind: 'uups' })
  await token.deployed()
  const MINTER_ROLE = await token.MINTER_ROLE()
  await token.grantRole(MINTER_ROLE, owner.address)
  return token
}

const deployFarm = async (token, _tokenPerBlock, _bonusMultiplier, _startBlock, _bonusEndBlock) => {
  [owner, user1] = await ethers.getSigners()
  const Farm = await ethers.getContractFactory('Farm')
  const farm = await Farm.connect(user1).deploy(token.address, _tokenPerBlock, _bonusMultiplier, _startBlock, _bonusEndBlock)
  await token.grantRole(await token.MINTER_ROLE(), farm.address)
  return farm
}

const deployLps = async () => {
  const [owner, user1, user2, user3] = await ethers.getSigners()
  const lp = await deployToken()
  await lp.mint(owner.address, '10000000000')
  await lp.transfer(user1.address, '1000')
  await lp.transfer(user2.address, '1000')
  await lp.transfer(user3.address, '1000')
  const lp2 = await deployToken()
  await lp2.mint(owner.address, '10000000000')
  await lp2.transfer(user1.address, '1000')
  await lp2.transfer(user2.address, '1000')
  await lp2.transfer(user3.address, '1000')
  return [lp, lp2]
}

describe('Farm', () => {
  it('test token', async () => {
    const [owner, user1] = await ethers.getSigners()
    const Token = await ethers.getContractFactory('TestToken')
    const token = await Token.deploy('TestToken', 'TEST')
    assert.equal(await token.name(), 'TestToken')
    assert.equal(await token.symbol(), 'TEST')
    await token.mint(owner.address, '1000' + zeros)
    assert.equal(await token.balanceOf(owner.address), '1000' + zeros)
    assert.equal(await token.totalSupply(), '1000' + zeros)
    await token.setMinter(user1.address)
    await token.connect(user1).mint(user1.address, '1000' + zeros)
  })

  it('setters and getters', async () => {
    const [owner, user1, user2, user3] = await ethers.getSigners()
    const token = await deployToken()
    const farm = await deployFarm(token, '1', '2', '3', '4')

    assert.equal(await farm.token(), token.address)
    assert.equal(await farm.tokenPerBlock(), '1')
    assert.equal(await farm.bonusMultiplier(), '2')
    assert.equal(await farm.startBlock(), '3')
    assert.equal(await farm.bonusEndBlock(), '4')
    await farm.connect(user1).setTokenPerBlock('10000')
    assert.equal(await farm.tokenPerBlock(), '10000')
    await farm.connect(user1).setBonusMultiplier('10000')
    assert.equal(await farm.bonusMultiplier(), '10000')
    await farm.connect(user1).setStartBlock('10000')
    assert.equal(await farm.startBlock(), '10000')
    await farm.connect(user1).setBonusEndBlock('10000')
    assert.equal(await farm.bonusEndBlock(), '10000')
    await expectRevert(farm.connect(user2).setTokenPerBlock('666'), 'Ownable: caller is not the owner')
    await expectRevert(farm.connect(user3).setTokenPerBlock('666'), 'Ownable: caller is not the owner')
    await expectRevert(farm.connect(user2).setBonusMultiplier('666'), 'Ownable: caller is not the owner')
    await expectRevert(farm.connect(user3).setBonusMultiplier('666'), 'Ownable: caller is not the owner')
    await expectRevert(farm.connect(user2).setBonusEndBlock('666'), 'Ownable: caller is not the owner')
    await expectRevert(farm.connect(user3).setBonusEndBlock('666'), 'Ownable: caller is not the owner')
    await expectRevert(farm.connect(user2).setStartBlock('666'), 'Ownable: caller is not the owner')
    await expectRevert(farm.connect(user3).setStartBlock('666'), 'Ownable: caller is not the owner')
  })

  it('emergency withdraw', async () => {
    const [owner, user1, user2, user3] = await ethers.getSigners()
    const token = await deployToken()
    const farm = await deployFarm(token, '100000', '10', '100', '1000')
    const [lp, lp2] = await deployLps()

    await farm.add('10', lp.address, true)
    await lp.connect(user2).approve(farm.address, '1000')
    await farm.connect(user2).deposit('0', '100')
    assert.equal(await lp.balanceOf(user2.address), '900')
    await farm.connect(user2).emergencyWithdraw('0')
    assert.equal(await lp.balanceOf(user2.address), '1000')
  })

  it('start block', async () => {
    const [owner, user1, user2, user3] = await ethers.getSigners()
    const token = await deployToken()
    const farm = await deployFarm(token, '10000', '10', '100', '1000')
    const [lp, lp2] = await deployLps()

    await farm.add('100', lp.address, true)
    await lp.connect(user2).approve(farm.address, '1000')
    await farm.connect(user2).deposit('0', '100')
    await advanceBlockTo('89')
    await farm.connect(user2).deposit('0', '0')
    assert.equal(await token.balanceOf(user2.address), '0')
    await advanceBlockTo('94')
    await farm.connect(user2).deposit('0', '0')
    assert.equal(await token.balanceOf(user2.address), '0')
    await advanceBlockTo('99')
    await farm.connect(user2).deposit('0', '0')
    assert.equal(await token.balanceOf(user2.address), '0')
    await farm.connect(user2).deposit('0', '0')
    assert.equal(await token.balanceOf(user2.address), '99888')
    await advanceBlockTo('104')
    await farm.connect(user2).deposit('0', '0')
    assert.equal(await token.balanceOf(user2.address), '497665')
    assert.equal(await token.balanceOf(user3.address), '0')
    assert.equal(await token.totalSupply(), '497665')
  })

  it('no deposits', async () => {
    const [owner, user1, user2, user3] = await ethers.getSigners()
    const token = await deployToken()
    const farm = await deployFarm(token, '100', '10', '100', '1000')
    const [lp, lp2] = await deployLps()

    await farm.add('10', lp.address, true)
    await lp.connect(user2).approve(farm.address, '1000')
    await advanceBlockTo('199')
    assert.equal(await token.totalSupply(), '0')
    await advanceBlockTo('204')
    assert.equal(await token.totalSupply(), '0')
    await advanceBlockTo('209')
    await farm.connect(user2).deposit('0', '10')
    assert.equal(await token.totalSupply(), '0')
    assert.equal(await token.balanceOf(user2.address), '0')
    assert.equal(await token.balanceOf(user3.address), '0')
    assert.equal(await lp.balanceOf(user2.address), '990')
    await advanceBlockTo('219')
    await farm.connect(user2).withdraw('0', '10')
    assert.equal(await token.totalSupply(), '8666')
    assert.equal(await token.balanceOf(user2.address), '8666')
    assert.equal(await token.balanceOf(user3.address), '0')
    assert.equal(await lp.balanceOf(user2.address), '1000')
  })

  it('multiple deposits', async () => {
    const [owner, user1, user2, user3, user4] = await ethers.getSigners()
    const token = await deployToken()
    const farm = await deployFarm(token, '100', '10', '100', '1000')
    const [lp, lp2] = await deployLps()

    await farm.add('100', lp.address, true)
    await lp.connect(user1).approve(farm.address, '1000')
    await lp.connect(user2).approve(farm.address, '1000')
    await lp.connect(user3).approve(farm.address, '1000')
    await advanceBlockTo('309')
    await farm.connect(user1).deposit('0', '10')
    await advanceBlockTo('313')
    await farm.connect(user2).deposit('0', '20')
    await advanceBlockTo('317')
    await farm.connect(user3).deposit('0', '30')
    await advanceBlockTo('319')
    await farm.connect(user1).deposit('0', '10')
    assert.equal(await token.totalSupply(), '7590')
    assert.equal(await token.balanceOf(user1.address), '4310')
    assert.equal(await token.balanceOf(user2.address), '0')
    assert.equal(await token.balanceOf(user3.address), '0')
    assert.equal(await token.balanceOf(farm.address), '3280')
    assert.equal(await token.balanceOf(user4.address), '0')
    await advanceBlockTo('329')
    await farm.connect(user2).withdraw('0', '5')
    assert.equal(await token.totalSupply(), '15034')
    assert.equal(await token.balanceOf(user1.address), '4310')
    assert.equal(await token.balanceOf(user2.address), '4651')
    assert.equal(await token.balanceOf(user3.address), '0')
    assert.equal(await token.balanceOf(farm.address), '6073')
    assert.equal(await token.balanceOf(user4.address), '0')
    await advanceBlockTo('339')
    await farm.connect(user1).withdraw('0', '20')
    await advanceBlockTo('349')
    await farm.connect(user2).withdraw('0', '15')
    await advanceBlockTo('359')
    await farm.connect(user3).withdraw('0', '30')
    assert.equal(await token.totalSupply(), '36700')
    assert.equal(await token.balanceOf(user4.address), '0')
    assert.equal(await token.balanceOf(user1.address), '8693')
    assert.equal(await token.balanceOf(user2.address), '8750')
    assert.equal(await token.balanceOf(user3.address), '19256')
    assert.equal(await lp.balanceOf(user1.address), '1000')
    assert.equal(await lp.balanceOf(user2.address), '1000')
    assert.equal(await lp.balanceOf(user3.address), '1000')
  })

  it('multiple pools', async () => {
    const [owner, user1, user2] = await ethers.getSigners()
    const token = await deployToken()
    const farm = await deployFarm(token, '100', '10', '400', '1000')
    const [lp, lp2] = await deployLps()

    await lp.connect(user1).approve(farm.address, '1000')
    await lp2.connect(user2).approve(farm.address, '1000')
    await farm.add('10', lp.address, true)
    await advanceBlockTo('409')
    await farm.connect(user1).deposit('0', '10')
    await advanceBlockTo('419')
    await farm.add('20', lp2.address, true)
    assert.equal(await farm.pendingToken('0', user1.address), '9666')
    await advanceBlockTo('424')
    await farm.connect(user2).deposit('1', '5')
    assert.equal(await farm.pendingToken('0', user1.address), '11263')
    await advanceBlockTo('430')
    assert.equal(await farm.pendingToken('0', user1.address), '12832')
    assert.equal(await farm.pendingToken('1', user2.address), '3166')
  })

  it('bonus end block', async () => {
    const [owner, user1] = await ethers.getSigners()
    const token = await deployToken()
    const farm = await deployFarm(token, '100', '10', '500', '600')
    const [lp, lp2] = await deployLps()

    await lp.connect(user1).approve(farm.address, '1000')
    await farm.add('10', lp.address, true)
    await advanceBlockTo('589')
    await farm.connect(user1).deposit('0', '10')
    await advanceBlockTo('605')
    assert.equal(await farm.pendingToken('0', user1.address), '1500')
    await farm.connect(user1).deposit('0', '0')
    assert.equal(await farm.pendingToken('0', user1.address), '0')
    assert.equal(await token.balanceOf(user1.address), '1600')
  })

  it('percent bonus time left', async () => {
    const [owner, user1] = await ethers.getSigners()
    const token = await deployToken()
    const farm = await deployFarm(token, '1000', '10', '800', '900')
    const [lp, lp2] = await deployLps()

    let timeAdjustedBonusMultiplier
    await advanceBlockTo('790')
    timeAdjustedBonusMultiplier = await farm.getPercentBonusTimeLeft()
    assert.equal(timeAdjustedBonusMultiplier.toString() / 1e12, 1)
    await advanceBlockTo('800')
    timeAdjustedBonusMultiplier = await farm.getPercentBonusTimeLeft()
    assert.equal(timeAdjustedBonusMultiplier.toString() / 1e12, 1)
    await advanceBlockTo('801')
    timeAdjustedBonusMultiplier = await farm.getPercentBonusTimeLeft()
    assert.equal(timeAdjustedBonusMultiplier.toString() / 1e12, 0.99)
    await advanceBlockTo('810')
    timeAdjustedBonusMultiplier = await farm.getPercentBonusTimeLeft()
    assert.equal(timeAdjustedBonusMultiplier.toString() / 1e12, 0.9)
    await advanceBlockTo('850')
    timeAdjustedBonusMultiplier = await farm.getPercentBonusTimeLeft()
    assert.equal(timeAdjustedBonusMultiplier.toString() / 1e12, 0.5)
    await advanceBlockTo('880')
    timeAdjustedBonusMultiplier = await farm.getPercentBonusTimeLeft()
    assert.equal(timeAdjustedBonusMultiplier.toString() / 1e12, 0.2)
    await advanceBlockTo('895')
    timeAdjustedBonusMultiplier = await farm.getPercentBonusTimeLeft()
    assert.equal(timeAdjustedBonusMultiplier.toString() / 1e12, 0.05)
    await advanceBlockTo('899')
    timeAdjustedBonusMultiplier = await farm.getPercentBonusTimeLeft()
    assert.equal(timeAdjustedBonusMultiplier.toString() / 1e12, 0.01)
    await advanceBlockTo('910')
    timeAdjustedBonusMultiplier = await farm.getPercentBonusTimeLeft()
    assert.equal(timeAdjustedBonusMultiplier.toString() / 1e12, 0)
  })

  it('time adjusted bonus', async () => {
    const [owner, user1, user2, user3] = await ethers.getSigners()
    const token = await deployToken()
    const farm = await deployFarm(token, '10000000000000000000', '10', '1000', '1100')
    const [lp, lp2] = await deployLps()

    await farm.add('10', lp.address, true)
    await lp.connect(user2).approve(farm.address, '1000')
    await farm.connect(user2).deposit('0', '100')
    await advanceBlockTo('950')
    await farm.connect(user2).deposit('0', '0')
    assert.equal(await token.balanceOf(user2.address), '0')
    await advanceBlockTo('1000')
    await farm.connect(user2).deposit('0', '0')
    assert.equal(await token.balanceOf(user2.address), '99000000000000000000')
    await advanceBlockTo('1050')
    await farm.connect(user2).deposit('0', '0')
    assert.equal(await token.balanceOf(user2.address), '2549000000000000000000')
    await farm.connect(user2).deposit('0', '0')
    assert.equal(await token.balanceOf(user2.address), '2597000000000000000000')
    await advanceBlockTo('1090')
    await farm.connect(user2).deposit('0', '0')
    assert.equal(await token.balanceOf(user2.address), '2987000000000000000000')
    await farm.connect(user2).deposit('0', '0')
    assert.equal(await token.balanceOf(user2.address), '2997000000000000000000')
    await advanceBlockTo('1100')
    await farm.connect(user2).deposit('0', '0')
    assert.equal(await token.balanceOf(user2.address), '3087000000000000000000')
    await farm.connect(user2).deposit('0', '0')
    assert.equal(await token.balanceOf(user2.address), '3097000000000000000000')
  })

  it.skip('calculate inflation over 2 month (fast)', async () => {
    const [owner, user1, user2, user3] = await ethers.getSigners()
    const token = await deployToken()
    await token.mint(owner.address, '1000000000000' + zeros) // 1 tril
    const dailyTokens = 5000000000 // 5 bil
    const tokensPerBlocks = Math.round(dailyTokens / 4220 / 10)
    const twoMonthsOfBlocks = 4220 * 60
    const farmArgs = [tokensPerBlocks + zeros, '20', '4220', twoMonthsOfBlocks]
    const farm = await deployFarm(token, ...farmArgs)
    // 118480000000000000000000, 20, 4220, 253200
    // 11848000000000000000000, 20, 42200, 2532000
    console.log('farm args:', farmArgs.join(', '))
    const [lp, lp2] = await deployLps()

    await farm.add('100', lp.address, true)
    await lp.connect(user2).approve(farm.address, '1000')
    await farm.connect(user2).deposit('0', '100')
    await advanceBlockTo('4220')

    const advanceDays = async (days) => {
      while (--days) {
        let blocksPerDay = 4220
        while (--blocksPerDay) {
          await ethers.provider.send('evm_mine')
        }
        await farm.connect(user2).deposit('0', '0')
      }
    }

    console.info('day 1')
    await advanceDays(1)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 5')
    await advanceDays(4)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 15')
    await advanceDays(10)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 30')
    await advanceDays(15)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 45')
    await advanceDays(15)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 60')
    await advanceDays(15)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 90')
    await advanceDays(30)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 120')
    await advanceDays(30)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 300')
    await advanceDays(180)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
  }).timeout(600000)

  it('calculate farm args', () => {
    const startBlock = 11188432 + 42200 * 8
    const dailyTokens = 5000000000 // 5 bil
    const tokensPerBlocks = Math.round(dailyTokens / 42200 / 10)
    const twoMonthsOfBlocks = 42200 * 60
    const farmArgs = [tokensPerBlocks + zeros, '20', startBlock, startBlock + twoMonthsOfBlocks]
    console.log('farm args:', farmArgs.join(', '))
  })

  it.skip('calculate inflation over 2 month (slow)', async () => {
    const [owner, user1, user2, user3] = await ethers.getSigners()
    const token = await deployToken()
    await token.mint(owner.address, '1000000000000' + zeros) // 1 tril
    const dailyTokens = 5000000000 // 5 bil
    const tokensPerBlocks = Math.round(dailyTokens / 42200 / 10)
    const twoMonthsOfBlocks = 42200 * 60
    const farmArgs = [tokensPerBlocks + zeros, '20', '42200', twoMonthsOfBlocks]
    console.log('farm args:', farmArgs.join(', '))
    const farm = await deployFarm(token, ...farmArgs)
    const [lp, lp2] = await deployLps()

    await farm.add('100', lp.address, true)
    await lp.connect(user2).approve(farm.address, '1000')
    await farm.connect(user2).deposit('0', '100')
    await advanceBlockTo('42200')

    const advanceDays = async (days) => {
      while (--days) {
        let blocksPerDay = 42200
        while (--blocksPerDay) {
          await ethers.provider.send('evm_mine')
        }
        await farm.connect(user2).deposit('0', '0')
      }
    }

    console.info('day 1')
    await advanceDays(1)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 5')
    await advanceDays(4)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 15')
    await advanceDays(10)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 30')
    await advanceDays(15)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 45')
    await advanceDays(15)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 60')
    await advanceDays(15)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 90')
    await advanceDays(30)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 120')
    await advanceDays(30)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
    console.info('day 300')
    await advanceDays(180)
    console.info((await token.totalSupply()).toString().slice(0, -(18+9)) / 1000 + 'T')
  }).timeout(600000)
})
