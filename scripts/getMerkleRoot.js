const { ethers } = require('hardhat')
const { MerkleTree } = require('merkletreejs')
const keccak256 = require('keccak256')
const recipients = require('./recipients.json')

const elements = []
for (recipientAddress in recipients) {
  const recipientAmount = recipients[recipientAddress] + '000000000000000000'
  elements.push(ethers.utils.solidityPack(['address', 'uint256'], [recipientAddress, recipientAmount]))
}

const merkleTree = new MerkleTree(elements, keccak256, { hashLeaves: true, sortPairs: true })
const root = merkleTree.getHexRoot()
const leaf = keccak256(elements[0])
const proof = merkleTree.getHexProof(leaf)
console.log({root})
