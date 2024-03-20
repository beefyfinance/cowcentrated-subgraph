import { ethereum, log } from "@graphprotocol/graph-ts"
import { Transaction } from "../../generated/schema"
import { weiToBigDecimal } from "../utils/decimal"
import { ADDRESS_ZERO } from "../utils/address"

export function getTransaction(
  block: ethereum.Block,
  transaction: ethereum.Transaction,
  receipt: ethereum.TransactionReceipt | null,
): Transaction {
  let transactionId = transaction.hash
  let tx = Transaction.load(transactionId)
  if (!tx) {
    tx = new Transaction(transactionId)
    tx.blockNumber = block.number
    tx.blockTimestamp = block.timestamp
    tx.sender = transaction.from || ADDRESS_ZERO
    if (!receipt) {
      log.warning(
        'No receipt for transaction {}. Set "receipt: true" on the event handler configuration in subgraph.yaml',
        [transactionId.toHexString()],
      )
      throw Error('No receipt. Set "receipt: true" on the event handler configuration in subgraph.yaml')
    }
    tx.gasFee = weiToBigDecimal(transaction.gasPrice.times(receipt.gasUsed))
  }
  return tx
}
