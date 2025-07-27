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

```sql
WITH classic_position_snapshots_scope AS (
  -- Get hourly position snapshots with computed fields from cps only
  SELECT
    cps.*,
    3600 as duration_seconds
  FROM ClassicPositionSnapshot cps
  WHERE cps.period = 3600  -- Use hourly snapshots (3600 seconds)
    --AND cps.classic = '0x60511f14f4bb7371d116806d86a06188f8511e47'
    AND cps.totalBalance > 0
    AND cps.vaultSharesTotalSupply > 0
),

hourly_classic_position_metrics AS (
  -- Join with Classic and Token tables to get additional metadata
  SELECT
    cps.*,
    (toDecimal256(cps.totalBalance, 18) / pow(10, t_shares.decimals)) as shares_balance,
    (toDecimal256(cps.vaultUnderlyingBalance, 18) / pow(10, 18)) *
    (toDecimal256(cps.underlyingToNativePrice, 18) / pow(10, 18)) *
    (toDecimal256(cps.nativeToUSDPrice, 18) / pow(10, 18)) /
    (toDecimal256(cps.vaultSharesTotalSupply, 18) / pow(10, t_shares.decimals)) as usd_per_share
  FROM classic_position_snapshots_scope cps
  JOIN Classic classic ON cps.classic = classic.id
  JOIN Token t_shares ON classic.vaultSharesToken = t_shares.id
),

hourly_classic_twtvl_contributions AS (
  -- Calculate TWTVL contribution for each user-vault-hour
  SELECT
    investor,
    roundedTimestamp,
    shares_balance * usd_per_share * duration_seconds as twtvl_contribution
  FROM hourly_classic_position_metrics
)

-- Final aggregation: sum TWTVL across all vaults and time periods per user
SELECT
  investor,
  SUM(twtvl_contribution) as total_twtvl,
  MAX(roundedTimestamp) as max_rounded_timestamp
FROM hourly_classic_twtvl_contributions
GROUP BY investor
HAVING SUM(twtvl_contribution) > 0
ORDER BY total_twtvl DESC
```

## CLM TWTVL Query

```sql
WITH clm_position_snapshots_scope AS (
  -- Get hourly position snapshots with computed fields from cps only
  SELECT
    cps.*,
    3600 as duration_seconds
  FROM ClmPositionSnapshot cps
  WHERE cps.period = 3600  -- Use hourly snapshots (3600 seconds)
    --AND cps.clm = '0x640ce0aaa22ba039f8dc7811910d44db00eeda56'
    AND cps.totalBalance > 0
),

hourly_clm_position_metrics AS (
  -- Join with CLM and Token tables to get additional metadata
  SELECT
    cps.*,
    (toDecimal256(cps.underlyingBalance0, 18) / pow(10, t0.decimals)) *
    (toDecimal256(cps.token0ToNativePrice, 18) / pow(10, 18)) *
    (toDecimal256(cps.nativeToUSDPrice, 18) / pow(10, 18)) as token0_usd_value,
    (toDecimal256(cps.underlyingBalance1, 18) / pow(10, t1.decimals)) *
    (toDecimal256(cps.token1ToNativePrice, 18) / pow(10, 18)) *
    (toDecimal256(cps.nativeToUSDPrice, 18) / pow(10, 18)) as token1_usd_value
  FROM clm_position_snapshots_scope cps
  JOIN CLM clm ON cps.clm = clm.id
  JOIN Token t0 ON clm.underlyingToken0 = t0.id
  JOIN Token t1 ON clm.underlyingToken1 = t1.id
),

hourly_clm_twtvl_contributions AS (
  -- Calculate TWTVL contribution for each user-clm-hour
  SELECT
    investor,
    roundedTimestamp,
    (token0_usd_value + token1_usd_value) * duration_seconds as twtvl_contribution
  FROM hourly_clm_position_metrics
)

-- Final aggregation: sum TWTVL across all CLMs and time periods per user
SELECT
  investor,
  SUM(twtvl_contribution) as total_twtvl,
  MAX(roundedTimestamp) as max_rounded_timestamp
FROM hourly_clm_twtvl_contributions
WHERE
    -- exclude strategies of classic vaults compounding clm products
    investor not in (select id from ClassicStrategy)
    AND investor not in (
        -- this is a silo contrat
        '0x19926d2163fde0d77f7d50bb88701a6f51f45fab',
        -- this is an algebra pool
        '0x97fe831cc56da84321f404a300e2be81b5bd668a'
    )
GROUP BY investor
HAVING SUM(twtvl_contribution) > 0
ORDER BY total_twtvl DESC
```

## Output Schema

| Property              | Description                                         | Type   |
| --------------------- | --------------------------------------------------- | ------ |
| investor              | The user's wallet address (hex formatted)           | string |
| total_twtvl           | Total TWTVL earned in dollar-seconds                | number |
| max_rounded_timestamp | Latest timestamp of position data for this investor | number |

## Merged query

```sql
WITH classic_twtvl AS (
   <CLASSIC_TWTVL_QUERY>
),
clm_twtvl AS (
   <CLM_TWTVL_QUERY>
),
all_twtvl AS (
   select investor, total_twtvl as twtvl, max_rounded_timestamp from classic_twtvl
    UNION ALL
   select investor, total_twtvl as twtvl, max_rounded_timestamp from clm_twtvl
)
select
    investor,
    SUM(twtvl) as total_twtvl,
    MAX(max_rounded_timestamp) as max_rounded_timestamp
from all_twtvl
GROUP BY investor
HAVING SUM(twtvl) > 0
ORDER BY total_twtvl DESC
```
