import dotenv from 'dotenv'
dotenv.config()
import {ethers} from 'ethers'
// const provider = ethers.getDefaultProvider('homestead')
const provider = new ethers.providers.JsonRpcProvider(process.env.MAINNET_RPC_URL)

const signedTx = '0x02f88f0113843b9aca00843b9aca00837a120094ea81dab2e0ecbc6b5c4172de4c22b6ef6e55bd8f80a43659cfe6000000000000000000000000058cc247683cfed5765233472c7f38a12aaaa715c080a0696d26da2642f7c507d1cd293638f0d3a6164e440e89b94c818abc8b04af0d5ea051653d161b00c651c57d50ac0d2a3c6d9422101746c22aa68348877182b44f46'

console.log('broadcasting...')
const txResponse = await provider.sendTransaction(signedTx)
console.log('done')
console.log(txResponse)
console.log('confirming...')
const confirmation = await txResponse.wait()
console.log('done')
console.log(confirmation)
