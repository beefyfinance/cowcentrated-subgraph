# Intro

- Requirements: https://github.com/delta-hq/schemas/blob/main/schemas/general/SCHEMA.md
- FAQ: https://openblock.notion.site/Onboarding-FAQs-571951f8ecff4e7ca927fab4e27e8401
- clickhouse docs:
  - https://clickhouse.com/docs/en/sql-reference/functions/array-functions#arrayzip
  - https://clickhouse.com/docs/en/sql-reference/functions/array-join
- Schema: `../schema.graphql`

# prompt help

- Given SQL access to the given @schema.graphql schema where each type is accessible as a standard SQL table and relations are accessible though join.
- the id of the relation is available as the relation name. Example: do NOT use `table.relation.id`, use `table.relation`.
- you have access to clickhouse functions and should write in clickhouse SQL format
- escape names with backticks
- use `toDecimal256(col, 18) / pow(10, token_decimals)` to convert BigInt to numbers. USD prices are assumed to have 18 decimals.
- example: `toDecimal256(any(p.underlying_token_amount_str), 18) / pow(10, underlying_token_decimals) as underlying_token_amount`
- use `array*` functions to deal with arrays (`arrayZip`, `arrayMap`, `arrayJoin`, etc)
- use `JSONExtract(col, 'Array(String)')` to extract data from columns of BigInt[]
- enums column names are postfixed with `__`. Exeample: `type: ClassicPositionInteractionType!` -> `column name: type__`
- convert timestamps with `fromUnixTimestamp(toInt64(col))`

# General

Table definitions for the generic schema. These tables can be used for any protocol.

## Version: 1.0.0-alpha

### Incentive Claim Data

Transactional data on user level incentives claimed data.

| Property              | Description                                                                                          | Type   |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ------ |
| timestamp             | The timestamp of the claim.                                                                          | number |
| chain_id              | The standard chain id.                                                                               | number |
| transaction_hash      | The hash of the transaction.                                                                         | string |
| log_index             | The event log. For transactions that don't emit event, create arbitrary index starting from 0.       | number |
| transaction_signer    | The address of the account that signed the transaction.                                              | string |
| user_address          | The address of the user who claimed the incentives (could be different from the transaction_signer). | string |
| claimed_token_address | The smart contract address of the claimed token.                                                     | string |
| amount                | The amount of the token claimed, decimal normalized.                                                 | number |
| amount_usd            | The amount of claimed tokens in USD.                                                                 | number |
| other_incentive_usd   | (Optional) Any incentives outside of the claimed token, in this transaction, summed up in USD terms. | number |

```SQL
WITH token_ids AS (
    SELECT DISTINCT
        arrayJoin(JSONExtract(clm.rewardTokensOrder, 'Array(String)')) as token_id
    FROM
        `ClmPositionInteraction` interaction
    JOIN
        CLM clm ON interaction.clm = clm.id
    WHERE
        type__ = 'CLM_REWARD_POOL_CLAIM'
)
SELECT
    interaction.timestamp,
    42161 as chain_id,
    hex(interaction.createdWith) as transaction_hash,
    interaction.logIndex as log_index,
    hex(tx.sender) as transaction_signer,
    hex(interaction.investor) as user_address,
    JSONExtract(clm.rewardTokensOrder, 'Array(String)') as claimed_token_address,
    arrayMap(
        (amount) -> toDecimal256(amount, 18) / pow(10, t.decimals),
        JSONExtract(interaction.rewardBalancesDelta, 'Array(String)')
    ) as amount,
    arrayMap(
        (amount, price) -> (
            toDecimal256(amount, 18) / pow(10, t.decimals) *
            (toDecimal256(price, 18) / pow(10, 18)) *
            (toDecimal256(interaction.nativeToUSDPrice, 18) / pow(10, 18))
        ),
        JSONExtract(interaction.rewardBalancesDelta, 'Array(String)'),
        JSONExtract(interaction.rewardToNativePrices, 'Array(String)')
    ) as amount_usd,
    0 as other_incentive_usd
FROM
    `ClmPositionInteraction` interaction
JOIN
    CLM clm ON interaction.clm = clm.id
JOIN
    Transaction tx ON interaction.createdWith = tx.id
JOIN
    Token t ON t.id = arrayJoin(JSONExtract(clm.rewardTokensOrder, 'Array(String)'))
WHERE
    type__ = 'CLM_REWARD_POOL_CLAIM'
ORDER BY
    interaction.timestamp DESC
```

### Airdrop

Schema for airdrop data.

| Property              | Description                                                                                    | Type   |
| --------------------- | ---------------------------------------------------------------------------------------------- | ------ |
| airdrop_timestamp     | The timestamp the airdrop was given to the user.                                               | number |
| user_address          | The address of the user claiming the airdrop.                                                  | string |
| claim_timestamp       | The timestamp of when the user claimed the airdrop.                                            | number |
| transaction_hash      | The hash of the transaction.                                                                   | string |
| log_index             | The event log. For transactions that don't emit event, create arbitrary index starting from 0. | number |
| airdrop_token_address | The smart contract address of the airdropped token.                                            | string |
| airdrop_token_symbol  | The symbol of the token being airdropped.                                                      | string |
| token_amount          | The amount of each token airdropped, decimal normalized.                                       | number |
| amount_usd            | The USD value of the airdropped tokens.                                                        | number |

