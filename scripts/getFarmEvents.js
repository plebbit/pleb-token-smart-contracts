require('util').inspect.defaultOptions.breakLength = 9999
const {ethers} = require('ethers')
const fs = require('fs')
const eventsDatabasePath = __dirname + '/farmEvents.json'
let eventsDatabase = {
  '0xbde4da3d0d8a7f7cc4ad9c1bcea8c8a53d1dd460': {},
}
try {
   eventsDatabase = require(eventsDatabasePath)
}
catch (e) {} 
const provider = new ethers.providers.JsonRpcProvider({url: 'https://api.avax.network/ext/bc/C/rpc'}, 43114)
// const startBlock = 11202146 // original start block
const startBlock = 29894851
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
      {"indexed":true,"internalType":"address","name":"user","type":"address"},
      {"indexed":true,"internalType":"uint256","name":"pid","type":"uint256"},
      {"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}
    ],
    "name":"Deposit",
    "type":"event"
  }]
  const contract = new ethers.Contract(contractAddress, abi, provider)
  const filter = contract.filters.Deposit()

  const endBlock = await provider.getBlockNumber()

  let currentBlock = startBlock
  while (currentBlock < endBlock) {
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
        address: event.args.user,
        amount: event.args.amount.toString()
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
