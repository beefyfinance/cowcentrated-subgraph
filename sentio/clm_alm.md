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

```sql
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
where timestamp > timestamp('${timestamp}')
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

```sql
WITH position_snapshots AS (
    SELECT
        snapshot.timestamp,
        fromUnixTimestamp(toInt64(snapshot.roundedTimestamp)) as block_date,
        snapshot.investor as user_address,
        clm.underlyingToken0 as token0_id,
        clm.underlyingToken1 as token1_id,
        t0.symbol as token0_symbol,
        t1.symbol as token1_symbol,
        clm.strategy as strategy_vault_contract_address,
        clm.underlyingProtocolPool as liquidity_pool_address,
        toDecimal256(snapshot.underlyingBalance0, 18) / pow(10, t0.decimals) as token0_amount,
        toDecimal256(snapshot.underlyingBalance1, 18) / pow(10, t1.decimals) as token1_amount,
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
    WHERE snapshot.period = 86400
),
all_snapshots as (
    SELECT
        timestamp,
        block_date,
        user_address,
        strategy_vault_contract_address,
        liquidity_pool_address,
        token0_id as token_id,
        token0_symbol as token_symbol,
        0 as token_index,
        token0_amount as token_amount,
        token0_amount_usd as token_amount_usd,
        0 as total_fees_usd
    FROM position_snapshots
    UNION ALL
    SELECT
        timestamp,
        block_date,
        user_address,
        strategy_vault_contract_address,
        liquidity_pool_address,
        token1_id as token_id,
        token1_symbol as token_symbol,
        1 as token_index,
        token1_amount as token_amount,
        token1_amount_usd as token_amount_usd,
        0 as total_fees_usd
    FROM position_snapshots
),
data_res as (
    SELECT
        timestamp,
        block_date,
        146 as chain_id,
        strategy_vault_contract_address,
        user_address,
        liquidity_pool_address,
        token_id as underlying_token_address,
        token_index as underlying_token_index,
        token_amount as underlying_token_amount,
        token_amount_usd as underlying_token_amount_usd,
        total_fees_usd
    FROM all_snapshots
    ORDER BY timestamp DESC, user_address, token_symbol
)
select *
from data_res
where timestamp > timestamp('${timestamp}')
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

