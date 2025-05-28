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
with whitelisted_tokens as (
    SELECT [
        '0xe5da20f15420ad15de0fa650600afc998bbe3955',
        '0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38',
        '0xd3dce716f3ef535c5ff8d041c1a41c3bd89b97ae',
        '0x3bce5cb273f0f148010bbea2470e7b5df84c7812',
        '0x4d85ba8c3918359c78ed09581e5bc7578ba932ba',
        '0x9fb76f7ce5fceaa2c42887ff441d46095e494206',
        '0x455d5f11fea33a8fa9d3e285930b478b6bf85265',
        '0x0c4e186eae8acaa7f7de1315d5ad174be39ec987',
        '0xfa85fe5a8f5560e9039c04f2b0a90de1415abd70',
        '0xb1e25689d55734fd3fffc939c4c3eb52dff8a794',
        '0x9f0df7799f6fdad409300080cff680f5a23df4b1',
        '0xe8a41c62bb4d5863c6eadc96792cfe90a1f37c47',
        '0x29219dd400f2bf60e5a23d13be72b486d4038894',
        '0x6047828dc181963ba44974801ff68e538da5eaf9',
        '0xbb30e76d9bb2cc9631f7fc5eb8e87b5aff32bfbd',
        '0xd0851030c94433c261b405fecbf1dec5e15948d0',
        '0x0000000000000000000000000000000000000000',
        '0x50c42deacd8fc9773493ed674b675be577f2634b',
        '0x3333111a391cc08fa51353e9195526a70b333333',
        '0xdb58c4db1a0f45dda3d2f8e44c3300bb6510c866',
        '0x578ee1ca3a8e1b54554da1bf7c583506c4cd11c6',
        '0x322e1d5384aa4ed66aeca770b95686271de61dc3',
        '0x871a101dcf22fe4fe37be7b654098c801cba1c88',
        '0x2d0e0814e62d80056181f5cd932274405966e4f0',
        '0x3333b97138d4b086720b5ae8a7844b1345a33333',
        '0x0555e30da8f98308edb960aa94c0db47230d2b9c'
    ] as token_addresses
),
breakdown_tokens as (
    SELECT
        classic.id as classic_id,
        token_address,
        token_index
    FROM Classic classic
    ARRAY JOIN
        classic.underlyingBreakdownTokensOrder as token_address,
        arrayMap((x, i) -> i, classic.underlyingBreakdownTokensOrder, range(length(classic.underlyingBreakdownTokensOrder))) as token_index
    WHERE hasAll((SELECT token_addresses FROM whitelisted_tokens), classic.underlyingBreakdownTokensOrder)
),
data_res as (
    SELECT
        146 as chain_id,
        tx.blockTimestamp as timestamp,
        tx.blockNumber as creation_block_number,

        bt.token_address as underlying_token_address,
        bt.token_index as underlying_token_index,
        t_breakdown.symbol as underlying_token_symbol,
        t_breakdown.decimals as underlying_token_decimals,

        classic.vaultSharesToken as receipt_token_address,
        t_shares.symbol as receipt_token_symbol,
        t_shares.decimals as receipt_token_decimals,

        classic.id as pool_address,
        t_shares.symbol as pool_symbol
    FROM Classic classic
    JOIN breakdown_tokens bt ON classic.id = bt.classic_id
    JOIN Token t_breakdown ON bt.token_address = t_breakdown.id
    JOIN Token t_shares ON classic.vaultSharesToken = t_shares.id
    JOIN ClassicVault vault ON classic.vault = vault.id
    JOIN Transaction tx ON vault.createdWith = tx.id
    ORDER BY timestamp DESC
)
select *
from data_res
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
with whitelisted_tokens as (
    SELECT [
        '0xe5da20f15420ad15de0fa650600afc998bbe3955',
        '0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38',
        '0xd3dce716f3ef535c5ff8d041c1a41c3bd89b97ae',
        '0x3bce5cb273f0f148010bbea2470e7b5df84c7812',
        '0x4d85ba8c3918359c78ed09581e5bc7578ba932ba',
        '0x9fb76f7ce5fceaa2c42887ff441d46095e494206',
        '0x455d5f11fea33a8fa9d3e285930b478b6bf85265',
        '0x0c4e186eae8acaa7f7de1315d5ad174be39ec987',
        '0xfa85fe5a8f5560e9039c04f2b0a90de1415abd70',
        '0xb1e25689d55734fd3fffc939c4c3eb52dff8a794',
        '0x9f0df7799f6fdad409300080cff680f5a23df4b1',
        '0xe8a41c62bb4d5863c6eadc96792cfe90a1f37c47',
        '0x29219dd400f2bf60e5a23d13be72b486d4038894',
        '0x6047828dc181963ba44974801ff68e538da5eaf9',
        '0xbb30e76d9bb2cc9631f7fc5eb8e87b5aff32bfbd',
        '0xd0851030c94433c261b405fecbf1dec5e15948d0',
        '0x0000000000000000000000000000000000000000',
        '0x50c42deacd8fc9773493ed674b675be577f2634b',
        '0x3333111a391cc08fa51353e9195526a70b333333',
        '0xdb58c4db1a0f45dda3d2f8e44c3300bb6510c866',
        '0x578ee1ca3a8e1b54554da1bf7c583506c4cd11c6',
        '0x322e1d5384aa4ed66aeca770b95686271de61dc3',
        '0x871a101dcf22fe4fe37be7b654098c801cba1c88',
        '0x2d0e0814e62d80056181f5cd932274405966e4f0',
        '0x3333b97138d4b086720b5ae8a7844b1345a33333',
        '0x0555e30da8f98308edb960aa94c0db47230d2b9c'
    ] as token_addresses
),
breakdown_tokens as (
    SELECT
        classic.id as classic_id,
        token_address,
        token_index
    FROM Classic classic
    ARRAY JOIN
        classic.underlyingBreakdownTokensOrder as token_address,
        arrayMap((x, i) -> i, classic.underlyingBreakdownTokensOrder, range(length(classic.underlyingBreakdownTokensOrder))) as token_index
    WHERE hasAll((SELECT token_addresses FROM whitelisted_tokens), classic.underlyingBreakdownTokensOrder)
),
data_res AS (
    SELECT
        snapshot.timestamp,
        formatDateTime(toDate(fromUnixTimestamp(toInt64(snapshot.roundedTimestamp))), '%Y-%m-%d') as block_date,
        146 as chain_id,
        classic.id as pool_address,
        snapshot.investor as user_address,
        bt.token_address as underlying_token_address,
        bt.token_index as underlying_token_index,
        (
            toDecimal256(snapshot.totalBalance, 18) / pow(10, t_share.decimals)
        ) * (
            (
                toDecimal256(snapshot.vaultUnderlyingBreakdownBalances[bt.token_index + 1], 18) / pow(10, t_breakdown.decimals)
            )
            /
            (
                toDecimal256(snapshot.vaultSharesTotalSupply, 18) / pow(10, t_share.decimals)
            )
        ) as underlying_token_amount,

        (
            toDecimal256(snapshot.totalBalance, 18) / pow(10, t_share.decimals)
        ) * (
            (
                toDecimal256(snapshot.vaultUnderlyingBreakdownBalances[bt.token_index + 1], 18) / pow(10, t_breakdown.decimals)
            )
            /
            (
                toDecimal256(snapshot.vaultSharesTotalSupply, 18) / pow(10, t_share.decimals)
            )
        ) * (
            toDecimal256(snapshot.underlyingBreakdownToNativePrices[bt.token_index + 1], 18) / pow(10, 18)
        ) * (
            toDecimal256(snapshot.nativeToUSDPrice, 18) / pow(10, 18)
        ) as underlying_token_amount_usd,

        0 as total_fees_usd
    FROM ClassicPositionSnapshot snapshot
    JOIN Classic classic ON snapshot.classic = classic.id
    JOIN breakdown_tokens bt ON classic.id = bt.classic_id
    JOIN Token t_breakdown ON bt.token_address = t_breakdown.id
    JOIN Token t_share ON classic.vaultSharesToken = t_share.id
    WHERE snapshot.period = 86400
    and snapshot.investor not in ('0x03c2e2e84031d913d45b1f5b5ddc8e50fcb28652')
)
select *
from data_res
where timestamp > timestamp('${timestamp}')
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

