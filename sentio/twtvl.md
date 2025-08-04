# Time-Weighted TVL (TWTVL) Calculation

This query calculates time-weighted TVL metrics for each user, where 1 TWTVL is awarded for each $1 held for 1 second.

## Overview

This query uses `ClassicPositionSnapshot` hourly data to calculate accurate time-weighted TVL for all users, including long-term holders who don't frequently interact with vaults. The approach leverages pre-computed position snapshots that contain both user balances and current market pricing, eliminating the need for complex joins while ensuring complete position tracking.

### Key Features:

- **Long-term Holder Support**: Properly credits users who hold positions for extended periods without interactions using hourly position snapshots
- **Efficient Architecture**: Uses `ClassicPositionSnapshot` which contains both user balances and pricing data in a single table, eliminating complex LATERAL JOINs
- **Current Market Pricing**: Positions are valued using up-to-date pricing included in each position snapshot rather than stale interaction data
- **Complete Position Tracking**: Includes all user position snapshots, including when balances are zero (exits/reductions) to capture the full user journey
- **Hourly Precision**: Each snapshot represents 3600 seconds (1 hour) for maximum accuracy while maintaining good performance

### Technical Implementation:

- **Decimal Handling**: Uses `toDecimal256(value, 18)` for consistency with other Sentio queries
- **Address Formatting**: Uses `hex()` function to format addresses as strings
- **Token Decimals**: Properly handles token decimals by joining with Token table for accurate calculations
- **Standard Fields**: Includes tracking fields like `total_vault_hours`
- **Pricing Calculation**: Follows the standard pattern used across other queries:
  ```sql
  (amount / pow(10, token_decimals)) *
  (price_to_native / pow(10, 18)) *
  (native_to_usd / pow(10, 18))
  ```
- **Complete Data Coverage**: Includes all snapshots regardless of pricing data availability
- **Performance**: Simple single-table query with minimal joins for optimal performance

### Result Format:

- **TWTVL Values**: Denominated in "dollar-seconds" where 1 TWTVL = $1 held for 1 second
- **Code Consistency**: Follows Sentio SQL patterns for consistency with other protocol queries

## Classic TWTVL Query

Row count: 8404.

```sql
SELECT
    cps.investor,
    sum(
        coalesce(
            -- shares_balance
            (toDecimal256(cps.totalBalance, 18) / pow(10, 18 /* shares decimals */))
            -- usd_per_share
            * (
                (toDecimal256(cps.vaultUnderlyingBalance, 18) / pow(10, t_underlying.decimals)) *
                (toDecimal256(cps.underlyingToNativePrice, 18) / pow(10, 18)) *
                (toDecimal256(cps.nativeToUSDPrice, 18) / pow(10, 18)) /
                (toDecimal256(cps.vaultSharesTotalSupply, 18) / pow(10, 18 /* shares decimals */))
            )
        , 0)
        -- duration_seconds
        * 3600
     ) as total_twtvl,
     max(cps.roundedTimestamp) as max_rounded_timestamp
FROM ClassicPositionSnapshot cps
JOIN Classic classic ON cps.classic = classic.id
JOIN Token t_underlying ON classic.underlyingToken = t_underlying.id
WHERE cps.period = 3600  -- Use hourly snapshots (3600 seconds)
    AND cps.totalBalance > 0
    AND cps.vaultSharesTotalSupply > 0
GROUP BY investor
```

## Classic TWTVL Query

