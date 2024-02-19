done, to test:

- feat: ingest vault harvests

  - update all user positions on harvest?

- fix: update token totalSupply on deposit/withdraw and withdraw
- fix: update underlying amount on deposit/withdraw and withdraw

todo:

- fix: fetch token decimals on token init (crashes atm)
- feat: ingest fees
- feat: handle moo token transfers (avoid duplication with deposit/withdraw events)
- feat: use bigdecimals for amounts
- feat: use arrays for token amounts instead of token0, token1?
  - might be more resilient to changes in the future
  - might also be more annoying to work with

contract changes proposal:

- perf: view contract or multicall for vault init (get token names, etc)
- make StrategyPassiveManagerUniswap implement IStrategyConcLiq?
- make factories init the contract at deploy time?
