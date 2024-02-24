import { ethereum } from '@graphprotocol/graph-ts'
import { Transaction } from '../../generated/schema'
import { weiToDecimal } from '../utils/decimal'

export function getTransaction(
  block: ethereum.Block,
  transaction: ethereum.Transaction,
  receipt: ethereum.TransactionReceipt | null,
): Transaction {
  let transactionHash = transaction.hash
  let tx = Transaction.load(transactionHash)
  if (!tx) {
    tx = new Transaction(transactionHash)
    tx.blockNumber = block.number
    tx.blockTimestamp = block.timestamp
    tx.sender = transaction.from
    if (!receipt) throw Error('No receipt. Set "receipt: true" on the event handler configuration in subgraph.yaml')
    tx.gasFee = weiToDecimal(transaction.gasPrice.times(receipt.gasUsed))
  }
  return tx
}
