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

- getEthRateUniV3:

  - https://github.com/convex-community/convex-subgraph/blob/1d0255a870c7a99cc58f5979138de5efe4904741/packages/utils/pricing.ts#L70

- multicall:

  - https://github.com/curvefi/volume-subgraphs/blob/757fc0e266ac467883cc7d227d92fc724822a010/subgraphs/crvusd/src/services/userstate.ts#L10C10-L10C19
  - https://github.com/curvefi/volume-subgraphs/blob/757fc0e266ac467883cc7d227d92fc724822a010/subgraphs/crvusd/src/services/snapshot.ts#L95
  - https://github.com/curvefi/volume-subgraphs/blob/757fc0e266ac467883cc7d227d92fc724822a010/subgraphs/volume/src/services/multicall.ts#L33

- snapshots:

  - https://github.com/curvefi/volume-subgraphs/blob/757fc0e266ac467883cc7d227d92fc724822a010/subgraphs/crvusd/src/services/snapshot.ts#L74
  - https://github.com/curvefi/volume-subgraphs/blob/757fc0e266ac467883cc7d227d92fc724822a010/subgraphs/crvusd/src/services/time.ts#L9
  - https://github.com/curvefi/volume-subgraphs/blob/757fc0e266ac467883cc7d227d92fc724822a010/subgraphs/crvusd/src/llamma.ts#L60

- uniswap prices:
  - https://github.com/Uniswap/v3-subgraph/blob/bf03f940f17c3d32ee58bd37386f26713cff21e2/src/mappings/core.ts#L46
  - https://github.com/Uniswap/v3-subgraph/blob/bf03f940f17c3d32ee58bd37386f26713cff21e2/src/utils/pricing.ts#L74
  - https://github.com/Uniswap/v3-subgraph/blob/bf03f940f17c3d32ee58bd37386f26713cff21e2/src/mappings/core.ts#L80
  - https://github.com/Uniswap/v3-subgraph/blob/bf03f940f17c3d32ee58bd37386f26713cff21e2/src/mappings/core.ts#L38
  - https://github.com/Uniswap/v3-subgraph/blob/bf03f940f17c3d32ee58bd37386f26713cff21e2/src/utils/pricing.ts#L62

they index all prices in "token0/token1" ofc
then they convert that to WETH using some heuristic (looping over a set of pools, etc)
then they just read from their WETH/USDC market to do native->usd

https://github.com/Uniswap/v3-periphery/blob/v1.0.0/contracts/lens/Quoter.sol
https://docs.uniswap.org/contracts/v3/reference/periphery/interfaces/IQuoter
