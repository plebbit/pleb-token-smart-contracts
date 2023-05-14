require('util').inspect.defaultOptions.breakLength = 9999
const {ethers} = require('ethers')
const fs = require('fs')
const BigNumber = require('bignumber.js')
BigNumber.config({EXPONENTIAL_AT: 9999})

const migratorAddress = '0x3d0e5A9453BA51516eF688FB82d9F5f601FF6C11'.toLowerCase()
const farmAddress = '0xbde4da3d0d8a7f7cc4ad9c1bcea8c8a53d1dd460'.toLowerCase()
const lockerAddress = '0x745fad4e2c8d07226ef8d6a8f3d78265a9a8eb45'.toLowerCase() // lp locker is different than pleb locker
const unknownContractAddress = '0x63c0cf90ae12190b388f9914531369ac1e4e4e47'.toLowerCase() // MoneyMaker, don't know what that is

const lpAmounts = {}
const lines = fs.readFileSync(__dirname + '/export-tokenholders-for-contract-0xdc63069d6f920c6300065ac28acd05b1f7b3b0c1.csv', 'utf8').trim().split('\n').map(line => line.replaceAll('"', ''))
for (const i in lines) {
  if (i === '0') {
    continue
  }
  const cells = lines[i].split(',')
  lpAmounts[cells[0].toLowerCase()] = BigNumber(cells[1]).times(BigNumber(1e18)).toString()
}
const farmAmounts = require('./farmAmounts')
const lpFarmAmounts = {}
for (const i in farmAmounts) {
  lpFarmAmounts[i.toLowerCase()] = farmAmounts[i].lpAmount
}
const lockerAmounts = require('./lpLockerAmounts')
for (const i in lockerAmounts) {
  lockerAmounts[i.toLowerCase()] = lockerAmounts[i]
}

const getTotal = (amounts) => {
  let total = ethers.BigNumber.from('0')
  for (const address in amounts) {
    total = total.add(ethers.BigNumber.from(amounts[address]))
  }
  return total.div(ethers.BigNumber.from('1000000000000000000')).toNumber().toLocaleString('en-US')
}

const getAmounts = (addresses) => {
  const amounts = {}
  for (const address in lpAmounts) {
    amounts[address] = lpAmounts[address]
  }
  for (const address in lpFarmAmounts) {
    if (!amounts[address]) {
      amounts[address] = lpFarmAmounts[address]
    }
    else {
      amounts[address] = ethers.BigNumber.from(amounts[address]).add(ethers.BigNumber.from(lpFarmAmounts[address])).toString()
    }
  }
  // delete farm address because it's already accounted for
  delete amounts[farmAddress]

  for (const address in lockerAmounts) {
    if (!amounts[address]) {
      amounts[address] = lockerAmounts[address]
    }
    else {
      amounts[address] = ethers.BigNumber.from(amounts[address]).add(ethers.BigNumber.from(lockerAmounts[address])).toString()
    }
  }
  // delete locker address because it's already accounted for
  delete amounts[lockerAddress]

  // transfer unknown contract address to migrator because I dont know where to transfer it
  if (amounts[migratorAddress]) {
    throw Error('migratorAddress already has tokens')
  }
  amounts[migratorAddress] = amounts[unknownContractAddress]
  delete amounts[unknownContractAddress]

  return amounts
}

;(async () => {
  const amounts = getAmounts()
  console.log(amounts)
  console.log('total', getTotal(amounts))
})()
