import {ethers} from 'ethers'
// const provider = ethers.getDefaultProvider('homestead')
const provider = new ethers.providers.JsonRpcProvider('https://mainnet.infura.io/v3/<key>')

const signedTx = '0x02f88f010f843b9aca00843b9aca00837a120094ea81dab2e0ecbc6b5c4172de4c22b6ef6e55bd8f80a43659cfe600000000000000000000000016e908d544159a8076e05c08e7223bb91b83fb83c080a0b2b55a05ced07222ba146f26e46906f91794500fb84be81e68cebf72e63ef662a02894d94468670c2eddb20963ba28309e65a3e986f6c6fc02fe2a28caf423a404'

console.log('broadcasting...')
const txResponse = await provider.sendTransaction(signedTx)
console.log('done')
console.log(txResponse)
console.log('confirming...')
const confirmation = await txResponse.wait()
console.log('done')
console.log(confirmation)
