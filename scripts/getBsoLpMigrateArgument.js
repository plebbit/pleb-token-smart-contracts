const fs = require('fs')
const BigNumber = require('bignumber.js')
BigNumber.config({EXPONENTIAL_AT: 9999})

const toBigNumberString = (rawAmount) => {
  const amount = new BigNumber(rawAmount)
  const decimals = new BigNumber('1e18')
  const tokenAmount = amount.multipliedBy(decimals)
  return tokenAmount.toFixed(0)
}

const lines = fs.readFileSync(__dirname + '/export-tokenholders-for-contract-0xbc628f41b8f791f8527fbc6563fbb0d786b33c84-2026-07-01.csv', 'utf8').trim().split('\n').map(line => line.replaceAll('"', ''))
const addresses = []
const amounts = []

let totalSupply = new BigNumber(0)
for (const [i, line] of lines.entries()) {
  if (i === 0) continue
  const [address, ...amountParts] = line.trim().replace(',No', '').split(',')
  const amountStr = amountParts.join(',').replace(/,/g, '')
  const amount = new BigNumber(amountStr).multipliedBy('1e18')
  totalSupply = totalSupply.plus(amount)
}

for (const [i, line] of lines.entries()) {
  if (i === 0) {
    continue
  }
  const [address, ...amountParts] = line.trim().replace(',No', '').split(',')
  if (address === '0x0000000000000000000000000000000000000000') {
    continue
  }
  const amount = amountParts.join('')
  const bigNumberStringAmount = toBigNumberString(amount)
  const bigNumberAmount = new BigNumber(bigNumberStringAmount)
  const percent = bigNumberAmount.dividedBy(totalSupply).toFixed(10)

  // const lpAmount = ...calculate new lp amount based on percent of new total supply
  // addresses.push(address)
  // amounts.push(bigNumberStringAmount)
  console.log({address, percent})
}

let output = ''
output += 'addresses argument:'
output += '\n\n\n\n'
output += `[${addresses.toString()}]`
output += '\n\n\n\n'
output += 'amounts argument:'
output += '\n\n\n\n'
output += `[${amounts.toString()}]`
fs.writeFileSync(__dirname + '/bsoLpMigrateArguments.txt', output)
