# Automated Liquidity Management

Standard table definitions for automated liquidity management protocol.

## Version: 1.0.0-alpha

### Pools

List of pools in the protocol.

| Property                              | Description                                                                              | Type   |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | ------ |
| chain_id                              | The standard chain id.                                                                   | number |
| timestamp                             | The timestamp this pool was created.                                                     | number |
| creation_block_number                 | The block number that this pool was created.                                             | number |
| strategy_vault_contract_address       | The contract address of the strategy vault which manages the liquidity pool positions.   | string |
| liquidity_pool_address                | The contract address of the underlying liquidity pool where liquidity are deposited into | string |
| strategy_vault_receipt_token_address  | The contract address of ERC20 token which represents the share of liquidity provided.    | string |
| strategy_vault_receipt_token_decimals | The decimal amount of the ERC20 receipt token.                                           | number |
| strategy_vault_receipt_token_symbol   | The symbol of the receipt token.                                                         | string |

```SQL
with data_res as (
    SELECT
        146 as chain_id,
        tx.blockTimestamp as timestamp,
        tx.blockNumber as creation_block_number,
        strategy.id as strategy_vault_contract_address,
        clm.underlyingProtocolPool as liquidity_pool_address,
        managerToken.id as strategy_vault_receipt_token_address,
        managerToken.decimals as strategy_vault_receipt_token_decimals,
        managerToken.symbol as strategy_vault_receipt_token_symbol
    FROM CLM clm
    JOIN ClmManager manager ON clm.manager = manager.id
    JOIN Transaction tx ON manager.createdWith = tx.id
    JOIN ClmStrategy strategy ON clm.strategy = strategy.id
    JOIN Token managerToken ON clm.managerToken = managerToken.id
    ORDER BY timestamp DESC
)
select *
from data_res
where timestamp > timestamp('${timestamp}') -- sentio
--where timestamp > timestamp('{{timestamp}}') -- obl
```

### Position Snapshot

Snapshot of the pool users.

| Property                        | Description                                                                                                       | Type   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| timestamp                       | The timestamp of the snapshot.                                                                                    | number |
| block_date                      | The timestamp truncated (ie, YYYY-MM-DD format for daily snapshots and YYYY-MM-DD HH:00:00 for hourly snapshots). | date   |
| chain_id                        | The standard chain id.                                                                                            | number |
| strategy_vault_contract_address | The address of the strategy vault this user has a position in.                                                    | string |
| user_address                    | The address of the user who has a position in the strategy vault.                                                 | string |
| liquidity_pool_address          | The address of the underlying liquidity pool where liquidity are deposited into                                   | string |
| underlying_token_address        | The address of the supplied underlying token.                                                                     | string |
| underlying_token_index          | The index of the underlying token in the smart contract, default 0.                                               | number |
| underlying_token_amount         | The amount based on the user's share of the total underlying token, decimal normalized.                           | number |
| underlying_token_amount_usd     | The amount based on the user's share of the total underlying token, in USD.                                       | number |
| total_fees_usd                  | The total amount of revenue and fees paid in this pool in the given snapshot, in USD.                             | number |

```SQL

WITH position_snapshots AS (
    SELECT
        snapshot.timestamp,
        fromUnixTimestamp(toInt64(snapshot.roundedTimestamp)) as block_date,
        snapshot.investor as user_address,
        clm.underlyingToken0 as token0_id,
        clm.underlyingToken1 as token1_id,
        t0.symbol as token0_symbol,
        t1.symbol as token1_symbol,
        -- Calculate token amounts
        toDecimal256(snapshot.underlyingBalance0, 18) / pow(10, t0.decimals) as token0_amount,
        toDecimal256(snapshot.underlyingBalance1, 18) / pow(10, t1.decimals) as token1_amount,
        -- Calculate USD values using native price conversions
        (toDecimal256(snapshot.underlyingBalance0, 18) / pow(10, t0.decimals)) *
        (toDecimal256(snapshot.token0ToNativePrice, 18) / pow(10, 18)) *
        (toDecimal256(snapshot.nativeToUSDPrice, 18) / pow(10, 18)) as token0_amount_usd,
        (toDecimal256(snapshot.underlyingBalance1, 18) / pow(10, t1.decimals)) *
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
),
all_snapshots as (
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
),
data_res as (
    SELECT
        timestamp,
        block_date,
        146 as chain_id,
        user_address,
        token_id as token_address,
        token_symbol,
        token_amount,
        token_amount_usd
    FROM all_snapshots
    ORDER BY timestamp DESC, user_address, token_symbol
)
select *
from data_res
where timestamp > timestamp('${timestamp}') -- sentio
--where timestamp > timestamp('{{timestamp}}') -- obl
```

