# Yield Aggregator (Leverage, Gambling, RWA, Liquidity/LP, index)

Standard table definitions for yield aggregator protocols (can include, Leverage, Gambling, RWA, Liquidity/LP, index).

## Version: 1.0.0-alpha

### Pools

List of pools in the protocol.

| Property                  | Description                                                                     | Type   |
| ------------------------- | ------------------------------------------------------------------------------- | ------ |
| chain_id                  | The standard chain id.                                                          | number |
| timestamp                 | The timestamp this pool was created.                                            | number |
| creation_block_number     | The block number that this pool was created.                                    | number |
| underlying_token_address  | The contract address of the underlying token or deposited token.                | string |
| underlying_token_index    | The index of the underlying token in the smart contract, default 0.             | number |
| underlying_token_symbol   | The symbol of the underlying token token.                                       | string |
| underlying_token_decimals | The decimal amount of the underlying token.                                     | number |
| receipt_token_address     | The contract address of the output or receipt token of this pool, if available. | string |
| receipt_token_symbol      | The symbol of the receipt token.                                                | string |
| receipt_token_decimals    | The symbol decimal amount for the receipt token.                                | number |
| pool_address              | The smart contract address of the pool.                                         | string |
| pool_symbol               | The symbol of the pool.                                                         | string |

```SQL
SELECT
    42161 as chain_id,
    tx.blockTimestamp as timestamp,
    tx.blockNumber as creation_block_number,
    classic.underlyingToken as underlying_token_address,
    0 as underlying_token_index,
    t_underlying.symbol as underlying_token_symbol,
    t_underlying.decimals as underlying_token_decimals,
    classic.vaultSharesToken as receipt_token_address,
    t_shares.symbol as receipt_token_symbol,
    t_shares.decimals as receipt_token_decimals,
    classic.id as pool_address,
    t_shares.symbol as pool_symbol
FROM Classic classic
JOIN Token t_underlying ON classic.underlyingToken = t_underlying.id
JOIN Token t_shares ON classic.vaultSharesToken = t_shares.id
JOIN ClassicVault vault ON classic.vault = vault.id
JOIN Transaction tx ON vault.createdWith = tx.id
ORDER BY timestamp DESC
```

### Position Snapshot

Snapshot of the pool users.

| Property                    | Description                                                                                                       | Type   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| timestamp                   | The timestamp of the snapshot.                                                                                    | number |
| block_date                  | The timestamp truncated (ie, YYYY-MM-DD format for daily snapshots and YYYY-MM-DD HH:00:00 for hourly snapshots). | date   |
| chain_id                    | The standard chain id.                                                                                            | number |
| pool_address                | The address of the pool this user has a position in.                                                              | string |
| user_address                | The address of the user who has a position in the pool.                                                           | string |
| underlying_token_address    | The address of the supplied underlying token.                                                                     | string |
| underlying_token_index      | The index in the smart contract of this underlying token, default 0.                                              | number |
| underlying_token_amount     | The amount of the underlying token that the user deposited, decimal normalized.                                   | number |
| underlying_token_amount_usd | The amount of underlying tokens supplied, in USD.                                                                 | number |
| total_fees_usd              | The total amount of revenue and fees paid in this pool in the given snapshot, in USD.                             | number |

```SQL
WITH position_snapshots AS (
    SELECT
        snapshot.timestamp,
        fromUnixTimestamp(toInt64(snapshot.roundedTimestamp)) as block_date,
        42161 as chain_id,
        classic.id as pool_address,
        snapshot.investor as user_address,
        classic.underlyingToken as underlying_token_address,
        0 as underlying_token_index,
        -- Calculate underlying token amount using share ratio
        (toDecimal256(snapshot.vaultBalance, 18) / pow(10, t_underlying.decimals)) *
        (toDecimal256(classic.vaultUnderlyingTotalSupply, 18) / toDecimal256(classic.vaultSharesTotalSupply, 18))
        as underlying_token_amount,
        -- Calculate USD value
        (
            (toDecimal256(snapshot.vaultBalance, 18) / pow(10, t_underlying.decimals)) *
            (toDecimal256(classic.vaultUnderlyingTotalSupply, 18) / toDecimal256(classic.vaultSharesTotalSupply, 18))
        ) *
        (toDecimal256(snapshot.underlyingToNativePrice, 18) / pow(10, 18)) *
        (toDecimal256(snapshot.nativeToUSDPrice, 18) / pow(10, 18))
        as underlying_token_amount_usd,
        0 as total_fees_usd
    FROM ClassicPositionSnapshot snapshot
    JOIN Classic classic ON snapshot.classic = classic.id
    JOIN Token t_underlying ON classic.underlyingToken = t_underlying.id
)
SELECT * FROM position_snapshots
ORDER BY timestamp DESC, pool_address, user_address
```

### Pool Snapshot

TVL, fees, and incentives data at the pool level.

