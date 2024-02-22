ARB requirements:
- Daily User Growth: A time series metric representing the daily user growth (in addresses) interacting with the protocol’s contracts.
    - Events: Deposit/Withdraw/Transfer - Zap - Stake/Unstake/Claim
    - count if new user (-> account entity)
    - maintain total count daily (-> protocol entity)
    - Snapshot by day ( -> protocol snapshot entity)

- Daily Active Users: A time series metric representing the daily count of unique addresses interacting with the protocol's contracts.
    - Events: Deposit/Withdraw/Transfer - Zap - Stake/Unstake/Claim
    - Maintain a "last seen date" timestamp for each user (-> account entity . last_seen = "2021-01-01")
    - Count if last seen != today
    - maintain total count daily (-> protocol entity)
    - Snapshot by day ( -> protocol snapshot entity)

- Daily Transaction Count: A time series metric representing the daily number of transactions interacting with the protocol's contracts.
    - Events: Deposit/Withdraw/Transfer - Zap - Stake/Unstake/Claim
    - count if new transaction (-> transaction entity)
    - maintain total count daily (-> protocol entity)
    - Snapshot by day ( -> protocol snapshot entity)

- Daily Protocol Fee: A time series data representing the daily total protocol fee generated. For example, swap fees, borrowing fees, etc., comprising all economic value generated through the protocol, contracts, apps, etc., by users.
    - Events: ChargedFees (CL), ZapFee ??? <=== we have that?
    - sum of fees (-> protocol entity)
    - Snapshot by day ( -> protocol snapshot entity)

- Daily Transaction Fee: A time series, daily total transaction fees generated daily by interactions with the protocol's contracts.
    - Events: Deposit/Withdraw/Transfer - Zap - Stake/Unstake/Claim
    - sum if new transaction (-> transaction entity)
    - extract fee from transaction (-> transaction entity)
    - maintain daily sum in native (-> protocol entity)
    - Snapshot by day ( -> protocol snapshot entity)

- Daily ARB Expenditure and User Claims: Data on individual ARB incentive claim transactions made by users, as incentivized by the protocol. It should include the timestamp, user address, and the claimed ARB amount. The spent ARB will allow for the normalization of growth metrics.
    - Events: Claim 
    - sum by user and token (-> user position incentive entity? -> claimed_rewards)
    - Snapshot by day (-> user position incentive snapshot entity)

- Incentivized User List & Gini: The list should include users incentivized by the protocol along with their performance metrics. For instance, if trading volume is incentivized, this would be a list of traders with their respective trading volumes. If liquidity providers are incentivized, it would include a list of LPs and their liquidities in USD. Protocols should also strive for more uniform engagement levels across a wide user base for long-term sustainability, which will be measured through a gini coefficient across reward recipients. 
    - LP is incentivized????
    - Boosted LP is incentivized????
    - Zapping is incentivized????

- TVL: A daily time series expressed in USD.
    - Events: Deposit/Withdraw/Transfer + Some Daily Clock event (to make sure we update daily)
    - Get TVL + prices from the lens (-> lens deployed)
    - Snapshot by day ( -> protocol snapshot entity)

- List of Depositors: A list of current and past participants who have deposited during the incentivized period to the protocol. The list should include depositor addresses, their current deposits in USD, time-weighted deposits in USD, and the duration of their deposit participation.
    -> Events: Stake/Unstake
    -> extract boost token price from lens (-> boost lens deployed + boost factory) OR encode in thegraph to get the price
    -> wtf is time-weighted deposits in USD????
    -> extract duration of deposit participation (-> user position incentive entity -> position_size_usd, depositor address, claimed_rewards_usd, total_duration_eligible)
    -> Snapshot by day ( -> user position incentive snapshot entity)

- Trading Volume: A daily time series, also measured in USD. List of Liquidity Providers: A list of current and past participants who have provided liquidity to the protocol during the incentivized period. The list should include LP addresses, their current liquidity in USD, time-weighted liquidity in USD, and the duration of liquidity provision.
    -> Events: Deposit/Withdraw/Transfer
    -> get position size from lens (-> lens deployed)
    -> wtf is time-weighted liquidity in USD????
    -> extract duration of liquidity provision (-> user position entity -> position_size_usd, depositor address, duration)
    -> Snapshot by day ( -> user position snapshot entity)


Assumptions to build this with thegraph quickly:
- We have a uniswap-view-quoter deployed on ARB
- We have good zap events
- We will build a boost factory and boost lens


