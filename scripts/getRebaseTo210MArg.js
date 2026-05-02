import fs from 'fs'

const holders = fs.readFileSync('scripts/export-tokenholders-for-contract-0xea81dab2e0ecbc6b5c4172de4c22b6ef6e55bd8f-2026-05-02.csv', 'utf8')
  .split('\n')
  .map(line => line.split(',')[0].replaceAll('"', ''))

// remove the csv header
holders.shift()

console.log('rebasing', holders.length, 'holders')
console.log('')
console.log('')
console.log(holders.join(','))
console.log('')
console.log('')
