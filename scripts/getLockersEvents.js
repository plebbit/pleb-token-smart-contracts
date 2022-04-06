require('util').inspect.defaultOptions.breakLength = 9999
const {ethers} = require('ethers')
const fs = require('fs')
const eventsDatabasePath = __dirname + '/lockerEvents.json'
let eventsDatabase = {
  '0x7DB134260b0BE15d5C2Ec8d9246fD51765BF69fc': {},
  '0x745fad4e2c8d07226ef8d6a8f3d78265a9a8eb45': {}
}
try {
   eventsDatabase = require(eventsDatabasePath)
}
catch (e) {} 
const provider = new ethers.providers.JsonRpcProvider({url: 'https://api.avax.network/ext/bc/C/rpc'}, 43114)
const hoursToGet = 24 * 30
const maxBlocks = 2048

const getTotalLocked = () => {
  const totalLocked = {}
  for (const contractAddress in eventsDatabase) {
    totalLocked[contractAddress] = 0
    for (const eventHash in eventsDatabase[contractAddress]) {
      totalLocked[contractAddress] += Math.round(eventsDatabase[contractAddress][eventHash].amount / '1000000000000000000')
    }
  }
  for (const contractAddress in totalLocked) {
    totalLocked[contractAddress] = totalLocked[contractAddress].toLocaleString('en-US')
  }
  console.log({totalLocked})
}

const getEvents = async (contractAddress) => {
  const abi = [    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "_address",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "_timeAmountIndex",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "_amount",
          "type": "uint256"
        }
      ],
      "name": "Lock",
      "type": "event"
    }]
  const contract = new ethers.Contract(contractAddress, abi, provider)
  const filter = contract.filters.Lock()
  const currentBlock = await provider.getBlockNumber()

  let currentHour = 0
  while (currentHour < hoursToGet) {
    const from = (currentHour + 1) * maxBlocks
    const to = currentHour * maxBlocks
    const fromBlock = currentBlock - from
    const toBlock = currentBlock - to
    console.log({contractAddress, currentBlock, fromBlock, toBlock})
    const events = await contract.queryFilter(filter, fromBlock, toBlock)
    for (const event of events) {
      const eventParsed = {
        address: event.args._address,
        lockerIndex: event.args._timeAmountIndex.toString(),
        amount: event.args._amount.toString()
      }
      eventsDatabase[contractAddress][event.transactionHash + '-' + event.logIndex] = eventParsed
      // console.log(event.transactionHash + '-' + event.logIndex)
      console.log(eventParsed)
      fs.writeFileSync(eventsDatabasePath, JSON.stringify(eventsDatabase))
    }
    currentHour++
  }
}

;(async () => {
  getTotalLocked()
  for (const contractAddress in eventsDatabase) {
    await getEvents(contractAddress)
  }
  getTotalLocked()
})()