```sql
WITH latestView_ClassicPositionSnapshot AS (
    SELECT
        id,
        classic,
        investor,
        argMax(totalBalance, __genBlockNumber__) AS totalBalance,
        argMax(vaultSharesTotalSupply, __genBlockNumber__) AS vaultSharesTotalSupply,
        argMax(vaultUnderlyingBalance, __genBlockNumber__) AS vaultUnderlyingBalance,
        argMax(underlyingToNativePrice, __genBlockNumber__) AS underlyingToNativePrice,
        argMax(nativeToUSDPrice, __genBlockNumber__) AS nativeToUSDPrice
    FROM prod_subgraph.jT7kA9ye_view_ClassicPositionSnapshot
    WHERE
        __genBlockChain__ = '146'
        AND period = 3600
    GROUP BY id, classic,investor
)
SELECT
    cps.investor,
    sum(
        coalesce(CASE
            WHEN cps.classic IN (
                -- select distinct decimals from `Token` where id in (select underlyingToken from `Classic`)
                -- select id from `Classic` where underlyingToken IN (select id from `Token` where decimals <> 18)
                '0xc1e3ff64d95aea97c0bc15a6c3e2dee87a5cd2ea',
                '0x392ea759ad696004e5a8f1ece45cac99fac45f4f',
                '0x3eb55e7a434dca52a064276444c0fe8bf628aada',
                '0x0356485cbfc04e69daba736c29afe0b90393d521',
                '0xb2e53c9ff7858d7326e64c1bdb030dd8e1e37095',
                '0xeb3b876e3889bf55858fb9b359111bb5800d807b',
                '0x24c8d7dc7d1d2dc0e6f6ae97345c04450a174782',
                '0xdb6e5dc4c6748ececb97b565f6c074f24384fd07',
                '0x52b11a7d34b640d684660217653a0dfe728116f0'
            )
            THEN (toDecimal256(cps.totalBalance, 18) / pow(10, 18)) *
                 ((toDecimal256(cps.vaultUnderlyingBalance, 18) / pow(10, 6 /* underlying decimals */)) *
                  (toDecimal256(cps.underlyingToNativePrice, 18) / pow(10, 18)) *
                  (toDecimal256(cps.nativeToUSDPrice, 18) / pow(10, 18)) /
                  (toDecimal256(cps.vaultSharesTotalSupply, 18) / pow(10, 18))) * 3600
            ELSE (toDecimal256(cps.totalBalance, 18) / pow(10, 18)) *
                 ((toDecimal256(cps.vaultUnderlyingBalance, 18) / pow(10, 18 /* underlying decimals */)) *
                  (toDecimal256(cps.underlyingToNativePrice, 18) / pow(10, 18)) *
                  (toDecimal256(cps.nativeToUSDPrice, 18) / pow(10, 18)) /
                  (toDecimal256(cps.vaultSharesTotalSupply, 18) / pow(10, 18))) * 3600
        END, 0)
    ) as total_twtvl
FROM latestView_ClassicPositionSnapshot cps
GROUP BY investor
```

## CLM TWTVL Query

```sql
SELECT
  cps.investor,
  sum(
    coalesce(
      -- token0_usd_value
      (
        (toDecimal256(cps.underlyingBalance0, 18) / pow(10, t0.decimals)) *
        (toDecimal256(cps.token0ToNativePrice, 18) / pow(10, 18)) *
        (toDecimal256(cps.nativeToUSDPrice, 18) / pow(10, 18))
      )
      -- token1_usd_value
      + (
        (toDecimal256(cps.underlyingBalance1, 18) / pow(10, t1.decimals)) *
        (toDecimal256(cps.token1ToNativePrice, 18) / pow(10, 18)) *
        (toDecimal256(cps.nativeToUSDPrice, 18) / pow(10, 18))
      ),
      0
    )
    -- duration_seconds
    * 3600
  ) as total_twtvl,
  max(cps.roundedTimestamp) as max_rounded_timestamp
FROM ClmPositionSnapshot cps
JOIN CLM clm ON cps.clm = clm.id
JOIN Token t0 ON clm.underlyingToken0 = t0.id
JOIN Token t1 ON clm.underlyingToken1 = t1.id
WHERE cps.period = 3600  -- Use hourly snapshots (3600 seconds)
  AND cps.totalBalance > 0
  -- exclude strategies of classic vaults compounding clm products
  AND cps.investor not in (select id from ClassicStrategy)
  AND cps.investor not in (
      -- this is a silo contrat
      '0x19926d2163fde0d77f7d50bb88701a6f51f45fab',
      -- this is an algebra pool
      '0x97fe831cc56da84321f404a300e2be81b5bd668a'
  )
GROUP BY investor
```

## Output Schema

| Property              | Description                                         | Type   |
| --------------------- | --------------------------------------------------- | ------ |
| investor              | The user's wallet address (hex formatted)           | string |
| total_twtvl           | Total TWTVL earned in dollar-seconds                | number |
| max_rounded_timestamp | Latest timestamp of position data for this investor | number |

## Merged query