```SQL
with whitelisted_tokens as (
    SELECT [
        '0xe5da20f15420ad15de0fa650600afc998bbe3955',
        '0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38',
        '0xd3dce716f3ef535c5ff8d041c1a41c3bd89b97ae',
        '0x3bce5cb273f0f148010bbea2470e7b5df84c7812',
        '0x4d85ba8c3918359c78ed09581e5bc7578ba932ba',
        '0x9fb76f7ce5fceaa2c42887ff441d46095e494206',
        '0x455d5f11fea33a8fa9d3e285930b478b6bf85265',
        '0x0c4e186eae8acaa7f7de1315d5ad174be39ec987',
        '0xfa85fe5a8f5560e9039c04f2b0a90de1415abd70',
        '0xb1e25689d55734fd3fffc939c4c3eb52dff8a794',
        '0x9f0df7799f6fdad409300080cff680f5a23df4b1',
        '0xe8a41c62bb4d5863c6eadc96792cfe90a1f37c47',
        '0x29219dd400f2bf60e5a23d13be72b486d4038894',
        '0x6047828dc181963ba44974801ff68e538da5eaf9',
        '0xbb30e76d9bb2cc9631f7fc5eb8e87b5aff32bfbd',
        '0xd0851030c94433c261b405fecbf1dec5e15948d0',
        '0x0000000000000000000000000000000000000000',
        '0x50c42deacd8fc9773493ed674b675be577f2634b',
        '0x3333111a391cc08fa51353e9195526a70b333333',
        '0xdb58c4db1a0f45dda3d2f8e44c3300bb6510c866',
        '0x578ee1ca3a8e1b54554da1bf7c583506c4cd11c6',
        '0x322e1d5384aa4ed66aeca770b95686271de61dc3',
        '0x871a101dcf22fe4fe37be7b654098c801cba1c88',
        '0x2d0e0814e62d80056181f5cd932274405966e4f0',
        '0x3333b97138d4b086720b5ae8a7844b1345a33333',
        '0x0555e30da8f98308edb960aa94c0db47230d2b9c'
    ] as token_addresses
),
breakdown_tokens as (
    SELECT
        classic.id as classic_id,
        token_address,
        token_index
    FROM Classic classic
    ARRAY JOIN
        classic.underlyingBreakdownTokensOrder as token_address,
        arrayMap((x, i) -> i, classic.underlyingBreakdownTokensOrder, range(length(classic.underlyingBreakdownTokensOrder))) as token_index
    WHERE hasAll((SELECT token_addresses FROM whitelisted_tokens), classic.underlyingBreakdownTokensOrder)
),
data_res AS (
    SELECT
        snapshot.timestamp,
        formatDateTime(toDate(fromUnixTimestamp(toInt64(snapshot.roundedTimestamp))), '%Y-%m-%d') as block_date,
        146 as chain_id,
        bt.token_address as underlying_token_address,
        bt.token_index as underlying_token_index,
        classic.id as pool_address,
        (
            toDecimal256(snapshot.vaultUnderlyingBreakdownBalances[bt.token_index + 1], 18) / pow(10, t_breakdown.decimals)
        ) as underlying_token_amount,

        (
            toDecimal256(snapshot.vaultUnderlyingBreakdownBalances[bt.token_index + 1], 18) / pow(10, t_breakdown.decimals)
        ) * (
            toDecimal256(snapshot.underlyingBreakdownToNativePrices[bt.token_index + 1], 18) / pow(10, 18)
        ) * (
            toDecimal256(snapshot.nativeToUSDPrice, 18) / pow(10, 18)
        ) as underlying_token_amount_usd,

        (
            toDecimal256(snapshot.totalCallFees + snapshot.totalBeefyFees + snapshot.totalStrategistFees, 18) / pow(10, 18)
        ) * (
            toDecimal256(snapshot.nativeToUSDPrice, 18) / pow(10, 18)
        ) as total_fees_usd
    FROM ClassicSnapshot snapshot
    JOIN Classic classic ON snapshot.classic = classic.id
    JOIN breakdown_tokens bt ON classic.id = bt.classic_id
    JOIN Token t_breakdown ON bt.token_address = t_breakdown.id
    WHERE snapshot.period = 86400
)
select *
from data_res
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
| taker_address            | The address that owns the position (ie, most of the time, it is the same as the user_address). | string |
| pool_address             | The smart contract address of the pool.                                                        | string |
| underlying_token_address | The contract address of the underlying token or deposited token.                               | string |
| amount                   | The amount of token transacted, decimal normalized.                                            | number |
| amount_usd               | The amount of token transacted, in USD.                                                        | number |
| event_type               | The type of event, corresponds to the action taken by the user (ie, deposit, withdrawal).      | string |

```SQL

