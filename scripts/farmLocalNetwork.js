// npx hardhat node
// npx hardhat run --network localhost scripts/farmLocalNetwork.js
// set metamask network to http://localhost:8545 and chain id 31337

const { ethers } = require('hardhat')
const assert = require('assert')

const zeros = '000000000000000000'

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
  const Farm = await ethers.getContractFactory('Farm')
  const farm = await Farm.deploy(token.address, _tokenPerBlock, _bonusMultiplier, _startBlock, _bonusEndBlock)
  await token.grantRole(await token.MINTER_ROLE(), farm.address)
  return farm
}

const deployLps = async () => {
  const [owner] = await ethers.getSigners()
  const JoePair = await ethers.getContractFactory('JoePair')
  const lp = await JoePair.deploy()
  await lp.mint(owner.address, '10000' + zeros)
  return [lp]
}

const deployUsdcWavaxPair = async (wavax) => {
  const [owner] = await ethers.getSigners()
  const usdc = await deployToken()
  await usdc.mint(owner.address, '10000000000' + '000000')
  const pair = await deployToken()
  await wavax.transfer(pair.address, '100' + zeros)
  await usdc.transfer(pair.address, '9000' + '000000')
  return {usdcWavaxPair: pair, usdc}
}

const getMetamaskWallets = async () => {
  const [owner] = await ethers.getSigners()
  const metamaskSeed = ''
  const provider = new ethers.providers.JsonRpcProvider()
  const metamaskWallets = []
  let amount = 4
  while (amount--) {
    metamaskWallets[amount] = ethers.Wallet.fromMnemonic(metamaskSeed, `m/44'/60'/0'/0/${amount}`).connect(provider)
  }
  for (const wallet of metamaskWallets) {
    await owner.sendTransaction({to: wallet.address, value: ethers.utils.parseEther('1')})
  }
  return metamaskWallets
}

const deployMulticall = async () => {
  const Multicall = await ethers.getContractFactory('Multicall')
  const multicall = await Multicall.deploy()
  return multicall
}

// ;(async () => {
//   advanceBlockTo(1000)
// })()

setInterval(() => {
  ethers.provider.send('evm_mine')
}, 5000)

;(async () => {
  const [owner] = await ethers.getSigners()
  const multicall = await deployMulticall()
  const metamaskWallets = await getMetamaskWallets()
  const token = await deployToken()
  const wavax = await deployToken()
  await wavax.mint(owner.address, '1000000' + zeros)
  const {usdcWavaxPair, usdc} = await deployUsdcWavaxPair(wavax)
  const farmArgs = ['90909000000000000000000', '20', '0', '330000']
  const farm = await deployFarm(token, ...farmArgs)
  const [lp] = await deployLps()
  await wavax.mint(lp.address, '1000' + zeros)
  await token.mint(lp.address, '1000000000' + zeros)
  await farm.add('100', lp.address, true)

  // metamask 1 setup
  await lp.transfer(metamaskWallets[0].address, '1000' + zeros)

  // metamask 2 setup
  await lp.transfer(metamaskWallets[1].address, '1000' + zeros)
  await lp.connect(metamaskWallets[1]).approve(farm.address, '500' + zeros)
  await farm.connect(metamaskWallets[1]).deposit('0', '250' + zeros)

  // metamask 3 setup
  await lp.transfer(metamaskWallets[2].address, '1000' + zeros)
  await lp.connect(metamaskWallets[2]).approve(farm.address, '1000' + zeros)
  await farm.connect(metamaskWallets[2]).deposit('0', '1000' + zeros)

  console.log('metamask1: 1000LP, 0 deposited', metamaskWallets[0].address)
  console.log('metamask2: 750LP, 250 deposited', metamaskWallets[1].address)
  console.log('metamask3: 0LP, 1000 deposited', metamaskWallets[2].address)
  console.log('metamask4: 0LP, 0 deposited', metamaskWallets[3].address)
  console.log('farm args:', farmArgs.join(', '))
  console.log(`
{
  "chainId": 31337,
  "plebTokenAddress": "${token.address}",
  "lpTokenAddress": "${lp.address}",
  "wavaxTokenAddress": "${wavax.address}",
  "usdcTokenAddress": "${usdc.address}",
  "usdcWavaxPairAddress": "${usdcWavaxPair.address}",
  "farmAddress": "${farm.address}",
  "multicallAddress": "${multicall.address}",
  "farmingTimestamp": ${Date.now()},
}
`)
  console.log('setup finished')
})()
