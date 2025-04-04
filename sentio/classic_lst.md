# Liquid Staking Tokens (LSTs)

Standard table definitions for LSTs (liquid staking tokens)

## Version: 1.0.0-alpha

### Position Snapshot

User level snapshot of holders in this protocol.

| Property      | Description                                                                                                       | Type      |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| timestamp     | The timestamp of the snapshot.                                                                                    | timestamp |
| block_date    | The timestamp truncated (ie, YYYY-MM-DD format for daily snapshots and YYYY-MM-DD HH:00:00 for hourly snapshots). | date      |
| chain_id      | Standard chain ID.                                                                                                | int       |
| token_address | The contract address of the LST token.                                                                            | string    |
| token_symbol  | The symbol of the token.                                                                                          | string    |
| user_address  | The address of the user holding the LST.                                                                          | string    |
| amount        | The amount of LST tokens held in the protocol, decimal normalized.                                                | double    |
| amount_usd    | The amount held in USD.                                                                                           | double    |

```SQL
WITH data_res AS (
    SELECT
        snapshot.timestamp,
        formatDateTime(toDate(fromUnixTimestamp(toInt64(snapshot.roundedTimestamp))), '%Y-%m-%d') as block_date,
        146 as chain_id,
        t_share.id as token_address,
        t_share.symbol as token_symbol,
        snapshot.investor as user_address,
        (
            toDecimal256(snapshot.totalBalance, 18) / pow(10, t_share.decimals)
        ) * (
            (
                toDecimal256 (snapshot.vaultUnderlyingBalance, 18) / pow(10, t_underlying.decimals)
            )
            /
            (
                toDecimal256 (snapshot.vaultSharesTotalSupply, 18) / pow(10, t_share.decimals)
            )
        ) as amount,

        (
            toDecimal256(snapshot.totalBalance, 18) / pow(10, t_share.decimals)
        ) * (
            (
                toDecimal256 (snapshot.vaultUnderlyingBalance, 18) / pow(10, t_underlying.decimals)
            )
            /
            (
                toDecimal256 (snapshot.vaultSharesTotalSupply, 18) / pow(10, t_share.decimals)
            )
        ) * (
            toDecimal256 (snapshot.underlyingToNativePrice, 18) / pow(10, 18)
        ) * (
            toDecimal256 (snapshot.nativeToUSDPrice, 18) / pow(10, 18)
        ) as amount_usd
    FROM ClassicPositionSnapshot snapshot
    JOIN Classic classic ON snapshot.classic = classic.id
    JOIN Token t_share ON classic.vaultSharesToken = t_share.id
    JOIN Token t_underlying ON classic.underlyingToken = t_underlying.id
    WHERE snapshot.period = 86400
        AND classic.id = '0x871a101dcf22fe4fe37be7b654098c801cba1c88'
)
select *
from data_res
where timestamp > timestamp('${timestamp}')
```

### Protocol Snapshot

Snapshot at the protocol level, including, TVL and fees data.

| Property               | Description                                                                                                       | Type      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- | --------- |
| timestamp              | The timestamp of the snapshot.                                                                                    | timestamp |
| block_date             | The timestamp truncated (ie, YYYY-MM-DD format for daily snapshots and YYYY-MM-DD HH:00:00 for hourly snapshots). | date      |
| chain_id               | Standard chain ID.                                                                                                | int       |
| total_value_locked_usd | The total value locked in USD (ie, the value of the liquid staking tokens in the protocol).                       | double    |
| fees_usd               | The fees collected in USD in the given snapshot period.                                                           | double    |

```SQL

WITH data_res AS (
    SELECT
        snapshot.roundedTimestamp as timestamp,
        formatDateTime(toDate(fromUnixTimestamp(toInt64(snapshot.roundedTimestamp))), '%Y-%m-%d') as block_date,
        146 as chain_id,
        sum(
            (
            toDecimal256 (snapshot.underlyingAmount, 18) / pow(10, t_underlying.decimals)
            ) * (
                toDecimal256 (snapshot.underlyingToNativePrice, 18) / pow(10, 18)
            ) * (
                toDecimal256 (snapshot.nativeToUSDPrice, 18) / pow(10, 18)
            )
        ) as total_value_locked_usd,
        0 as fees_usd
    FROM ClassicSnapshot snapshot
    JOIN Classic classic ON snapshot.classic = classic.id
    JOIN Token t_underlying ON classic.underlyingToken = t_underlying.id
    WHERE snapshot.period = 86400
        AND classic.id = '0x871a101dcf22fe4fe37be7b654098c801cba1c88'
    GROUP BY snapshot.roundedTimestamp
)
select *
from data_res
where timestamp > timestamp('${timestamp}')
```

### Events

All user events (ie, Mint, Burn, Transfer)

| Property         | Description                                                                                    | Type      |
| ---------------- | ---------------------------------------------------------------------------------------------- | --------- |
| timestamp        | The timestamp of the transaction.                                                              | timestamp |
| chain_id         | The standard id of the chain.                                                                  | int       |
| block_number     | The block number of the trade.                                                                 | bigint    |
| log_index        | The event log. For transactions that don't emit event, create arbitrary index starting from 0. | number    |
| transaction_hash | The hash of the transaction.                                                                   | string    |
| user_address     | The address that initiates the transaction (ie, the transaction signer).                       | string    |
| from_address     | The address that the event is from (ie, 0x00... address if a Mint).                            | string    |
| to_address       | The address receiving the tokens (ie, the 0x000... address if a Burn).                         | string    |
| token_address    | The contract address of the LST token.                                                         | string    |
| amount           | The amount of token_address transacted, decimal normalized.                                    | double    |
| amount_usd       | The amount of token_address transacted, in USD.                                                | double    |
| event_type       | The type of event, corresponds to the action taken by the user (ie, mint, burn, transfer).     | string    |

