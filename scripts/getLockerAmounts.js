require('util').inspect.defaultOptions.breakLength = 9999
const {ethers} = require('ethers')
const fs = require('fs')

const eventsDatabasePath = __dirname + '/lockerEvents.json'
const eventsDatabase = require(eventsDatabasePath)

let amountsDatabase = {}
const amountsDatabasePath = __dirname + '/lockerAmounts.json'
try {
   amountsDatabase = require(amountsDatabasePath)
}
catch (e) {}

const provider = new ethers.providers.JsonRpcProvider({url: 'https://api.avax.network/ext/bc/C/rpc'}, 43114)

const getAddresses = () => {
  const addresses = new Set()
  for (const contractAddress in eventsDatabase) {
    for (const eventHash in eventsDatabase[contractAddress]) {
      addresses.add(eventsDatabase[contractAddress][eventHash].address)
    }
  }
  return addresses
}

const getTotal = () => {
  let total = ethers.BigNumber.from('0')
  for (const address in amountsDatabase) {
    total = total.add(ethers.BigNumber.from(amountsDatabase[address]))
  }
  return total.div(ethers.BigNumber.from('1000000000000000000')).toNumber().toLocaleString('en-US')
}

const getAmounts = async (addresses) => {
  const abi = [{
    "inputs":[
      {"internalType":"uint256","name":"","type":"uint256"},
      {"internalType":"address","name":"","type":"address"}],
    "name":"balanceOf",
    "outputs":[
      {"internalType":"uint256","name":"","type":"uint256"}
    ],
    "stateMutability":"view",
    "type":"function"
  }]
  const contract = new ethers.Contract('0x7DB134260b0BE15d5C2Ec8d9246fD51765BF69fc', abi, provider)

  for (const [i, address] of addresses.entries()) {
    const res1 = await contract.balanceOf('0', address)
    const res2 = await contract.balanceOf('1', address)
    const res3 = await contract.balanceOf('2', address)
    const total = res1.add(res2).add(res3).toString()
    console.log(address, total, res1.toString(), res2.toString(), res3.toString())
    amountsDatabase[address] = total
    fs.writeFileSync(amountsDatabasePath, JSON.stringify(amountsDatabase))
  }
}

;(async () => {
  console.log('total', getTotal())
  const addresses = getAddresses()
  console.log('addresses:', addresses.size)
  const amounts = await getAmounts(addresses)
  console.log('total', getTotal())
})()
