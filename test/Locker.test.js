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
    if (!revertString) {
      assert(error?.message?.match('revert'))
    }
    else {
      assert.equal(error?.message, `VM Exception while processing transaction: reverted with reason string '${revertString}'`)
    }
  }
}

const advanceTimeTo = async (newTimestamp) => {
  await network.provider.send("evm_setNextBlockTimestamp", [newTimestamp])
  await network.provider.send("evm_mine")
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

describe('Locker', () => {
  it('setters and getters', async () => {
    const [owner, user1] = await ethers.getSigners()
    const token = await deployToken()
    const Locker = await ethers.getContractFactory('Locker')
    const locker = await Locker.deploy(token.address, [[100, 200]])

    assert.equal(await locker.token(), token.address)
    assert.equal(await locker.timeAmountCount(), 1)
    assert.equal((await locker.timeAmounts('0')).time, 100)
    assert.equal((await locker.timeAmounts('0')).amount, 200)
    await expectRevert(locker.timeAmounts('1'))

    await locker.setTimeAmount('0', [300, 400])
    assert.equal((await locker.timeAmounts('0')).time, 300)
    assert.equal((await locker.timeAmounts('0')).amount, 400)
    await expectRevert(locker.connect(user1).setTimeAmount('0', [100, 200]), 'Ownable: caller is not the owner')

    await locker.addTimeAmount([500, 600])
    assert.equal((await locker.timeAmounts('1')).time, 500)
    assert.equal((await locker.timeAmounts('1')).amount, 600)
    await expectRevert(locker.connect(user1).addTimeAmount([100, 200]), 'Ownable: caller is not the owner')

    assert.equal((await locker.isLocking()), true)
    await locker.setIsLocking(false)
    assert.equal((await locker.isLocking()), false)
    await expectRevert(locker.connect(user1).setIsLocking(true), 'Ownable: caller is not the owner')

    await expectRevert(locker.lock('0', '100'), 'locker: locking closed')
    await locker.setIsLocking(true)
    await token.mint(owner.address, '1000')
    await token.approve(locker.address, '1000')
    await locker.lock('0', '1000')
  })

  it('lock and unlock', async () => {
    const [owner, user1, user2, user3] = await ethers.getSigners()
    const token = await deployToken()
    const Locker = await ethers.getContractFactory('Locker')
    const locker = await Locker.deploy(token.address, [[100, 200], [200, 400], [1, 2]])
    await token.mint(owner.address, '100000')
    await token.approve(locker.address, '100000')

    let receipt, lockEvent, unlockEvent, balance

    // lock tokens in pool 1
    await expectRevert(locker.lock('10', '100'), 'locker: _timeAmountIndex does not exist')
    await expectRevert(locker.lock('0', '100'), 'locker: _amount smaller than timeAmount.amount')
    assert.equal((await token.balanceOf(locker.address)), 0)
    assert.equal((await locker.balanceOf('0', owner.address)), 0)
    receipt = await (await locker.lock('0', '200')).wait()
    lockEvent = receipt.events?.filter((event) => event.event === "Lock")[0]?.args
    assert.equal(lockEvent._address, owner.address)
    assert.equal(lockEvent._timeAmountIndex, '0')
    assert.equal(lockEvent._amount, '200')
    assert.equal((await token.balanceOf(locker.address)), 200)
    assert.equal((await locker.balanceOf('0', owner.address)), 200)
    assert.equal((await locker.totalSupply('0')), 200)

    // lock tokens in pool 2
    await expectRevert(locker.lock('10', '100'), 'locker: _timeAmountIndex does not exist')
    await expectRevert(locker.lock('1', '100'), 'locker: _amount smaller than timeAmount.amount')
    assert.equal((await token.balanceOf(locker.address)), 200)
    assert.equal((await locker.balanceOf('1', owner.address)), 0)
    receipt = await (await locker.lock('1', '500')).wait()
    lockEvent = receipt.events?.filter((event) => event.event === "Lock")[0]?.args
    assert.equal(lockEvent._address, owner.address)
    assert.equal(lockEvent._timeAmountIndex, '1')
    assert.equal(lockEvent._amount, '500')
    assert.equal((await token.balanceOf(locker.address)), 700)
    assert.equal((await locker.balanceOf('1', owner.address)), 500)
    assert.equal((await locker.totalSupply('1')), 500)

    // unlock tokens in pool 1
    balance = await token.balanceOf(owner.address)
    receipt = await (await locker.unlock('0')).wait()
    unlockEvent = receipt.events?.filter((event) => event.event === "Unlock")[0]?.args
    assert.equal(unlockEvent._address, owner.address)
    assert.equal(unlockEvent._timeAmountIndex, '0')
    assert.equal(unlockEvent._amount, '200')
    assert.equal((await token.balanceOf(owner.address)), balance.toNumber() + 200)
    assert.equal((await token.balanceOf(locker.address)), 500)
    assert.equal((await locker.balanceOf('0', owner.address)), 0)
    assert.equal((await locker.totalSupply('0')), 0)
    await expectRevert(locker.unlock('0'), 'locker: _timeAmountIndex balance is 0')

    // unlock tokens in pool 2
    balance = await token.balanceOf(owner.address)
    receipt = await (await locker.unlock('1')).wait()
    unlockEvent = receipt.events?.filter((event) => event.event === "Unlock")[0]?.args
    assert.equal(unlockEvent._address, owner.address)
    assert.equal(unlockEvent._timeAmountIndex, '1')
    assert.equal(unlockEvent._amount, '500')
    assert.equal((await token.balanceOf(owner.address)), balance.toNumber() + 500)
    assert.equal((await token.balanceOf(locker.address)), 0)
    assert.equal((await locker.balanceOf('1', owner.address)), 0)
    assert.equal((await locker.totalSupply('1')), 0)
    await expectRevert(locker.unlock('1'), 'locker: _timeAmountIndex balance is 0')

    // fail to unlock pool 3
    await expectRevert(locker.unlock('2'), 'locker: _timeAmountIndex balance is 0')

    // multiple addresses at once
    await token.mint(user1.address, '3000')
    await token.connect(user1).approve(locker.address, '3000')
    await token.mint(user2.address, '3000')
    await token.connect(user2).approve(locker.address, '100000')
    await token.mint(user3.address, '3000')
    await token.connect(user3).approve(locker.address, '3000')
    await locker.connect(user1).lock('0', 1000)
    await locker.connect(user1).lock('1', 1000)
    await locker.connect(user1).lock('2', 1000)
    await locker.connect(user2).lock('0', 1000)
    await locker.connect(user2).lock('1', 1000)
    await locker.connect(user2).lock('2', 1000)
    await locker.connect(user3).lock('0', 1000)
    await locker.connect(user3).lock('1', 1000)
    await locker.connect(user3).lock('2', 1000)
    assert.equal((await token.balanceOf(user1.address)), 0)
    assert.equal((await token.balanceOf(user2.address)), 0)
    assert.equal((await token.balanceOf(user3.address)), 0)
    assert.equal((await locker.totalSupply('0')), 3000)
    assert.equal((await locker.totalSupply('1')), 3000)
    assert.equal((await locker.totalSupply('2')), 3000)
    await expectRevert(locker.unlock('0'), 'locker: _timeAmountIndex balance is 0')
    await locker.connect(user1).unlock('0')
    await expectRevert(locker.connect(user1).unlock('0'), 'locker: _timeAmountIndex balance is 0')
    await locker.connect(user2).unlock('0')
    await locker.connect(user3).unlock('0')
    await expectRevert(locker.connect(user2).unlock('0'), 'locker: _timeAmountIndex balance is 0')
    await locker.connect(user1).unlock('1')
    await expectRevert(locker.connect(user1).unlock('1'), 'locker: _timeAmountIndex balance is 0')
    await locker.connect(user1).unlock('2')
    await expectRevert(locker.connect(user1).unlock('2'), 'locker: _timeAmountIndex balance is 0')
    await locker.connect(user2).unlock('1')
    await locker.connect(user2).unlock('2')
    await locker.connect(user3).unlock('1')
    await locker.connect(user3).unlock('2')
    assert.equal((await token.balanceOf(user1.address)), 3000)
    assert.equal((await token.balanceOf(user2.address)), 3000)
    assert.equal((await token.balanceOf(user3.address)), 3000)
    assert.equal((await token.balanceOf(locker.address)), 0)
    assert.equal((await locker.totalSupply('0')), 0)
    assert.equal((await locker.totalSupply('1')), 0)
    assert.equal((await locker.totalSupply('2')), 0)
  })

  it(`don't unlock before time`, async () => {
    const [owner] = await ethers.getSigners()
    const token = await deployToken()
    const Locker = await ethers.getContractFactory('Locker')

    const minAmount = 100000000
    const startTimestamp = 2000000000
    const day = 60 * 60 * 24
    const timeAmounts = [
      [startTimestamp+day*90, minAmount*6 + zeros],
      [startTimestamp+day*180, minAmount*3 + zeros],
      [startTimestamp+day*360, minAmount + zeros]
    ]

    advanceTimeTo(startTimestamp)
    const locker = await Locker.deploy(token.address, timeAmounts)
    await token.mint(owner.address, minAmount * 100 + zeros)
    await token.approve(locker.address, minAmount * 100 + zeros)
    await locker.lock('0', minAmount*6 + zeros)
    await locker.lock('1', minAmount*3 + zeros)
    await locker.lock('2', minAmount + zeros)
    assert.equal((await locker.timeLeft('0') / 60 / 60 / 24), 89.99993055555557)
    assert.equal((await locker.timeLeft('1') / 60 / 60 / 24), 179.99993055555555)
    assert.equal((await locker.timeLeft('2') / 60 / 60 / 24), 359.9999305555555)
    await expectRevert(locker.unlock('0'), 'locker: lock time not elapsed')
    await expectRevert(locker.unlock('1'), 'locker: lock time not elapsed')
    await expectRevert(locker.unlock('2'), 'locker: lock time not elapsed')

    advanceTimeTo(startTimestamp+day)
    await expectRevert(locker.unlock('0'), 'locker: lock time not elapsed')
    await expectRevert(locker.unlock('1'), 'locker: lock time not elapsed')
    await expectRevert(locker.unlock('2'), 'locker: lock time not elapsed')

    advanceTimeTo(startTimestamp+day*90)
    assert.equal(await locker.timeLeft('0'), 0)
    assert.equal((await locker.timeLeft('1') / 60 / 60 / 24), 90)
    assert.equal((await locker.timeLeft('2') / 60 / 60 / 24), 270)
    assert.equal((await token.balanceOf(owner.address)).toString(), '9000000000000000000000000000')
    await locker.unlock('0')
    assert.equal((await token.balanceOf(owner.address)).toString(), '9600000000000000000000000000')
    await expectRevert(locker.unlock('1'), 'locker: lock time not elapsed')
    await expectRevert(locker.unlock('2'), 'locker: lock time not elapsed')

    advanceTimeTo(startTimestamp+day*180)
    assert.equal(await locker.timeLeft('0'), 0)
    assert.equal(await locker.timeLeft('1'), 0)
    assert.equal((await locker.timeLeft('2') / 60 / 60 / 24), 180)
    assert.equal((await token.balanceOf(owner.address)).toString(), '9600000000000000000000000000')
    await expectRevert(locker.unlock('0'), 'locker: _timeAmountIndex balance is 0')
    await locker.unlock('1')
    assert.equal((await token.balanceOf(owner.address)).toString(), '9900000000000000000000000000')
    await expectRevert(locker.unlock('2'), 'locker: lock time not elapsed')

    advanceTimeTo(startTimestamp+day*360)
    assert.equal(await locker.timeLeft('0'), 0)
    assert.equal(await locker.timeLeft('1'), 0)
    assert.equal(await locker.timeLeft('2'), 0)
    assert.equal((await token.balanceOf(owner.address)).toString(), '9900000000000000000000000000')
    await expectRevert(locker.unlock('0'), 'locker: _timeAmountIndex balance is 0')
    await expectRevert(locker.unlock('1'), 'locker: _timeAmountIndex balance is 0')
    await locker.unlock('2')
    assert.equal((await token.balanceOf(owner.address)).toString(), '10000000000000000000000000000')
    await expectRevert(locker.unlock('2'), 'locker: _timeAmountIndex balance is 0')
  })

  it('recover wrong tokens sent to contract', async () => {
    const [owner, user1] = await ethers.getSigners()
    const token = await deployToken()
    const wrongToken = await deployToken()
    const Locker = await ethers.getContractFactory('Locker')
    const locker = await Locker.deploy(token.address, [[100, 200], [200, 400], [1, 2]])
    await token.mint(locker.address, '100000')
    await wrongToken.mint(locker.address, '100000')

    await expectRevert(locker.recoverWrongTokensSentToContract(token.address, owner.address, '100'), 'locker: only recover wrong tokens')
    await expectRevert(locker.connect(user1).recoverWrongTokensSentToContract(wrongToken.address, owner.address, '100'), 'Ownable: caller is not the owner')
    await locker.recoverWrongTokensSentToContract(wrongToken.address, owner.address, '100')
    assert.equal(await wrongToken.balanceOf(owner.address), 100)
  })
})