### Pool Snapshot

TVL, fees, and incentives data at the pool level.

| Property                        | Description                                                                                                       | Type   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| timestamp                       | The timestamp of the snapshot.                                                                                    | number |
| block_date                      | The timestamp truncated (ie, YYYY-MM-DD format for daily snapshots and YYYY-MM-DD HH:00:00 for hourly snapshots). | date   |
| chain_id                        | The standard chain id.                                                                                            | number |
| strategy_vault_contract_address | The address of the strategy vault this user has a position in.                                                    | string |
| liquidity_pool_address          | The address of the underlying liquidity pool where liquidity are deposited into                                   | string |
| underlying_token_address        | The address of the supplied underlying token.                                                                     | string |
| underlying_token_index          | The index of the underlying token in the smart contract, default 0.                                               | number |
| underlying_token_amount         | The amount of underlying token supplied in this pool, decimal normalized.                                         | number |
| underlying_token_amount_usd     | The amount of underlying tokens supplied in this pool, in USD.                                                    | number |
| total_fees_usd                  | The total amount of revenue and fees paid in this pool in the given snapshot, in USD.                             | number |

```SQL
WITH data_res AS (
    SELECT
        snapshot.timestamp,
        fromUnixTimestamp(toInt64(snapshot.roundedTimestamp)) as block_date,
        146 as chain_id,
        strategy.id as strategy_vault_contract_address,
        clm.underlyingProtocolPool as liquidity_pool_address,
        -- For token0
        clm.underlyingToken0 as underlying_token_address,
        0 as underlying_token_index,
        toDecimal256(snapshot.totalUnderlyingAmount0, 18) / pow(10, t0.decimals) as underlying_token_amount,
        (toDecimal256(snapshot.totalUnderlyingAmount0, 18) / pow(10, t0.decimals)) *
        (toDecimal256(snapshot.token0ToNativePrice, 18) / pow(10, 18)) *
        (toDecimal256(snapshot.nativeToUSDPrice, 18) / pow(10, 18)) as underlying_token_amount_usd,
        0 as total_fees_usd
    FROM ClmSnapshot snapshot
    JOIN CLM clm ON snapshot.clm = clm.id
    JOIN ClmStrategy strategy ON clm.strategy = strategy.id
    JOIN Token t0 ON clm.underlyingToken0 = t0.id

    UNION ALL

    SELECT
        snapshot.timestamp,
        fromUnixTimestamp(toInt64(snapshot.roundedTimestamp)) as block_date,
        146 as chain_id,
        strategy.id as strategy_vault_contract_address,
        clm.underlyingProtocolPool as liquidity_pool_address,
        -- For token1
        clm.underlyingToken1 as underlying_token_address,
        1 as underlying_token_index,
        toDecimal256(snapshot.totalUnderlyingAmount1, 18) / pow(10, t1.decimals) as underlying_token_amount,
        (toDecimal256(snapshot.totalUnderlyingAmount1, 18) / pow(10, t1.decimals)) *
        (toDecimal256(snapshot.token1ToNativePrice, 18) / pow(10, 18)) *
        (toDecimal256(snapshot.nativeToUSDPrice, 18) / pow(10, 18)) as underlying_token_amount_usd,
        0 as total_fees_usd
    FROM ClmSnapshot snapshot
    JOIN CLM clm ON snapshot.clm = clm.id
    JOIN ClmStrategy strategy ON clm.strategy = strategy.id
    JOIN Token t1 ON clm.underlyingToken1 = t1.id
)
select *
from data_res
where timestamp > timestamp('${timestamp}') -- sentio
--where timestamp > timestamp('{{timestamp}}') -- obl
```