NOT APPLICABLE

### Pool Snapshot

APR and APY data at the pool level.

| Property               | Description                                                                                                       | Type   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| timestamp              | The timestamp of the record.                                                                                      | number |
| block_date             | The timestamp truncated (ie, YYYY-MM-DD format for daily snapshots and YYYY-MM-DD HH:00:00 for hourly snapshots). | date   |
| chain_id               | The standard chain id.                                                                                            | number |
| protocol_type          | The type of protocol (ie, Lending, CDP, DEX, Gaming, etc).                                                        | string |
| pool_address           | The smart contract address of the pool.                                                                           | string |
| pool_name              | The name of the pool (ie, pool() in the smart contract, if it exists).                                            | string |
| total_value_locked_usd | The total value locked within this pool in USD.                                                                   | number |
| supply_apr             | The annual percentage rate of this pool at the snapshot.                                                          | number |
| supply_apy             | The annual percentage yield of the pool.                                                                          | number |

```SQL
SELECT
    snapshot.timestamp,
    fromUnixTimestamp(toInt64(snapshot.roundedTimestamp)) as block_date,
    42161 as chain_id,
    'Lending' as protocol_type,
    clm.id as pool_address,
    managerToken.name as pool_name,
    (
        (toDecimal256(snapshot.totalUnderlyingAmount0, 18) / pow(10, t0.decimals) * (toDecimal256(snapshot.token0ToNativePrice, 18) / pow(10, 18))) +
        (toDecimal256(snapshot.totalUnderlyingAmount1, 18) / pow(10, t1.decimals) * (toDecimal256(snapshot.token1ToNativePrice, 18) / pow(10, 18)))
    ) * (toDecimal256(snapshot.nativeToUSDPrice, 18) / pow(10, 18)) as total_value_locked_usd,
    0 as supply_apr,
    0 as supply_apy
FROM
    `ClmSnapshot` snapshot
JOIN
    CLM clm ON snapshot.clm = clm.id
LEFT JOIN
    Token managerToken ON clm.managerToken = managerToken.id
JOIN
    Token t0 ON clm.underlyingToken0 = t0.id
JOIN
    Token t1 ON clm.underlyingToken1 = t1.id
ORDER BY
    snapshot.timestamp DESC
```

### Protocol Snapshot

Protocol level snapshot focused on incentives and users.

| Property           | Description                                                                                                       | Type   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- | ------ |
| timestamp          | The timestamp of the snapshot.                                                                                    | number |
| block_date         | The timestamp truncated (ie, YYYY-MM-DD format for daily snapshots and YYYY-MM-DD HH:00:00 for hourly snapshots). | date   |
| chain_id           | The standard chain id.                                                                                            | number |
| daily_active_users | The number of unique daily active users on this protocol.                                                         | number |
| transaction_count  | The number of transactions in this time period.                                                                   | number |
| fees_usd           | The amount of fees in this given period, decimal normalized.                                                      | number |

```SQL

SELECT
    toStartOfDay(fromUnixTimestamp(toInt64(events.timestamp))) as block_date,
    max(events.timestamp) as timestamp,
    42161 as chain_id,
    count(DISTINCT user_address) as daily_active_users,
    count(*) as transaction_count,
    sum(fees_usd) as fees_usd
FROM
(
    -- Interactions
    SELECT
        timestamp,
        hex(investor) as user_address,
        0 as fees_usd
    FROM ClmPositionInteraction
    WHERE type__ IN ('MANAGER_DEPOSIT', 'MANAGER_WITHDRAW', 'CLM_REWARD_POOL_STAKE', 'CLM_REWARD_POOL_UNSTAKE', 'CLM_REWARD_POOL_CLAIM')

    UNION ALL

    -- Harvest events
    SELECT
        h.timestamp,
        hex(h.createdWith) as user_address,
        (
            (toDecimal256(h.compoundedAmount0, 18) / pow(10, t0.decimals) * (toDecimal256(h.token0ToNativePrice, 18) / pow(10, 18))) +
            (toDecimal256(h.compoundedAmount1, 18) / pow(10, t1.decimals) * (toDecimal256(h.token1ToNativePrice, 18) / pow(10, 18)))
        ) * (toDecimal256(h.nativeToUSDPrice, 18) / pow(10, 18)) as fees_usd
    FROM ClmHarvestEvent h
    JOIN CLM clm ON h.clm = clm.id
    JOIN Token t0 ON clm.underlyingToken0 = t0.id
    JOIN Token t1 ON clm.underlyingToken1 = t1.id
) events
GROUP BY block_date
ORDER BY block_date DESC
```

### Token Balance Snapshot

User level token balance snapshots.

