require('util').inspect.defaultOptions.breakLength = 9999
const {ethers} = require('ethers')
const fs = require('fs')

const eventsDatabasePath = __dirname + '/farmEvents.json'
const eventsDatabase = require(eventsDatabasePath)

let amountsDatabase = {}
const amountsDatabasePath = __dirname + '/farmAmounts.json'
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
  let totalPleb = ethers.BigNumber.from('0')
  let totalLp = ethers.BigNumber.from('0')
  for (const address in amountsDatabase) {
    totalPleb = totalPleb.add(ethers.BigNumber.from(amountsDatabase[address].plebAmount))
    totalLp = totalLp.add(ethers.BigNumber.from(amountsDatabase[address].lpAmount))
  }
  return {
    totalPleb: totalPleb.div(ethers.BigNumber.from('1000000000000000000')).toNumber().toLocaleString('en-US'),
    totalLp: totalLp.div(ethers.BigNumber.from('1000000000000000000')).toNumber().toLocaleString('en-US')
  }
}

const getAmounts = async (addresses) => {
  const abi = [
    {"inputs":[{"internalType":"uint256","name":"_pid","type":"uint256"},{"internalType":"address","name":"_user","type":"address"}],"name":"pendingToken","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"address","name":"","type":"address"}],"name":"userInfo","outputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"rewardDebt","type":"uint256"}],"stateMutability":"view","type":"function"}
  ]
  const contract = new ethers.Contract('0xBDE4da3D0D8A7f7Cc4aD9c1bCea8C8A53d1dD460', abi, provider)

  for (const [i, address] of addresses.entries()) {
    const {amount: lpAmount} = await contract.userInfo(0, address)
    const plebAmount = await contract.pendingToken('0', address)
    console.log(address, lpAmount.toString(), plebAmount.toString())
    amountsDatabase[address] = {lpAmount: lpAmount.toString(), plebAmount: plebAmount.toString()}
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