| Property                    | Description                                                                                                       | Type   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| timestamp                   | The timestamp of the snapshot.                                                                                    | number |
| block_date                  | The timestamp truncated (ie, YYYY-MM-DD format for daily snapshots and YYYY-MM-DD HH:00:00 for hourly snapshots). | date   |
| chain_id                    | The standard chain id.                                                                                            | number |
| underlying_token_address    | The contract address of the underlying token or deposited token.                                                  | string |
| underlying_token_index      | The index of the underlying token in the smart contract, default 0.                                               | number |
| pool_address                | The address of the pool.                                                                                          | string |
| underlying_token_amount     | The amount of underlying token supplied in this pool, decimal normalized.                                         | number |
| underlying_token_amount_usd | The amount of underlying tokens supplied in this pool, in USD.                                                    | number |
| total_fees_usd              | The total amount of revenue and fees paid in this pool in the given snapshot, in USD.                             | number |

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
| taker_address            | The address that owns the position (ie, most of the time, it is the same as the user_address). | string |
| pool_address             | The smart contract address of the pool.                                                        | string |
| underlying_token_address | The contract address of the underlying token or deposited token.                               | string |
| amount                   | The amount of token transacted, decimal normalized.                                            | number |
| amount_usd               | The amount of token transacted, in USD.                                                        | number |
| event_type               | The type of event, corresponds to the action taken by the user (ie, deposit, withdrawal).      | string |

```SQL
WITH events AS (
    SELECT
        i.timestamp,
        i.blockNumber as block_number,
        i.logIndex as log_index,
        i.createdWith as transaction_hash,
        tx.sender as user_address,
        i.investor as taker_address,
        classic.id as pool_address,
        classic.underlyingToken as underlying_token_address,
        -- Calculate amount using share ratio
        (toDecimal256(i.vaultBalanceDelta, 18) / pow(10, t_underlying.decimals)) *
        (toDecimal256(classic.vaultUnderlyingTotalSupply, 18) / toDecimal256(classic.vaultSharesTotalSupply, 18))
        as amount,
        -- Calculate USD value
        (
            (toDecimal256(i.vaultBalanceDelta, 18) / pow(10, t_underlying.decimals)) *
            (toDecimal256(classic.vaultUnderlyingTotalSupply, 18) / toDecimal256(classic.vaultSharesTotalSupply, 18))
        ) *
        (toDecimal256(i.underlyingToNativePrice, 18) / pow(10, 18)) *
        (toDecimal256(i.nativeToUSDPrice, 18) / pow(10, 18))
        as amount_usd,
        -- Map event types
        CASE
            WHEN i.type__ = 'VAULT_DEPOSIT' THEN 'deposit'
            WHEN i.type__ = 'VAULT_WITHDRAW' THEN 'withdraw'
            ELSE 'unknown'
        END as event_type
    FROM ClassicPositionInteraction i
    JOIN Classic classic ON i.classic = classic.id
    JOIN Token t_underlying ON classic.underlyingToken = t_underlying.id
    JOIN Transaction tx ON i.createdWith = tx.id
    WHERE i.type__ IN ('VAULT_DEPOSIT', 'VAULT_WITHDRAW')
)
SELECT
    timestamp,
    42161 as chain_id,
    block_number,
    log_index,
    transaction_hash,
    user_address,
    taker_address,
    pool_address,
    underlying_token_address,
    amount,
    amount_usd,
    event_type
FROM events
ORDER BY timestamp DESC, log_index ASC
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
WITH reward_claims AS (
    -- Classic Reward Pool Claims
    SELECT
        i.timestamp,
        42161 as chain_id,
        i.createdWith as transaction_hash,
        i.logIndex as log_index,
        tx.sender as transaction_signer,
        i.investor as user_address,
        arrayJoin(JSONExtract(classic.rewardTokensOrder, 'Array(String)')) as claimed_token_address,
        -- Calculate claimed amount
        toDecimal256(
            arrayJoin(JSONExtract(i.rewardBalancesDelta, 'Array(String)')),
            18
        ) / pow(10, t_reward.decimals) as amount,
        -- Calculate USD value
        (
            toDecimal256(
                arrayJoin(JSONExtract(i.rewardBalancesDelta, 'Array(String)')),
                18
            ) / pow(10, t_reward.decimals)
        ) *
        (
            toDecimal256(
                arrayJoin(JSONExtract(i.rewardToNativePrices, 'Array(String)')),
                18
            ) / pow(10, 18)
        ) *
        (toDecimal256(i.nativeToUSDPrice, 18) / pow(10, 18)) as amount_usd,
        0 as other_incentive_usd
    FROM ClassicPositionInteraction i
    JOIN Classic classic ON i.classic = classic.id
    JOIN Token t_reward ON t_reward.id = arrayJoin(JSONExtract(classic.rewardTokensOrder, 'Array(String)'))
    JOIN Transaction tx ON i.createdWith = tx.id
    WHERE i.type__ IN ('CLASSIC_REWARD_POOL_CLAIM', 'BOOST_REWARD_CLAIM')
)
SELECT * FROM reward_claims
ORDER BY timestamp DESC, log_index ASC
```