### ERC-20 LP Token Transfer Events

All LP Token transfer events

| Property         | Description                                                                                    | Type   |
| ---------------- | ---------------------------------------------------------------------------------------------- | ------ |
| timestamp        | The timestamp of the transaction.                                                              | number |
| chain_id         | The standard id of the chain.                                                                  | number |
| block_number     | The block number of the trade.                                                                 | number |
| log_index        | The event log. For transactions that don't emit event, create arbitrary index starting from 0. | number |
| transaction_hash | The hash of the transaction.                                                                   | string |
| from_address     | The from address of the event (ie, the from field in a transfer).                              | string |
| to_address       | The to address of the event (ie, the to field in a transfer).                                  | string |
| pool_address     | The contract address of the pool LP token.                                                     | string |
| amount           | The amount of token transacted, decimal normalized.                                            | number |
| event_type       | The type of event, corresponds to the action taken by the user (ie, deposit, withdrawal).      | string |

```SQL
WITH
balance_changes AS (
    SELECT
        i.timestamp,
        i.blockNumber as block_number,
        i.logIndex as log_index,
        i.createdWith as transaction_hash,
        i.investor as user_address,
        clm.managerToken as pool_address,
        token.decimals as token_decimals,
        i.type__ as interaction_type,
        toDecimal256(i.managerBalanceDelta, 18) as manager_balance_delta,
        arraySum(arrayMap(x -> toDecimal256(x, 18), i.rewardPoolBalancesDelta)) as reward_pool_balance_delta
    FROM ClmPositionInteraction i
    JOIN CLM clm ON i.clm = clm.id
    JOIN Token token ON clm.managerToken = token.id
    WHERE i.type__ IN ('MANAGER_WITHDRAW', 'MANAGER_DEPOSIT')
),
from_events AS (
    SELECT
        timestamp,
        block_number,
        log_index,
        transaction_hash,
        user_address as from_address,
        '0x0000000000000000000000000000000000000000' as to_address,
        pool_address,
        (manager_balance_delta + reward_pool_balance_delta) / pow(10, token_decimals) as amount,
        'withdrawal' as event_type
    FROM balance_changes
    WHERE interaction_type = 'MANAGER_WITHDRAW'
),
to_events AS (
    SELECT
        timestamp,
        block_number,
        log_index,
        transaction_hash,
        '0x0000000000000000000000000000000000000000' as from_address,
        user_address as to_address,
        pool_address,
        (manager_balance_delta + reward_pool_balance_delta) / pow(10, token_decimals) as amount,
        'deposit' as event_type
    FROM balance_changes
    WHERE interaction_type = 'MANAGER_DEPOSIT'
),
data_res as (
    SELECT
        COALESCE(f.timestamp, t.timestamp) as timestamp,
        146 as chain_id,
        COALESCE(f.block_number, t.block_number) as block_number,
        COALESCE(f.log_index, t.log_index) as log_index,
        COALESCE(f.transaction_hash, t.transaction_hash) as transaction_hash,
        COALESCE(f.from_address, t.from_address) as from_address,
        COALESCE(f.to_address, t.to_address) as to_address,
        COALESCE(f.pool_address, t.pool_address) as pool_address,
        COALESCE(f.amount, t.amount) as amount,
        COALESCE(f.event_type, t.event_type) as event_type
    FROM from_events f
    FULL OUTER JOIN to_events t
        ON f.transaction_hash = t.transaction_hash
        AND f.log_index = t.log_index
    ORDER BY timestamp DESC, log_index ASC
)
select *
from data_res
where timestamp > timestamp('${timestamp}') -- sentio
--where timestamp > timestamp('{{timestamp}}') -- obl
```

### Events

All user events (ie, Deposit, Withdrawal)