```sql
WITH data_res AS (
    SELECT
        snapshot.timestamp,
        fromUnixTimestamp(toInt64(snapshot.roundedTimestamp)) as block_date,
        146 as chain_id,
        strategy.id as strategy_vault_contract_address,
        clm.underlyingProtocolPool as liquidity_pool_address,
        clm.underlyingToken0 as underlying_token_address,
        0 as underlying_token_index,
        toDecimal256(snapshot.totalUnderlyingAmount0, 18) / pow(10, t0.decimals) as underlying_token_amount,
        (toDecimal256(snapshot.totalUnderlyingAmount0, 18) / pow(10, t0.decimals)) *
        (toDecimal256(snapshot.token0ToNativePrice, 18) / pow(10, 18)) *
        (toDecimal256(snapshot.nativeToUSDPrice, 18) / pow(10, 18)) as underlying_token_amount_usd,
        (
            toDecimal256(snapshot.totalCallFees + snapshot.totalBeefyFees + snapshot.totalStrategistFees, 18) / pow(10, 18)
        ) * (
            toDecimal256(snapshot.nativeToUSDPrice, 18) / pow(10, 18)
        ) as total_fees_usd
    FROM ClmSnapshot snapshot
    JOIN CLM clm ON snapshot.clm = clm.id
    JOIN ClmStrategy strategy ON clm.strategy = strategy.id
    JOIN Token t0 ON clm.underlyingToken0 = t0.id
    WHERE snapshot.period = 86400
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

        (
            toDecimal256(snapshot.totalCallFees + snapshot.totalBeefyFees + snapshot.totalStrategistFees, 18) / pow(10, 18)
        ) * (
            toDecimal256(snapshot.nativeToUSDPrice, 18) / pow(10, 18)
        ) as total_fees_usd
    FROM ClmSnapshot snapshot
    JOIN CLM clm ON snapshot.clm = clm.id
    JOIN ClmStrategy strategy ON clm.strategy = strategy.id
    JOIN Token t1 ON clm.underlyingToken1 = t1.id
    WHERE snapshot.period = 86400
)
select *
from data_res
where timestamp > timestamp('${timestamp}')
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
  data_res as (
    SELECT
      tt.blockTimestamp as timestamp,
      146 as chain_id,
      tt.blockNumber as block_number,
      tt.logIndex as log_index,
      tt.transactionHash as transaction_hash,
      tt.from__ as from_address,
      tt.to__ as to_address,
      tt.token as pool_address,
      toDecimal256 (tt.amount, 18) / pow(10, t.decimals) as amount,
      CASE
        WHEN tt.from__ = '0x0000000000000000000000000000000000000000' THEN 'mint'
        WHEN tt.from__ = '0x000000000000000000000000000000000000dead' THEN 'mint'
        WHEN tt.to__ = '0x0000000000000000000000000000000000000000' THEN 'burn'
        WHEN tt.to__ = '0x000000000000000000000000000000000000dead' THEN 'burn'
        ELSE 'transfer'
      END as event_type
    FROM
      TokenTransfer tt
      JOIN Token t ON tt.token = t.id
    ORDER BY
      tt.blockTimestamp DESC,
      tt.logIndex ASC
  )
select
  *
from
  data_res
where timestamp > timestamp('${timestamp}')
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
data_res AS (
    SELECT
        i.timestamp,
        i.blockNumber as block_number,
        i.logIndex as log_index,
        i.createdWith as transaction_hash,
        i.investor as user_address,
        c.id as pool_address,
        c.managerToken as underlying_token_address,
        abs(
            toDecimal256(i.managerBalanceDelta, 18) / pow(10, st.decimals)
            + arraySum(arrayMap(x -> toDecimal256(x, 18), i.rewardPoolBalancesDelta)) / pow(10, st.decimals)
        ) as amount,
        (
            abs(toDecimal256(i.underlyingBalance0Delta, 18) / pow(10, t0.decimals)) *
            (toDecimal256(i.token0ToNativePrice, 18) / pow(10, 18)) *
            (toDecimal256(i.nativeToUSDPrice, 18) / pow(10, 18))
        ) + (
            abs(toDecimal256(i.underlyingBalance1Delta, 18) / pow(10, t1.decimals)) *
            (toDecimal256(i.token1ToNativePrice, 18) / pow(10, 18)) *
            (toDecimal256(i.nativeToUSDPrice, 18) / pow(10, 18))
        ) as amount_usd,
        CASE
            WHEN i.type__ = 'MANAGER_DEPOSIT' THEN 'deposit'
            WHEN i.type__ = 'MANAGER_WITHDRAW' THEN 'withdraw'
            WHEN i.type__ = 'CLM_REWARD_POOL_STAKE' THEN 'stake'
            WHEN i.type__ = 'CLM_REWARD_POOL_UNSTAKE' THEN 'unstake'
            WHEN i.type__ = 'CLM_REWARD_POOL_CLAIM' THEN 'claim'
            ELSE 'unknown'
        END as event_type
    FROM `ClmPositionInteraction` i
    JOIN `Transaction` tx ON i.createdWith = tx.id
    JOIN `CLM` c ON i.clm = c.id
    JOIN `Token` t0 ON c.underlyingToken0 = t0.id
    JOIN `Token` t1 ON c.underlyingToken1 = t1.id
    JOIN `Token` st ON c.managerToken = st.id
    WHERE i.type__ IN (
        'MANAGER_DEPOSIT',
        'MANAGER_WITHDRAW',
        'CLM_REWARD_POOL_STAKE',
        'CLM_REWARD_POOL_UNSTAKE',
        'CLM_REWARD_POOL_CLAIM'
    )
)
SELECT
    timestamp,
    146 as chain_id,
    block_number,
    log_index,
    transaction_hash,
    user_address,
    pool_address,
    underlying_token_address,
    amount,
    amount_usd,
    event_type
FROM data_res
--where timestamp > timestamp('${timestamp}')
```
