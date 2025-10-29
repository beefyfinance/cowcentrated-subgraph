# Price monitoring

```sqlwith missing_prices as (
    select
        'classic 1' as t, classic.id as entity_id, null as snapshot_id
    from `Classic` classic
    where classic.vaultSharesTotalSupply > 0
    and length(classic.underlyingBreakdownTokensOrder) = 0

    union all

    select
        'classic 2' as t, classic.id, snapshot.id
        --classic.underlyingBreakdownTokensOrder ,
        --snapshot.underlyingBreakdownToNativePrices
    from `ClassicSnapshot` snapshot
    inner join `Classic` classic on snapshot.classic = classic.id
    where classic.vaultSharesTotalSupply > 0
    AND snapshot.period = 86400
    and has(snapshot.underlyingBreakdownToNativePrices, '0')
    -- bUSDC.e-20 prices are wrong, but OBL is using it's own price feed instead
    and indexOf(snapshot.underlyingBreakdownToNativePrices, '0') != indexOf(classic.underlyingBreakdownTokensOrder, lower('0x322e1d5384aa4ed66aeca770b95686271de61dc3'))
    -- oracle was down for a few minutes
    and snapshot.id <> '0x6c9f512c379120bcb0bbe89b8817e74d2bc061b0805101000067f467'
    -- oracle was added after 1 day
    and snapshot.id <> '0x306944e42a071f4e95d0a10daeffd53386252eea8051010080754768'
    -- oracle was added after 1 day
    and snapshot.id <> '0x0ad8162b686af063073eabbea9bc6fda2d8184a48051010000837d68'

    union all

    select
        'classic 3' as t, classic.id, snapshot.id
        --classic.boostRewardTokensOrder,
        --snapshot.boostRewardToNativePrices
    from `ClassicSnapshot` snapshot
    inner join `Classic` classic on snapshot.classic = classic.id
    where classic.vaultSharesTotalSupply > 0
    AND snapshot.period = 86400
    and has(snapshot.boostRewardToNativePrices, '0')

    union all

    select
        'classic 4' as t, classic.id, snapshot.id
        --classic.rewardTokensOrder,
        --snapshot.rewardToNativePrices
    from `ClassicSnapshot` snapshot
    inner join `Classic` classic on snapshot.classic = classic.id
    where classic.vaultSharesTotalSupply > 0
    AND snapshot.period = 86400
    and has(snapshot.rewardToNativePrices, '0')
    -- beGEMS1 doesn't have a price yet
    and indexOf(snapshot.rewardToNativePrices, '0') != indexOf(classic.rewardTokensOrder, lower('0xd70c020c48403295100884ee47db80d51baa9d87'))


    union all

    select
        'classic 5' as t, classic.id, snapshot.id
        --snapshot.nativeToUSDPrice
    from `ClassicSnapshot` snapshot
    inner join `Classic` classic on snapshot.classic = classic.id
    where classic.vaultSharesTotalSupply > 0
    AND snapshot.period = 86400
    and nativeToUSDPrice = '0'

    union all

    select
        'classic 6' as t, classic.id, snapshot.id
        --snapshot.underlyingToNativePrice
    from `ClassicSnapshot` snapshot
    inner join `Classic` classic on snapshot.classic = classic.id
    where classic.vaultSharesTotalSupply > 0
    AND snapshot.period = 86400
    and snapshot.underlyingToNativePrice = '0'
    and length(classic.underlyingBreakdownTokens) > 0
    -- oracle was added after 1 day
    and snapshot.id <> '0x306944e42a071f4e95d0a10daeffd53386252eea8051010080754768'
    -- oracle was added after 1 day
    and snapshot.id <> '0xdb6e5dc4c6748ececb97b565f6c074f24384fd078051010000837d68'
    -- vault was eoled and oracle has been removed, we have data for live user positions
    and classic.id not in (
        '0x392ea759ad696004e5a8f1ece45cac99fac45f4f',
        '0x24c8d7dc7d1d2dc0e6f6ae97345c04450a174782'
    )

    union all

    select
        'clm 1' as t, clm.id, snapshot.id
        --snapshot.rewardToNativePrices
    from `ClmSnapshot` snapshot
    inner join `CLM` clm on snapshot.clm = clm.id
    where clm.managerTotalSupply > 0
    AND snapshot.period = 86400
    and has(snapshot.rewardToNativePrices, '0')

    union all

    select
        'clm 2' as t, clm.id, snapshot.id
        --snapshot.outputToNativePrices
    from `ClmSnapshot` snapshot
    inner join `CLM` clm on snapshot.clm = clm.id
    where clm.managerTotalSupply > 0
    AND snapshot.period = 86400
    and has(snapshot.outputToNativePrices, '0')

    union all

    select
        'clm 3' as t, clm.id, snapshot.id
        --snapshot.token0ToNativePrice
    from `ClmSnapshot` snapshot
    inner join `CLM` clm on snapshot.clm = clm.id
    where clm.managerTotalSupply > 0
    AND snapshot.period = 86400
    and snapshot.token0ToNativePrice = 0

    union all

    select
       'clm 4' as t, clm.id, snapshot.id
        --snapshot.token1ToNativePrice
    from `ClmSnapshot` snapshot
    inner join `CLM` clm on snapshot.clm = clm.id
    where clm.managerTotalSupply > 0
    AND snapshot.period = 86400
    and snapshot.token1ToNativePrice = 0

    union all

    select
        'clm 5' as t, clm.id, snapshot.id
        --snapshot.nativeToUSDPrice
    from `ClmSnapshot` snapshot
    inner join `CLM` clm on snapshot.clm = clm.id
    where clm.managerTotalSupply > 0
    AND snapshot.period = 86400
    and snapshot.nativeToUSDPrice = 0
)
select *
from missing_prices
limit ${limit}
```