| Property         | Description                                                                                                       | Type   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| timestamp        | The timestamp of the snapshot.                                                                                    | number |
| block_date       | The timestamp truncated (ie, YYYY-MM-DD format for daily snapshots and YYYY-MM-DD HH:00:00 for hourly snapshots). | date   |
| chain_id         | The standard chain id.                                                                                            | number |
| user_address     | The address of the user this snapshot activity is based on.                                                       | string |
| token_address    | The smart contract address of the token.                                                                          | string |
| token_symbol     | The symbol of the token we are getting the balance of.                                                            | string |
| token_amount     | The amount of the token at the given snapshot timestamp (decimal normalized).                                     | number |
| token_amount_usd | The amount of the token in USD.                                                                                   | number |

```SQL
WITH position_snapshots AS (
    SELECT
        snapshot.timestamp,
        fromUnixTimestamp(toInt64(snapshot.roundedTimestamp)) as block_date,
        hex(snapshot.investor) as user_address,
        clm.underlyingToken0 as token0_id,
        clm.underlyingToken1 as token1_id,
        t0.symbol as token0_symbol,
        t1.symbol as token1_symbol,
        -- Calculate token amounts
        toDecimal256(snapshot.underlyingAmount0, 18) / pow(10, t0.decimals) as token0_amount,
        toDecimal256(snapshot.underlyingAmount1, 18) / pow(10, t1.decimals) as token1_amount,
        -- Calculate USD values using native price conversions
        (toDecimal256(snapshot.underlyingAmount0, 18) / pow(10, t0.decimals)) * 
        (toDecimal256(snapshot.token0ToNativePrice, 18) / pow(10, 18)) * 
        (toDecimal256(snapshot.nativeToUSDPrice, 18) / pow(10, 18)) as token0_amount_usd,
        (toDecimal256(snapshot.underlyingAmount1, 18) / pow(10, t1.decimals)) * 
        (toDecimal256(snapshot.token1ToNativePrice, 18) / pow(10, 18)) * 
        (toDecimal256(snapshot.nativeToUSDPrice, 18) / pow(10, 18)) as token1_amount_usd
    FROM
        `ClmPositionSnapshot` snapshot
    JOIN
        CLM clm ON snapshot.clm = clm.id
    JOIN
        Token t0 ON clm.underlyingToken0 = t0.id
    JOIN
        Token t1 ON clm.underlyingToken1 = t1.id
)
SELECT
    timestamp,
    block_date,
    42161 as chain_id,
    user_address,
    token_id as token_address,
    token_symbol,
    token_amount,
    token_amount_usd
FROM
(
    -- Token0 records
    SELECT
        timestamp,
        block_date,
        user_address,
        token0_id as token_id,
        token0_symbol as token_symbol,
        token0_amount as token_amount,
        token0_amount_usd as token_amount_usd
    FROM position_snapshots
    
    UNION ALL
    
    -- Token1 records
    SELECT
        timestamp,
        block_date,
        user_address,
        token1_id as token_id,
        token1_symbol as token_symbol,
        token1_amount as token_amount,
        token1_amount_usd as token_amount_usd
    FROM position_snapshots
)
ORDER BY timestamp DESC, user_address, token_symbol
```

### General Transactions

Generic table at a user and transaction level

| Property            | Description                                                                                                                                                            | Type      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| timestamp           | The timestamp of the transaction.                                                                                                                                      | timestamp |
| block_date          | A date representation of the timestamp (ie, YYYY-MM-DD HH:MM:SS)                                                                                                       | date      |
| chain_id            | The standard chain id.                                                                                                                                                 | number    |
| block_number        | The ordinal block number.                                                                                                                                              | number    |
| signer_address      | The transaction signer's address.                                                                                                                                      | varbinary |
| transaction_hash    | The unique identifier for this transaction.                                                                                                                            | varbinary |
| log_index           | The unique identifier for this transaction.                                                                                                                            | number    |
| event_name          | The string name for the event associated with log_index, corresponds to the action taken by the user (ie, deposit, withdrawal, borrow, repay, liquidation, flashloan). | string    |
| transaction_fee     | The total amount of gas used in the transactions occurring in the given snapshot (in the native gas amount).                                                           | number    |
| transaction_fee_usd | (Optional, if possible) The total amount of gas used in USD terms in the given snapshot.                                                                               | number    |

### User Transaction Fee Snapshot

Gas and transaction snapshot data at the user level.

| Property             | Description                                                                                                       | Type   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| timestamp            | The timestamp of the snapshot.                                                                                    | number |
| block_date           | The timestamp truncated (ie, YYYY-MM-DD format for daily snapshots and YYYY-MM-DD HH:00:00 for hourly snapshots). | date   |
| chain_id             | The standard chain id.                                                                                            | number |
| user_address         | The address of the user this snapshot activity is based on.                                                       | string |
| transaction_count    | The number of transactions this user has signed in the given snapshot.                                            | number |
| transaction_fees     | The total amount of gas used in the transactions occurring in the given snapshot (in the native gas amount).      | number |
| transaction_fees_usd | (Optional, if possible) The total amount of gas used in USD terms in the given snapshot.                          | number |
