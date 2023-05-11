require('util').inspect.defaultOptions.breakLength = 9999
const {ethers} = require('ethers')
const fs = require('fs')
const eventsDatabasePath = __dirname + '/lp2Events.json'
let eventsDatabase = {
  '0x0f7a712e9f2d25160a7dc0c24324036c47ea951b': {},
}
try {
   eventsDatabase = require(eventsDatabasePath)
}
catch (e) {} 
const provider = new ethers.providers.JsonRpcProvider({url: 'https://api.avax.network/ext/bc/C/rpc'}, 43114)
const startBlock = 9568080
const maxBlocks = 2048

const getTotal = () => {
  const total = {}
  for (const contractAddress in eventsDatabase) {
    total[contractAddress] = 0
    for (const eventHash in eventsDatabase[contractAddress]) {
      total[contractAddress] += Math.round(eventsDatabase[contractAddress][eventHash].amount / '1000000000000000000')
    }
  }
  for (const contractAddress in total) {
    total[contractAddress] = total[contractAddress].toLocaleString('en-US')
  }
  console.log({total})
}

const getEvents = async (contractAddress) => {
  const abi = [{
    "anonymous":false,
    "inputs":[
      {"indexed":true,"internalType":"address","name":"from","type":"address"},
      {"indexed":true,"internalType":"address","name":"to","type":"address"},
      {"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}
    ],
    "name":"Transfer",
    "type":"event"
  }]
  const contract = new ethers.Contract(contractAddress, abi, provider)
  const filter = contract.filters.Transfer()

  const endBlock = await provider.getBlockNumber()

  let currentBlock = startBlock
  while (currentBlock <= endBlock) {
    const previousCurrentBlock = currentBlock
    currentBlock += maxBlocks
    if (currentBlock > endBlock) {
      currentBlock = endBlock
    }

    const fromBlock = previousCurrentBlock
    const toBlock = currentBlock
    console.log({contractAddress, currentBlock, fromBlock, toBlock})
    const events = await contract.queryFilter(filter, fromBlock, toBlock)
    for (const event of events) {
      const eventParsed = {
        address: event.args.to,
        address2: event.args.from,
        amount: event.args.value.toString()
      }
      eventsDatabase[contractAddress][event.transactionHash + '-' + event.logIndex] = eventParsed
      // console.log(event.transactionHash + '-' + event.logIndex)
      console.log(eventParsed)
      fs.writeFileSync(eventsDatabasePath, JSON.stringify(eventsDatabase))
    }
  }
}

;(async () => {
  getTotal()
  for (const contractAddress in eventsDatabase) {
    try {
      await getEvents(contractAddress)
    }
    catch (e) {
      console.log(e)
    }
  }
  getTotal()
})()