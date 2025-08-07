## Data sources

where: dune
table: beefy_sonic.beefygemsfactory_evt_redeemed
schema:
| name | type |
| --- | --- |
| contract_address | varbinary |
| evt_tx_hash | varbinary |
| evt_tx_from | varbinary |
| evt_tx_to | varbinary |
| evt_tx_index | integer |
| evt_index | bigint |
| evt_block_time | timestamp |
| evt_block_number | bigint |
| evt_block_date | date |
| amount | uint256 |
| amountOfS | uint256 |
| seasonNum | uint256 |
| who | varbinary |

## Requirements

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

### Incentive Claim Data Query

```sql
SELECT
    r.evt_block_time as timestamp,
    146 as chain_id,
    r.evt_tx_hash as transaction_hash,
    r.evt_index as log_index,
    r.evt_tx_from as transaction_signer,
    r.who as user_address,
    '0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38' as claimed_token_address, -- wS
    r.amountOfS / pow(10, 18) as amount,
    r.amountOfS / pow(10, 18) * COALESCE(p.price, 0) as amount_usd,
    0.0 as other_incentive_usd -- Placeholder for other incentives
FROM beefy_sonic.beefygemsfactory_evt_redeemed r
LEFT JOIN prices.minute p ON
    p.contract_address = 0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38
    AND p.blockchain = 'sonic'
    AND p.timestamp = date_trunc('minute', r.evt_block_time)
where
    r.amount > 0
    and r.evt_block_time >= TIMESTAMP '{{timestamp}}'
```