```SQL
WITH events AS (
    SELECT
        i.timestamp,
        i.blockNumber as block_number,
        i.logIndex as log_index,
        i.createdWith as transaction_hash,
        tx.sender as user_address,
        case when i.type__ = 'VAULT_DEPOSIT' then '0x0000000000000000000000000000000000000000' else i.investor end as from_address,
        case when i.type__ = 'VAULT_WITHDRAW' then '0x0000000000000000000000000000000000000000' else i.investor end as to_address,
        classic.vaultSharesToken as token_address,
        abs(toDecimal256(i.vaultBalanceDelta, 18) / pow(10, t_share.decimals)) +
        abs(toDecimal256(i.boostBalanceDelta, 18) / pow(10, t_share.decimals)) +
        (arraySum(arrayMap((x) -> toDecimal256(x, 18), i.rewardPoolBalancesDelta)) / pow(10, t_share.decimals)) +
        (arraySum(arrayMap((x) -> toDecimal256(x, 18), i.erc4626AdapterVaultSharesBalancesDelta)) / pow(10, t_share.decimals))
        as amount,
        (
            abs(toDecimal256(i.vaultBalanceDelta, 18) / pow(10, t_share.decimals)) +
            abs(toDecimal256(i.boostBalanceDelta, 18) / pow(10, t_share.decimals)) +
            (arraySum(arrayMap((x) -> toDecimal256(x, 18), i.rewardPoolBalancesDelta)) / pow(10, t_share.decimals)) +
            (arraySum(arrayMap((x) -> toDecimal256(x, 18), i.erc4626AdapterVaultSharesBalancesDelta)) / pow(10, t_share.decimals))
        ) * (
            (toDecimal256(i.vaultUnderlyingBalance, 18) / pow(10, t_underlying.decimals))
            / (toDecimal256(i.vaultSharesTotalSupply, 18) / pow(10, t_share.decimals))
        ) *
        (toDecimal256(i.underlyingToNativePrice, 18) / pow(10, 18)) *
        (toDecimal256(i.nativeToUSDPrice, 18) / pow(10, 18))
        as amount_usd,
        CASE
            WHEN i.type__ = 'VAULT_DEPOSIT' THEN 'mint'
            WHEN i.type__ = 'VAULT_WITHDRAW' THEN 'burn'
            ELSE 'unknown'
        END as event_type
    FROM ClassicPositionInteraction i
    JOIN Classic classic ON i.classic = classic.id
    JOIN Token t_share ON classic.vaultSharesToken = t_share.id
    JOIN Token t_underlying ON classic.underlyingToken = t_underlying.id
    JOIN Transaction tx ON i.createdWith = tx.id
    WHERE i.type__ IN ('VAULT_DEPOSIT', 'VAULT_WITHDRAW')
        and classic.id = '0x871a101dcf22fe4fe37be7b654098c801cba1c88'
),
data_res as (
    SELECT
        timestamp,
        146 as chain_id,
        block_number,
        log_index,
        transaction_hash,
        user_address,
        from_address,
        to_address,
        token_address,
        amount,
        amount_usd,
        event_type
    FROM events
    ORDER BY timestamp DESC, log_index ASC
)
select *
from data_res
where timestamp > timestamp('${timestamp}')
```

### Incentive Claim Data

Transactional data on user level incentives claimed data.

| Property              | Description                                                                                          | Type      |
| --------------------- | ---------------------------------------------------------------------------------------------------- | --------- |
| timestamp             | The timestamp of the claim.                                                                          | timestamp |
| chain_id              | The standard chain id.                                                                               | int       |
| transaction_hash      | The hash of the transaction.                                                                         | string    |
| log_index             | The event log. For transactions that don't emit event, create arbitrary index starting from 0.       | bigint    |
| transaction_signer    | The address of the account that signed the transaction.                                              | string    |
| user_address          | The address of the user who claimed the incentives (could be different from the transaction_signer). | string    |
| claimed_token_address | The smart contract address of the claimed token.                                                     | string    |
| amount                | The amount of the token claimed, decimal normalized.                                                 | double    |
| amount_usd            | The amount of claimed tokens in USD.                                                                 | double    |
| other_incentive_usd   | (Optional) Any incentives outside of the claimed token, in this transaction, summed up in USD terms. | double    |

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
        arrayJoin(arrayZip(classic.rewardTokensOrder, i.rewardBalancesDelta, i.rewardToNativePrices)) AS token_data
    FROM ClassicPositionInteraction i
    JOIN Classic classic ON i.classic = classic.id
    JOIN Transaction tx ON i.createdWith = tx.id
    WHERE i.type__ IN ('CLASSIC_REWARD_POOL_CLAIM', 'BOOST_REWARD_CLAIM')
        and classic.id = '0x871a101dcf22fe4fe37be7b654098c801cba1c88'
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
where timestamp > timestamp('${timestamp}')
```