```sql
WITH
sonic_twtvl_classic AS (
  WITH latestView_ClassicPositionSnapshot AS (
      SELECT
          id,
          classic,
          investor,
          argMax(totalBalance, __genBlockNumber__) AS totalBalance,
          argMax(vaultSharesTotalSupply, __genBlockNumber__) AS vaultSharesTotalSupply,
          argMax(vaultUnderlyingBalance, __genBlockNumber__) AS vaultUnderlyingBalance,
          argMax(underlyingToNativePrice, __genBlockNumber__) AS underlyingToNativePrice,
          argMax(nativeToUSDPrice, __genBlockNumber__) AS nativeToUSDPrice
      FROM prod_subgraph.jT7kA9ye_view_ClassicPositionSnapshot
      WHERE
          __genBlockChain__ = '146'
          AND period = 3600
      GROUP BY id, classic,investor
  )
  SELECT
      cps.investor,
      sum(
          CASE
              WHEN cps.classic IN (
                  -- select distinct decimals from `Token` where id in (select underlyingToken from `Classic`)
                  -- select id from `Classic` where underlyingToken IN (select id from `Token` where decimals <> 18)
                  '0xc1e3ff64d95aea97c0bc15a6c3e2dee87a5cd2ea',
                  '0x392ea759ad696004e5a8f1ece45cac99fac45f4f',
                  '0x3eb55e7a434dca52a064276444c0fe8bf628aada',
                  '0x0356485cbfc04e69daba736c29afe0b90393d521',
                  '0xb2e53c9ff7858d7326e64c1bdb030dd8e1e37095',
                  '0xeb3b876e3889bf55858fb9b359111bb5800d807b',
                  '0x24c8d7dc7d1d2dc0e6f6ae97345c04450a174782',
                  '0xdb6e5dc4c6748ececb97b565f6c074f24384fd07',
                  '0x52b11a7d34b640d684660217653a0dfe728116f0'
              )
              THEN (toDecimal256(cps.totalBalance, 18) / pow(10, 18)) *
                  ((toDecimal256(cps.vaultUnderlyingBalance, 18) / pow(10, 6 /* underlying decimals */)) *
                    (toDecimal256(cps.underlyingToNativePrice, 18) / pow(10, 18)) *
                    (toDecimal256(cps.nativeToUSDPrice, 18) / pow(10, 18)) /
                    (toDecimal256(cps.vaultSharesTotalSupply, 18) / pow(10, 18))) * 3600
              ELSE (toDecimal256(cps.totalBalance, 18) / pow(10, 18)) *
                  ((toDecimal256(cps.vaultUnderlyingBalance, 18) / pow(10, 18 /* underlying decimals */)) *
                    (toDecimal256(cps.underlyingToNativePrice, 18) / pow(10, 18)) *
                    (toDecimal256(cps.nativeToUSDPrice, 18) / pow(10, 18)) /
                    (toDecimal256(cps.vaultSharesTotalSupply, 18) / pow(10, 18))) * 3600
          END
      ) as total_twtvl
  FROM latestView_ClassicPositionSnapshot cps
  GROUP BY investor
),
sonic_twtvl_clm AS (
  SELECT
    cps.investor,
    sum(
      coalesce(
        -- token0_usd_value
        (
          (toDecimal256(cps.underlyingBalance0, 18) / pow(10, t0.decimals)) *
          (toDecimal256(cps.token0ToNativePrice, 18) / pow(10, 18)) *
          (toDecimal256(cps.nativeToUSDPrice, 18) / pow(10, 18))
        )
        -- token1_usd_value
        + (
          (toDecimal256(cps.underlyingBalance1, 18) / pow(10, t1.decimals)) *
          (toDecimal256(cps.token1ToNativePrice, 18) / pow(10, 18)) *
          (toDecimal256(cps.nativeToUSDPrice, 18) / pow(10, 18))
        ),
        0
      )
      -- duration_seconds
      * 3600
    ) as total_twtvl,
    max(cps.roundedTimestamp) as max_rounded_timestamp
  FROM ClmPositionSnapshot cps
  JOIN CLM clm ON cps.clm = clm.id
  JOIN Token t0 ON clm.underlyingToken0 = t0.id
  JOIN Token t1 ON clm.underlyingToken1 = t1.id
  WHERE cps.period = 3600  -- Use hourly snapshots (3600 seconds)
    AND cps.totalBalance > 0
    -- exclude strategies of classic vaults compounding clm products
    AND cps.investor not in (select id from ClassicStrategy)
    AND cps.investor not in (
        -- this is a silo contrat
        '0x19926d2163fde0d77f7d50bb88701a6f51f45fab',
        -- this is an algebra pool
        '0x97fe831cc56da84321f404a300e2be81b5bd668a'
    )
  GROUP BY investor
),
all_twtvl AS (
   select investor, total_twtvl, max_rounded_timestamp from `sonic_twtvl_classic`
    UNION ALL
   select investor, total_twtvl, max_rounded_timestamp from `sonic_twtvl_clm`
)
select
    -- rename to smaller col names to optimize json size
    investor as `user`,
    round(SUM(total_twtvl)) as tt--,
    --MAX(max_rounded_timestamp) as ts
from all_twtvl
GROUP BY investor
ORDER BY 2 DESC
```
