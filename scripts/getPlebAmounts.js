require('util').inspect.defaultOptions.breakLength = 9999
const {ethers} = require('ethers')
const fs = require('fs')
const BigNumber = require('bignumber.js')
BigNumber.config({EXPONENTIAL_AT: 9999})

const migratorAddress = '0x3d0e5A9453BA51516eF688FB82d9F5f601FF6C11'.toLowerCase()
const farmAddress = '0xbde4da3d0d8a7f7cc4ad9c1bcea8c8a53d1dd460'.toLowerCase()
const lockerAddress = '0x7db134260b0be15d5c2ec8d9246fd51765bf69fc'.toLowerCase() // pleb locker is different from lp locker

const plebAmounts = {}
const lines = fs.readFileSync(__dirname + '/export-tokenholders-for-contract-0x625fc9bb971bb305a2ad63252665dcfe9098bee9.csv', 'utf8').trim().split('\n').map(line => line.replaceAll('"', ''))
for (const i in lines) {
  if (i === '0') {
    continue
  }
  const cells = lines[i].split(',')
  plebAmounts[cells[0].toLowerCase()] = BigNumber(cells[1]).times(BigNumber(1e18)).toString()
}
const farmAmounts = require('./farmAmounts')
const lpFarmAmounts = {}
for (const i in farmAmounts) {
  lpFarmAmounts[i.toLowerCase()] = farmAmounts[i].plebAmount
}
const lockerAmounts = require('./plebLockerAmounts')
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
  for (const address in plebAmounts) {
    amounts[address] = plebAmounts[address]
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

  return amounts
}

;(async () => {
  const amounts = getAmounts()
  console.log(amounts)
  console.log('total', getTotal(amounts))
})()
