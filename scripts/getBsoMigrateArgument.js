const fs = require('fs')
const BigNumber = require('bignumber.js')
BigNumber.config({EXPONENTIAL_AT: 9999})

const toBigNumberString = (rawAmount) => {
  const amount = new BigNumber(rawAmount)
  const decimals = new BigNumber('1e18')
  const tokenAmount = amount.multipliedBy(decimals)
  return tokenAmount.toFixed(0)
}

const lines = fs.readFileSync(__dirname + '/export-tokenholders-for-contract-0xea81dab2e0ecbc6b5c4172de4c22b6ef6e55bd8f-2026-07-01.csv', 'utf8').trim().split('\n').map(line => line.replaceAll('"', ''))
const addresses = []
const amounts = []

for (const [i, line] of lines.entries()) {
  if (i === 0) {
    continue
  }
  let [address, ...amountParts] = line.trim().replace(',No', '').split(',')
  const amount = amountParts.join('')
  const bigNumberStringAmount = toBigNumberString(amount)

  // migrate sablier contract to owner
  if (address === '0xf86b359035208e4529686a1825f2d5bee38c28a8') {
    address = '0x8eb1a66e06af821203ee9d648032af164ccbc14d'
    console.log('migrated sablier 0xf86b359035208e4529686a1825f2d5bee38c28a8 to 0x8eb1a66e06af821203ee9d648032af164ccbc14d', amount)
  }

  // migrate uniswap v2 to migrator
  if (address === '0xbc628f41b8f791f8527fbc6563fbb0d786b33c84') {
    address = '0x5bc4ff33f86e0272be53fa25861294489ab2fe2a'
    console.log('migrated uniswap v2 0xbc628f41b8f791f8527fbc6563fbb0d786b33c84 to 0x5bc4ff33f86e0272be53fa25861294489ab2fe2a', amount)
  }

  addresses.push(address)
  amounts.push(bigNumberStringAmount)
  console.log(line)
  console.log({address, amount})
}

let output = ''
output += 'addresses argument:'
output += '\n\n\n\n'
output += `[${addresses.toString()}]`
output += '\n\n\n\n'
output += 'amounts argument:'
output += '\n\n\n\n'
output += `[${amounts.toString()}]`
fs.writeFileSync(__dirname + '/bsoMigrateArguments.txt', output)
