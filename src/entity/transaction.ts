import { ethereum, log } from '@graphprotocol/graph-ts'
import { Transaction } from '../../generated/schema'
import { weiToBigDecimal } from '../utils/decimal'

export function getTransaction(
  block: ethereum.Block,
  transaction: ethereum.Transaction,
  receipt: ethereum.TransactionReceipt | null,
): Transaction {
  let transactionId = transaction.hash.toHexString()
  let tx = Transaction.load(transactionId)
  if (!tx) {
    tx = new Transaction(transactionId)
    tx.blockNumber = block.number
    tx.blockTimestamp = block.timestamp
    tx.sender = transaction.from.toHexString()
    if (!receipt) {
      log.warning(
        'No receipt for transaction {}. Set "receipt: true" on the event handler configuration in subgraph.yaml',
        [transactionId],
      )
      throw Error('No receipt. Set "receipt: true" on the event handler configuration in subgraph.yaml')
    }
    tx.gasFee = weiToBigDecimal(transaction.gasPrice.times(receipt.gasUsed))
  }
  return tx
}