with whitelisted_tokens as (
    SELECT [
        '0xe5da20f15420ad15de0fa650600afc998bbe3955',
        '0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38',
        '0xd3dce716f3ef535c5ff8d041c1a41c3bd89b97ae',
        '0x3bce5cb273f0f148010bbea2470e7b5df84c7812',
        '0x4d85ba8c3918359c78ed09581e5bc7578ba932ba',
        '0x9fb76f7ce5fceaa2c42887ff441d46095e494206',
        '0x455d5f11fea33a8fa9d3e285930b478b6bf85265',
        '0x0c4e186eae8acaa7f7de1315d5ad174be39ec987',
        '0xfa85fe5a8f5560e9039c04f2b0a90de1415abd70',
        '0xb1e25689d55734fd3fffc939c4c3eb52dff8a794',
        '0x9f0df7799f6fdad409300080cff680f5a23df4b1',
        '0xe8a41c62bb4d5863c6eadc96792cfe90a1f37c47',
        '0x29219dd400f2bf60e5a23d13be72b486d4038894',
        '0x6047828dc181963ba44974801ff68e538da5eaf9',
        '0xbb30e76d9bb2cc9631f7fc5eb8e87b5aff32bfbd',
        '0xd0851030c94433c261b405fecbf1dec5e15948d0',
        '0x0000000000000000000000000000000000000000',
        '0x50c42deacd8fc9773493ed674b675be577f2634b',
        '0x3333111a391cc08fa51353e9195526a70b333333',
        '0xdb58c4db1a0f45dda3d2f8e44c3300bb6510c866',
        '0x578ee1ca3a8e1b54554da1bf7c583506c4cd11c6',
        '0x322e1d5384aa4ed66aeca770b95686271de61dc3',
        '0x871a101dcf22fe4fe37be7b654098c801cba1c88',
        '0x2d0e0814e62d80056181f5cd932274405966e4f0',
        '0x3333b97138d4b086720b5ae8a7844b1345a33333',
        '0x0555e30da8f98308edb960aa94c0db47230d2b9c'
    ] as token_addresses
),
breakdown_tokens as (
    SELECT
        classic.id as classic_id,
        token_address,
        token_index
    FROM Classic classic
    ARRAY JOIN
        classic.underlyingBreakdownTokensOrder as token_address,
        arrayMap((x, i) -> i, classic.underlyingBreakdownTokensOrder, range(length(classic.underlyingBreakdownTokensOrder))) as token_index
    WHERE hasAll((SELECT token_addresses FROM whitelisted_tokens), classic.underlyingBreakdownTokensOrder)
),
events AS (
    SELECT
        i.timestamp,
        i.blockNumber as block_number,
        i.logIndex as log_index,
        i.createdWith as transaction_hash,
        tx.sender as user_address,
        i.investor as taker_address,
        classic.id as pool_address,
        classic.underlyingToken as underlying_token_address,
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
            WHEN i.type__ = 'VAULT_DEPOSIT' THEN 'deposit'
            WHEN i.type__ = 'VAULT_WITHDRAW' THEN 'withdraw'
            WHEN i.type__ = 'CLASSIC_ERC4626_ADAPTER_STAKE' THEN 'deposit'
            WHEN i.type__ = 'CLASSIC_ERC4626_ADAPTER_UNSTAKE' THEN 'withdraw'
            ELSE 'unknown'
        END as event_type
    FROM ClassicPositionInteraction i
    JOIN Classic classic ON i.classic = classic.id
    JOIN Token t_share ON classic.vaultSharesToken = t_share.id
    JOIN Token t_underlying ON classic.underlyingToken = t_underlying.id
    JOIN Transaction tx ON i.createdWith = tx.id
    WHERE i.type__ IN ('VAULT_DEPOSIT', 'VAULT_WITHDRAW', 'CLASSIC_ERC4626_ADAPTER_STAKE', 'CLASSIC_ERC4626_ADAPTER_UNSTAKE')
      and i.investor not in ('0x03c2e2e84031d913d45b1f5b5ddc8e50fcb28652')
      and tx.sender not in ('0x03c2e2e84031d913d45b1f5b5ddc8e50fcb28652')
      and classic.id in (SELECT classic_id FROM breakdown_tokens)
),
data_res as (
    SELECT
        timestamp,
        146 as chain_id,
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
)
select *
from data_res
where timestamp > timestamp('${timestamp}')
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
with whitelisted_tokens as (
    SELECT [
        '0xe5da20f15420ad15de0fa650600afc998bbe3955',
        '0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38',
        '0xd3dce716f3ef535c5ff8d041c1a41c3bd89b97ae',
        '0x3bce5cb273f0f148010bbea2470e7b5df84c7812',
        '0x4d85ba8c3918359c78ed09581e5bc7578ba932ba',
        '0x9fb76f7ce5fceaa2c42887ff441d46095e494206',
        '0x455d5f11fea33a8fa9d3e285930b478b6bf85265',
        '0x0c4e186eae8acaa7f7de1315d5ad174be39ec987',
        '0xfa85fe5a8f5560e9039c04f2b0a90de1415abd70',
        '0xb1e25689d55734fd3fffc939c4c3eb52dff8a794',
        '0x9f0df7799f6fdad409300080cff680f5a23df4b1',
        '0xe8a41c62bb4d5863c6eadc96792cfe90a1f37c47',
        '0x29219dd400f2bf60e5a23d13be72b486d4038894',
        '0x6047828dc181963ba44974801ff68e538da5eaf9',
        '0xbb30e76d9bb2cc9631f7fc5eb8e87b5aff32bfbd',
        '0xd0851030c94433c261b405fecbf1dec5e15948d0',
        '0x0000000000000000000000000000000000000000',
        '0x50c42deacd8fc9773493ed674b675be577f2634b',
        '0x3333111a391cc08fa51353e9195526a70b333333',
        '0xdb58c4db1a0f45dda3d2f8e44c3300bb6510c866',
        '0x578ee1ca3a8e1b54554da1bf7c583506c4cd11c6',
        '0x322e1d5384aa4ed66aeca770b95686271de61dc3',
        '0x871a101dcf22fe4fe37be7b654098c801cba1c88',
        '0x2d0e0814e62d80056181f5cd932274405966e4f0',
        '0x3333b97138d4b086720b5ae8a7844b1345a33333',
        '0x0555e30da8f98308edb960aa94c0db47230d2b9c'
    ] as token_addresses
),
breakdown_tokens as (
    SELECT
        classic.id as classic_id,
        token_address,
        token_index
    FROM Classic classic
    ARRAY JOIN
        classic.underlyingBreakdownTokensOrder as token_address,
        arrayMap((x, i) -> i, classic.underlyingBreakdownTokensOrder, range(length(classic.underlyingBreakdownTokensOrder))) as token_index
    WHERE hasAll((SELECT token_addresses FROM whitelisted_tokens), classic.underlyingBreakdownTokensOrder)
),
raw_arrays AS (
    SELECT
        i.timestamp,
        i.createdWith as transaction_hash,
        i.logIndex as log_index,
        tx.sender as transaction_signer,
        i.investor as user_address,
        i.nativeToUSDPrice as native_to_usd,
        arrayJoin(arrayZip(
            arraySlice(classic.rewardTokensOrder, 1, least(length(classic.rewardTokensOrder), length(i.rewardBalancesDelta), length(i.rewardToNativePrices))),
            arraySlice(i.rewardBalancesDelta, 1, least(length(classic.rewardTokensOrder), length(i.rewardBalancesDelta), length(i.rewardToNativePrices))),
            arraySlice(i.rewardToNativePrices, 1, least(length(classic.rewardTokensOrder), length(i.rewardBalancesDelta), length(i.rewardToNativePrices)))
        )) AS token_data
    FROM ClassicPositionInteraction i
    JOIN Classic classic ON i.classic = classic.id
    JOIN Transaction tx ON i.createdWith = tx.id
    WHERE i.type__ IN ('CLASSIC_REWARD_POOL_CLAIM', 'BOOST_REWARD_CLAIM')
      and i.investor not in ('0x03c2e2e84031d913d45b1f5b5ddc8e50fcb28652')
      and tx.sender not in ('0x03c2e2e84031d913d45b1f5b5ddc8e50fcb28652')
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