| Property                 | Description                                                                                    | Type   |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ------ |
| timestamp                | The timestamp of the transaction.                                                              | number |
| chain_id                 | The standard id of the chain.                                                                  | number |
| block_number             | The block number of the trade.                                                                 | number |
| log_index                | The event log. For transactions that don't emit event, create arbitrary index starting from 0. | number |
| transaction_hash         | The hash of the transaction.                                                                   | string |
| user_address             | The address that initiates the transaction (ie, the transaction signer).                       | string |
| pool_address             | The smart contract address of the pool.                                                        | string |
| underlying_token_address | The contract address of the underlying token or deposited token.                               | string |
| amount                   | The amount of token transacted, decimal normalized.                                            | number |
| amount_usd               | The amount of token transacted, in USD.                                                        | number |
| event_type               | The type of event, corresponds to the action taken by the user (ie, deposit, withdrawal).      | string |

```SQL
with
data_res as (
    SELECT
        -- Timestamp and date fields
        i.timestamp,
        fromUnixTimestamp(toInt64(i.timestamp)) as block_date,
        -- Chain and block info
        146 as chain_id,
        i.blockNumber as block_number,
        -- Transaction details
        tx.sender as signer_address,
        i.createdWith as transaction_hash,
        i.logIndex as log_index,
        -- Event name mapping
        CASE
            WHEN i.type__ = 'MANAGER_DEPOSIT' THEN 'deposit'
            WHEN i.type__ = 'MANAGER_WITHDRAW' THEN 'withdraw'
            WHEN i.type__ = 'CLM_REWARD_POOL_STAKE' THEN 'stake'
            WHEN i.type__ = 'CLM_REWARD_POOL_UNSTAKE' THEN 'unstake'
            WHEN i.type__ = 'CLM_REWARD_POOL_CLAIM' THEN 'claim'
            ELSE 'unknown'
        END as event_name,
        -- Transaction fees (placeholder values since gas data isn't in schema)
        0 as transaction_fee,
        0 as transaction_fee_usd
    FROM ClmPositionInteraction i
    JOIN Transaction tx ON i.createdWith = tx.id
    JOIN CLM c ON i.clm = c.id
    JOIN Protocol p ON c.protocol = p.id
    WHERE i.type__ IN (
        'MANAGER_DEPOSIT',
        'MANAGER_WITHDRAW',
        'CLM_REWARD_POOL_STAKE',
        'CLM_REWARD_POOL_UNSTAKE',
        'CLM_REWARD_POOL_CLAIM'
    )
    ORDER BY i.timestamp DESC, i.logIndex ASC
)
select *
from data_res
where timestamp > timestamp('${timestamp}') -- sentio
--where timestamp > timestamp('{{timestamp}}') -- obl
```

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
WITH
raw_arrays AS (
    SELECT
        i.timestamp,
        i.createdWith as transaction_hash,
        i.logIndex as log_index,
        tx.sender as transaction_signer,
        i.investor as user_address,
        i.nativeToUSDPrice as native_to_usd,
        arrayJoin(arrayZip(clm.rewardTokensOrder, i.rewardBalancesDelta, i.rewardToNativePrices)) AS token_data
    FROM ClmPositionInteraction i
    JOIN CLM clm ON i.clm = clm.id
    JOIN Transaction tx ON i.createdWith = tx.id
    WHERE i.type__ = 'CLM_REWARD_POOL_CLAIM'
),
calculated_amounts AS (
    SELECT
        timestamp,
        transaction_hash,
        log_index,
        transaction_signer,
        user_address,
        token_data.1 as claimed_token_address,
        toDecimal256(token_data.2, 18) / pow(10, t.decimals) as amount,
        (toDecimal256(token_data.2, 18) / pow(10, t.decimals)) *
        (toDecimal256(token_data.3, 18) / pow(10, 18)) *
        (toDecimal256(native_to_usd, 18) / pow(10, 18)) as amount_usd
    FROM raw_arrays
    JOIN Token t ON t.id = token_data.1
),
data_res as (
    SELECT
        timestamp,
        146 as chain_id,
        transaction_hash,
        log_index,
        transaction_signer,
        user_address,
        claimed_token_address,
        amount,
        amount_usd,
        0 as other_incentive_usd
    FROM calculated_amounts
    ORDER BY timestamp DESC, log_index ASC
)
select *
from data_res
where timestamp > timestamp('${timestamp}') -- sentio
--where timestamp > timestamp('{{timestamp}}') -- obl
```
