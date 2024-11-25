# General

Table definitions for the generic schema. These tables can be used for any protocol.

## Version: 1.0.0-alpha

### Incentive Claim Data

Transactional data on user level incentives claimed data.

| Property                | Description                                               | Type   |
|-------------------------|-----------------------------------------------------------|--------|
| timestamp                | The timestamp of the claim.                               | number |
| chain_id                 | The standard chain id.                                    | number |
| transaction_hash         | The hash of the transaction.                              | string |
| log_index                | The event log. For transactions that don't emit event, create arbitrary index starting from 0. | number |
| transaction_signer       | The address of the account that signed the transaction.   | string |
| user_address             | The address of the user who claimed the incentives (could be different from the transaction_signer). | string |
| claimed_token_address    | The smart contract address of the claimed token.          | string |
| amount                   | The amount of the token claimed, decimal normalized.      | number |
| amount_usd               | The amount of claimed tokens in USD.                      | number |
| other_incentive_usd      | (Optional) Any incentives outside of the claimed token, in this transaction, summed up in USD terms. | number |

### Airdrop

Schema for airdrop data.

| Property                | Description                                               | Type   |
|-------------------------|-----------------------------------------------------------|--------|
| airdrop_timestamp        | The timestamp the airdrop was given to the user.          | number |
| user_address             | The address of the user claiming the airdrop.             | string |
| claim_timestamp          | The timestamp of when the user claimed the airdrop.       | number |
| transaction_hash         | The hash of the transaction.                              | string |
| log_index                | The event log. For transactions that don't emit event, create arbitrary index starting from 0. | number |
| airdrop_token_address    | The smart contract address of the airdropped token.       | string |
| airdrop_token_symbol     | The symbol of the token being airdropped.                 | string |
| token_amount             | The amount of each token airdropped, decimal normalized.  | number |
| amount_usd               | The USD value of the airdropped tokens.                   | number |

### Pool Snapshot

APR and APY data at the pool level.

| Property                | Description                                               | Type   |
|-------------------------|-----------------------------------------------------------|--------|
| timestamp                | The timestamp of the record.                              | number |
| block_date               | The timestamp truncated (ie, YYYY-MM-DD format for daily snapshots and YYYY-MM-DD HH:00:00 for hourly snapshots). | date |
| chain_id                 | The standard chain id.                                    | number |
| protocol_type            | The type of protocol (ie, Lending, CDP, DEX, Gaming, etc). | string |
| pool_address             | The smart contract address of the pool.                   | string |
| pool_name                | The name of the pool (ie, pool() in the smart contract, if it exists). | string |
| total_value_locked_usd   | The total value locked within this pool in USD.           | number |
| supply_apr               | The annual percentage rate of this pool at the snapshot.  | number |
| supply_apy               | The annual percentage yield of the pool.                  | number |

### Protocol Snapshot

Protocol level snapshot focused on incentives and users.

| Property                | Description                                               | Type   |
|-------------------------|-----------------------------------------------------------|--------|
| timestamp                | The timestamp of the snapshot.                            | number |
| block_date               | The timestamp truncated (ie, YYYY-MM-DD format for daily snapshots and YYYY-MM-DD HH:00:00 for hourly snapshots). | date |
| chain_id                 | The standard chain id.                                    | number |
| daily_active_users       | The number of unique daily active users on this protocol. | number |
| transaction_count        | The number of transactions in this time period.           | number |
| fees_usd                 | The amount of fees in this given period, decimal normalized. | number |

### Token Balance Snapshot

User level token balance snapshots.

| Property                | Description                                               | Type   |
|-------------------------|-----------------------------------------------------------|--------|
| timestamp                | The timestamp of the snapshot.                            | number |
| block_date               | The timestamp truncated (ie, YYYY-MM-DD format for daily snapshots and YYYY-MM-DD HH:00:00 for hourly snapshots). | date |
| chain_id                 | The standard chain id.                                    | number |
| user_address             | The address of the user this snapshot activity is based on. | string |
| token_address            | The smart contract address of the token.                  | string |
| token_symbol             | The symbol of the token we are getting the balance of.    | string |
| token_amount             | The amount of the token at the given snapshot timestamp (decimal normalized). | number |
| token_amount_usd         | The amount of the token in USD.                           | number |

### General Transactions

Generic table at a user and transaction level

| Property                | Description                                               | Type   |
|-------------------------|-----------------------------------------------------------|--------|
| timestamp                | The timestamp of the transaction.                         | timestamp |
| block_date               | A date representation of the timestamp (ie, YYYY-MM-DD HH:MM:SS) | date |
| chain_id                 | The standard chain id.                                    | number |
| block_number             | The ordinal block number.                                 | number |
| signer_address           | The transaction signer's address.                         | varbinary |
| transaction_hash         | The unique identifier for this transaction.               | varbinary |
| log_index                | The unique identifier for this transaction.               | number |
| event_name               | The string name for the event associated with log_index, corresponds to the action taken by the user (ie, deposit, withdrawal, borrow, repay, liquidation, flashloan). | string |
| transaction_fee          | The total amount of gas used in the transactions occurring in the given snapshot (in the native gas amount). | number |
| transaction_fee_usd      | (Optional, if possible) The total amount of gas used in USD terms in the given snapshot. | number |

### User Transaction Fee Snapshot

Gas and transaction snapshot data at the user level.

| Property                | Description                                               | Type   |
|-------------------------|-----------------------------------------------------------|--------|
| timestamp                | The timestamp of the snapshot.                            | number |
| block_date               | The timestamp truncated (ie, YYYY-MM-DD format for daily snapshots and YYYY-MM-DD HH:00:00 for hourly snapshots). | date |
| chain_id                 | The standard chain id.                                    | number |
| user_address             | The address of the user this snapshot activity is based on. | string |
| transaction_count        | The number of transactions this user has signed in the given snapshot. | number |
| transaction_fees         | The total amount of gas used in the transactions occurring in the given snapshot (in the native gas amount). | number |
| transaction_fees_usd     | (Optional, if possible) The total amount of gas used in USD terms in the given snapshot. | number |

> Note: This markdown file is auto-generated.