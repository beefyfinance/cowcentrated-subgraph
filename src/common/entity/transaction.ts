import { ethereum } from "@graphprotocol/graph-ts"
import { Transaction } from "../../../generated/schema"
import { ADDRESS_ZERO } from "../utils/address"

export function getAndSaveTransaction(block: ethereum.Block, transaction: ethereum.Transaction): Transaction {
  let transactionId = transaction.hash
  let tx = Transaction.load(transactionId)
  if (!tx) {
    tx = new Transaction(transactionId)
    tx.blockNumber = block.number
    tx.blockTimestamp = block.timestamp
    tx.sender = transaction.from || ADDRESS_ZERO
    tx.save()
  }
  return tx
}
